import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from './session.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = JSON.parse(await fs.readFile(path.join(root, '.voice-studio/e2e-last.json'), 'utf8'));
const allowed = path.join(root, '.voice-studio', 'verification-project');
const fixture = path.resolve(state.testRoot);
assert(fixture === allowed || fixture.startsWith(allowed + '-'), 'Only this test fixture can be unregistered.');
const session = await readSession(root);
const base = process.env.VOICE_STUDIO_URL ?? 'http://127.0.0.1:5188';
const response = await fetch(base + '/api/projects/' + encodeURIComponent(state.projectId), {
  method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` }
});
assert([200, 204, 404].includes(response.status));
console.log('Verification fixture unregistered; source and test evidence retained.');
