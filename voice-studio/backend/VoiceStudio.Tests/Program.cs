using System.Text;
using System.Text.Json;
using VoiceStudio;
var count = 0;
var root = Path.Combine(Path.GetTempPath(), "voice-studio-test-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
void Check(bool value, string name) { count++; if (!value) throw new Exception("FAIL: " + name); }
void Reject(int status, Action action, string name) { count++; try { action(); } catch (ApiError e) when (e.Status == status) { return; } throw new Exception("FAIL: " + name); }
try
{
    const string html = "<html lang=\"en\"><head><title>Hidden</title><script>alert(1)</script></head><h1>Quality &amp; speed.</h1><p>Hello &#x1F680; &lt;world&gt;.</p><button onclick=\"alert(2)\">Launch</button><iframe src=evil>Hidden</iframe></html>";
    var parsed = DocumentParser.Parse(html, "html");
    Check(parsed.Language == "en" && parsed.Units.Length == 3, "HTML language/exclusions");
    Check(parsed.Units[0].Text == "Quality & speed.", "decoded entities");
    var amp = parsed.MapSpan("u-0", 8, 9);
    Check(html[amp.Start..amp.End] == "&amp;", "entity source span");
    var rocket = parsed.MapSpan("u-1", 6, 8);
    Check(html[rocket.Start..rocket.End] == "&#x1F680;", "non-BMP entity");
    Reject(400, () => parsed.MapSpan("u-1", 6, 7), "split surrogate");
    Check(!parsed.Html.Contains("<script") && !parsed.Html.Contains("onclick") && !parsed.Html.Contains("<iframe"), "preview sanitization");
    Check(parsed.Html.Contains("data-voice-unit=\"u-0\"") && parsed.ExcludedRegions >= 3, "preview targets/coverage");
    Check(DocumentParser.Analyze(parsed.Units).Any(f => f.RuleId == "heading-period" && f.Quote == "."), "rule exact span");
    const string markdown = "---\ntitle: hidden\n---\n# Fast **quality**.\nA [useful link](https://example.org) and \u0060hiddenCode\u0060 text.\n~~~js\nconst dangerous = 1;\n~~~\n";
    parsed = DocumentParser.Parse(markdown, "markdown");
    Check(parsed.Units.Length == 2 && parsed.Units[0].Text == "Fast quality.", "Markdown exclusions/visible text");
    var bold = parsed.MapSpan("u-0", 5, 12);
    Check(markdown[bold.Start..bold.End] == "quality", "inside emphasis mapping");
    Reject(422, () => parsed.MapSpan("u-0", 0, 12), "cross markup replacement");
    var link = parsed.MapSpan("u-1", 2, 13);
    Check(markdown[link.Start..link.End] == "useful link", "link label mapping");
    Check(!parsed.Units.Any(u => u.Text.Contains("hiddenCode") || u.Text.Contains("dangerous")), "code excluded analysis");
    var projectRoot = Path.Combine(root, "project"); Directory.CreateDirectory(projectRoot);
    var sourcePath = Path.Combine(projectRoot, "index.html");
    const string source = "<h1>Innovative quality.</h1>\r\n<p>We believe seamless tools always help &amp; improve.</p>\r\n";
    File.WriteAllText(sourcePath, source, new UTF8Encoding(true));
    File.WriteAllText(Path.Combine(projectRoot, "guide.md"), "# Review.\nA **useful** [guide](./guide).\n");
    File.WriteAllText(Path.Combine(projectRoot, "dynamic.html"), "<h1 data-i18n=\"title\">Fallback title.</h1><script>const T={title:'Real title'};</script>");
    var store = new ProjectStore(root, false);
    var project = store.Register(new(projectRoot, "Test"));
    Check(store.ListProjects().Length == 1 && project.DocumentCount == 3, "registration/inventory");
    var doc = store.ListDocuments(project.Id).First(d => d.Path == "index.html");
    var detail = store.GetDocument(project.Id, doc.Id);
    var input = new FeedbackInput("u-0", "Innovative", 0, 10, "State a specific function", "wording", detail.Version, 0, "feedback-1");
    detail = store.SaveFeedback(project.Id, doc.Id, input);
    Check(detail.ReviewRevision == 1 && detail.Feedback.Length == 1, "feedback revision");
    var replay = store.SaveFeedback(project.Id, doc.Id, input);
    Check(replay.ReviewRevision == 1 && replay.Feedback.Length == 1, "idempotent feedback");
    Reject(409, () => store.SaveFeedback(project.Id, doc.Id, input with { Comment = "changed" }), "changed retry payload");
    Reject(409, () => store.SaveFeedback(project.Id, doc.Id, input with { RequestId = "feedback-2" }), "stale review");
    store = new ProjectStore(root, false); detail = store.GetDocument(project.Id, doc.Id);
    Check(detail.Feedback[0].Comment == input.Comment && detail.ReviewRevision == 1, "restart persistence");
    Check(File.Exists(Path.Combine(projectRoot, ".voice-lint", "reviews", doc.Id + ".voice-meta.json")), "project meta file");
    var requestInput = new ImprovementInput([detail.Feedback[0].Id], "Make benefit concrete", detail.Version, "request-1");
    var request = store.CreateRequest(project.Id, doc.Id, requestInput);
    Check(request.Status == "queued-local" && store.CreateRequest(project.Id, doc.Id, requestInput).Id == request.Id, "durable local request/idempotency");
    var proposal = store.CreateProposal(project.Id, doc.Id, new("u-0", 0, 10, "Measurable", detail.Version, detail.Feedback[0].Id));
    Check(proposal.SourceBefore == source && proposal.SourceAfter.Contains("<h1>Measurable quality.</h1>"), "complete source diff");
    Check(File.ReadAllText(sourcePath) == source, "proposal source unchanged");
    var applied = new ProjectStore(root, false).ApplyProposal(project.Id, doc.Id, proposal.Id, new(detail.Version));
    Check(File.ReadAllText(sourcePath) == proposal.SourceAfter && applied.Version != detail.Version, "apply source/version");
    Check(File.ReadAllBytes(sourcePath).Take(3).SequenceEqual(new byte[] { 0xef, 0xbb, 0xbf }) && File.ReadAllText(sourcePath).Contains("\r\n"), "BOM/CRLF preserved");
    Check(applied.Feedback[0].Status == "needs_reattachment", "removed quote needs reattachment");
    Check(Directory.GetFiles(Path.Combine(projectRoot, ".voice-lint", "backups", doc.Id)).Length == 1, "durable backup");
    Check(new ProjectStore(root, false).ApplyProposal(project.Id, doc.Id, proposal.Id, new(detail.Version)).Version == applied.Version, "apply retry");
    var report = store.Report(project.Id);
    Check(report.Documents.Length == 3 && report.TotalWords > 0 && report.Categories.ContainsKey("claims"), "project report");
    File.AppendAllText(sourcePath, "<p>External edit.</p>");
    Reject(409, () => store.CreateProposal(project.Id, doc.Id, new("u-0", 0, 4, "Test", applied.Version, null)), "stale source");
    Reject(400, () => ProjectStore.Contained(projectRoot, "../outside.html"), "path traversal");
    Reject(404, () => store.GetDocument(project.Id, "../../index.html"), "ID traversal");
    var md = store.ListDocuments(project.Id).First(d => d.Path == "guide.md");
    detail = store.GetDocument(project.Id, md.Id);
    proposal = store.CreateProposal(project.Id, md.Id, new("u-1", 2, 8, "clear & simple", detail.Version, null));
    Check(proposal.SourceAfter.Contains("**clear &amp; simple** [guide](./guide)"), "Markdown syntax preservation");
    var result = store.ApplyProposal(project.Id, md.Id, proposal.Id, new(detail.Version));
    Check(result.Units.Any(u => u.Text.Contains("clear & simple")), "Markdown roundtrip");
    var dynamicDoc = store.ListDocuments(project.Id).First(d => d.Path == "dynamic.html");
    detail = store.GetDocument(project.Id, dynamicDoc.Id);
    Check(detail.Coverage.Notes.Any(n => n.Contains("data-i18n")), "translation coverage");
    Reject(422, () => store.CreateProposal(project.Id, dynamicDoc.Id, new("u-0", 0, 8, "Better", detail.Version, null)), "dynamic fallback guard");
    proposal = store.CreateProposal(project.Id, md.Id, new("u-0", 0, 6, "Inspect", result.Version, null));
    var txFolder = Path.Combine(projectRoot, ".voice-lint", "transactions"); Directory.CreateDirectory(txFolder);
    var tx = Path.Combine(txFolder, md.Id + "-" + proposal.Id + ".json");
    File.WriteAllText(tx, JsonSerializer.Serialize(new { documentId = md.Id, proposalId = proposal.Id, beforeVersion = proposal.ExpectedVersion, afterVersion = ProjectStore.Hash(proposal.SourceAfter), backupPath = "fixture", state = "pending" }, ProjectStore.Json));
    var mdPath = Path.Combine(projectRoot, "guide.md"); File.WriteAllText(mdPath, proposal.SourceAfter);
    var recovered = new ProjectStore(root, false).GetDocument(project.Id, md.Id);
    Check(recovered.Source == proposal.SourceAfter && File.ReadAllText(tx).Contains("completed"), "crash recovery");
    Check(new ProjectStore(root, false).ApplyProposal(project.Id, md.Id, proposal.Id, new(proposal.ExpectedVersion)).Version == recovered.Version, "recovered apply retry");
    var feedback = store.SaveFeedback(project.Id, md.Id, new("u-0", "Inspect", 0, 7, "Check claim", "claims", recovered.Version, recovered.ReviewRevision, "reanchor-1"));
    File.AppendAllText(mdPath, "Extra paragraph.\n");
    var rechecked = store.GetDocument(project.Id, md.Id);
    Check(rechecked.Feedback[0].Status == "needs_recheck" && rechecked.ReviewRevision > feedback.ReviewRevision, "external edit recheck");
    Reject(409, () => store.SetFeedbackStatus(project.Id, md.Id, feedback.Feedback[0].Id, new("resolved", feedback.ReviewRevision)), "status revision guard");
    var escaped = store.CreateProposal(project.Id, md.Id, new("u-0", 0, 7, "- new list", rechecked.Version, null));
    Check(escaped.SourceAfter.Contains("\\- new list"), "Markdown leading list marker escaped");
    var shape = DocumentParser.Parse("<p title=\"a > b\">Safe text.</p>", "html");
    Check(shape.Units.Length == 1 && shape.Units[0].Text == "Safe text.", "quoted tag delimiter does not invent text");
    File.WriteAllText(Path.Combine(projectRoot, "bindings.html"), "<div data-i18n=\"title\"><div>Earlier</div><p>Bound text.</p></div><p>Hello {{name}}.</p>");
    var bindingDoc = store.ListDocuments(project.Id).First(d => d.Path == "bindings.html");
    var binding = store.GetDocument(project.Id, bindingDoc.Id);
    Reject(422, () => store.CreateProposal(project.Id, bindingDoc.Id, new("u-1", 0, 5, "Other", binding.Version, null)), "nested bound ancestor guarded");
    Reject(422, () => store.CreateProposal(project.Id, bindingDoc.Id, new("u-2", 8, 12, "other", binding.Version, null)), "partial interpolation guarded");
    var mdMeta = Path.Combine(projectRoot, ".voice-lint", "reviews", md.Id + ".voice-meta.json");
    var stored = JsonSerializer.Deserialize<ReviewFile>(File.ReadAllText(mdMeta), ProjectStore.Json)!;
    var storedIndex = stored.Proposals.FindIndex(p => p.Id == escaped.Id);
    stored.Proposals[storedIndex] = stored.Proposals[storedIndex] with { Id = "../../outside" };
    File.WriteAllText(mdMeta, JsonSerializer.Serialize(stored, ProjectStore.Json));
    Reject(409, () => store.ApplyProposal(project.Id, md.Id, "../../outside", new(rechecked.Version)), "untrusted proposal ID rejected before backup path");
    var rendered = DocumentParser.Parse("# Hello &#x1F680; &amp; world.\n", "markdown");
    Check(System.Net.WebUtility.HtmlDecode(rendered.Html).Contains("Hello 🚀 & world."), "Markdown entity and emoji preview");
    var lang = DocumentParser.Parse("---\nlang: de\n---\n# Überprüfung.\n", "markdown");
    Check(lang.Language == "de", "Markdown explicit language");
    var rules = DocumentParser.Analyze(DocumentParser.Parse("<p>Powerful and effortless. This page describes what exists.</p>", "html").Units);
    Check(rules.Count(f => f.RuleId == "stock-wording") == 2 && rules.Any(f => f.RuleId == "self-attestation"), "initial sample phrase rules");
    var lockRoot = Path.Combine(root, "session-lock"); Directory.CreateDirectory(lockRoot);
    var firstLock = WorkspaceInstanceLock.TryAcquire(lockRoot);
    Check(firstLock is not null, "first instance acquires workspace lock");
    var existingCredentials = Path.Combine(lockRoot, "session.json");
    File.WriteAllText(existingCredentials, "existing-credential-fixture");
    using (var duplicateLock = WorkspaceInstanceLock.TryAcquire(lockRoot))
    {
        Check(duplicateLock is null, "second instance cannot acquire live workspace");
        if (duplicateLock is not null) File.WriteAllText(existingCredentials, "rotated");
    }
    Check(File.ReadAllText(existingCredentials) == "existing-credential-fixture", "failed second launch preserves existing credentials");
    firstLock!.Dispose();
    using (var nextLock = WorkspaceInstanceLock.TryAcquire(lockRoot)) Check(nextLock is not null, "workspace lock released for restart");
    var browser = store.SetBrowser(project.Id, new("http://127.0.0.1:4177/docs?voice-studio=1"));
    Check(browser.LiveUrl == "http://127.0.0.1:4177/docs?voice-studio=1", "configured live browser URL");
    Check(new ProjectStore(root, false).ListProjects()[0].LiveUrl == browser.LiveUrl, "live URL persists restart");
    Reject(400, () => store.SetBrowser(project.Id, new("javascript:alert(1)")), "live browser unsafe scheme");
    Reject(400, () => store.SetBrowser(project.Id, new("http://localhost:5188/")), "live browser cannot frame Studio origin");
    Reject(400, () => store.SetBrowser(project.Id, new("http://user:pass@localhost:8000")), "live URL embedded credentials rejected");
    var siteRoot = Path.Combine(root, "examples", "quality-website"); Directory.CreateDirectory(siteRoot);
    var nativeSource = "<h1>Actual page</h1><script>localStorage.setItem('demo','active')</script>";
    File.WriteAllText(Path.Combine(siteRoot, "index.html"), nativeSource);
    File.WriteAllText(Path.Combine(siteRoot, "demo.js"), "window.demo = true;");
    Directory.CreateDirectory(Path.Combine(siteRoot, ".voice-lint"));
    File.WriteAllText(Path.Combine(siteRoot, ".voice-lint", "secret.json"), "{}");
    var site = new LiveExampleSite(root);
    Check(File.ReadAllText(site.Resolve("/index.html")!.Path) == nativeSource, "live host serves original source/scripts");
    Check(site.Resolve("/demo.js")?.ContentType.Contains("javascript") == true, "live host serves application JS");
    Check(site.Resolve("/route-without-file")?.Path.EndsWith("index.html") == true, "live native SPA route fallback");
    Check(site.Resolve("/api/projects") is null, "live origin cannot expose API");
    Check(site.Resolve("/.voice-lint/secret.json") is null && site.Resolve("/%2evoice-lint/secret.json") is null, "live origin excludes metadata");
    Check(site.Resolve("/../index.html") is null && site.Resolve("/%252e%252e/index.html") is null, "live host path traversal blocked");
    Reject(400, () => store.SetBrowser(project.Id, new("https://example.com/")), "live browser remote origin rejected");
    var tsRoot = Path.Combine(root, "typescript-project"); Directory.CreateDirectory(Path.Combine(tsRoot, "content"));
    var tsPath = Path.Combine(tsRoot, "content", "home.ts");
    var typeSource = """
import { nonexistent } from './never-executed';
const ignored = { title: 'Private code should not be reviewed' };
export const pages = [{
  id: 'home',
  title: 'Hello \'world\' \u{1F680}.',
  body: "We believe powerful tools help.\nA second line.",
  paragraphs: ['A useful paragraph.'],
  path: '/not-prose',
  dynamic: ~BT~Hello ~EXPR~~BT~,
  build: () => 'Code should not execute'
}] as const;
throw new Error('This source must never execute');
""".Replace("~BT~", ((char)96).ToString()).Replace("~EXPR~", "$" + "{nonexistent}");
    File.WriteAllText(tsPath, typeSource);
    File.WriteAllText(Path.Combine(tsRoot, "outside.ts"), "export const data = {title:'Unconfigured'};");
    File.WriteAllText(Path.Combine(tsRoot, "page.component.html"), "<h1>{{ page.title }}</h1>");
    var configuration = new { version = 1, liveUrl = "http://127.0.0.1:4184/?voice-studio=1", sourceFiles = new[] { "content/*.ts" }, routes = new Dictionary<string, string> { ["/"] = "content/home.ts" }, sourceContexts = new Dictionary<string, string[]> { ["content/home.ts"] = ["page.component.html"] } };
    var configPath = Path.Combine(tsRoot, "voice.config.json");
    File.WriteAllText(configPath, JsonSerializer.Serialize(configuration));
    var tsProject = store.Register(new(tsRoot, "TypeScript pilot"));
    Check(tsProject.DocumentCount == 1 && tsProject.LiveUrl == configuration.liveUrl && tsProject.SourceRoutes?["/"] == "content/home.ts", "opt-in content scope/routes/live URL");
    var tsDoc = store.ListDocuments(tsProject.Id).Single();
    var tsDetail = store.GetDocument(tsProject.Id, tsDoc.Id);
    Check(tsDetail.Format == "typescript" && tsDetail.Units.Length == 3, "AST extracts only exported prose literals");
    Check(tsDetail.Units[0].Text == "Hello 'world' 🚀.", "TypeScript escaped quote and Unicode decoding");
    Check(!tsDetail.Units.Any(u => u.Text.Contains("Private") || u.Text.Contains("not-prose") || u.Text.Contains("nonexistent")), "TypeScript imports/code/interpolation excluded without execution");
    var tsParsed = DocumentParser.Parse(typeSource, "typescript");
    var quoteSpan = tsParsed.MapSpan("ts-u-0", 6, 7);
    Check(typeSource[quoteSpan.Start..quoteSpan.End] == "\\'", "TypeScript escaped quote source mapping");
    var rocketStart = tsDetail.Units[0].Text.IndexOf("🚀", StringComparison.Ordinal);
    var tsRocket = tsParsed.MapSpan("ts-u-0", rocketStart, rocketStart + 2);
    Check(typeSource[tsRocket.Start..tsRocket.End] == "\\u{1F680}", "TypeScript codepoint escape maps full surrogate pair");
    var context = store.GetReviewRunContext(tsProject.Id, tsDoc.Id, tsDetail.Version);
    Check(context.ContextFiles.Single().Source.Contains("page.title") && !context.ContextFiles[0].Truncated, "configured actual component context read");
    const string tsReplacement = "Keep 'quotes' and \\ paths\nNow";
    var tsProposal = store.CreateProposal(tsProject.Id, tsDoc.Id, new("ts-u-0", 0, tsDetail.Units[0].Text.Length, tsReplacement, tsDetail.Version, null));
    Check(File.ReadAllText(tsPath) == typeSource && tsProposal.SourceAfter.Contains("\\'quotes\\'") && tsProposal.SourceAfter.Contains("\\\\ paths\\nNow"), "TS diff preserves delimiter and escapes");
    var tsApplied = store.ApplyProposal(tsProject.Id, tsDoc.Id, tsProposal.Id, new(tsDetail.Version));
    Check(tsApplied.Units[0].Text == tsReplacement && File.ReadAllText(tsPath) == tsProposal.SourceAfter, "TS real source edit roundtrip");
    Reject(409, () => store.GetReviewRunContext(tsProject.Id, tsDoc.Id, tsDetail.Version), "semantic context stale source guard");
    File.WriteAllText(configPath, """{"version":1,"sourceFiles":["../escape.ts"]}""");
    Reject(422, () => VoiceProjectConfig.Read(tsRoot), "configured source traversal rejected");
    File.WriteAllText(configPath, JsonSerializer.Serialize(configuration));
    Check(new ProjectStore(root, false).ListProjects().Any(p => p.Id == tsProject.Id && p.SourceContexts?.Count == 1), "configured source context persists onboarding");
    store.Unregister(tsProject.Id);
    var batchSources = Enumerable.Range(0, 40).Select(index => "export const content = { title: 'Batch cache document " + index + ".' };").ToArray();
    var batchBefore = TypeScriptContentAdapter.ProcessInvocationCount;
    TypeScriptContentAdapter.Warm(batchSources);
    Check(TypeScriptContentAdapter.ProcessInvocationCount == batchBefore + 1, "cold forty-document project uses one TypeScript process");
    Parallel.ForEach(batchSources, source => TypeScriptContentAdapter.Parse(source));
    Check(TypeScriptContentAdapter.ProcessInvocationCount == batchBefore + 1, "forty cached documents survive beyond former thirty-two entry limit");
    Check(TypeScriptContentAdapter.Parse(batchSources[39]).Units[0].Text == "Batch cache document 39.", "batch extraction preserves document mapping");
    var parallelBefore = TypeScriptContentAdapter.ProcessInvocationCount;
    Parallel.For(0, 8, _ => TypeScriptContentAdapter.Parse("export const content = { title: 'Concurrent identical source.' };"));
    Check(TypeScriptContentAdapter.ProcessInvocationCount == parallelBefore + 1, "concurrent same-source requests share one parse");
    store.Unregister(project.Id);
    Check(store.ListProjects().Length == 0 && File.Exists(mdPath), "unregister preserves source");
    var englishCount = TypeScriptContentAdapter.Parse("export const groups = [{ count: '255 tool-capable models on OpenRouter' }, { count: 255 }, { count: '255' }, { count: 'MODEL_COUNT' }, { count: '/api/models' }, { count: 'https://example.org/models' }, { id: 'technical model identifier' }];");
    Check(englishCount.Units.Length == 1 && englishCount.Units[0].Text == "255 tool-capable models on OpenRouter", "rendered English count prose is extracted while numeric and technical values stay excluded");
    var germanCount = TypeScriptContentAdapter.Parse("export const group = { count: '255 Modelle mit Werkzeugzugriff' };");
    Check(germanCount.Units.Single().Text == "255 Modelle mit Werkzeugzugriff" && germanCount.Language == "de", "rendered German count prose is extracted");
    var countSource = "export const group = { count: '255 tool-capable models on OpenRouter' };";
    var countParsed = TypeScriptContentAdapter.Parse(countSource);
    var countSpan = countParsed.MapSpan(countParsed.Units.Single().Id, 0, 3);
    Check(countSource[countSpan.Start..countSpan.End] == "255", "count claim retains precise editable source span");
    var germanWording = DocumentParser.Analyze(DocumentParser.Parse("Die leistungsstarke Suche erklärt ihre Filter.", "markdown").Units).Single(f => f.RuleId == "stock-wording");
    var englishWording = DocumentParser.Analyze(DocumentParser.Parse("A powerful search.", "markdown").Units).Single(f => f.RuleId == "stock-wording");
    Check(germanWording.Start == 4 && germanWording.End == 19 && germanWording.Quote == "leistungsstarke" &&
        germanWording.Explanation.Contains("„leistungsstarke“") && germanWording.Explanation.Contains("Wortliste") &&
        germanWording.Explanation.Contains("umgebende Text") && germanWording.Explanation.Contains("kann das Wort bleiben") &&
        germanWording.RuleId == englishWording.RuleId, "shared DE/EN catalogue returns exact quote/span and explains context-based retention and word-list limits");
    var shiftRoot = Path.Combine(root, "unit-shift"); Directory.CreateDirectory(shiftRoot);
    File.WriteAllText(Path.Combine(shiftRoot, "voice.config.json"), "{\"version\":1,\"sourceFiles\":[\"content.ts\"]}");
    File.WriteAllText(Path.Combine(shiftRoot, "content.ts"), "export const page = { title: 'Stable heading', count: '255 tool-capable models on OpenRouter', paragraphs: ['Repeated quote.', 'Repeated quote.'], body: 'Keep this paragraph clear.' };");
    var shiftProject = store.Register(new(shiftRoot, "Unit shift")).Id;
    var shiftDocId = store.ListDocuments(shiftProject).Single().Id;
    var shiftDoc = store.GetDocument(shiftProject, shiftDocId);
    var bodyUnit = shiftDoc.Units.Single(u => u.Text == "Keep this paragraph clear.");
    shiftDoc = store.SaveFeedback(shiftProject, shiftDocId, new(bodyUnit.Id, "paragraph", 10, 19, "Keep concrete context", "wording", shiftDoc.Version, shiftDoc.ReviewRevision, "shift-unique"));
    var duplicateUnit = shiftDoc.Units.First(u => u.Text == "Repeated quote.");
    shiftDoc = store.SaveFeedback(shiftProject, shiftDocId, new(duplicateUnit.Id, "Repeated quote.", 0, 15, "Ambiguous duplicate", "wording", shiftDoc.Version, shiftDoc.ReviewRevision, "shift-duplicate"));
    var shiftMetaPath = Path.Combine(shiftRoot, ".voice-lint", "reviews", shiftDocId + ".voice-meta.json");
    var shiftMeta = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(shiftMetaPath))!;
    shiftMeta["unitsFingerprint"] = null; // Legacy metadata from the parser before count prose was supported.
    shiftMeta["feedback"]![0]!["unitId"] = "ts-u-3";
    shiftMeta["feedback"]![1]!["unitId"] = "ts-u-1";
    File.WriteAllText(shiftMetaPath, shiftMeta.ToJsonString());
    var shifted = store.GetDocument(shiftProject, shiftDocId);
    Check(shifted.Version == shiftDoc.Version && shifted.ReviewRevision == shiftDoc.ReviewRevision + 1, "unit-map migration is visible even with identical source hash");
    Check(shifted.Feedback[0].UnitId == bodyUnit.Id && shifted.Feedback[0].Status == "needs_recheck", "shifted unit reattaches only to unique exact quote and context");
    Check(shifted.Feedback[1].Status == "needs_reattachment", "ambiguous duplicate after unit shift requires reattachment");
    Check(store.GetDocument(shiftProject, shiftDocId).ReviewRevision == shifted.ReviewRevision, "unit-map migration is persisted and idempotent");
    shiftMeta = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(shiftMetaPath))!;
    shiftMeta["unitsFingerprint"] = null;
    shiftMeta["feedback"]![0]!["prefix"] = "Different original context";
    File.WriteAllText(shiftMetaPath, shiftMeta.ToJsonString());
    Check(store.GetDocument(shiftProject, shiftDocId).Feedback[0].Status == "needs_reattachment", "unique quote with mismatched context is not guessed");
    var beforeRecovery = store.GetDocument(shiftProject, shiftDocId);
    var recoveryProposal = store.CreateProposal(shiftProject, shiftDocId, new(beforeRecovery.Units[0].Id, 0, 6, "Clear", beforeRecovery.Version, null));
    var afterRecoveryApply = store.ApplyProposal(shiftProject, shiftDocId, recoveryProposal.Id, new(beforeRecovery.Version));
    shiftMeta = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(shiftMetaPath))!;
    shiftMeta["unitsFingerprint"] = null;
    shiftMeta["feedback"]![0]!["unitId"] = "ts-u-3";
    shiftMeta["feedback"]![0]!["prefix"] = "Keep this ";
    File.WriteAllText(shiftMetaPath, shiftMeta.ToJsonString());
    var recoveryJournalPath = Path.Combine(shiftRoot, ".voice-lint", "transactions", shiftDocId + "-" + recoveryProposal.Id + ".json");
    var recoveryJournal = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(recoveryJournalPath))!;
    recoveryJournal["state"] = "pending";
    File.WriteAllText(recoveryJournalPath, recoveryJournal.ToJsonString());
    var recoveredMapping = store.GetDocument(shiftProject, shiftDocId);
    Check(recoveredMapping.Version == afterRecoveryApply.Version && recoveredMapping.ReviewRevision == afterRecoveryApply.ReviewRevision + 1 &&
        recoveredMapping.Feedback[0].UnitId == bodyUnit.Id && recoveredMapping.Feedback[0].Status == "needs_recheck",
        "crash recovery cannot mask same-source unit-map migration by stamping a new fingerprint");
    Console.WriteLine($"PASS: {count} backend assertions.");
}
finally
{
    if (Path.GetFullPath(root).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Path.GetFileName(root).StartsWith("voice-studio-test-")) Directory.Delete(root, true);
}
