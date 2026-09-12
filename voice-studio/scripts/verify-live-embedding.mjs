import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Isolated browser fixtures: no backend writes, pairing secrets, or model calls.
const library = await fs.readFile(new URL('../packages/review/dist/voice-review.js', import.meta.url));
let origin;
const server = http.createServer((request, response) => {
  const route = new URL(request.url, origin).pathname;
  if (route === '/library.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(library); return; }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  const style = '<style>html,body{margin:0;height:100%;font:20px Arial}iframe{border:0;width:100%;height:100%}p{margin:20px}</style>';
  if (route === '/outer') { response.end(`${style}<iframe title="Webview" sandbox="allow-scripts allow-same-origin allow-forms" src="${origin}/webview"></iframe>`); return; }
  if (route === '/webview') { response.end(`${style}<iframe title="Embedded studio" src="/studio"></iframe>`); return; }
  if (route === '/studio') {
    response.end(`${style}<iframe title="Live website" src="/website"></iframe><script>
      const sessionId='fixture-session-123456',reviewId='fixture-review';
      const unit={id:'fixture-unit',text:'Exact source text.',sourceSpan:{start:0,end:18,encoding:'utf16'}};
      const finding={id:'fixture-finding',unitId:unit.id,start:0,end:5,quote:'Exact',category:'wording'};
      window.addEventListener('message',event=>{
        if(event.origin!==location.origin||event.source!==document.querySelector('iframe').contentWindow)return;
        if(event.data.type==='voice-studio:ready')event.source.postMessage({type:'voice-studio:review',sessionId,reviewId,pageUrl:event.data.url,units:[unit,{...unit,id:'screenshot-unit',text:'Screenshot-only text'}],findings:[finding],feedback:[]},location.origin);
        if(event.data.type==='voice-studio:mapping')window.mapping=event.data.diagnostics;
      });
      document.querySelector('iframe').addEventListener('load',()=>document.querySelector('iframe').contentWindow.postMessage({type:'voice-studio:connect',sessionId},location.origin));
    </script>`); return;
  }
  response.end(`${style}<p>Exact source text.</p><p data-voice-exclude>Screenshot-only text</p><div style="height:1200px"></div><script src="/library.js"></script><script>VoiceReview.connectVoiceStudio({studioOrigin:location.origin});</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  for (const route of ['/studio','/outer']) {
    const page = await browser.newPage({viewport:{width:1280,height:850}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    // A different loopback hostname gives the outer webview a separate site/origin.
    await page.goto((route==='/outer'?origin.replace('127.0.0.1','localhost'):origin)+route);
    const studio=route==='/studio'?page.mainFrame():await (await page.frameLocator('iframe').frameLocator('iframe').locator('body').elementHandle()).ownerFrame();
    await studio.waitForFunction(()=>window.mapping);
    const website=page.frames().find(frame=>frame.url()===origin+'/website');
    await website.locator('[data-voice-mark="fixture-finding"]').waitFor();
    const validate=async()=> {
      const state=await website.evaluate(()=>{
        const mark=document.querySelector('[data-voice-mark]'),text=document.querySelector('[data-voice-unit]');
        const range=document.createRange();range.setStart(text.firstChild,0);range.setEnd(text.firstChild,5);
        const markRect=mark.getBoundingClientRect(), textRect=range.getBoundingClientRect(),overlay=mark.parentElement;
        return {left:markRect.left,expectedLeft:textRect.left,top:markRect.top,expectedTop:textRect.bottom-1,width:markRect.width,expectedWidth:textRect.width,border:getComputedStyle(mark).borderBottomWidth,overlayWidth:overlay.getBoundingClientRect().width,viewportWidth:innerWidth};
      });
      assert(Math.abs(state.left-state.expectedLeft)<1,JSON.stringify(state));
      assert(Math.abs(state.top-state.expectedTop)<1,JSON.stringify(state));
      assert(Math.abs(state.width-state.expectedWidth)<1,JSON.stringify(state));
      assert.equal(state.border,'2px');assert.equal(state.overlayWidth,state.viewportWidth);
    };
    await validate();
    const diagnostics=await studio.evaluate(()=>window.mapping);
    assert.equal(diagnostics.mappedUnits,1);assert.deepEqual(diagnostics.missingUnitIds,['screenshot-unit']);
    await page.setViewportSize({width:760,height:650});await page.waitForTimeout(100);await validate();
    await website.evaluate(()=>scrollTo(0,300));
    await website.waitForFunction(()=>document.querySelectorAll('[data-voice-mark]').length===0,null,{polling:50,timeout:5000});
    assert.equal(await website.locator('[data-voice-mark]').count(),0,'Offscreen findings are clipped');
    await website.evaluate(()=>scrollTo(0,0));await website.locator('[data-voice-mark]').waitFor();await validate();
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS exact marker geometry in standalone and nested sandboxed frames, resize, scroll clipping/repaint, and excluded text; no backend writes or model calls.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
