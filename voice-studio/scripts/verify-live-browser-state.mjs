import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

// Exercise the actual host component without starting a backend or model.
const compile = name => ts.transpileModule(fs.readFileSync(new URL('../frontend/src/app/'+name,import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true,
}).outputText;
const dictionary={exports:{}};vm.runInNewContext(compile('messages.browser.ts'),{exports:dictionary.exports});
let locale='en';
const translate=(source,params={})=>(locale==='en'?(dictionary.exports.browserMessages[source]??source):source).replace(/\{(\w+)\}/g,(match,key)=>params[key]??match);
const signal=initial=>{let value=initial;const result=()=>value;result.set=next=>{value=next;};result.update=fn=>{value=fn(value);};return result;};
const decorator=()=>value=>value;
const core={Component:decorator,Input:decorator,Output:decorator,ViewChild:decorator,signal,computed:fn=>fn,
  EventEmitter:class{values=[];emit(value){this.values.push(value);}},inject:()=>({run:fn=>fn(),t:translate,bypassSecurityTrustResourceUrl:value=>value})};
const module={exports:{}};
vm.runInNewContext(compile('live-browser.component.ts'),{exports:module.exports,require:name=>name==='@angular/core'?core:{},
  crypto:webcrypto,window:{location:{origin:'http://127.0.0.1:5188'},addEventListener(){},removeEventListener(){}},URL,clearInterval(){}});
const live=new module.exports.LiveBrowserComponent();
const unit={id:'u',text:'Exact source text.',sourceSpan:{start:0,end:18,encoding:'utf16'}};
const finding={id:'f',unitId:'u',start:0,end:5,quote:'Exact'};
live.project={id:'p',liveUrl:'http://127.0.0.1:4184/',sourceRoutes:{'/':'home.ts'}};
live.detail={id:'doc',path:'home.ts',version:'v1',reviewRevision:0,units:[unit],findings:[finding],feedback:[]};
live.documents=[live.detail];live.expectedOrigin='http://127.0.0.1:4184';live.currentUrl.set(live.expectedOrigin+'/');live.bridgeReady.set(true);
const posts=[],peer={postMessage:message=>posts.push(message)};live.liveFrame={nativeElement:{contentWindow:peer}};
const mapping=diagnostics=>live.onMessage({source:peer,origin:live.expectedOrigin,data:{type:'voice-studio:mapping',sessionId:live.sessionId,reviewId:live.reviewId,diagnostics}});
live.sendReview();
assert(!live.sourceMatched.values.includes(true),'A selected source alone is not a successful live match');
mapping({mappedUnits:0,missingUnitIds:['u'],unmappedFindingIds:['f'],unmappedFeedbackIds:[]});
assert.equal(live.sourceMatched.values.at(-1),false);
assert.match(live.markerNote(),/0 of 1 source text sections/);
assert.match(live.markerNote(),/No source text uniquely matches/);
mapping({mappedUnits:1,missingUnitIds:[],unmappedFindingIds:[],unmappedFeedbackIds:[]});
assert.equal(live.sourceMatched.values.at(-1),true);
assert.match(live.markerNote(),/1 of 1 findings/);
assert.match(live.markerNote(),/further down the page/);
locale='de';assert.match(live.markerNote(),/1 von 1 Befunden/,'Existing diagnostic changes language without reconnecting');
assert.equal(live.detail.units[0].text,'Exact source text.','UI language never rewrites source');
live.toggleMarks();assert.equal(live.sourceMatched.values.at(-1),false);assert.equal(posts.at(-1).units.length,0);
assert.match(live.markerNote(),/Markierungen sind ausgeblendet/);
locale='en';assert.match(live.markerNote(),/Marks are hidden/);
live.toggleMarks();mapping({mappedUnits:1,unmappedFindingIds:['f'],unmappedFeedbackIds:[]});
assert.match(live.markerNote(),/outside the matched text/);
live.detail={...live.detail,findings:[]};live.sendReview();mapping({mappedUnits:1,unmappedFindingIds:[],unmappedFeedbackIds:[]});
assert.match(live.markerNote(),/no findings or open feedback/);
live.currentUrl.set(live.expectedOrigin+'/no-source');live.sendReview();mapping({mappedUnits:0,unmappedFindingIds:[],unmappedFeedbackIds:[]});
assert.match(live.markerNote(),/No source is assigned/);
assert.equal(live.sourceMatched.values.at(-1),false);
live.ngOnDestroy();
console.log('PASS confirmed mapping eligibility, zero/excluded findings, hidden marks, missing route, and reactive EN/DE diagnostics without source changes.');
