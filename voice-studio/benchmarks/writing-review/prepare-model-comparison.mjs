import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writingCatalogue, selectWritingRules, composeWritingReviewPrompt } from '../../packages/writing-rules/dist/index.js';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
const serialize = value => JSON.stringify(value);
const projectRoot = new URL('../../', import.meta.url);
const selectedProfile = () => selectWritingRules({ profile: 'public-docs' }).map(rule => rule.id);
const profileGroupByRule = {
  'reader-goal': 'reader-and-action', 'current-state': 'reader-and-action', 'task-relevance': 'reader-and-action',
  'process-history': 'framing-and-certainty', 'meta-framing': 'framing-and-certainty', 'calibrated-uncertainty': 'framing-and-certainty',
};

function responseInstructions(language, ruleIds) {
  const shape = '{"sourceId":"...","sourceSha256":"...","ruleResults":[{"ruleId":"...","decision":"keep|change|needs-evidence","reason":"...","finding":{"quote":"...","start":0,"end":1,"encoding":"utf16","alternatives":["..."]}}]}';
  return language === 'de'
    ? `\nExperiment-Antwortvertrag: Gib ausschließlich ein JSON-Objekt in dieser Form aus: ${shape}\nÜbernimm sourceId und sourceSha256 aus dem Prüfmaterial. Liefere genau ein ruleResults-Element je ausgewählter Regel (${ruleIds.join(', ')}). Prüfe jede Regel eigenständig. decision ist keep, change oder needs-evidence; reason begründet die Entscheidung. Nur change erhält finding: höchstens ein priorisierter Befund je Regel, mit genauem Zitat, UTF-16-Spanne [start,end) in source.text und ein bis drei belegbaren Alternativen. Bei keep und needs-evidence fehlt finding. Erfinde keinen Befund, um die Liste zu füllen. Mehrere Probleme derselben Regel sind durch dieses Pilotformat nicht vollständig messbar.`
    : `\nExperiment response contract: Return only a JSON object in this shape: ${shape}\nCopy sourceId and sourceSha256 from the review material. Return exactly one ruleResults entry for each selected rule (${ruleIds.join(', ')}). Assess every rule independently. decision is keep, change or needs-evidence; reason explains the decision. Only change has a finding: at most one prioritized finding per rule, with an exact quote, UTF-16 span [start,end) into source.text and one to three supported alternatives. Omit finding for keep and needs-evidence. Do not invent a finding to fill the list. This pilot format cannot measure all occurrences when a rule has several problems.`;
}

/** Prepare inert research requests. No provider API, credentials or Runner is consulted. */
export function buildModelExperiment({ fixtures, modelSnapshot, provenance = {} }) {
  const profileIds = selectedProfile();
  assert.equal(profileIds.length, 6, 'Revisit the matched experiment when the six-rule profile changes');
  assert.deepEqual(new Set(profileIds), new Set(Object.keys(profileGroupByRule)), 'Every profile rule needs an explicit coherent group');
  const allIds = writingCatalogue.rules.map(rule => rule.id);
  assert.equal(allIds.length, 20, 'Revisit full-coverage finding limits when the catalogue changes');
  const groups = ['reader-and-action', 'framing-and-certainty'].map(id => ({ id, ruleIds: profileIds.filter(rule => profileGroupByRule[rule] === id) }));
  const cohorts = [
    { id: 'public-docs-six', ruleIds: profileIds, groups, strategies: [
      { id: 'one-rule', groups: profileIds.map(id => ({ id, ruleIds: [id] })) },
      { id: 'bundled', groups: [{ id: 'all', ruleIds: profileIds }] },
      { id: 'two-groups', groups },
    ] },
    { id: 'full-catalogue-twenty', ruleIds: allIds, groups: [], strategies: [
      { id: 'one-rule', groups: allIds.map(id => ({ id, ruleIds: [id] })) },
      { id: 'bundled', groups: [{ id: 'all', ruleIds: allIds }] },
    ] },
  ];
  const sourceIds = new Set();
  const pairIndexes = new Map();
  const sources = fixtures.cases.map((fixture, index) => {
    assert(!sourceIds.has(fixture.id), `Duplicate fixture ${fixture.id}`);
    sourceIds.add(fixture.id);
    assert(['en', 'de'].includes(fixture.language), 'The pilot supports EN/DE');
    assert(fixture.id.startsWith(`${fixture.language}-`), 'A case must identify its language pair');
    const pairKey = fixture.id.slice(3);
    if (!pairIndexes.has(pairKey)) pairIndexes.set(pairKey, `pair-${String(pairIndexes.size + 1).padStart(3, '0')}`);
    const source = { language: fixture.language, context: fixture.context, text: fixture.text };
    return { sourceId: `source-${String(index + 1).padStart(3, '0')}`, pairId: pairIndexes.get(pairKey), fixtureId: fixture.id,
      sourceSha256: sha256(serialize(source)), source };
  });
  const languagePairs = [...pairIndexes.values()].map(pairId => {
    const pair = sources.filter(source => source.pairId === pairId);
    assert.equal(pair.length, 2, `Expected one EN/DE pair for ${pairId}`);
    assert.deepEqual(new Set(pair.map(source => source.source.language)), new Set(['en', 'de']));
    return { pairId, sourceIds: pair.map(source => source.sourceId) };
  });
  const requests = [];
  const reviews = [];
  for (const source of sources) {
    for (const cohort of cohorts) {
      for (const strategy of cohort.strategies) {
        const reviewId = `${source.sourceId}/${cohort.id}/${strategy.id}`;
        const requestIds = [];
        for (const group of strategy.groups) {
          const composed = composeWritingReviewPrompt({ audience: fixtures.audience, goal: fixtures.goal,
            language: source.source.language, ruleIds: group.ruleIds, maxFindings: group.ruleIds.length });
          const requestId = `${reviewId}/${group.id}`;
          const payload = {
            instructions: composed.prompt + responseInstructions(source.source.language, composed.ruleIds),
            source: { sourceId: source.sourceId, sourceSha256: source.sourceSha256, ...source.source },
          };
          requestIds.push(requestId);
          requests.push({ requestId, reviewId, cohortId: cohort.id, strategyId: strategy.id, sourceId: source.sourceId,
            pairId: source.pairId, ruleIds: composed.ruleIds, maxFindings: composed.ruleIds.length, maxFindingsPerRule: 1,
            canonicalPromptSha256: sha256(composed.prompt), payloadSha256: sha256(serialize(payload)),
            payloadUtf8Bytes: Buffer.byteLength(serialize(payload), 'utf8'), payload,
            execution: { status: 'not-run', actualInputTokens: null, actualOutputTokens: null, actualCostUsd: null, latencyMs: null, response: null } });
        }
        reviews.push({ reviewId, sourceId: source.sourceId, pairId: source.pairId, cohortId: cohort.id,
          strategyId: strategy.id, ruleIds: cohort.ruleIds, aggregateMaxFindings: cohort.ruleIds.length, requestIds });
      }
    }
  }
  const candidates = modelSnapshot.candidates.map(candidate => ({ candidateId: candidate.id, providerResearchName: candidate.provider,
    researchedModelId: candidate.modelId, researchedSnapshot: candidate.documentedSnapshot,
    resolutionStatus: 'unresolved', canonicalRoute: null, requestedModelId: null, returnedModelId: null,
    providerParameters: null, role: candidate.role, benchmarkStart: candidate.benchmarkStart }));
  const assignments = candidates.flatMap(candidate => requests.map(request => ({
    assignmentId: `${candidate.candidateId}/${request.requestId}`, candidateId: candidate.candidateId,
    requestId: request.requestId, reviewId: request.reviewId, pairId: request.pairId,
    repetition: 1, order: null, cacheCondition: null, status: 'unresolved-not-run', result: null,
  })));
  return {
    schemaVersion: 1, id: 'voice-writing-model-comparison-pilot-v1', catalogueVersion: writingCatalogue.version,
    status: 'prepared-pilot-no-model-results', execution: { providerRequestsSent: 0, runnerExecutions: 0, modelResponsesEvaluated: 0 },
    provenance: { ...provenance, fixtureNotice: fixtures.provenance, modelResearchCheckedAt: modelSnapshot.checkedAt },
    purpose: 'Compare model and prompt organization by the cost of an accepted complete review at matched rule coverage. Finding budgets are response constraints, not the optimization objective.',
    modelResolution: 'Research references only, not a routing catalogue or allowlist. Resolve candidates and supported parameters through the installed Token Economy and host admission. Access, current availability and execution settings remain unknown.',
    promptOrganization: 'Stable canonical rules and response contract precede the changing source. Prefix reuse, provider cache eligibility and actual cold/warm charges are unmeasured. There is no filler to trigger caching.',
    executionPhases: [
      { id: 'profile-baseline', status: 'proposed-not-run', purpose: 'Establish the six-rule pipeline and quality baseline on all 30 sources.', cohortId: 'public-docs-six', strategyIds: ['bundled'], candidateIds: ['openai-luna', 'claude-haiku', 'google-flash-lite'], sourceIds: sources.map(value => value.sourceId), plannedAssignments: 90 },
      { id: 'profile-diagnostics', status: 'proposed-not-run', purpose: 'Compare prompt shape on three explicit EN/DE pairs: one surface issue, one keep case and one semantic issue. This exploratory subset cannot qualify the winner.', cohortId: 'public-docs-six', strategyIds: ['one-rule', 'two-groups', 'bundled'], candidateIds: ['openai-luna', 'claude-haiku', 'google-flash-lite'], sourceIds: sources.filter(value => ['en-meta', 'de-meta', 'en-keep-quotation', 'de-keep-quotation', 'en-history', 'de-history'].includes(value.fixtureId)).map(value => value.sourceId), plannedAssignments: 162 },
      { id: 'profile-paired-confirmation', status: 'requires-reviewed-condition-selection', purpose: 'Confirm selected model/prompt conditions on all 30 paired sources, then on held-out documents. Preserve the same source set for every compared condition. Record repetitions and cold/warm runs separately.', cohortId: 'public-docs-six', strategyIds: null, candidateIds: null, sourceIds: sources.map(value => value.sourceId), plannedAssignments: null },
      { id: 'full-catalogue-and-reference', status: 'later-separate-cohort', purpose: 'Evaluate twenty-rule coverage and any higher-capability reference after the basic pipeline works. Reference judgments do not replace independent editorial labels.', cohortId: 'full-catalogue-twenty', strategyIds: null, candidateIds: null, sourceIds: null, plannedAssignments: null },
    ],
    phaseMeaning: 'This file prepares the full factorial request corpus for reproducibility. It does not require launching all 3600 assignments. Phases are inert selection metadata, not launch instructions. Diagnostic bundle requests overlap baseline requests; reuse versus a new cache/repetition condition must be recorded rather than counted as independent evidence twice.',
    comparisonContract: { sameCoverageWithinCohort: true, maxFindingsPerRule: 1, alternativesPerFinding: { min: 1, max: 3 },
      aggregateMaxFindings: { 'public-docs-six': 6, 'full-catalogue-twenty': 20 },
      caveat: 'Finding cardinality and selected rules are matched. Provider output-token caps, explanation length, latency, quality and total output tokens are not established; a host must set and record execution conditions. Never pool six-rule and twenty-rule recall or claim equivalent scope between cohorts.' },
    cohorts, languagePairs, sources, requests, reviews, candidates, assignments,
    reviewerOnly: { labelling: fixtures.labelling,
      acceptanceRecordTemplate: {
        reviewId: null, candidateId: null, attemptIds: [], reviewerIds: [],
        ruleJudgments: [], sourceAndResponseValid: null, factsPreserved: null, intentPreserved: null,
        harmfulChange: null, unresolvedDisagreement: null, acceptedCompleteReview: null, rationale: null,
      },
      acceptanceRecordMeaning: 'Fill after independent review. ruleJudgments records each selected rule, warranted findings, false changes, missed problems and keep correctness. acceptedCompleteReview requires resolved judgments for the full selected scope, valid source/response, preserved facts and intent and no harmful change. Null means unassessed. Attempt IDs link every initial, failed, retried or escalated attempt without counting a cost twice.',
      cases: fixtures.cases.map((fixture, index) => ({
      sourceId: sources[index].sourceId, fixtureId: fixture.id, kind: fixture.kind, expectedReview: fixture.expectedReview,
      labelsInCohorts: cohorts.map(cohort => ({ cohortId: cohort.id, inScope: fixture.expectedReview.filter(label => cohort.ruleIds.includes(label.ruleId)),
        outsideScope: fixture.expectedReview.filter(label => !cohort.ruleIds.includes(label.ruleId)) })),
    })) },
    decisionCriteria: {
      primary: 'Sum all attempt costs, including errors, retries and escalations, divided by accepted complete reviews within one model/strategy/coverage condition. An accepted complete review has valid results for every selected rule, correct keep/change decisions and no harmful change under independent editorial review. A valid keep result can be an accepted review.',
      quality: ['Report rule-specific precision and recall with numerators, denominators and reviewer disagreement.', 'Report semantic misses separately; omitted rules are outside scope, not passes.', 'Report false changes on keep cases, fact and intent preservation, exact-span validity and distinct supported alternatives.', 'Deduplicate the same editorial issue across rules when assessing useful findings; do not reward verbosity or repeated findings.'],
      economics: ['Record provider-reported input, cache write/read and billed output/reasoning tokens; unknown counts remain null.', 'Price the actual resolved route with shared Token Economy contracts and preserve unresolved billing dimensions.', 'Include retry, escalation, invalid response and incomplete review costs once per attempt; an invoice cost per accepted finding is not automatically cost per accepted review.'],
      latency: ['Measure complete-review wall time as well as per-request latency, p50/p95 and errors.', 'Record sequential/parallel scheduling, admission/queue time, concurrency and cold/warm cache condition; one-rule and bundled latency depend on these.'],
      nextDesign: 'Use this small authored pilot to debug execution and scoring. Add held-out documents and independent reviewers before qualifying a production choice. Randomize or counterbalance case/model/strategy order and repeat conditions; this preparation contains no scheduled execution order or repeatability claim.',
      escalation: 'Evaluate cheap-first escalation as a separate later condition with explicit triggers and independently sampled non-escalated cases. Count both stages and routing misses; do not infer a useful policy from price alone.',
    },
    summary: { sources: sources.length, languagePairs: languagePairs.length, preparedRequests: requests.length,
      completeReviewConditions: reviews.length, unresolvedResearchCandidates: candidates.length,
      candidateRequestAssignments: assignments.length, candidateCompleteReviews: reviews.length * candidates.length,
      measuredModels: 0 },
  };
}

/** Validate one pilot answer; semantic correctness still needs independent review. */
export function validateModelResponse(request, response) {
  assert(response && typeof response === 'object' && !Array.isArray(response), 'Response must be a JSON object');
  assert.deepEqual(Object.keys(response).sort(), ['ruleResults', 'sourceId', 'sourceSha256'], 'Unexpected response fields');
  assert.equal(response.sourceId, request.payload.source.sourceId, 'Source ID must match');
  assert.equal(response.sourceSha256, request.payload.source.sourceSha256, 'Source version must match');
  assert(Array.isArray(response.ruleResults), 'ruleResults must be an array');
  assert.equal(response.ruleResults.length, request.ruleIds.length, 'Every selected rule needs one result');
  const seen = new Set();
  for (const result of response.ruleResults) {
    assert(result && typeof result === 'object' && !Array.isArray(result), 'Each rule result must be an object');
    assert.deepEqual(Object.keys(result).sort(), (result.decision === 'change' ? ['decision', 'finding', 'reason', 'ruleId'] : ['decision', 'reason', 'ruleId']), 'Unexpected rule-result fields');
    assert(request.ruleIds.includes(result.ruleId) && !seen.has(result.ruleId), 'Rule results must be selected and unique');
    seen.add(result.ruleId);
    assert(['keep', 'change', 'needs-evidence'].includes(result.decision), 'Unknown decision');
    assert(typeof result.reason === 'string' && result.reason.trim(), 'Each result needs a reason');
    if (result.decision !== 'change') {
      assert(!Object.hasOwn(result, 'finding'), 'Keep and needs-evidence must not propose a change');
      continue;
    }
    const finding = result.finding;
    assert(finding && typeof finding === 'object' && !Array.isArray(finding), 'One finding is required for change');
    assert.deepEqual(Object.keys(finding).sort(), ['alternatives', 'encoding', 'end', 'quote', 'start'], 'Unexpected finding fields');
    assert.equal(finding.encoding, 'utf16');
    assert(Number.isInteger(finding.start) && Number.isInteger(finding.end) && finding.start >= 0 && finding.end > finding.start && finding.end <= request.payload.source.text.length, 'A finding needs a valid source span');
    assert.equal(finding.quote, request.payload.source.text.slice(finding.start, finding.end), 'Quoted span must match the source');
    assert(Array.isArray(finding.alternatives) && finding.alternatives.length >= 1 && finding.alternatives.length <= 3 && finding.alternatives.every(value => typeof value === 'string' && value.trim()), 'Change needs one to three nonempty alternatives');
    assert.equal(new Set(finding.alternatives).size, finding.alternatives.length, 'Alternatives must be distinct');
  }
  return { valid: true, findings: response.ruleResults.filter(result => result.decision === 'change').length,
    complete: response.ruleResults.every(result => result.decision !== 'needs-evidence'), semanticAcceptance: null };
}

export async function prepareFromWorkspace() {
  const [fixtureBytes, snapshotBytes, libraryBytes, runnerBytes] = await Promise.all([
    readFile(new URL('fixtures.json', import.meta.url)),
    readFile(new URL('docs/research/review-model-candidates-2026-09-12.json', projectRoot)),
    readFile(new URL('packages/writing-rules/dist/index.js', projectRoot)), readFile(fileURLToPath(import.meta.url)),
  ]);
  return buildModelExperiment({ fixtures: JSON.parse(fixtureBytes), modelSnapshot: JSON.parse(snapshotBytes), provenance: {
    fixtureSha256: sha256(fixtureBytes), modelResearchSha256: sha256(snapshotBytes), librarySha256: sha256(libraryBytes), preparerSha256: sha256(runnerBytes),
  } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const experiment = await prepareFromWorkspace();
  const output = new URL('test-results/writing-review/model-experiment.json', projectRoot);
  await mkdir(new URL('./', output), { recursive: true });
  await writeFile(output, JSON.stringify(experiment, null, 2) + '\n');
  console.log(JSON.stringify({ output: 'test-results/writing-review/model-experiment.json', ...experiment.summary, status: experiment.status }, null, 2));
}
