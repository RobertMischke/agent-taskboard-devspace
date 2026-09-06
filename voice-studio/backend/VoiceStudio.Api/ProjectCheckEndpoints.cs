namespace VoiceStudio;

public static class ProjectCheckEndpoints
{
    public static void MapProjectChecks(this WebApplication app)
    {
        var group = app.MapGroup("/api/projects/{projectId}/checks");
        group.MapGet("/configuration", (string projectId, ProjectCheckService service) => service.Configuration(projectId));
        group.MapGet("", (string projectId, ProjectCheckService service) => service.List(projectId));
        group.MapPost("", (string projectId, ProjectCheckStartInput input, ProjectCheckService service) => service.Start(projectId, input));
        group.MapGet("/{id}", (string projectId, string id, ProjectCheckService service) => service.Get(projectId, id));
        group.MapPost("/{id}/cancel", (string projectId, string id, ProjectCheckService service) => service.Cancel(projectId, id));
    }
}
