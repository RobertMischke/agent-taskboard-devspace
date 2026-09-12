import test from 'node:test';
import assert from 'node:assert/strict';
import { findWritingSignals, composeWritingReviewPrompt } from '../dist/index.js';

test('Unicode word boundaries avoid matching inside accented words and retain German sharp s', () => {
  assert.deepEqual(findWritingSignals('überpowerful', { ruleIds: ['word-choice'] }).signals, []);
  const text = 'Das ist nicht bloß ein Vergleich.';
  const result = findWritingSignals(text, { language: 'de', ruleIds: ['unsupported-contrast'] });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].quote, 'Das ist nicht bloß');
  assert.equal(text.slice(result.signals[0].start, result.signals[0].end), result.signals[0].quote);
});

test('review instructions request bounded distinct alternatives and retain the keep decision', () => {
  const base = { audience: 'Developers', goal: 'Read the available behavior' };
  assert.match(composeWritingReviewPrompt(base).prompt, /one to three distinct alternatives supported by the facts; otherwise justify keeping/);
  assert.match(composeWritingReviewPrompt({ ...base, language: 'de' }).prompt, /ein bis drei unterschiedliche, durch die Fakten gedeckte Alternativen/);
  assert.doesNotMatch(composeWritingReviewPrompt(base).prompt, /The export contains the selected findings\. Git decision export is planned/);
});
