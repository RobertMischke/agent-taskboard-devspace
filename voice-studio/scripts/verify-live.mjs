import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readSession } from './session.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5188';
const session = await readSession(root);
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${route}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? null : response.json();
}
const agentRoot = path.resolve(root, '../agent-studio-for-software-website/04-angular-static-final');
const project = await api('/api/projects/register', 'POST', { path: agentRoot, name: 'Agent Studio · Angular-Website' });
assert.equal(Object.keys(project.sourceRoutes).length, 27);
const docs = await api(`/api/projects/${project.id}/documents`);
const home = docs.find(doc => doc.path === 'src/app/content/home.ts');
assert(home && home.format === 'typescript');
const detail = await api(`/api/projects/${project.id}/documents/${home.id}`);
assert(detail.units.length > 20);
assert(project.sourceContexts[home.path].includes('src/app/page.component.html'));
assert.equal((await fetch('http://127.0.0.1:5189/api/projects')).status, 404);
assert.equal((await fetch('http://127.0.0.1:5189/.voice-lint/reviews/secret.json')).status, 404);
const runner = await api('/api/semantic-review/status');
assert.equal(runner.permissionMode, 'read-only');
assert.equal(runner.contextMode, 'clean');
const resultDir = path.join(root, 'test-results'); await fs.mkdir(resultDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(45000);
async function chooseProject(name) {
  if (!await page.locator('.project-sidebar').count()) await page.getByRole('button', { name: 'Projekte und Dateien', exact: true }).click();
  await page.locator('.project-button').filter({ hasText: name }).click();
}
async function selectedText(phrase) {
  const unit = page.frameLocator('iframe').locator('[data-voice-unit]').filter({ hasText: phrase }).first(); await unit.waitFor();
  await unit.evaluate((element, text) => {
    const doc = element.ownerDocument; const walker = doc.createTreeWalker(element, 4); let node;
    while ((node = walker.nextNode())) { const start = node.textContent.indexOf(text); if (start < 0) continue;
      const range = doc.createRange(); range.setStart(node, start); range.setEnd(node, start + text.length);
      const selection = doc.defaultView.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      doc.dispatchEvent(new Event('selectionchange')); element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return;
    }
    throw new Error('Phrase not found in a text node');
  }, phrase);
  await page.locator('#feedback-comment').waitFor();
}
try {
  await page.goto(base);
  await page.locator('#pairing-code').fill(session.pairingCode);
  await page.getByRole('button', { name: 'Lokales Studio öffnen' }).click();
  await page.locator('voice-live-browser').waitFor();
  await page.locator('.browser-status').filter({ hasText: 'Live verbunden' }).waitFor();
  assert.equal(await page.locator('iframe').getAttribute('srcdoc'), null);
  assert((await page.locator('iframe').getAttribute('src')).startsWith('http://127.0.0.1:5189/'));
  assert.equal(await page.locator('.review-panel').count(), 0);
  const sample = page.frameLocator('iframe');
  assert((await sample.locator('h1').textContent()).includes('Prüfungen mit Belegen'));
  assert.equal(await sample.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await sample.locator('html').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(250, 249, 245)');
  await page.screenshot({ path: path.join(resultDir, 'live-website.png'), fullPage: true });
  await selectedText('Eine Rückmeldung hilft');
  assert.equal(await page.locator('#replacement').inputValue(), 'Eine Rückmeldung hilft');
  await page.screenshot({ path: path.join(resultDir, 'live-selection.png'), fullPage: true });
  await page.getByRole('button', { name: 'Review schließen', exact: true }).click();
  await sample.getByRole('link', { name: 'Ablauf', exact: true }).click();
  await page.locator('.browser-source').filter({ hasText: 'workflow.html' }).waitFor();
  await sample.locator('[data-checklist="context"]').check();
  await sample.getByRole('link', { name: 'FAQ', exact: true }).click();
  await page.locator('.browser-source').filter({ hasText: 'faq.html' }).waitFor();
  await sample.getByText('Wo bleibt mein Feedback?', { exact: true }).click();
  assert(await sample.locator('details[open]').count() > 0);
  await page.getByRole('button', { name: 'Website zurück', exact: true }).click();
  await page.locator('.browser-source').filter({ hasText: 'workflow.html' }).waitFor();
  assert(await sample.locator('[data-checklist="context"]').isChecked());
  await sample.getByRole('link', { name: 'Impressum', exact: true }).click();
  await page.locator('.browser-source').filter({ hasText: 'impressum.html' }).waitFor();
  assert((await sample.locator('h1').textContent()).includes('Impressum'));
  await page.getByRole('button', { name: 'Projektbericht', exact: true }).click();
  await page.locator('.file-table').waitFor();
  assert(await page.locator('.file-table tbody tr').count() >= 11);
  await page.screenshot({ path: path.join(resultDir, 'readable-project-report.png'), fullPage: true });

  await chooseProject('Agent Studio · Angular-Website');
  await page.locator('.browser-status').filter({ hasText: 'Live verbunden' }).waitFor();
  await page.locator('.browser-source').filter({ hasText: 'src/app/content/home.ts' }).waitFor();
  const actual = page.frameLocator('iframe');
  const mapped = actual.locator('[data-voice-unit]'); await mapped.first().waitFor();
  assert(await mapped.count() > 10);
  await actual.locator('body').evaluate(element => element.dataset.voiceTestRuntime = 'same-angular-runtime');
  const anchor = actual.locator('a[href="/manifesto"]').first(); await anchor.click();
  await page.locator('.browser-source').filter({ hasText: 'src/app/content/manifesto.ts' }).waitFor();
  assert.equal(await actual.locator('body').getAttribute('data-voice-test-runtime'), 'same-angular-runtime');
  await page.screenshot({ path: path.join(resultDir, 'agent-studio-live.png'), fullPage: true });
  const phrase = await actual.locator('[data-voice-unit]').filter({ hasText: /[a-zA-Z]{4}/ }).first().innerText();
  await selectedText(phrase);
  await page.locator('.component-context summary').click();
  assert((await page.locator('.component-context').textContent()).includes('page.component.html'));
  await page.locator('voice-semantic-review summary').first().click();
  await page.getByRole('button', { name: 'Semantisches Review starten', exact: true }).waitFor();
  // Do not invoke a real model in verification.
  await page.screenshot({ path: path.join(resultDir, 'angular-source-context.png'), fullPage: true });

  await chooseProject('Voice Handbook');
  await page.locator('.folder-button').filter({ hasText: 'guides/' }).click();
  await page.locator('.file-button').filter({ hasText: 'guides/feedback.md' }).click();
  await page.frameLocator('iframe').getByRole('heading', { name: 'Rückmeldungen an der Quelle festhalten' }).waitFor();
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-same-origin');
  await page.screenshot({ path: path.join(resultDir, 'markdown-folders.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS actual website origin/assets/scripts, native navigation/back/history and localStorage, imprint, unmarked selection, readable project report, real Angular SPA/source/component mapping, explicit Runner UI (no inference), Markdown folders; no browser errors.');
} catch (error) {
  await page.screenshot({ path: path.join(resultDir, 'live-failure.png'), fullPage: true });
  console.error('URL:', page.url()); console.error('Status:', await page.locator('.browser-status').allTextContents());
  throw error;
} finally { await browser.close(); }
