using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using CodingAgentRunner.Events;
using CodingAgentRunner.Execution;
using CodingAgentRunner.Model;
using VoiceStudio;

var checks = 0;
void Check(bool result, string message) { if (!result) throw new Exception("FAIL: " + message); checks++; }
void Reject(Action action, string message)
{
    try { action(); }
    catch (ApiError) { checks++; return; }
    throw new Exception("FAIL: " + message);
}
async Task RejectAsync(Func<Task> action, string message)
{
    try { await action(); }
    catch (ApiError) { checks++; return; }
    throw new Exception("FAIL: " + message);
}
var home = Path.Combine(Path.GetTempPath(), "voice-selection-tests-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(home);
try
{
    var root = Path.Combine(home, "source"); Directory.CreateDirectory(root);
    var file = Path.Combine(root, "guide.md");
    File.WriteAllText(file, "# Guide\nOur innovative solution helps teams work.\nA😀B\n");
    var store = new ProjectStore(home, false);
    var project = store.Register(new(root, "Selection fixture"));
    var documentId = store.ListDocuments(project.Id).Single().Id;
    var document = store.GetDocument(project.Id, documentId);
    var unit = document.Units.First(unit => unit.Text.Contains("innovative"));
    var selection = new ReviewSelection(unit.Id, 0, unit.Text.Length, unit.Text);
    var input = new SelectionDecisionInput(selection.UnitId, selection.Start, selection.End, selection.Quote,
        document.Version, document.ReviewRevision, "keep-once");
    var kept = store.KeepSelection(project.Id, documentId, input);
    Check(kept.Decision.Kind == "keep" && kept.Decision.Status == "current", "keep creates a current local decision");
    Check(kept.Decision.Note is null && kept.Document.ReviewRevision == document.ReviewRevision + 1, "keep needs no note and advances review revision");
    Check(File.ReadAllText(file) == document.Source && kept.Document.Findings.Length == document.Findings.Length,
        "keep changes neither source nor deterministic findings");
    var replay = store.KeepSelection(project.Id, documentId, input);
    Check(replay.Decision.Id == kept.Decision.Id && replay.Document.ReviewRevision == kept.Document.ReviewRevision && replay.Document.Decisions?.Length == 1,
        "keep request replay is idempotent after its own revision change");
    Reject(() => store.KeepSelection(project.Id, documentId, input with { Note = "Different request" }), "reused request ID with changed payload rejected");
    Reject(() => store.KeepSelection(project.Id, documentId, input with { RequestId = "stale-review" }), "stale review revision rejected");
    Reject(() => store.KeepSelection(project.Id, documentId, input with { RequestId = "wrong-quote", ExpectedReviewRevision = kept.Document.ReviewRevision, Quote = "wrong" }), "inexact keep quote rejected");
    Reject(() => store.KeepSelection(project.Id, documentId, input with { RequestId = "wrong-version", ExpectedReviewRevision = kept.Document.ReviewRevision, ExpectedVersion = "old" }), "stale source version rejected");
    var unicode = document.Units.First(unit => unit.Text.Contains("😀"));
    var emoji = unicode.Text.IndexOf("😀", StringComparison.Ordinal);
    Reject(() => ProjectStore.ValidateSelection(document, new(unicode.Id, emoji + 1, emoji + 2, unicode.Text[(emoji + 1)..(emoji + 2)])), "UTF-16 surrogate splits rejected");
    var restartedStore = new ProjectStore(home, false);
    Check(restartedStore.ListDecisions(project.Id, documentId).Single().Id == kept.Decision.Id, "keep decisions survive reopening the store");
    File.AppendAllText(file, "Source changed.\n");
    document = store.GetDocument(project.Id, documentId);
    Check(document.Decisions?.Single().Status == "stale", "source changes invalidate saved keep decisions");
    Check(store.KeepSelection(project.Id, documentId, input).Decision.Status == "stale", "idempotent old decision replay remains historical");

    unit = document.Units.First(unit => unit.Text.Contains("innovative"));
    selection = new(unit.Id, 0, unit.Text.Length, unit.Text);
    string Output(params string[] replacements) => JsonSerializer.Serialize(new
    {
        schemaVersion = 1, documentVersion = document.Version, selection,
        alternatives = replacements.Select(text => new { replacement = text, reason = "Keeps the existing facts and clarifies the wording." })
    }, ProjectStore.Json);
    var valid = Output("Our product helps teams work.", "Teams use our product to work.", "");
    var validated = RunnerReviewService.ValidateSuggestionsOutput(valid, document, selection, "run");
    Check(validated.Length == 3 && validated[2].Replacement == "", "one to three choices can include an explicit removal");
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(Output(), document, selection, "run"), "empty alternatives rejected");
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(Output("a", "b", "c", "d"), document, selection, "run"), "more than three alternatives rejected");
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(Output("same", " same "), document, selection, "run"), "cosmetic duplicate alternatives rejected");
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(Output(selection.Quote), document, selection, "run"), "unchanged wording is not an alternative");
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(valid.Replace(document.Version, "wrong-version"), document, selection, "run"), "wrong output version rejected");
    var malformed = JsonNode.Parse(valid)!;
    malformed["selection"]!["quote"] = "altered quote";
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(malformed.ToJsonString(), document, selection, "run"), "wrong output quote rejected");
    malformed = JsonNode.Parse(valid)!; malformed["alternatives"]![0]!["replacement"] = null;
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(malformed.ToJsonString(), document, selection, "run"), "null replacement rejected");
    malformed = JsonNode.Parse(valid)!; malformed["alternatives"]![0]!["reason"] = "";
    Reject(() => RunnerReviewService.ValidateSuggestionsOutput(malformed.ToJsonString(), document, selection, "run"), "missing reason rejected");

    var fake = new FakeSelectionRunner();
    var options = new RunnerReviewOptions { Cli = "codex", Model = "fixture-model", ThinkingLevel = "medium" };
    var request = new SelectionSuggestionInput(selection.UnitId, selection.Start, selection.End, selection.Quote,
        document.Version, document.ReviewRevision, "alternatives-once", "Keep meaning");
    using (var unavailable = new RunnerReviewService(store, new(), Path.Combine(home, "unconfigured"), fake))
    {
        await RejectAsync(async () => await unavailable.StartSuggestionsAsync(project.Id, documentId, request), "unconfigured route fails truthfully");
        Check(fake.Starts == 0, "unconfigured alternatives never call a model");
    }
    using var service = new RunnerReviewService(store, options, Path.Combine(home, "runner"), fake);
    fake.Factory = Success;
    var started = await service.StartSuggestionsAsync(project.Id, documentId, request);
    var completed = await Finished(service, project.Id, documentId, started.Id);
    Check(completed.Status == "completed" && completed.Alternatives.Length == 2 && completed.Selection == selection,
        "runner alternatives retain the exact selection and validated choices");
    Check(completed.Findings.Length == 0 && completed.ReviewedUnitIds.Length == 0 && completed.SuppliedUnits == 1,
        "selection alternatives never claim whole-document semantic coverage");
    Check(fake.LastRequest!.PermissionMode == CliPermissionModes.ReadOnly && fake.LastRequest.ContextMode == CliContextModes.Clean,
        "alternatives reuse the read-only clean runner route");
    Check(fake.LastRequest.Prompt.Contains("one to three distinct") && !fake.LastRequest.WorkingDirectory.StartsWith(root),
        "runner gets a selection-specific prompt in an isolated workspace");
    Check(File.ReadAllText(file) == document.Source && store.ListProposals(project.Id, documentId).Length == 0,
        "alternatives neither edit source nor create or apply a proposal");
    var repeated = await service.StartSuggestionsAsync(project.Id, documentId, request);
    Check(repeated.Id == completed.Id && fake.Starts == 1, "suggestion retry does not start another model");
    Check(service.ListRuns(project.Id, documentId).Length == 0 && service.ListRuns(project.Id, documentId, true).Length == 1,
        "selection suggestion history is separate from semantic review history");
    await RejectAsync(async () => await service.StartSuggestionsAsync(project.Id, documentId, request with { Instruction = "different" }), "suggestion request ID payload conflict rejected");
    await RejectAsync(async () => await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "bad-selection", Quote = "bad" }), "invalid selection rejected before model launch");
    Check(fake.Starts == 1, "invalid retries and selections spend no model calls");
    using (var reopened = new RunnerReviewService(new ProjectStore(home, false), options, Path.Combine(home, "reopened"), new FakeSelectionRunner()))
        Check(reopened.GetSuggestionRun(project.Id, documentId, completed.Id).Alternatives.Length == 2, "alternatives survive service restart");

    var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    fake.Factory = (req, ct) => Delayed(req, release.Task, ct);
    started = await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "stale-after-start" });
    await fake.Entered.WaitAsync(TimeSpan.FromSeconds(20));
    File.AppendAllText(file, "Another source change.\n");
    release.SetResult();
    var stale = await Finished(service, project.Id, documentId, started.Id);
    Check(stale.Status == "stale" && stale.Alternatives.Length == 0, "source drift while running discards alternatives");
    Check(service.GetSuggestionRun(project.Id, documentId, completed.Id).Status == "stale", "stored alternatives revalidate current source on read");
    var startsBeforeRetry = fake.Starts;
    var reconciled = await service.StartSuggestionsAsync(project.Id, documentId, request);
    Check(reconciled.Id == completed.Id && reconciled.Status == "stale" && reconciled.Alternatives.Length == 0 && fake.Starts == startsBeforeRetry,
        "lost POST response reconciles the original durable request after source drift without another model start");
    await RejectAsync(async () => await service.StartSuggestionsAsync(project.Id, documentId, request with { Instruction = "changed after source drift" }),
        "reconciliation still rejects a request ID replay with changed original input");
    await RejectAsync(async () => await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "new-request-stale-source" }),
        "a fresh request cannot bypass stale-source checks through reconciliation");
    Check(fake.Starts == startsBeforeRetry, "failed stale or changed replays never start another model");
    try
    {
        await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "typed-stale-source" });
        throw new Exception("FAIL: stale initial request accepted");
    }
    catch (SuggestionRequestError rejected)
    {
        Check(rejected.SuggestionRequestId == "typed-stale-source" && !rejected.SuggestionRequestAccepted,
            "pre-claim source rejection proves the exact request was not accepted");
    }
    var currentReview = store.GetDocument(project.Id, documentId);
    try
    {
        await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "typed-stale-review", ExpectedVersion = currentReview.Version, ExpectedReviewRevision = -1 });
        throw new Exception("FAIL: stale initial review revision accepted");
    }
    catch (SuggestionRequestError rejected)
    {
        Check(rejected.SuggestionRequestId == "typed-stale-review" && !rejected.SuggestionRequestAccepted,
            "pre-claim review rejection is distinguishable from an unknown POST outcome");
    }
    var lockRequest = request with { RequestId = "locked-preflight", ExpectedVersion = currentReview.Version, ExpectedReviewRevision = currentReview.ReviewRevision };
    var lockId = ProjectStore.Hash(project.Id + "\n" + documentId + "\nselection:" + lockRequest.RequestId)[..32];
    var lockPath = Path.Combine(root, ".voice-lint", "suggestion-locks", lockId + ".lock");
    using (var held = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
    {
        try { await service.StartSuggestionsAsync(project.Id, documentId, lockRequest); throw new Exception("FAIL: concurrent request lock bypassed"); }
        catch (ApiError error)
        {
            Check(error is not SuggestionRequestError, "a concurrent preflight never falsely reports requestAccepted=false");
        }
    }
    var claimedRequest = request with { RequestId = "claimed-but-unresolved", ExpectedVersion = currentReview.Version, ExpectedReviewRevision = -1 };
    var claimedId = ProjectStore.Hash(project.Id + "\n" + documentId + "\nselection:" + claimedRequest.RequestId)[..32];
    var claimFolder = Path.Combine(root, ".voice-lint", "semantic-runs", claimedId); Directory.CreateDirectory(claimFolder);
    File.WriteAllText(Path.Combine(claimFolder, "request.claim"), "");
    try { await service.StartSuggestionsAsync(project.Id, documentId, claimedRequest); throw new Exception("FAIL: unresolved durable claim accepted"); }
    catch (ApiError error) { Check(error is not SuggestionRequestError, "an existing unresolved claim never reports requestAccepted=false"); }

    document = store.GetDocument(project.Id, documentId);
    fake.Factory = (req, ct) => Delayed(req, Task.Delay(Timeout.Infinite, ct), ct);
    started = await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "cancel", ExpectedVersion = document.Version, ExpectedReviewRevision = document.ReviewRevision });
    service.Cancel(project.Id, documentId, started.Id);
    var cancelled = await Finished(service, project.Id, documentId, started.Id);
    Check(cancelled.Status == "cancelled" && cancelled.Alternatives.Length == 0 && fake.Stops > 0, "cancellation persists and keeps choices empty");

    fake.Factory = Malformed;
    started = await service.StartSuggestionsAsync(project.Id, documentId, request with { RequestId = "malformed-result", ExpectedVersion = document.Version, ExpectedReviewRevision = document.ReviewRevision });
    var failed = await Finished(service, project.Id, documentId, started.Id);
    Check(failed.Status == "failed" && failed.Alternatives.Length == 0, "malformed runner output persists failed without usable alternatives");
    Console.WriteLine($"Selection review: {checks} checks passed; fake runner streams only, zero model calls.");
}
finally
{
    var resolved = Path.GetFullPath(home);
    if (!resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) ||
        !Path.GetFileName(resolved).StartsWith("voice-selection-tests-", StringComparison.Ordinal)) throw new Exception("Unexpected fixture cleanup path");
    if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
}

static async IAsyncEnumerable<CliRunEvent> Success(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
{
    await Task.Yield(); ct.ThrowIfCancellationRequested();
    using var context = JsonDocument.Parse(File.ReadAllText(Path.Combine(request.WorkingDirectory, "review-context.json")));
    yield return new CliRunEvent.OutputDelta(JsonSerializer.Serialize(new
    {
        schemaVersion = 1, documentVersion = context.RootElement.GetProperty("documentVersion").GetString(),
        selection = context.RootElement.GetProperty("selection"),
        alternatives = new[] { new { replacement = "Our product helps teams work.", reason = "Uses a concrete subject." }, new { replacement = "Teams use our product to work.", reason = "Starts with the reader." } }
    }));
    yield return new CliRunEvent.RunEnded(RunOutcome.Completed, null, 0, 1);
}
static async IAsyncEnumerable<CliRunEvent> Malformed(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
{
    await Task.Yield(); ct.ThrowIfCancellationRequested();
    yield return new CliRunEvent.OutputDelta("{\"schemaVersion\":1}");
    yield return new CliRunEvent.RunEnded(RunOutcome.Completed, null, 0, 1);
}
static async IAsyncEnumerable<CliRunEvent> Delayed(CliRunRequest request, Task release, [EnumeratorCancellation] CancellationToken ct)
{
    await release.WaitAsync(ct);
    await foreach (var item in Success(request, ct)) yield return item;
}
static async Task<SemanticReviewRun> Finished(RunnerReviewService service, string project, string document, string id)
{
    for (var i = 0; i < 2000; i++)
    {
        var run = service.GetSuggestionRun(project, document, id);
        if (run.Status is not ("running" or "cancelling")) return run;
        await Task.Delay(10);
    }
    throw new Exception("Fake alternatives did not finish");
}
sealed class FakeSelectionRunner : IVoiceReviewRunner
{
    public int Starts; public int Stops;
    public CliRunRequest? LastRequest;
    private TaskCompletionSource entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task Entered => entered.Task;
    private Func<CliRunRequest, CancellationToken, IAsyncEnumerable<CliRunEvent>> factory = (_, _) => throw new Exception("No fake stream configured");
    public Func<CliRunRequest, CancellationToken, IAsyncEnumerable<CliRunEvent>> Factory { set { factory = value; entered = new(TaskCreationOptions.RunContinuationsAsynchronously); } }
    public Task<VoiceRunnerProbe> ProbeAsync(CancellationToken ct) => Task.FromResult(new VoiceRunnerProbe(true, "Fake capability probe; no model."));
    public IAsyncEnumerable<CliRunEvent> StreamAsync(CliRunRequest request, CancellationToken ct) { Starts++; LastRequest = request; entered.TrySetResult(); return factory(request, ct); }
    public void Stop(string id) => Stops++;
    public void Forget(string id) { }
}
