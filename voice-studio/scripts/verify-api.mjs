import { readSession } from './session.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.VOICE_STUDIO_URL ?? 'http://127.0.0.1:5188';
const session = await readSession(root);
async function api(url, method='GET', body, expected=200) {
  const response = await fetch(base+url,{method,headers:{Authorization:`Bearer ${session.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const text = await response.text();
  assert.equal(response.status,expected,`${method} ${url}: ${text.slice(0,500)}`);
  return text ? JSON.parse(text) : null;
}
const savedPath = path.join(root,'.voice-studio/e2e-last.json');
if(process.argv.includes('--verify-restart')) {
  const saved=JSON.parse(await fs.readFile(savedPath,'utf8'));
  const doc=await api(saved.route);
  assert.equal(doc.feedback.find(f=>f.id===saved.feedbackId)?.comment,'Keep the concrete capability; remove the evaluative adjective.');
  assert(doc.source.includes('useful tools'));
  console.log('PASS backend restart retains feedback, source edit and project registration.');
  process.exit(0);
}
assert.equal((await fetch(base+'/api/projects')).status,401);
assert.equal((await fetch(base+'/api/projects',{headers:{Authorization:`Bearer ${session.token}`,Origin:'https://untrusted.example'}})).status,403);
// Unregister only the fixture recorded by this test; never delete its source.
const previous = await fs.readFile(savedPath, 'utf8').then(JSON.parse).catch(() => null);
if (previous?.projectId && previous?.testRoot) {
  const allowedPrefix = path.join(root, '.voice-studio', 'verification-project');
  const previousRoot = path.resolve(previous.testRoot);
  assert(previousRoot === allowedPrefix || previousRoot.startsWith(allowedPrefix + '-'));
  const removed = await fetch(base + '/api/projects/' + encodeURIComponent(previous.projectId), {
    method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` }
  });
  assert([200, 204, 404].includes(removed.status));
}
const testRoot = await fs.mkdtemp(path.join(root, '.voice-studio', 'verification-project-'));
await fs.writeFile(path.join(testRoot,'index.html'),'<!doctype html><html lang="en"><head><title>Verification page</title><script>const hidden="powerful";</script></head><body><h1>Local review.</h1><p>🧪 Our powerful tools explain a finding.</p><p><a href="guide.md">Read the guide</a> before editing.</p></body></html>');
await fs.writeFile(path.join(testRoot,'guide.md'),'# Review guide.\n\nRead the [useful guide](./index.html).\n\nOur powerful tools keep evidence.\n\n```js\nconst hidden = "powerful seamless";\n```\n');
await fs.writeFile(path.join(testRoot,'de.md'),'# Texte prüfen.\n\nEine nahtlose Lösung für die tägliche Arbeit.\n');
const project=await api('/api/projects/register','POST',{path:testRoot,name:'Verification fixture'});
assert(project.id);
const docs=await api(`/api/projects/${project.id}/documents`);
assert.equal(docs.length,3);
const html=docs.find(d=>d.path==='index.html');assert(html);
const route=`/api/projects/${project.id}/documents/${html.id}`;
let doc=await api(route);
assert(!doc.renderedHtml.includes('<script'));
assert(doc.findings.some(f=>f.ruleId&&f.quote==='powerful'));
const unit=doc.units.find(u=>u.text.includes('🧪 Our powerful'));assert(unit);
const begin=unit.text.indexOf('powerful');
const input={unitId:unit.id,quote:'powerful',start:begin,end:begin+8,comment:'Keep the concrete capability; remove the evaluative adjective.',category:'wording',expectedVersion:doc.version,expectedReviewRevision:doc.reviewRevision,requestId:crypto.randomUUID()};
doc=await api(route+'/feedback','POST',input);
const feedback=doc.feedback.find(f=>f.comment===input.comment);assert(feedback);
assert.equal((await api(route+'/feedback','POST',input)).feedback.filter(f=>f.id===feedback.id).length,1);
await api(route+'/feedback','POST',{...input,requestId:crypto.randomUUID()},409);
assert.equal((await api(route)).feedback.find(f=>f.id===feedback.id).quote,'powerful');
const proposalInput={unitId:unit.id,start:begin,end:begin+8,replacement:'useful',expectedVersion:doc.version,feedbackId:feedback.id};
const proposal=await api(route+'/proposals','POST',proposalInput);
assert(proposal.sourceBefore.includes('powerful tools'));
assert(proposal.sourceAfter.includes('useful tools'));
const stale=await api(route+'/proposals','POST',{...proposalInput,replacement:'specific'});
doc=await api(route+`/proposals/${proposal.id}/apply`,'POST',{expectedVersion:proposal.expectedVersion});
assert((await fs.readFile(path.join(testRoot,'index.html'),'utf8')).includes('🧪 Our useful tools'));
assert(!doc.source.includes('Our powerful tools'));
await api(route+`/proposals/${stale.id}/apply`,'POST',{expectedVersion:stale.expectedVersion},409);
const report=await api(`/api/projects/${project.id}/report`);
assert.equal(report.findingCount,report.documents.reduce((n,d)=>n+d.findingCount,0));
assert.equal(report.totalWords,report.documents.reduce((n,d)=>n+d.wordCount,0));
const md=docs.find(d=>d.path==='guide.md');
const markdown=await api(`/api/projects/${project.id}/documents/${md.id}`);
assert(!markdown.units.some(u=>u.text.includes('const hidden')));
const linkUnit=markdown.units.find(u=>u.text.includes('useful guide'));assert(linkUnit);
const wordStart=linkUnit.text.indexOf('useful');
const mp=await api(`/api/projects/${project.id}/documents/${md.id}/proposals`,'POST',{unitId:linkUnit.id,start:wordStart,end:wordStart+6,replacement:'short',expectedVersion:markdown.version});
assert(mp.sourceAfter.includes('[short guide](./index.html)'));
const request=await api(route+'/requests','POST',{feedbackIds:[feedback.id],instruction:'Review the complete file and propose wording changes without adding product claims.',expectedVersion:doc.version,requestId:crypto.randomUUID()});
assert(request.id);
await fs.writeFile(savedPath,JSON.stringify({projectId:project.id,route,feedbackId:feedback.id,testRoot},null,2));
console.log('PASS authentication, origin rejection, project/file reports, HTML and Markdown exclusions, Unicode selection, durable feedback, idempotency, conflict rejection, exact source apply, stale proposal rejection, Markdown link preservation, saved agent brief.');
