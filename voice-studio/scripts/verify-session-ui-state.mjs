// Session lifecycle on the real AppComponent with deferred fake HTTP only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const reply=(status,body={})=>({status,ok:status>=200&&status<300,json:async()=>body});
const session=(token='browser-token')=>({token,remembered:true,expiresAt:'2030-01-01T00:00:00Z'});
function create(fetcher){
 const signal=initial=>{let value=initial;const get=()=>value;get.set=next=>value=next;get.update=change=>value=change(value);return get;};
 const decorator=()=>value=>value;
 const core={Component:decorator,ViewChild:decorator,HostListener:decorator,signal,computed:fn=>fn,inject:()=>({locale:()=> 'en',t:value=>value})};
 const source=fs.readFileSync(new URL('../frontend/src/app/app.component.ts',import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(output,{exports:module.exports,require:id=>id==='@angular/core'?core:{},fetch:fetcher,URLSearchParams,URL,Intl,location:{search:'',href:'http://127.0.0.1:5188/'},history:{state:null,replaceState(){}},setTimeout,clearTimeout,console});
 return new module.exports.AppComponent();
}
{
 let posts=0;const app=create(async(path,options)=>{check(options.credentials==='same-origin','Session calls explicitly use same-origin cookies.');check(options.headers['X-Voice-Studio-Session']==='1','Session calls carry the non-simple browser-intent header.');posts++;return reply(200,{paired:false});});
 await app.restoreSession();check(!app.connected()&&!app.resumingSession()&&posts===1,'Fresh browser remains unpaired after one bounded resume attempt.');
}
{
 const app=create(async path=>reply(200,path.endsWith('/resume')?session():[]));await app.restoreSession();
 check(app.connected()&&app.token==='browser-token'&&app.rememberedUntil()===session().expiresAt,'Remembered login restores bearer only in component memory.');
}
{
 const calls=[];const app=create(async(path,options)=>{calls.push([path,options.method]);return path.endsWith('/resume')?reply(200,{paired:false}):reply(401,{error:'Pairing needed'});});
 app.acceptSession(session());app.selectedProject.set({id:'p'});app.document.set({id:'doc'});
 await assert.rejects(app.semanticApi('/api/projects/p/checks'));checks++;
 check(!app.connected()&&app.token===''&&app.document()===null&&app.selectedProject()===null,'Terminal 401 from a child component centrally clears session and returns to pairing.');
 check(app.error().includes('abgelaufen')&&calls.length===2,'Expiry is shown without relying on a root action error handler.');
}
{
 let gets=0,resumes=0;const app=create(async path=>path.endsWith('/resume')?(resumes++,reply(200,session('fresh-token'))):++gets===1?reply(401):reply(200,['loaded']));app.acceptSession(session('old-token'));
 check((await app.semanticApi('/api/projects')).length===1&&app.connected()&&app.token==='fresh-token'&&gets===2&&resumes===1,'Backend token rotation silently restores and retries a read exactly once.');
}
{
 let writes=0;const app=create(async(path,options)=>path.endsWith('/resume')?reply(200,session('fresh-token')):(writes++,reply(401)));app.acceptSession(session('old-token'));
 await assert.rejects(app.semanticApi('/api/projects/p/suggestions','POST',{requestId:'unchanged'}),/wiederhergestellt/);checks++;
 check(writes===1&&app.connected()&&app.token==='fresh-token','Restored session never automatically replays a mutation or model launch.');
}
{
 const late=deferred();let gets=0;const app=create(async()=>++gets===1?late.promise:reply(200,['current']));app.acceptSession(session('old-token'));const reading=app.semanticApi('/api/projects');
 app.acceptSession(session('new-token'));late.resolve(reply(401));await reading;
 check(app.connected()&&app.token==='new-token'&&gets===2,'Late unauthorized read from an older session cannot clear a newer login.');
}
{
 const pending=deferred();const app=create(async path=>path.endsWith('/resume')?pending.promise:reply(204));app.acceptSession(session());
 const restoring=app.resumeToken();await app.logout();pending.resolve(reply(200,session('late-token')));await restoring;
 check(!app.connected()&&app.token===''&&app.rememberedUntil()===null,'Late resume response cannot sign the browser back in after logout.');
}
{
 let resumeCalls=0;const pending=deferred();const app=create(async()=>{resumeCalls++;return pending.promise;});
 const first=app.resumeToken(),second=app.resumeToken();pending.resolve(reply(200,session()));await Promise.all([first,second]);
 check(resumeCalls===1&&app.connected(),'Concurrent callers share one resume request.');
}
{
 const pending=deferred();const app=create(async path=>path.endsWith('/resume')?pending.promise:reply(401));app.acceptSession(session('old-token'));
 const reading=app.semanticApi('/api/projects').catch(error=>error);
 for(let i=0;i<5;i++)await Promise.resolve();
 app.clearSession();app.acceptSession(session('new-token'));pending.resolve(reply(200,session('too-late')));
 const error=await reading;app.handleError(error);
 check(error.status!==401&&app.connected()&&app.token==='new-token','Late resume result after a new login cannot pass an old 401 to the root handler.');
}
{
 const body=deferred();const app=create(async path=>path.endsWith('/resume')?reply(200,{paired:false}):{status:401,ok:false,json:()=>body.promise});app.acceptSession(session('old-token'));
 const reading=app.semanticApi('/api/projects').catch(error=>error);
 for(let i=0;i<20;i++)await Promise.resolve();
 check(!app.connected(),'Terminal auth failure clears the old login before awaiting an error body.');
 app.acceptSession(session('new-token'));body.resolve({error:'Old unauthorized body'});app.handleError(await reading);
 check(app.connected()&&app.token==='new-token','Late unauthorized JSON body cannot sign out a newly paired browser.');
}
console.log(`Session UI state: ${checks} checks passed; actual component methods, fake HTTP only, no backend writes or model calls.`);
