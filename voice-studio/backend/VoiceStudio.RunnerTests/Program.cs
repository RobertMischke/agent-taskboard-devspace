using System.Runtime.CompilerServices;
using System.Text.Json;
using CodingAgentRunner.Events;
using CodingAgentRunner.Execution;
using CodingAgentRunner.Model;
using VoiceStudio;

var checks = 0;
void Check(bool result, string message) { if (!result) throw new Exception("FAIL: " + message); checks++; }
void Reject(Action action, string message) { try { action(); } catch (Exception e) when (e is ApiError or JsonException or InvalidOperationException) { checks++; return; } throw new Exception("FAIL: " + message); }
var home = Path.Combine(Path.GetTempPath(), "voice-runner-tests-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(home);
try
{
    var projectRoot = Path.Combine(home, "source"); Directory.CreateDirectory(projectRoot);
    var sourcePath = Path.Combine(projectRoot, "guide.md");
    File.WriteAllText(sourcePath, "# Review.\nEine Aussage mit Bedeutung.\n");
    var contextPath = Path.Combine(projectRoot, "component.ts");
    File.WriteAllText(contextPath, "export const role = 'product intro';");
    File.WriteAllText(Path.Combine(projectRoot, "voice.config.json"), JsonSerializer.Serialize(new { version = 1, sourceFiles = new[] { "guide.md" }, sourceContexts = new Dictionary<string, string[]> { ["guide.md"] = ["component.ts"] } }));
    var store = new ProjectStore(home, false);
    var project = store.Register(new(projectRoot, "Runner fixture"));
    var documentId = store.ListDocuments(project.Id).Single().Id;
    var document = store.GetDocument(project.Id, documentId);
    var config = new RunnerReviewOptions { Cli = "codex", Model = "gpt-5.6-sol", ThinkingLevel = "medium" };
    var fake = new FakeRunner();
    using (var disabled = new RunnerReviewService(store, new(), Path.Combine(home, "disabled"), fake))
    {
        Check(!(await disabled.GetStatusAsync()).Configured && fake.Probes == 0 && fake.Starts == 0, "unconfigured status does not probe or launch inference");
    }
    var slowProbe = new FakeRunner { ProbeDelay = new TaskCompletionSource<VoiceRunnerProbe>(TaskCreationOptions.RunContinuationsAsynchronously) };
    using (var slow = new RunnerReviewService(store, config with { StatusProbeTimeoutMilliseconds = 25 }, Path.Combine(home, "slow-probe"), slowProbe))
    {
        var clock = System.Diagnostics.Stopwatch.StartNew();
        var statuses = await Task.WhenAll(slow.GetStatusAsync(), slow.GetStatusAsync());
        Check(statuses.All(status => !status.Available) && clock.Elapsed < TimeSpan.FromSeconds(2), "slow version probe returns unavailable within bounded time");
        Check(slowProbe.Probes == 1 && slowProbe.Starts == 0, "concurrent status checks share one probe and never start inference");
        slowProbe.ProbeDelay.SetResult(new(true, "Finished fake probe"));
    }
    var valid = ValidJson(document);
    var validated = RunnerReviewService.ValidateOutput("Review prepared.\n```json\n" + valid + "\n```", document, "run", "codex", "model");
    Check(validated.Findings.Length == 1 && validated.Findings[0].Evidence.Contains("quote"), "preface/fence JSON validation and evidence");
    Check(validated.Findings[0].Severity == "info" && validated.Findings[0].RuleId == "semantic-review", "semantic outputs remain advisory");
    Reject(() => RunnerReviewService.ValidateOutput(valid.Replace(document.Version, "stale"), document, "r", "c", "m"), "wrong source version rejected");
    Reject(() => RunnerReviewService.ValidateOutput(valid.Replace("\"category\":\"wording\"", "\"category\":\"invented\""), document, "r", "c", "m"), "unknown category rejected");
    Reject(() => RunnerReviewService.ValidateOutput(valid.Replace("\"unitId\":\"u-0\"", "\"unitId\":\"not-present\""), document, "r", "c", "m"), "unknown unit rejected");
    Reject(() => RunnerReviewService.ValidateOutput(valid.Replace("\"quote\":\"Review.\"", "\"quote\":\"Altered\""), document, "r", "c", "m"), "inexact quote rejected");
    Reject(() => RunnerReviewService.ValidateOutput(valid.Replace("\"reviewedUnitIds\":[\"u-0\",\"u-1\"]", "\"reviewedUnitIds\":[\"u-0\"]"), document, "r", "c", "m"), "partial wholefile coverage rejected");

    fake.Factory = (request, ct) => Success(request, ct);
    using var service = new RunnerReviewService(store, config, Path.Combine(home, "runtime"), fake);
    var input = new SemanticReviewInput(document.Version, "success-request", "Keep facts unchanged");
    var started = await service.StartAsync(project.Id, documentId, input);
    var result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "completed" && result.Findings.Length == 1, "successful Runner stream produces validated findings");
    Check(fake.LastRequest!.PermissionMode == CliPermissionModes.ReadOnly && fake.LastRequest.ContextMode == CliContextModes.Clean, "explicit read-only and clean request posture");
    Check(!fake.LastRequest.WorkingDirectory.StartsWith(projectRoot, StringComparison.OrdinalIgnoreCase), "original project is never the agent working directory");
    Check(result.ActualModel == "reported-model" && result.UsageSummaries.Length == 1, "actual model and usage retained independently");
    Check(File.ReadAllText(sourcePath) == document.Source, "semantic review never writes source");
    Check(File.Exists(Path.Combine(projectRoot, ".voice-lint", "semantic-runs", result.Id, "input.json")) && File.Exists(Path.Combine(projectRoot, ".voice-lint", "semantic-runs", result.Id, "output.txt")), "durable context and output");
    Check(result.ContextFiles.Length == 1 && result.ContextFiles[0].Path == "component.ts", "explicit component context has a persisted version manifest");
    Check(service.ListRuns(project.Id, documentId).Single().Id == result.Id, "persisted history returns only this document's review");
    using (var limited = new RunnerReviewService(store, config with { MaximumContextCharacters = 1 }, Path.Combine(home, "limited"), fake))
    {
        try { await limited.StartAsync(project.Id, documentId, input with { RequestId = "too-large" }); throw new Exception("FAIL: oversized context accepted"); }
        catch (ApiError e) when (e.Status == 422) { Check(fake.Starts == 1, "oversized context is rejected before model launch"); }
    }
    var replay = await service.StartAsync(project.Id, documentId, input);
    Check(replay.Id == result.Id && fake.Starts == 1, "same request does not spend a second model run");
    try { await service.StartAsync(project.Id, documentId, input with { Instruction = "Different payload" }); throw new Exception("FAIL: duplicate payload accepted"); }
    catch (ApiError e) when (e.Status == 409) { checks++; }
    using (var restarted = new RunnerReviewService(new ProjectStore(home, false), config, Path.Combine(home, "runtime2"), new FakeRunner()))
        Check(restarted.GetRun(project.Id, documentId, result.Id).Status == "completed", "completed evidence survives service restart");

    fake.Factory = (request, ct) => Failure(request, ct);
    started = await service.StartAsync(project.Id, documentId, input with { RequestId = "failed-terminal" });
    result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "failed" && result.Findings.Length == 0, "valid JSON cannot turn a failed CLI run into completed");
    fake.Factory = (request, ct) => MissingTerminal(request, ct);
    started = await service.StartAsync(project.Id, documentId, input with { RequestId = "missing-terminal" });
    result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "failed", "missing Runner terminal is not successful");

    var contextRelease = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    fake.Factory = (request, ct) => Delayed(request, contextRelease.Task, ct);
    started = await service.StartAsync(project.Id, documentId, input with { RequestId = "stale-context" });
    await fake.StreamEntered.WaitAsync(TimeSpan.FromSeconds(20));
    File.WriteAllText(contextPath, "export const role = 'revised product role';");
    contextRelease.SetResult();
    result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "stale" && result.Findings.Length == 0, "component-only context drift prevents accepting findings");
    var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    fake.Factory = (request, ct) => Delayed(request, release.Task, ct);
    started = await service.StartAsync(project.Id, documentId, input with { RequestId = "stale-source" });
    await fake.StreamEntered.WaitAsync(TimeSpan.FromSeconds(20));
    File.AppendAllText(sourcePath, "Externally changed.\n");
    release.SetResult();
    result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "stale" && result.Findings.Length == 0, "source change prevents accepting completed model findings");
    document = store.GetDocument(project.Id, documentId);
    fake.Factory = (request, ct) => Delayed(request, Task.Delay(Timeout.Infinite, ct), ct);
    started = await service.StartAsync(project.Id, documentId, new(document.Version, "cancel-request"));
    service.Cancel(project.Id, documentId, started.Id);
    result = await Finished(service, project.Id, documentId, started.Id);
    Check(result.Status == "cancelled" && fake.Stops > 0, "explicit cancellation stops the Runner and persists cancellation");
    var history = service.ListRuns(project.Id, documentId);
    Check(history.Length == 6 && history[0].Id == result.Id && history.Zip(history.Skip(1)).All(pair => string.CompareOrdinal(pair.First.CreatedAt, pair.Second.CreatedAt) >= 0), "history retains every terminal run newest first");
    Check(history.Single(run => run.Id == replay.Id).Status == "stale", "old completed evidence is revalidated when history is loaded");
    Reject(() => service.GetRun(project.Id, documentId, "../outside"), "run paths reject traversal");
    Console.WriteLine($"Runner semantic review: {checks} checks passed; fake streams only, zero model calls.");
}
finally
{
    var resolved = Path.GetFullPath(home);
    if (!resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(resolved).StartsWith("voice-runner-tests-")) throw new Exception("Unexpected test cleanup path");
    if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
}

static string ValidJson(DocumentDetail document) => JsonSerializer.Serialize(new
{
    schemaVersion = 1, documentVersion = document.Version, reviewedUnitIds = document.Units.Select(unit => unit.Id),
    findings = new[] { new { unitId = document.Units[0].Id, start = 0, end = document.Units[0].Text.Length, quote = document.Units[0].Text, category = "wording", message = "Clarify", explanation = "A specific observation", evidence = "The supplied quote supports this question {without inventing facts}.", suggestion = (string?)null } },
    notes = new[] { "Human review remains necessary." }
});
static DocumentDetail ContextDocument(CliRunRequest request)
{
    using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(request.WorkingDirectory, "review-context.json")));
    var data = json.RootElement;
    var source = data.GetProperty("source").GetString()!;
    var units = JsonSerializer.Deserialize<TextUnit[]>(data.GetProperty("units"), ProjectStore.Json)!;
    return new("doc", "guide.md", "Review", "markdown", "de", data.GetProperty("documentVersion").GetString()!, 0, 0, 0, source, "", units, [], [], 0, new(units.Length, units.Length, 0, []));
}
static async IAsyncEnumerable<CliRunEvent> Success(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
{
    await Task.Yield(); ct.ThrowIfCancellationRequested();
    yield return new CliRunEvent.SessionStarted("native-session") { Model = "reported-model" };
    yield return new CliRunEvent.OutputDelta("```json\n" + ValidJson(ContextDocument(request)) + "\n```");
    yield return new CliRunEvent.TurnCompleted("input: 120, output: 35");
    yield return new CliRunEvent.RunEnded(RunOutcome.Completed, null, 0, 1);
}
static async IAsyncEnumerable<CliRunEvent> Failure(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
{
    await Task.Yield(); ct.ThrowIfCancellationRequested();
    yield return new CliRunEvent.OutputDelta(ValidJson(ContextDocument(request)));
    yield return new CliRunEvent.RunEnded(RunOutcome.Failed, "fixture failure", 1, 1);
}
static async IAsyncEnumerable<CliRunEvent> MissingTerminal(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
{
    await Task.Yield(); ct.ThrowIfCancellationRequested();
    yield return new CliRunEvent.OutputDelta(ValidJson(ContextDocument(request)));
}
static async IAsyncEnumerable<CliRunEvent> Delayed(CliRunRequest request, Task release, [EnumeratorCancellation] CancellationToken ct)
{
    await release.WaitAsync(ct);
    await foreach (var item in Success(request, ct)) yield return item;
}
static async Task<SemanticReviewRun> Finished(RunnerReviewService service, string project, string document, string id)
{
    for (var i = 0; i < 1000; i++)
    {
        var run = service.GetRun(project, document, id);
        if (run.Status is not ("running" or "cancelling")) return run;
        await Task.Delay(20);
    }
    throw new Exception("Fake review did not finish");
}
sealed class FakeRunner : IVoiceReviewRunner
{
    public int Probes; public int Starts; public int Stops;
    public TaskCompletionSource<VoiceRunnerProbe>? ProbeDelay;
    public CliRunRequest? LastRequest;
    private TaskCompletionSource entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task StreamEntered => entered.Task;
    private Func<CliRunRequest, CancellationToken, IAsyncEnumerable<CliRunEvent>> factory = (_, _) => throw new Exception("No fake stream configured");
    public Func<CliRunRequest, CancellationToken, IAsyncEnumerable<CliRunEvent>> Factory { set { factory = value; entered = new(TaskCreationOptions.RunContinuationsAsynchronously); } }
    public Task<VoiceRunnerProbe> ProbeAsync(CancellationToken ct) { Interlocked.Increment(ref Probes); return ProbeDelay?.Task ?? Task.FromResult(new VoiceRunnerProbe(true, "Fake capability probe; no model.")); }
    public IAsyncEnumerable<CliRunEvent> StreamAsync(CliRunRequest request, CancellationToken ct) { Starts++; LastRequest = request; entered.TrySetResult(); return factory(request, ct); }
    public void Stop(string id) => Stops++;
    public void Forget(string id) { }
}
