import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
const {values}=parseArgs({options:{directory:{type:'string'},help:{type:'boolean',default:false}},strict:true});
if(values.help){console.log('Usage: node scripts/verify-evidence.mjs [--directory docs/verification/DATE]\nChecks manifest coverage, contained paths, byte sizes and SHA-256 hashes. Without a directory, checks all dated records. Does not rerun the historical tests.');process.exit(0)}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'docs/verification');
const dirs=values.directory?[path.resolve(root,values.directory)]:(await fs.readdir(base,{withFileTypes:true})).filter(item=>item.isDirectory()).map(item=>path.join(base,item.name));
const contained=(dir,file)=>{const rel=path.relative(dir,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel)};
async function filesIn(dir,relative=''){const result=[];for(const entry of await fs.readdir(path.join(dir,relative),{withFileTypes:true})){assert(!entry.isSymbolicLink(),'Evidence must not depend on symbolic links');const item=path.posix.join(relative,entry.name);if(entry.isDirectory())result.push(...await filesIn(dir,item));else if(entry.isFile())result.push(item)}return result}
for(const dir of dirs){
 const resolved=await fs.realpath(dir);const manifest=JSON.parse(await fs.readFile(path.join(resolved,'manifest.json'),'utf8'));assert.equal(manifest.schemaVersion,1);assert(Array.isArray(manifest.files));
 const seen=new Set();
 for(const entry of manifest.files){assert(typeof entry.path==='string'&&!seen.has(entry.path),'Duplicate or invalid manifest path');assert(contained(resolved,path.resolve(resolved,entry.path)),'Manifest path escapes record');const file=await fs.realpath(path.join(resolved,entry.path));assert(contained(resolved,file),'Evidence path resolves outside record');const data=await fs.readFile(file);assert.equal(data.length,entry.bytes,entry.path+' byte size');assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256,entry.path+' SHA-256');seen.add(entry.path)}
 const actual=(await filesIn(resolved)).filter(file=>file!=='manifest.json').sort();assert.deepEqual([...seen].sort(),actual,'Manifest must cover every retained file');
 console.log(`PASS ${path.basename(dir)}: ${seen.size} retained files match the manifest; historical tests were not rerun.`);
}
