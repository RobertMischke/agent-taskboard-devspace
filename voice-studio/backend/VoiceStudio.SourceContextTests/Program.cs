using System.Diagnostics;
using VoiceStudio;

var checks = 0;
void Check(bool condition, string description) { checks++; if (!condition) throw new Exception(description); }
var fixtureRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "voice-source-context-" + Guid.NewGuid().ToString("N")));
Directory.CreateDirectory(fixtureRoot);
try
{
    var repository = Path.Combine(fixtureRoot, "repository");
    var sourceRoot = Path.Combine(repository, "site");
    Directory.CreateDirectory(sourceRoot);
    var file = Path.Combine(sourceRoot, "-quoted [name].md");
    File.WriteAllText(file, "# Exact source\nInitial content.\n");
    File.WriteAllText(Path.Combine(repository, ".gitignore"), ".voice-lint/\n");
    Git(repository, "init", "-b", "context-test");
    Git(repository, "add", "--", ".");
    Git(repository, "-c", "user.name=Voice Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Fixture source");
    var head = Git(repository, "rev-parse", "HEAD");
    var store = new ProjectStore(Path.Combine(fixtureRoot, "studio"), false);
    var project = store.Register(new(sourceRoot, "Source fixture"));
    var document = store.ListDocuments(project.Id).Single();
    var service = new SourceContextService(store);
    var metadata = Path.Combine(sourceRoot, ".voice-lint");
    var metadataBefore = Directory.Exists(metadata) ? Directory.GetFiles(metadata, "*", SearchOption.AllDirectories).Select(path => (path, File.GetLastWriteTimeUtc(path))).ToArray() : [];
    var basic = await service.GetAsync(project.Id, document.Id, false);
    Check(basic.Git is null && basic.AbsolutePath == file && basic.Path == "-quoted [name].md", "Source context preserves the exact validated file path; Git is opt-in.");
    Check(basic.SourceVersion == document.Version, "Source hash matches the existing document version contract.");
    var clean = (await service.GetAsync(project.Id, document.Id, true)).Git!;
    Check(clean.Available && clean.IsRepository && clean.RepositoryRoot == repository && clean.Branch == "context-test" && clean.Head == head, "Nested registered project resolves the actual repository and HEAD.");
    Check(clean.Tracked == true && clean.Dirty == false && clean.RepositoryDirty == false && clean.Status == "clean", "Clean source and repository state are explicit.");
    Check(clean.RelativePath == "site/-quoted [name].md", "Pathspec punctuation is treated literally.");
    File.WriteAllText(Path.Combine(repository, "other.txt"), "Untracked fixture change");
    var other = (await service.GetAsync(project.Id, document.Id, true)).Git!;
    Check(other.Dirty == false && other.RepositoryDirty == true, "Repository changes are distinguished from this file's state.");
    File.AppendAllText(file, "Changed source.\n");
    var dirty = await service.GetAsync(project.Id, document.Id, true);
    Check(dirty.Git!.Dirty == true && dirty.Git.Status == " M" && dirty.SourceVersion != basic.SourceVersion, "Current modified file and content hash change together.");
    Git(repository, "checkout", "--detach", "HEAD");
    var detached = (await service.GetAsync(project.Id, document.Id, true)).Git!;
    Check(detached.Branch is null && detached.Head == head && detached.Error is null, "Detached HEAD stays detached rather than inventing a branch.");
    var outside = Path.Combine(fixtureRoot, "plain-folder");Directory.CreateDirectory(outside);File.WriteAllText(Path.Combine(outside, "page.md"), "# No repository\n");
    var plain = store.Register(new(outside, "Plain source"));var plainDocument = store.ListDocuments(plain.Id).Single();
    var noGit = await service.GetAsync(plain.Id, plainDocument.Id, true);
    Check(noGit.Git is { Available: true, IsRepository: false, Error: null } && noGit.AbsolutePath.EndsWith("page.md"), "Non-repository sources remain inspectable without a spurious error.");
    var unbornRoot=Path.Combine(fixtureRoot,"unborn");Directory.CreateDirectory(unbornRoot);File.WriteAllText(Path.Combine(unbornRoot,"page.md"),"# Uncommitted\n");Git(unbornRoot,"init","-b","new-branch");
    var unbornProject=store.Register(new(unbornRoot,"Unborn source"));var unbornDoc=store.ListDocuments(unbornProject.Id).Single();
    var unborn=(await service.GetAsync(unbornProject.Id,unbornDoc.Id,true)).Git!;
    Check(unborn.Branch=="new-branch" && unborn.Head is null && unborn.Tracked==false && unborn.Dirty==true && unborn.Error is null,"An unborn repository reports its branch and untracked file without inventing a commit.");
    var inherited=Environment.GetEnvironmentVariable("GIT_DIR");Environment.SetEnvironmentVariable("GIT_DIR",Path.Combine(unbornRoot,".git"));
    try { Check((await service.GetAsync(project.Id,document.Id,true)).Git!.Head==head,"Inherited GIT_DIR cannot redirect inspection to a different repository."); }
    finally { Environment.SetEnvironmentVariable("GIT_DIR",inherited); }
    try { await service.GetAsync(project.Id, "../escape", true); throw new Exception("Invalid document accepted"); }
    catch (ApiError error) { Check(error.Status == 404, "Unknown document IDs cannot escape the registered source set."); }
    using var cancelled = new CancellationTokenSource();cancelled.Cancel();
    try { await service.GetAsync(project.Id,document.Id,true,cancelled.Token);throw new Exception("Cancellation ignored"); }
    catch(OperationCanceledException){checks++;}
    var hostPath=Environment.GetEnvironmentVariable("PATH");Environment.SetEnvironmentVariable("PATH",Path.Combine(fixtureRoot,"no-git"));
    try
    {
        Check((await service.GetAsync(project.Id,document.Id,false)).Git is null,"Basic source context works with no Git executable.");
        var unavailable=await service.GetAsync(project.Id,document.Id,true);
        Check(unavailable.AbsolutePath==file && unavailable.Git is {Available:false,Error:not null},"Unavailable Git is explicit while the exact source remains available.");
    }
    finally { Environment.SetEnvironmentVariable("PATH",hostPath); }
    var metadataAfter = Directory.Exists(metadata) ? Directory.GetFiles(metadata, "*", SearchOption.AllDirectories).Select(path => (path, File.GetLastWriteTimeUtc(path))).ToArray() : [];
    Check(metadataBefore.SequenceEqual(metadataAfter), "Source inspection never writes review metadata.");
    Console.WriteLine($"Source context: {checks} checks passed; isolated local Git fixtures only, no network or model calls.");
}
finally
{
    var resolved = Path.GetFullPath(fixtureRoot);
    var expectedParent = Path.GetFullPath(Path.GetTempPath());
    if (!resolved.StartsWith(expectedParent, StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(resolved).StartsWith("voice-source-context-", StringComparison.Ordinal)) throw new Exception("Unexpected fixture cleanup path");
    foreach(var file in Directory.EnumerateFiles(resolved,"*",SearchOption.AllDirectories)) File.SetAttributes(file,FileAttributes.Normal);
    Directory.Delete(resolved,true);
}

static string Git(string directory, params string[] arguments)
{
    var info = new ProcessStartInfo("git") { WorkingDirectory=directory,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true };
    foreach(var argument in arguments) info.ArgumentList.Add(argument);
    using var process=Process.Start(info)!;var output=process.StandardOutput.ReadToEnd();var error=process.StandardError.ReadToEnd();
    if(!process.WaitForExit(10000)) {process.Kill(true);throw new Exception("Fixture git timeout");}
    if(process.ExitCode!=0)throw new Exception("Fixture Git failed: "+error);
    return output.Trim();
}
