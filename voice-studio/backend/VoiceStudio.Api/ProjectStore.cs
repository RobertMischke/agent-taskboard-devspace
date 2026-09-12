using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VoiceStudio;

public sealed partial class ProjectStore
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private readonly string runtime;
    private readonly object gate = new();
    private readonly List<RegisteredProject> projects;
    private static readonly HashSet<string> ExcludedDirectories = new(StringComparer.OrdinalIgnoreCase) { ".git", ".voice-lint", ".voice-studio", "node_modules", "bin", "obj", "dist", ".angular", ".next", "vendor" };
    private static readonly UTF8Encoding Utf8 = new(false, true);

    public ProjectStore(string home, bool addExamples = true)
    {
        runtime = Path.Combine(home, ".voice-studio");
        Directory.CreateDirectory(runtime);
        EnsureNoLinks(runtime);
        var registry = Path.Combine(runtime, "projects.json");
        projects = File.Exists(registry) ? ReadJson<List<RegisteredProject>>(registry) : [];
        if (addExamples)
        {
            AddExample(home, "quality-website", "Quality Studio · Beispielwebsite");
            AddExample(home, "markdown-handbook", "Voice Handbook · Markdown");
        }
    }

    private void AddExample(string home, string directory, string name)
    {
        var root = Path.Combine(home, "examples", directory);
        if (Directory.Exists(root) && !projects.Any(p => string.Equals(p.Root, root, StringComparison.OrdinalIgnoreCase)))
        {
            projects.Add(new(directory, name, Path.GetFullPath(root), directory == "quality-website" ? "http://127.0.0.1:5189/index.html" : null));
            SaveRegistry();
        }
        else if (directory == "quality-website")
        {
            var existing = projects.FindIndex(p => string.Equals(p.Root, root, StringComparison.OrdinalIgnoreCase));
            if (existing >= 0 && projects[existing].LiveUrl is null)
            {
                projects[existing] = projects[existing] with { LiveUrl = "http://127.0.0.1:5189/index.html" };
                SaveRegistry();
            }
        }
    }

    public ProjectSummary SetBrowser(string projectId, BrowserInput input)
    {
        lock (gate)
        {
            var liveUrl = ValidateLiveUrl(input.Url);
            var project = Project(projectId);
            var updated = project with { LiveUrl = liveUrl };
            projects[projects.IndexOf(project)] = updated;
            SaveRegistry();
            return Summary(updated);
        }
    }

    public static string ValidateLiveUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url) || url.Length > 4096 ||
            !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https") || !string.IsNullOrEmpty(uri.UserInfo))
            throw new ApiError(400, "Bitte eine absolute lokale HTTP(S)-Adresse ohne eingebettete Zugangsdaten angeben.");
        if (uri.Host.Trim('[', ']').ToLowerInvariant() is not ("localhost" or "127.0.0.1" or "::1"))
            throw new ApiError(400, "Die lokale Website muss auf localhost, 127.0.0.1 oder ::1 laufen. Externe Hosts werden nicht verbunden.");
        if (uri.Port is 4188 or 5188)
            throw new ApiError(400, "Die Website benötigt einen anderen Origin als Voice Studio. Bitte den eigenen Entwicklungsserver angeben.");
        return uri.AbsoluteUri;
    }

    private void SaveRegistry() => AtomicWrite(Path.Combine(runtime, "projects.json"), JsonSerializer.Serialize(projects, Json));

    public ProjectSummary Register(RegisterInput input)
    {
        lock (gate)
        {
            if (string.IsNullOrWhiteSpace(input.Path) || !Path.IsPathFullyQualified(input.Path)) throw new ApiError(400, "Bitte einen absoluten lokalen Projektpfad angeben.");
            var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(input.Path));
            if (root.StartsWith(@"\\") || root.StartsWith("//")) throw new ApiError(400, "Netzwerkfreigaben sind nicht unterstützt.");
            if (!Directory.Exists(root)) throw new ApiError(404, "Projektordner nicht gefunden.");
            if (Path.GetPathRoot(root) == root) throw new ApiError(400, "Bitte einen Projektordner wählen, kein Laufwerksverzeichnis.");
            EnsureNoLinks(root);
            var existing = projects.FirstOrDefault(p => string.Equals(p.Root, root, StringComparison.OrdinalIgnoreCase));
            if (existing is not null) return Summary(existing);
            var project = new RegisteredProject("project-" + Hash(root)[..12], string.IsNullOrWhiteSpace(input.Name) ? Path.GetFileName(root) : input.Name.Trim(), root);
            if (Documents(project).Length == 0) throw new ApiError(400, "Der Ordner enthält keine unterstützten .html-, .md- oder .markdown-Dateien.");
            projects.Add(project);
            SaveRegistry();
            return Summary(project);
        }
    }

    public void Unregister(string id)
    {
        lock (gate)
        {
            var project = Project(id);
            projects.Remove(project);
            SaveRegistry();
        }
    }
    public ProjectSummary[] ListProjects() { lock (gate) return projects.Select(Summary).ToArray(); }
    private ProjectSummary Summary(RegisteredProject project)
    {
        var config = VoiceProjectConfig.Read(project.Root);
        return new(project.Id, project.Name, "Lokales Quellprojekt", Documents(project, config).Length, project.LiveUrl ?? config?.LiveUrl, config?.Routes, config?.SourceContexts);
    }
    private RegisteredProject Project(string id) => projects.FirstOrDefault(p => p.Id == id) ?? throw new ApiError(404, "Projekt nicht gefunden.");

    private SourceDocument[] Documents(RegisteredProject project, VoiceProjectConfig? config = null)
    {
        EnsureNoLinks(project.Root);
        config ??= VoiceProjectConfig.Read(project.Root);
        var result = new List<SourceDocument>();
        void Visit(string directory, int depth)
        {
            if (depth > 20) return;
            foreach (var path in Directory.EnumerateFileSystemEntries(directory).OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
            {
                var attrs = File.GetAttributes(path);
                if ((attrs & FileAttributes.ReparsePoint) != 0) continue;
                if ((attrs & FileAttributes.Directory) != 0)
                {
                    if (!ExcludedDirectories.Contains(Path.GetFileName(path))) Visit(path, depth + 1);
                    continue;
                }
                if (!(new[] { ".html", ".htm", ".md", ".markdown", ".ts" }).Contains(Path.GetExtension(path).ToLowerInvariant())) continue;
                var relative = Path.GetRelativePath(project.Root, path).Replace('\\', '/');
                if (config is not null && !config.Includes(relative) || config is null && Path.GetExtension(path).Equals(".ts", StringComparison.OrdinalIgnoreCase)) continue;
                result.Add(new("doc-" + Hash(relative)[..16], relative, path));
                if (result.Count > 2000) throw new ApiError(422, "Projekt enthält mehr als 2000 Dokumente. Bitte einen kleineren Projektordner registrieren.");
            }
        }
        Visit(project.Root, 0);
        return result.ToArray();
    }

    private SourceDocument Document(RegisteredProject project, string id) => Documents(project).FirstOrDefault(d => d.Id == id) ?? throw new ApiError(404, "Dokument nicht gefunden.");
    private string MetadataPath(RegisteredProject project, SourceDocument document)
    {
        var folder = Contained(project.Root, ".voice-lint/reviews");
        Directory.CreateDirectory(folder);
        EnsureNoLinks(folder);
        return Path.Combine(folder, document.Id + ".voice-meta.json");
    }
    private ReviewFile Review(RegisteredProject project, SourceDocument document)
    {
        var path = MetadataPath(project, document);
        return File.Exists(path) ? ReadJson<ReviewFile>(path) : new() { DocumentPath = document.RelativePath };
    }
    public static string UnitsFingerprint(TextUnit[] units) => Hash(JsonSerializer.Serialize(units, Json));
    private void SaveReview(RegisteredProject project, SourceDocument document, ReviewFile review)
    {
        var source = ReadSource(document.FullPath).Source;
        var format = Path.GetExtension(document.FullPath).ToLowerInvariant() switch { ".ts" => "typescript", ".html" or ".htm" => "html", _ => "markdown" };
        review.UnitsFingerprint = UnitsFingerprint(DocumentParser.Parse(source, format).Units);
        AtomicWrite(MetadataPath(project, document), JsonSerializer.Serialize(review, Json));
    }

    public ReviewRunContext GetReviewRunContext(string projectId, string documentId, string expectedVersion)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var detail = Detail(project, documentId);
            CheckVersion(detail.Version, expectedVersion);
            var config = VoiceProjectConfig.Read(project.Root);
            var context = new List<ContextSource>();
            var remaining = 120000;
            if (config?.SourceContexts?.TryGetValue(detail.Path, out var paths) == true)
            {
                foreach (var path in paths)
                {
                    var (source, _) = ReadSource(Contained(project.Root, path));
                    var take = Math.Min(source.Length, Math.Min(32000, remaining));
                    context.Add(new(path, source[..take], take < source.Length, Hash(source)));
                    remaining -= take;
                }
            }
            return new(project.Root, detail, context.ToArray());
        }
    }

    public DocumentDetail GetDocument(string projectId, string documentId)
    {
        lock (gate) return Detail(Project(projectId), documentId);
    }
    public DocumentSummary[] ListDocuments(string projectId)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var documents = Documents(project);
            WarmTypeScript(documents);
            return documents.Select(d => ToSummary(Detail(project, d.Id, d))).ToArray();
        }
    }
    public ProjectReport Report(string projectId)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var documents = Documents(project);
            WarmTypeScript(documents);
            var details = documents.Select(d => Detail(project, d.Id, d)).ToArray();
            var findings = details.SelectMany(d => d.Findings).ToArray();
            return new(projectId, details.Select(ToSummary).ToArray(), details.Sum(d => d.WordCount), findings.Length, details.Sum(d => d.OpenFeedbackCount), findings.GroupBy(f => f.Category).ToDictionary(g => g.Key, g => g.Count()), findings.GroupBy(f => f.RuleId).ToDictionary(g => g.Key, g => g.Count()));
        }
    }
    private static void WarmTypeScript(SourceDocument[] documents)
        => TypeScriptContentAdapter.Warm(documents.Where(d => Path.GetExtension(d.FullPath).Equals(".ts", StringComparison.OrdinalIgnoreCase)).Select(d => ReadSource(d.FullPath).Source));

    private static DocumentSummary ToSummary(DocumentDetail d) => new(d.Id, d.Path, d.Title, d.Format, d.Language, d.Version, d.WordCount, d.FindingCount, d.OpenFeedbackCount);

    private DocumentDetail Detail(RegisteredProject project, string documentId, SourceDocument? knownDocument = null)
    {
        var doc = knownDocument ?? Document(project, documentId);
        var (source, _) = ReadSource(doc.FullPath);
        var version = Hash(source);
        var format = Path.GetExtension(doc.FullPath).Equals(".ts", StringComparison.OrdinalIgnoreCase) ? "typescript" : Path.GetExtension(doc.FullPath).StartsWith(".ht", StringComparison.OrdinalIgnoreCase) ? "html" : "markdown";
        var parsed = DocumentParser.Parse(source, format);
        var review = Review(project, doc);
        // Recovery may persist proposal state; retain the pre-recovery mapping
        // comparison so that persistence cannot conceal an adapter migration.
        var needsReanchor = review.SourceVersion != "" && (review.SourceVersion != version || review.UnitsFingerprint != UnitsFingerprint(parsed.Units));
        RecoverTransactions(project, doc, review, version);
        if (needsReanchor)
        {
            Reanchor(review, parsed, version);
            SaveReview(project, doc, review);
        }
        var findings = DocumentParser.Analyze(parsed.Units);
        var title = parsed.Units.FirstOrDefault(u => u.Kind == "h1")?.Text ?? Path.GetFileName(doc.RelativePath);
        var notes = new List<string> {
            "Lokale deterministische Regeln v0; kein vollständiges Voice-Profil und keine semantische KI-Prüfung.",
            "Aussagenprüfung ist advisory und bestätigt keine Fakten. Kein numerischer Voice-Score.",
            "Die statische Dokumentvorschau ist bereinigt. Im Live-Browser läuft die verbundene Website mit ihren eigenen Scripts; geprüft werden die unterstützten Textstellen der registrierten Quelldatei.",
            "Quelltextbereiche und Auswahlpositionen zählen UTF-16-Codeeinheiten. Projektberichte umfassen HTML/Markdown sowie explizit konfigurierte TypeScript-Content-Dateien. Ausführbarer Frameworkcode und Übersetzungs-Dictionaries werden nicht analysiert.",
            "HTML-Attribute (z. B. alt/title) sind nicht Teil der Textprüfung; Markdown-Vorschau ist vereinfacht."
        };
        if (format == "typescript") notes.Add("TypeScript-Quelladapter: Nur freigegebene Content-Dateien und Textliterale aus exportierten Objekt-/Arraywerten werden geprüft. Importierte Werte, Funktionen, interpolierte Templates, URLs und technische Schlüssel sind ausgeschlossen. Keine vollständige Komponenten- oder Laufzeitanalyse.");
        if (source.Contains("data-i18n", StringComparison.OrdinalIgnoreCase)) notes.Add("data-i18n erkannt: Der Quelltextbericht erfasst nur statische Fallback-Texte. Übersetzungs-Dictionaries werden nicht analysiert; Änderungen an gebundenen Textstellen sind gesperrt.");
        return new(doc.Id, doc.RelativePath, title, format, parsed.Language, version, parsed.Units.Sum(u => Regex.Matches(u.Text, @"\S+").Count), findings.Length, review.Feedback.Count(f => f.Status != "resolved"), source, parsed.Html, parsed.Units, findings, review.Feedback.ToArray(), review.Revision, new(parsed.Units.Length, parsed.Units.Length, parsed.ExcludedRegions, notes.ToArray()), CurrentDecisions(review, version, parsed.Units));
    }

    private static void Reanchor(ReviewFile review, ParsedDocument parsed, string version)
    {
        review.Decisions = review.Decisions.Select(decision => decision with { Status = "stale" }).ToList();
        review.Feedback = review.Feedback.Select(feedback =>
        {
            var matches = new List<(TextUnit Unit, int Start)>();
            foreach (var unit in parsed.Units)
            {
                var start = 0;
                while (start < unit.Text.Length && (start = unit.Text.IndexOf(feedback.Quote, start, StringComparison.Ordinal)) >= 0)
                {
                    var before = unit.Text[..start];
                    var after = unit.Text[(start + feedback.Quote.Length)..];
                    if (before.EndsWith(feedback.Prefix ?? "", StringComparison.Ordinal) && after.StartsWith(feedback.Suffix ?? "", StringComparison.Ordinal))
                        matches.Add((unit, start));
                    start += Math.Max(1, feedback.Quote.Length);
                }
            }
            if (matches.Count == 1)
            {
                var (unit, start) = matches[0];
                return feedback with { UnitId = unit.Id, Start = start, End = start + feedback.Quote.Length, Status = "needs_recheck", UpdatedAt = Now() };
            }
            return feedback with { Status = "needs_reattachment", UpdatedAt = Now() };
        }).ToList();
        review.SourceVersion = version;
        review.Revision++;
    }

    public DocumentDetail SaveFeedback(string projectId, string documentId, FeedbackInput input)
    {
        lock (gate)
        {
            var project = Project(projectId);
            var detail = Detail(project, documentId);
            var doc = Document(project, documentId);
            var review = Review(project, doc);
            ValidateRequestId(input.RequestId);
            var fingerprint = Hash(JsonSerializer.Serialize(input, Json));
            if (Duplicate(review, "feedback:" + input.RequestId, fingerprint)) return detail;
            CheckVersion(detail.Version, input.ExpectedVersion);
            CheckReview(review, input.ExpectedReviewRevision);
            var unit = detail.Units.FirstOrDefault(u => u.Id == input.UnitId) ?? throw new ApiError(400, "Textstelle nicht gefunden.");
            if (input.Start < 0 || input.End <= input.Start || input.End > unit.Text.Length || unit.Text[input.Start..input.End] != input.Quote) throw new ApiError(400, "Auswahl und Zitat stimmen nicht überein.");
            if (string.IsNullOrWhiteSpace(input.Comment) || input.Comment.Length > 12000) throw new ApiError(400, "Feedback benötigt einen Kommentar mit höchstens 12000 Zeichen.");
            var feedback = new Feedback(Guid.NewGuid().ToString("N"), unit.Id, input.Quote, unit.Text[Math.Max(0, input.Start - 40)..input.Start], unit.Text[input.End..Math.Min(unit.Text.Length, input.End + 40)], input.Start, input.End, input.Comment.Trim(), string.IsNullOrWhiteSpace(input.Category) ? "wording" : input.Category, "open", detail.Version, Now(), Now());
            review.Feedback.Add(feedback);
            review.RequestIds["feedback:" + input.RequestId] = fingerprint;
            review.SourceVersion = detail.Version;
            review.Revision++;
            SaveReview(project, doc, review);
            return Detail(project, documentId);
        }
    }

    public DocumentDetail SetFeedbackStatus(string projectId, string documentId, string feedbackId, FeedbackStatusInput input)
    {
        lock (gate)
        {
            var project = Project(projectId); Detail(project, documentId);
            var doc = Document(project, documentId); var review = Review(project, doc);
            CheckReview(review, input.ExpectedReviewRevision);
            if (!(new[] { "open", "resolved", "needs_recheck", "needs_reattachment" }).Contains(input.Status)) throw new ApiError(400, "Unbekannter Feedbackstatus.");
            var index = review.Feedback.FindIndex(f => f.Id == feedbackId);
            if (index < 0) throw new ApiError(404, "Feedback nicht gefunden.");
            review.Feedback[index] = review.Feedback[index] with { Status = input.Status, UpdatedAt = Now() };
            review.Revision++; SaveReview(project, doc, review);
            return Detail(project, documentId);
        }
    }

    public Proposal[] ListProposals(string projectId, string documentId)
    {
        lock (gate)
        {
            var project = Project(projectId); Detail(project, documentId);
            return Review(project, Document(project, documentId)).Proposals.AsEnumerable().Reverse().ToArray();
        }
    }
    public ImprovementRequest[] ListRequests(string projectId, string documentId)
    {
        lock (gate)
        {
            var project = Project(projectId); Detail(project, documentId);
            return Review(project, Document(project, documentId)).ImprovementRequests.AsEnumerable().Reverse().ToArray();
        }
    }

    public Proposal CreateProposal(string projectId, string documentId, ProposalInput input)
    {
        lock (gate)
        {
            var project = Project(projectId); var detail = Detail(project, documentId);
            CheckVersion(detail.Version, input.ExpectedVersion);
            if (input.Replacement is null || input.Replacement.Length > 50000) throw new ApiError(400, "Ersatztext ist ungültig oder zu lang.");
            var parsed = DocumentParser.Parse(detail.Source, detail.Format);
            var (span, replacement) = MapReplacement(detail, parsed, input.UnitId, input.Start, input.End, input.Replacement);
            var unit = detail.Units.First(u => u.Id == input.UnitId);
            var after = detail.Source[..span.Start] + replacement + detail.Source[span.End..];
            if (detail.Format == "typescript") TypeScriptContentAdapter.Parse(after);
            var doc = Document(project, documentId); var review = Review(project, doc);
            if (input.FeedbackId is not null && !review.Feedback.Any(f => f.Id == input.FeedbackId)) throw new ApiError(404, "Zugehöriges Feedback nicht gefunden.");
            var proposal = new Proposal(Guid.NewGuid().ToString("N"), documentId, unit.Text[input.Start..input.End], input.Replacement, input.Replacement, detail.Source, after, detail.Version, span, input.FeedbackId, "Manueller Textvorschlag; Anwendung erfolgt erst nach bestätigtem Quelldiff.", "pending");
            review.Proposals.Add(proposal); review.SourceVersion = detail.Version;
            SaveReview(project, doc, review);
            return proposal;
        }
    }

    public DocumentDetail ApplyProposal(string projectId, string documentId, string proposalId, ApplyInput input, string? taskId = null)
    {
        lock (gate)
        {
            var project = Project(projectId); var detail = Detail(project, documentId);
            var doc = Document(project, documentId); var review = Review(project, doc);
            var index = review.Proposals.FindIndex(p => p.Id == proposalId);
            if (index < 0) throw new ApiError(404, "Vorschlag nicht gefunden.");
            var proposal = review.Proposals[index];
            if (!Regex.IsMatch(proposal.Id, @"^[a-f0-9]{32}$")) throw new ApiError(409, "Ungültige Vorschlags-ID in gespeicherten Metadaten.");
            if (proposal.TaskId is not null && proposal.TaskId != taskId) throw new ApiError(409, "Task-Vorschläge werden über den zugehörigen Task und dessen aktuelle Revision übernommen.");
            if (proposal.State == "applied" && detail.Version == Hash(proposal.SourceAfter)) return detail;
            CheckVersion(detail.Version, input.ExpectedVersion); CheckVersion(detail.Version, proposal.ExpectedVersion);
            if (proposal.State != "pending") throw new ApiError(409, "Vorschlag kann nicht erneut angewendet werden.");
            var (current, bom) = ReadSource(doc.FullPath); CheckVersion(Hash(current), proposal.ExpectedVersion);
            var backups = Contained(project.Root, ".voice-lint/backups/" + doc.Id); Directory.CreateDirectory(backups); EnsureNoLinks(backups);
            var backup = Contained(project.Root, ".voice-lint/backups/" + doc.Id + "/" + proposal.Id + Path.GetExtension(doc.FullPath));
            if (!File.Exists(backup)) WriteSource(backup, current, bom);
            var journalPath = Contained(project.Root, ".voice-lint/transactions/" + doc.Id + "-" + proposal.Id + ".json");
            Directory.CreateDirectory(Path.GetDirectoryName(journalPath)!); EnsureNoLinks(Path.GetDirectoryName(journalPath)!);
            var journal = new ApplyJournal(doc.Id, proposal.Id, proposal.ExpectedVersion, Hash(proposal.SourceAfter), backup, "pending");
            AtomicWrite(journalPath, JsonSerializer.Serialize(journal, Json));
            EnsureNoLinks(doc.FullPath);
            CheckVersion(Hash(ReadSource(doc.FullPath).Source), proposal.ExpectedVersion);
            WriteSource(doc.FullPath, proposal.SourceAfter, bom);
            review.Proposals[index] = proposal with { State = "applied" };
            Reanchor(review, DocumentParser.Parse(proposal.SourceAfter, detail.Format), journal.AfterVersion);
            SaveReview(project, doc, review);
            AtomicWrite(journalPath, JsonSerializer.Serialize(journal with { State = "completed" }, Json));
            return Detail(project, documentId);
        }
    }

    private record ApplyJournal(string DocumentId, string ProposalId, string BeforeVersion, string AfterVersion, string BackupPath, string State);
    private void RecoverTransactions(RegisteredProject project, SourceDocument doc, ReviewFile review, string version)
    {
        var folder = Contained(project.Root, ".voice-lint/transactions");
        if (!Directory.Exists(folder)) return;
        EnsureNoLinks(folder);
        foreach (var path in Directory.EnumerateFiles(folder, doc.Id + "-*.json"))
        {
            EnsureNoLinks(path);
            var journal = ReadJson<ApplyJournal>(path);
            if (journal.State != "pending") continue;
            if (version == journal.AfterVersion)
            {
                var index = review.Proposals.FindIndex(p => p.Id == journal.ProposalId);
                if (index >= 0) review.Proposals[index] = review.Proposals[index] with { State = "applied" };
                SaveReview(project, doc, review);
                AtomicWrite(path, JsonSerializer.Serialize(journal with { State = "completed" }, Json));
            }
            else if (version == journal.BeforeVersion) AtomicWrite(path, JsonSerializer.Serialize(journal with { State = "unapplied" }, Json));
            else throw new ApiError(409, "Unterbrochene Quelländerung erkannt. Quelle und Sicherung in .voice-lint/backups bitte prüfen; keine automatische Überschreibung.");
        }
    }

    public ImprovementRequest CreateRequest(string projectId, string documentId, ImprovementInput input)
    {
        lock (gate)
        {
            var project = Project(projectId); var detail = Detail(project, documentId);
            var doc = Document(project, documentId); var review = Review(project, doc);
            ValidateRequestId(input.RequestId);
            var fingerprint = Hash(JsonSerializer.Serialize(input, Json));
            if (Duplicate(review, "improvement:" + input.RequestId, fingerprint)) return review.ImprovementRequests.First(r => r.Id == input.RequestId);
            CheckVersion(detail.Version, input.ExpectedVersion);
            if (string.IsNullOrWhiteSpace(input.Instruction) || input.Instruction.Length > 12000) throw new ApiError(400, "Bitte einen Arbeitsauftrag mit höchstens 12000 Zeichen angeben.");
            if (input.FeedbackIds is null || input.FeedbackIds.Any(id => !review.Feedback.Any(f => f.Id == id))) throw new ApiError(400, "Unbekannte Feedback-IDs.");
            var request = new ImprovementRequest(input.RequestId, projectId, documentId, input.FeedbackIds.Distinct().ToArray(), input.Instruction.Trim(), detail.Version, "queued-local", Now());
            review.ImprovementRequests.Add(request); review.RequestIds["improvement:" + input.RequestId] = fingerprint; review.SourceVersion = detail.Version;
            SaveReview(project, doc, review);
            return request;
        }
    }

    private static bool HasDynamicBinding(string source, SourceSpan span)
    {
        var stack = new List<(string Tag, bool Bound)>();
        foreach (Match token in Regex.Matches(source, "<!--[\\s\\S]*?(?:-->|$)|<(?:\"[^\"]*\"|'[^']*'|[^'\">])*?>|[^<]+|<"))
        {
            if (token.Index >= span.Start) break;
            if (!token.Value.StartsWith('<')) continue;
            var tag = Regex.Match(token.Value, @"^<\s*(/?)\s*([a-zA-Z][a-zA-Z0-9]*)");
            if (!tag.Success) continue;
            var name = tag.Groups[2].Value.ToLowerInvariant();
            if (tag.Groups[1].Value == "/")
            {
                var index = stack.FindLastIndex(x => x.Tag == name);
                if (index >= 0) stack.RemoveRange(index, stack.Count - index);
            }
            else if (!(new[] { "br", "hr", "img", "input", "meta", "link", "source", "wbr", "embed" }).Contains(name) && !token.Value.EndsWith("/>"))
                stack.Add((name, Regex.IsMatch(token.Value, @"(?:data-i18n(?:-[\w]+)?|v-text|v-html|\[innerHTML\])\s*=", RegexOptions.IgnoreCase)));
        }
        return stack.Any(x => x.Bound);
    }
    private static string EscapeMarkdown(string text)
    {
        if (text.Contains('\r') || text.Contains('\n')) throw new ApiError(422, "Ein Textvorschlag muss im bestehenden Markdown-Absatz bleiben.");
        return Regex.Replace(text, @"([\\`*_{}\[\]<>#~!|()+.=-])", @"\$1").Replace("&", "&amp;");
    }
    private static bool Duplicate(ReviewFile review, string key, string fingerprint)
    {
        if (!review.RequestIds.TryGetValue(key, out var existing)) return false;
        if (existing != fingerprint) throw new ApiError(409, "Request-ID wurde bereits für einen anderen Inhalt verwendet.");
        return true;
    }
    private static void ValidateRequestId(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length > 160 || !Regex.IsMatch(id, @"^[a-zA-Z0-9_-]+$")) throw new ApiError(400, "Eine eindeutige Request-ID ist erforderlich.");
    }
    private static void CheckVersion(string actual, string expected)
    {
        if (actual != expected) throw new ApiError(409, "Der Quelltext hat sich geändert. Bitte neu laden und den Vorschlag erneut prüfen.");
    }
    private static void CheckReview(ReviewFile review, int expected)
    {
        if (review.Revision != expected) throw new ApiError(409, "Das Review wurde zwischenzeitlich geändert. Bitte neu laden.");
    }
    public static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    private static string Now() => DateTimeOffset.UtcNow.ToString("O");
    private static T ReadJson<T>(string path)
    {
        EnsureNoLinks(path);
        try { return JsonSerializer.Deserialize<T>(File.ReadAllText(path, Utf8), Json) ?? throw new JsonException(); }
        catch (JsonException) { throw new ApiError(409, "Metadaten sind ungültig; vorhandene Datei wird nicht überschrieben: " + Path.GetFileName(path)); }
    }
    private static (string Source, bool Bom) ReadSource(string path)
    {
        EnsureNoLinks(path);
        if (new FileInfo(path).Length > 2 * 1024 * 1024) throw new ApiError(422, "Dokument ist größer als 2 MB; für diese erste Version bitte aufteilen.");
        var bytes = File.ReadAllBytes(path);
        var bom = bytes.Length >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf;
        try { return (Utf8.GetString(bytes, bom ? 3 : 0, bytes.Length - (bom ? 3 : 0)), bom); }
        catch (DecoderFallbackException) { throw new ApiError(422, "Nur UTF-8-Quelldateien werden unterstützt; Datei wurde nicht verändert."); }
    }
    private static void WriteSource(string path, string text, bool bom)
    {
        var bytes = Utf8.GetBytes(text);
        if (bom) bytes = [0xef, 0xbb, 0xbf, .. bytes];
        AtomicWrite(path, bytes);
    }
    public static void AtomicWrite(string path, string text) => AtomicWrite(path, Utf8.GetBytes(text));
    private static void AtomicWrite(string path, byte[] bytes)
    {
        EnsureNoLinks(Path.GetDirectoryName(path)!);
        if (File.Exists(path)) EnsureNoLinks(path);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough)) { stream.Write(bytes); stream.Flush(true); }
            File.Move(temp, path, true);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    public static string Contained(string root, string relative)
    {
        var full = Path.GetFullPath(Path.Combine(root, relative));
        var prefix = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new ApiError(400, "Pfad liegt außerhalb des registrierten Projekts.");
        EnsureNoLinks(full);
        return full;
    }
    public static void EnsureNoLinks(string path)
    {
        var current = Path.GetFullPath(path);
        while (!string.IsNullOrEmpty(current))
        {
            if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new ApiError(422, "Symbolische Links und Junctions werden für Projektdateien nicht unterstützt.");
            current = Path.GetDirectoryName(current);
        }
    }
}
