using Microsoft.AspNetCore.Http;
using VoiceStudio;

var checks = 0;
void Check(bool condition, string message) { if (!condition) throw new Exception(message); checks++; }
var root = Path.Combine(Path.GetTempPath(), "voice-browser-session-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
try
{
    var clock = new TestClock(DateTimeOffset.UtcNow);
    var service = new BrowserSessionService(root, clock);
    var source = Path.Combine(root, "source.md"); File.WriteAllText(source, "# Unchanged source\n");
    var context = Browser(); var enrolled = service.Pair(context, true);
    var cookie = context.Response.Headers.SetCookie.ToString().Split(';')[0];
    var rawCredential = cookie.Split('=')[1];
    Check(enrolled.Remembered && enrolled.ExpiresAt == clock.Now.AddDays(7), "Enrollment has an absolute seven-day lifetime.");
    Check(rawCredential.Length == 64 && rawCredential != enrolled.Token, "Cookie credential is random and distinct from API bearer.");
    var header = context.Response.Headers.SetCookie.ToString();
    Check(header.Contains("httponly", StringComparison.OrdinalIgnoreCase) && header.Contains("samesite=strict", StringComparison.OrdinalIgnoreCase) && header.Contains("path=/api/session") && !header.Contains("domain="), "Cookie is HttpOnly, SameSite Strict, session-path scoped and host-only.");
    var disk = File.ReadAllText(Path.Combine(root, "trusted-browsers.json"));
    Check(!disk.Contains(rawCredential) && !disk.Contains(enrolled.Token), "Only a credential hash is persisted, never cookie or bearer secrets.");
    Check(service.Resume(Browser()) is null, "An unauthenticated browser is not auto-paired.");
    Check(service.Resume(Browser(cookie.Replace(rawCredential, new string('a',64)))) is null, "Invalid credentials cannot resume.");
    Check(service.Resume(Browser(cookie.Split('=')[0] + "=malformed")) is null, "Malformed cookies cannot resume.");
    Check(!service.Authorizes(Browser(cookie)), "Cookie alone cannot authorize project APIs.");
    var resumed = service.Resume(Browser(cookie))!;
    Check(resumed.Token == enrolled.Token && resumed.ExpiresAt == enrolled.ExpiresAt, "Reload reuses runtime token without extending trust expiry.");
    Check(service.Authorizes(Browser(cookie, resumed.Token)), "Resumed bearer authorizes the original local origin.");
    Check(!service.Authorizes(Browser(cookie, resumed.Token, "http://localhost:5188")), "Bearer is bound to original origin, including hostname.");
    var restart = new BrowserSessionService(root, clock);
    Check(!restart.Authorizes(Browser(cookie, enrolled.Token)), "Backend restart invalidates old runtime tokens.");
    var afterRestart = restart.Resume(Browser(cookie))!;
    Check(afterRestart.Remembered && afterRestart.Token != enrolled.Token && afterRestart.ExpiresAt == enrolled.ExpiresAt, "Protected remembered credential survives backend restart and obtains a new in-memory token.");
    foreach (var invalid in new[] { "https://evil.example", "null", "", "http://localhost:5188", "http://127.0.0.1:4188", "http://127.0.0.1:5189" })
    {
        var cross = Browser(cookie); cross.Request.Headers.Origin = invalid;
        try { restart.Resume(cross); throw new Exception("Cross-origin resume accepted"); }
        catch (ApiError error) { Check(error.Status == 403, "Resume rejects absent, opaque, cross-host, cross-port and foreign origins."); }
    }
    var missingIntent = Browser(cookie); missingIntent.Request.Headers.Remove("X-Voice-Studio-Session");
    try { restart.Resume(missingIntent); throw new Exception("Missing intent accepted"); } catch (ApiError error) { Check(error.Status == 403, "Cookie resume requires a non-simple intent header."); }
    var crossLogout = Browser(cookie); crossLogout.Request.Headers.Origin = "http://127.0.0.1:5189";
    try { restart.Logout(crossLogout); throw new Exception("Foreign logout accepted"); } catch (ApiError error) { Check(error.Status == 403, "Logout cannot be induced by a separate local page."); }
    Check(restart.Resume(Browser(cookie)) is not null, "Rejected requests leave the trusted browser intact.");
    var rememberedSecond = Browser(); var second = restart.Pair(rememberedSecond, true);
    var secondCookie = rememberedSecond.Response.Headers.SetCookie.ToString().Split(';')[0];
    var logout = Browser(cookie, afterRestart.Token); restart.Logout(logout);
    Check(restart.Resume(Browser(cookie)) is null && !restart.Authorizes(Browser(cookie, afterRestart.Token)), "Logout revokes both remembered credential and all runtime tokens for that browser.");
    Check(new BrowserSessionService(root, clock).Resume(Browser(cookie)) is null, "Revocation survives backend restart.");
    Check(restart.Resume(Browser(secondCookie)) is not null, "Logging out one browser does not revoke another browser.");
    Check(logout.Response.Headers.SetCookie.ToString().Contains("expires=Thu, 01 Jan 1970"), "Logout expires the stored cookie.");
    var temporaryContext = Browser(); var temporary = restart.Pair(temporaryContext, false);
    Check(!temporary.Remembered && temporary.ExpiresAt is null && restart.Authorizes(Browser(token:temporary.Token)), "Unremembered pairing retains a memory-only session.");
    Check(!temporaryContext.Response.Headers.SetCookie.ToString().Contains("expires=" + clock.Now.AddDays(7).ToString("R")), "Unchecked remember option never enrolls a persistent credential.");
    restart.Logout(Browser(token:temporary.Token));
    Check(!restart.Authorizes(Browser(token:temporary.Token)), "Temporary session logout revokes its runtime bearer too.");
    clock.Now = second.ExpiresAt!.Value;
    Check(restart.Resume(Browser(secondCookie)) is null && !restart.Authorizes(Browser(token:second.Token)), "Expiry blocks both resume and an already open browser at the exact deadline.");
    Check(new BrowserSessionService(root, clock).Resume(Browser(secondCookie)) is null, "Expired trust cannot revive on restart.");
    Check(BrowserSessionService.IsAllowedHost(new("127.0.0.1:5188")) && !BrowserSessionService.IsAllowedHost(new("evil.example:5188")) && !BrowserSessionService.IsAllowedHost(new("127.0.0.1:5189")), "Host and preview-port boundaries remain unchanged.");
    Check(!BrowserSessionService.IsPublicSessionPath("/api/session/resume/extra") && !BrowserSessionService.IsPublicSessionPath("/api/projects"), "Only exact session routes are public; project operations still require bearer authentication.");
    Check(File.ReadAllText(source) == "# Unchanged source\n" && Directory.GetFiles(root).Length == 2, "Pairing, resume, expiry and logout never modify source or create review/proposal metadata.");
    Console.WriteLine($"Browser sessions: {checks} checks passed; isolated private-session fixture, no source mutations or model calls.");
}
finally
{
    var full = Path.GetFullPath(root);
    if (!full.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(full).StartsWith("voice-browser-session-")) throw new Exception("Unexpected test cleanup path");
    Directory.Delete(full, true);
}

static DefaultHttpContext Browser(string? cookie = null, string? token = null, string origin = "http://127.0.0.1:5188")
{
    var context = new DefaultHttpContext(); var url = new Uri(origin);
    context.Request.Scheme = url.Scheme; context.Request.Host = new HostString(url.Authority);
    context.Request.Method = "POST"; context.Request.Path = "/api/session/resume";
    context.Request.Headers.Origin = origin; context.Request.Headers["X-Voice-Studio-Session"] = "1";
    if (cookie is not null) context.Request.Headers.Cookie = cookie;
    if (token is not null) context.Request.Headers.Authorization = "Bearer " + token;
    return context;
}
sealed class TestClock(DateTimeOffset now) : TimeProvider { public DateTimeOffset Now { get; set; } = now; public override DateTimeOffset GetUtcNow() => Now; }
