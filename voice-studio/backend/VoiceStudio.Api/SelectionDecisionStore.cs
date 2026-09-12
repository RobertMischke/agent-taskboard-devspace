using System.Text.Json;

namespace VoiceStudio;

public sealed partial class ProjectStore
{
    public SelectionDecision[] ListDecisions(string projectId, string documentId)
        => GetDocument(projectId, documentId).Decisions ?? [];

    public SelectionDecisionResult KeepSelection(string projectId, string documentId, SelectionDecisionInput input)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var detail = Detail(project, documentId);
            var document = Document(project, documentId);
            var review = Review(project, document);
            ValidateRequestId(input.RequestId);
            var fingerprint = Hash(JsonSerializer.Serialize(input, Json));
            var id = Hash("keep:" + projectId + ":" + documentId + ":" + input.RequestId)[..32];
            if (Duplicate(review, "keep:" + input.RequestId, fingerprint))
                return new(detail.Decisions?.FirstOrDefault(decision => decision.Id == id)
                    ?? throw new ApiError(409, "The saved decision is missing. Reload the document."), detail);
            CheckVersion(detail.Version, input.ExpectedVersion);
            CheckReview(review, input.ExpectedReviewRevision);
            ValidateSelection(detail, new(input.UnitId, input.Start, input.End, input.Quote));
            if (input.FindingId?.Length > 200 || input.Note?.Length > 4000)
                throw new ApiError(400, "The decision note or finding reference is too long.");
            if (review.Decisions.Count >= 2000) throw new ApiError(409, "The document has reached its saved decision limit.");
            var decision = new SelectionDecision(id, input.UnitId, input.Start, input.End, input.Quote,
                detail.Version, "keep", "current", Now(), input.FindingId, input.Note?.Trim());
            review.Decisions.Add(decision);
            review.RequestIds["keep:" + input.RequestId] = fingerprint;
            review.SourceVersion = detail.Version;
            review.Revision++;
            SaveReview(project, document, review);
            // A decision records an operator's local review only. Findings and source stay intact.
            return new(decision, Detail(project, documentId));
        }
    }

    public static TextUnit ValidateSelection(DocumentDetail document, ReviewSelection selection)
    {
        var unit = document.Units.FirstOrDefault(unit => unit.Id == selection.UnitId)
            ?? throw new ApiError(400, "The selected text section was not found.");
        if (selection.Quote is null || selection.Quote.Length > 12000 || selection.Start < 0 ||
            selection.End <= selection.Start || selection.End > unit.Text.Length ||
            unit.Text[selection.Start..selection.End] != selection.Quote ||
            selection.Start > 0 && char.IsLowSurrogate(unit.Text[selection.Start]) ||
            selection.End < unit.Text.Length && char.IsLowSurrogate(unit.Text[selection.End]))
            throw new ApiError(400, "The selection and exact UTF-16 quote do not match the current source.");
        return unit;
    }

    private static SelectionDecision[] CurrentDecisions(ReviewFile review, string version, TextUnit[] units)
        => review.Decisions.Select(decision => decision with
        {
            Status = decision.Status == "current" && decision.SourceVersion == version &&
                units.Any(unit => unit.Id == decision.UnitId && decision.Start >= 0 &&
                    decision.End > decision.Start && decision.End <= unit.Text.Length &&
                    unit.Text[decision.Start..decision.End] == decision.Quote) ? "current" : "stale"
        }).Reverse().ToArray();
}
