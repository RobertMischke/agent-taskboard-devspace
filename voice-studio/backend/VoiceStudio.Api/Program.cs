using System.Net;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.FileProviders;
using VoiceStudio;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5188", "http://127.0.0.1:5189");
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 256 * 1024);
var home = Environment.GetEnvironmentVariable("VOICE_STUDIO_HOME") ?? FindHome();
home = Path.TrimEndingDirectorySeparator(Path.GetFullPath(home));
var runtime = Path.Combine(home, ".voice-studio");
Directory.CreateDirectory(runtime);
ProjectStore.EnsureNoLinks(runtime);
var sessionRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VoiceStudio", "sessions", ProjectStore.Hash(OperatingSystem.IsWindows() ? home.ToUpperInvariant() : home)[..16]);
Directory.CreateDirectory(sessionRoot);
ProjectStore.EnsureNoLinks(sessionRoot);
var sessionFilePath = Path.Combine(sessionRoot, "session.json");
if (OperatingSystem.IsWindows())
{
    var identity = WindowsIdentity.GetCurrent().User ?? throw new InvalidOperationException("Lokaler Benutzer nicht ermittelbar.");
    var access = new DirectorySecurity();
    access.SetAccessRuleProtection(true, false);
    access.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
    new DirectoryInfo(sessionRoot).SetAccessControl(access);
}
else File.SetUnixFileMode(sessionRoot, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
using var instanceLock = WorkspaceInstanceLock.TryAcquire(sessionRoot);
if (instanceLock is null)
{
    Console.Error.WriteLine("Voice Studio: Diese Workspace-Sitzung ist bereits gesperrt oder kann nicht exklusiv geöffnet werden. Bestehende Zugangsdaten bleiben unverändert.");
    Environment.ExitCode = 1;
    return;
}
var token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
var pairingCode = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8));
ProjectStore.AtomicWrite(sessionFilePath, JsonSerializer.Serialize(new { pairingCode, token, startedAt = DateTimeOffset.UtcNow }, ProjectStore.Json));
if (OperatingSystem.IsWindows())
{
    var sessionFile = new FileInfo(sessionFilePath);
    var identity = WindowsIdentity.GetCurrent().User ?? throw new InvalidOperationException("Lokaler Benutzer nicht ermittelbar.");
    var access = new FileSecurity();
    access.SetAccessRuleProtection(true, false);
    access.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl, AccessControlType.Allow));
    sessionFile.SetAccessControl(access);
}
else File.SetUnixFileMode(sessionFilePath, UnixFileMode.UserRead | UnixFileMode.UserWrite);
ProjectStore.AtomicWrite(Path.Combine(runtime, "session-location.json"), JsonSerializer.Serialize(new { sessionFile = sessionFilePath }, ProjectStore.Json));
var legacySession = Path.Combine(runtime, "session.json");
if (File.Exists(legacySession)) File.Delete(legacySession);
builder.Services.AddSingleton(new ProjectStore(home));
builder.Services.AddSingleton(provider => new RunnerReviewService(provider.GetRequiredService<ProjectStore>(), RunnerReviewOptions.FromEnvironment(), Path.Combine(sessionRoot, "runner")));
builder.Services.AddSingleton<ImprovementTaskService>();
builder.Services.AddSingleton<SourceContextService>();
builder.Services.AddSingleton(provider => new ProjectCheckService(provider.GetRequiredService<ProjectStore>(), Path.Combine(sessionRoot, "checks.json")));
var app = builder.Build();
_ = app.Services.GetRequiredService<ProjectCheckService>(); // Freeze private check profiles at startup.
var browserSessions = new BrowserSessionService(sessionRoot);
var failedPairings = new Queue<DateTimeOffset>();
var pairingGate = new object();
var liveExample = new LiveExampleSite(home);
app.MapWhen(context => context.Connection.LocalPort == 5189, branch => branch.Run(liveExample.Handle));

app.Use(async (context, next) =>
{
    var host = context.Request.Host;
    var validHost = BrowserSessionService.IsAllowedHost(host);
    if (!validHost) { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Host ist nicht für diese lokale Sitzung zugelassen." }); return; }
    var origin = context.Request.Headers.Origin.ToString();
    if (!string.IsNullOrEmpty(origin) && !BrowserSessionService.IsLocalOrigin(origin))
    { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Origin ist nicht für diese lokale Sitzung zugelassen." }); return; }
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        var publicEndpoint = BrowserSessionService.IsPublicSessionPath(context.Request.Path) || context.Request.Path == "/api/health";
        if (!publicEndpoint && !FixedEquals(context.Request.Headers.Authorization.ToString(), "Bearer " + token) && !browserSessions.Authorizes(context))
        { context.Response.StatusCode = 401; await context.Response.WriteAsJsonAsync(new { error = "Bitte lokale Sitzung mit dem Pairing-Code verbinden." }); return; }
    }
    try { await next(context); }
    catch (ApiError error) { context.Response.StatusCode = error.Status; await context.Response.WriteAsJsonAsync(new { error = error.Message, message = error.Message }); }
    catch (UnauthorizedAccessException) { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Kein Zugriff auf den lokalen Projektpfad." }); }
    catch (IOException error) { app.Logger.LogWarning(error, "Filesystem operation failed"); context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { error = "Dateizugriff fehlgeschlagen. Quelle und Metadaten bitte prüfen; kein automatischer Wiederholungsversuch." }); }
});

app.MapVoiceSemanticReview();
app.MapSelectionReviews();
app.MapGet("/api/projects/{projectId}/documents/{documentId}/source-context", (string projectId, string documentId, bool? includeGit, SourceContextService service, CancellationToken ct) => service.GetAsync(projectId, documentId, includeGit ?? false, ct));
app.MapImprovementTasks();
app.MapProjectChecks();
app.MapFallback("/api/{**path}", () => Results.NotFound(new { error = "API-Route nicht gefunden.", message = "API-Route nicht gefunden." }));
app.MapGet("/api/health", () => new { status = "ok", service = "voice-studio", version = "0.3.0" });
app.MapGet("/api/session", (HttpContext context) => new { paired = FixedEquals(context.Request.Headers.Authorization.ToString(), "Bearer " + token) || browserSessions.Authorizes(context), requiresPairing = true, pairingFile = ".voice-studio/session-location.json", mode = "local" });
app.MapPost("/api/session/pair", (PairInput input, HttpContext context) =>
{
    lock (pairingGate)
    {
        while (failedPairings.TryPeek(out var time) && time < DateTimeOffset.UtcNow.AddMinutes(-1)) failedPairings.Dequeue();
        if (failedPairings.Count >= 10) throw new ApiError(429, "Zu viele Pairing-Versuche. Bitte eine Minute warten.");
        if (!FixedEquals(input.Code?.Trim() ?? "", pairingCode)) { failedPairings.Enqueue(DateTimeOffset.UtcNow); throw new ApiError(401, "Pairing-Code stimmt nicht."); }
        return Results.Ok(browserSessions.Pair(context, input.Remember));
    }
});
app.MapPost("/api/session/resume", (HttpContext context) =>
{
    var result = browserSessions.Resume(context);
    return result is null ? Results.Ok(new { paired = false }) : Results.Ok(result);
});
app.MapPost("/api/session/logout", (HttpContext context) => { browserSessions.Logout(context); return Results.NoContent(); });
app.MapGet("/api/projects", (ProjectStore store) => store.ListProjects());
app.MapPost("/api/projects/register", (RegisterInput input, ProjectStore store) => store.Register(input));
app.MapPatch("/api/projects/{projectId}/browser", (string projectId, BrowserInput input, ProjectStore store) => store.SetBrowser(projectId, input));
app.MapDelete("/api/projects/{projectId}", (string projectId, ProjectStore store) => { store.Unregister(projectId); return Results.NoContent(); });
app.MapGet("/api/projects/{projectId}/report", (string projectId, ProjectStore store) => store.Report(projectId));
app.MapGet("/api/projects/{projectId}/documents", (string projectId, ProjectStore store) => store.ListDocuments(projectId));
app.MapGet("/api/projects/{projectId}/documents/{documentId}", (string projectId, string documentId, ProjectStore store) => store.GetDocument(projectId, documentId));
app.MapGet("/api/projects/{projectId}/documents/{documentId}/proposals", (string projectId, string documentId, ProjectStore store) => store.ListProposals(projectId, documentId));
app.MapGet("/api/projects/{projectId}/documents/{documentId}/requests", (string projectId, string documentId, ProjectStore store) => store.ListRequests(projectId, documentId));
app.MapPost("/api/projects/{projectId}/documents/{documentId}/feedback", (string projectId, string documentId, FeedbackInput input, ProjectStore store) => store.SaveFeedback(projectId, documentId, input));
app.MapPatch("/api/projects/{projectId}/documents/{documentId}/feedback/{feedbackId}", (string projectId, string documentId, string feedbackId, FeedbackStatusInput input, ProjectStore store) => store.SetFeedbackStatus(projectId, documentId, feedbackId, input));
app.MapPost("/api/projects/{projectId}/documents/{documentId}/proposals", (string projectId, string documentId, ProposalInput input, ProjectStore store) => store.CreateProposal(projectId, documentId, input));
app.MapPost("/api/projects/{projectId}/documents/{documentId}/proposals/{proposalId}/apply", (string projectId, string documentId, string proposalId, ApplyInput input, ProjectStore store) => store.ApplyProposal(projectId, documentId, proposalId, input));
app.MapPost("/api/projects/{projectId}/documents/{documentId}/requests", (string projectId, string documentId, ImprovementInput input, ProjectStore store) => store.CreateRequest(projectId, documentId, input));
var library = Path.Combine(home, "packages", "review", "dist");
if (Directory.Exists(library)) app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(library), RequestPath = "/library" });
app.MapGet("/examples/library-embed/index.html", () =>
{
    var example = Path.Combine(home, "examples", "library-embed", "index.html");
    return File.Exists(example) ? Results.File(example, "text/html; charset=utf-8") : Results.NotFound();
});
var frontend = Path.Combine(home, "frontend", "dist", "voice-studio", "browser");
if (Directory.Exists(frontend))
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(frontend) });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(frontend) });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = new PhysicalFileProvider(frontend) });
}
Console.WriteLine($"Voice Studio: http://localhost:5188 | PID: {Environment.ProcessId} | Pairing-Code: {pairingCode}");
Console.WriteLine("Echte Beispielwebsite: http://127.0.0.1:5189/index.html (separater Origin, eigene Scripts und Browserzustände)");
Console.WriteLine("Lokaler Pairing-Code und Sitzungstoken: " + sessionFilePath);
app.Run();

static bool FixedEquals(string value, string expected)
{
    var a = Encoding.UTF8.GetBytes(value); var b = Encoding.UTF8.GetBytes(expected);
    return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
}
static string FindHome()
{
    foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
    {
        var cursor = new DirectoryInfo(start);
        while (cursor is not null)
        {
            if (File.Exists(Path.Combine(cursor.FullName, "packages", "contracts", "src", "index.ts"))) return cursor.FullName;
            cursor = cursor.Parent;
        }
    }
    throw new InvalidOperationException("Voice-Studio-Projektwurzel nicht gefunden. VOICE_STUDIO_HOME setzen.");
}
