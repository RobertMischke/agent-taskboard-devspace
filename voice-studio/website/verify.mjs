import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {JSDOM} from 'jsdom';
import {pages} from './site.mjs';
import {guides} from './guides.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'test-results/voice-website');await fs.mkdir(output,{recursive:true});
const base='http://127.0.0.1:5187/voice/',errors=[],checked=[],verifiedLinks=new Set();
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({locale:'de-DE',permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 async function links(){
  for(const href of await page.locator('a[href],img[src],link[rel=stylesheet],script[src]').evaluateAll(els=>els.map(el=>el.href||el.src))){
   if(!href.startsWith(base)||verifiedLinks.has(href))continue;
   const url=new URL(href);const response=await context.request.get(url.href);assert.equal(response.status(),200,href);
   if(url.hash&&(response.headers()['content-type']||'').includes('text/html')){
    const doc=new JSDOM(await response.text()).window.document;
    assert(doc.getElementById(decodeURIComponent(url.hash.slice(1))),`Missing fragment: ${href}`);
   }
   verifiedLinks.add(href);
  }
 }
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const route of [...pages.map(p=>({slug:p.slug,guide:false})),...guides.map(g=>({slug:'guides/'+g.slug,guide:true}))]){
   const response=await page.goto(base+(route.slug?route.slug+'/':''),{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
   assert((response.headers()['content-type']||'').startsWith('text/html'));
   if(!checked.length)assert.equal(await page.locator('html').getAttribute('lang'),'en');
   for(const language of ['en','de']){
    await page.getByRole('button',{name:language.toUpperCase(),exact:true}).click();
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.locator('article:not([hidden]) h1').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route.slug} ${language} ${size.width}: horizontal page overflow`);
    assert.equal(await page.locator('article:not([hidden]) a[href$=".md"]:not([download])').evaluateAll(els=>els.filter(el=>new URL(el.href).origin===location.origin).length),0,route.slug+': primary internal guide links must be HTML');
    if(route.guide){assert.equal(await page.locator('.guide-article').getAttribute('lang'),'en');assert(await page.locator('.guide-content h2').count()>0);}
    checked.push({route:route.slug||'home',language,width:size.width});
   }
   await links();
   for(const img of await page.locator('article:not([hidden]) img').all())assert(await img.evaluate(el=>el.complete&&el.naturalWidth>0),'Image must load');
   if(route.slug===''){
    const pane=await page.locator('article:not([hidden]) .product-pane').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
    assert.equal(pane.length,2);assert(Math.abs(pane[0].width-pane[1].width)<=1,'UI/code equal column widths');
    if(size.width>700)assert(Math.abs(pane[0].y-pane[1].y)<=1,'UI/code side by side');else assert(pane[1].y>pane[0].y,'UI/code mobile stack');
   }
   if(['','library','guides/library-types','guides/agent-integration'].includes(route.slug))await page.screenshot({path:path.join(output,`${route.slug.replaceAll('/','-')||'home'}-${size.width}.png`),fullPage:true});
  }
 }
 await page.goto(base+'library/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'EN',exact:true}).click();
 const demo=page.locator('article:not([hidden]) .demo');await demo.locator('[data-voice-unit]').waitFor();await page.locator('[data-voice-overlay] > *').first().waitFor();
 await demo.getByRole('checkbox',{name:'Show marks'}).uncheck();await demo.getByText('Marks hidden.',{exact:true}).waitFor();
 await demo.getByRole('checkbox',{name:'Show marks'}).check();await demo.getByText('Marks visible.',{exact:true}).waitFor();
 await demo.locator('[data-voice-unit]').evaluate(el=>{const range=document.createRange();range.setStart(el.firstChild,4);range.setEnd(el.firstChild,12);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
 await page.waitForFunction(()=>document.querySelector('article:not([hidden]) .demo-output')?.textContent?.includes('"quote"'));
 assert((await demo.locator('output').textContent()).includes('powerful'));
 const original=await demo.locator('[data-voice-unit]').textContent();await page.getByRole('button',{name:'DE',exact:true}).click();assert.equal(await page.locator('article:not([hidden]) [data-voice-unit]').textContent(),original);
 await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('html').getAttribute('lang'),'de');
 await page.goto(base+'guides/library-types/');const code=page.locator('.code-block').first();await code.getByRole('button',{name:'Kopieren',exact:true}).click();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'),await code.locator('code').textContent(),'Copy preserves code text (native Windows newlines normalized)');
 assert.equal((await context.request.get(base+'sources/site.mjs')).status(),404,'Obsolete publication input must be absent');
 const png=await context.request.get(base+'assets/studio-review.png');assert.equal(png.headers()['content-type'],'image/png');
 const info=await(await context.request.get(base+'build-info.json')).json();assert(info.git.commit);assert(info.inputs['docs/agent-integration.md']);assert(info.inputs['website/assets/studio-review.png']);assert.equal(info.routes.length,pages.length+guides.length);
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJs.newPage();await fallback.goto(base);assert.equal(await fallback.locator('article:not([hidden]) h1').textContent(),'Review the words.Keep the intent.');await fallback.goto(base+'guides/library-types/');assert(await fallback.locator('.guide-content pre').count()>0);assert(await fallback.getByRole('link',{name:'Mount the review library',exact:true}).isVisible());await noJs.close();
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({capturedAt:new Date().toISOString(),views:checked,localLinks:verifiedLinks.size,errors,libraryDemo:'actual bundle, marks toggle, native selection, language switch',guideFeatures:'HTML, local routes and fragments, source download, exact code copy, responsive navigation',homepage:'real UI screenshot and equal-width typed code panels',noJavaScript:'English content and all guide navigation available',build:{builtAt:info.builtAt,inputs:info.inputs},git:info.git},null,2)+'\n');
 console.log(`PASS ${checked.length} route/language/viewport views, ${verifiedLinks.size} local links/assets/fragments, HTML guides, exact copy, real library selection/marks, saved language and no-JS content. No browser errors or model calls.`);
}finally{await browser.close()}
