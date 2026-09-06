using System.Text.Json;
using System.Text.RegularExpressions;

namespace VoiceStudio;

public sealed record LocalRule(string Id, string Title, string Category, string Message, string? Pattern, string Explanation);

/// <summary>One versioned rule definition feeds both the analyzer and the explanatory wiki.</summary>
public static class RuleCatalog
{
    private sealed record Knowledge(string Version, LocalRule[] Rules);
    private static readonly Knowledge Data = JsonSerializer.Deserialize<Knowledge>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "rules.json")),
        new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new InvalidDataException("Voice rule catalogue is missing.");
    public static string Version => Data.Version;
    public static IReadOnlyList<LocalRule> Rules => Data.Rules;

    public static Finding[] Analyze(TextUnit[] units)
    {
        var findings = new List<Finding>();
        foreach (var unit in units)
        foreach (var rule in Rules)
        {
            void Add(int start, int end, string? suggestion = null)
            {
                var quote = unit.Text[start..end];
                findings.Add(new($"{unit.Id}-{rule.Id}-{start}", rule.Id, rule.Category,
                    rule.Category == "claims" ? "info" : "warning", rule.Message,
                    rule.Explanation.Replace("{quote}", quote, StringComparison.Ordinal),
                    quote, unit.Id, start, end, suggestion));
            }
            if (rule.Id == "heading-period")
            {
                if (unit.Kind.StartsWith('h') && unit.Kind.Length == 2 && unit.Text.EndsWith('.') && !unit.Text.EndsWith("..."))
                    Add(unit.Text.Length - 1, unit.Text.Length, "");
            }
            else if (rule.Pattern is not null)
            {
                foreach (Match match in Regex.Matches(unit.Text, rule.Pattern, RegexOptions.IgnoreCase))
                    Add(match.Index, match.Index + match.Length);
            }
        }
        return findings.ToArray();
    }
}
