import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Validates the proposed documentation format only. It does not inspect a site,
// resolve a repository, launch a runner or certify synthetic evidence.
const schema = JSON.parse(fs.readFileSync(new URL('../docs/schemas/holistic-review.v1.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const uniqueById = (items, label) => {
  const map = new Map(items.map(item => [item.id, item]));
  assert.equal(map.size, items.length, `${label} IDs must be unique`);
  return map;
};

function verify(record) {
  assert.ok(validate(record), ajv.errorsText(validate.errors, { separator: '\n' }));
  const repositories = uniqueById(record.subject.repositories, 'Repository');
  const context = uniqueById(record.context.entries, 'Context');
  const tasks = uniqueById(record.tasks, 'Task');
  const runs = uniqueById(record.tasks.flatMap(task => task.run ? [task.run] : []), 'Run');
  const artifacts = uniqueById(record.artifacts, 'Artifact');
  const findings = uniqueById(record.results.flatMap(result => result.findings), 'Finding');
  uniqueById(record.results, 'Result'); uniqueById(record.decisions, 'Decision');
  assert.ok(repositories.has(record.subject.primaryRepositoryId), 'Primary repository must be declared');
  assert.ok(record.tasks.length <= record.executionPolicy.maximumTasks, 'Task count exceeds the declared bound');
  assert.ok(record.executionPolicy.maximumParallelism <= record.executionPolicy.maximumTasks, 'Parallelism exceeds the task bound');
  assert.equal(record.context.manifestHash, hash(record.context.entries), 'Context manifest hash mismatch');
  const inputHash = hash({ subject: record.subject, contextHash: record.context.manifestHash, taskContractVersion: record.taskContractVersion });
  assert.equal(record.validity.reviewInputHash, inputHash, 'Review input hash mismatch');
  if (record.subject.inputMode === 'git-commit')
    assert.ok(repositories.get(record.subject.primaryRepositoryId).resolvedCommit, 'Commit review needs a resolved primary commit');
  if (record.subject.workingCopy) {
    assert.equal(record.subject.workingCopy.snapshotHash, hash(record.subject.workingCopy.files), 'Working-copy snapshot hash mismatch');
    assert.ok(artifacts.has(record.subject.workingCopy.snapshotArtifactId), 'Working-copy snapshot artifact must be declared');
  }
  function safeUrl(value) {
    const url = new URL(value);
    assert.ok(!url.username && !url.password, 'Portable URLs must not contain credentials');
  }
  function source(source) {
    if (source.repositoryId) assert.ok(repositories.has(source.repositoryId), 'Source references an unknown repository');
    if (source.snapshotArtifactId) assert.ok(artifacts.has(source.snapshotArtifactId), 'Source snapshot artifact must be declared');
    if (source.kind === 'snapshot' && source.repositoryId === record.subject.primaryRepositoryId && record.subject.workingCopy) {
      assert.equal(source.snapshotArtifactId, record.subject.workingCopy.snapshotArtifactId, 'Source must identify the reviewed working-copy artifact');
      assert.equal(source.contentHash, record.subject.workingCopy.files.find(file => file.path === source.path)?.contentHash, 'Source must match the reviewed working-copy content hash');
    }
    if (source.url) safeUrl(source.url);
  }
  for (const repository of repositories.values()) if (repository.canonicalUrl) safeUrl(repository.canonicalUrl);
  for (const entry of context.values()) {
    entry.sourceRefs.forEach(source);
    for (const replaced of entry.supersedes) assert.ok(context.has(replaced), 'Superseded context entry must be retained in the manifest');
  }
  for (const task of tasks.values()) {
    for (const entry of task.contextEntryIds) assert.ok(context.has(entry), 'Task context must resolve');
    if (task.parentTaskId) assert.ok(tasks.has(task.parentTaskId), 'Parent task must resolve');
    if (task.run) assert.equal(task.run.inputHash, inputHash, 'Run must identify the frozen review inputs');
    for (const route of task.scope.routes) assert.ok(record.subject.scope.routes.includes(route), 'Task route must be in the requested scope');
    for (const file of task.scope.files) assert.ok(record.subject.scope.files.includes(file), 'Task file must be in the requested scope');
  }
  for (const artifact of artifacts.values()) {
    assert.ok(runs.has(artifact.producedByRunId), 'Artifact producer run must resolve');
    if (artifact.uri) safeUrl(artifact.uri);
    if (record.evidenceClass === 'observed') assert.notEqual(artifact.availability, 'illustrative', 'Observed records cannot cite illustrative artifacts');
    if (artifact.capture) {
      assert.ok(repositories.has(artifact.capture.build.repositoryId), 'Screenshot build repository must resolve');
      if (record.subject.workingCopy && artifact.capture.build.identityVerified)
        assert.equal(artifact.capture.build.workingCopySnapshotHash, record.subject.workingCopy.snapshotHash, 'A verified dirty build must identify its snapshot');
      if (!artifact.capture.build.identityVerified) assert.ok(artifact.capture.build.limitation, 'Unverified build identity needs a limitation');
    }
  }
  for (const result of record.results) {
    assert.equal(tasks.get(result.taskId)?.run?.id, result.runId, 'Result must reference its own task run');
    for (const artifactId of result.artifactIds) assert.ok(artifacts.has(artifactId), 'Result artifact must resolve');
    for (const route of result.coverage.reviewedRoutes) assert.ok(tasks.get(result.taskId).scope.routes.includes(route), 'Reviewed routes must be in task scope');
    for (const finding of result.findings) {
      finding.sourceRefs.forEach(source);
      for (const entry of finding.contextEntryIds) assert.ok(context.has(entry), 'Finding context must resolve');
      for (const artifactId of finding.evidenceArtifactIds) assert.ok(artifacts.has(artifactId), 'Finding evidence must resolve');
      uniqueById(finding.suggestedActions, 'Action');
    }
  }
  for (const decision of record.decisions) {
    assert.ok(findings.has(decision.findingId), 'Decision finding must resolve');
    if (decision.actionId) assert.ok(findings.get(decision.findingId).suggestedActions.some(action => action.id === decision.actionId), 'Decision action must belong to its finding');
    decision.sourceRevisions.forEach(source);
    if (decision.status === 'current') {
      assert.equal(decision.contextHash, record.context.manifestHash, 'Current decision must match context');
      assert.equal(decision.reviewInputHash, inputHash, 'Current decision must match source inputs');
    }
  }
}

const exampleNames = ['holistic-page-request.v1.json', 'holistic-site-result.v1.json'];
const examples = exampleNames.map(name => JSON.parse(fs.readFileSync(new URL(`../docs/examples/${name}`, import.meta.url), 'utf8')));
for (let index = 0; index < examples.length; index++) {
  verify(examples[index]);
  console.log(`PASS: ${exampleNames[index]} (schema, references and manifest/input hashes)`);
}
const mutations = [
  record => { record.numericVoiceScore = 95; },
  record => { record.schemaVersion = '2.0.0'; },
  record => { record.executionPolicy.automaticModelRuns = true; },
  record => { record.subject.scope.files[0] = '../outside.ts'; },
  record => { record.subject.repositories[0].canonicalUrl = 'https://user:secret@example.invalid/repository'; },
  record => { delete record.artifacts.find(artifact => artifact.kind === 'screenshot').capture; },
  record => { record.results[0].runId = 'unknown-run'; },
  record => { delete record.decisions[0].rationale; },
  record => { record.context.entries[0].text = 'Context changed without a new manifest hash'; },
  record => { record.decisions[0].contextHash = '0'.repeat(64); },
  record => { record.evidenceClass = 'observed'; },
];
for (const mutate of mutations) {
  const record = structuredClone(examples[1]); mutate(record);
  assert.throws(() => verify(record), 'Invalid example mutation must be rejected');
}
console.log(`PASS: ${mutations.length} malformed or misleading example mutations rejected`);
