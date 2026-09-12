import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writingCatalogue, selectWritingRules, findWritingSignals, composeWritingReviewPrompt } from '../../packages/writing-rules/dist/index.js';

const root = new URL('../../', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const measure = value => ({ utf16CodeUnits: value.length, utf8Bytes: Buffer.byteLength(value, 'utf8') });
const fixtureBytes = await readFile(new URL('fixtures.json', import.meta.url));
const fixtures = JSON.parse(fixtureBytes);
const require = createRequire(import.meta.url);
const tokenizerAttempts = [];
let tokenizer = null;
for (const name of ['js-tiktoken', 'tiktoken']) {
  try {
    const resolved = require.resolve(name);
    const module = await import(name);
    const encoding = name === 'js-tiktoken' ? module.getEncoding('cl100k_base') : module.get_encoding('cl100k_base');
    tokenizer = { name, resolved, encoding: 'cl100k_base', count: text => encoding.encode(text).length, free: () => encoding.free?.() };
    tokenizerAttempts.push({ package: name, status: 'loaded' });
    break;
  } catch (error) {
    tokenizerAttempts.push({ package: name, status: 'unavailable', reason: error.code ?? error.name });
  }
}

const allIds = writingCatalogue.rules.map(rule => rule.id);
const profileIds = selectWritingRules({ profile: 'public-docs' }).map(rule => rule.id);
const modes = [
  { id: 'all-rules-separate', label: 'One request per rule, all rules', ruleGroups: allIds.map(id => [id]) },
  { id: 'all-rules-together', label: 'One request, all rules', ruleGroups: [allIds] },
  { id: 'profile-separate', label: 'One request per public-docs rule', ruleGroups: profileIds.map(id => [id]) },
  { id: 'profile-together', label: 'One request, public-docs profile', ruleGroups: [profileIds] },
];
const labelledCases = [];
const promptCases = [];
const ids = new Set();
for (const fixture of fixtures.cases) {
  if (ids.has(fixture.id)) throw new Error(`Duplicate fixture: ${fixture.id}`);
  ids.add(fixture.id);
  for (const expected of fixture.expectedReview) {
    if (!allIds.includes(expected.ruleId) || !fixture.text.includes(expected.quote)) throw new Error(`Invalid editorial label in ${fixture.id}`);
  }
  const scan = findWritingSignals(fixture.text, { language: fixture.language });
  const matched = new Set();
  const candidates = scan.signals.map(signal => {
    const match = fixture.expectedReview.findIndex((expected, index) => !matched.has(index) && expected.ruleId === signal.ruleId && expected.quote === signal.quote);
    if (match >= 0) matched.add(match);
    return { ...signal, agreesWithEditorialLabel: match >= 0 };
  });
  labelledCases.push({
    id: fixture.id, language: fixture.language, kind: fixture.kind,
    context: fixture.context, text: fixture.text, expectedReview: fixture.expectedReview,
    scan: { ...scan, signals: candidates },
    missedEditorialLabels: fixture.expectedReview.filter((_, index) => !matched.has(index)),
  });
  const source = { language: fixture.language, context: fixture.context, text: fixture.text };
  const sourceJson = JSON.stringify(source);
  const modeResults = modes.map(mode => {
    const requests = mode.ruleGroups.map(ruleIds => {
      const composed = composeWritingReviewPrompt({ audience: fixtures.audience, goal: fixtures.goal, language: fixture.language, ruleIds, maxFindings: 3 });
      // This serialized request envelope is an offline measurement format, not a provider API payload.
      const payload = JSON.stringify({ instructions: composed.prompt, source });
      return {
        ruleIds: composed.ruleIds, instructionSha256: sha256(composed.prompt), payloadSha256: sha256(payload),
        instructions: measure(composed.prompt), source: measure(sourceJson), payload: measure(payload),
        encodedTokens: tokenizer ? tokenizer.count(payload) : null,
      };
    });
    return { id: mode.id, ruleCount: new Set(mode.ruleGroups.flat()).size, requestCount: requests.length, requests };
  });
  promptCases.push({ id: fixture.id, language: fixture.language, sourceSha256: sha256(sourceJson), source: measure(sourceJson), modes: modeResults });
}

const sum = (values, key) => values.reduce((total, value) => total + value[key], 0);
const summaries = modes.map(mode => {
  const entries = promptCases.flatMap(fixture => fixture.modes.find(value => value.id === mode.id).requests);
  return {
    id: mode.id, label: mode.label, ruleCountPerFixture: new Set(mode.ruleGroups.flat()).size,
    fixtureCount: fixtures.cases.length, totalRequests: entries.length,
    totalInstructions: { utf16CodeUnits: sum(entries.map(value => value.instructions), 'utf16CodeUnits'), utf8Bytes: sum(entries.map(value => value.instructions), 'utf8Bytes') },
    totalRepeatedSource: { utf16CodeUnits: sum(entries.map(value => value.source), 'utf16CodeUnits'), utf8Bytes: sum(entries.map(value => value.source), 'utf8Bytes') },
    totalPayload: { utf16CodeUnits: sum(entries.map(value => value.payload), 'utf16CodeUnits'), utf8Bytes: sum(entries.map(value => value.payload), 'utf8Bytes') },
    totalEncodedTokens: tokenizer ? sum(entries, 'encodedTokens') : null,
  };
});
const compare = (separateId, togetherId) => {
  const separate = summaries.find(value => value.id === separateId);
  const together = summaries.find(value => value.id === togetherId);
  return {
    separate: separateId, together: togetherId, sameRuleCoverage: separate.ruleCountPerFixture === together.ruleCountPerFixture,
    requestReduction: separate.totalRequests - together.totalRequests,
    payloadUtf8BytesSaved: separate.totalPayload.utf8Bytes - together.totalPayload.utf8Bytes,
    payloadUtf8ReductionFraction: 1 - together.totalPayload.utf8Bytes / separate.totalPayload.utf8Bytes,
    repeatedSourceUtf8BytesSaved: separate.totalRepeatedSource.utf8Bytes - together.totalRepeatedSource.utf8Bytes,
    encodedTokensSaved: tokenizer ? separate.totalEncodedTokens - together.totalEncodedTokens : null,
  };
};
const candidates = labelledCases.flatMap(fixture => fixture.scan.signals);
const trueCandidates = candidates.filter(candidate => candidate.agreesWithEditorialLabel).length;
const keepCases = labelledCases.filter(fixture => fixture.expectedReview.length === 0);
const lexicalExpected = labelledCases.filter(fixture => fixture.kind === 'surface-problem');
const semanticExpected = labelledCases.filter(fixture => fixture.kind === 'semantic-problem');
const byLanguage = ['en', 'de'].map(language => {
  const values = labelledCases.filter(fixture => fixture.language === language);
  const languageCandidates = values.flatMap(fixture => fixture.scan.signals);
  return { language, cases: values.length, candidates: languageCandidates.length, agreeingCandidates: languageCandidates.filter(value => value.agreesWithEditorialLabel).length, coverage: values[0].scan.coverage };
});
const report = {
  schemaVersion: 1, benchmark: fixtures.id, generatedAt: new Date().toISOString(),
  catalogueVersion: writingCatalogue.version, execution: { offline: true, providerRequestsSent: 0, runnerExecutions: 0, modelResponsesEvaluated: 0 },
  provenance: { fixtureSha256: sha256(fixtureBytes), runnerSha256: sha256(await readFile(fileURLToPath(import.meta.url))), librarySha256: sha256(await readFile(new URL('packages/writing-rules/dist/index.js', root))), authoredFixtureNotice: fixtures.provenance, labelling: fixtures.labelling },
  tokenizer: tokenizer ? { status: 'available', package: tokenizer.name, encoding: tokenizer.encoding, meaning: 'Exact encoding of the benchmark JSON envelope; excludes provider chat framing, outputs, cache accounting and any provider tokenizer differences.', attempts: tokenizerAttempts } : { status: 'unavailable', attempts: tokenizerAttempts, meaning: 'No token estimates. UTF-16 code units and UTF-8 bytes are measured directly and are not token counts.' },
  promptMeasurement: {
    audience: fixtures.audience, goal: fixtures.goal, maxFindingsPerRequest: 3,
    format: 'JSON.stringify({ instructions: composed.prompt, source: { language, context, text } })',
    sameCoverageComparisons: [compare('all-rules-separate', 'all-rules-together'), compare('profile-separate', 'profile-together')],
    summaries, cases: promptCases,
    limitations: [
      'The six-rule profile has a smaller scope than all twenty rules. Their cost difference is not an equal-coverage comparison.',
      'The per-request finding cap is identical, so separate requests can yield more total findings. No output length or review quality was measured.',
      'Counts include repeated source context and actual composed instructions, but no provider message framing, caching, retries, latency, hidden reasoning or output.',
      'Prompt batching can reduce repeated input while changing reviewer behavior. This offline run does not establish the best batch size or model strategy.',
    ],
  },
  surfaceEvaluation: {
    fixtureCount: labelledCases.length, candidateCount: candidates.length,
    candidatesAgreeingWithEditorialLabel: trueCandidates,
    candidatesNotAgreeingWithEditorialLabel: candidates.length - trueCandidates,
    candidatePrecisionAgainstAuthoredLabels: candidates.length ? trueCandidates / candidates.length : null,
    lexicalProblemCases: lexicalExpected.length, lexicalProblemCasesWithExpectedCandidate: lexicalExpected.filter(value => !value.missedEditorialLabels.length).length,
    keepOrCleanCases: keepCases.length, keepOrCleanCasesWithCandidate: keepCases.filter(value => value.scan.signals.length).length,
    semanticProblemCases: semanticExpected.length, semanticProblemCasesWithNoCandidate: semanticExpected.filter(value => !value.scan.signals.length).length,
    byLanguage, cases: labelledCases,
    limitations: [
      'These authored examples are deliberately balanced for demonstration. Candidate precision is local to this fixture set and is not model accuracy or representative product quality.',
      'The scanner sees only text and language, not the supplied editorial context. Quoted examples and warranted causal statements therefore remain candidates.',
      'Missed semantic cases require a reviewer. No candidates never establishes that a document is good, correct or ready to publish.',
      'The catalogue currently exposes lexical patterns for eight rules. The returned unscannedRuleIds identify the twelve rules without lexical coverage.',
    ],
  },
  nextMeasurementRequirements: [
    'Use a held-out, provenance-recorded corpus with multiple reviewers, disagreement handling, real keep cases and semantic problems in each supported language.',
    'Run matched rule sets and compare accepted findings, missed problems, harmful rewrites, preserved facts and author intent, not just number of findings.',
    'Record exact model/provider versions, actual input/output/cache token usage, latency, retries and cost from authorized model executions.',
    'Keep source text and prior accepted decisions fixed across strategies; cap total output and review rounds comparably.',
  ],
};
tokenizer?.free();
const outputDir = new URL('test-results/writing-review/', root);
await mkdir(outputDir, { recursive: true });
await writeFile(new URL('report.json', outputDir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: 'test-results/writing-review/report.json', catalogueVersion: report.catalogueVersion, tokenizer: report.tokenizer, promptSummaries: summaries, comparisons: report.promptMeasurement.sameCoverageComparisons, surface: { fixtureCount: report.surfaceEvaluation.fixtureCount, candidateCount: candidates.length, agreeingCandidates: trueCandidates, candidatePrecisionAgainstAuthoredLabels: report.surfaceEvaluation.candidatePrecisionAgainstAuthoredLabels, keepOrCleanCasesWithCandidate: report.surfaceEvaluation.keepOrCleanCasesWithCandidate, semanticProblemCasesWithNoCandidate: report.surfaceEvaluation.semanticProblemCasesWithNoCandidate } }, null, 2));
