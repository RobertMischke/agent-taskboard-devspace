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
assert.equal(pages.length,6,'Six native product pages are published');assert.equal(guides.length,16,'Sixteen maintained guides are published');
assert(!pages.some(page=>page.slug==='project-reviews'),'Project reviews must only remain as a compatibility redirect');
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
 async function navigation(route,language){
  const nav=page.locator('.site-nav'),tools=nav.locator('.nav-tools'),resources=nav.locator('.nav-resources');
  assert.equal(await tools.count(),1);assert.equal(await resources.count(),1);
  for(const group of [tools,resources]){assert.equal(await group.getAttribute('role'),'group');assert(await group.getAttribute('aria-label'));}
  const entries=[{group:tools,slugs:['studio','library'],labels:['Studio','Library']},{group:resources,slugs:['research','writing-patterns','docs'],labels:language==='de'?['Forschung','KI-Negativmuster','Doku']:['Research','AI anti-patterns','Docs']}];
  for(const {group,slugs,labels} of entries){
   const items=await group.locator('a').all();assert.equal(items.length,slugs.length);
   for(let i=0;i<items.length;i++){assert(await items[i].isVisible());assert.equal(await items[i].innerText(),labels[i]);assert.equal(await items[i].evaluate(link=>link.href),base+slugs[i]+'/');await items[i].focus();assert(await items[i].evaluate(link=>document.activeElement===link),'Header links must be keyboard focusable');}
  }
  const current=nav.locator('[aria-current="page"]'),expected=route.guide?'docs':route.slug;
  assert.equal(await current.count(),expected?1:0,'Header current-page state must match route');if(expected)assert.equal(await current.evaluate(link=>link.href),base+expected+'/');
  assert.equal(await nav.locator('a[href*="project-reviews"]').count(),0,'Obsolete page must not remain in navigation');
 }
 async function homeGitAndNavigation(language){
  const home=page.locator('article:not([hidden])'),git=home.locator('.home-git');assert(await git.isVisible());assert((await git.innerText()).includes('Git'));assert.equal(await git.locator('code').first().textContent(),'.voice-lint/');
  const tree=git.locator('a[href*="guides/workflow/"]');assert.equal(await tree.count(),1);assert.equal(new URL(await tree.evaluate(link=>link.href)).hash,'#saved-tasks-and-decisions');
  await tree.click();await page.locator('#saved-tasks-and-decisions').waitFor();assert((await page.locator('.guide-content').innerText()).includes('.voice-lint/'),'File-tree destination must explain saved project records');await page.goto(base,{waitUntil:'domcontentloaded'});
  for(const group of ['.nav-tools','.nav-resources']){
   const link=page.locator('.site-nav '+group+' a').first(),target=await link.evaluate(element=>element.href);await link.focus();await link.press('Enter');await page.waitForURL(target);assert.equal(await page.locator('.site-nav [aria-current="page"]').evaluate(element=>element.href),target);assert.equal(await page.locator('html').getAttribute('lang'),language);await page.goto(base,{waitUntil:'domcontentloaded'});
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
    await navigation(route,language);if(route.slug==='')await homeGitAndNavigation(language);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route.slug} ${language} ${size.width}: horizontal page overflow`);
    assert.equal(await page.locator('article:not([hidden]) a[href$=".md"]:not([download])').evaluateAll(els=>els.filter(el=>new URL(el.href).origin===location.origin).length),0,route.slug+': primary internal guide links must be HTML');
    if(route.guide){assert.equal(await page.locator('.guide-article').getAttribute('lang'),'en');assert(await page.locator('.guide-content h2').count()>0);}
    checked.push({route:route.slug||'home',language,width:size.width});
   }
   await links();
   for(const img of await page.locator('article:not([hidden]) img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert(await img.evaluate(el=>el.complete&&el.naturalWidth>0),'Image must load');}
   if(route.slug===''){
    const pane=await page.locator('article:not([hidden]) .product-pane').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
    assert.equal(pane.length,2);assert(Math.abs(pane[0].width-pane[1].width)<=1,'UI/code equal column widths');
    if(size.width>700)assert(Math.abs(pane[0].y-pane[1].y)<=1,'UI/code side by side');else assert(pane[1].y>pane[0].y,'UI/code mobile stack');
   }
   if(['','studio','docs','writing-patterns','library','guides/workflow','guides/library-types','guides/agent-integration'].includes(route.slug))await page.screenshot({path:path.join(output,`${route.slug.replaceAll('/','-')||'home'}-${size.width}.png`),fullPage:true});
  }
 }
 await page.goto(base+'library/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'EN',exact:true}).click();
 const demo=page.locator('article:not([hidden]) .demo');await demo.locator('[data-voice-unit]').waitFor();await demo.scrollIntoViewIfNeeded();await page.locator('[data-voice-overlay] > *').first().waitFor();
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
 const sitemapResponse=await context.request.get(base+'sitemap.xml');assert.equal(sitemapResponse.status(),200);const sitemap=new JSDOM(await sitemapResponse.text(),{contentType:'application/xml'}).window.document;const sitemapUrls=[...sitemap.querySelectorAll('loc')].map(node=>node.textContent);assert.equal(sitemapUrls.length,22);assert(!sitemapUrls.some(url=>url.includes('/project-reviews/')),'Redirect alias must not be indexed');
 const aliasResponse=await context.request.get(base+'project-reviews/');assert.equal(aliasResponse.status(),200);const aliasDoc=new JSDOM(await aliasResponse.text()).window.document;assert.equal(aliasDoc.querySelector('meta[name="robots"]')?.content,'noindex');assert(aliasDoc.querySelector('meta[http-equiv="refresh"]'),'Existing bookmarks must use a native browser redirect');
 await page.goto(base+'project-reviews/',{waitUntil:'domcontentloaded'});await page.waitForURL(base);assert(await page.locator('article:not([hidden]) .home-git').isVisible(),'Legacy URL must really land on homepage Git content');
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJs.newPage();await fallback.goto(base+'project-reviews/');await fallback.waitForURL(base);assert.equal(await fallback.locator('.site-nav .nav-tools a').count(),2);assert.equal(await fallback.locator('.site-nav .nav-resources a').count(),3);assert.equal(await fallback.locator('article:not([hidden]) h1').textContent(),'Review the words.Keep the intent.');await fallback.goto(base+'guides/library-types/');assert(await fallback.locator('.guide-content pre').count()>0);assert(await fallback.getByRole('link',{name:'Mount the review library',exact:true}).isVisible());await noJs.close();
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({capturedAt:new Date().toISOString(),views:checked,localLinks:verifiedLinks.size,errors,libraryDemo:'actual bundle, marks toggle, native selection, language switch',guideFeatures:'HTML, local routes and fragments, source download, exact code copy, responsive navigation',homepage:'real UI screenshot, equal-width typed code panels and Git records linked to the file tree',header:'Two tool links and three resource links, keyboard navigation, localized labels and current-page state at both viewport sizes',legacyRoute:'project-reviews redirects to homepage with and without JavaScript and is absent from the 22-route sitemap',noJavaScript:'English content, grouped navigation, legacy redirect and all guide navigation available',build:{builtAt:info.builtAt,inputs:info.inputs},git:info.git},null,2)+'\n');
 console.log(`PASS ${checked.length} route/language/viewport views, ${verifiedLinks.size} local links/assets/fragments, HTML guides, exact copy, real library selection/marks, saved language and no-JS content. No browser errors or model calls.`);
}finally{await browser.close()}
