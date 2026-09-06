using System.Diagnostics;

namespace VoiceStudio;

/// <summary>A configured local build process, not a sandbox or an agent runtime.</summary>
public sealed class ProjectCheckProcess : IProjectCheckProcess
{
    public async Task<int> RunAsync(CheckProcessCommand command, Action<string> output, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var info = new ProcessStartInfo(command.Executable)
        {
            WorkingDirectory = command.WorkingDirectory, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        foreach (var arg in command.Arguments) info.ArgumentList.Add(arg);
        info.Environment["NO_COLOR"] = "1";
        info.Environment["FORCE_COLOR"] = "0";
        using var process = new Process { StartInfo = info };
        if (!process.Start()) throw new IOException("Prüfprozess konnte nicht gestartet werden.");
        using var cancel = cancellationToken.Register(() => Kill(process));
        var stdout = Drain(process.StandardOutput, output);
        var stderr = Drain(process.StandardError, output);
        try
        {
            await process.WaitForExitAsync(cancellationToken);
            await Task.WhenAll(stdout, stderr).WaitAsync(TimeSpan.FromSeconds(5));
            cancellationToken.ThrowIfCancellationRequested();
            return process.ExitCode;
        }
        finally
        {
            Kill(process);
            try { await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)); }
            catch (TimeoutException) { }
            try { await Task.WhenAll(stdout, stderr).WaitAsync(TimeSpan.FromSeconds(5)); }
            catch (Exception error) when (error is IOException or ObjectDisposedException or TimeoutException) { }
        }
    }

    private static async Task Drain(StreamReader reader, Action<string> output)
    {
        var buffer = new char[2048];
        int count;
        while ((count = await reader.ReadAsync(buffer)) > 0) output(new string(buffer, 0, count));
    }
    private static void Kill(Process process)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
    }
}
