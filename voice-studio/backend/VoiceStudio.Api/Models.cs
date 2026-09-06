namespace VoiceStudio;

public record ProjectSummary(string Id, string Name, string Description, int DocumentCount, string? LiveUrl = null, Dictionary<string, string>? SourceRoutes = null, Dictionary<string, string[]>? SourceContexts = null);
public record SourceSpan(int Start, int End, string Encoding = "utf16");
public record TextUnit(string Id, string Text, SourceSpan SourceSpan, string Kind, string Language);
public record Finding(string Id, string RuleId, string Category, string Severity, string Message, string Explanation, string Quote, string UnitId, int Start, int End, string? Suggestion, string Engine = "voice-studio/local-rules-v0");
public record Feedback(string Id, string UnitId, string Quote, string Prefix, string Suffix, int Start, int End, string Comment, string Category, string Status, string SourceVersion, string CreatedAt, string UpdatedAt);
public record DocumentSummary(string Id, string Path, string Title, string Format, string Language, string Version, int WordCount, int FindingCount, int OpenFeedbackCount);
public record Coverage(int CheckedUnits, int TotalUnits, int ExcludedRegions, string[] Notes);
public record DocumentDetail(string Id, string Path, string Title, string Format, string Language, string Version, int WordCount, int FindingCount, int OpenFeedbackCount, string Source, string RenderedHtml, TextUnit[] Units, Finding[] Findings, Feedback[] Feedback, int ReviewRevision, Coverage Coverage);
public record ProjectReport(string ProjectId, DocumentSummary[] Documents, int TotalWords, int FindingCount, int OpenFeedbackCount, Dictionary<string, int> Categories, Dictionary<string, int> Rules);
public record FeedbackInput(string UnitId, string Quote, int Start, int End, string Comment, string Category, string ExpectedVersion, int ExpectedReviewRevision, string RequestId);
public record FeedbackStatusInput(string Status, int ExpectedReviewRevision);
public record ProposalInput(string UnitId, int Start, int End, string Replacement, string ExpectedVersion, string? FeedbackId);
public record Proposal(string Id, string DocumentId, string Before, string After, string Replacement, string SourceBefore, string SourceAfter, string ExpectedVersion, SourceSpan SourceSpan, string? FeedbackId, string Reason, string State);
public record ApplyInput(string ExpectedVersion);
public record ImprovementInput(string[] FeedbackIds, string Instruction, string ExpectedVersion, string RequestId);
public record ImprovementRequest(string Id, string ProjectId, string DocumentId, string[] FeedbackIds, string Instruction, string ExpectedVersion, string Status, string CreatedAt);
public record RegisterInput(string Path, string? Name);
public record PairInput(string Code);
public record BrowserInput(string Url);
public record RegisteredProject(string Id, string Name, string Root, string? LiveUrl = null);
public record SourceDocument(string Id, string RelativePath, string FullPath);
public class ReviewFile
{
    public int SchemaVersion { get; set; } = 1;
    public int Revision { get; set; }
    public string DocumentPath { get; set; } = "";
    public string SourceVersion { get; set; } = "";
    public List<Feedback> Feedback { get; set; } = [];
    public Dictionary<string, string> RequestIds { get; set; } = [];
    public List<Proposal> Proposals { get; set; } = [];
    public List<ImprovementRequest> ImprovementRequests { get; set; } = [];
}
public class ApiError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public record ContextSource(string Path, string Source, bool Truncated);
public record ReviewRunContext(string ProjectRoot, DocumentDetail Document, ContextSource[] ContextFiles);
