using System.Text.Json;
using System.Text.RegularExpressions;

namespace VoiceStudio;

/// <summary>Durable editorial tasks reuse the staged, read-only semantic runner.
/// No queue consumer starts inference: each task needs an explicit Start request.</summary>
public sealed class ImprovementTaskService(ProjectStore store, RunnerReviewService reviews) : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly CancellationTokenSource shutdown = new();
    private sealed class Record
    {
        public ImprovementTask Task { get; set; } = null!;
        public string CreationFingerprint { get; set; } = "";
        public string ContextFingerprint { get; set; } = "";
        public string Prompt { get; set; } = "";
        public string? StartRequestId { get; set; }
        public string? StartFingerprint { get; set; }
    }
    private static string Now() => DateTimeOffset.UtcNow.ToString("O");
    private static void CheckId(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || !Regex.IsMatch(id, @"^[a-f0-9]{32}$")) throw new ApiError(400, "Ungültige Task-ID.");
    }
    private static void CheckRequest(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || !Regex.IsMatch(id, @"^[a-zA-Z0-9_-]{1,160}$")) throw new ApiError(400, "Eine eindeutige Request-ID ist erforderlich.");
    }
    private string DirectoryPath(string projectId, string documentId)
    {
        return ProjectStore.Contained(store.GetDocumentRoot(projectId, documentId), ".voice-lint/tasks/" + documentId);
    }
    private string PathFor(string projectId, string documentId, string id)
    {
        CheckId(id);
        return ProjectStore.Contained(DirectoryPath(projectId, documentId), id + ".json");
    }
    private static Record Read(string path, string projectId, string documentId)
    {
        ProjectStore.EnsureNoLinks(path);
        if (!File.Exists(path)) throw new ApiError(404, "Task nicht gefunden.");
        if (new FileInfo(path).Length > 8000000) throw new ApiError(409, "Gespeicherter Task überschreitet die Metadatengrenze.");
        Record record;
        try { record = JsonSerializer.Deserialize<Record>(File.ReadAllText(path), ProjectStore.Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiError(409, "Task-Metadaten sind ungültig; sie wurden nicht überschrieben."); }
        if (record.Task is null || record.Task.Id != Path.GetFileNameWithoutExtension(path) || record.Task.ProjectId != projectId || record.Task.DocumentId != documentId)
            throw new ApiError(409, "Task-Metadaten gehören nicht zu dieser Datei.");
        if (record.Task.Revision < 1 || record.Task.ReviewRevision < 0 || record.Task.FeedbackIds is null || record.Task.FeedbackIds.Length > 100 ||
            record.Task.FeedbackIds.Any(string.IsNullOrWhiteSpace) || string.IsNullOrWhiteSpace(record.Task.Instruction) || record.Task.Instruction.Length > 10000 ||
            record.ContextFingerprint is null || !Regex.IsMatch(record.ContextFingerprint, "^[a-f0-9]{64}$") ||
            record.Task.SourceVersion is null || !Regex.IsMatch(record.Task.SourceVersion, "^[a-f0-9]{64}$") || record.Prompt is null ||
            record.Task.Status is not ("queued" or "running" or "cancelling" or "ready" or "failed" or "cancelled" or "stale" or "interrupted" or "applied" or "completed" or "needs_review") ||
            record.Task.Status == "ready" && (record.Task.Proposal is null || record.Task.ProposalId != record.Task.Proposal.Id))
            throw new ApiError(409, "Gespeicherter Task verletzt den Task-Vertrag; keine Ausführung oder Änderung.");
        return record;
    }
    private static void Save(string path, Record record)
    {
        var folder = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(folder); ProjectStore.EnsureNoLinks(folder);
        ProjectStore.AtomicWrite(path, JsonSerializer.Serialize(record, ProjectStore.Json));
    }
    private static void Update(string path, Record record, ImprovementTask task)
    {
        record.Task = task with { Revision = record.Task.Revision + 1, UpdatedAt = Now() };
        Save(path, record);
    }
    private static void CheckRevision(ImprovementTask task, int expected)
    {
        if (task.Revision != expected) throw new ApiError(409, "Der Task wurde zwischenzeitlich geändert. Bitte aktualisieren.");
    }
    private ReviewRunContext CheckContext(Record record)
    {
        var task = record.Task;
        var context = store.GetTaskContext(task.ProjectId, task.DocumentId, task.SourceVersion, task.ReviewRevision);
        if (ProjectStore.TaskContextFingerprint(context) != record.ContextFingerprint) throw new ApiError(409, "Die Textzuordnung oder der Komponentenkontext hat sich geändert.");
        return context;
    }

    public async Task<ImprovementTask> CreateAsync(string projectId, string documentId, ImprovementTaskInput input, CancellationToken ct = default)
    {
        CheckRequest(input.RequestId);
        if (string.IsNullOrWhiteSpace(input.Instruction) || input.Instruction.Length > 10000) throw new ApiError(400, "Bitte einen Auftrag mit höchstens 10000 Zeichen angeben.");
        if (input.FeedbackIds is null || input.FeedbackIds.Length > 100 || input.FeedbackIds.Any(string.IsNullOrWhiteSpace)) throw new ApiError(400, "Ungültige Feedback-Auswahl.");
        await gate.WaitAsync(ct);
        try
        {
            var id = ProjectStore.Hash(projectId + "\n" + documentId + "\n" + input.RequestId)[..32];
            var path = PathFor(projectId, documentId, id);
            var fingerprint = ProjectStore.Hash(JsonSerializer.Serialize(input, ProjectStore.Json));
            if (File.Exists(path))
            {
                var existing = Read(path, projectId, documentId);
                if (existing.CreationFingerprint != fingerprint) throw new ApiError(409, "Task-Request-ID wurde bereits für einen anderen Inhalt verwendet.");
                return Refresh(path, existing);
            }
            var context = store.GetTaskContext(projectId, documentId, input.ExpectedVersion, input.ExpectedReviewRevision);
            var ids = input.FeedbackIds.Distinct().ToArray();
            if (ids.Any(id => !context.Document.Feedback.Any(f => f.Id == id && f.Status != "needs_reattachment")))
                throw new ApiError(400, "Ausgewähltes Feedback fehlt oder muss zuerst neu angeheftet werden.");
            var record = new Record
            {
                Task = new(id, projectId, documentId, input.Instruction.Trim(), ids, input.ExpectedVersion, input.ExpectedReviewRevision, 1, "queued", Now(), Now()),
                CreationFingerprint = fingerprint, ContextFingerprint = ProjectStore.TaskContextFingerprint(context),
                Prompt = reviews.PrepareTaskPrompt(context, input.Instruction.Trim(), ids)
            };
            Save(path, record);
            return record.Task;
        }
        finally { gate.Release(); }
    }
    public async Task<ImprovementTask[]> ListAsync(string projectId, string documentId, CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try
        {
            var directory = DirectoryPath(projectId, documentId);
            if (!Directory.Exists(directory)) return [];
            var records = Directory.EnumerateFiles(directory, "*.json").Where(p => Regex.IsMatch(Path.GetFileNameWithoutExtension(p), "^[a-f0-9]{32}$"))
                .Select(path => (Path: path, Record: Read(path, projectId, documentId)))
                .OrderByDescending(item => item.Record.Task.CreatedAt, StringComparer.Ordinal).Take(100).ToArray();
            return records.Select(item => Refresh(item.Path, item.Record)).ToArray();
        }
        finally { gate.Release(); }
    }
    public async Task<ImprovementTask> GetAsync(string projectId, string documentId, string id, CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try { var path = PathFor(projectId, documentId, id); return Refresh(path, Read(path, projectId, documentId)); }
        finally { gate.Release(); }
    }
    public async Task<TaskPrompt> GetPromptAsync(string projectId, string documentId, string id, CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try
        {
            var record = Read(PathFor(projectId, documentId, id), projectId, documentId);
            return new(record.Prompt, record.Task.SourceVersion, record.Task.ReviewRevision);
        }
        finally { gate.Release(); }
    }
    public async Task<ImprovementTask> StartAsync(string projectId, string documentId, string id, TaskStartInput input, CancellationToken ct = default)
    {
        CheckRequest(input.RequestId);
        await gate.WaitAsync(ct);
        try
        {
            var path = PathFor(projectId, documentId, id);
            var record = Read(path, projectId, documentId);
            var fingerprint = ProjectStore.Hash(JsonSerializer.Serialize(input, ProjectStore.Json));
            if (record.StartRequestId is not null)
            {
                if (record.StartRequestId == input.RequestId && record.StartFingerprint == fingerprint) return Refresh(path, record);
                throw new ApiError(409, "Dieser Task hat bereits einen Startauftrag. Für einen weiteren Versuch einen neuen Task anlegen.");
            }
            var task = Refresh(path, record); CheckRevision(task, input.ExpectedTaskRevision);
            if (task.Status != "queued") throw new ApiError(409, "Nur ein gespeicherter, aktueller Task kann gestartet werden.");
            if (task.SourceVersion != input.ExpectedVersion || task.ReviewRevision != input.ExpectedReviewRevision) throw new ApiError(409, "Quellversion oder Feedbackstand stimmen nicht mit dem Task überein.");
            CheckContext(record);
            var requestId = "task-" + id + "-" + ProjectStore.Hash(input.RequestId)[..32];
            var runId = ProjectStore.Hash(projectId + "\n" + documentId + "\n" + requestId)[..32];
            record.StartRequestId = input.RequestId; record.StartFingerprint = fingerprint;
            Update(path, record, task with { Status = "running", RunId = runId, Error = null });
            try
            {
                await reviews.StartTaskAsync(projectId, documentId, new(task.SourceVersion, requestId, task.Instruction), id, task.FeedbackIds, task.ReviewRevision, record.ContextFingerprint, ct);
                _ = MonitorAsync(projectId, documentId, id);
            }
            catch (Exception error)
            {
                Update(path, record, record.Task with { Status = error is ApiError { Status: 409 } ? "stale" : "failed", Error = error.Message });
            }
            return record.Task;
        }
        finally { gate.Release(); }
    }

    public async Task<ImprovementTask> CancelAsync(string projectId, string documentId, string id, TaskRevisionInput input, CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try
        {
            var path = PathFor(projectId, documentId, id); var record = Read(path, projectId, documentId);
            var task = Refresh(path, record); CheckRevision(task, input.ExpectedTaskRevision);
            if (task.Status == "queued") Update(path, record, task with { Status = "cancelled", Error = "Vor dem Agent-Start abgebrochen." });
            else if (task.Status is "running" or "cancelling")
            {
                if (task.Status != "cancelling") Update(path, record, task with { Status = "cancelling" });
                reviews.Cancel(projectId, documentId, task.RunId!);
            }
            else throw new ApiError(409, "Dieser Task läuft nicht mehr.");
            return record.Task;
        }
        finally { gate.Release(); }
    }
    public async Task<TaskApplyResult> ApplyAsync(string projectId, string documentId, string id, TaskApplyInput input, CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try
        {
            var path = PathFor(projectId, documentId, id); var record = Read(path, projectId, documentId);
            var task = Refresh(path, record);
            if (task.Status == "applied") return new(task, store.GetDocument(projectId, documentId));
            CheckRevision(task, input.ExpectedTaskRevision);
            if (task.Status != "ready" || task.ProposalId is null) throw new ApiError(409, "Dieser Task hat keinen aktuellen übernehmbaren Vorschlag.");
            if (task.SourceVersion != input.ExpectedVersion || task.ReviewRevision != input.ExpectedReviewRevision) throw new ApiError(409, "Quelle oder Feedbackstand stimmen nicht mit dem geprüften Task überein.");
            var document = store.ApplyTaskProposal(projectId, documentId, id, task.ProposalId, input.ExpectedVersion, input.ExpectedReviewRevision, record.ContextFingerprint);
            Update(path, record, task with { Status = "applied", Proposal = task.Proposal! with { State = "applied" }, Error = null });
            return new(record.Task, document);
        }
        finally { gate.Release(); }
    }
    public async Task<ImprovementTask> ResolveAsync(string projectId, string documentId, string id, TaskResolveInput input, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Note) || input.Note.Length > 4000) throw new ApiError(400, "Bitte begründen, warum der Task als bearbeitet gilt (höchstens 4000 Zeichen).");
        await gate.WaitAsync(ct);
        try
        {
            var path = PathFor(projectId, documentId, id); var record = Read(path, projectId, documentId);
            var task = Refresh(path, record); CheckRevision(task, input.ExpectedTaskRevision);
            if (task.Status is "running" or "cancelling" or "applied" or "completed") throw new ApiError(409, "Laufende oder bereits abgeschlossene Tasks können nicht erneut als bearbeitet markiert werden.");
            store.GetTaskContext(projectId, documentId, input.ExpectedVersion, input.ExpectedReviewRevision);
            Update(path, record, task with { Status = "completed", Resolution = "manual", Error = null,
                Notes = [.. task.Notes ?? [], "Manuell als bearbeitet/beibehalten markiert: " + input.Note.Trim()] });
            return record.Task;
        }
        finally { gate.Release(); }
    }

    private ImprovementTask Refresh(string path, Record record)
    {
        var task = record.Task;
        if (task.Status is "applied" or "completed") return task;
        // Recover an apply whose source transaction completed before task metadata.
        if (task.ProposalId is not null)
        {
            var proposal = store.ListProposals(task.ProjectId, task.DocumentId).FirstOrDefault(p => p.Id == task.ProposalId);
            if (proposal is not null && (proposal.TaskId != task.Id || proposal.RunId != task.RunId))
                throw new ApiError(409, "Gespeicherter Vorschlag ist nicht mit diesem Task und Runner-Lauf verknüpft.");
            if (proposal is { State: "applied" })
            {
                Update(path, record, task with { Status = "applied", Proposal = proposal, Error = null });
                return record.Task;
            }
        }
        if (task.Status is "queued" or "ready")
        {
            try { CheckContext(record); }
            catch (ApiError error) when (error.Status is 409 or 404)
            {
                Update(path, record, task with { Status = "stale", Error = error.Message });
            }
            return record.Task;
        }
        if (task.Status is not ("running" or "cancelling") || task.RunId is null) return task;
        SemanticReviewRun run;
        try { run = reviews.GetRun(task.ProjectId, task.DocumentId, task.RunId); }
        catch (ApiError error) when (error.Status == 404)
        {
            Update(path, record, task with { Status = "interrupted", Error = "Der gespeicherte Startauftrag hat keinen wiederherstellbaren Runner-Lauf. Kein automatischer Neustart." });
            return record.Task;
        }
        if (run.TaskId != task.Id) throw new ApiError(409, "Runner-Lauf ist nicht mit diesem Task verknüpft.");
        if (run.Status is "running" or "cancelling") return task;
        if (task.Status == "cancelling" || run.Status == "cancelled")
            Update(path, record, task with { Status = "cancelled", Error = run.Error ?? "Abgebrochen; kein Vorschlag übernommen.", Notes = run.Notes });
        else if (run.Status == "completed")
        {
            try
            {
                CheckContext(record);
                var edits = run.Findings.Where(f => f.Suggestion is not null && f.Suggestion != f.Quote)
                    .Select(f => new ProposalEdit(f.UnitId, f.Start, f.End, f.Quote, f.Suggestion!, f.Explanation)).ToArray();
                if (edits.Length == 0)
                    Update(path, record, task with { Status = run.TaskDisposition == "already_satisfied" ? "completed" : "needs_review",
                        Resolution = run.TaskDisposition == "already_satisfied" ? "agent_no_changes" : null, Error = null,
                        Notes = [.. run.Notes, run.TaskExplanation ?? "Kein Änderungsvorschlag; der Auftrag benötigt weitere Prüfung."] });
                else
                {
                    var proposal = store.CreateTaskProposal(task.ProjectId, task.DocumentId, task.Id, run.Id, task.SourceVersion, task.ReviewRevision, record.ContextFingerprint, edits);
                    Update(path, record, task with { Status = "ready", ProposalId = proposal.Id, Proposal = proposal, Error = null, Notes = [.. run.Notes, run.TaskExplanation ?? "Änderungsvorschlag prüfen."] });
                }
            }
            catch (ApiError error)
            {
                Update(path, record, task with { Status = error.Status == 409 ? "stale" : "failed", Error = error.Message, Notes = run.Notes });
            }
        }
        else Update(path, record, task with { Status = run.Status is "stale" or "interrupted" ? run.Status : "failed", Error = run.Error ?? "Agentlauf ohne erfolgreichen Abschluss.", Notes = run.Notes });
        return record.Task;
    }
    private async Task MonitorAsync(string projectId, string documentId, string id)
    {
        try
        {
            while (!shutdown.IsCancellationRequested)
            {
                await Task.Delay(750, shutdown.Token);
                var task = await GetAsync(projectId, documentId, id, shutdown.Token);
                if (task.Status is not ("running" or "cancelling")) return;
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception) { /* A later GET recovers the durable run; never restart inference. */ }
    }
    public void Dispose()
    {
        shutdown.Cancel();
        // Let an in-flight monitor finish its atomic metadata operation before
        // the host disposes project resources. Cancelled monitors cannot reenter.
        gate.Wait(); gate.Release();
    }
}
