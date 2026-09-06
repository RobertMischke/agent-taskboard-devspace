using System.Text.Json;
using System.Text.Json.Nodes;
using VoiceStudio;
using System.Diagnostics;
using System.Text;

if (args is ["--process-fixture", var mode])
{
    if (mode == "leaf") { await Task.Delay(Timeout.Infinite); return; }
    Console.Out.Write(new string('o', 90000)); Console.Out.Flush();
    Console.Error.Write(new string('e', 90000)); Console.Error.Flush();
    if (mode == "tree")
    {
        var child = Process.Start(SelfCommand("leaf"))!;
        Console.WriteLine("child:" + child.Id); Console.Out.Flush();
        await Task.Delay(Timeout.Infinite);
    }
    Environment.ExitCode = 3;
    return;
}
static ProcessStartInfo SelfCommand(string mode)
{
    var info = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true };
    if (string.Equals(Path.GetFileNameWithoutExtension(Environment.ProcessPath), "dotnet", StringComparison.OrdinalIgnoreCase)) info.ArgumentList.Add(typeof(Fixture).Assembly.Location);
    info.ArgumentList.Add("--process-fixture"); info.ArgumentList.Add(mode);
    return info;
}
var checks = 0;
void Check(bool value, string name) { checks++; if (!value) throw new Exception("FAIL: " + name); }
void Reject(Action action, string name, int status = 409)
{
    checks++;
    try { action(); } catch (ApiError error) when (error.Status == status) { return; }
    throw new Exception("FAIL: " + name);
}
using (var f = new Fixture())
{
    using var missing = new ProjectCheckService(f.Store, Path.Combine(f.Home, "missing.json"), f.Fake);
    Check(!missing.Configuration(f.Project).Configured && f.Fake.Starts == 0, "missing private host config cannot start processes");
    var config = f.Service.Configuration(f.Project);
    Check(config.Configured && config.Startable && config.InputFileCount == 3, "configured source fingerprint includes dependency prerequisite");
    var input = new ProjectCheckStartInput(config.CurrentSourceVersion!, config.ConfigurationVersion!, "start-one");
    Reject(() => f.Service.Start(f.Project, input with { ExpectedSourceVersion = new string('0', 64) }), "stale source rejected before execution");
    var run = f.Service.Start(f.Project, input);
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    Check(File.Exists(f.RunPath(run.Id)) && f.Fake.Starts == 1, "durable run exists before explicitly starting fixed process");
    Check(f.Fake.Command!.Executable == f.Profile.Executable && f.Fake.Command.Arguments.SequenceEqual(f.Profile.Arguments) && f.Fake.Command.WorkingDirectory == f.Root, "only host-configured executable args and exact registered cwd used");
    Check(f.Service.Start(f.Project, input).Id == run.Id && f.Fake.Starts == 1, "duplicate request does not launch twice");
    Reject(() => f.Service.Start(f.Project, input with { RequestId = "different" }), "only one process can run at a time");
    Check(!f.Service.Configuration(f.Project).Startable, "configuration reflects occupied process slot");
    f.Fake.Output!(new string('a', 70000));
    f.Fake.Output!("still drained after limit\n");
    var progress = f.Service.Get(f.Project, run.Id);
    Check(progress.Log.Length == ProjectCheckService.LogLimit && progress.LogTruncated, "large output is bounded while process remains active");
    f.Fake.Finish.TrySetResult(0);
    var result = await f.Finished(run.Id);
    Check(result.Status == "completed" && result.Outcome == "completed" && result.ExitCode == 0 && result.CompletedAt is not null, "successful exit is persisted for checked input version");
    using var restarted = new ProjectCheckService(f.Store, f.ConfigPath, new FakeProcess());
    Check(restarted.Get(f.Project, run.Id).Status == "completed", "completed result survives service restart");
    Directory.CreateDirectory(Path.Combine(f.Root, "dist"));
    File.WriteAllText(Path.Combine(f.Root, "dist", "output.js"), "generated");
    Check(restarted.Configuration(f.Project).CurrentSourceVersion == config.CurrentSourceVersion, "build output excluded from input fingerprint");
    File.AppendAllText(Path.Combine(f.Root, "src", "page.md"), "source changed");
    var stale = restarted.Get(f.Project, run.Id);
    Check(stale.Status == "stale" && stale.Outcome == "completed" && stale.ExitCode == 0, "later source change invalidates result while retaining original outcome");
    Reject(() => restarted.Get(f.Project, "../escape"), "metadata id cannot escape project", 400);
}
using (var f = new Fixture())
{
    var run = f.Start();
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    File.AppendAllText(Path.Combine(f.Root, "check.mjs"), "// modified build script");
    f.Fake.Finish.TrySetResult(0);
    var result = await f.Finished(run.Id);
    Check(result.Status == "stale" && result.ExitCode == 0, "script change during check cannot produce current success");
}
using (var f = new Fixture())
{
    var run = f.Start();
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    f.Fake.Output!("stderr: failed validation\n");
    f.Fake.Finish.TrySetResult(7);
    var result = await f.Finished(run.Id);
    Check(result.Status == "failed" && result.ExitCode == 7 && result.Log.Contains("failed validation"), "nonzero exit preserves output and code");
}
using (var f = new Fixture())
{
    var run = f.Start();
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    Check(f.Service.Cancel(f.Project, run.Id).Status == "cancelling", "explicit cancellation is immediately visible");
    var result = await f.Finished(run.Id);
    Check(result.Status == "cancelled" && f.Fake.Cancelled, "cancellation reaches process abstraction and becomes terminal");
    Check(f.Service.Cancel(f.Project, run.Id).Status == "cancelled", "repeat cancel is idempotent");
}
using (var f = new Fixture(timeout: 1))
{
    var run = f.Start();
    var result = await f.Finished(run.Id);
    Check(result.Status == "failed" && result.Error!.Contains("Zeitlimit") && f.Fake.Cancelled, "timeout cancels process and reports failed timeout honestly");
}
using (var f = new Fixture())
{
    File.Delete(Path.Combine(f.Root, "dependency.ready"));
    var config = f.Service.Configuration(f.Project);
    Check(config.Configured && !config.Startable && config.Message!.Contains("Voraussetzung fehlt"), "missing dependency prerequisite disables start");
    Reject(() => f.Service.Start(f.Project, new(config.CurrentSourceVersion!, config.ConfigurationVersion!, "no-install")), "missing dependencies reject before launch");
    Check(f.Fake.Starts == 0, "no automatic install or check occurs");
}
using (var f = new Fixture())
{
    File.WriteAllBytes(Path.Combine(f.Root, "src", "large.bin"), new byte[ProjectCheckService.MaxFileBytes + 1]);
    var config = f.Service.Configuration(f.Project);
    Check(!config.Startable && config.CurrentSourceVersion is null, "oversized source fails closed without a partial fingerprint");
}
using (var f = new Fixture())
{
    var inside = Path.Combine(f.Root, "host-checks.json");
    File.Copy(f.ConfigPath, inside);
    using var unsafeService = new ProjectCheckService(f.Store, inside, f.Fake);
    Check(!unsafeService.Configuration(f.Project).Configured, "repo-owned host configuration is rejected");
    f.WriteProfile(f.Profile with { Executable = Path.Combine(f.Root, "check.mjs") });
    using var unsafeExecutable = new ProjectCheckService(f.Store, f.ConfigPath, f.Fake);
    Check(!unsafeExecutable.Configuration(f.Project).Configured, "repo-owned executable is rejected");
    f.WriteProfile(f.Profile with { InputFiles = ["../outside"] });
    using var unsafePath = new ProjectCheckService(f.Store, f.ConfigPath, f.Fake);
    Check(!unsafePath.Configuration(f.Project).Configured, "source paths cannot escape registered project");
}
using (var f = new Fixture())
{
    var run = f.Start();
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    f.Fake.Finish.TrySetResult(0);
    await f.Finished(run.Id);
    var json = JsonNode.Parse(File.ReadAllText(f.RunPath(run.Id)))!;
    json["run"]!["status"] = "running";
    json["run"]!["completedAt"] = null;
    File.WriteAllText(f.RunPath(run.Id), json.ToJsonString());
    var fake = new FakeProcess();
    using var restarted = new ProjectCheckService(f.Store, f.ConfigPath, fake);
    var recovered = restarted.Get(f.Project, run.Id);
    Check(recovered.Status == "failed" && recovered.Error!.Contains("Dienstneustart") && fake.Starts == 0, "interrupted persisted runs recover without re-executing");
    f.WriteProfile(f.Profile with { Arguments = ["changed-host-command"] });
    using var changed = new ProjectCheckService(f.Store, f.ConfigPath, fake);
    Check(changed.Get(f.Project, run.Id).Status == "stale", "host profile change invalidates historical result");
    json["run"]!["id"] = "../../bad";
    File.WriteAllText(f.RunPath(run.Id), json.ToJsonString());
    Reject(() => changed.Get(f.Project, run.Id), "tampered persisted identity rejected");
}
using (var f = new Fixture())
{
    File.Delete(Path.Combine(f.Root, "check.mjs"));
    Check(!f.Service.Configuration(f.Project).Startable, "missing configured source file fails closed");
}
using (var f = new Fixture())
{
    Directory.Delete(Path.Combine(f.Root, "src"), true);
    Check(!f.Service.Configuration(f.Project).Startable, "missing configured source directory fails closed");
}
using (var f = new Fixture())
{
    var oldConfig = f.Service.Configuration(f.Project);
    var originalInput = new ProjectCheckStartInput(oldConfig.CurrentSourceVersion!, oldConfig.ConfigurationVersion!, "profile-bound");
    var first = f.Service.Start(f.Project, originalInput);
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    f.Fake.Finish.TrySetResult(0);
    await f.Finished(first.Id);
    f.WriteProfile(f.Profile with { Arguments = ["different-host-command"] });
    var nextProcess = new FakeProcess();
    using var changed = new ProjectCheckService(f.Store, f.ConfigPath, nextProcess);
    var newConfig = changed.Configuration(f.Project);
    Check(newConfig.CurrentSourceVersion == oldConfig.CurrentSourceVersion && newConfig.ConfigurationVersion != oldConfig.ConfigurationVersion, "host arguments change configuration without changing source hash");
    Reject(() => changed.Start(f.Project, originalInput with { RequestId = "new-from-old-ui" }), "old UI cannot launch newly configured command for identical source");
    Reject(() => changed.Start(f.Project, originalInput with { ExpectedConfigurationVersion = newConfig.ConfigurationVersion! }), "same request ID cannot be reused for different command profile");
    Check(changed.Start(f.Project, originalInput).Id == first.Id && nextProcess.Starts == 0, "identical historical replay returns original run and never starts changed command");
    Reject(() => changed.Start(f.Project, originalInput with { ExpectedConfigurationVersion = "" }), "configuration fingerprint is required", 400);
    var next = changed.Start(f.Project, originalInput with { RequestId = "reviewed-new-profile", ExpectedConfigurationVersion = newConfig.ConfigurationVersion! });
    await nextProcess.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    Check(nextProcess.Command!.Arguments.SequenceEqual(["different-host-command"]), "fresh explicit input can launch new host profile");
    changed.Cancel(f.Project, next.Id);
}
using (var f = new Fixture())
{
    var run = f.Start();
    await f.Fake.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
    f.FailWrites = true;
    var retainedError = false;
    try { f.Service.Cancel(f.Project, run.Id); }
    catch (IOException error) { retainedError = error.Message == "fixture persistence failure"; }
    Check(retainedError, "cancel retains persistence failure instead of reporting a successful save");
    for (var i = 0; i < 100 && !f.Fake.Cancelled; i++) await Task.Delay(10);
    Check(f.Fake.Cancelled, "cancel reaches running process even when cancelling-state save fails");
    f.FailWrites = false;
    Check((await f.Finished(run.Id)).Status is "cancelled" or "failed", "failed cancellation persistence cannot leave process running");
}
var realProcess = new ProjectCheckProcess();
var ownCommand = SelfCommand("output");
var charCount = 0;
var exit = await realProcess.RunAsync(new(ownCommand.FileName, ownCommand.ArgumentList.ToArray(), Path.GetTempPath()), chunk => Interlocked.Add(ref charCount, chunk.Length), CancellationToken.None);
Check(exit == 3 && charCount == 180000, "real process drains stdout and stderr concurrently and preserves exit code");
using (var cancelTree = new CancellationTokenSource(TimeSpan.FromSeconds(10)))
{
    var tree = SelfCommand("tree");
    var output = new StringBuilder();
    var childReady = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
    var work = realProcess.RunAsync(new(tree.FileName, tree.ArgumentList.ToArray(), Path.GetTempPath()), chunk =>
    {
        lock (output)
        {
            output.Append(chunk);
            var match = System.Text.RegularExpressions.Regex.Match(output.ToString(), @"child:(\d+)\r?\n");
            if (match.Success) childReady.TrySetResult(int.Parse(match.Groups[1].Value));
        }
    }, cancelTree.Token);
    var childId = await childReady.Task.WaitAsync(TimeSpan.FromSeconds(8));
    cancelTree.Cancel();
    var cancelled = false;
    try { await work; } catch (OperationCanceledException) { cancelled = true; }
    Check(cancelled, "real process cancellation remains cancellation");
    var childStopped = false;
    try { using var child = Process.GetProcessById(childId); childStopped = child.HasExited; }
    catch (ArgumentException) { childStopped = true; }
    Check(childStopped, "cancellation terminates and waits for the process tree");
}
Console.WriteLine($"PASS: {checks} local project-check assertions; FakeProcess plus isolated process fixtures, no model or project build execution.");

sealed class FakeProcess : IProjectCheckProcess
{
    public int Starts;
    public CheckProcessCommand? Command;
    public Action<string>? Output;
    public bool Cancelled;
    public TaskCompletionSource Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource<int> Finish = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public async Task<int> RunAsync(CheckProcessCommand command, Action<string> output, CancellationToken ct)
    {
        Starts++; Command = command; Output = output; Started.TrySetResult();
        try { return await Finish.Task.WaitAsync(ct); }
        catch (OperationCanceledException) { Cancelled = true; throw; }
    }
}
sealed class Fixture : IDisposable
{
    public string Home = Path.Combine(Path.GetTempPath(), "voice-check-tests-" + Guid.NewGuid().ToString("N"));
    public string Root;
    public string ConfigPath;
    public string Project;
    public ProjectStore Store;
    public FakeProcess Fake = new();
    public ProjectCheckService Service;
    public ProjectCheckProfile Profile;
    public bool FailWrites;
    public Fixture(int timeout = 10)
    {
        Root = Path.Combine(Home, "project");
        ConfigPath = Path.Combine(Home, "private-host.json");
        Directory.CreateDirectory(Path.Combine(Root, "src"));
        File.WriteAllText(Path.Combine(Root, "src", "page.md"), "# Local fixture\nSource to check.\n");
        File.WriteAllText(Path.Combine(Root, "check.mjs"), "// host-selected project code\n");
        File.WriteAllText(Path.Combine(Root, "dependency.ready"), "installed");
        Store = new ProjectStore(Home, false);
        Project = Store.Register(new(Root, "Fixture")).Id;
        Profile = new(Root, "Local fixture check", Environment.ProcessPath!, ["fixed", "argument with spaces"], ["src"], ["check.mjs"], ["dependency.ready"], timeout);
        WriteProfile(Profile);
        Service = new ProjectCheckService(Store, ConfigPath, Fake, (path, text) => { if (FailWrites) throw new IOException("fixture persistence failure"); ProjectStore.AtomicWrite(path, text); });
    }
    public void WriteProfile(ProjectCheckProfile profile) => File.WriteAllText(ConfigPath, JsonSerializer.Serialize(new ProjectCheckHostConfiguration(1, [profile]), ProjectStore.Json));
    public string RunPath(string id) => Path.Combine(Root, ".voice-lint", "check-runs", id + ".json");
    public ProjectCheckRun Start() => Service.Start(Project, new(Service.Configuration(Project).CurrentSourceVersion!, Service.Configuration(Project).ConfigurationVersion!, Guid.NewGuid().ToString("N")));
    public async Task<ProjectCheckRun> Finished(string id)
    {
        for (var i = 0; i < 100; i++)
        {
            var run = Service.Get(Project, id);
            if (run.Status is not ("running" or "cancelling")) return run;
            await Task.Delay(50);
        }
        throw new Exception("Check did not finish.");
    }
    public void Dispose() { Service.Dispose(); Directory.Delete(Home, true); }
}
