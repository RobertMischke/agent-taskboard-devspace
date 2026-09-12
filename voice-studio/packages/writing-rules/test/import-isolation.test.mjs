import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('JSON mutations before first API import cannot poison rules, profiles or regexes', () => {
  // A fresh process establishes import order independently of other test files.
  const script = `
    import assert from 'node:assert/strict';
    const { default: rawPatterns } = await import('@voice/writing-rules/surface-patterns.json', { with: { type: 'json' } });
    const { default: rawCatalogue } = await import('@voice/writing-rules/catalogue.json', { with: { type: 'json' } });
    const originalCatalogue = structuredClone(rawCatalogue);
    rawPatterns[0].source = '[';
    rawPatterns[0].ruleId = 'poisoned-rule';
    rawCatalogue.version = 'poisoned-version';
    rawCatalogue.profiles[0].ruleIds = ['missing-rule'];
    rawCatalogue.rules[0].title.en = 'Poisoned title';
    const api = await import('@voice/writing-rules');
    assert.deepEqual(api.writingCatalogue, originalCatalogue);
    const result = api.findWritingSignals('It is worth noting.');
    assert.equal(result.signals.length, 1);
    assert.equal(result.signals[0].ruleId, 'meta-framing');
    const prompt = api.composeWritingReviewPrompt({ audience: 'Developers', goal: 'Open a file' });
    assert.equal(prompt.catalogueVersion, originalCatalogue.version);
    assert.equal(prompt.ruleIds.length, 6);
    assert.ok(Object.isFrozen(api.writingCatalogue.rules[0].examples.en));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
