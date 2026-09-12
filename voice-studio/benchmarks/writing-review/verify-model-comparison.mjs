import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildModelExperiment, prepareFromWorkspace, sha256, validateModelResponse } from './prepare-model-comparison.mjs';

const experiment = await prepareFromWorkspace();
const unique = (values, name) => assert.equal(new Set(values).size, values.length, `${name} must be unique`);
unique(experiment.requests.map(request => request.requestId), 'Request IDs');
unique(experiment.assignments.map(assignment => assignment.assignmentId), 'Assignment IDs');
unique(experiment.sources.map(source => source.sourceId), 'Source IDs');
unique(experiment.reviews.map(review => review.reviewId), 'Review IDs');
const requestById = new Map(experiment.requests.map(request => [request.requestId, request]));
for (const request of experiment.requests) {
  assert.equal(sha256(JSON.stringify(request.payload)), request.payloadSha256);
  const { language, context, text } = request.payload.source;
  assert.equal(sha256(JSON.stringify({ language, context, text })), request.payload.source.sourceSha256);
  assert.deepEqual(Object.keys(request.payload).sort(), ['instructions', 'source']);
  assert.deepEqual(Object.keys(request.payload.source).sort(), ['context', 'language', 'sourceId', 'sourceSha256', 'text']);
  assert.equal(request.execution.response, null);
  assert.equal(request.maxFindings, request.ruleIds.length);
  assert.equal(request.maxFindingsPerRule, 1);
}
for (const review of experiment.reviews) {
  const requests = review.requestIds.map(id => requestById.get(id));
  assert(requests.every(Boolean), 'Reviews may only reference prepared requests');
  assert(requests.every(request => request.reviewId === review.reviewId && request.sourceId === review.sourceId));
  const rules = requests.flatMap(request => request.ruleIds);
  unique(rules, 'Rule assignments within a complete review');
  assert.deepEqual(new Set(rules), new Set(review.ruleIds), 'All strategies in a cohort must cover its exact rules');
  assert.equal(requests.reduce((sum, request) => sum + request.maxFindings, 0), review.aggregateMaxFindings);
  assert.equal(new Set(requests.map(request => request.payload.source.sourceSha256)).size, 1, 'Source must be fixed across rule groups');
}
for (const candidate of experiment.candidates) {
  assert.equal(candidate.resolutionStatus, 'unresolved');
  assert.equal(candidate.canonicalRoute, null);
  const assigned = experiment.assignments.filter(assignment => assignment.candidateId === candidate.candidateId);
  assert.deepEqual(new Set(assigned.map(assignment => assignment.requestId)), new Set(requestById.keys()), 'Each research candidate gets the same request corpus');
  assert(assigned.every(assignment => assignment.result === null && assignment.order === null));
}
assert.equal(experiment.languagePairs.length, 15);
assert.equal(experiment.sources.filter(source => source.source.language === 'en').length, 15);
assert.equal(experiment.sources.filter(source => source.source.language === 'de').length, 15);

// Changing the answer key must not change any instructions, source or request hash.
const fixtures = JSON.parse(await readFile(new URL('fixtures.json', import.meta.url)));
const modelSnapshot = JSON.parse(await readFile(new URL('../../docs/research/review-model-candidates-2026-09-12.json', import.meta.url)));
const sentinel = 'REVIEWER_LABEL_MUST_NOT_ENTER_A_MODEL_PROMPT_8f47';
const poisoned = structuredClone(fixtures);
for (const fixture of poisoned.cases) {
  fixture.kind = sentinel;
  fixture.expectedReview = [{ ruleId: sentinel, quote: sentinel, reason: sentinel }];
}
poisoned.labelling = sentinel;
const isolated = buildModelExperiment({ fixtures: poisoned, modelSnapshot });
assert.deepEqual(isolated.requests.map(request => request.payloadSha256), experiment.requests.map(request => request.payloadSha256));
assert(isolated.requests.every(request => !JSON.stringify(request.payload).includes(sentinel)));

const request = experiment.requests.find(value => value.strategyId === 'bundled' && value.cohortId === 'public-docs-six');
const keep = {
  sourceId: request.payload.source.sourceId, sourceSha256: request.payload.source.sourceSha256,
  ruleResults: request.ruleIds.map(ruleId => ({ ruleId, decision: 'keep', reason: 'Synthetic response used only to verify the contract.' })),
};
assert.deepEqual(validateModelResponse(request, keep), { valid: true, findings: 0, complete: true, semanticAcceptance: null });
const changed = structuredClone(keep);
changed.ruleResults[0] = { ruleId: request.ruleIds[0], decision: 'change', reason: 'Synthetic validation example.',
  finding: { quote: request.payload.source.text, start: 0, end: request.payload.source.text.length, encoding: 'utf16', alternatives: ['A synthetic alternative.'] } };
assert.equal(validateModelResponse(request, changed).findings, 1);
const wrongSpan = structuredClone(changed);
wrongSpan.ruleResults[0].finding.quote = 'This quote is absent from the source.';
assert.throws(() => validateModelResponse(request, wrongSpan), /Quoted span/);
const duplicatedRule = structuredClone(keep);
duplicatedRule.ruleResults[1].ruleId = duplicatedRule.ruleResults[0].ruleId;
assert.throws(() => validateModelResponse(request, duplicatedRule), /unique/);
const overBudget = structuredClone(changed);
overBudget.ruleResults.push(structuredClone(overBudget.ruleResults[0]));
assert.throws(() => validateModelResponse(request, overBudget), /one result/);
const keepWithChange = structuredClone(changed);
keepWithChange.ruleResults[0].decision = 'keep';
assert.throws(() => validateModelResponse(request, keepWithChange), /Unexpected rule-result fields|must not propose/);
const stale = structuredClone(keep);
stale.sourceSha256 = '0'.repeat(64);
assert.throws(() => validateModelResponse(request, stale), /Source version/);
const incomplete = structuredClone(keep);
incomplete.ruleResults[0].decision = 'needs-evidence';
assert.equal(validateModelResponse(request, incomplete).complete, false);
assert.deepEqual(experiment.execution, { providerRequestsSent: 0, runnerExecutions: 0, modelResponsesEvaluated: 0 });
console.log(JSON.stringify({ verification: 'passed', checks: ['unique IDs and payload/source hashes', 'equal rule scope and aggregate finding cap', 'paired EN/DE assignments across every candidate', 'reviewer-label mutation leaves all prompts unchanged', 'valid keep/change responses and invalid spans, duplicate rules, extra findings, stale sources and keep-with-change rejected'], ...experiment.summary }, null, 2));
