using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace VoiceStudio;

/// <summary>Script-free source rendering; analysis/source mappings remain in DocumentParser.</summary>
public static class PreviewRenderer
{
    private static readonly HashSet<string> Tags = new("main article section header footer nav aside h1 h2 h3 h4 h5 h6 p div span strong em b i u s small sup sub ul ol li blockquote br hr a button label table thead tbody tr th td caption figure figcaption details summary dl dt dd code pre img".Split(' '));
    private static readonly HashSet<string> Drop = new("script template noscript svg math iframe object embed textarea select form style".Split(' '));
    private static readonly HashSet<string> Void = new("br hr img input meta link embed source area base wbr".Split(' '));
    private const string ReadingCss = "*{box-sizing:border-box}body{margin:0;padding:32px;color:#26332d;background:#fcfcf9;font:17px/1.7 system-ui,sans-serif}main{max-width:860px;margin:auto}h1,h2,h3{line-height:1.2}h1{font-size:38px}h2{font-size:27px;margin-top:32px}p{max-width:76ch}a{color:#235b7a}pre{padding:16px;background:#edf0ea;border-radius:8px;overflow:auto}code{font:14px/1.6 ui-monospace,monospace}blockquote{margin:20px 0;padding:12px 20px;background:#eef1ed}img{max-width:100%;height:auto}";
    private const string Csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'";
    private static string E(string value) => WebUtility.HtmlEncode(value);
    private static string Wrap(string body, string language, string css) => "<!doctype html><html lang=\"" + E(language) + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta http-equiv=\"Content-Security-Policy\" content=\"" + E(Csp) + "\"><style>" + css + "</style></head><body>" + body + "</body></html>";
    private static string SafeCss(string css) => Regex.Replace(Regex.Replace(css, @"@import\s[^;]*(?:;|$)", "", RegexOptions.IgnoreCase), @"url\s*\([^)]*\)", "none", RegexOptions.IgnoreCase).Replace("<", "\\3c ");
    private static bool SafeHref(string value) => !value.Any(char.IsControl) && (!value.Contains(':') || Regex.IsMatch(value, @"^(https?://|mailto:)", RegexOptions.IgnoreCase)) && !value.StartsWith("//");

    public static string Html(string source, IReadOnlyList<MappedUnit> units, string language)
    {
        var css = string.Join("\n", Regex.Matches(source, @"<style\b[^>]*>([\s\S]*?)</style\s*>", RegexOptions.IgnoreCase).Select(m => SafeCss(m.Groups[1].Value)));
        if (string.IsNullOrWhiteSpace(css)) css = ReadingCss;
        var output = new StringBuilder(); var stack = new List<string>(); var inHead = false;
        foreach (Match token in Regex.Matches(source, "<!--[\\s\\S]*?(?:-->|$)|<(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>|[^<]+|<"))
        {
            var raw = token.Value;
            if (raw.StartsWith('<'))
            {
                var m = Regex.Match(raw, @"^<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)");
                if (!m.Success) continue;
                var close = m.Groups[1].Value == "/"; var tag = m.Groups[2].Value.ToLowerInvariant();
                if (tag == "head") { inHead = !close; continue; }
                if (inHead) continue;
                var dropped = stack.Any(Drop.Contains);
                if (close)
                {
                    var index = stack.LastIndexOf(tag); if (index >= 0) stack.RemoveRange(index, stack.Count - index);
                    if (!dropped && Tags.Contains(tag) && !Void.Contains(tag)) output.Append("</").Append(tag).Append('>');
                }
                else
                {
                    if (!dropped && Tags.Contains(tag))
                    {
                        var attrs = Attributes(raw).ToDictionary(x => x.Key, x => x.Value);
                        if (tag == "img")
                        {
                            var src = attrs.GetValueOrDefault("src", "");
                            if (src.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) && !src.StartsWith("data:image/svg", StringComparison.OrdinalIgnoreCase)) output.Append("<img src=\"").Append(E(src)).Append("\" alt=\"").Append(E(attrs.GetValueOrDefault("alt", ""))).Append("\">");
                            else output.Append("<span data-voice-exclude>[").Append(E(attrs.GetValueOrDefault("alt", "Local image"))).Append("]</span>");
                        }
                        else
                        {
                            output.Append('<').Append(tag);
                            foreach (var (key, value) in attrs)
                            {
                                if (key is "class" or "id" or "title" or "lang" or "dir" or "colspan" or "rowspan" or "aria-label") output.Append(' ').Append(key).Append("=\"").Append(E(value)).Append('"');
                                else if (key == "style") output.Append(" style=\"").Append(E(SafeCss(value))).Append('"');
                                else if (key == "href" && tag == "a" && SafeHref(value)) output.Append(" href=\"").Append(E(value)).Append("\" data-voice-href=\"").Append(E(value)).Append('"');
                            }
                            if (tag == "button") output.Append(" type=\"button\"");
                            output.Append('>');
                        }
                    }
                    if (!Void.Contains(tag) && !raw.EndsWith("/>")) stack.Add(tag);
                }
                continue;
            }
            if (inHead || stack.Any(Drop.Contains)) continue;
            var cursor = token.Index;
            foreach (var unit in units.Where(u => u.Unit.SourceSpan.Start >= token.Index && u.Unit.SourceSpan.End <= token.Index + token.Length).OrderBy(u => u.Unit.SourceSpan.Start))
            {
                output.Append(source[cursor..unit.Unit.SourceSpan.Start]);
                output.Append("<span data-voice-unit=\"").Append(E(unit.Unit.Id)).Append("\">").Append(E(unit.Unit.Text)).Append("</span>");
                cursor = unit.Unit.SourceSpan.End;
            }
            output.Append(source[cursor..(token.Index + token.Length)]);
        }
        return Wrap(output.ToString(), language, css);
    }
    private static IEnumerable<KeyValuePair<string, string>> Attributes(string tag)
    {
        var seen = new HashSet<string>();
        foreach (Match m in Regex.Matches(tag, "([a-zA-Z][a-zA-Z0-9:_-]*)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))"))
        {
            var name = m.Groups[1].Value.ToLowerInvariant(); if (!seen.Add(name)) continue;
            yield return new(name, WebUtility.HtmlDecode(m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Success ? m.Groups[3].Value : m.Groups[4].Value));
        }
    }

    public static string Markdown(string source, IReadOnlyList<MappedUnit> units, string language)
    {
        var output = new StringBuilder("<main class=\"voice-markdown\">"); var fence = "";
        var frontmatter = source.StartsWith("---\n") || source.StartsWith("---\r\n"); string? listTag = null;
        void CloseList() { if (listTag is not null) { output.Append("</").Append(listTag).Append('>'); listTag = null; } }
        foreach (Match lm in Regex.Matches(source, @"[^\r\n]*(?:\r\n|\n|\r|$)"))
        {
            if (lm.Length == 0) continue; var line = lm.Value.TrimEnd('\r', '\n');
            if (frontmatter) { if (lm.Index > 0 && line.Trim() == "---") frontmatter = false; continue; }
            var f = Regex.Match(line, @"^\s*(`{3,}|~{3,})");
            if (f.Success)
            {
                CloseList(); if (fence.Length == 0) { fence = f.Value.Trim(); output.Append("<pre data-voice-exclude><code>"); }
                else if (f.Value.Trim()[0] == fence[0] && f.Value.Trim().Length >= fence.Length) { fence = ""; output.Append("</code></pre>"); }
                continue;
            }
            if (fence.Length > 0) { output.Append(E(line)).Append('\n'); continue; }
            if (string.IsNullOrWhiteSpace(line)) { CloseList(); continue; }
            var unit = units.FirstOrDefault(u => u.Unit.SourceSpan.Start >= lm.Index && u.Unit.SourceSpan.End <= lm.Index + lm.Length);
            if (unit is null) { CloseList(); if (line.StartsWith("    ")) output.Append("<pre data-voice-exclude><code>").Append(E(line[4..])).Append("</code></pre>"); continue; }
            var list = Regex.Match(line, @"^\s{0,3}([-+*]|\d+[.)])\s+"); var tag = unit.Unit.Kind;
            if (list.Success)
            {
                var wanted = char.IsDigit(list.Groups[1].Value[0]) ? "ol" : "ul";
                if (wanted != listTag) { CloseList(); listTag = wanted; output.Append('<').Append(listTag).Append('>'); } tag = "li";
            }
            else CloseList();
            var prefix = Regex.Match(line, @"^\s{0,3}(?:(#{1,6})\s+|(?:[-+*]|\d+[.)])\s+|>\s*)");
            var raw = line[prefix.Length..].Trim();
            if (tag.StartsWith('h')) raw = Regex.Replace(raw, @"\s+#+\s*$", "");
            output.Append('<').Append(tag).Append("><span data-voice-unit=\"").Append(E(unit.Unit.Id)).Append("\">").Append(Inline(raw)).Append("</span></").Append(tag).Append('>');
        }
        if (fence.Length > 0) output.Append("</code></pre>"); CloseList(); output.Append("</main>");
        return Wrap(output.ToString(), language, ReadingCss);
    }

    private static string Inline(string source)
    {
        var output = new StringBuilder();
        for (var i = 0; i < source.Length;)
        {
            if (source[i] == '&')
            {
                var semicolon = source.IndexOf(';', i + 1);
                if (semicolon >= 0 && semicolon - i < 32)
                {
                    var entity = source[i..(semicolon + 1)];
                    var decoded = WebUtility.HtmlDecode(entity);
                    if (entity != decoded) { output.Append(E(decoded)); i = semicolon + 1; continue; }
                }
            }
            if (char.IsHighSurrogate(source[i]) && i + 1 < source.Length && char.IsLowSurrogate(source[i + 1]))
            {
                output.Append(E(source.Substring(i, 2))); i += 2; continue;
            }
            if (source[i] == '`')
            {
                var n = 1; while (i + n < source.Length && source[i + n] == '`') n++;
                var end = source.IndexOf(new string('`', n), i + n, StringComparison.Ordinal);
                if (end >= 0) { output.Append("<code data-voice-exclude>").Append(E(source[(i + n)..end])).Append("</code>"); i = end + n; continue; }
            }
            if (source[i] == '\\' && i + 1 < source.Length) { output.Append(E(source.Substring(i + 1, 1))); i += 2; continue; }
            if (source[i] == '[')
            {
                var close = source.IndexOf("](", i, StringComparison.Ordinal); var end = close >= 0 ? source.IndexOf(')', close + 2) : -1;
                if (end >= 0) { var href = source[(close + 2)..end]; output.Append(SafeHref(href) ? "<a href=\"" + E(href) + "\" data-voice-href=\"" + E(href) + "\">" : "<span>"); output.Append(Inline(source[(i + 1)..close])).Append(SafeHref(href) ? "</a>" : "</span>"); i = end + 1; continue; }
            }
            if (source[i] is '*' or '_')
            {
                var n = i + 1 < source.Length && source[i + 1] == source[i] ? 2 : 1; var end = source.IndexOf(new string(source[i], n), i + n, StringComparison.Ordinal);
                if (end >= 0) { var tag = n == 2 ? "strong" : "em"; output.Append('<').Append(tag).Append('>').Append(Inline(source[(i + n)..end])).Append("</").Append(tag).Append('>'); i = end + n; continue; }
            }
            if (source[i] == '<') { var end = source.IndexOf('>', i + 1); if (end >= 0) { i = end + 1; continue; } }
            if (source[i] is '*' or '_' or '~' || source[i] == '!' && i + 1 < source.Length && source[i + 1] == '[') { i++; continue; }
            output.Append(E(source.Substring(i, 1))); i++;
        }
        return output.ToString();
    }
}
