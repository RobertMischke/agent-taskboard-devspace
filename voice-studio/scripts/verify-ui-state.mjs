// Actual component methods, a small Angular signal/DI boundary, deferred HTTP,
// and controlled timers. No browser, backend, CLI, or model calls are started.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function loadComponent(file, name) {
  const timers = new Map(); let nextTimer = 0;
  const signal = initial => { let value = initial; const get = () => value; get.set = next => { value = next; }; get.update = change => { value = change(value); }; return get; };
  const decorator = () => value => value;
  const core = { Component: decorator, Input: decorator, Output: decorator, ViewChild: decorator,
    EventEmitter: class { values = []; emit(value) { this.values.push(value); } }, signal, computed: fn => fn,
    inject: () => ({ run: fn => fn(), bypassSecurityTrustHtml: value => value }), NgZone: class {} };
  const compiled = ts.transpileModule(fs.readFileSync(new URL('../frontend/src/app/' + file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }, reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, 'component TypeScript syntax');
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { exports: module.exports, require: id => id === '@angular/core' ? core : {},
    crypto: webcrypto, setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id), window: { location: { origin: 'http://127.0.0.1:5188' }, addEventListener() {}, removeEventListener() {} }, URLSearchParams, URL, location: { search: '', href: 'http://127.0.0.1:5188/' }, history: { state: null, replaceState() {} }, console }, { filename: file });
  return { Component: module.exports[name], timers, fire: () => { const entry = timers.entries().next().value; assert.ok(entry, 'poll timer exists'); timers.delete(entry[0]); entry[1](); } };
}
const document = (id = 'a') => ({ id, version: 'source-' + id, path: id + '.md', format: 'markdown', units: [], findings: [], feedback: [], reviewRevision: 0, renderedHtml: '', source: '' });
const finding = { id: 'semantic-one', unitId: 'u-0', quote: 'Text', start: 0, end: 4, ruleId: 'semantic-review' };
const run = (id, status = 'completed', doc = 'a') => ({ id, projectId: 'p', documentId: doc, sourceVersion: 'source-' + doc, status, findings: status === 'completed' ? [finding] : [], contextFiles: [], reviewedUnitIds: [], notes: [] });
const ready = { available: true, configured: true };
const setup = () => { const runtime = loadComponent('semantic-review.component.ts', 'SemanticReviewComponent'); const component = new runtime.Component(); component.projectId = 'p'; component.document = document(); return { ...runtime, component }; };

{
  const { component } = setup(); let historyCalls = 0;
  component.api = async path => path.endsWith('/status') ? ready : (++historyCalls === 1 ? [run('one')] : [run('one', 'stale')]);
  component.ngOnChanges(); await flush();
  check(component.run().status === 'completed', 'persisted review loads');
  component.document = { ...component.document }; component.ngOnChanges(); await flush();
  check(historyCalls === 2 && component.run().status === 'stale' && component.findingsChange.values.at(-1).length === 0, 'same-hash fresh document reloads component-context stale state');
  check(!component.isCurrent({ ...run('foreign'), projectId: 'other' }), 'matching source hash cannot cross project identity');
  component.ngOnDestroy();
}
{
  const { component, timers, fire } = setup();
  component.api = async (path, method) => path.endsWith('/status') ? ready : path.endsWith('/cancel') ? run('one', 'cancelling') : path.endsWith('/one') ? run('one', 'cancelled') : [run('one', 'running')];
  component.ngOnChanges(); await flush(); await component.cancel();
  check(component.run().status === 'cancelling' && component.hasActiveRun() && timers.size === 1, 'cancelling retains active state and polling');
  fire(); await flush();
  check(component.run().status === 'cancelled' && timers.size === 0, 'cancellation polls through to durable terminal state');
  component.ngOnDestroy();
}
{
  const { component, fire } = setup(); const oldPoll = deferred(); let freshHistoryReads = 0;
  component.api = async path => path.endsWith('/status') ? ready : path.endsWith('/running') ? oldPoll.promise : path.endsWith('/older') ? (freshHistoryReads++, run('older', 'stale')) : [run('running', 'running'), run('older')];
  component.ngOnChanges(); await flush(); fire(); await flush();
  await component.openRun(run('older')); oldPoll.resolve(run('running')); await flush();
  check(freshHistoryReads === 1 && component.run().id === 'older' && component.run().status === 'stale', 'history is revalidated and late poll cannot overwrite selected run');
  component.ngOnDestroy();
}
{
  const { component } = setup(); const oldHistory = deferred(); let posts = 0;
  component.api = async (path, method) => { if (method === 'POST') posts++; return path.endsWith('/status') ? ready : path.includes('/documents/a/') ? oldHistory.promise : [run('new', 'completed', 'b')]; };
  component.ngOnChanges(); await component.start();
  check(posts === 0, 'initial history loading cannot race an explicit new launch');
  component.document = document('b'); component.ngOnChanges(); await flush(); oldHistory.resolve([run('old')]); await flush();
  check(component.run().documentId === 'b' && !component.busy(), 'late prior-document history and finally cannot replace new document state');
  component.ngOnDestroy();
}
{
  const { Component } = loadComponent('app.component.ts', 'AppComponent');
  const app = new Component(); app.selectedProject.set({ id: 'p' }); app.document.set(document()); app.tab.set('source');
  app.selected.set({ unitId: 'u-0', quote: 'Text', start: 0, end: 4 }); app.feedbackComment = 'Precise comment';
  const response = deferred(); let target = '';
  app.api = async path => { target = path; return response.promise; };
  const saving = app.saveFeedback(); app.loadSequence++; app.document.set(document('b')); app.clearSelection();
  response.resolve({ ...document(), reviewRevision: 1 }); await saving;
  check(target.includes('/documents/a/feedback') && app.document().id === 'b' && app.notice() === '', 'late feedback response retains captured target and cannot replace navigated document');
  app.document.set(document()); app.selected.set({ unitId: 'u-0', quote: 'Text', start: 0, end: 4 }); app.replacement = 'Changed';
  const proposalReply = deferred(); app.api = async () => proposalReply.promise;
  const creating = app.createProposal(); app.loadSequence++; app.document.set(document('b')); app.clearSelection();
  proposalReply.resolve({ id: 'proposal-a', documentId: 'a' }); await creating;
  check(app.proposal() === null && app.savedProposals().length === 0, 'late proposal is not inserted into another file panel');
  app.document.set(document()); app.requestInstruction = 'Review this'; const failed = deferred(); app.api = async () => failed.promise;
  const requesting = app.saveRequest(); app.loadSequence++; app.document.set(document('b'));
  failed.reject(Object.assign(new Error('old source conflict'), { status: 409 })); await requesting;
  check(!app.stale() && app.error() === '' && !app.busy(), 'late source-conflict error cannot mark new document stale');
  app.semanticFindings.set([finding]); app.activeFinding.set(finding); app.proposal.set({ id: 'old-advice' });
  app.updateSemanticFindings([]);
  check(app.activeFinding() === null && app.proposal() === null, 'invalidated semantic finding clears selected advice and pending diff');
}

{
  const { Component } = loadComponent('live-browser.component.ts', 'LiveBrowserComponent');
  const live = new Component(), posts = [];
  const frameWindow = { postMessage: (message, targetOrigin) => posts.push({ message, targetOrigin }) };
  const original = { ...document(), path: 'src/app/content/home.ts', reviewRevision: 0, units: [{ id: 'ts-u-0', text: 'Review work', sourceSpan: { start: 10, end: 21, encoding: 'utf16' } }] };
  live.project = { id: 'p', liveUrl: 'http://127.0.0.1:4184/', sourceRoutes: { '/': original.path } };
  live.documents = [original]; live.detail = original;
  live.expectedOrigin = 'http://127.0.0.1:4184'; live.currentUrl.set('http://127.0.0.1:4184/'); live.bridgeReady.set(true);
  live.liveFrame = { nativeElement: { contentWindow: frameWindow } };
  live.sendReview(); live.sendReview();
  check(posts.length === 1, 'unchanged live snapshot does not send duplicate review payloads');
  const firstReviewId = posts[0].message.reviewId;
  const refreshed = { ...original, units: [{ ...original.units[0], id: 'ts-u-1' }] };
  live.detail = refreshed;
  live.ngOnChanges({ detail: { previousValue: original, currentValue: refreshed, firstChange: false } });
  check(posts.length === 2 && posts[1].message.units[0].id === 'ts-u-1' && posts[1].message.reviewId !== firstReviewId, 'new adapter snapshot sends remapped units and a new review identity at the same source hash and review revision');
  live.onMessage({ source: frameWindow, origin: live.expectedOrigin, data: { type: 'voice-studio:selection', sessionId: live.sessionId, reviewId: firstReviewId, selection: { unitId: 'ts-u-0', quote: 'Review', start: 0, end: 6 } } });
  check(live.selection.values.length === 0, 'old live review selections cannot survive an adapter snapshot refresh');
  live.detail = { ...refreshed }; live.sendReview();
  check(posts.length === 3 && posts[2].message.units[0].id === 'ts-u-1', 'fresh same-content document snapshots are also delivered for renewed context');
  live.currentUrl.set('http://127.0.0.1:4184/unmapped'); live.sendReview(); live.detail = { ...refreshed }; live.sendReview();
  check(posts.length === 4 && posts[3].message.units.length === 0 && posts.every(item => item.targetOrigin === 'http://127.0.0.1:4184'), 'unmapped routes clear review data once and preserve the registered origin boundary');
  live.ngOnDestroy();
}
console.log('UI state: ' + checks + ' checks passed; deferred fake HTTP only, no backend or model calls.');
