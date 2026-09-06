import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readSession } from './session.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:5188';
const session = await readSession(root);
const fixture = await fs.mkdtemp(path.join(root, '.voice-studio/live-source-test-'));
const sourcePath = path.join(fixture, 'index.html');
await fs.writeFile(sourcePath, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Source verification</title><style>body{font:20px/1.6 system-ui;padding:35px;color:#172c25;background:#fff}button{font:inherit}</style><script src="${base}/library/voice-review.js"></script></head><body><h1>Source verification</h1><p>🧪 Our powerful tools explain a finding.</p><button id="counter">Count 0</button><script>let count=0;document.querySelector('#counter').onclick=()=>document.querySelector('#counter').textContent='Count '+ ++count;VoiceReview.connectVoiceStudio({studioOrigin:'${base}'});</script></body></html>`);
const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' || new URL(request.url, 'http://localhost').pathname !== '/index.html') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(await fs.readFile(sourcePath));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const liveUrl = `http://127.0.0.1:${server.address().port}/index.html`;
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${method} ${route}: ${response.status}`); return response.status === 204 ? null : response.json();
}
let project;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
page.setDefaultTimeout(45000); const errors=[]; page.on('pageerror', error=>errors.push(error.message));
const screenshots = path.join(root, 'test-results');
async function connect() { await page.locator('#pairing-code').fill(session.pairingCode); await page.getByRole('button',{name:'Lokales Studio öffnen'}).click(); await page.locator('.browser-status').filter({hasText:'Live verbunden'}).waitFor(); }
async function openFixture() {
  if (!await page.locator('.project-sidebar').count()) await page.getByRole('button',{name:'Projekte und Dateien',exact:true}).click();
  await page.locator('.project-button').filter({hasText:'Live source verification'}).click();
  await page.locator('.browser-status').filter({hasText:'Live verbunden'}).waitFor();
}
async function select(phrase) {
  const element=page.frameLocator('iframe').locator('[data-voice-unit]').filter({hasText:phrase}).first(); await element.waitFor();
  await element.evaluate((element,text)=>{const doc=element.ownerDocument;const walk=doc.createTreeWalker(element,4);let node;while(node=walk.nextNode()){const start=node.textContent.indexOf(text);if(start<0)continue;const range=doc.createRange();range.setStart(node,start);range.setEnd(node,start+text.length);const selection=doc.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);doc.dispatchEvent(new Event('selectionchange'));element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return;}throw Error('Missing text');},phrase);
  await page.locator('#feedback-comment').waitFor();
}
try {
  project=await api('/api/projects/register','POST',{path:fixture,name:'Live source verification'});
  await api(`/api/projects/${project.id}/browser`,'PATCH',{url:liveUrl});
  await page.goto(base);await connect();await openFixture();
  await page.frameLocator('iframe').getByRole('button',{name:'Count 0'}).click();
  await page.frameLocator('iframe').getByRole('button',{name:'Count 1'}).waitFor();
  await select('powerful');
  const comment='Live source test: describe the concrete capability.';
  await page.locator('#feedback-comment').fill(comment);
  await page.getByRole('button',{name:'Feedback speichern',exact:true}).click();
  await page.locator('.feedback-item').filter({hasText:comment}).waitFor();
  await page.reload();await connect();await openFixture();
  await page.getByRole('button',{name:'Review öffnen',exact:true}).click();
  await page.locator('.feedback-item').filter({hasText:comment}).waitFor();
  await select('powerful');await page.locator('#replacement').fill('specific');
  await page.getByRole('button',{name:/Quelltext-Diff erstellen/}).click();
  await page.locator('.proposal-diff').waitFor();
  assert((await page.locator('.proposal-diff').innerText()).includes('specific'));
  await page.screenshot({path:path.join(screenshots,'live-source-diff.png'),fullPage:true});
  await page.getByRole('button',{name:'In Quelldatei übernehmen',exact:true}).click();
  await page.frameLocator('iframe').getByText('🧪 Our specific tools explain a finding.',{exact:true}).waitFor();
  assert((await fs.readFile(sourcePath,'utf8')).includes('🧪 Our specific tools'));
  await page.reload();await connect();await openFixture();
  await page.getByRole('button',{name:'Review öffnen',exact:true}).click();
  await page.locator('.history-proposal').filter({hasText:'Übernommen'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS live native script, durable feedback after reload, reviewed diff, actual source apply, live-page reload, Unicode and persisted proposal history; no model calls or browser errors.');
} catch(error) { await page.screenshot({path:path.join(screenshots,'live-source-failure.png'),fullPage:true}); throw error; }
finally {
  if(project) await api(`/api/projects/${project.id}`,'DELETE');
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
