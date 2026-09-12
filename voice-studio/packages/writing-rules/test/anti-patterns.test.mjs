import test from 'node:test';
import assert from 'node:assert/strict';
import { writingCatalogue, getWritingRule, composeWritingReviewPrompt, findWritingSignals } from '../dist/index.js';

test('negative definitions reach prompts and optional additions remain contextual reviews', () => {
  const ruleIds = ['unearned-praise', 'false-balance', 'exhaustive-checklist', 'forced-template'];
  assert.equal(writingCatalogue.version, 'voice-writing-rules/0.2.0');
  for (const language of ['en', 'de']) {
    const result = composeWritingReviewPrompt({ audience: 'Developers', goal: 'Assess the proposal', language, ruleIds });
    assert.deepEqual(result.ruleIds, ruleIds);
    for (const id of ruleIds) {
      const rule = getWritingRule(id);
      for (const key of ['name', 'symptom', 'readerCost']) assert.ok(result.prompt.includes(rule.antiPattern[key][language]));
      assert.ok(result.prompt.includes(rule.prompt[language]));
      assert.ok(result.prompt.includes(rule.examples[language].keep));
    }
  }
  const lexical = findWritingSignals('Brilliant idea! Both are equally valid.', { ruleIds });
  assert.deepEqual(lexical.signals, []);
  assert.deepEqual(lexical.coverage.scannedRuleIds, []);
  assert.deepEqual(lexical.coverage.unscannedRuleIds, ruleIds);
  assert.equal(lexical.coverage.semanticReviewRequired, true);
  assert.equal(getWritingRule('process-history').examples.en.before,
    'The original readiness folder mixed several different things. Only some belong to the product. The maintained structure gives each kind an explicit owner and retention policy.');
  assert.ok(Object.isFrozen(getWritingRule('process-history').antiPattern.name));
});
