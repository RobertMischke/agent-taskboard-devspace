import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{repository:{type:'string'},write:{type:'boolean',default:false},'content-only':{type:'boolean',default:false},help:{type:'boolean',default:false}},strict:true});
if(values.help){console.log(`Synchronize the maintained Voice Studio section of VL-W1.
Usage: node scripts/integrations/sync-voice-lint-dossier.mjs --repository <voice-lint-checkout> [--write] [--content-only]
Without --write, reports whether the target matches and never changes files.
VOICE_LINT_REPOSITORY can supply the repository path. --content-only preserves the descriptor.
Only an existing standalone Voice Lint checkout with the expected dossier identity and markers is supported.
No Git commit, API call, model run or companion-document migration is performed.`);process.exit(0)}
const repository=values.repository??process.env.VOICE_LINT_REPOSITORY;
if(!repository)throw Error('Specify --repository or VOICE_LINT_REPOSITORY. Use --help for examples.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const integration=path.join(root,'docs/integrations/voice-lint');
const config=JSON.parse(fs.readFileSync(path.join(integration,'dossier.json'),'utf8'));
const repositoryRoot=fs.realpathSync(repository);
const relativeTarget='docs/operations/'+config.id;
const target=fs.realpathSync(path.join(repositoryRoot,relativeTarget));
const contained=(base,file)=>{const relative=path.relative(base,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)};
if(!contained(repositoryRoot,target))throw Error('The dossier must resolve inside the supplied repository.');
const documentPath=fs.realpathSync(path.join(target,'index.html'));
const descriptorPath=fs.realpathSync(path.join(target,'workbench.json'));
if(!contained(target,documentPath)||!contained(target,descriptorPath))throw Error('Dossier files must remain inside the dossier directory.');
const originalHtml=fs.readFileSync(documentPath,'utf8');const originalDescriptor=fs.readFileSync(descriptorPath,'utf8');
const descriptor=JSON.parse(originalDescriptor);
if(descriptor.id!==config.id||descriptor.key!==config.key)throw Error('Dossier identity mismatch; refusing to write.');
const fragment=fs.readFileSync(path.join(integration,'dossier-fragment.html'),'utf8').trim();
const start='<!-- voice-studio:current:start -->',end='<!-- voice-studio:current:end -->';
for(const [name,text] of [['target',originalHtml],['fragment',fragment]]){
 if(text.split(start).length!==2||text.split(end).length!==2||text.indexOf(end)<text.indexOf(start))throw Error(`Missing, duplicate or inverted ${name} markers; refusing to write.`);
}
let html=originalHtml.slice(0,originalHtml.indexOf(start))+fragment+originalHtml.slice(originalHtml.indexOf(end)+end.length);
let nextDescriptor=originalDescriptor;
if(!values['content-only']){
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 if(!/<title>[^<]*<\/title>/.test(html)||!/<span><b>Status:<\/b>[^<]*<\/span>/.test(html))throw Error('Expected dossier title/status fields are missing; refusing to write.');
 html=html.replace(/<title>[^<]*<\/title>/,`<title>${escape(config.title)} | ${escape(config.key)}</title>`);
 html=html.replace(/<span><b>Status:<\/b>[^<]*<\/span>/,`<span><b>Status:</b> ${escape(config.statusText)}</span>`);
 if(descriptor.title!==config.title||descriptor.summary!==config.summary||html!==originalHtml){
  descriptor.title=config.title;descriptor.summary=config.summary;descriptor.updatedAt=new Date().toISOString();
  nextDescriptor=JSON.stringify(descriptor,null,2)+'\n';
 }
}
const changes=[{file:documentPath,before:originalHtml,after:html},{file:descriptorPath,before:originalDescriptor,after:nextDescriptor}].filter(item=>item.before!==item.after);
if(values.write){
 for(const item of changes)if(fs.readFileSync(item.file,'utf8')!==item.before)throw Error('Dossier changed during preparation; reload before retrying.');
 for(const item of changes)fs.writeFileSync(item.file,item.after,'utf8');
}
console.log(JSON.stringify({mode:values.write?'write':'check',key:config.key,changed:changes.map(item=>path.relative(repositoryRoot,item.file).replaceAll('\\','/')),identityPreserved:true,lifecyclePreserved:true},null,2));
if(!values.write&&changes.length)process.exitCode=1;
