import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readSession } from './session.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = `Verify the origin of an existing Voice Studio document and optional saved task.

Usage:
  node scripts/verify-source-provenance.mjs --project ID --file RELATIVE_PATH [options]

Options:
  --project ID       Registered Voice Studio project ID (required).
  --file PATH        Exact registered document path, relative to its project (required).
  --task ID|latest   Also verify this saved task's proposal and original source hash.
                    "latest" selects the newest saved task that has a proposal.
  --base URL        Local Studio origin (default: http://127.0.0.1:5188).
  --session-root P  Studio workspace holding .voice-studio/session-location.json.
                    Defaults to this script's workspace. The private token is never printed.
  --no-git          Verify source/task hashes without Git inspection.
  --require-git     Fail if a usable Git context is unavailable (otherwise optional).
  --out DIRECTORY   New report directory inside this workspace's test-results/.
                    Default: test-results/source-provenance-<timestamp>.
  --help            Show this help without accessing a session, API, or source file.

This tool calls GET endpoints and bounded local Git commands only. It creates no
fixtures, starts no service or task, and writes no reviewed source or Git metadata.
The Studio document GET may perform its normal review metadata recovery/reanchoring.
Source bytes and context are checked again before success. Reports contain IDs,
paths, hashes and statuses, not source text, task instructions, tokens or pairing codes.
Saved task proposals describe their original snapshot; a mismatch with today's source
is reported as history, not treated as the current Git diff. No deployed revision or
historical task commit is inferred. Browser rendering is outside this check.
`;

function parseArgs(args) {
  const values = new Map();
  const flags = new Set(['--no-git', '--require-git']);
  const options = new Set(['--project', '--file', '--task', '--base', '--session-root', '--out']);
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    assert(flags.has(name) || options.has(name), `Unknown option: ${name}`);
    assert(!values.has(name), `Duplicate option: ${name}`);
    if (flags.has(name)) values.set(name, true);
    else {
      const value = args[++index];
      assert(value && !value.startsWith('--'), `${name} needs a value`);
      values.set(name, value);
    }
  }
  for (const name of ['--project', '--file']) assert(values.has(name), `${name} is required; see --help`);
  assert(!(values.has('--no-git') && values.has('--require-git')), '--no-git and --require-git are mutually exclusive');
  const base = new URL(values.get('--base') ?? 'http://127.0.0.1:5188');
  assert(['http:', 'https:'].includes(base.protocol), '--base must use HTTP(S)');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), '--base must use a loopback host');
  assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', '--base must be an origin without credentials, path, query, or fragment');
  const file = values.get('--file').replaceAll('\\', '/');
  assert(file && !file.startsWith('/') && !/^[a-z]:/i.test(file) && !file.split('/').some(part => !part || part === '..' || part === '.'), '--file must be a normalized relative path');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.resolve(workspace, values.get('--out') ?? `test-results/source-provenance-${timestamp}`);
  const outputRelative = path.relative(path.join(workspace, 'test-results'), output);
  assert(outputRelative && !outputRelative.startsWith('..') && !path.isAbsolute(outputRelative), '--out must be a directory below this workspace\'s test-results/');
  return {
    base: base.origin, projectId: values.get('--project'), file,
    taskId: values.get('--task'), includeGit: !values.has('--no-git'), requireGit: values.has('--require-git'),
    sessionRoot: path.resolve(values.get('--session-root') ?? workspace), output,
  };
}

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const samePath = (left, right) => process.platform === 'win32'
  ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
  : path.resolve(left) === path.resolve(right);

async function readSource(filename) {
  const info = await fs.lstat(filename);
  assert(info.isFile() && !info.isSymbolicLink(), 'The registered source must be a regular file');
  assert(info.size <= 2 * 1024 * 1024, 'The registered source exceeds the supported 2 MiB limit');
  const bytes = await fs.readFile(filename);
  // Studio hashes decoded UTF-8 text, excluding a leading UTF-8 BOM.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { bytes, text, byteHash: sha(bytes), version: sha(text) };
}

function inspectGit(directory, relativePath) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')));
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', LC_ALL: 'C' });
  function git(args, allowed = [0]) {
    const prefix = ['--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.quotePath=false'];
    try {
      return execFileSync('git', [...prefix, ...args], { cwd: directory, env, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      if (allowed.includes(error.status)) return null;
      // Do not serialize child-process objects/environment or arbitrary stderr.
      throw new Error(`Local Git inspection failed at ${args[0]} (exit ${error.status ?? 'unavailable'})`);
    }
  }
  const root = git(['rev-parse', '--show-toplevel']).trim();
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1])?.trim() ?? null;
  const head = git(['rev-parse', '--verify', 'HEAD'], [0, 128])?.trim() ?? null;
  const file = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all', '--', relativePath]);
  const repository = git(['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all']);
  const tracked = git(['ls-files', '--error-unmatch', '--', relativePath], [0, 1]) !== null;
  return { repositoryRoot: root, branch, head, status: file.length >= 2 ? file.slice(0, 2) : 'clean', dirty: file.length > 0, repositoryDirty: repository.length > 0, tracked };
}

async function prepareOutput(output) {
  // Reports cannot overwrite source files or follow an output-directory junction.
  const relative = path.relative(workspace, output);
  let current = workspace;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const info = await fs.lstat(current);
      assert(info.isDirectory() && !info.isSymbolicLink(), 'Report directories must be regular directories without links');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(current);
    }
  }
  const filename = path.join(output, 'source-provenance.json');
  try { await fs.lstat(filename); throw new Error('Report already exists; choose a new --out directory'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return filename;
}

async function run(config) {
  const session = await readSession(config.sessionRoot);
  assert(typeof session.token === 'string' && session.token, 'Start Studio before running this verification');
  const reportFile = await prepareOutput(config.output);
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(), success: false,
    base: config.base, projectId: config.projectId, file: config.file,
    mode: 'Existing source/task provenance; GET APIs and local Git only; no model calls',
    limits: ['Document GET may recover/reanchor review metadata.', 'Saved task source is not a Git commit or the current Git diff.', 'No deployment revision or browser rendering is verified.'],
  };
  async function api(route) {
    const response = await fetch(config.base + route, { method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(20000) });
    assert(response.ok, `Studio GET failed (${response.status})`);
    return response.json();
  }
  try {
    const projectRoute = `/api/projects/${encodeURIComponent(config.projectId)}`;
    const documents = await api(projectRoute + '/documents');
    assert(Array.isArray(documents), 'Studio returned an invalid document list');
    const matches = documents.filter(item => item.path === config.file);
    assert.equal(matches.length, 1, 'Expected exactly one registered document matching --file');
    const documentId = matches[0].id;
    const route = `${projectRoute}/documents/${encodeURIComponent(documentId)}`;
    const contextRoute = `${route}/source-context?includeGit=${config.includeGit}`;
    const context = await api(contextRoute);
    assert.equal(context.projectId, config.projectId, 'Source context project mismatch');
    assert.equal(context.documentId, documentId, 'Source context document mismatch');
    assert.equal(context.path, config.file, 'Source context path mismatch');
    assert(path.isAbsolute(context.absolutePath), 'Source context did not provide an absolute local path');
    const before = await readSource(context.absolutePath);
    assert.equal(before.version, context.sourceVersion, 'Source context does not match the local UTF-8 file');
    const document = await api(route);
    assert.equal(document.id, documentId, 'Document identity mismatch');
    assert.equal(document.path, config.file, 'Document path mismatch');
    assert.equal(document.version, before.version, 'Document/context source versions differ; source may have changed');
    assert(document.source === before.text, 'Document source differs from the local source bytes');
    report.source = { documentId, absolutePath: context.absolutePath, version: before.version, byteHash: before.byteHash, bytes: before.bytes.length, matchesLocalFile: true };

    if (config.includeGit && context.git?.isRepository && !context.git.error) {
      const git = context.git;
      assert(path.isAbsolute(git.repositoryRoot), 'Git repository root must be absolute');
      const relative = path.relative(git.repositoryRoot, context.absolutePath).replaceAll('\\', '/');
      assert(relative && !relative.startsWith('../') && !path.isAbsolute(relative), 'Source must be inside the reported repository');
      assert.equal(relative, git.relativePath, 'Git-relative source path mismatch');
      const actual = inspectGit(git.repositoryRoot, relative);
      assert(samePath(actual.repositoryRoot, git.repositoryRoot), 'Git repository root mismatch');
      for (const field of ['branch', 'head', 'status', 'dirty', 'repositoryDirty', 'tracked']) assert.equal(actual[field], git[field], `Git ${field} changed or differs from source context`);
      report.git = { ...actual, relativePath: relative, matchesLocalGit: true };
    } else {
      assert(!config.requireGit, 'A complete Git context is required but unavailable');
      report.git = { checked: false, reason: config.includeGit ? 'No complete Git context is available for this file' : 'Disabled with --no-git' };
    }

    if (config.taskId) {
      const tasks = await api(route + '/tasks');
      assert(Array.isArray(tasks), 'Studio returned an invalid task list');
      const task = config.taskId === 'latest'
        ? tasks.filter(item => item.proposal).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0]
        : tasks.find(item => item.id === config.taskId);
      assert(task?.proposal, 'The selected saved task must exist and have a proposal');
      const proposal = task.proposal;
      assert.equal(task.projectId, config.projectId, 'Task project mismatch');
      assert.equal(task.documentId, documentId, 'Task document mismatch');
      assert.equal(proposal.documentId, documentId, 'Proposal document mismatch');
      assert.equal(task.proposalId, proposal.id, 'Task proposal link mismatch');
      assert.equal(proposal.taskId, task.id, 'Proposal task link mismatch');
      assert.equal(proposal.runId, task.runId, 'Proposal run link mismatch');
      assert.equal(task.sourceVersion, proposal.expectedVersion, 'Task and proposal source versions differ');
      assert.equal(sha(proposal.sourceBefore), task.sourceVersion, 'The original proposal source does not match its recorded hash');
      const afterVersion = sha(proposal.sourceAfter);
      const relationship = before.version === task.sourceVersion ? 'matches-task-input' : before.version === afterVersion ? 'matches-proposed-result' : 'different-from-task-input-and-result';
      report.task = { id: task.id, runId: task.runId, proposalId: proposal.id, createdAt: task.createdAt, updatedAt: task.updatedAt, status: task.status, proposalState: proposal.state, sourceVersion: task.sourceVersion, proposedVersion: afterVersion, currentSourceRelationship: relationship, sourceHashAndLinksValid: true, editCount: proposal.edits?.length ?? 1 };
    }
    const after = await readSource(context.absolutePath);
    assert.equal(after.byteHash, before.byteHash, 'Source bytes changed during verification; rerun on a stable working copy');
    const finalContext = await api(contextRoute);
    assert.equal(finalContext.sourceVersion, before.version, 'Source version changed during verification');
    assert.equal(finalContext.absolutePath, context.absolutePath, 'Source mapping changed during verification');
    if (report.git.matchesLocalGit) assert.deepEqual(finalContext.git, context.git, 'Git context changed during verification; rerun on a stable working copy');
    report.source.unchangedDuringVerification = true;
    report.success = true;
  } catch (error) {
    // Explicit redaction also protects unexpected upstream error messages.
    let message = String(error.message ?? 'Verification failed');
    for (const secret of [session.token, session.pairingCode].filter(value => typeof value === 'string' && value)) message = message.replaceAll(secret, '[redacted]');
    report.error = message;
  }
  report.completedAt = new Date().toISOString();
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`${report.success ? 'PASS' : 'FAIL'} source provenance: ${path.relative(workspace, reportFile)}`);
  if (report.task) console.log(`Saved task relationship: ${report.task.currentSourceRelationship}`);
  if (!report.success) { console.error(report.error); process.exitCode = 1; }
}

if (process.argv.includes('--help')) console.log(help);
else {
  try { await run(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
