import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { getUnitText, mountVoiceReview, createTextRange } from '../dist/index.js';

function unitsFor(element) {
  const text = getUnitText(element);
  return [{ id: 'u', text, kind: 'paragraph', language: 'de', sourceSpan: { start: 0, end: text.length, encoding: 'utf16' } }];
}

test('an iframe mount reads its own document selection and cleans up its own overlay', () => {
  const dom = new JSDOM('<p>Parent document</p><iframe></iframe>', { pretendToBeVisual: true });
  const parent = dom.window.document;
  const frame = parent.querySelector('iframe').contentDocument;
  frame.body.innerHTML = '<p data-voice-unit="u">Eine präzise Aussage.</p>';
  const units = unitsFor(frame.body.firstElementChild);
  const parentRange = parent.createRange();
  parentRange.selectNodeContents(parent.querySelector('p'));
  parent.getSelection().addRange(parentRange);
  let actual = null;
  const controller = mountVoiceReview({ root: frame.body, units, findings: [], feedback: [], onSelect: target => actual = target });
  frame.getSelection().addRange(createTextRange(frame.body.firstElementChild, 5, 12, units[0].text));
  frame.body.dispatchEvent(new frame.defaultView.MouseEvent('mouseup', { bubbles: true }));
  assert.deepEqual(actual, { unitId: 'u', start: 5, end: 12, quote: 'präzise' });
  assert.equal(parent.querySelectorAll('[data-voice-overlay]').length, 0);
  assert.equal(frame.querySelectorAll('[data-voice-overlay]').length, 1);
  assert.equal(parent.getSelection().toString(), 'Parent document');
  controller.dispose();
  assert.equal(frame.querySelectorAll('[data-voice-overlay]').length, 0);
  dom.window.close();
});

test('the standalone browser bundle exposes the API and mounts without a framework or module loader', () => {
  const dom = new JSDOM('<main><p data-voice-unit="u">Eine Aussage.</p></main>', { pretendToBeVisual: true, runScripts: 'dangerously' });
  const script = dom.window.document.createElement('script');
  script.textContent = readFileSync(new URL('../dist/voice-review.js', import.meta.url), 'utf8');
  dom.window.document.head.appendChild(script);
  const api = dom.window.VoiceReview;
  assert.equal(typeof api.mountVoiceReview, 'function');
  assert.equal(typeof api.createReviewClient, 'function');
  assert.equal(typeof api.codePointOffsetToUtf16, 'function');
  const root = dom.window.document.querySelector('main');
  const controller = api.mountVoiceReview({ root, units: unitsFor(root.firstElementChild), findings: [], feedback: [] });
  assert.equal(controller.getDiagnostics().mappedUnits, 1);
  controller.dispose();
  dom.window.close();
});
