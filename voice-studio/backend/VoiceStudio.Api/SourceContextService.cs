using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace VoiceStudio;

public record SourceContextResult(string ProjectId, string DocumentId, string Path, string AbsolutePath, string SourceVersion, SourceGitContext? Git = null);
/// <summary>Current checkout state only. Dirty refers to this file; RepositoryDirty refers to the whole checkout.</summary>
public record SourceGitContext(bool Available, bool IsRepository, string? RepositoryRoot = null, string? Branch = null,
    string? Head = null, string? RelativePath = null, string? Status = null, bool? Dirty = null,
    bool? RepositoryDirty = null, bool? Tracked = null, string? Error = null);

public sealed partial class ProjectStore
{
    internal SourceContextResult ReadSourceContext(string projectId, string documentId)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var document = Document(project, documentId);
            // Do not call Detail: review recovery can persist metadata during an otherwise read-only request.
            var (source, _) = ReadSource(document.FullPath);
            return new(projectId, documentId, document.RelativePath, document.FullPath, Hash(source));
        }
    }
}

/// <summary>Optional, bounded local Git inspection. Never fetches, checks out, attributes authorship, or writes source.</summary>
public sealed class SourceContextService(ProjectStore store)
{
    private const int OutputLimit = 64 * 1024;

    public async Task<SourceContextResult> GetAsync(string projectId, string documentId, bool includeGit, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var source = store.ReadSourceContext(projectId, documentId);
        if (!includeGit) return source;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(6));
        SourceGitContext git;
        try { git = await InspectAsync(source.AbsolutePath, timeout.Token); }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { git = new(true, false, Error: "Git inspection timed out. The source file is still available."); }
        catch (Win32Exception) { git = new(false, false, Error: "Git is unavailable on this host."); }
        catch (InvalidOperationException) { git = new(true, false, Error: "Git context could not be inspected."); }
        catch (IOException) { git = new(true, false, Error: "Git context could not be read."); }
        return source with { Git = git };
    }

    private static async Task<SourceGitContext> InspectAsync(string absolutePath, CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(absolutePath)!;
        var root = await RunAsync(directory, ["rev-parse", "--show-toplevel"], cancellationToken);
        if (root.ExitCode != 0)
        {
            // A normal directory has no repository. Permission/config failures are not reported as a clean checkout.
            return root.Error.Contains("not a git repository", StringComparison.OrdinalIgnoreCase)
                ? new(true, false)
                : new(true, false, Error: "Git context could not be inspected.");
        }
        var repositoryRoot = Path.GetFullPath(root.Output.Trim());
        var relative = Path.GetRelativePath(repositoryRoot, absolutePath).Replace('\\', '/');
        if (relative.StartsWith("../", StringComparison.Ordinal) || Path.IsPathFullyQualified(relative))
            return new(true, false, Error: "Git returned a repository outside the source path.");
        var branch = await RunAsync(repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], cancellationToken);
        var head = await RunAsync(repositoryRoot, ["rev-parse", "--verify", "HEAD"], cancellationToken);
        var file = await RunAsync(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=all", "--", relative], cancellationToken);
        var repository = await RunAsync(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignore-submodules=all"], cancellationToken);
        var tracked = await RunAsync(repositoryRoot, ["ls-files", "--error-unmatch", "--", relative], cancellationToken);
        var statusAvailable = file.ExitCode == 0;
        var repositoryAvailable = repository.ExitCode == 0;
        var status = statusAvailable ? (file.Output.Length >= 2 ? file.Output[..2] : "clean") : null;
        return new(true, true, repositoryRoot,
            branch.ExitCode == 0 ? branch.Output.Trim() : null,
            head.ExitCode == 0 ? head.Output.Trim() : null,
            relative, status, statusAvailable ? file.Output.Length > 0 : null,
            repositoryAvailable ? repository.Output.Length > 0 : null,
            tracked.ExitCode is 0 or 1 ? tracked.ExitCode == 0 : null,
            statusAvailable && repositoryAvailable && branch.ExitCode is 0 or 1 && (head.ExitCode == 0 || branch.ExitCode == 0)
                ? null : "Some Git context is unavailable.");
    }

    private sealed record GitResult(int ExitCode, string Output, string Error);
    private static async Task<GitResult> RunAsync(string directory, string[] arguments, CancellationToken cancellationToken)
    {
        var info = new ProcessStartInfo("git")
        {
            WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        // Inherited Git environment variables must not redirect this request to another checkout/index.
        foreach (var key in info.Environment.Keys.Where(key => key.StartsWith("GIT_", StringComparison.OrdinalIgnoreCase)).ToArray()) info.Environment.Remove(key);
        info.Environment["GIT_OPTIONAL_LOCKS"] = "0";
        info.Environment["GIT_TERMINAL_PROMPT"] = "0";
        info.Environment["GIT_CONFIG_NOSYSTEM"] = "1";
        info.Environment["GIT_CONFIG_GLOBAL"] = OperatingSystem.IsWindows() ? "NUL" : "/dev/null";
        info.Environment["LC_ALL"] = "C";
        foreach (var value in new[] { "--no-optional-locks", "--literal-pathspecs", "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "-c", "core.quotePath=false" }) info.ArgumentList.Add(value);
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var process = new Process { StartInfo = info };
        if (!process.Start()) throw new InvalidOperationException("Git did not start.");
        var output = ReadBoundedAsync(process.StandardOutput, cancellationToken);
        var error = ReadBoundedAsync(process.StandardError, cancellationToken);
        try
        {
            await process.WaitForExitAsync(cancellationToken);
            var captured = await Task.WhenAll(output, error);
            if (captured.Any(value => value.Truncated)) return new(-1, "", "Git output exceeded the inspection limit.");
            return new(process.ExitCode, captured[0].Text, captured[1].Text);
        }
        catch
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } catch (Win32Exception) { }
            try { await Task.WhenAll(output, error); } catch (OperationCanceledException) { }
            throw;
        }
    }

    private static async Task<(string Text, bool Truncated)> ReadBoundedAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        var text = new StringBuilder();
        var buffer = new char[4096];
        var truncated = false;
        int count;
        while ((count = await reader.ReadAsync(buffer.AsMemory(), cancellationToken)) > 0)
        {
            var keep = Math.Min(count, OutputLimit - text.Length);
            text.Append(buffer, 0, keep);
            truncated |= keep != count;
        }
        return (text.ToString(), truncated);
    }
}
