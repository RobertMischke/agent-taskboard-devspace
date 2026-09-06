import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTextRanges, getUnitText, selectionToTarget, mountVoiceReview } from '../dist/index.js';

test('visible excluded inline code keeps text offsets and receives no adjacent underline', () => {
  const dom = new JSDOM('<main><p data-voice-unit="u">Vor <code data-voice-exclude>npm test</code> danach 😀.</p></main>', { pretendToBeVisual: true });
  const document = dom.window.document;
  const root = document.querySelector('main');
  const element = root.firstElementChild;
  const text = getUnitText(element);
  assert.equal(text, 'Vor  danach 😀.');
  const units = [{ id: 'u', text, sourceSpan: { start: 0, end: 40, encoding: 'utf16' }, language: 'de', kind: 'paragraph' }];
  const ranges = createTextRanges(element, 0, text.length, text);
  assert.equal(ranges.length, 2);
  assert.equal(ranges.map(range => range.toString()).join(''), text);
  assert.equal(ranges.some(range => range.startContainer.parentElement.tagName === 'CODE'), false);

  const selection = document.getSelection();
  const afterCode = document.createRange();
  afterCode.setStart(element.lastChild, 1);
  afterCode.setEnd(element.lastChild, 7);
  selection.addRange(afterCode);
  assert.deepEqual(selectionToTarget(root, units, selection), { unitId: 'u', quote: 'danach', start: 5, end: 11 });

  const codeOnly = document.createRange();
  codeOnly.selectNodeContents(element.querySelector('code'));
  selection.removeAllRanges();
  selection.addRange(codeOnly);
  assert.equal(selectionToTarget(root, units, selection), null);

  const codeTextOnly = document.createRange();
  codeTextOnly.setStart(element.querySelector('code').firstChild, 0);
  codeTextOnly.setEnd(element.querySelector('code').firstChild, 3);
  selection.removeAllRanges();
  selection.addRange(codeTextOnly);
  assert.equal(selectionToTarget(root, units, selection), null);

  const acrossCode = document.createRange();
  acrossCode.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(acrossCode);
  assert.equal(selectionToTarget(root, units, selection), null);

  dom.window.Range.prototype.getClientRects = function () {
    assert.notEqual(this.startContainer.parentElement.tagName, 'CODE');
    const left = this.startContainer === element.firstChild ? 0 : 140;
    return [{ left, right: left + 40, top: 20, bottom: 40, width: 40, height: 20 }];
  };
  const controller = mountVoiceReview({ root, units, findings: [{ id: 'f', unitId: 'u', quote: text, start: 0, end: text.length, ruleId: 'example', category: 'structure', severity: 'info', message: '', explanation: '', suggestion: null, engine: 'test' }], feedback: [] });
  assert.equal(document.querySelectorAll('[data-voice-mark]').length, 2);
  assert.equal(element.querySelector('code').textContent, 'npm test');
  controller.dispose();
  dom.window.close();
});
