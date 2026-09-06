import fs from 'node:fs/promises';
import path from 'node:path';
export async function readSession(root) {
  const locationPath=path.join(root,'.voice-studio/session-location.json');
  const location=JSON.parse(await fs.readFile(locationPath,'utf8'));
  if(!path.isAbsolute(location.sessionFile)) throw new Error('Session file must be an absolute local path.');
  return JSON.parse(await fs.readFile(location.sessionFile,'utf8'));
}
