using System.Text.Json;
using System.Text.RegularExpressions;

namespace VoiceStudio;

public sealed record VoiceProjectConfig(int Version, string? LiveUrl, string[] SourceFiles, Dictionary<string, string>? Routes, Dictionary<string, string[]>? SourceContexts = null)
{
    public static VoiceProjectConfig? Read(string root)
    {
        var path = ProjectStore.Contained(root, "voice.config.json");
        if (!File.Exists(path)) return null;
        if (new FileInfo(path).Length > 65536) throw new ApiError(422, "voice.config.json ist größer als 64 KB.");
        VoiceProjectConfig config;
        try { config = JsonSerializer.Deserialize<VoiceProjectConfig>(File.ReadAllText(path), ProjectStore.Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiError(422, "voice.config.json ist keine gültige Projektkonfiguration."); }
        if (config.Version != 1 || config.SourceFiles is not { Length: > 0 and <= 100 })
            throw new ApiError(422, "voice.config.json benötigt version: 1 und 1 bis 100 sourceFiles-Muster.");
        foreach (var pattern in config.SourceFiles) ValidatePath(root, pattern);
        if (config.LiveUrl is not null) ProjectStore.ValidateLiveUrl(config.LiveUrl);
        foreach (var (route, source) in config.Routes ?? [])
        {
            if (!route.StartsWith('/') || route.StartsWith("//") || route.Contains('?') || route.Contains('#'))
                throw new ApiError(422, "sourceRoutes benötigen absolute Routenpfade ohne Query oder Fragment.");
            ValidatePath(root, source);
            if (source.Contains('*') || source.Contains('?') || !config.Includes(source) || !File.Exists(ProjectStore.Contained(root, source)))
                throw new ApiError(422, "Eine konfigurierte Route verweist nicht auf eine vorhandene, freigegebene Quelldatei.");
        }
        var validatedContexts = new HashSet<string>(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);
        foreach (var (source, contextFiles) in config.SourceContexts ?? [])
        {
            ValidatePath(root, source);
            if (!config.Includes(source) || contextFiles is null || contextFiles.Length > 10)
                throw new ApiError(422, "sourceContexts benötigen eine freigegebene Quelldatei und höchstens zehn Kontextdateien.");
            foreach (var context in contextFiles)
            {
                if (!validatedContexts.Add(context)) continue;
                ValidatePath(root, context);
                if (context.Contains('*') || context.Contains('?') ||
                    !(new[] { ".ts", ".html", ".scss", ".css", ".md" }).Contains(Path.GetExtension(context).ToLowerInvariant()) ||
                    !File.Exists(ProjectStore.Contained(root, context)))
                    throw new ApiError(422, "Komponentenkontext muss eine vorhandene, freigegebene Quelltextdatei im Projekt sein.");
            }
        }
        return config;
    }

    public bool Includes(string relative)
    {
        relative = relative.Replace('\\', '/');
        return SourceFiles.Any(pattern =>
        {
            var expression = Regex.Escape(pattern.Replace('\\', '/'))
                .Replace(@"\*\*/", "(?:.*/)?").Replace(@"\*\*", ".*").Replace(@"\*", "[^/]*").Replace(@"\?", "[^/]");
            return Regex.IsMatch(relative, "^" + expression + "$", OperatingSystem.IsWindows() ? RegexOptions.IgnoreCase : RegexOptions.None);
        });
    }

    private static void ValidatePath(string root, string path)
    {
        if (string.IsNullOrWhiteSpace(path) || Path.IsPathRooted(path) || path.Contains(':') ||
            path.Replace('\\', '/').Split('/').Any(s => s is "." or ".." || s.StartsWith('.')) || path.Any(char.IsControl))
            throw new ApiError(422, "sourceFiles und Routenquellen müssen innerhalb des Projekts liegen; versteckte Verzeichnisse sind ausgeschlossen.");
        var segments = path.Replace('\\', '/').Split('/');
        var prefix = string.Join('/', segments.TakeWhile(s => !s.Contains('*') && !s.Contains('?')));
        if (prefix.Length > 0) ProjectStore.Contained(root, prefix);
    }
}
