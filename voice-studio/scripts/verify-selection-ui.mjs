// Exercise selection review state with deferred HTTP and controlled timers.
// No service, website, CLI or model is started by this verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { parseTemplate } from '@angular/compiler';

const template = fs.readFileSync(new URL('../frontend/src/app/selection-review.component.html', import.meta.url), 'utf8');
assert.equal(parseTemplate(template, 'selection-review.component.html').errors, null, 'Selection review template parses without an Angular build.');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const target = { unitId: 'u-0', start: 0, end: 7, quote: 'Before.' };
const document = (id = 'a') => ({ id, version: 'source-' + id, reviewRevision: 4, language: 'en',
  units: [{ id: 'u-0', text: 'Before. After.' }], decisions: [], findings: [], feedback: [] });
const alternative = { id: 'alt-1', replacement: 'A clearer opening.', reason: 'Names the specific benefit.' };
const run = (id = 'run-1', status = 'completed', doc = 'a') => ({ id, projectId: 'p', documentId: doc, sourceVersion: 'source-' + doc,
  selection: { ...target }, status, alternatives: status === 'completed' ? [{ ...alternative }] : [], cli: 'test', model: 'fixture', thinkingLevel: 'low', createdAt: '2026-09-12T12:00:00Z' });
const ready = { configured: true, available: true, cli: 'test', model: 'fixture', thinkingLevel: 'low' };
function setup(storage = new Map()) {
  const timers = new Map(); let timerId = 0;
  const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; read.update = fn => { value = fn(value); }; return read; };
  const decorator = () => value => value;
  const core = { Component: decorator, Input: decorator, Output: decorator, signal,
    EventEmitter: class { values = []; emit(value) { this.values.push(value); } },
    inject: () => ({ run: fn => fn(), locale: () => 'en', t: value => value, entry: () => ({ explanation: 'Check the full stop in {quote}.' }) }), NgZone: class {} };
  const result = ts.transpileModule(fs.readFileSync(new URL('../frontend/src/app/selection-review.component.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }, reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, { exports: module.exports, require: id => id === '@angular/core' ? core : {}, crypto: webcrypto,
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id), console });
  const component = new module.exports.SelectionReviewComponent();
  component.projectId = 'p'; component.document = document(); component.selection = { ...target };
  return { component, timers, fire: () => { const timer = timers.entries().next().value; assert.ok(timer); timers.delete(timer[0]); timer[1](); } };
}

{
  const { component } = setup(); const calls = [];
  component.api = async (path, method, input) => { calls.push({ path, method, input }); return path.endsWith('/status') ? ready : [run(), run('foreign', 'completed', 'b'), { ...run('other'), selection: { ...target, start: 2 } }]; };
  component.ngOnChanges(); await flush();
  check(calls.every(call => call.method !== 'POST') && component.history().length === 1, 'opening a selection only reads its own saved runs and never launches a model');
  check(component.alternatives().length === 1 && component.alternatives()[0].replacement === alternative.replacement, 'saved genuine candidates are restored verbatim without padding to three');
  component.api = async (path, method, input) => { calls.push({ path, method, input }); return { id: 'proposal', documentId: 'a', replacement: input.replacement }; };
  await component.choose(component.alternatives()[0]);
  const chosen = calls.at(-1);
  check(chosen.path.endsWith('/proposals') && chosen.method === 'POST' && chosen.input.expectedVersion === 'source-a' && chosen.input.start === 0 && chosen.input.end === 7 && chosen.input.replacement === alternative.replacement, 'choosing an alternative prepares the guarded source diff for the captured selection');
  check(component.proposalCreated.values.length === 1 && !calls.some(call => call.path.endsWith('/apply')), 'selection choice emits the proposal without applying source changes');
  component.ngOnDestroy();
}
{
  const { component } = setup();
  component.finding = { ...target, id: 'finding', ruleId: 'heading-period', engine: 'voice-studio/local-rules-v0', explanation: 'Original explanation', suggestion: '' };
  component.api = async path => path.endsWith('/status') ? ready : [];
  component.ngOnChanges(); await flush();
  check(component.alternatives().length === 1 && component.alternatives()[0].replacement === '', 'an empty rule replacement remains an explicit removal candidate');
  check(component.alternatives()[0].reason.includes(target.quote), 'local rule reasoning keeps the selected quote');
  component.finding = { ...component.finding, suggestion: null };
  check(component.alternatives().length === 0, 'a finding without a replacement does not invent a candidate');
  component.ngOnDestroy();
}
{
  const { component } = setup(); const calls = [];
  component.finding = { ...target, id: 'finding', suggestion: null };
  component.api = async path => path.endsWith('/status') ? ready : [];
  component.ngOnChanges(); await flush(); component.note = 'This is the intended tone.';
  component.api = async (path, method, input) => {
    calls.push({ path, method, input });
    const decision = { ...target, id: 'keep-1', kind: 'keep', status: 'current', sourceVersion: 'source-a', note: input.note };
    return { decision, document: { ...document(), reviewRevision: 5, decisions: [decision] } };
  };
  await component.keep();
  check(calls.length === 1 && calls[0].path.endsWith('/decisions') && calls[0].input.quote === target.quote && calls[0].input.expectedReviewRevision === 4 && calls[0].input.findingId === 'finding', 'keep saves an exact, version-guarded local decision');
  check(component.savedDecision()?.note === 'This is the intended tone.' && component.decisionSaved.values[0].reviewRevision === 5, 'saved keep decision and updated document are exposed without modifying the source');
  await component.keep(); check(calls.length === 1, 'an already current keep decision does not duplicate on another click');
  component.document = { ...document(), version: 'new-source' };
  check(!component.savedDecision(), 'a prior-source keep decision does not mark the new version as accepted');
  component.ngOnDestroy();
}
{
  const { component } = setup(); const reply = deferred();
  component.api = async path => path.endsWith('/status') ? ready : [];
  component.ngOnChanges(); await flush();
  component.api = async (path, method) => method === 'POST' ? reply.promise : path.endsWith('/status') ? ready : [];
  const saving = component.keep();
  component.document = document('b'); component.ngOnChanges(); await flush();
  reply.resolve({ decision: { ...target, id: 'old', kind: 'keep', status: 'current', sourceVersion: 'source-a' }, document: document() }); await saving;
  check(component.decisionSaved.values.length === 0 && !component.savedDecision() && !component.busy(), 'late keep response cannot change another document or its busy state');
  component.ngOnDestroy();
}
{
  const { component } = setup(); const response = deferred();
  component.api = async path => path.endsWith('/status') ? ready : [];
  component.ngOnChanges(); await flush();
  component.api = async (path, method) => method === 'POST' ? response.promise : path.endsWith('/status') ? ready : [];
  const generating = component.generate(); component.selection = { unitId: 'u-0', start: 8, end: 14, quote: 'After.' }; component.ngOnChanges(); await flush();
  response.resolve(run()); await generating;
  check(component.run() === null && !component.busy(), 'late generation response cannot display candidates for a different selection');
  component.ngOnDestroy();
}
{
  const { component, timers, fire } = setup();
  component.api = async path => path.endsWith('/status') ? ready : path.endsWith('/cancel') ? run('run-1', 'cancelling') : path.endsWith('/run-1') ? run('run-1', 'cancelled') : [run('run-1', 'running')];
  component.ngOnChanges(); await flush(); await component.cancel();
  check(component.run().status === 'cancelling' && component.hasActiveRun() && timers.size === 1, 'cancellation remains active until persisted terminal confirmation');
  fire(); await flush();
  check(component.run().status === 'cancelled' && timers.size === 0 && component.alternatives().length === 0, 'confirmed cancelled runs stop polling and never expose invented alternatives');
  component.ngOnDestroy();
}
{
  const { component, fire } = setup(); const poll = deferred();
  component.api = async path => path.endsWith('/status') ? ready : path.endsWith('/running') ? poll.promise : path.endsWith('/older') ? run('older', 'stale') : [run('running', 'running'), run('older')];
  component.ngOnChanges(); await flush(); fire(); await flush();
  await component.openRun(run('older')); poll.resolve(run('running')); await flush();
  check(component.run().id === 'older' && component.run().status === 'stale' && component.alternatives().length === 0, 'saved run revalidation and the selected view resist a late prior poll');
  component.ngOnDestroy();
}
{
  const { component } = setup(); const loading = deferred(); let posts = 0;
  component.api = async (path, method) => { if (method === 'POST') posts++; return path.endsWith('/status') ? ready : loading.promise; };
  component.ngOnChanges(); await component.generate();
  check(posts === 0, 'initial history loading cannot race a duplicate model launch');
  loading.resolve([]); await flush(); component.disabled = true; await component.generate(); await component.keep();
  check(posts === 0, 'disabled source actions cannot launch generation or save a decision');
  component.ngOnDestroy();
}
{
  const { component } = setup(); let reads = 0;
  component.api = async path => path.endsWith('/status') ? ready : [run('saved', ++reads === 1 ? 'completed' : 'stale')];
  component.ngOnChanges(); await flush(); component.instruction = 'Keep my draft direction.';
  component.document = { ...component.document }; component.ngOnChanges(); await flush();
  check(reads === 2 && component.run().status === 'stale' && component.alternatives().length === 0, 'fresh document inputs revalidate context changes even when the source hash is unchanged');
  check(component.instruction === 'Keep my draft direction.', 'refreshing the same selection preserves the optional instruction draft');
  component.ngOnDestroy();
}
{
  const { component } = setup();
  component.selection = { unitId: 'u-0', start: 0, end: 100, quote: 'Before. After.' };
  check(!component.validSelection(), 'out-of-bounds spans cannot be mistaken for matching source text');
  component.ngOnDestroy();
}

{
  const storage = new Map();
  const { component } = setup(storage); const posts = []; const accepted = new Map(); let starts = 0;
  component.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    posts.push(JSON.parse(JSON.stringify(input)));
    if (!accepted.has(input.requestId)) { starts++; accepted.set(input.requestId, run(input.requestId)); throw new Error('Response lost after acceptance'); }
    return accepted.get(input.requestId);
  };
  component.ngOnChanges(); await flush(); component.instruction = 'Preserve this exact direction.';
  await component.generate();
  check(component.pendingRequest() && starts === 1, 'a lost accepted response retains the unresolved request instead of authorising another launch');
  component.instruction = 'A changed draft must not alter the retry.';
  await component.generate();
  check(starts === 1 && JSON.stringify(posts[0]) === JSON.stringify(posts[1]), 'retry sends the same request ID and exact original payload after the response is lost');
  check(!component.pendingRequest() && component.run().status === 'completed', 'only a confirmed run resolves the pending generation request');
  await component.generate();
  check(starts === 2 && posts[2].requestId !== posts[1].requestId, 'an explicit new generation after confirmation gets a new request ID');
  component.ngOnDestroy();
}
{
  const storage = new Map(); const first = setup(storage).component; const posts = [];
  first.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    posts.push(JSON.parse(JSON.stringify(input))); throw new Error('Lost response');
  };
  first.ngOnChanges(); await flush(); first.instruction = 'Original instruction.'; await first.generate(); first.ngOnDestroy();
  const { component } = setup(storage);
  component.document = { ...document(), version: 'changed-source', reviewRevision: 5 };
  component.selection = { unitId: 'u-0', start: 8, end: 14, quote: 'After.' };
  component.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    posts.push(JSON.parse(JSON.stringify(input))); return run('accepted-before-reload', 'stale');
  };
  component.ngOnChanges(); await flush();
  check(!!component.pendingRequest(), 'an unresolved request survives component recreation and changed source or selection in the same browser tab');
  await component.retryGeneration();
  check(JSON.stringify(posts[0]) === JSON.stringify(posts[1]) && !component.pendingRequest() && component.alternatives().length === 0, 'retry after reload or source drift preserves the exact request and never exposes stale candidates');
  component.ngOnDestroy();
}
{
  const { component, timers, fire } = setup(); const requests = [];
  const running = run('old-selection', 'running');
  component.api = async (path, method) => {
    requests.push({ path, method });
    if (path.endsWith('/status')) return ready;
    if (path.endsWith('/cancel')) return { ...running, status: 'cancelling' };
    if (path.endsWith('/old-selection')) return { ...running, status: 'cancelled' };
    return [running];
  };
  component.ngOnChanges(); await flush();
  component.selection = { unitId: 'u-0', start: 8, end: 14, quote: 'After.' };
  component.document = { ...document(), version: 'new-source' }; component.ngOnChanges(); await flush();
  check(component.activeRuns().length === 1 && component.activeRuns()[0].status === 'running' && component.hasActiveRun(), 'active document runs stay visible after both selection and source changes');
  check(component.alternatives().length === 0 && !component.hasGeneratedAlternatives(), 'foreign-selection or prior-source run visibility never exposes its candidates');
  await component.generate();
  check(!requests.some(request => request.method === 'POST'), 'an active run for another selection blocks an accidental parallel generation');
  await component.cancel(component.activeRuns()[0]);
  check(requests.at(-1).path.endsWith('/old-selection/cancel') && component.activeRuns()[0].status === 'cancelling' && timers.size === 1, 'the original active run remains cancellable and polled for its owning document');
  fire(); await flush();
  check(component.activeRuns().length === 0 && timers.size === 0, 'a confirmed cancellation clears the document-wide active state');
  component.ngOnDestroy();
}
{
  const { component } = setup();
  component.api = async path => path.endsWith('/status') ? ready : [run('foreign-document', 'running', 'b')];
  component.ngOnChanges(); await flush();
  check(component.activeRuns().length === 0 && !component.hasActiveRun(), 'active runs cannot cross project or document identity');
  component.ngOnDestroy();
}

{
  const { component, timers, fire } = setup(); const oldPoll = deferred();
  component.api = async path => path.endsWith('/status') ? ready : path.endsWith('/cancel') ? run('running', 'cancelled') : path.endsWith('/running') ? oldPoll.promise : [run('running', 'running')];
  component.ngOnChanges(); await flush(); fire(); await flush();
  await component.cancel(component.activeRuns()[0]); oldPoll.resolve(run('running', 'running')); await flush();
  check(component.activeRuns().length === 0 && timers.size === 0, 'a late running poll cannot resurrect an already cancelled document run');
  component.ngOnDestroy();
}
{
  const { component, timers } = setup(); let lists = 0;
  component.api = async path => {
    if (path.endsWith('/status')) return ready;
    if (++lists === 1) return [run('known', 'running')];
    throw new Error('List temporarily unavailable');
  };
  component.ngOnChanges(); await flush();
  component.selection = { unitId: 'u-0', start: 8, end: 14, quote: 'After.' }; component.ngOnChanges(); await flush();
  check(component.activeRuns().length === 1 && timers.size === 1 && !component.loading(), 'a failed selection-refresh read retains known active runs and resumes polling');
  component.ngOnDestroy();
}
{
  const storage = new Map(), { component } = setup(storage), posts = [];
  component.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    posts.push(JSON.parse(JSON.stringify(input)));
    if (posts.length === 1) throw Object.assign(new Error('Source changed before acceptance'), {
      status: 409, suggestionRequestId: input.requestId, suggestionRequestAccepted: false,
    });
    return { ...run('new-current-request'), sourceVersion: input.expectedVersion, reviewRevision: input.expectedReviewRevision };
  };
  component.ngOnChanges(); await flush(); component.instruction = 'Old direction'; await component.generate();
  check(!component.pendingRequest() && storage.size === 0, 'a proven not-accepted request releases both memory and tab-storage retry identity');
  component.document = { ...document(), version: 'changed-source', reviewRevision: 5 }; component.ngOnChanges(); await flush();
  component.instruction = 'Current direction'; await component.generate();
  check(posts.length === 2 && posts[0].requestId !== posts[1].requestId && posts[1].expectedVersion === 'changed-source' &&
    posts[1].expectedReviewRevision === 5 && posts[1].instruction === 'Current direction',
    'after definite rejection a new explicit launch uses the current source, review revision and instruction');
  component.ngOnDestroy();
}
{
  const { component } = setup(), posts = [];
  component.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    posts.push(JSON.parse(JSON.stringify(input)));
    if (posts.length === 1) throw Object.assign(new Error('Claim conflict'), { status: 409 });
    if (posts.length === 2) throw Object.assign(new Error('Foreign rejection'), {
      status: 409, suggestionRequestId: 'another-request', suggestionRequestAccepted: false,
    });
    throw Object.assign(new Error('Accepted but uncertain'), {
      status: 409, suggestionRequestId: input.requestId, suggestionRequestAccepted: true,
    });
  };
  component.ngOnChanges(); await flush(); await component.generate();
  check(!!component.pendingRequest(), 'a generic HTTP 409 cannot clear an ambiguously accepted request');
  await component.retryGeneration(); await component.retryGeneration();
  check(!!component.pendingRequest() && posts.every(input => JSON.stringify(input) === JSON.stringify(posts[0])),
    'foreign request proof and accepted:true retain the exact original retry identity');
  component.ngOnDestroy();
}
{
  const { component } = setup(), response = deferred(); let original;
  component.api = async (path, method, input) => {
    if (method !== 'POST') return path.endsWith('/status') ? ready : [];
    original = input; return response.promise;
  };
  component.ngOnChanges(); await flush(); const generating = component.generate();
  component.selection = { unitId: 'u-0', start: 8, end: 14, quote: 'After.' }; component.ngOnChanges(); await flush();
  response.reject(Object.assign(new Error('Not accepted'), {
    status: 409, suggestionRequestId: original.requestId, suggestionRequestAccepted: false,
  })); await generating;
  check(!component.pendingRequest() && component.error() === '' && !component.busy(),
    'late definite rejection releases its original document request without replacing another selection state');
  component.ngOnDestroy();
}
console.log('Selection UI: ' + checks + ' checks passed; deferred fake HTTP only, no service or model calls.');
