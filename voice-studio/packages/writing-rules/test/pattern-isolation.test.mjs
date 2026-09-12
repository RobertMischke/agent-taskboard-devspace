import test from 'node:test';
import assert from 'node:assert/strict';
import exportedPatterns from '@voice/writing-rules/surface-patterns.json' with { type: 'json' };
import { findWritingSignals } from '../dist/index.js';

test('mutating the public JSON export cannot alter the scanner pattern snapshot', () => {
  const text = 'It is worth noting that this is a powerful example.';
  const expected = findWritingSignals(text);
  const original = structuredClone(exportedPatterns);
  try {
    exportedPatterns[0].source = '[';
    exportedPatterns[0].ruleId = 'word-choice';
    exportedPatterns[0].language = 'de';
    exportedPatterns.push({ id: 'injected', ruleId: 'meta-framing', language: 'en', source: '.*' });
    assert.deepEqual(findWritingSignals(text), expected);
    exportedPatterns.splice(0, exportedPatterns.length);
    assert.deepEqual(findWritingSignals(text), expected);
  } finally {
    exportedPatterns.splice(0, exportedPatterns.length, ...original);
  }
});
