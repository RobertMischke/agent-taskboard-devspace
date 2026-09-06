using Microsoft.AspNetCore.Http;
using System.Net;

namespace VoiceStudio;

/// <summary>Actual static example host, on an origin separate from Studio. Never proxies a URL.</summary>
public sealed class LiveExampleSite(string home)
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8", [".htm"] = "text/html; charset=utf-8",
        [".css"] = "text/css; charset=utf-8", [".js"] = "text/javascript; charset=utf-8",
        [".mjs"] = "text/javascript; charset=utf-8", [".json"] = "application/json; charset=utf-8",
        [".svg"] = "image/svg+xml", [".png"] = "image/png", [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg", [".gif"] = "image/gif", [".webp"] = "image/webp",
        [".ico"] = "image/x-icon", [".woff"] = "font/woff", [".woff2"] = "font/woff2",
        [".ttf"] = "font/ttf", [".txt"] = "text/plain; charset=utf-8"
    };

    public record PublicFile(string Path, string ContentType);

    public PublicFile? Resolve(string requestPath)
    {
        string decoded;
        try { decoded = Uri.UnescapeDataString(requestPath); }
        catch (UriFormatException) { return null; }
        if (decoded.Contains('\\') || decoded.Contains('%') || decoded.Any(char.IsControl)) return null;
        var relative = decoded.TrimStart('/');
        var segments = relative.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Any(s => s.StartsWith('.') || s.Contains(':') || s is "node_modules" or "bin" or "obj")) return null;
        if (segments.FirstOrDefault()?.Equals("api", StringComparison.OrdinalIgnoreCase) == true) return null;
        if (relative.EndsWith(".voice-meta.json", StringComparison.OrdinalIgnoreCase)) return null;
        if (relative == "library/voice-review.js")
        {
            var bundle = ProjectStore.Contained(home, "packages/review/dist/voice-review.js");
            return File.Exists(bundle) ? new(bundle, ContentTypes[".js"]) : null;
        }
        if (segments.FirstOrDefault()?.Equals("library", StringComparison.OrdinalIgnoreCase) == true) return null;
        var siteRoot = Path.Combine(home, "examples", "quality-website");
        if (!Directory.Exists(siteRoot)) return null;
        if (relative.Length == 0 || relative.EndsWith('/')) relative += "index.html";
        var extension = Path.GetExtension(relative);
        if (extension.Length > 0 && !ContentTypes.ContainsKey(extension)) return null;
        var fullPath = ProjectStore.Contained(siteRoot, relative);
        if (!File.Exists(fullPath) && extension.Length == 0)
        {
            fullPath = ProjectStore.Contained(siteRoot, "index.html");
            extension = ".html";
        }
        if (!File.Exists(fullPath) || !ContentTypes.TryGetValue(extension, out var type)) return null;
        return new(fullPath, type);
    }

    public async Task Handle(HttpContext context)
    {
        var host = context.Request.Host;
        if (!(host.Host is "localhost" or "127.0.0.1" or "[::1]" or "::1") || host.Port != 5189)
        { context.Response.StatusCode = 403; return; }
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        { context.Response.StatusCode = 405; context.Response.Headers.Allow = "GET, HEAD"; return; }
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            var file = Resolve(context.Request.Path.Value ?? "/");
            if (file is null) { context.Response.StatusCode = 404; return; }
            context.Response.ContentType = file.ContentType;
            context.Response.ContentLength = new FileInfo(file.Path).Length;
            if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.SendFileAsync(file.Path);
        }
        catch (ApiError) { context.Response.StatusCode = 404; }
        catch (IOException) { context.Response.StatusCode = 404; }
        catch (UnauthorizedAccessException) { context.Response.StatusCode = 404; }
    }
}
