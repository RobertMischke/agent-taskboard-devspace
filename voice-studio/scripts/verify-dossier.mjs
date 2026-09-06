import assert from 'node:assert/strict';
const response = await fetch('http://localhost:5031/api/projects/Voice%20Lint/workbenches/voice-concept-revision');
assert(response.ok, `Dossier response: ${response.status}`);
const source = await response.text();
assert(source.includes('Voice Studio: review text in context'));
assert(source.includes('81 backend assertions'));
assert(source.includes('voice-v02-verification'));
assert(!source.includes('Verification is being finalized for this update.'));
console.log('PASS live dossier contains the current introduction, implementation and completed verification.');
