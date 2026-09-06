import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = 'C:/Projects/voice-lint/docs/operations/voice-concept-revision';
const documentPath = path.join(target, 'index.html');
const fragment = fs.readFileSync(path.join(root, 'docs/dossier-update.html'), 'utf8');
let html = fs.readFileSync(documentPath, 'utf8');
const start = '<!-- voice-studio:current:start -->';
const end = '<!-- voice-studio:current:end -->';
if (html.includes(start)) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (b < 0) throw new Error('Dossier update marker is incomplete; refusing to replace.');
  html = html.slice(0, a) + fragment.trim() + html.slice(b + end.length);
} else {
  const anchor = '<nav class="box" aria-label="Contents">';
  if (!html.includes(anchor)) throw new Error('Expected dossier insertion anchor missing.');
  html = html.replace(anchor, fragment + '\n' + anchor);
}
html = html.replace('2026-09-03, first version, phase shaping', '2026-09-06, local Preview 0.1 verified; model integration planned');
html = html.replace('The tool remains proposed, not implemented.', 'The current implementation and verified boundaries are recorded below; the broader programme remains a design.');
html = html.replace('Related fixtures: <a href="../../../examples/on-page-review/README.md">EN/DE website and Markdown examples</a>.', 'Working EN/DE website and Markdown examples: <a href="#voice-studio-current">current implementation</a>.');
if (!html.includes('<li><a href="#voice-studio-current">')) {
  html = html.replace('<li><a href="#on-page-review">', '<li><a href="#voice-studio-current">Current implementation, verification and LLM strategy</a></li>\n    <li><a href="#on-page-review">');
}
html = html.replace(/2026-09-06, (?:local Preview 0\.1 verified; model integration planned|Preview 0\.2: live Angular\/Markdown and Runner review|Preview 0\.3: source tasks, rule wiki and reviewed website corpus)/g, '2026-09-06, Preview 0.3: source tasks, rule wiki and reviewed website corpus');
html = html.replace(/<h1>(?:Voice Lint concept revision|Voice Studio: Texte im Kontext prüfen)<\/h1>/, '<h1>Voice Studio: review text in context</h1>');
html = html.replace(/<p class="lede">(?:Research and analysis behind a sober public voice|Voice Studio öffnet die laufende Website)[\s\S]*?<\/p>/, '<p class="lede">Voice Studio opens your running website or a folder of Markdown files. Select passages, save feedback, and inspect proposed changes before applying them to the source. This dossier documents the workflow, source mapping, rule explanations, semantic review and explicit source tasks.</p>');
fs.writeFileSync(documentPath, html, 'utf8');
const conceptPath = path.join(target, '../../on-page-review.md');
let concept = fs.readFileSync(conceptPath, 'utf8');
const note = '> Implementation update, 2026-09-06: Preview 0.3 now exists in `C:/Projects/agent-taskboard-devspace/voice-studio` (Angular, .NET, `@voice/review`). See the [current dossier section](operations/voice-concept-revision/index.html#voice-studio-current) for shipped behaviour, explicit source tasks, the shared rule wiki, language-tool candidates, tests, source-adapter limits and model strategy. The design contract below is broader than this delivery; its proposed names and APIs are not the implemented package contract.\n\n';
concept = concept.replace(/^> Implementation update, 2026-09-06:[^\n]*\n\n/m, note);
if (!concept.includes('> Implementation update, 2026-09-06:')) {
  const firstParagraph = concept.indexOf('\n\n');
  concept = concept.slice(0, firstParagraph + 2) + note + concept.slice(firstParagraph + 2);
}
concept = concept.replace('Status: proposed `design-0` product and transport extension, 2026-09-06. No implementation is claimed.', 'Design status: proposed `design-0` extension, 2026-09-06. The implementation update above supersedes the earlier no-implementation status.');
concept = concept.replace('with DE and EN fixtures in `examples/on-page-review/`', 'with implemented DE and EN fixtures in the Voice Studio workspace under `examples/quality-website/` and `examples/markdown-handbook/`');
fs.writeFileSync(conceptPath, concept, 'utf8');
const descriptorPath = path.join(target, 'workbench.json');
const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
descriptor.updatedAt = new Date().toISOString();
descriptor.summary = 'Voice Studio Preview 0.3: actual Angular websites and Markdown folders, persistent feedback, explicit Runner source tasks, a shared rule wiki and local project checks. The real homepage pilot applied six reviewed edits; 26 website content modules were revised. All 27 routes passed desktop/mobile browser checks and npm run check completed successfully through Studio. Twenty original editorial tasks are completed; three factual follow-ups remain queued. Language-tool candidates and separate engine/data licenses are documented. One model pilot is not model qualification. Current evidence is recorded at the top; earlier research is preserved.';
fs.writeFileSync(descriptorPath, JSON.stringify(descriptor, null, 2) + '\n', 'utf8');
console.log('Updated Voice Lint dossier content and descriptor.');
