namespace VoiceStudio;

public static class ImprovementTaskEndpoints
{
    public static void MapImprovementTasks(this WebApplication app)
    {
        var group = app.MapGroup("/api/projects/{projectId}/documents/{documentId}/tasks");
        group.MapGet("", (string projectId, string documentId, ImprovementTaskService service, CancellationToken ct) => service.ListAsync(projectId, documentId, ct));
        group.MapPost("", (string projectId, string documentId, ImprovementTaskInput input, ImprovementTaskService service, CancellationToken ct) => service.CreateAsync(projectId, documentId, input, ct));
        group.MapGet("/{id}", (string projectId, string documentId, string id, ImprovementTaskService service, CancellationToken ct) => service.GetAsync(projectId, documentId, id, ct));
        group.MapGet("/{id}/prompt", (string projectId, string documentId, string id, ImprovementTaskService service, CancellationToken ct) => service.GetPromptAsync(projectId, documentId, id, ct));
        group.MapPost("/{id}/start", (string projectId, string documentId, string id, TaskStartInput input, ImprovementTaskService service, CancellationToken ct) => service.StartAsync(projectId, documentId, id, input, ct));
        group.MapPost("/{id}/cancel", (string projectId, string documentId, string id, TaskRevisionInput input, ImprovementTaskService service, CancellationToken ct) => service.CancelAsync(projectId, documentId, id, input, ct));
        group.MapPost("/{id}/apply", (string projectId, string documentId, string id, TaskApplyInput input, ImprovementTaskService service, CancellationToken ct) => service.ApplyAsync(projectId, documentId, id, input, ct));
        group.MapPost("/{id}/resolve", (string projectId, string documentId, string id, TaskResolveInput input, ImprovementTaskService service, CancellationToken ct) => service.ResolveAsync(projectId, documentId, id, input, ct));
    }
}
