// Explicit real pilot. Default mode only inspects; --start invokes the configured
// Coding-Agent-Runner once through the UI. It NEVER applies the proposed source.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { readSession } from './session.mjs';
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const base = 'http://127.0.0.1:5188';
const projectId = 'project-f80c52d87170';
const documentId = 'doc-16aa4892e8bd76c4';
const taskId = '722dca548617b11cdf750d34af31d1d8';
const route = `/api/projects/${projectId}/documents/${documentId}`;
const session = await readSession(root);
async function api(url) {
  const response = await fetch(base + url, {headers:{Authorization:`Bearer ${session.token}`}});
  assert(response.ok, `${url}: ${response.status}`);
  return response.json();
}
const before = await api(route);
let task = await api(`${route}/tasks/${taskId}`);
const runner = await api('/api/semantic-review/status');
console.log(JSON.stringify({mode:process.argv.includes('--start')?'explicit-real-pilot':'inspect',taskId,status:task.status,sourceVersion:before.version,runner},null,2));
if (process.argv.includes('--start')) {
assert.equal(task.status,'queued','Only the original queued pilot may be started; inspect an existing attempt before any follow-up.');
assert.equal(task.sourceVersion,before.version);
assert.equal(task.reviewRevision,before.reviewRevision);
assert(runner.available && runner.configured, 'The existing configured CLI route must be available.');
const output = path.join(root,'.voice-studio/pilot');
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'homepage-before.ts'),before.source);
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1600,height:1080}});
page.setDefaultTimeout(60000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(`${base}/?project=${projectId}`);
  await page.locator('#pairing-code').fill(session.pairingCode);
  await page.getByRole('button',{name:'Lokales Studio öffnen',exact:true}).click();
  await page.locator('.browser-status').filter({hasText:'Live verbunden'}).waitFor();
  await page.getByRole('button',{name:'Review öffnen',exact:true}).click();
  await page.locator('voice-source-tasks .task-id').filter({hasText:taskId.slice(0,8)}).waitFor();
  await page.locator('voice-source-tasks').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'homepage-task-before-start.jpg'),type:'jpeg',quality:75});
  await page.getByRole('button',{name:'An Agent-Runner übergeben',exact:true}).click();
  const started=Date.now();
  for (let attempt=0;attempt<175;attempt++) {
    await page.waitForTimeout(2000);
    task=await api(`${route}/tasks/${taskId}`);
    if(attempt%5===0 || !['queued','running','cancelling'].includes(task.status)) console.log(`Pilot ${Math.round((Date.now()-started)/1000)}s: ${task.status}`);
    if(!['queued','running','cancelling'].includes(task.status))break;
  }
  await fs.writeFile(path.join(output,'homepage-task-result.json'),JSON.stringify({recordedAt:new Date().toISOString(),runner,task,browserErrors:errors},null,2));
  const after=await api(route);
  assert.equal(after.source,before.source,'An agent result must not apply itself to the real website.');
  await page.locator('voice-source-tasks').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'homepage-task-result.jpg'),type:'jpeg',quality:75});
  console.log(JSON.stringify({taskId,status:task.status,error:task.error,notes:task.notes,edits:task.proposal?.edits,sourceUnchanged:true,browserErrors:errors},null,2));
  assert(!['queued','running','cancelling'].includes(task.status),'Pilot is still active; inspect it instead of launching again.');
} finally {await browser.close();}

}
