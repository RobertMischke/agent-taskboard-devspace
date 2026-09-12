import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'frontend/dist/voice-studio-next/browser');
const target=path.join(root,'frontend/dist/voice-studio/browser');
await fs.access(path.join(source,'index.html'));
await fs.mkdir(target,{recursive:true});
for(const name of await fs.readdir(source)) {
  if(name==='index.html')continue;
  await fs.cp(path.join(source,name),path.join(target,name),{recursive:true});
}
// Referenced assets exist before the running server sees the new entry point.
await fs.copyFile(path.join(source,'index.html'),path.join(target,'index.html'));
console.log('Published the completed frontend build to the local Studio server.');
