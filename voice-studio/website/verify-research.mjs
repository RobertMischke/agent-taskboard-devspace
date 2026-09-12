// Read-only QA of the built local research page. No service startup or model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import catalogue from '../packages/writing-rules/src/catalogue.json' with {type:'json'};
import * as writingApi from '@voice/writing-rules';
import * as reviewApi from '@voice/review';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.VOICE_WEBSITE_URL??'http://127.0.0.1:5187/voice/';
const origin=new URL(base);
assert(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Research verification target must be loopback');
const sections=['findings','practice','studies','strategies','libraries','economics','voice','sources'];
const types={practice:'practice',studies:'study',strategies:'strategy-evidence',libraries:'library'};
const ruleIds=new Set(catalogue.rules.map(rule=>rule.id));
const release=JSON.parse(await fs.readFile(path.join(root,'docs/plans/writing-review-next-release.json'),'utf8'));
const releaseFunctionIds=new Set(release.functions.map(item=>item.id));
const availableApis={...writingApi,...reviewApi};
const ids=new Set(sections),checks=[],records=[],datasets={};
const nonempty=(value,label)=>assert(typeof value==='string'&&value.trim().length>0,label+' must contain text');
const textList=(value,label)=>{assert(Array.isArray(value)&&value.length>0,label+' must contain entries');value.forEach(item=>nonempty(item,label));};
const https=(value,label)=>{const url=new URL(value);assert.equal(url.protocol,'https:',label+' must use HTTPS');assert(!url.username&&!url.password,label+' must not contain credentials');};
const normalize=value=>value.replace(/\s+/g,' ').trim();

for(const [dataset,kind] of Object.entries(types)){
 const data=JSON.parse(await fs.readFile(path.join(root,'website/research',dataset+'.json'),'utf8'));
 assert(Array.isArray(data)&&data.length>0,dataset+' must be a nonempty record array');datasets[dataset]=data;
 for(const record of data){
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id),'Record IDs must be stable URL-safe slugs');
  assert(!ids.has(record.id),'Duplicate record or section ID: '+record.id);ids.add(record.id);
  assert.equal(record.kind,kind);nonempty(record.title??record.name,record.id+' title');https(record.url,record.id+' primary URL');
  textList(record.relatedRuleIds,record.id+' rule references');assert.equal(new Set(record.relatedRuleIds).size,record.relatedRuleIds.length);
  assert(record.relatedRuleIds.every(id=>ruleIds.has(id)),record.id+' refers to an unknown writing rule');
  if(dataset==='libraries'){
   for(const field of ['languageSupport','execution','voiceFit'])nonempty(record[field],record.id+' '+field);
   textList(record.capabilities,record.id+' capabilities');textList(record.limits,record.id+' limits');
   assert(Object.hasOwn(record,'license'),record.id+' must state a verified license or null');
   if(record.license!==null){nonempty(record.license.id,record.id+' license');https(record.license.url,record.id+' license URL');}
   nonempty(record.maintenance?.observation,record.id+' maintenance evidence');assert(/^\d{4}-\d{2}-\d{2}$/.test(record.maintenance.checkedAt));
   assert(Array.isArray(record.refs)&&record.refs.length>0,record.id+' needs supporting primary references');
   for(const ref of record.refs){nonempty(ref.title,record.id+' reference title');https(ref.url,record.id+' reference URL');}
  }else{
   textList(record.authors,record.id+' attribution');assert(record.date===null&&dataset==='practice'||typeof record.date==='string'&&/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(record.date),record.id+' publication date');
   nonempty(record.readingDepth,record.id+' reading depth');
   const fields=dataset==='practice'?['observation','limits','voiceImplication']:dataset==='studies'?['question','method','voiceImplication']:['method','finding','limits','application'];
   for(const field of fields)nonempty(record[field],record.id+' '+field);
   if(dataset==='studies'){textList(record.findings,record.id+' findings');textList(record.limitations,record.id+' limitations');}
  }
  const apiUse=record.apiUse;assert(apiUse&&Array.isArray(apiUse.availableNow)&&apiUse.availableNow.length>0,record.id+' needs concrete available API uses');
  nonempty(apiUse.currentUse,record.id+' current API use');nonempty(apiUse.missingCapability,record.id+' missing capability');
  textList(apiUse.releaseFunctionIds,record.id+' next-release references');assert(apiUse.releaseFunctionIds.every(id=>releaseFunctionIds.has(id)),record.id+' names an unknown release function');
  assert.equal(new Set(apiUse.availableNow.map(item=>item.symbol)).size,apiUse.availableNow.length,record.id+' repeats API symbols');
  for(const api of apiUse.availableNow){nonempty(api.symbol,record.id+' API symbol');nonempty(api.purpose,record.id+' API purpose');assert.equal(typeof availableApis[api.symbol],'function',record.id+' claims an unavailable API: '+api.symbol);}
  records.push({...record,dataset});
 }
}
checks.push(records.length+' research records have unique IDs, HTTPS primary sources, explicit limitations and valid canonical rule references.');

checks.push('Every source maps to actual exported Voice API functions, a concrete present use, a missing capability and valid next-release function IDs.');
const economics=JSON.parse(await fs.readFile(path.join(root,'website/research/review-economics.json'),'utf8'));
assert.equal(economics.execution.offline,true);assert.equal(economics.execution.providerRequestsSent,0);assert.equal(economics.execution.runnerExecutions,0);assert.equal(economics.execution.modelResponsesEvaluated,0);
assert.equal(economics.surfaceEvaluation.fixtureCount,30);assert(economics.promptMeasurement.summaries.every(item=>item.fixtureCount===30));
datasets['review-economics']=economics;
assert.equal(economics.organizationResearch.sources.length,3);
for(const source of economics.organizationResearch.sources){
 https(source.url,source.id+' economics primary source');
 for(const symbol of source.apiUse.availableNow)assert.equal(typeof availableApis[symbol],'function');
 assert(source.apiUse.releaseFunctionIds.every(id=>releaseFunctionIds.has(id)));
}

async function visibleApi(detail,record){
 const api=detail.locator('.research-api');assert.equal(await api.count(),1,record.id+' needs one API connection');assert(await api.isVisible());
 const text=normalize(await api.innerText());assert(text.includes(normalize(record.apiUse.currentUse)),record.id+' current API use is missing');assert(text.includes(normalize(record.apiUse.missingCapability)),record.id+' missing capability is hidden');
 for(const use of record.apiUse.availableNow){
  const symbol=api.locator('a code').filter({hasText:use.symbol});assert.equal(await symbol.count(),1);assert.equal(await symbol.textContent(),use.symbol);assert(await symbol.isVisible());
  assert(text.includes(normalize(use.purpose)),record.id+' API purpose is missing');
  const target=new URL(await symbol.locator('..').evaluate(element=>element.href));assert.equal(target.origin,origin.origin);assert(target.pathname.includes('/guides/'),'API name must link to maintained reference documentation');
 }
}

const browser=await chromium.launch({channel:'chrome',headless:true,timeout:15000});
try{
 const context=await browser.newContext({locale:'de-DE'});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 const errors=[],requests=[],localLinks=new Set();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
 const researchUrl=new URL('research/',base).href;
 const content=()=>page.locator('.research-content[lang="en"]');
 async function language(locale){await page.getByRole('button',{name:locale.toUpperCase(),exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),locale);}
 async function fits(label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' must not cause horizontal page overflow');}
 await page.goto(researchUrl,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('html').getAttribute('lang'),'en','Public research defaults to English even in a German browser');
 await page.locator('a[data-json-viewer]').first().waitFor();
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const locale of ['en','de']){
   await language(locale);assert.equal(await content().count(),1);assert(await content().isVisible());
   assert.equal(await page.locator('.guide-sidebar, .guide-nav').count(),0,'Native research page must not inherit the guide sidebar');
   const heading=page.getByRole('heading',{level:1});assert.equal(await heading.count(),1);assert(await heading.isVisible());assert.equal(await heading.innerText(),locale==='de'?'Texte, die man gern liest.':'Writing worth reading.');
   if(locale==='en'){await page.evaluate(()=>scrollTo(0,0));await fs.mkdir(path.join(root,'.local'),{recursive:true});await page.screenshot({path:path.join(root,'.local','navigation-research-'+viewport.width+'.png')});}
   for(const id of sections){assert.equal(await page.locator('[id="'+id+'"]').count(),1,'Missing or duplicate research section: '+id);}
   assert.equal(await content().locator('details.research-entry:has(.research-api)').count(),records.length);
   for(const record of records){
    const detail=content().locator('details.research-entry[id="'+record.id+'"]'),summary=detail.locator(':scope > summary');
    assert((normalize(await summary.innerText())).includes(normalize(record.title??record.name)),record.id+' must be discoverable before expanding');
    if(await detail.getAttribute('open')===null)await summary.click();
    await visibleApi(detail,record);
    const text=normalize(await detail.innerText());
    const claim=record.observation??record.question??record.finding??record.voiceFit.replace(/^Assessment: /,'');
    assert(text.includes(normalize(claim)),record.id+' must display its researched finding or application');
    for(const limit of Array.isArray(record.limitations)?record.limitations:Array.isArray(record.limits)?record.limits:[record.limits])assert(text.includes(normalize(limit)),record.id+' must keep its evidence boundary visible');
    const hrefs=await detail.locator('a[href]').evaluateAll(items=>items.map(item=>item.href));
    assert(hrefs.includes(new URL(record.url).href),record.id+' must expose its primary source');
    if(record.dataset==='libraries')for(const ref of record.refs)assert(hrefs.includes(new URL(ref.url).href),record.id+' must expose each supporting primary reference');
    for(const ruleId of record.relatedRuleIds)assert(hrefs.some(href=>{const target=new URL(href);return target.origin===origin.origin&&target.pathname.endsWith('/writing-patterns/')&&['#en-'+ruleId,'#de-'+ruleId].includes(target.hash);}),record.id+' must link to its related rule '+ruleId);
    await fits(locale+' '+viewport.width+'px expanded '+record.id);await summary.click();
   }
   for(const source of economics.organizationResearch.sources){
    const detail=page.locator('#economics details[id="'+source.id+'"]');
    await detail.locator('summary').click();
    const text=normalize(await detail.innerText());
    for(const value of [source.finding,source.limits,source.apiUse.currentUse,source.apiUse.proposed])assert(text.includes(normalize(value)));
    await fits(locale+' '+viewport.width+'px economics '+source.id);
    await detail.locator('summary').click();
   }
   const promptLayout=page.locator('#prompt-layout');
   await promptLayout.locator('summary').click();await fits(locale+' '+viewport.width+'px prompt layout');await promptLayout.locator('summary').click();
   checks.push(locale+' '+viewport.width+'px: every source/library expands with findings, limitations, actual API uses and missing capabilities; native page fits without a guide sidebar.');
   for(const dataset of Object.keys(datasets)){
    const sources=page.locator(dataset==='review-economics'?'#economics':'#sources');
    const target=new URL('sources/research/'+dataset+'.json',base).href;
    // Identify by actual resolved URL, independently of translated labels.
    const index=await sources.locator('a[href]').evaluateAll((items,url)=>items.findIndex(element=>element.href===url),target);
    assert(index>=0,'Missing JSON record link: '+dataset);const jsonLink=sources.locator('a[href]').nth(index);await jsonLink.scrollIntoViewIfNeeded();
    const before=page.url();await jsonLink.click();const dialog=page.getByRole('dialog');await dialog.locator('pre:not([hidden])').waitFor();
    assert.equal(page.url(),before,'JSON evidence must open in-place');
    const text=await dialog.locator('code').textContent();assert.equal(text,JSON.stringify(datasets[dataset],null,2),dataset+' dialog must show exactly the maintained public records as formatted JSON');
    assert(await dialog.evaluate(element=>element.matches(':modal')),'The JSON record must be a modal dialog');
    await fits(locale+' '+viewport.width+'px JSON '+dataset);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert(await jsonLink.evaluate(element=>document.activeElement===element),'Closing JSON restores focus to its source link');
   }
   checks.push(locale+' '+viewport.width+'px: all five JSON datasets open as formatted modal records; Escape returns focus without navigation or page overflow.');
   for(const href of await page.locator('a[href]').evaluateAll(items=>items.map(item=>item.href)))if(href.startsWith(base))localLinks.add(href);
  }
 }

 const measured=page.locator('#economics');const costText=normalize(await measured.innerText());assert(costText.includes('30 authored English/German cases'));assert(costText.includes('none was sent to a model'));assert(costText.includes('Bytes are not tokens.'));assert(costText.includes('not equivalent review quality'));
 checks.push('Three full-text economics sources expose findings, limitations, actual API uses and proposed work; prompt organization remains explicit at desktop and mobile widths.');
 checks.push('Economics displays 30 authored fixtures, zero sent model requests and the bytes-versus-tokens/quality boundary; its modal reproduces the complete measured JSON object.');

 // A real rule navigation verifies that the research-to-catalogue reference opens its details.
 const first=records[0],ruleId=first.relatedRuleIds[0];
 const card=content().locator('details.research-entry[id="'+first.id+'"]');await card.locator(':scope > summary').click();
 const ruleLink=card.locator('a[href*="writing-patterns/"][href$="-'+ruleId+'"]').first();await ruleLink.click();
 const hash=new URL(page.url()).hash;assert(['#en-'+ruleId,'#de-'+ruleId].includes(hash));await page.locator(hash+'[open]').waitFor();
 checks.push('Following a research rule reference opens the matching catalogue anti-pattern details.');
 for(const href of localLinks){
  const response=await context.request.get(href);assert.equal(response.status(),200,'Broken local research link: '+new URL(href).pathname);
  const hash=new URL(href).hash;
  if(hash&&(response.headers()['content-type']??'').includes('text/html'))assert((await response.text()).includes('id="'+decodeURIComponent(hash.slice(1))+'"'),'Missing local section target: '+hash);
 }
 checks.push(localLinks.size+' local research navigation, source downloads and rule section targets resolve.');

 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const fallback=await noJs.newPage();await fallback.goto(researchUrl,{waitUntil:'domcontentloaded'});
 assert.equal(await fallback.locator('.research-content[lang="en"] details.research-entry:has(.research-api)').count(),records.length);
 for(const record of records){
  const detail=fallback.locator('details.research-entry[id="'+record.id+'"]');await detail.locator(':scope > summary').click();
  assert((normalize(await detail.innerText())).includes(normalize(record.observation??record.question??record.finding??record.voiceFit.replace(/^Assessment: /,''))));
  await visibleApi(detail,record);
  await detail.locator(':scope > summary').click();
 }
 assert(await fallback.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const fallbackJson=fallback.locator('#sources a[href$="libraries.json"]').first();const fallbackUrl=await fallbackJson.evaluate(element=>element.href);const raw=await noJs.request.get(fallbackUrl);assert.equal(raw.status(),200);assert.deepEqual(await raw.json(),datasets.libraries);
 await noJs.close();checks.push('Without JavaScript, every research source and its API connection remain readable on mobile; JSON links resolve to the raw public records.');

 assert.deepEqual(errors,[],'Research interactions must not throw browser exceptions');
 assert(requests.every(request=>request.method==='GET'),'Research browsing must not issue mutation or model requests');
 assert(requests.every(request=>new URL(request.url).origin===origin.origin),'Research interactions must not upload content or load external resources');
 checks.push('No browser exceptions, writes, model calls or cross-origin page requests occurred.');
 const buildResponse=await context.request.get(new URL('build-info.json',base).href);assert.equal(buildResponse.status(),200);const info=await buildResponse.json();
 const output=path.join(root,'test-results/voice-website');await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'research.json'),JSON.stringify({capturedAt:new Date().toISOString(),scope:'Read-only actual local public research page in Chrome, EN/DE desktop/mobile and no JavaScript. Data checks validate references and presentation; they do not independently reproduce cited studies or install evaluated libraries.',recordCounts:Object.fromEntries(Object.entries(datasets).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length])),economics:{fixtureCount:economics.surfaceEvaluation.fixtureCount,providerRequestsSent:economics.execution.providerRequestsSent},checks,build:{builtAt:info.builtAt,inputs:info.inputs}},null,2)+'\n');
 console.log('Research public UI: '+checks.length+' checks passed; '+records.length+' records, EN/DE at 1440/390px, native source details, rule links, five JSON dialogs, API connections and no-JavaScript fallback. No models or project writes.');
}finally{await browser.close();}
