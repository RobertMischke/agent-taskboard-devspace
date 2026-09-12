using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace VoiceStudio;

public sealed record BrowserSessionResult(string Token, bool Remembered, DateTimeOffset? ExpiresAt);
public sealed record TrustedBrowser(string Hash, string Origin, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

/// <summary>Long-lived credentials are hashed on disk; API tokens exist only in this process and browser memory.</summary>
public sealed class BrowserSessionService
{
    public const int RememberDays = 7;
    private const int MaximumBrowsers = 32;
    private readonly object gate = new();
    private readonly string storePath;
    private readonly string cookieScope;
    private readonly TimeProvider clock;
    private readonly List<TrustedBrowser> trusted;
    private readonly Dictionary<string, ActiveSession> active = new();
    private sealed record ActiveSession(string TokenHash, string Origin, string? CredentialHash, DateTimeOffset? ExpiresAt);

    public BrowserSessionService(string privateSessionRoot, TimeProvider? clock = null)
    {
        this.clock = clock ?? TimeProvider.System;
        ProjectStore.EnsureNoLinks(privateSessionRoot);
        storePath = Path.Combine(privateSessionRoot, "trusted-browsers.json");
        cookieScope = ProjectStore.Hash(Path.GetFullPath(privateSessionRoot))[..12];
        ProjectStore.EnsureNoLinks(storePath);
        try { trusted = File.Exists(storePath) ? JsonSerializer.Deserialize<List<TrustedBrowser>>(File.ReadAllText(storePath), ProjectStore.Json) ?? [] : []; }
        catch (JsonException) { throw new InvalidOperationException("Die gespeicherten Browser-Zugänge sind nicht lesbar. Bitte die private Sitzungsdatei prüfen."); }
        if (trusted.Count > MaximumBrowsers || trusted.Any(item => !IsCredential(item.Hash) || !IsLocalOrigin(item.Origin) || item.ExpiresAt <= item.CreatedAt || item.ExpiresAt > item.CreatedAt.AddDays(RememberDays)))
            throw new InvalidOperationException("Die gespeicherten Browser-Zugänge sind ungültig.");
    }

    public BrowserSessionResult Pair(HttpContext context, bool remember)
    {
        // Ordinary CLI pairing remains supported. Cookie enrollment always requires a same-origin browser request.
        if (remember) RequireBrowserIntent(context);
        var origin = RequestOrigin(context);
        lock (gate)
        {
            Prune();
            var oldHash = CookieHash(context);
            if (oldHash is not null) RevokeCredential(oldHash, origin);
            DateTimeOffset? expires = null;
            string? hash = null;
            if (remember)
            {
                if (trusted.Count >= MaximumBrowsers) throw new ApiError(429, "Zu viele gespeicherte Browser. Melde einen Browser ab und versuche es erneut.");
                var credential = RandomSecret(); hash = Hash(credential);
                var now = clock.GetUtcNow(); expires = now.AddDays(RememberDays);
                trusted.Add(new(hash, origin, now, expires.Value));
                Persist();
                context.Response.Cookies.Append(CookieName(context), credential, CookieOptions(expires));
            }
            else
            {
                if (oldHash is not null) Persist();
                context.Response.Cookies.Delete(CookieName(context), CookieOptions());
            }
            return CreateActive(origin, hash, expires);
        }
    }

    public BrowserSessionResult? Resume(HttpContext context)
    {
        RequireBrowserIntent(context);
        lock (gate)
        {
            var hash = CookieHash(context);
            var browser = hash is null ? null : trusted.SingleOrDefault(item => item.Hash == hash && item.Origin == RequestOrigin(context) && item.ExpiresAt > clock.GetUtcNow());
            if (browser is null)
            {
                context.Response.Cookies.Delete(CookieName(context), CookieOptions());
                return null;
            }
            // One runtime token per trusted browser: repeated reloads do not accumulate server sessions.
            var existing = active.FirstOrDefault(item => item.Value.CredentialHash == hash && item.Value.Origin == browser.Origin);
            if (existing.Key is not null) return new(existing.Key, true, browser.ExpiresAt);
            return CreateActive(browser.Origin, browser.Hash, browser.ExpiresAt);
        }
    }

    public void Logout(HttpContext context)
    {
        RequireBrowserIntent(context);
        lock (gate)
        {
            var origin = RequestOrigin(context);
            var hash = CookieHash(context);
            if (hash is not null) RevokeCredential(hash, origin);
            var bearer = ReadBearer(context);
            if (active.TryGetValue(bearer, out var session) && session.Origin == origin)
            {
                if (session.CredentialHash is not null) RevokeCredential(session.CredentialHash, origin);
                active.Remove(bearer);
            }
            Persist();
            context.Response.Cookies.Delete(CookieName(context), CookieOptions());
        }
    }

    public bool Authorizes(HttpContext context)
    {
        var token = ReadBearer(context);
        lock (gate)
        {
            return active.TryGetValue(token, out var session) && FixedEquals(Hash(token), session.TokenHash)
                && session.Origin == RequestOrigin(context)
                && (session.ExpiresAt is null || session.ExpiresAt > clock.GetUtcNow());
        }
    }

    public static bool IsAllowedHost(HostString host) => (host.Host is "localhost" or "127.0.0.1" or "[::1]" or "::1") && (host.Port is 4188 or 5188);
    public static bool IsLocalOrigin(string origin) => origin is "http://localhost:4188" or "http://127.0.0.1:4188" or "http://localhost:5188" or "http://127.0.0.1:5188";
    public static bool IsPublicSessionPath(PathString path) => path == "/api/session" || path == "/api/session/pair" || path == "/api/session/resume" || path == "/api/session/logout";
    public static void RequireBrowserIntent(HttpContext context)
    {
        if (!IsLocalOrigin(context.Request.Headers.Origin.ToString()) || context.Request.Headers.Origin != RequestOrigin(context)
            || context.Request.Headers["X-Voice-Studio-Session"] != "1")
            throw new ApiError(403, "Browser-Anmeldung ist nur vom selben lokalen Studio-Origin erlaubt.");
    }
    public static bool FixedEquals(string value, string expected)
    {
        var a = Encoding.UTF8.GetBytes(value); var b = Encoding.UTF8.GetBytes(expected);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
    private static string RequestOrigin(HttpContext context) => context.Request.Scheme + "://" + context.Request.Host;
    private static string ReadBearer(HttpContext context) => context.Request.Headers.Authorization.ToString() is var value && value.StartsWith("Bearer ", StringComparison.Ordinal) ? value[7..] : "";
    private string CookieName(HttpContext context) => "voice-studio-browser-" + cookieScope + "-" + context.Request.Host.Port;
    private string? CookieHash(HttpContext context) => context.Request.Cookies[CookieName(context)] is { } credential && IsCredential(credential) ? Hash(credential) : null;
    private static bool IsCredential(string value) => value.Length == 64 && value.All(char.IsAsciiHexDigitLower);
    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string RandomSecret() => Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
    private static CookieOptions CookieOptions(DateTimeOffset? expires = null) => new() { HttpOnly = true, SameSite = SameSiteMode.Strict, Path = "/api/session", IsEssential = true, Expires = expires };
    private BrowserSessionResult CreateActive(string origin, string? credentialHash, DateTimeOffset? expires)
    {
        var token = RandomSecret();
        active[token] = new(Hash(token), origin, credentialHash, expires);
        return new(token, credentialHash is not null, expires);
    }
    private void RevokeCredential(string hash, string origin)
    {
        trusted.RemoveAll(item => item.Hash == hash && item.Origin == origin);
        foreach (var token in active.Where(item => item.Value.CredentialHash == hash && item.Value.Origin == origin).Select(item => item.Key).ToArray()) active.Remove(token);
    }
    private void Prune()
    {
        trusted.RemoveAll(item => item.ExpiresAt <= clock.GetUtcNow());
        foreach (var token in active.Where(item => item.Value.ExpiresAt <= clock.GetUtcNow()).Select(item => item.Key).ToArray()) active.Remove(token);
    }
    private void Persist()
    {
        ProjectStore.AtomicWrite(storePath, JsonSerializer.Serialize(trusted, ProjectStore.Json));
        if (OperatingSystem.IsWindows())
        {
            var identity = WindowsIdentity.GetCurrent().User ?? throw new InvalidOperationException("Lokaler Benutzer nicht ermittelbar.");
            var access = new FileSecurity(); access.SetAccessRuleProtection(true, false);
            access.AddAccessRule(new FileSystemAccessRule(identity, FileSystemRights.FullControl, AccessControlType.Allow));
            new FileInfo(storePath).SetAccessControl(access);
        }
        else File.SetUnixFileMode(storePath, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }
}
