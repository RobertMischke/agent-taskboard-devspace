using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace VoiceStudio;

public record MappedUnit(TextUnit Unit, int[] Starts, int[] Ends);
public record ParsedDocument(MappedUnit[] MappedUnits, string Html, int ExcludedRegions, string Language)
{
    public TextUnit[] Units => MappedUnits.Select(x => x.Unit).ToArray();
    public SourceSpan MapSpan(string id, int start, int end)
    {
        var unit = MappedUnits.FirstOrDefault(x => x.Unit.Id == id) ?? throw new ApiError(400, "Textstelle ist nicht mehr vorhanden.");
        if (start < 0 || end <= start || end > unit.Unit.Text.Length) throw new ApiError(400, "Ungültige UTF-16-Auswahl.");
        if (start > 0 && char.IsLowSurrogate(unit.Unit.Text[start]) || end < unit.Unit.Text.Length && char.IsLowSurrogate(unit.Unit.Text[end]))
            throw new ApiError(400, "Auswahl teilt ein Unicode-Zeichen.");
        if (unit.Starts[start] < 0 || unit.Ends[end - 1] < 0) throw new ApiError(422, "Auswahl teilt eine HTML-Entity.");
        for (var i = start + 1; i < end; i++)
        {
            if (unit.Starts[i] != unit.Ends[i - 1])
                throw new ApiError(422, "Diese Auswahl überquert Markup oder einen Teil einer HTML-Entity. Bitte einen zusammenhängenden Textabschnitt wählen.");
        }
        return new(unit.Starts[start], unit.Ends[end - 1]);
    }
}

public static partial class DocumentParser
{
    private static readonly HashSet<string> SafeTags = new("main article section header footer nav aside h1 h2 h3 h4 h5 h6 p div span strong em b i ul ol li blockquote br hr a button label table thead tbody tr th td".Split(' '));
    private static readonly HashSet<string> ExcludedTags = new("script style template noscript svg math code pre textarea iframe object embed head".Split(' '));
    private static readonly string Style = "<style>body{font:17px/1.65 system-ui,sans-serif;color:#24352e;background:#fbfcf8;margin:0;padding:40px;max-width:1000px}h1,h2,h3{line-height:1.2}h1{font-size:42px}h2{font-size:29px}section,header{margin-bottom:28px}p{max-width:75ch}button{font:inherit;border:1px solid #9cac9e;border-radius:6px;background:#edf5e9;padding:9px 14px}a{color:inherit}[data-voice-unit]{text-decoration:underline;text-decoration-color:#b1c2af;text-decoration-thickness:1px;text-underline-offset:5px}code{background:#f0f0e9;padding:2px 5px}blockquote{border-left:3px solid #78957c;margin-left:0;padding-left:18px}</style>";

    public static ParsedDocument Parse(string source, string format)
    {
        return format == "html" ? Html(source) : format == "typescript" ? TypeScriptContentAdapter.Parse(source) : Markdown(source);
    }

    private static MappedUnit? Unit(string raw, int offset, string kind, string lang, int ordinal, bool decode, bool markdown)
    {
        var text = new StringBuilder();
        var starts = new List<int>();
        var ends = new List<int>();
        void Append(string value, int from, int length, bool identity)
        {
            for (var c = 0; c < value.Length; c++)
            {
                text.Append(value[c]);
                starts.Add(identity ? offset + from + c : c == 0 ? offset + from : -1);
                ends.Add(identity ? offset + from + c + 1 : c == value.Length - 1 ? offset + from + length : -1);
            }
        }
        for (var i = 0; i < raw.Length;)
        {
            if (markdown && raw[i] == '`')
            {
                var n = 1; while (i + n < raw.Length && raw[i + n] == '`') n++;
                var close = raw.IndexOf(new string('`', n), i + n, StringComparison.Ordinal);
                if (close >= 0) { i = close + n; continue; }
            }
            if (markdown && raw[i] == '<')
            {
                var close = raw.IndexOf('>', i + 1);
                if (close >= 0) { i = close + 1; continue; }
            }
            if (markdown && (raw[i] is '*' or '_' or '~' || raw[i] == '[' || raw[i] == '!' && i + 1 < raw.Length && raw[i + 1] == '[')) { i++; continue; }
            if (markdown && raw[i] == ']' && i + 1 < raw.Length && raw[i + 1] == '(')
            {
                var close = raw.IndexOf(')', i + 2);
                if (close >= 0) { i = close + 1; continue; }
            }
            if (markdown && raw[i] == '\\' && i + 1 < raw.Length)
            {
                Append(raw.Substring(i + 1, 1), i, 2, false); i += 2; continue;
            }
            if (decode && raw[i] == '&')
            {
                var semicolon = raw.IndexOf(';', i + 1);
                if (semicolon >= 0 && semicolon - i < 32)
                {
                    var entity = raw.Substring(i, semicolon - i + 1);
                    var decoded = WebUtility.HtmlDecode(entity);
                    if (entity != decoded) { Append(decoded, i, entity.Length, false); i = semicolon + 1; continue; }
                }
            }
            Append(raw.Substring(i, 1), i, 1, true); i++;
        }
        var fullText = text.ToString();
        var first = 0; while (first < fullText.Length && char.IsWhiteSpace(fullText[first])) first++;
        var last = fullText.Length; while (last > first && char.IsWhiteSpace(fullText[last - 1])) last--;
        if (first == last) return null;
        var from = starts[first]; var to = ends[last - 1];
        if (from < 0 || to < 0) return null;
        var unit = new TextUnit($"u-{ordinal}", fullText[first..last], new(from, to), kind, lang);
        return new(unit, starts.GetRange(first, last - first).ToArray(), ends.GetRange(first, last - first).ToArray());
    }

    private static ParsedDocument Html(string source)
    {
        var langMatch = Regex.Match(source, "<html\\b[^>]*\\blang\\s*=\\s*['\"](?<lang>[^'\"]+)", RegexOptions.IgnoreCase);
        var lang = langMatch.Success ? langMatch.Groups["lang"].Value : "de";
        var units = new List<MappedUnit>();
        var output = new StringBuilder(Style);
        var stack = new List<string>();
        var excluded = 0;
        var tokens = Regex.Matches(source, "<!--[\\s\\S]*?(?:-->|$)|<(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>|[^<]+|<", RegexOptions.CultureInvariant);
        foreach (Match token in tokens)
        {
            var raw = token.Value;
            if (raw.StartsWith('<'))
            {
                var tagMatch = Regex.Match(raw, @"^<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)");
                if (!tagMatch.Success) continue;
                var closing = tagMatch.Groups[1].Value == "/";
                var tag = tagMatch.Groups[2].Value.ToLowerInvariant();
                var wasExcluded = stack.Any(ExcludedTags.Contains);
                if (closing)
                {
                    var index = stack.LastIndexOf(tag);
                    if (index >= 0) stack.RemoveRange(index, stack.Count - index);
                    if (!wasExcluded && SafeTags.Contains(tag)) output.Append("</").Append(tag).Append('>');
                }
                else
                {
                    if (ExcludedTags.Contains(tag)) excluded++;
                    if (!wasExcluded && SafeTags.Contains(tag)) output.Append('<').Append(tag).Append('>');
                    if (!(new[] { "br", "hr", "img", "input", "meta", "link", "embed", "source", "area", "base", "wbr" }).Contains(tag) && !raw.EndsWith("/>")) stack.Add(tag);
                }
                continue;
            }
            if (stack.Any(ExcludedTags.Contains)) continue;
            var kind = stack.LastOrDefault(x => x is "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "p" or "li" or "button" or "blockquote") ?? "text";
            var mapped = Unit(raw, token.Index, kind, lang, units.Count, true, false);
            if (mapped is null) { output.Append(' '); continue; }
            units.Add(mapped);
            if (char.IsWhiteSpace(raw[0])) output.Append(' ');
            output.Append("<span data-voice-unit=\"").Append(mapped.Unit.Id).Append("\">").Append(WebUtility.HtmlEncode(mapped.Unit.Text)).Append("</span>");
            if (char.IsWhiteSpace(raw[^1])) output.Append(' ');
        }
        return new(units.ToArray(), PreviewRenderer.Html(source, units, lang), excluded, lang);
    }

    private static ParsedDocument Markdown(string source)
    {
        var units = new List<MappedUnit>();
        var output = new StringBuilder(Style);
        var explicitLanguage = Regex.Match(source, @"(?m)^lang(?:uage)?:\s*['""]?(de|en)\b", RegexOptions.IgnoreCase);
        var germanWords = Regex.Matches(source, @"\b(der|die|das|und|ein|eine|für|mit|wird|ist)\b", RegexOptions.IgnoreCase).Count;
        var englishWords = Regex.Matches(source, @"\b(the|and|this|with|for|is|are|your|you)\b", RegexOptions.IgnoreCase).Count;
        var lang = explicitLanguage.Success ? explicitLanguage.Groups[1].Value.ToLowerInvariant() : germanWords > englishWords ? "de" : "en";
        var inFence = false;
        var inFrontmatter = source.StartsWith("---\n") || source.StartsWith("---\r\n");
        var excluded = 0;
        var offset = 0;
        foreach (var segment in Regex.Matches(source, @"[^\r\n]*(?:\r\n|\n|\r|$)").Cast<Match>())
        {
            if (segment.Length == 0) continue;
            var line = segment.Value.TrimEnd('\r', '\n');
            offset = segment.Index;
            if (inFrontmatter) { if (offset > 0 && line.Trim() == "---") { inFrontmatter = false; excluded++; } continue; }
            if (Regex.IsMatch(line, @"^\s*(```|~~~)")) { inFence = !inFence; excluded++; continue; }
            if (inFence || line.StartsWith("    ") || Regex.IsMatch(line, @"^\s*(<!--|<script\b|<style\b)", RegexOptions.IgnoreCase)) { excluded++; continue; }
            if (string.IsNullOrWhiteSpace(line) || Regex.IsMatch(line, @"^\s*([-*_])(?:\s*\1){2,}\s*$")) continue;
            var prefix = Regex.Match(line, @"^\s{0,3}(?:(#{1,6})\s+|(?:[-+*]|\d+[.)])\s+|>\s*)");
            var kind = prefix.Groups[1].Success ? $"h{prefix.Groups[1].Length}" : prefix.Value.Contains('>') ? "blockquote" : "p";
            var content = line[prefix.Length..];
            if (kind.StartsWith('h')) content = Regex.Replace(content, @"\s+#+\s*$", "");
            if (content.Contains('`') || content.Contains('<')) excluded++;
            var mapped = Unit(content, offset + prefix.Length, kind, lang, units.Count, true, true);
            if (mapped is null) continue;
            units.Add(mapped);
            output.Append('<').Append(kind).Append("><span data-voice-unit=\"").Append(mapped.Unit.Id).Append("\">").Append(WebUtility.HtmlEncode(mapped.Unit.Text)).Append("</span></").Append(kind).Append('>');
        }
        return new(units.ToArray(), PreviewRenderer.Markdown(source, units, lang), excluded, lang);
    }

    public static Finding[] Analyze(TextUnit[] units)
    {
        var findings = new List<Finding>();
        void Add(TextUnit unit, string rule, string category, string message, string explanation, int start, int end, string? suggestion)
            => findings.Add(new($"{unit.Id}-{rule}-{start}", rule, category, category == "claims" ? "info" : "warning", message, explanation, unit.Text[start..end], unit.Id, start, end, suggestion));
        foreach (var unit in units)
        {
            if (unit.Kind.StartsWith('h') && unit.Kind.Length == 2 && unit.Text.EndsWith('.') && !unit.Text.EndsWith("..."))
                Add(unit, "heading-period", "structure", "Punkt am Ende der Überschrift", "Eine Überschrift braucht hier in der Regel keinen Schlusspunkt. Abkürzungen bitte im Kontext prüfen.", unit.Text.Length - 1, unit.Text.Length, "");
            foreach (Match match in Regex.Matches(unit.Text, @"\b(nahtlos(?:e[nmrs]?)?|revolutionär(?:e[nmrs]?)?|seamless(?:ly)?|game[- ]changer|leverage|ganzheitlich(?:e[nmrs]?)?|innovativ(?:e[nmrs]?)?|state[- ]of[- ]the[- ]art|powerful|effortless(?:ly)?|cutting[- ]edge|leistungsstark(?:e[nmrs]?)?|mühelos(?:e[nmrs]?)?)\b", RegexOptions.IgnoreCase))
                Add(unit, "stock-wording", "wording", "Allgemeines Werbewort", "Beschreibe eine beobachtbare Funktion oder einen konkreten Nutzen. Das Signal ist ein Review-Hinweis, kein Wortverbot.", match.Index, match.Index + match.Length, null);
            foreach (Match match in Regex.Matches(unit.Text, @"\b(wir (?:sind stolz|glauben|verstehen)|we (?:believe|are proud|understand)|es ist wichtig zu betonen|this page describes what exists|diese seite beschreibt)\b", RegexOptions.IgnoreCase))
                Add(unit, "self-attestation", "meta", "Selbstaussage statt Beleg", "Prüfe, ob der Satz etwas über das Produkt erklärt oder lediglich die Haltung des Anbieters behauptet.", match.Index, match.Index + match.Length, null);
            foreach (Match match in Regex.Matches(unit.Text, @"\b(garantiert|garantieren|guaranteed?|100\s*%|jede[nrms]?|alle[nrms]?|immer|never|always|\d+\s*%)(?!\w)", RegexOptions.IgnoreCase))
                Add(unit, "claim-evidence", "claims", "Aussage braucht Prüfung", "Advisory: Diese Regel kann den Wahrheitsgehalt nicht prüfen. Verknüpfe die konkrete Aussage im Review mit einem nachvollziehbaren Beleg.", match.Index, match.Index + match.Length, null);
        }
        return findings.ToArray();
    }
}
