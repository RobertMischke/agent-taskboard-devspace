import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {chromium} from '@playwright/test';

const {values}=parseArgs({options:{'api-base':{type:'string',default:'http://127.0.0.1:5031'},'client-id':{type:'string',default:'local-default'},project:{type:'string',default:'Voice Lint'},output:{type:'string',default:'test-results/dossier-integration'},'skip-browser':{type:'boolean',default:false},help:{type:'boolean',default:false}},strict:true});
if(values.help){console.log(`Read-only verification of the Voice Lint dossier integration.
Usage: node scripts/integrations/verify-voice-lint-dossier.mjs [--api-base URL] [--client-id ID] [--project NAME] [--output DIR] [--skip-browser]
Checks the exact maintained fragment and dossier identity through the existing API.
Chrome checks the HTML at 1440/390px unless --skip-browser is set. No app/model/task starts, source writes or metadata mutations.`);process.exit(0)}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const integration=path.join(root,'docs/integrations/voice-lint');
const config=JSON.parse(await fs.readFile(path.join(integration,'dossier.json'),'utf8'));
const fragment=(await fs.readFile(path.join(integration,'dossier-fragment.html'),'utf8')).trim();
const base=new URL(values['api-base']);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('Expected a credential-free HTTP(S) API base.');
const get=async route=>{const response=await fetch(new URL(route,base),{headers:{'X-Client-Id':values['client-id']},signal:AbortSignal.timeout(15000)});assert(response.ok,`Dossier API returned ${response.status}`);return response.json()};
const project=encodeURIComponent(values.project),id=encodeURIComponent(config.id);
const html=(await get(`/api/projects/${project}/wiki/files/operations/${id}/index.html`)).content;
assert.equal(typeof html,'string');assert(html.includes(fragment),'Live dossier differs from the maintained fragment.');
const catalogue=await get(`/api/projects/${project}/workbenches`);const dossier=catalogue.items.find(item=>item.key===config.key);
assert(dossier);assert.equal(dossier.title,config.title);
const output=path.resolve(root,values.output);await fs.mkdir(output,{recursive:true});const widths=[];
if(!values['skip-browser']){
 const browser=await chromium.launch({channel:'chrome',headless:true,timeout:15000});
 try{const page=await browser.newPage();for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.setContent(html,{waitUntil:'domcontentloaded'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Dossier overflows at ${width}px`);
  const anchor=page.locator('#voice-production-readiness');if(await anchor.count())await anchor.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`dossier-${width}.png`)});widths.push(width);
 }}finally{await browser.close()}
}
await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({observedAt:new Date().toISOString(),key:config.key,exactFragment:true,status:dossier.status,lifecycleState:dossier.lifecycleState,viewportWidths:widths,apiWrites:false,modelCalls:false},null,2)+'\n');
console.log(`PASS ${config.key}: maintained fragment, identity and ${widths.length} browser widths; read-only integration check.`);
