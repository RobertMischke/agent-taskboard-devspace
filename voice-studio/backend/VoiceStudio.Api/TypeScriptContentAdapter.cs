using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;

namespace VoiceStudio;

public static class TypeScriptContentAdapter
{
    private sealed record ExtractedUnit(string Text, int Start, int End, int[] Starts, int[] Ends, string Kind, string Property);
    private sealed record Extraction(ExtractedUnit[] Units, int ExcludedRegions, string Language);
    private sealed record CachedDocument(ParsedDocument Document, int Characters);
    private static readonly object CacheGate = new();
    private static readonly Dictionary<string, CachedDocument> Cache = new(StringComparer.Ordinal);
    private static readonly Queue<string> CacheOrder = new();
    private static int cachedCharacters;
    private static int processInvocations;
    public static int ProcessInvocationCount => Volatile.Read(ref processInvocations);

    public static ParsedDocument Parse(string source)
    {
        lock (CacheGate)
        {
            var hash = ProjectStore.Hash(source);
            if (Cache.TryGetValue(hash, out var cached)) return cached.Document;
            var parsed = Render(ExtractBatch([source])[0]);
            AddCache(hash, parsed);
            return parsed;
        }
    }

    /// <summary>One parser process handles a cold project batch; cached source hashes require no process.</summary>
    public static void Warm(IEnumerable<string> sources)
    {
        lock (CacheGate)
        {
            var batch = new List<(string Hash, string Source)>();
            var pending = new HashSet<string>(StringComparer.Ordinal);
            var characters = 0;
            void Flush()
            {
                if (batch.Count == 0) return;
                var extracted = ExtractBatch(batch.Select(item => item.Source).ToArray());
                for (var index = 0; index < batch.Count; index++) AddCache(batch[index].Hash, Render(extracted[index]));
                batch.Clear(); pending.Clear(); characters = 0;
            }
            foreach (var source in sources)
            {
                var hash = ProjectStore.Hash(source);
                if (Cache.ContainsKey(hash) || pending.Contains(hash)) continue;
                if (batch.Count >= 64 || batch.Count > 0 && characters + source.Length > 2_000_000) Flush();
                batch.Add((hash, source)); pending.Add(hash); characters += source.Length;
            }
            Flush();
        }
    }

    private static void AddCache(string hash, ParsedDocument parsed)
    {
        if (Cache.ContainsKey(hash)) return;
        var characters = parsed.MappedUnits.Sum(unit => unit.Unit.Text.Length);
        Cache.Add(hash, new(parsed, characters)); CacheOrder.Enqueue(hash); cachedCharacters += characters;
        while (Cache.Count > 256 || cachedCharacters > 2_000_000 && Cache.Count > 1)
        {
            var oldest = CacheOrder.Dequeue();
            if (Cache.Remove(oldest, out var removed)) cachedCharacters -= removed.Characters;
        }
    }

    private static Extraction[] ExtractBatch(string[] sources)
    {
        var start = new ProcessStartInfo("node") { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        start.ArgumentList.Add(FindScript());
        using var process = new Process { StartInfo = start };
        try { process.Start(); Interlocked.Increment(ref processInvocations); }
        catch (Win32Exception) { throw new ApiError(503, "Der TypeScript-Quelladapter benötigt Node.js und die installierten Workspace-Abhängigkeiten."); }
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        process.StandardInput.Write(JsonSerializer.Serialize(new { sources }));
        process.StandardInput.Close();
        if (!process.WaitForExit(30000))
        {
            process.Kill(true);
            throw new ApiError(422, "Der TypeScript-Quelladapter hat sein Zeitlimit überschritten.");
        }
        var stderr = error.GetAwaiter().GetResult();
        if (process.ExitCode != 0)
            throw new ApiError(422, stderr.Contains("TypeScript syntax error") ? "Eine TypeScript-Datei enthält Syntaxfehler. Kein Quellvorschlag wird angewendet." : "TypeScript-Inhalte konnten nicht sicher extrahiert werden. Node.js, npm install und die Adaptergrenzen prüfen.");
        Extraction[] extracted;
        try { extracted = JsonSerializer.Deserialize<Extraction[]>(output.GetAwaiter().GetResult(), ProjectStore.Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiError(422, "Ungültige Antwort des TypeScript-Quelladapters."); }
        if (extracted.Length != sources.Length) throw new ApiError(422, "Die TypeScript-Batchantwort ist unvollständig.");
        return extracted;
    }

    private static ParsedDocument Render(Extraction extracted)
    {
        var units = extracted.Units.Select((unit, index) => new MappedUnit(
            new TextUnit("ts-u-" + index, unit.Text, new(unit.Start, unit.End), unit.Kind, extracted.Language),
            unit.Starts, unit.Ends)).ToArray();
        var html = new StringBuilder("<!doctype html><html><head><meta charset=\"utf-8\"><style>body{font:17px/1.65 system-ui,sans-serif;padding:32px;color:#26352d;background:#fcfcf9}small{color:#607068}section{margin-bottom:24px}h1,h2{font-size:24px;line-height:1.3}</style></head><body>");
        for (var i = 0; i < units.Length; i++)
        {
            var unit = units[i].Unit;
            html.Append("<section><small>").Append(WebUtility.HtmlEncode(extracted.Units[i].Property)).Append("</small><")
                .Append(unit.Kind).Append("><span data-voice-unit=\"").Append(unit.Id).Append("\">")
                .Append(WebUtility.HtmlEncode(unit.Text)).Append("</span></").Append(unit.Kind).Append("></section>");
        }
        html.Append("</body></html>");
        return new ParsedDocument(units, html.ToString(), extracted.ExcludedRegions, extracted.Language);
    }

    public static string EscapeReplacement(string replacement, char quote)
    {
        if (quote is not ('\'' or '"' or (char)96)) throw new ApiError(422, "Unbekannter TypeScript-String-Begrenzer.");
        var output = new StringBuilder();
        for (var i = 0; i < replacement.Length; i++)
        {
            var ch = replacement[i];
            if (ch == '\\' || ch == quote) output.Append('\\').Append(ch);
            else if (quote == (char)96 && ch == '$' && i + 1 < replacement.Length && replacement[i + 1] == '{') output.Append("\\$");
            else if (ch == '\n') output.Append("\\n");
            else if (ch == '\r') output.Append("\\r");
            else if (ch == '\t') output.Append("\\t");
            else if (char.IsControl(ch) || ch is '\u2028' or '\u2029') output.Append("\\u").Append(((int)ch).ToString("x4"));
            else output.Append(ch);
        }
        return output.ToString();
    }

    private static string FindScript()
    {
        var local = Path.Combine(AppContext.BaseDirectory, "TypeScriptExtractor.mjs");
        if (File.Exists(local)) return local;
        foreach (var initial in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var current = new DirectoryInfo(initial);
            while (current is not null)
            {
                var candidate = Path.Combine(current.FullName, "backend", "VoiceStudio.Api", "TypeScriptExtractor.mjs");
                if (File.Exists(candidate)) return candidate;
                current = current.Parent;
            }
        }
        throw new ApiError(503, "TypeScript-Quelladapter ist in dieser Installation nicht vorhanden.");
    }
}
