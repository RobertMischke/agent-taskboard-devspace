namespace VoiceStudio;

public static class SelectionReviewEndpoints
{
    public static void MapSelectionReviews(this WebApplication app)
    {
        const string route = "/api/projects/{projectId}/documents/{documentId}";
        app.MapGet(route + "/decisions", (string projectId, string documentId, ProjectStore store) => store.ListDecisions(projectId, documentId));
        app.MapPost(route + "/decisions", (string projectId, string documentId, SelectionDecisionInput input, ProjectStore store) => store.KeepSelection(projectId, documentId, input));
        app.MapPost(route + "/suggestions", async (string projectId, string documentId, SelectionSuggestionInput input, RunnerReviewService service, CancellationToken ct) =>
        {
            try { return (IResult)Results.Accepted(value: await service.StartSuggestionsAsync(projectId, documentId, input, ct)); }
            catch (SuggestionRequestError error)
            {
                return Results.Json(new { error = error.Message, message = error.Message,
                    suggestionRequestId = error.SuggestionRequestId, suggestionRequestAccepted = error.SuggestionRequestAccepted }, statusCode: error.Status);
            }
        });
        app.MapGet(route + "/suggestions", (string projectId, string documentId, RunnerReviewService service) => service.ListRuns(projectId, documentId, true));
        app.MapGet(route + "/suggestions/{runId}", (string projectId, string documentId, string runId, RunnerReviewService service) => service.GetSuggestionRun(projectId, documentId, runId));
        app.MapPost(route + "/suggestions/{runId}/cancel", (string projectId, string documentId, string runId, RunnerReviewService service) =>
        {
            _ = service.GetSuggestionRun(projectId, documentId, runId);
            return service.Cancel(projectId, documentId, runId);
        });
    }
}
