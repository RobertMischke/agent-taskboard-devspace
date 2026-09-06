/** One-time editorial audit reconciliation. Default: filesystem-only dry-run.
 * --apply --plan-digest <reviewed digest> uses only task-create/task-resolve APIs.
 * No model start, proposal apply, feedback rewrite or website source write exists here.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const home = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const auditPath = path.join(home, 'docs/reviews/agent-studio-website-2026-09-06.json');
const importPath = path.join(home, '.voice-studio/imports/agent-studio-website-2026-09-06.json');
const appliedPath = path.join(home, '.voice-studio/pilot/website-revision-applied.json');
const homeAppliedPath = path.join(home, '.voice-studio/pilot/homepage-apply-result.json');
const planPath = path.join(home, '.voice-studio/pilot/review-resolution-plan.json');
const resultPath = path.join(home, '.voice-studio/pilot/review-resolution-result.json');
const marker = '[ASW-2026-09-06-editorial-reconciliation-v1]';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fail = message => { throw new Error(message); };

function safe(root, relative) {
  const full = path.resolve(root, relative);
  const relation = path.relative(root, full);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) fail(`Path escapes approved root: ${relative}`);
  let current = full;
  while (current) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail(`Link is not allowed: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return full;
}

const resolutions = {
  'article-specs-context-not-control': 'ASW-034: Das unerklärte Kürzel APEG wurde entfernt; der Text nennt Aufgaben, Spezifikationen und prüfbare Absichten direkt. Keine Bedeutung des Kürzels wurde erfunden.',
  'article-workforce-sensemaking-cli': 'ASW-035: Der Autorenauftrag wurde durch konkrete Prüfschritte und eine ausdrücklich vorgeschlagene Übung ersetzt. Die neue Zusammenfassung behauptet weder eine gemessene Nutzerstudie noch eine beobachtete Kundensitzung.',
  articles: 'ASW-033: Einstieg und Zusammenfassung nennen die Leserfragen zu Spezifikationen und parallelen Aufgaben. Die interne Begründung der Rubrik als Positionierungsfläche wurde ersetzt.',
  'best-practice-angular-quality-rails': 'ASW-002/003: Der Text beschreibt jetzt vorhandene Inhaltsmodule, separate Templates und bestehende TypeScript-/Template-/SCSS-Prüfungen. Die frühere Behauptung fehlender Lint-Skripte wurde entfernt; die bloße Skriptexistenz wird nicht als erfolgreicher Prüflauf ausgegeben.',
  captures: 'ASW-036: Bildlose Karten tragen im tatsächlich geänderten gemeinsamen Renderer sichtbar „Example · schematic workflow“, Bilder „Agent Studio · recorded capture“. Die Kennzeichnung löst den Befund zur synthetischen Chat-Zeile, ohne eine reale Sitzung oder Screenshot-Provenienz neu zu belegen.',
  comparison: 'ASW-027/028: Der Einstieg beschreibt Vergleichsfragen; nicht vorhandene weiterführende Vergleichsseiten werden nicht mehr angekündigt. Die Matrix ist ausdrücklich keine aktuelle vollständige Wettbewerberprüfung; daraus wird kein neu recherchierter Funktionsnachweis abgeleitet.',
  'context-management': 'ASW-021: Die interne Umbenennung von Docs zu Context Management wurde aus dem Einstieg entfernt. Projektregeln und aufgabenbezogener Kontext werden direkt als nutzbare Inhalte beschrieben.',
  documentation: 'ASW-022/023: Der Verweis auf den internen concepts-Ordner wurde durch konkrete Lesethemen ersetzt; „Acute Context“ wurde als für den jeweiligen Run relevanter Kontext formuliert.',
  'getting-started': 'ASW-005/006/007: Der pauschale Build-von-drei-Binaries-/kein-Installer-Einstieg und unpassende universelle Voraussetzungen wurden ersetzt. Die Anleitung verweist für Installation auf das README der gewählten Version, trennt CLI-Ausführung vom Einstieg und verwendet agent-orc/agent-studio. Ein öffentlicher Zielrelease und ein tatsächlich reproduzierter Setup-Ablauf sind damit noch nicht nachgewiesen; diese Sachfrage bleibt in der verlinkten Folgeaufgabe offen.',
  news: 'ASW-001: Titel und Text nennen den Aufschub der angekündigten Anbieteränderung und einen datierten Quellenstand. Bearbeitet ist die widersprüchliche Darstellung; dies ist keine Behauptung einer erneuten Anbieterprüfung nach diesem Stichtag.',
  'open-source': 'ASW-008: Der Repository-Verweis verwendet den gemeinsamen kanonischen Wert agent-orc/agent-studio. Eine Aussage über Weiterleitungen des alten Owner-Namens wird nicht getroffen.',
  'pattern-external-cli-on-the-side': 'ASW-031: Benötigte Projektidentität, erlaubte Aktionen, Kontext und Review-Evidenz werden als Voraussetzungen bzw. konkrete Schritte benannt. Ausreichender Kontext wird nicht mehr einfach vorausgesetzt.',
  'pattern-workforce-sensemaking-cli': 'ASW-032: Die öffentliche Anweisung an künftige Research-Autoren wurde durch einen Ablauf aus konkreter Frage, Quellenprüfung und dokumentierter Entscheidung ersetzt. Keine beobachtete Sitzung wurde erfunden.',
  patterns: 'ASW-029/030: Der Einstieg nennt nutzbare Abläufe. Die Angular-Katalogkarte beschreibt den Erhalt vorhandener Checks und die Prüfung von Komponentengrenzen statt bereits vorhandene Lint-Werkzeuge als Zukunftsplan auszugeben.',
  product: 'ASW-009/010/014: Absolute Aussagen über fehlende Host-Zugangsdaten bzw. Tunnel als einzigen Zugang und die pauschale Host-Roadmap wurden durch konfigurations- und versionsbezogene Hinweise ersetzt. Die unbelegte Zahl „255 tool-capable models“ wurde entfernt, nicht durch eine erfundene neue Zahl ersetzt. Der veröffentlichte Host-Funktionsumfang bleibt in der verlinkten Folgeaufgabe zu klären; die alte Modellzahl wird nicht als belegt markiert.',
  security: 'ASW-026: Die isolierte Sicherheitsformel ist auf Aufwand für gezieltes Sicherheitsreview begrenzt. Berechtigungen, Zugangsdaten und Ausführungsgrenzen bleiben eigene Voraussetzungen; kein generelles Sicherheitsversprechen wurde ergänzt.',
  'software-quality': 'ASW-025: Die absolute Aussage, visuelle Evidenz beweise UI-Änderungen, wurde begrenzt. Screenshots sind Belege für erfasste Zustände und ersetzen nicht alle Interaktions- oder Viewportprüfungen.',
  status: 'ASW-004/011: Installations- und Host-Aussagen sind jetzt auf die gewählte Version und deren Dokumentation bezogen; ein pauschaler „kein Installer“- oder „alles noch Roadmap“-Stand wird nicht mehr behauptet. Öffentlicher Zielrelease und veröffentlichte Einzelfunktionen bleiben ausdrücklich in den verlinkten Folgeaufgaben offen.',
  tokens: 'ASW-012/013: Die Preisverantwortung wird entsprechend dem geprüften Dev-Quellstand Token Economy über den Studio-Adapter zugeordnet. Der allgemeine Kostenvorteil wurde durch einen bedingten Vergleich einschließlich Nacharbeit, Prüfung und menschlicher Zeit ersetzt. Ein Kostenvorteil wurde nicht neu belegt. Die Zuordnung im beabsichtigten öffentlichen Zielrelease bleibt in der verlinkten Folgeaufgabe zu prüfen.',
  'work-model': 'ASW-024: Die interne watering-can-Metapher wurde durch die konkrete Reihenfolge von Integration und endgültiger Annahme ersetzt; das dokumentierte Freigabemodell bleibt erhalten.'
};

const followupDefinitions = [
  {
    key: 'published-setup', file: 'getting-started', findingIds: ['ASW-004', 'ASW-005', 'ASW-006'], references: ['getting-started', 'status'],
    instruction: 'Öffenen öffentlichen Zielrelease und Setup-Ablauf klären. Zuerst eine veröffentlichte Version bzw. einen verbindlichen Commit samt Releasebeleg benennen; ein lokaler Dev-Stand genügt nicht. Für diese Version unterstützten Installationsweg, Voraussetzungen, Ausführungshost-Onboarding und ersten kleinen Task tatsächlich nachvollziehen. Exakte Anleitung, getestete Umgebung und Ergebnis dokumentieren; keine Zeitangabe ohne Messung. getting-started.ts und status.ts anschließend gemeinsam abgleichen. Die inzwischen neutralisierte Einstiegscopy ist redaktionell bearbeitet; diese Sachprüfung ist noch offen.'
  },
  {
    key: 'published-host-capabilities', file: 'product', findingIds: ['ASW-009', 'ASW-010', 'ASW-011'], references: ['product', 'status'],
    instruction: 'Veröffentlichten Host-Betriebsmodus für einen ausdrücklich benannten Zielrelease prüfen. Pro Aussage Beleg und Releaseumfang festhalten: Repository-/Push-Zugangsdaten, Netzwerkzugang bzw. Tunnel, Host-Registry, geführtes Onboarding, CLI-Quoten und Projektzuweisung. Gelieferte Funktionen, konfigurierte Betriebsvarianten und verbleibende Roadmap getrennt bewerten; das Dev-Runbook belegt nicht automatisch einen öffentlichen Release. product.ts und status.ts konsistent halten. Die aktuellen Konfigurationshinweise sind kein Beweis, dass jede frühere Roadmap-Funktion veröffentlicht ist.'
  },
  {
    key: 'published-pricing-adapter', file: 'tokens', findingIds: ['ASW-012'], references: ['tokens'],
    instruction: 'Preisquellen-Zuordnung im beabsichtigten öffentlichen Agent-Studio-Release bestätigen. Der geprüfte Dev-Adapter verwendet Token Economy; Releaseversion/Commit und verwendeten Pricing-Adapter anhand veröffentlichter Quellen nachweisen. Zeitbezug historischer Preise, unbekannte Werte und Abgrenzung zur Providerrechnung prüfen. Erst nach diesem Abgleich eine uneingeschränkte Releaseaussage freigeben. Der entfernte generelle Kostenvorteil ASW-013 gilt nicht als bewiesen und benötigt ohne erneute Behauptung keinen erfundenen Benchmark.'
  }
];

function inputs(strict = true) {
  const audit = json(auditPath), imported = json(importPath), applied = json(appliedPath), homeApplied = json(homeAppliedPath);
  const root = path.resolve(audit.websiteRoot);
  const expectedRoot = path.resolve(home, '../agent-studio-for-software-website/04-angular-static-final');
  if (!equalPath(root, expectedRoot)) fail('Audit root is not the approved actual website.');
  if (audit.id !== imported.reviewId || audit.findings.length !== 36 || imported.findings.length !== 36 || imported.tasks.length !== 21) fail('Unexpected audit/import scope.');
  if (new Set(imported.tasks.map(t => t.taskId)).size !== 21 || new Set(imported.findings.map(f => f.id)).size !== 36) fail('Duplicate imported identity.');
  const sources = [...applied.contentFiles, ...applied.sharedFiles].map(file => ({path: file.sourcePath, sha256: file.afterSha256}));
  if (!sources.some(source => source.path === 'src/app/content/home.ts')) sources.push({path: 'src/app/content/home.ts', sha256: homeApplied.sourceAfter});
  const sourceDrift = [];
  for (const source of sources) {
    if (!/^[a-f0-9]{64}$/.test(source.sha256)) fail('Malformed approved source hash.');
    const currentSha256 = sha(readFileSync(safe(root, source.path)));
    if (currentSha256 !== source.sha256) { sourceDrift.push({...source, currentSha256}); if (strict) fail(`Applied source changed: ${source.path}`); }
  }
  const renderer = readFileSync(safe(root, 'src/app/capture-card.component.html'), 'utf8');
  if (!renderer.includes("capture().imageSrc ? 'Agent Studio · recorded capture' : 'Example · schematic workflow'")) fail('ASW-036 renderer remedy is missing.');
  return {audit, imported, applied, homeApplied, root, sources, sourceDrift,
    evidenceDigest: sha(JSON.stringify({audit: sha(readFileSync(auditPath)), imported: sha(readFileSync(importPath)), sources, homeTask: homeApplied.taskId}))};
}

function readOriginal(root, projectId, entry) {
  if (!/^[a-f0-9]{32}$/.test(entry.taskId) || !/^doc-[a-f0-9]+$/.test(entry.documentId)) fail('Malformed imported task identity.');
  const task = json(safe(root, `.voice-lint/tasks/${entry.documentId}/${entry.taskId}.json`)).task;
  if (task.id !== entry.taskId || task.documentId !== entry.documentId || task.projectId !== projectId) fail('Task metadata identity mismatch.');
  return task;
}

function buildPlan() {
  const data = inputs(false);
  const {audit, imported, root, sources, evidenceDigest, homeApplied, sourceDrift} = data;
  const followups = followupDefinitions.map(definition => {
    const entry = imported.tasks.find(task => task.path === `src/app/content/${definition.file}.ts`);
    const requestId = `asw_20260906_followup_${definition.key.replaceAll('-', '_')}_v1`;
    return {...definition, documentId: entry.documentId, requestId,
      taskId: sha(`${imported.projectId}\n${entry.documentId}\n${requestId}`).slice(0, 32),
      instruction: `${marker}\n${definition.instruction}\n\nOriginalbefunde: ${definition.findingIds.join(', ')}. Quelle: docs/reviews/agent-studio-website-2026-09-06.json. Neue Aufgabe bleibt gespeichert; kein automatischer Modellstart. Faktenprüfung kann zusätzliche Veröffentlichungsbelege oder einen gesonderten Mehrdatei-Auftrag benötigen.`,
      feedbackIds: [], sourceVersion: sources.find(source => source.path === entry.path).sha256};
  });
  const actions = imported.tasks.map(entry => {
    const task = readOriginal(root, imported.projectId, entry);
    const name = path.basename(entry.path, '.ts');
    const findings = audit.findings.filter(finding => finding.sourcePath === entry.path);
    const importedIds = imported.findings.filter(finding => finding.documentId === entry.documentId).map(finding => finding.id).sort();
    if (JSON.stringify(findings.map(finding => finding.id).sort()) !== JSON.stringify(importedIds)) fail(`Audit/import findings differ: ${entry.path}`);
    if (name === 'home') {
      if (homeApplied.taskId !== task.id || task.status !== 'applied') fail('Homepage task is not already applied.');
      return {...entry, action: 'preserve-applied', currentStatus: task.status, findingIds: importedIds, sourceVersion: sources.find(source => source.path === entry.path).sha256, instructionDigest: sha(task.instruction)};
    }
    if (!resolutions[name]) fail(`Missing explicit editorial decision: ${name}`);
    const linked = followups.filter(followup => followup.references.includes(name));
    const note = `${marker}\n${resolutions[name]}\n\nÜbernommener Quellstand: ${sources.find(source => source.path === entry.path).sha256}. Nachweis: website-revision-applied.json, Originalaudit und gesonderter aktueller Projektcheck. Dieser manuelle Bearbeitetstatus dokumentiert die redaktionelle Übernahme, keinen automatischen Agent-Erfolg und keinen Beweis aller Produktbehauptungen.${linked.length ? '\nOffene Sachprüfung bleibt in Folgeaufgabe(n): ' + linked.map(followup => `${followup.taskId} (${followup.key})`).join('; ') + '.' : ''}`;
    if (note.length > 4000) fail('Resolution note exceeds API limit.');
    return {...entry, action: 'resolve-manual', currentStatus: task.status, findingIds: importedIds, sourceVersion: sources.find(source => source.path === entry.path).sha256,
      instructionDigest: sha(task.instruction), followupTaskIds: linked.map(followup => followup.taskId), note};
  });
  const checkDirectory = safe(root, '.voice-lint/check-runs');
  const checks = existsSync(checkDirectory) ? readdirSync(checkDirectory).filter(name => /^[a-f0-9]{32}\.json$/.test(name)).map(name => json(path.join(checkDirectory, name)).run).sort((a,b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const plan = {schemaVersion: 1, marker, projectId: imported.projectId, evidenceDigest, sources, sourceDrift, followups, actions,
    factDisposition: {
      open: followups.map(({key, findingIds, taskId}) => ({key, findingIds, taskId})),
      removedWithoutProof: ['ASW-013', 'ASW-014'],
      limitations: ['No new cost benchmark or model inventory was created.', 'News retains its explicit source date; recheck provider policy before replacing it with a current-policy claim.', 'Comparison matrix and screenshot provenance were not independently recertified.', 'Original feedback records remain preserved; no blanket resolved/evidence-verified status is written to them.']
    },
    checkCandidate: checks[0] ? {id: checks[0].id, status: checks[0].status, exitCode: checks[0].exitCode, sourceVersion: checks[0].sourceVersion} : null,
    executionGuard: 'Apply requires a currently successful project check from the API, matching the current source and configuration fingerprints. No API call is made during dry-run.'};
  return {...plan, planDigest: sha(JSON.stringify(plan))};
}

async function applyPlan(expectedDigest) {
  const plan = json(planPath);
  const {planDigest, ...body} = plan;
  if (!expectedDigest || expectedDigest !== planDigest || sha(JSON.stringify(body)) !== planDigest) fail('Pass the exact reviewed --plan-digest; plan changed or was not reviewed.');
  const data = inputs();
  if (data.evidenceDigest !== plan.evidenceDigest || data.imported.projectId !== plan.projectId) fail('Reviewed input evidence changed. Regenerate and review the plan.');
  const session = json(json(path.join(home, '.voice-studio/session-location.json')).sessionFile);
  async function api(method, relative, body, missing = false) {
    const allowedPost = /^\/api\/projects\/[^/]+\/documents\/[^/]+\/tasks(?:\/[a-f0-9]{32}\/resolve)?$/;
    if (method !== 'GET' && !(method === 'POST' && allowedPost.test(relative))) fail('Disallowed mutation endpoint.');
    const response = await fetch(`http://127.0.0.1:5188${relative}`, {method, headers: {'Authorization': `Bearer ${session.token}`, 'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000)});
    if (missing && response.status === 404) return null;
    if (!response.ok) fail(`API ${response.status}: ${await response.text()}`);
    return response.json();
  }
  const base = `/api/projects/${plan.projectId}`;
  const docPath = documentId => `${base}/documents/${documentId}`;
  async function currentDocument(action) {
    inputs(); // Includes every applied content/shared source hash, before each write.
    const document = await api('GET', docPath(action.documentId));
    if (document.version !== action.sourceVersion) fail(`Source changed for ${action.documentId}`);
    return document;
  }
  const configuration = await api('GET', `${base}/checks/configuration`);
  const checkRuns = await api('GET', `${base}/checks`);
  const check = checkRuns.find(run => run.status === 'completed' && run.exitCode === 0 && run.sourceVersion === configuration.currentSourceVersion && run.configurationVersion === configuration.configurationVersion);
  if (!check) fail('No successful project check matches the current complete source and host configuration.');
  for (const action of plan.actions) {
    const task = await api('GET', `${docPath(action.documentId)}/tasks/${action.taskId}`);
    if (sha(task.instruction) !== action.instructionDigest || ['running', 'cancelling'].includes(task.status)) fail(`Task changed or still runs: ${action.taskId}`);
  }
  const results = [];
  for (const followup of plan.followups) {
    const endpoint = `${docPath(followup.documentId)}/tasks`;
    let task = await api('GET', `${endpoint}/${followup.taskId}`, undefined, true);
    if (task) {
      if (task.instruction !== followup.instruction || task.sourceVersion !== followup.sourceVersion || task.feedbackIds.length !== 0) fail('Existing follow-up differs from reviewed plan.');
    } else {
      const document = await currentDocument(followup);
      task = await api('POST', endpoint, {instruction: followup.instruction, feedbackIds: [], expectedVersion: document.version, expectedReviewRevision: document.reviewRevision, requestId: followup.requestId});
      if (task.id !== followup.taskId) fail('Unexpected follow-up identity.');
    }
    results.push({kind: 'followup', id: task.id, status: task.status});
  }
  for (const action of plan.actions) {
    const endpoint = `${docPath(action.documentId)}/tasks/${action.taskId}`;
    let task = await api('GET', endpoint);
    if (action.action === 'preserve-applied' || ['applied', 'completed'].includes(task.status)) {
      results.push({kind: 'preserved', id: task.id, status: task.status});
      continue;
    }
    const document = await currentDocument(action);
    task = await api('GET', endpoint); // Fresh task revision after source/review reanchoring.
    task = await api('POST', `${endpoint}/resolve`, {expectedTaskRevision: task.revision, expectedVersion: document.version, expectedReviewRevision: document.reviewRevision, note: action.note + `\nProjektcheck: ${check.id}, Exit 0, Source ${check.sourceVersion}.`});
    results.push({kind: 'resolved-manual', id: task.id, status: task.status});
  }
  writeFileSync(resultPath, JSON.stringify({recordedAt: new Date().toISOString(), planDigest, checkId: check.id, results}, null, 2) + '\n');
  console.log(JSON.stringify({resultPath, resolved: results.filter(r => r.kind === 'resolved-manual').length, preserved: results.filter(r => r.kind === 'preserved').length, followups: plan.followups.length}));
}

if (process.argv.includes('--apply')) {
  const index = process.argv.indexOf('--plan-digest');
  await applyPlan(index >= 0 ? process.argv[index + 1] : undefined);
} else {
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) fail('Use --dry-run or --apply --plan-digest <reviewed digest>.');
  const plan = buildPlan();
  mkdirSync(path.dirname(planPath), {recursive: true});
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({mode: 'filesystem-only-dry-run', planPath, planDigest: plan.planDigest, sourceDrift: plan.sourceDrift, resolveManually: plan.actions.filter(a => a.action === 'resolve-manual').length, preserveApplied: plan.actions.filter(a => a.action === 'preserve-applied').length, followups: plan.followups.map(({key, findingIds, taskId}) => ({key, findingIds, taskId})), checkCandidate: plan.checkCandidate}, null, 2));
}
