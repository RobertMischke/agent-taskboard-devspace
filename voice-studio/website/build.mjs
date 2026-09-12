import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pages} from './site.mjs';
import {studioImages} from './studio-tour.mjs';
import {guides,downloads} from './guides.mjs';
import {documentPage} from './template.mjs';
import {renderGuide,highlightCode} from './render-guide.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publishedOutput=path.join(root,'website/dist/voice');
await fs.mkdir(path.join(root,'.local'),{recursive:true});
const stageRoot=await fs.mkdtemp(path.join(root,'.local/website-build-'));
const output=path.join(stageRoot,'voice');
const origin='https://agent-orchestrator.dev';
await fs.mkdir(output,{recursive:true});
const inputs={}, sourceTargets=new Map(), routes=[];
async function read(source){
  const absolute=path.resolve(root,source),resolved=await fs.realpath(absolute);
  if(!absolute.startsWith(root+path.sep)||resolved!==absolute||(await fs.lstat(absolute)).isSymbolicLink())throw new Error('Publication input outside source tree or symlink: '+source);
  const data=await fs.readFile(absolute);inputs[source]=createHash('sha256').update(data).digest('hex');return data;
}
async function write(target,data){const dest=path.join(output,target);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,data)}
async function copy(source,target){await write(target,await read(source));sourceTargets.set(source,target)}

for(const asset of ['site.css','docs.css','product.css','site.js','json-viewer.js','json-viewer.css','writing-patterns.css','writing-patterns.js','writing-playground.js','research.css','research.js'])await copy('website/'+asset,asset);
for(const name of ['practice','studies','strategies','libraries','review-economics'])await copy('website/research/'+name+'.json','sources/research/'+name+'.json');
await copy('website/assets/studio-review.png','assets/studio-review.png');
await copy('website/assets/studio-review.capture.json','assets/studio-review.capture.json');
for(const name of studioImages)for(const extension of ['png','capture.json'])await copy(`website/assets/${name}.${extension}`,`assets/${name}.${extension}`);
await copy('packages/review/dist/voice-review.js','voice-review.js');
for(const name of ['index.js','catalogue.json','surface-patterns.json'])await copy('packages/writing-rules/dist/'+name,'writing-rules/'+name);
await copy('packages/writing-rules/src/catalogue.json','sources/writing-rules/catalogue.json');
for(const source of downloads)await copy(source,'sources/repository/'+source);
// Publish current storage examples; design schemas remain in the repository.
for(const name of ['stored-source-task.example.json','stored-selection-decision.example.json'])await copy('docs/examples/'+name,'sources/examples/'+name);
await copy('docs/verification/2026-09-12-browser-and-website/website.json','sources/verification-follow-up/website.json');
// The evidence manifest is the publication allowlist for this curated, reviewed record.
const writingEvidenceRoot='docs/verification/2026-09-12-writing-rules-and-docs';
const writingEvidence=JSON.parse(await read(writingEvidenceRoot+'/manifest.json'));
for(const entry of writingEvidence.files){
  if(!['README.md','website.json','writing-patterns.json','json-viewer.json'].includes(entry.path))throw new Error('Unexpected writing evidence file');
  const bytes=await read(writingEvidenceRoot+'/'+entry.path);
  if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Writing evidence changed after curation');
  if(entry.path.endsWith('.json')){await write('sources/verification-writing/'+entry.path,bytes);sourceTargets.set(writingEvidenceRoot+'/'+entry.path,'sources/verification-writing/'+entry.path);}
}
await copy(writingEvidenceRoot+'/manifest.json','sources/verification-writing/manifest.json');
const evidenceRoot='docs/verification/2026-09-12';
const evidence=JSON.parse(await read(`${evidenceRoot}/manifest.json`));
const evidenceEntries=Array.isArray(evidence.files)?evidence.files:[];
for(const entry of evidenceEntries){
  const relative=entry.path||entry.file;
  if(!relative)throw new Error('Evidence record without path');
  if(path.posix.normalize(relative)!==relative||relative.startsWith('/')||relative.split('/').includes('..')||relative.includes('\\'))throw new Error('Invalid evidence publication path');
  const data=await read(`${evidenceRoot}/${relative}`);
  if(data.length!==entry.bytes||createHash('sha256').update(data).digest('hex')!==entry.sha256)throw new Error('Evidence changed since curation: '+relative);
  await write(`sources/verification/${relative}`,data);
  sourceTargets.set(`${evidenceRoot}/${relative}`,`sources/verification/${relative}`);
}
await copy(`${evidenceRoot}/manifest.json`,'sources/verification/manifest.json');
for(const guide of guides)sourceTargets.set(guide.source,`guides/${guide.slug}/`);
for(const guide of guides){
  const markdown=(await read(guide.source)).toString('utf8');
  await write(`sources/${guide.slug}.md`,markdown);
  await write(`guides/${guide.slug}/index.html`,renderGuide(guide,markdown,sourceTargets));
  routes.push(`guides/${guide.slug}/`);
}
function decoratePublic(html){return html.replace(/<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g,(_all,lang,content)=>{
  const language=lang||'shell';const text=content.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&');
  return '<figure class="code-block"><figcaption><span>'+language+'</span><button type="button" class="copy-code" data-en="Copy" data-de="Kopieren" hidden>Copy</button></figcaption><pre tabindex="0"><code>'+highlightCode(text,language)+'</code></pre></figure>';
})}
for(const page of pages){
  await write((page.slug?page.slug+'/':'')+'index.html',documentPage({title:page.title,description:page.description,slug:page.slug,content:`<article data-language="en">${decoratePublic(page.en)}</article><article data-language="de" hidden>${decoratePublic(page.de)}</article>${page.shared||''}`,demo:page.slug==='library'}));
  routes.push(page.slug?page.slug+'/':'');
}
// Preserve existing bookmarks without a separate product page or sitemap entry.
await write('project-reviews/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=../"><meta name="robots" content="noindex"><link rel="canonical" href="https://agent-orchestrator.dev/voice/"><title>Voice · Git-backed review</title></head><body><p><a href="../">Git-backed review is on the Voice homepage.</a></p></body></html>');
for(const source of ['website/site.mjs','website/research.mjs','website/review-economics.mjs','website/writing-patterns.mjs','website/writing-playground.mjs','website/studio-tour.mjs','website/docs-index.mjs','website/build.mjs','website/guides.mjs','website/render-guide.mjs','website/template.mjs','package-lock.json'])await read(source);
let git={available:false};
try{const run=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:5000,windowsHide:true}).trim();git={available:true,commit:run(['rev-parse','HEAD']),branch:run(['branch','--show-current']),sourcePath:run(['rev-parse','--show-prefix']),workingTreeDirty:!!run(['status','--porcelain','--untracked-files=normal','--','.'])}}catch{}
await write('build-info.json',JSON.stringify({schemaVersion:1,product:'Voice public website',deploymentTarget:origin+'/voice/',builtAt:new Date().toISOString(),git,inputs,routes,published:false},null,2)+'\n');
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`<url><loc>${origin}/voice/${route}</loc></url>`).join('')}</urlset>`);
async function renameOutput(from,to){
  for(let attempt=0;;attempt++){try{return await fs.rename(from,to)}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=12)throw error;await new Promise(resolve=>setTimeout(resolve,150))}}
}
// Publish an entirely new local subtree: obsolete files cannot survive the allowlist.
await fs.mkdir(path.dirname(publishedOutput),{recursive:true});
const backup=path.join(stageRoot,'previous-voice');
let previous=false;
try{
  try{const real=await fs.realpath(publishedOutput);if(real!==publishedOutput)throw new Error('Unexpected website output indirection');await renameOutput(publishedOutput,backup);previous=true}catch(error){if(error.code!=='ENOENT')throw error}
  try{await renameOutput(output,publishedOutput)}catch(error){if(previous)await renameOutput(backup,publishedOutput);throw error}
  const resolvedStage=await fs.realpath(stageRoot);
  if(resolvedStage!==stageRoot||!resolvedStage.startsWith(path.join(root,'.local','website-build-')))throw new Error('Unexpected generated staging cleanup target');
  await fs.rm(resolvedStage,{recursive:true,force:true});
}catch(error){console.error('Website swap failed; staged build retained at a local maintenance path.');throw error}
console.log(`Built ${pages.length} product pages + ${guides.length} HTML guides in website/dist/voice. Deployment target only; no publication performed.`);
