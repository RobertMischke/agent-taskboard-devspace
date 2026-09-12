// Read-only QA of the already built local public website. Does not start services or models.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {marked} from 'marked';
import {guides} from './guides.mjs';
import catalogue from '../packages/writing-rules/src/catalogue.json' with {type:'json'};

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.VOICE_WEBSITE_URL??'http://127.0.0.1:5187/voice/';
const url=new URL(base);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Verification target must be loopback');
const verificationSource=await fs.readFile(path.join(root,guides.find(item=>item.slug==='verification').source),'utf8');
const expectedVerificationRecords=[];marked.walkTokens(marked.lexer(verificationSource),token=>{if(token.type==='link')expectedVerificationRecords.push(token.href);});
assert(expectedVerificationRecords.length>0&&expectedVerificationRecords.every(href=>/\.json$/.test(href)),'The maintained Verification list must contain only JSON record links.');
const checks=[],errors=[],requests=[],links=new Set();
const browser=await chromium.launch({channel:'chrome',headless:true,timeout:15000});
try{
 const context=await browser.newContext({locale:'de-DE',permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
 const current=()=>page.locator('article:not([hidden])');
 async function language(locale){await page.getByRole('button',{name:locale.toUpperCase(),exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),locale);}
 async function submit(form){await form.locator('button[type=submit]').click();}
 async function recordLinks(){for(const href of await page.locator('a[href]').evaluateAll(items=>items.map(item=>item.href)))if(href.startsWith(base))links.add(href);}
 await page.goto(new URL('writing-patterns/',base).href,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const locale of ['en','de']){
   await language(locale);const article=current();
   await article.locator('[data-pattern-filters]:not([hidden])').waitFor();await article.locator('[data-signal-form]:not([hidden])').waitFor({state:'attached'});
   assert.equal(await article.locator('[data-pattern-rule]').count(),catalogue.rules.length);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Writing patterns must fit the viewport');
   await article.locator('[data-pattern-category]').selectOption('claims');
   const expected=catalogue.rules.filter(rule=>rule.category==='claims').length;
   assert.equal(await article.locator('[data-pattern-rule]:not([hidden])').count(),expected);
   await article.locator('[data-pattern-search]').fill('no-matching-writing-rule-unique');assert.equal(await article.locator('[data-pattern-rule]:not([hidden])').count(),0);
   await article.locator('[data-pattern-search]').fill('');await article.locator('[data-pattern-category]').selectOption('');
   assert.equal(await article.locator('[data-pattern-rule]:not([hidden])').count(),catalogue.rules.length);
   checks.push(`${locale} ${viewport.width}px: ${catalogue.rules.length} anti-patterns, combined search/category filtering and no horizontal page overflow.`);

   for(const rule of catalogue.rules){
    assert(rule.antiPattern?.name?.[locale]&&rule.antiPattern?.symptom?.[locale]&&rule.antiPattern?.readerCost?.[locale],'Every canonical rule needs an explicit localized anti-pattern.');
    const card=article.locator('[data-pattern-rule][id="'+locale+'-'+rule.id+'"]'),summary=card.locator(':scope > summary');
    assert((await summary.innerText()).includes(rule.antiPattern.name[locale]),'Closed summary must lead with the negative pattern name.');
    assert.equal(await summary.locator('.pattern-preview').innerText(),rule.examples[locale].before,'Concrete negative example must be visible before opening a rule.');
    if(await card.getAttribute('open')===null)await summary.click();
    const cost=card.locator('.pattern-cost');assert(await cost.isVisible());assert((await cost.innerText()).includes(rule.antiPattern.readerCost[locale]),'Reader cost must be visible after opening the anti-pattern.');
    assert((await card.locator('.pattern-remedy').innerText()).includes(rule.title[locale]),'Positive rule remains a remedy inside the details.');
    assert(await card.getByRole('heading',{name:locale==='de'?'Gegen-Prompt':'Counter-prompt',exact:true}).isVisible());
    assert.equal(await card.locator('.code-block code').first().textContent(),rule.prompt[locale],'Counter-prompt preserves the canonical full instructions.');
    await summary.click();
   }
   checks.push(locale+' '+viewport.width+'px: all '+catalogue.rules.length+' negative names and bad examples are visible upfront; opening each card reveals its reader cost, remedy and counter-prompt.');

   const signal=article.locator('[data-signal-form]');await signal.locator('xpath=..').locator('summary').click();
   await signal.locator('[data-signal-text]').fill(locale==='de'?'Es ist wichtig zu betonen: Git ist die bevorzugte Datenquelle. Dieser nahtlose Ablauf koennte Reviews erleichtern.':'It is worth noting that Git is the preferred source of record. This seamless workflow may generally make reviews easier.');await submit(signal);await signal.locator('[data-signal-results] li').first().waitFor();
   const status=await signal.locator('[data-signal-status]').textContent();assert(status.includes(locale==='de'?'für 8 Regeln':'for 8 rules'));assert(status.includes(locale==='de'?'Urheberschaft wurden nicht bewertet':'authorship were not assessed'));
   const source=await signal.locator('[data-signal-text]').inputValue();
   for(const item of await signal.locator('[data-signal-results] li').all()){
    const quote=await item.locator('q').textContent(),span=await item.locator('span').textContent(),match=span.match(/(\d+)–(\d+)/);assert(match);assert.equal(source.slice(Number(match[1]),Number(match[2])),quote);
   }
   await signal.locator('[data-signal-text]').fill(locale==='de'?'Öffne die Datei und speichere deine Entscheidung.':'Open the file and save your decision.');await submit(signal);assert.equal(await signal.locator('[data-signal-results] li').count(),0);
   assert((await signal.locator('[data-signal-status]').textContent()).startsWith('0 '));
   checks.push(`${locale} ${viewport.width}px: local signals expose exact UTF-16 quotes, eight-rule coverage, no-authorship boundary and honest zero matches.`);
   await signal.locator('xpath=..').locator('summary').click();

   const compose=article.locator('[data-prompt-form]');await compose.locator('xpath=..').locator('summary').click();
   assert.equal(await compose.locator('select option').count(),4);
   const audience=locale==='de'?'Entwickler <script>window.__PROMPT_EXECUTED=true</script>':'Developers <script>window.__PROMPT_EXECUTED=true</script>';
   await compose.locator('[data-prompt-audience]').fill(audience);
   for(const profile of catalogue.profiles){
    await compose.locator('[data-prompt-profile]').selectOption(profile.id);await submit(compose);await compose.locator('[data-prompt-result]:not([hidden])').waitFor();
    const code=await compose.locator('code').textContent();assert(code.includes(audience));
    const selected=[...code.matchAll(/^\[([^\]]+)\]/gm)].map(match=>match[1]);assert.equal(selected.length,6);assert.deepEqual([...selected].sort(),[...profile.ruleIds].sort());
    assert(code.includes(locale==='de'?'keinen Text automatisch':'do not rewrite text automatically'));assert(code.includes(locale==='de'?'ein bis drei':'one to three'));assert(code.includes(locale==='de'?'weder Autorschaft':'neither authorship'));assert(!code.includes('AI probability:'));
   }
   assert.equal(await compose.locator('script').count(),0);assert.equal(await page.evaluate(()=>window.__PROMPT_EXECUTED),undefined);
   const code=await compose.locator('code').textContent();await compose.locator('.copy-code').click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),code);
   checks.push(`${locale} ${viewport.width}px: all four six-rule profiles compose locally, user context remains text, exact prompt copy works.`);
   await compose.locator('xpath=..').locator('summary').click();
   await recordLinks();
  }
 }

 await page.setViewportSize({width:1440,height:1000});await language('en');
 const chosen=catalogue.rules[0],hash='#en-'+chosen.id;
 await page.goto(new URL('writing-patterns/'+hash,base).href,{waitUntil:'domcontentloaded'});
 await page.locator(hash+'[open]').waitFor();checks.push('Initial rule hash opens the native details section.');
 const search=current().locator('[data-pattern-search]');await search.fill('no-matching-writing-rule-unique');assert(await page.locator(hash).getAttribute('hidden')!==null);
 await current().locator('.pattern-profiles details > summary').click();await current().locator(`.pattern-profile-list a[href="${hash}"]`).first().click();
 await page.locator(hash+':not([hidden])[open]').waitFor();assert.equal(await search.inputValue(),'');checks.push('Clicking the same rule hash again clears an excluding filter and reopens the requested rule.');
 const deHash='#de-'+chosen.id;await page.goto(new URL('writing-patterns/'+deHash,base).href,{waitUntil:'domcontentloaded'});await page.locator(deHash+'[open]').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'de');checks.push('A German deep link selects German even when the prior preference was English.');
 await language('en');if(await current().locator('.pattern-rule').first().getAttribute('open')===null)await current().locator('.pattern-rule').first().locator('summary').first().click();
 const firstRule=current().locator('.pattern-rule').first();await firstRule.locator('.copy-code').click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),await firstRule.locator('code').textContent());checks.push('Individual rule prompt copy preserves its full text.');

 await page.goto(new URL('guides/verification/',base).href,{waitUntil:'domcontentloaded'});await language('en');
 assert.equal(await page.locator('.guide-content img').count(),0);assert.equal(await page.locator('.guide-article a[href$=".md"]').count(),0);
 const evidenceLinks=page.locator('.guide-content a[href$=".json"]'),recordCount=await evidenceLinks.count();assert.equal(recordCount,expectedVerificationRecords.length);assert.equal(await page.locator('.guide-content a[href]:not(.heading-anchor)').count(),recordCount);await evidenceLinks.first().click();
 const dialog=page.getByRole('dialog');await dialog.locator('pre:not([hidden])').waitFor();const rendered=await dialog.locator('code').textContent();assert.equal(JSON.stringify(JSON.parse(rendered),null,2),rendered);assert(page.url().includes('/guides/verification/'));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});checks.push('Actual Verification page lists all '+recordCount+' maintained JSON records and opens an in-place formatted dialog, without image/Markdown record links.');
 await recordLinks();

 await page.goto(new URL('studio/',base).href,{waitUntil:'domcontentloaded'});await language('en');
 const screenshots=current().locator('.studio-tour img');assert.equal(await screenshots.count(),3);
 for(const image of await screenshots.all()){
  await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());const src=await image.getAttribute('src');assert(/studio-(live-review|source|focus)\.png$/.test(src));
  assert(await image.evaluate(img=>img.complete&&img.naturalWidth>0));const metadataUrl=new URL(src.replace(/\.png$/,'.capture.json'),page.url()).href;const response=await context.request.get(metadataUrl);assert.equal(response.status(),200);const metadata=await response.json();assert(metadata.realProject===true&&metadata.readOnly===true);assert.equal(await image.evaluate(img=>img.naturalWidth),metadata.width);
 }checks.push('Studio page loads all three actual review/source/mobile PNG captures with matching read-only real-project metadata.');await recordLinks();
 await page.goto(new URL('docs/',base).href,{waitUntil:'domcontentloaded'});await recordLinks();await page.goto(base,{waitUntil:'domcontentloaded'});await recordLinks();
 for(const href of links){const response=await context.request.get(href);assert.equal(response.status(),200,'Broken local link: '+new URL(href).pathname);if(new URL(href).hash&&(response.headers()['content-type']||'').includes('text/html')){const found=await response.text(),id=decodeURIComponent(new URL(href).hash.slice(1));assert(found.includes(`id="${id}"`),'Broken local section: '+new URL(href).pathname+new URL(href).hash);}}
 checks.push(`${links.size} local writing, docs, Git, Studio and verification links/section targets resolve.`);

 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJs.newPage();await fallback.goto(new URL('writing-patterns/',base).href);assert.equal(await fallback.locator('article:not([hidden]) [data-pattern-rule]').count(),catalogue.rules.length);await fallback.locator('article:not([hidden]) [data-pattern-rule] summary').first().click();assert(await fallback.locator('article:not([hidden]) [data-pattern-rule] code').first().isVisible());await noJs.close();checks.push(catalogue.rules.length+' anti-patterns and their counter-prompts remain readable on mobile without JavaScript.');
 assert.deepEqual(errors,[]);assert(requests.every(request=>request.method==='GET'),'Public page controls must not send mutation or model requests');assert(requests.every(request=>new URL(request.url).origin===url.origin),'No public playground content is sent to another origin');
 checks.push('No browser exceptions, mutation requests or external uploads occurred.');
 const info=await(await context.request.get(new URL('build-info.json',base).href)).json();
 const output=path.join(root,'test-results/voice-website');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'writing-patterns.json'),JSON.stringify({capturedAt:new Date().toISOString(),scope:'Actual built public website in local Chrome; no Studio sessions, source edits or model calls.',checks,build:{builtAt:info.builtAt,inputs:info.inputs}},null,2)+'\n');
 console.log(`Writing patterns public UI: ${checks.length} checks passed, EN/DE at 1440/390px, profiles/signals/hash/filter/copy, JSON dialogs and three authentic Studio captures. No model calls or project writes.`);
}finally{await browser.close();}
