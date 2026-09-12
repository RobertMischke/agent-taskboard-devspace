import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { readSession } from './session.mjs';

// Current English UI workflow. The historical verify-source-workflow.mjs is retained.
// Only this script's own temporary source fixture may be edited or registered.
// Browser mutations are allowlisted below; a model/task start is blocked before dispatch.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5188';
const session = await readSession(root);
const fixtureParent = path.join(root, '.voice-studio');
const fixture = await fs.mkdtemp(path.join(fixtureParent, 'selection-workflow-test-'));
const sourcePath = path.join(fixture, 'index.html');
const original = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selection verification</title><style>body{font:20px/1.6 system-ui;padding:35px;color:#172c25;background:#fff}button{font:inherit}</style><script src="${base}/library/voice-review.js"></script></head><body><h1>Selection verification</h1><p>🧪 Our powerful tools explain a finding.</p><button id="counter">Count 0</button><script>let count=0;document.querySelector('#counter').onclick=()=>document.querySelector('#counter').textContent='Count '+ ++count;VoiceReview.connectVoiceStudio({studioOrigin:'${base}'});</script></body></html>`;
await fs.writeFile(sourcePath, original);
const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' || new URL(request.url, 'http://localhost').pathname !== '/index.html') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(await fs.readFile(sourcePath));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const liveUrl = `http://127.0.0.1:${server.address().port}/index.html`;
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${method} ${route}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const screenshots = path.join(root, 'test-results');
await fs.mkdir(screenshots, { recursive: true });
let project, documentRoute, stage = 'register fixture', failed = false;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
page.setDefaultTimeout(30000);
const errors = [], forbiddenRequests = [];
page.on('pageerror', error => errors.push(error.message));
await page.route(base + '/api/**', route => {
  const request = route.request(), pathname = new URL(request.url()).pathname;
  const allowed = request.method() === 'GET' || request.method() === 'HEAD' ||
    request.method() === 'POST' && (['/api/session/pair', '/api/session/resume', '/api/session/logout'].includes(pathname) ||
      documentRoute && (['/decisions', '/feedback', '/proposals'].some(suffix => pathname === documentRoute + suffix) ||
        pathname.startsWith(documentRoute + '/proposals/') && pathname.endsWith('/apply')));
  if (allowed) return route.continue();
  forbiddenRequests.push(`${request.method()} ${pathname}`);
  return route.abort('blockedbyclient');
});
const website = () => page.frameLocator('voice-live-browser iframe');
async function connect() {
  await page.locator('#pairing-code').fill(session.pairingCode);
  await page.locator('#remember-browser').uncheck();
  await page.getByRole('button', { name: 'Open local Studio', exact: true }).click();
  await page.locator('.browser-status').filter({ hasText: 'Connected live' }).waitFor();
  await page.locator('.browser-source').filter({ hasText: 'index.html' }).waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}
async function reload() { await page.reload(); await connect(); }
async function select(phrase) {
  const element = website().locator('[data-voice-unit]').filter({ hasText: phrase }).first();
  await element.waitFor();
  await element.evaluate((element, text) => {
    const doc = element.ownerDocument, walker = doc.createTreeWalker(element, 4); let node;
    while ((node = walker.nextNode())) {
      const start = node.textContent.indexOf(text); if (start < 0) continue;
      const range = doc.createRange(); range.setStart(node, start); range.setEnd(node, start + text.length);
      const selection = doc.defaultView.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      doc.dispatchEvent(new Event('selectionchange')); element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return;
    }
    throw new Error('Fixture text was not found');
  }, phrase);
  await page.locator('voice-selection-review').waitFor();
  await expect(page.locator('.selection-card blockquote')).toHaveText(phrase);
}
async function openOptional(controlId, label) {
  const details = page.locator('details.optional-review-input').filter({ has: page.locator(controlId) });
  await expect(details.locator('summary')).toHaveText(label);
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await page.locator(controlId).waitFor();
}
try {
  project = await api('/api/projects/register', 'POST', { path: fixture, name: 'Selection workflow verification' });
  await api(`/api/projects/${project.id}/browser`, 'PATCH', { url: liveUrl });
  const documents = await api(`/api/projects/${project.id}/documents`);
  assert.equal(documents.length, 1);
  documentRoute = `/api/projects/${project.id}/documents/${documents[0].id}`;
  const before = await api(documentRoute);
  await page.goto(base + '/?project=' + encodeURIComponent(project.id)); await connect();

  stage = 'native website and collapsed optional inputs';
  await website().getByRole('button', { name: 'Count 0', exact: true }).click();
  await website().getByRole('button', { name: 'Count 1', exact: true }).waitFor();
  await select('powerful');
  await expect(page.locator('details.optional-review-input')).toHaveCount(2);
  for (const detail of await page.locator('details.optional-review-input').all()) assert.equal(await detail.getAttribute('open'), null);
  await expect(page.locator('#feedback-comment')).not.toBeVisible();
  await expect(page.locator('#replacement')).not.toBeVisible();

  stage = 'keep as written without changing source';
  await page.locator('voice-selection-review summary').filter({ hasText: 'Add a reason' }).click();
  const reason = 'The following sentence explains this capability in the fixture.';
  await page.locator('#selection-keep-note').fill(reason);
  await page.getByRole('button', { name: 'Keep as written', exact: true }).click();
  await expect(page.locator('.saved-decision')).toHaveText('✓ Saved: keep as written');
  await expect(page.locator('.decision-note')).toHaveText(reason);
  assert.equal(await fs.readFile(sourcePath, 'utf8'), original, 'Keeping a passage cannot write source');
  const kept = await api(documentRoute);
  assert.equal(kept.version, before.version);
  assert.deepEqual(kept.findings, before.findings, 'Keeping does not suppress rule findings');
  assert.equal(kept.decisions.length, 1); assert.equal(kept.decisions[0].kind, 'keep'); assert.equal(kept.decisions[0].status, 'current');
  assert.equal(kept.decisions[0].quote, 'powerful');
  await website().getByRole('button', { name: 'Count 1', exact: true }).waitFor();

  stage = 'persisted decision after reload';
  await reload(); await select('powerful');
  await expect(page.locator('.saved-decision')).toHaveText('✓ Saved: keep as written');
  await expect(page.locator('.decision-note')).toHaveText(reason);
  await expect(page.getByRole('button', { name: 'Keep as written', exact: true })).toHaveCount(0);
  assert.equal(await fs.readFile(sourcePath, 'utf8'), original);
  assert.equal((await api(documentRoute + '/decisions'))[0].id, kept.decisions[0].id);
  await page.screenshot({ path: path.join(screenshots, 'selection-keep-persisted.png') });

  stage = 'decision becomes stale after a separate fixture source change';
  const changedSource = original.replace('<h1>Selection verification</h1>', '<h1>Updated fixture heading</h1>');
  await fs.writeFile(sourcePath, changedSource);
  await reload(); await select('powerful');
  await expect(page.locator('.saved-decision')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keep as written', exact: true })).toBeEnabled();
  const changed = await api(documentRoute);
  assert.notEqual(changed.version, before.version);
  assert.equal(changed.decisions.length, 1); assert.equal(changed.decisions[0].id, kept.decisions[0].id);
  assert.equal(changed.decisions[0].status, 'stale'); assert.equal(changed.decisions[0].sourceVersion, before.version);
  assert.equal(await fs.readFile(sourcePath, 'utf8'), changedSource);

  stage = 'optional feedback persists';
  await openOptional('#feedback-comment', 'Your feedback (optional)');
  const comment = 'Fixture review: describe the concrete capability.';
  await page.locator('#feedback-comment').fill(comment);
  await page.getByRole('button', { name: 'Save feedback', exact: true }).click();
  await page.locator('.feedback-item').filter({ hasText: comment }).waitFor();
  assert.equal(await fs.readFile(sourcePath, 'utf8'), changedSource);
  await reload(); await page.getByRole('button', { name: 'Open review', exact: true }).click();
  await page.locator('.feedback-item').filter({ hasText: comment }).waitFor();

  stage = 'optional replacement prepares a reviewed diff';
  await select('powerful');
  await openOptional('#replacement', 'Your wording (optional)');
  await expect(page.locator('#replacement')).toHaveValue('powerful');
  await page.locator('#replacement').fill('specific');
  await page.getByRole('button', { name: /Preview source diff/ }).click();
  await page.locator('.proposal-diff').waitFor();
  await expect(page.locator('.proposal-diff')).toContainText('specific');
  assert.equal(await fs.readFile(sourcePath, 'utf8'), changedSource, 'Preparing a diff cannot write source');
  await page.screenshot({ path: path.join(screenshots, 'selection-source-diff.png') });

  stage = 'explicit source apply and persisted history';
  await page.getByRole('button', { name: 'Apply to source file', exact: true }).click();
  await website().getByText('🧪 Our specific tools explain a finding.', { exact: true }).waitFor();
  assert.equal(await fs.readFile(sourcePath, 'utf8'), changedSource.replace('powerful', 'specific'));
  await reload(); await page.getByRole('button', { name: 'Open review', exact: true }).click();
  await page.locator('.history-proposal').filter({ hasText: 'Applied' }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(forbiddenRequests, []);
  console.log('PASS English-default live selection, collapsed optional inputs, keep decision persistence without source/rule changes, stale decision after separate source change, durable feedback, reviewed Unicode source apply and history; own fixture only, no models or browser errors.');
} catch (error) {
  failed = true; console.error('Selection workflow failed at:', stage);
  await page.screenshot({ path: path.join(screenshots, 'selection-workflow-failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  let unregistered = !project;
  if (project) {
    try { await api(`/api/projects/${project.id}`, 'DELETE'); unregistered = true; }
    catch (error) { if (!failed) throw error; console.error('Fixture remains registered for cleanup:', fixture); }
  }
  if (unregistered) {
    const resolved = await fs.realpath(fixture), allowedParent = await fs.realpath(fixtureParent);
    assert(resolved.startsWith(allowedParent + path.sep) && path.basename(resolved).startsWith('selection-workflow-test-'), 'Fixture cleanup must remain inside its own temporary workspace');
    await fs.rm(resolved, { recursive: true, force: true });
  }
}
