namespace VoiceStudio;

public sealed partial class ProjectStore
{
    private static (SourceSpan Span, string Replacement) MapReplacement(DocumentDetail detail, ParsedDocument parsed, string unitId, int start, int end, string text)
    {
        if (text is null || text.Length > 50000) throw new ApiError(400, "Ersatztext ist ungültig oder zu lang.");
        var span = parsed.MapSpan(unitId, start, end);
        var unit = detail.Units.First(u => u.Id == unitId);
        if (detail.Format == "html" && (unit.Text.Contains("{{") || unit.Text.Contains("}}") || HasDynamicBinding(detail.Source, span)))
            throw new ApiError(422, "Dynamisch gebundener Fallback-Text benötigt einen unterstützten Quelladapter.");
        var escaped = detail.Format == "html" ? System.Net.WebUtility.HtmlEncode(text)
            : detail.Format == "typescript" ? TypeScriptContentAdapter.EscapeReplacement(text, detail.Source[unit.SourceSpan.Start - 1])
            : EscapeMarkdown(text);
        return (span, escaped);
    }

    public string GetDocumentRoot(string projectId, string documentId)
    {
        lock (gate) { var project = Project(projectId); _ = Document(project, documentId); return project.Root; }
    }
    public ReviewRunContext GetTaskContext(string projectId, string documentId, string version, int reviewRevision)
    {
        lock (gate)
        {
            var context = GetReviewRunContext(projectId, documentId, version);
            if (context.Document.ReviewRevision != reviewRevision) throw new ApiError(409, "Feedback wurde zwischenzeitlich geändert. Quelle und Task neu prüfen.");
            return context;
        }
    }
    public static string TaskContextFingerprint(ReviewRunContext context) => Hash(System.Text.Json.JsonSerializer.Serialize(new
    {
        context.Document.Version, context.Document.ReviewRevision, unitsFingerprint = UnitsFingerprint(context.Document.Units),
        files = context.ContextFiles.Select(f => new { f.Path, version = f.Version ?? Hash(f.Source), f.Truncated })
    }, Json));

    public Proposal CreateTaskProposal(string projectId, string documentId, string taskId, string runId, string version, int reviewRevision, string contextFingerprint, ProposalEdit[] edits)
    {
        lock (gate)
        {
            var context = GetTaskContext(projectId, documentId, version, reviewRevision);
            if (TaskContextFingerprint(context) != contextFingerprint) throw new ApiError(409, "Textzuordnung oder Komponentenkontext wurde geändert.");
            var detail = context.Document;
            var project = Project(projectId); var doc = Document(project, documentId); var review = Review(project, doc);
            var id = Hash("task-proposal:" + taskId + ":" + runId)[..32];
            var existing = review.Proposals.FirstOrDefault(p => p.Id == id);
            if (existing is not null) return existing;
            if (edits.Length is < 1 or > 50) throw new ApiError(422, "Der Agent muss 1 bis 50 konkrete Textänderungen vorschlagen.");
            var parsed = DocumentParser.Parse(detail.Source, detail.Format);
            var mapped = edits.Select(edit =>
            {
                var unit = detail.Units.FirstOrDefault(u => u.Id == edit.UnitId) ?? throw new ApiError(422, "Unbekannter Textabschnitt.");
                if (edit.Start < 0 || edit.End <= edit.Start || edit.End > unit.Text.Length || unit.Text[edit.Start..edit.End] != edit.Quote)
                    throw new ApiError(422, "Agent-Zitat stimmt nicht mit der Quelle überein.");
                return MapReplacement(detail, parsed, edit.UnitId, edit.Start, edit.End, edit.Replacement);
            }).OrderBy(e => e.Span.Start).ToArray();
            for (var i = 1; i < mapped.Length; i++)
                if (mapped[i].Span.Start < mapped[i - 1].Span.End) throw new ApiError(422, "Agent-Vorschläge überlappen sich. Kein Teilvorschlag wurde übernommen.");
            var after = detail.Source;
            foreach (var edit in mapped.Reverse()) after = after[..edit.Span.Start] + edit.Replacement + after[edit.Span.End..];
            if (after == detail.Source) throw new ApiError(422, "Der Agent hat keine Textänderung vorgeschlagen.");
            if (detail.Format == "typescript") TypeScriptContentAdapter.Parse(after);
            var proposal = new Proposal(id, documentId, string.Join("\n", edits.Select(e => e.Quote)), string.Join("\n", edits.Select(e => e.Replacement)),
                string.Join("\n", edits.Select(e => e.Replacement)), detail.Source, after, detail.Version,
                new(mapped[0].Span.Start, mapped[^1].Span.End), null, "Agent-Task: " + string.Join("; ", edits.Select(e => e.Reason)),
                "pending", taskId, runId, edits);
            review.Proposals.Add(proposal); review.SourceVersion = detail.Version; SaveReview(project, doc, review);
            return proposal;
        }
    }

    public DocumentDetail ApplyTaskProposal(string projectId, string documentId, string taskId, string proposalId, string version, int reviewRevision, string contextFingerprint)
    {
        lock (gate)
        {
            var context = GetTaskContext(projectId, documentId, version, reviewRevision);
            if (TaskContextFingerprint(context) != contextFingerprint) throw new ApiError(409, "Textzuordnung oder Komponentenkontext wurde geändert. Task erneut prüfen.");
            return ApplyProposal(projectId, documentId, proposalId, new(version), taskId);
        }
    }
}
