import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readSession } from './session.mjs';

// This importer persists review metadata and queued tasks only. It never starts
// a runner or applies source edits. Default mode validates without writing.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5188';
const apply = process.argv.includes('--apply');
const audit = JSON.parse(await fs.readFile(path.join(root, 'docs/reviews/agent-studio-website-2026-09-06.json'), 'utf8'));
const session = await readSession(root);
const hash = value => createHash('sha256').update(value).digest('hex');
const version = value => value.replace(/^sha256:/, '').toLowerCase();
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${method} ${route}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return response.status === 204 ? null : response.json();
}
const projects = await api('/api/projects');
const candidates = projects.filter(project => project.name.includes('Agent Studio') && project.sourceRoutes?.['/news'] === 'src/app/content/news.ts');
assert.equal(candidates.length, 1, 'Exactly one registered real Agent Studio website is required.');
const project = candidates[0];
const documents = await api(`/api/projects/${project.id}/documents`);
const entries = new Map();
// Validate the complete audit source snapshot before the first metadata write.
for (const coverage of audit.coverage) {
  const source = await fs.readFile(path.join(audit.websiteRoot, coverage.sourcePath));
  assert.equal(hash(source), version(coverage.sourceVersion), `Audit source changed: ${coverage.sourcePath}`);
  const summary = documents.find(document => document.path === coverage.sourcePath);
  assert(summary, `Registered document missing: ${coverage.sourcePath}`);
  const detail = await api(`/api/projects/${project.id}/documents/${summary.id}`);
  assert.equal(version(detail.version), version(coverage.sourceVersion), `Registered project is not the audited snapshot: ${coverage.sourcePath}`);
  entries.set(coverage.sourcePath, { detail, findings: [] });
}
const unmapped = [];
for (const finding of audit.findings) {
  const entry = entries.get(finding.sourcePath);
  assert(entry, `No reviewed file for ${finding.id}`);
  const literal = finding.anchor.literalSourceSpan;
  const matches = entry.detail.units.filter(unit => unit.sourceSpan.start >= literal.start && unit.sourceSpan.end <= literal.end && unit.text.includes(finding.exactQuote));
  if (matches.length !== 1) { unmapped.push(`${finding.id}: ${finding.exactQuote}`); continue; }
  const unit = matches[0];
  const start = unit.text.indexOf(finding.exactQuote);
  assert.equal(unit.text.indexOf(finding.exactQuote, start + 1), -1, `Ambiguous quote in ${finding.id}`);
  const marker = `[${audit.id}/${finding.id}]`;
  const evidence = finding.evidenceRefs.map(id => {
    const item = audit.evidence[id];
    assert(item, `Missing evidence ${id}`);
    return `${item.url ?? item.path}${item.locator ? ` (${item.locator})` : ''}: ${item.supports}`;
  });
  const comment = `${marker} ${finding.title}\n\nEinordnung: ${audit.definitions.dispositions[finding.disposition]}. Priorität ${finding.priority}.\n\nWarum prüfen: ${finding.explanation}\n\nVorschlag zur Prüfung: ${finding.replacement || 'Zuerst die offene Sachfrage klären; keine unbelegte Ersatzbehauptung einführen.'}\n\nBelege / Prüfgrundlage:\n${evidence.join('\n')}\n\nRedaktioneller Review vom ${audit.reviewDate}; kein automatisch festgestellter Regelverstoß. Ersatztext vor Übernahme am aktuellen Produktstand prüfen.`;
  assert(comment.length <= 12000, `Feedback too long: ${finding.id}`);
  entry.findings.push({ finding, unitId: unit.id, start, end: start + finding.exactQuote.length, marker, comment });
}
assert.equal(unmapped.length, 0, `Expected one literal-scoped mapped unit for each finding:\n${unmapped.join("\n")}`);
const affected = [...entries.values()].filter(entry => entry.findings.length);
let createdFeedback = 0, reusedFeedback = 0, createdTasks = 0, reusedTasks = 0;
const manifest = { reviewId: audit.id, importedAt: new Date().toISOString(), projectId: project.id, url: `${base}/?project=${project.id}`, findings: [], tasks: [] };
for (const entry of affected) {
  let detail = entry.detail;
  const route = `/api/projects/${project.id}/documents/${detail.id}`;
  const feedbackIds = [];
  for (const item of entry.findings) {
    const existing = detail.feedback.filter(feedback => feedback.comment.startsWith(item.marker));
    assert(existing.length <= 1, `Duplicate existing audit feedback: ${item.finding.id}`);
    if (existing.length) {
      assert.equal(existing[0].quote, item.finding.exactQuote, `Existing quote differs: ${item.finding.id}`);
      assert.equal(existing[0].comment, item.comment, `Existing imported review differs: ${item.finding.id}; review manually instead of overwriting.`);
      feedbackIds.push(existing[0].id); reusedFeedback++;
    } else if (apply) {
      detail = await api(`${route}/feedback`, 'POST', { unitId: item.unitId, quote: item.finding.exactQuote, start: item.start, end: item.end, comment: item.comment, category: item.finding.category, expectedVersion: detail.version, expectedReviewRevision: detail.reviewRevision, requestId: `audit_${hash(audit.id + '/' + item.finding.id).slice(0, 32)}` });
      const feedback = detail.feedback.find(feedback => feedback.comment.startsWith(item.marker));
      assert(feedback, `Saved feedback absent: ${item.finding.id}`);
      feedbackIds.push(feedback.id); createdFeedback++;
    }
    manifest.findings.push({ id: item.finding.id, documentId: detail.id, feedbackId: feedbackIds.at(-1) ?? null });
  }
  if (!apply) continue;
  // All feedback for a file is saved before the task captures its review revision.
  const marker = `[${audit.id}]`;
  const instruction = `${marker} Überarbeite die Website-Texte in ${detail.path} anhand der ${entry.findings.length} angehängten Review-Befunde (${entry.findings.map(item => item.finding.id).join(', ')}).\n\nLies die konkreten Begründungen und Belege. Behalte sinnvolle, belegte Aussagen bei. Formuliere klar und konkret auf Englisch. Führe keine unbelegten Produktfähigkeiten, Zahlen oder Veröffentlichungsstände ein. Bei needs-product-verification und needs-evidence zuerst die offene Sachfrage klären; ein lokaler Dev-Stand belegt kein öffentliches Release. Wenn Belege fehlen oder weitere Quelldateien geändert werden müssten, benenne den Klärungsbedarf und lasse den Auftrag offen.\n\nLiefere zusammengehörige, begründete Änderungen als prüfbaren Diff für diese eine Datei. Nach einer Übernahme muss die betroffene Angular-Seite erneut geprüft und der Website-Check ausgeführt werden. Quelle: docs/reviews/agent-studio-website-2026-09-06.md im Voice-Studio-Workspace.`;
  const tasks = await api(`${route}/tasks`);
  const existingTasks = tasks.filter(task => task.instruction.startsWith(marker));
  assert(existingTasks.length <= 1, `Duplicate audit tasks: ${detail.path}`);
  let task;
  if (existingTasks.length) {
    task = existingTasks[0];
    assert.equal(task.instruction, instruction, `Existing task differs: ${detail.path}`);
    reusedTasks++;
  } else {
    task = await api(`${route}/tasks`, 'POST', { instruction, feedbackIds, expectedVersion: detail.version, expectedReviewRevision: detail.reviewRevision, requestId: `audit_${hash(audit.id + '/' + detail.path).slice(0, 32)}` });
    assert.equal(task.status, 'queued'); createdTasks++;
  }
  manifest.tasks.push({ documentId: detail.id, path: detail.path, taskId: task.id, status: task.status });
}
if (apply) {
  const folder = path.join(root, '.voice-studio/imports');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, `${audit.id}.json`), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(JSON.stringify({ mode: apply ? 'metadata-import' : 'dry-run', sourceFilesValidated: entries.size, findingsValidated: audit.findings.length, affectedFiles: affected.length, createdFeedback, reusedFeedback, createdTasks, reusedTasks, studioUrl: manifest.url, sourceWrites: 0, runnerStarts: 0 }, null, 2));
