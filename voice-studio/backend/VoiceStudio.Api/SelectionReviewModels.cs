namespace VoiceStudio;

public record ReviewSelection(string UnitId, int Start, int End, string Quote);
public record SelectionDecisionInput(string UnitId, int Start, int End, string Quote, string ExpectedVersion,
    int ExpectedReviewRevision, string RequestId, string? FindingId = null, string? Note = null);
public record SelectionDecision(string Id, string UnitId, int Start, int End, string Quote, string SourceVersion,
    string Kind, string Status, string CreatedAt, string? FindingId = null, string? Note = null);
public record SelectionDecisionResult(SelectionDecision Decision, DocumentDetail Document);
public record SelectionSuggestionInput(string UnitId, int Start, int End, string Quote, string ExpectedVersion,
    int ExpectedReviewRevision, string RequestId, string? Instruction = null);
public record SelectionAlternative(string Id, string Replacement, string Reason);

/** A typed rejection proves no durable claim or run exists for this locked request. */
public sealed class SuggestionRequestError(int status, string message, string requestId) : ApiError(status, message)
{
    public string SuggestionRequestId { get; } = requestId;
    public bool SuggestionRequestAccepted => false;
}
