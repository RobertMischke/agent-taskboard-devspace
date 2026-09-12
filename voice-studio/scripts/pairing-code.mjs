import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSession} from './session.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const session=await readSession(root);
if(!/^[a-f0-9]{16}$/i.test(session.pairingCode??''))throw Error('No valid pairing code is available. Start Voice Studio first.');
console.log('Voice Studio: http://127.0.0.1:5188/');
console.log('Pairing code: '+session.pairingCode);
