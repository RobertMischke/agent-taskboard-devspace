// Tests the actual renderer and viewer assets in an isolated loopback fixture.
// No product build, running Studio, project mutation or model call is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {renderGuide} from './render-guide.mjs';
import {guides} from './guides.mjs';
import {marked} from 'marked';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const guide=guides.find(item=>item.slug==='verification');
const sourceTargets=new Map(guides.map(item=>[item.source,`guides/${item.slug}/`]));
const records=new Map();
const historical='docs/verification/2026-09-12';
const manifest=JSON.parse(await fs.readFile(path.join(root,historical,'manifest.json'),'utf8'));
for(const item of manifest.files){if(!(item.path||item.file).endsWith('.json'))continue;const name=item.path||item.file;const source=`${historical}/${name}`,target=`sources/verification/${name}`;sourceTargets.set(source,target);records.set('/voice/'+target,await fs.readFile(path.join(root,source),'utf8'));}
sourceTargets.set(historical+'/manifest.json','sources/verification/manifest.json');records.set('/voice/sources/verification/manifest.json',JSON.stringify(manifest));
const followup='docs/verification/2026-09-12-browser-and-website/website.json';sourceTargets.set(followup,'sources/verification-follow-up/website.json');records.set('/voice/sources/verification-follow-up/website.json',await fs.readFile(path.join(root,followup),'utf8'));
const writingEvidence='docs/verification/2026-09-12-writing-rules-and-docs';
for(const name of ['website.json','writing-patterns.json','json-viewer.json','manifest.json']){
 const source=writingEvidence+'/'+name,target='sources/verification-writing/'+name;
 sourceTargets.set(source,target);records.set('/voice/'+target,await fs.readFile(path.join(root,source),'utf8'));
}
const markdown=await fs.readFile(path.join(root,guide.source),'utf8');
const expectedRecords=[];marked.walkTokens(marked.lexer(markdown),token=>{if(token.type==='link')expectedRecords.push(token.href);});
assert(expectedRecords.length>0&&expectedRecords.every(href=>/\.json$/.test(href)),'The maintained evidence list must contain only JSON record links.');
const expectedRecordPaths=expectedRecords.map(href=>{const source=path.posix.normalize(path.posix.join(path.posix.dirname(guide.source),href)),target=sourceTargets.get(source);assert(target,'Missing fixture mapping for a listed evidence record');JSON.parse(records.get('/voice/'+target));return '/voice/'+target;});
const rendered=renderGuide(guide,markdown,sourceTargets);
const fixtureLinks='<nav aria-label="Viewer test fixtures">'+['dangerous','invalid','missing','slow','large'].map(name=>`<a href="/voice/test-${name}.json">Fixture ${name}</a>`).join(' ')+'</nav>';
const html=rendered.replace('</main>',fixtureLinks+'</main>');
const assets=new Map();for(const file of ['site.js','site.css','docs.css','json-viewer.js','json-viewer.css'])assets.set('/voice/'+file,await fs.readFile(path.join(root,'website',file)));
let invalidAttempts=0;const slow=[],methods=[],errors=[],checks=[];
const dangerous={text:'</code><img src=x onerror="window.__JSON_EXECUTED=true"><script>window.__JSON_EXECUTED=true</script>',nested:{list:[1,true,null]},long:'x'.repeat(900)};
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url,'http://fixture').pathname;methods.push(request.method);
 if(pathname==='/voice/guides/verification/'){response.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
 if(assets.has(pathname)){response.writeHead(200,{'Content-Type':pathname.endsWith('.css')?'text/css':'text/javascript'}).end(assets.get(pathname));return;}
 if(records.has(pathname)){response.writeHead(200,{'Content-Type':'application/json'}).end(records.get(pathname));return;}
 if(pathname==='/voice/test-dangerous.json'){response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(dangerous));return;}
 if(pathname==='/voice/test-invalid.json'){response.writeHead(200,{'Content-Type':'application/json'}).end(++invalidAttempts===1?'not valid JSON':JSON.stringify({recovered:true}));return;}
 if(pathname==='/voice/test-slow.json'){response.writeHead(200,{'Content-Type':'application/json'});response.flushHeaders();slow.push(response);return;}
 if(pathname==='/voice/test-large.json'){response.writeHead(200,{'Content-Type':'application/json','Content-Length':3*1024*1024});response.flushHeaders();return;}
 response.writeHead(404,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Fixture missing'}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/voice/guides/verification/';
const browser=await chromium.launch({channel:'chrome',headless:true,timeout:15000});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('a[href$="baseline-checks.json"][data-json-viewer]').waitFor();
 assert.equal(await page.locator('.guide-content img').count(),0);assert.equal(await page.locator('.guide-article a[href$=".md"]').count(),0);
 const links=await page.locator('.guide-content a[href]:not(.heading-anchor)').evaluateAll(items=>items.map(item=>item.href));assert.deepEqual(links.map(href=>new URL(href).pathname).sort(),[...expectedRecordPaths].sort());assert(links.every(href=>new URL(href).pathname.endsWith('.json')));checks.push('Verification content matches all '+links.length+' dated JSON record links in the maintained list, with no image or Markdown links.');
 const baseline=page.locator('a[href$="baseline-checks.json"]');await baseline.click();
 const dialog=page.getByRole('dialog');await dialog.locator('pre:not([hidden])').waitFor();
 assert.equal(page.url(),url);assert.equal(await dialog.locator('code').textContent(),JSON.stringify(JSON.parse(records.get('/voice/sources/verification/reports/baseline-checks.json')),null,2));checks.push('Actual retained record opens in-place and is formatted with two-space indentation.');
 assert.equal(await page.evaluate(()=>document.activeElement.className),'json-viewer-close');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'PRE');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'json-viewer-close');checks.push('Native modal keeps keyboard focus within Close and the keyboard-scrollable JSON region.');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await baseline.evaluate(link=>document.activeElement===link));await page.waitForFunction(()=>!document.documentElement.classList.contains('json-viewer-open'));checks.push('Escape closes the dialog, restores link focus and restores page scrolling.');
 await page.getByRole('link',{name:'Fixture dangerous',exact:true}).click();await dialog.locator('pre:not([hidden])').waitFor();
 assert.equal(await dialog.locator('code').textContent(),JSON.stringify(dangerous,null,2));assert.equal(await dialog.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.__JSON_EXECUTED),undefined);checks.push('HTML-looking JSON values remain escaped text and never execute.');
 await page.setViewportSize({width:390,height:844});const box=await dialog.boundingBox();assert(box.x>=7&&box.width<=375&&box.y>=7&&box.height<=829);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await dialog.locator('pre').evaluate(el=>el.scrollWidth>el.clientWidth));checks.push('Mobile modal fits the viewport and long JSON lines scroll inside the record.');
 await dialog.getByRole('button',{name:'Close JSON record',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('link',{name:'Fixture invalid',exact:true}).click();await dialog.getByText('This file does not contain valid JSON.',{exact:true}).waitFor();assert.equal(await dialog.locator('code').textContent(),'');await dialog.getByRole('button',{name:'Try again',exact:true}).click();await dialog.locator('pre:not([hidden])').waitFor();assert.equal(await dialog.locator('code').textContent(),'{\n  "recovered": true\n}');checks.push('Malformed JSON has a clear error, clears prior content and can be retried.');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.getByRole('link',{name:'Fixture large',exact:true}).click();await dialog.getByText('This record is too large to display (limit: 2 MB).',{exact:true}).waitFor();checks.push('Oversize responses are bounded before JSON parsing.');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.getByRole('link',{name:'Fixture slow',exact:true}).click();await dialog.getByText('Loading JSON record…',{exact:true}).waitFor();assert.equal(await dialog.getAttribute('aria-busy'),'true');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await baseline.click();await dialog.locator('pre:not([hidden])').waitFor();for(const response of slow.splice(0))if(!response.destroyed)response.end('{"stale":true}');assert(!(await dialog.locator('code').textContent()).includes('"stale": true'));checks.push('Loading state is announced; closing aborts a pending record and late data cannot replace the next record.');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'DE',exact:true}).click();await page.getByRole('link',{name:'Fixture missing',exact:true}).click();await dialog.getByText('Der JSON-Beleg konnte nicht geladen werden. Bitte erneut versuchen.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'JSON-Beleg schließen',exact:true}).click();checks.push('Missing records and dialog controls support German interface language.');
 const noJs=await browser.newContext({javaScriptEnabled:false});const fallback=await noJs.newPage();await fallback.goto(url);await fallback.locator('a[href$="baseline-checks.json"]').click();assert(fallback.url().endsWith('/baseline-checks.json'));await noJs.close();checks.push('Without JavaScript each record remains a normal JSON link.');
 assert.deepEqual(errors,[]);assert(methods.every(method=>method==='GET'));checks.push('No browser exceptions; fixture requests are read-only GETs.');
 const output=path.join(root,'test-results/voice-website');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'json-viewer.json'),JSON.stringify({capturedAt:new Date().toISOString(),scope:'Actual documentation renderer and viewer modules in an isolated loopback fixture; no running Studio, product build, project writes or model calls.',checks},null,2)+'\n');
 console.log(`JSON viewer: ${checks.length} focused browser checks passed; actual modules, isolated loopback fixture, no project writes or model calls.`);
}finally{await browser.close();for(const response of slow)response.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
