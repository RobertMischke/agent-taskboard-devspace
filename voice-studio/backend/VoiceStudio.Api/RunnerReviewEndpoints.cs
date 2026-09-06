namespace VoiceStudio;

public static class RunnerReviewEndpoints
{
    public static void MapVoiceSemanticReview(this WebApplication app)
    {
        app.MapGet("/api/semantic-review/status", (RunnerReviewService service, CancellationToken ct) => service.GetStatusAsync(ct));
        app.MapPost("/api/projects/{projectId}/documents/{documentId}/semantic-reviews", async (string projectId, string documentId, SemanticReviewInput input, RunnerReviewService service, CancellationToken ct) =>
            Results.Accepted(value: await service.StartAsync(projectId, documentId, input, ct)));
        app.MapGet("/api/projects/{projectId}/documents/{documentId}/semantic-reviews", (string projectId, string documentId, RunnerReviewService service) => service.ListRuns(projectId, documentId));
        app.MapGet("/api/projects/{projectId}/documents/{documentId}/semantic-reviews/{runId}", (string projectId, string documentId, string runId, RunnerReviewService service) => service.GetRun(projectId, documentId, runId));
        app.MapPost("/api/projects/{projectId}/documents/{documentId}/semantic-reviews/{runId}/cancel", (string projectId, string documentId, string runId, RunnerReviewService service) => service.Cancel(projectId, documentId, runId));
    }
}
