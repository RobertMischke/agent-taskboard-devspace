// An explicit local pilot against the real Agent Studio website. No model calls.
// Default: inspect configuration. --start: click its configured check in Studio.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readSession } from './session.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:5188',project='project-f80c52d87170';
const session=await readSession(root),route=`/api/projects/${project}/checks`;
async function api(url){const response=await fetch(base+url,{headers:{Authorization:`Bearer ${session.token}`}});assert(response.ok,`${url}: ${response.status}`);return response.json();}
const config=await api(`${route}/configuration`),before=await api(route);
console.log(JSON.stringify({mode:process.argv.includes('--start')?'explicit-real-check':'inspect',configuration:config},null,2));
if (process.argv.includes('--start')) {
assert(config.configured&&config.startable,'The host must configure this exact project check and the process slot must be free.');
assert.equal(config.label,'npm run check');
const output=path.join(root,'.voice-studio/pilot');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1080}});page.setDefaultTimeout(60000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${base}/?project=${project}`);
  await page.locator('#pairing-code').fill(session.pairingCode);
  await page.getByRole('button',{name:'Lokales Studio öffnen',exact:true}).click();
  await page.locator('.browser-status').filter({hasText:'Live verbunden'}).waitFor();
  await page.getByRole('button',{name:'Review öffnen',exact:true}).click();
  const panel=page.locator('voice-project-checks');
  await panel.getByRole('button',{name:'Lokale Prüfung starten',exact:true}).click();
  let run;
  for(let i=0;i<310;i++){
    await page.waitForTimeout(2000);
    const runs=await api(route);run=runs.find(item=>!before.some(old=>old.id===item.id));
    if(run&&(i%10===0||!['running','cancelling'].includes(run.status)))console.log(JSON.stringify({elapsedSeconds:2*(i+1),id:run.id,status:run.status,exitCode:run.exitCode,logTail:run.log.slice(-900)}));
    if(run&&!['running','cancelling'].includes(run.status))break;
  }
  assert(run,'A new durable check must be recorded');
  await fs.writeFile(path.join(output,'website-check-result.json'),JSON.stringify({recordedAt:new Date().toISOString(),configuration:config,run,browserErrors:errors},null,2));
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'website-check-desktop.jpg'),type:'jpeg',quality:75});
  await page.setViewportSize({width:390,height:1000});await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'website-check-mobile.jpg'),type:'jpeg',quality:75});
  assert.equal(run.status,'completed',run.error??run.log.slice(-2000));
  assert.equal(run.exitCode,0);assert.deepEqual(errors,[]);
  console.log('PASS real website npm run check completed through the Studio UI and persisted its result.');
}finally{await browser.close();}

}
