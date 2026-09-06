using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using CodingAgentRunner.Events;
using CodingAgentRunner.Execution;
using CodingAgentRunner.Model;
using VoiceStudio;

var checks = 0;
void Check(bool value, string name) { checks++; if (!value) throw new Exception("FAIL: " + name); }
async Task Reject(Func<Task> action, string name, int status = 409)
{
    checks++;
    try { await action(); } catch (ApiError error) when (error.Status == status) { return; }
    throw new Exception("FAIL: " + name);
}
using (var f = new Fixture())
{
    var d = f.Document();
    d = f.Store.SaveFeedback(f.Project, f.DocId, new(d.Units[0].Id, "Loud", 0, 4, "selected-feedback-message", "wording", d.Version, d.ReviewRevision, "feedback-selected"));
    d = f.Store.SaveFeedback(f.Project, f.DocId, new(d.Units[0].Id, "heading", 5, 12, "unrelated-feedback-message", "wording", d.Version, d.ReviewRevision, "feedback-other"));
    var input = new ImprovementTaskInput("Make the wording concrete.", [d.Feedback[0].Id], d.Version, d.ReviewRevision, "first-task");
    var task = await f.Tasks.CreateAsync(f.Project, f.DocId, input);
    Check(task.Status == "queued" && f.Fake.Starts == 0, "saving a task never starts a model");
    Check((await f.Tasks.CreateAsync(f.Project, f.DocId, input)).Id == task.Id, "task creation is idempotent");
    await Reject(() => f.Tasks.CreateAsync(f.Project, f.DocId, input with { Instruction = "changed" }), "request collision rejects different instruction");
    var prompt = await f.Tasks.GetPromptAsync(f.Project, f.DocId, task.Id);
    Check(prompt.Prompt.Contains("selected-feedback-message") && !prompt.Prompt.Contains("unrelated-feedback-message") && prompt.Prompt.Contains("component context"), "prompt contains source, selected feedback and bounded component context");
    Check(prompt.SourceVersion == d.Version && prompt.ReviewRevision == d.ReviewRevision && prompt.Prompt.Contains("TASK MODE"), "Plan B prompt is version bound and task specific");
    var start = new TaskStartInput(task.Revision, d.Version, d.ReviewRevision, "explicit-start");
    await f.Tasks.StartAsync(f.Project, f.DocId, task.Id, start);
    await f.Tasks.StartAsync(f.Project, f.DocId, task.Id, start);
    task = await f.Finish(task.Id);
    Check(task.Status == "ready" && task.Proposal?.Edits?.Length == 2 && f.Fake.Starts == 1, "one explicit idempotent run produces composite proposal");
    Check(File.ReadAllText(f.SourcePath) == Fixture.Source, "runner result never changes original source");
    Check(f.Fake.LastRequest!.PermissionMode == CliPermissionModes.ReadOnly && f.Fake.LastRequest.ContextMode == CliContextModes.Clean && !f.Fake.LastRequest.WorkingDirectory.StartsWith(f.ProjectRoot), "task uses isolated clean read-only runner");
    Check(task.Proposal!.TaskId == task.Id && task.Proposal.RunId == task.RunId && f.Reviews.GetRun(f.Project, f.DocId, task.RunId!).TaskId == task.Id, "durable task-run-proposal linkage");
    await Reject(() => Task.FromResult(f.Store.ApplyProposal(f.Project, f.DocId, task.ProposalId!, new(d.Version))), "generic proposal API cannot bypass task guards");
    await Reject(() => f.Tasks.ApplyAsync(f.Project, f.DocId, task.Id, new(1, d.Version, d.ReviewRevision)), "stale task revision rejects apply");
    var result = await f.Tasks.ApplyAsync(f.Project, f.DocId, task.Id, new(task.Revision, d.Version, d.ReviewRevision));
    Check(result.Task.Status == "applied" && result.Document.Source.Contains("# Clear heading.") && result.Document.Source.Contains("[specific tools](guide.md)"), "composite apply preserves Markdown structure and link target");
    Check(result.Document.Feedback.All(note => note.Status != "resolved"), "applying task does not silently resolve human feedback");
    Check((await f.Tasks.ApplyAsync(f.Project, f.DocId, task.Id, new(task.Revision, d.Version, d.ReviewRevision))).Task.Status == "applied", "apply retry is idempotent");
    using var restartedReviews = new RunnerReviewService(new ProjectStore(f.Home, false), Fixture.Options, Path.Combine(f.Home, "restart-runtime"), new TaskFake());
    using var restarted = new ImprovementTaskService(new ProjectStore(f.Home, false), restartedReviews);
    var restored = await restarted.GetAsync(f.Project, f.DocId, task.Id);
    Check(restored.Status == "applied" && restored.Proposal?.SourceAfter == result.Document.Source, "task and complete diff survive service restart");
}
using (var f = new Fixture())
{
    f.Fake.Mode = "none";
    var task = await f.Start();
    task = await f.Finish(task.Id);
    Check(task.Status == "completed" && task.Resolution == "agent_no_changes" && task.Proposal is null && task.Notes!.Any(note => note.Contains("already specific")), "successful no-change task is completed with reason");
    Check(File.ReadAllText(f.SourcePath) == Fixture.Source, "no-change completion retains source");
    var manual = await f.Create("manual");
    var d = f.Document();
    await Reject(() => f.Tasks.ResolveAsync(f.Project, f.DocId, manual.Id, new(manual.Revision, d.Version, d.ReviewRevision, "")), "manual completion requires reason", 400);
    manual = await f.Tasks.ResolveAsync(f.Project, f.DocId, manual.Id, new(manual.Revision, d.Version, d.ReviewRevision, "Reviewed and deliberately retained."));
    Check(manual.Status == "completed" && manual.Resolution == "manual" && manual.Notes!.Single().Contains("deliberately"), "manual completion retains explicit rationale");
    Check(f.Fake.Starts == 1, "manual resolution starts no runner");
}
using (var f = new Fixture())
{
    f.Fake.Mode = "failure";
    var task = await f.Start(); task = await f.Finish(task.Id);
    Check(task.Status == "failed" && task.Proposal is null, "failed runner never creates a proposal");
    f.Fake.Mode = "overlap";
    task = await f.Start("overlap"); task = await f.Finish(task.Id);
    Check(task.Status == "failed" && f.Store.ListProposals(f.Project, f.DocId).Length == 0, "overlapping model edits fail atomically");
    Check(File.ReadAllText(f.SourcePath) == Fixture.Source, "invalid model edits leave source untouched");
}
using (var f = new Fixture())
{
    var release = f.Fake.Pause();
    var task = await f.Start(); await f.Fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(20));
    task = await f.Tasks.CancelAsync(f.Project, f.DocId, task.Id, new(task.Revision));
    Check(task.Status == "cancelling", "explicit cancellation has visible in-flight state");
    task = await f.Finish(task.Id);
    Check(task.Status == "cancelled" && f.Fake.Stops > 0 && task.Proposal is null, "cancelled runner creates no proposal");
}
using (var f = new Fixture())
{
    var release = f.Fake.Pause();
    var task = await f.Start(); await f.Fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(20));
    File.AppendAllText(f.SourcePath, "\nExternal source edit.\n"); release.SetResult();
    task = await f.Finish(task.Id);
    Check(task.Status == "stale" && task.Proposal is null, "source drift while running invalidates task result");
}
using (var f = new Fixture())
{
    var release = f.Fake.Pause();
    var task = await f.Start(); await f.Fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(20));
    var d = f.Document();
    f.Store.SaveFeedback(f.Project, f.DocId, new(d.Units[0].Id, "Loud", 0, 4, "New feedback during run", "wording", d.Version, d.ReviewRevision, "concurrent-note"));
    release.SetResult(); task = await f.Finish(task.Id);
    Check(task.Status == "stale" && task.Proposal is null, "feedback revision drift invalidates result even when source is unchanged");
}
using (var f = new Fixture())
{
    File.WriteAllText(f.ContextPath, new string('x', 33000) + "original context tail");
    var task = await f.Start(); task = await f.Finish(task.Id);
    File.AppendAllText(f.ContextPath, "changed context beyond the supplied truncated prefix");
    var d = f.Document();
    await Reject(() => f.Tasks.ApplyAsync(f.Project, f.DocId, task.Id, new(task.Revision, d.Version, d.ReviewRevision)), "component context drift prevents apply");
    task = await f.Tasks.GetAsync(f.Project, f.DocId, task.Id);
    Check(task.Status == "stale" && File.ReadAllText(f.SourcePath) == Fixture.Source, "truncated context tail drift is persisted without source write");
}
using (var f = new Fixture())
{
    var task = await f.Create();
    File.AppendAllText(f.SourcePath, "\nA changed source.\n");
    await Reject(() => f.Tasks.StartAsync(f.Project, f.DocId, task.Id, new(task.Revision, task.SourceVersion, task.ReviewRevision, "stale-start")), "queued stale source cannot launch a runner");
    Check(f.Fake.Starts == 0, "stale preflight has zero model calls");
    task = await f.Tasks.GetAsync(f.Project, f.DocId, task.Id);
    var d = f.Document();
    task = await f.Tasks.ResolveAsync(f.Project, f.DocId, task.Id, new(task.Revision, d.Version, d.ReviewRevision, "Superseded by the source edit."));
    Check(task.Status == "completed" && task.SourceVersion != d.Version, "manual completion can account for superseded task while retaining original source binding");
}
using (var f = new Fixture())
{
    f.Fake.Mode = "none";
    var task = await f.Start(); task = await f.Finish(task.Id);
    var taskPath = Path.Combine(f.ProjectRoot, ".voice-lint", "tasks", f.DocId, task.Id + ".json");
    var record = JsonNode.Parse(File.ReadAllText(taskPath))!;
    record["task"]!["status"] = "running"; record["task"]!["resolution"] = null;
    File.WriteAllText(taskPath, record.ToJsonString());
    var runPath = Path.Combine(f.ProjectRoot, ".voice-lint", "semantic-runs", task.RunId!, "run.json");
    var run = JsonNode.Parse(File.ReadAllText(runPath))!; run["status"] = "running";
    File.WriteAllText(runPath, run.ToJsonString());
    using var restartedReviews = new RunnerReviewService(f.Store, Fixture.Options, Path.Combine(f.Home, "restart"), new TaskFake());
    using var restarted = new ImprovementTaskService(f.Store, restartedReviews);
    task = await restarted.GetAsync(f.Project, f.DocId, task.Id);
    Check(task.Status == "interrupted" && f.Fake.Starts == 1, "restart recovers orphaned run honestly without automatic model restart");
}
using (var f = new Fixture())
{
    f.Fake.Mode = "information";
    var task = await f.Start(); task = await f.Finish(task.Id);
    Check(task.Status == "needs_review" && task.Resolution is null && task.Notes!.Any(note => note.Contains("fact is missing")), "missing evidence never falsely completes a task");
    f.Fake.Mode = "unsupported";
    task = await f.Start("unsupported"); task = await f.Finish(task.Id);
    Check(task.Status == "needs_review" && task.Proposal is null, "multi-file or structural work requires further review");
    f.Fake.Mode = "missing-disposition";
    task = await f.Start("missing-disposition"); task = await f.Finish(task.Id);
    Check(task.Status == "failed" && task.Proposal is null, "task model output needs an explicit valid disposition");
}
foreach (var drift in new[] { "source", "feedback", "context" })
{
    using var f = new Fixture();
    f.Fake.ProbeRelease = new(TaskCreationOptions.RunContinuationsAsynchronously);
    var pending = f.Start();
    await f.Fake.ProbeEntered.Task.WaitAsync(TimeSpan.FromSeconds(20));
    if (drift == "source") File.AppendAllText(f.SourcePath, "\nChanged during availability probe.\n");
    else if (drift == "context") File.AppendAllText(f.ContextPath, "// changed during probe");
    else
    {
        var d = f.Document();
        f.Store.SaveFeedback(f.Project, f.DocId, new(d.Units[0].Id, "Loud", 0, 4, "Changed during probe", "wording", d.Version, d.ReviewRevision, "probe-feedback"));
    }
    f.Fake.ProbeRelease.SetResult(new(true, "Fake available"));
    var task = await pending;
    Check(task.Status == "stale" && f.Fake.Starts == 0, drift + " drift during availability probe prevents model launch");
}
using (var f = new Fixture())
{
    var task = await f.Create();
    var context = f.Store.GetReviewRunContext(f.Project, f.DocId, task.SourceVersion);
    var oldUnits = context.Document.Units.Select((unit, i) => unit with { Id = "old-unit-" + i }).ToArray();
    var oldContext = context with { Document = context.Document with { Units = oldUnits } };
    var recordPath = Path.Combine(f.ProjectRoot, ".voice-lint", "tasks", f.DocId, task.Id + ".json");
    var record = JsonNode.Parse(File.ReadAllText(recordPath))!;
    record["contextFingerprint"] = ProjectStore.TaskContextFingerprint(oldContext);
    File.WriteAllText(recordPath, record.ToJsonString());
    task = await f.Tasks.GetAsync(f.Project, f.DocId, task.Id);
    Check(task.Status == "stale" && task.SourceVersion == f.Document().Version && task.ReviewRevision == 0 && f.Fake.Starts == 0, "task without feedback rejects stale parser mapping at identical source hash");
}
Console.WriteLine($"Task workflow: {checks} checks passed; FakeRunner only, zero model calls.");

sealed class Fixture : IDisposable
{
    public const string Source = "# Loud heading.\n\nUse [seamless tools](guide.md).\n";
    public static readonly RunnerReviewOptions Options = new() { Cli = "codex", Model = "fake-model", ThinkingLevel = "high", TimeoutSeconds = 30 };
    public string Home { get; } = Path.Combine(Path.GetTempPath(), "voice-task-tests-" + Guid.NewGuid().ToString("N"));
    public string ProjectRoot { get; }
    public string SourcePath { get; }
    public string ContextPath { get; }
    public string Project { get; }
    public string DocId { get; }
    public ProjectStore Store { get; }
    public TaskFake Fake { get; } = new();
    public RunnerReviewService Reviews { get; }
    public ImprovementTaskService Tasks { get; }
    public Fixture()
    {
        ProjectRoot = Path.Combine(Home, "project"); Directory.CreateDirectory(ProjectRoot);
        SourcePath = Path.Combine(ProjectRoot, "guide.md"); File.WriteAllText(SourcePath, Source);
        ContextPath = Path.Combine(ProjectRoot, "component.ts"); File.WriteAllText(ContextPath, "export const role = 'component context';");
        File.WriteAllText(Path.Combine(ProjectRoot, "voice.config.json"), JsonSerializer.Serialize(new { version = 1, sourceFiles = new[] { "guide.md" }, sourceContexts = new Dictionary<string, string[]> { ["guide.md"] = ["component.ts"] } }));
        Store = new ProjectStore(Home, false); Project = Store.Register(new(ProjectRoot, "Task fixture")).Id; DocId = Store.ListDocuments(Project).Single().Id;
        Reviews = new(Store, Options, Path.Combine(Home, "runtime"), Fake);
        Tasks = new(Store, Reviews);
    }
    public DocumentDetail Document() => Store.GetDocument(Project, DocId);
    public Task<ImprovementTask> Create(string request = "task")
    {
        var d = Document(); return Tasks.CreateAsync(Project, DocId, new("Improve the two imprecise phrases.", [], d.Version, d.ReviewRevision, request));
    }
    public async Task<ImprovementTask> Start(string request = "task")
    {
        var task = await Create(request);
        return await Tasks.StartAsync(Project, DocId, task.Id, new(task.Revision, task.SourceVersion, task.ReviewRevision, request + "-start"));
    }
    public async Task<ImprovementTask> Finish(string id)
    {
        for (var i = 0; i < 1500; i++)
        {
            var task = await Tasks.GetAsync(Project, DocId, id);
            if (task.Status is not ("running" or "cancelling")) return task;
            await Task.Delay(20);
        }
        throw new Exception("Fake task did not finish");
    }
    public void Dispose()
    {
        Tasks.Dispose(); Reviews.Dispose();
        var resolved = Path.GetFullPath(Home);
        if (!resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(resolved).StartsWith("voice-task-tests-")) throw new Exception("Unsafe test cleanup path");
        for (var attempt = 0; Directory.Exists(resolved); attempt++)
        {
            try { Directory.Delete(resolved, true); }
            catch (IOException) when (attempt < 20) { Thread.Sleep(50); }
        }
    }
}
sealed class TaskFake : IVoiceReviewRunner
{
    public int Starts, Stops;
    public string Mode = "edits";
    public TaskCompletionSource<VoiceRunnerProbe>? ProbeRelease;
    public TaskCompletionSource ProbeEntered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public CliRunRequest? LastRequest;
    public TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private TaskCompletionSource? pause;
    public TaskCompletionSource Pause() => pause = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task<VoiceRunnerProbe> ProbeAsync(CancellationToken ct) { ProbeEntered.TrySetResult(); return ProbeRelease?.Task ?? Task.FromResult(new VoiceRunnerProbe(true, "Fake only")); }
    public async IAsyncEnumerable<CliRunEvent> StreamAsync(CliRunRequest request, [EnumeratorCancellation] CancellationToken ct)
    {
        Starts++; LastRequest = request; Entered.TrySetResult();
        if (pause is not null) await pause.Task.WaitAsync(ct);
        await Task.Yield(); ct.ThrowIfCancellationRequested();
        using var context = JsonDocument.Parse(File.ReadAllText(Path.Combine(request.WorkingDirectory, "review-context.json")));
        var data = context.RootElement;
        var units = JsonSerializer.Deserialize<TextUnit[]>(data.GetProperty("units"), ProjectStore.Json)!;
        var findings = new List<object>();
        object Finding(TextUnit unit, int start, int end, string replacement) => new
        {
            unitId = unit.Id, start, end, quote = unit.Text[start..end], category = "wording", message = "Clarify wording",
            explanation = "Use a specific description.", evidence = "Grounded in the supplied quote.", suggestion = replacement
        };
        if (Mode is not ("none" or "information" or "unsupported"))
        {
            findings.Add(Finding(units[0], 0, 4, "Clear"));
            findings.Add(Mode == "overlap" ? Finding(units[0], 0, 4, "Useful") : Finding(units[1], 4, 18, "specific tools"));
        }
        yield return new CliRunEvent.OutputDelta(JsonSerializer.Serialize(new
        {
            schemaVersion = 1, documentVersion = data.GetProperty("documentVersion").GetString(),
            taskDisposition = Mode == "missing-disposition" ? null : Mode == "none" ? "already_satisfied" : Mode == "information" ? "needs_information" : Mode == "unsupported" ? "unsupported" : "changes",
            taskExplanation = Mode == "none" ? "The task is already satisfied." : Mode == "information" ? "A referenced fact is missing." : Mode == "unsupported" ? "This needs structural changes in another file." : "The two replacement phrases satisfy the wording task.",
            reviewedUnitIds = units.Select(u => u.Id), findings, notes = new[] { Mode == "none" ? "The supplied wording is already specific; deliberately retained." : "Review proposed replacements before applying." }
        }));
        yield return new CliRunEvent.RunEnded(Mode == "failure" ? RunOutcome.Failed : RunOutcome.Completed, Mode == "failure" ? "Fixture failure" : null, Mode == "failure" ? 1 : 0, 1);
    }
    public void Stop(string id) => Stops++;
    public void Forget(string id) { }
}
