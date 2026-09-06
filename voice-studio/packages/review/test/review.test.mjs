import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  codePointOffsetToUtf16, createTextRange, getUnitText, selectionToTarget,
  mountVoiceReview, createReviewClient, ReviewApiError
} from '../dist/index.js';

function fixture(html = '<p data-voice-unit="u-1">Text mit großer Wirkung.</p>') {
  const dom = new JSDOM(`<!doctype html><html><body><main>${html}</main></body></html>`, { pretendToBeVisual: true });
  const root = dom.window.document.querySelector('main');
  const units = [...root.querySelectorAll('[data-voice-unit]')].map(element => ({
    id: element.dataset.voiceUnit, text: getUnitText(element), kind: 'paragraph', language: 'de',
    sourceSpan: { start: 0, end: getUnitText(element).length, encoding: 'utf16' }
  }));
  return { dom, root, units, document: dom.window.document };
}

function finding(overrides = {}) {
  return { id: 'f-1', ruleId: 'claims.evidence', category: 'claims', severity: 'warning',
    message: 'Claim prüfen', explanation: 'Nachweis fehlt', quote: 'großer Wirkung', unitId: 'u-1',
    start: 9, end: 23, suggestion: null, engine: 'local-rules', ...overrides };
}

function feedback(overrides = {}) {
  return { id: 'note-1', unitId: 'u-1', quote: 'großer Wirkung', prefix: 'Text mit ', suffix: '.',
    start: 9, end: 23, comment: 'Bitte konkretisieren', category: 'wording', status: 'open',
    sourceVersion: 'v1', createdAt: '2026-09-06T00:00:00Z', updatedAt: '2026-09-06T00:00:00Z', ...overrides };
}

function mockLayout(window) {
  window.Range.prototype.getClientRects = function () {
    const left = this.startOffset * 8 + 10;
    const right = this.endOffset * 8 + 10;
    return [{ left, right, top: 20, bottom: 40, width: right - left, height: 20 }];
  };
}

test('UTF-16 ranges cross inline elements and preserve surrogate pairs and source DOM', () => {
  const { dom, root, units } = fixture('<p data-voice-unit="u-1">A 😀 <strong>präziser</strong> Text &amp; Maß.</p>');
  const element = root.firstElementChild;
  const original = element.innerHTML;
  const text = units[0].text;
  const end = text.indexOf(' Text');
  const range = createTextRange(element, 2, end, text);
  assert.equal(range.toString(), '😀 präziser');
  assert.equal(range.startContainer.data, 'A 😀 ');
  assert.equal(range.endContainer.data, 'präziser');
  assert.equal(element.innerHTML, original);
  assert.equal(codePointOffsetToUtf16(text, 3), 4);
  assert.equal(codePointOffsetToUtf16(text, [...text].length), text.length);
  assert.throws(() => codePointOffsetToUtf16(text, 500), RangeError);
  assert.throws(() => codePointOffsetToUtf16(text, -1), RangeError);
  dom.window.close();
});

test('ranges fail closed for stale text or invalid spans', () => {
  const { dom, root } = fixture();
  const element = root.firstElementChild;
  assert.equal(createTextRange(element, 0, 3, 'Anderer Text'), null);
  for (const [start, end] of [[-1, 4], [0, 0], [4, 3], [0, 99], [1.1, 3]]) {
    assert.equal(createTextRange(element, start, end), null);
  }
  dom.window.close();
});

test('eligible text excludes hidden nodes, script/style and review UI without collapsing whitespace', () => {
  const { dom, root } = fixture('<p data-voice-unit="u-1">A  <strong>B</strong><span hidden>secret</span><span aria-hidden="true">hidden</span><script>bad()</script><style>p{}</style><span data-voice-overlay>note</span> C</p>');
  assert.equal(getUnitText(root.firstElementChild), 'A  B C');
  dom.window.close();
});

test('selection maps the selected occurrence, including reversed browser selection and inline markup', () => {
  const { dom, root, units, document } = fixture('<p data-voice-unit="u-1">Echo <em>Echo</em> 😀!</p>');
  const selection = document.getSelection();
  const range = createTextRange(root.firstElementChild, 5, 9, units[0].text);
  selection.addRange(range);
  assert.deepEqual(selectionToTarget(root, units, selection), { unitId: 'u-1', quote: 'Echo', start: 5, end: 9 });
  selection.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
  assert.deepEqual(selectionToTarget(root, units, selection), { unitId: 'u-1', quote: 'Echo', start: 5, end: 9 });
  dom.window.close();
});

test('cross-unit and stale selections are rejected without creating a partial anchor', () => {
  const { dom, root, units, document } = fixture('<p data-voice-unit="u-1">Erster Satz.</p><p data-voice-unit="u-2">Zweiter Satz.</p>');
  const range = document.createRange();
  range.setStart(root.children[0].firstChild, 2);
  range.setEnd(root.children[1].firstChild, 7);
  const selection = document.getSelection();
  selection.addRange(range);
  assert.equal(selectionToTarget(root, units, selection), null);
  range.setEnd(root.children[0].firstChild, 7);
  assert.equal(selectionToTarget(root, [{ ...units[0], text: 'Alter Text' }], selection), null);
  dom.window.close();
});

test('mount/update/remount/dispose preserve DOM, selections, native listeners and single callback lifecycle', () => {
  const { dom, root, units, document } = fixture('<p data-voice-unit="u-1">Text <a href="#example">mit großer</a> Wirkung.</p>');
  const original = root.innerHTML;
  let oldCalls = 0;
  let calls = 0;
  let nativeClicks = 0;
  root.querySelector('a').addEventListener('click', event => { event.preventDefault(); nativeClicks++; });
  const first = mountVoiceReview({ root, units, findings: [], feedback: [], onSelect: () => oldCalls++ });
  const second = mountVoiceReview({ root, units, findings: [], feedback: [], onSelect: () => calls++ });
  assert.equal(document.querySelectorAll('[data-voice-overlay]').length, 1);
  const selection = document.getSelection();
  selection.addRange(createTextRange(root.firstElementChild, 0, 4, units[0].text));
  root.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true }));
  root.dispatchEvent(new dom.window.KeyboardEvent('keyup', { bubbles: true }));
  assert.equal(calls, 1);
  assert.equal(oldCalls, 0);
  second.update({ findings: [] });
  assert.equal(selection.toString(), 'Text');
  assert.equal(root.innerHTML, original);
  root.querySelector('a').click();
  assert.equal(nativeClicks, 1);
  first.dispose();
  assert.equal(document.querySelectorAll('[data-voice-overlay]').length, 1);
  second.dispose();
  second.dispose();
  root.dispatchEvent(new dom.window.MouseEvent('mouseup'));
  assert.equal(calls, 1);
  assert.equal(document.querySelectorAll('[data-voice-overlay]').length, 0);
  assert.equal(root.innerHTML, original);
  dom.window.close();
});

test('overlapping findings and notes get separate solid/dotted lines with exact range geometry', () => {
  const { dom, root, units, document } = fixture();
  mockLayout(dom.window);
  let clicked;
  const controller = mountVoiceReview({ root, units, findings: [finding()], feedback: [feedback()], onFindingSelect: item => clicked = item.id });
  const lines = [...document.querySelectorAll('[data-voice-mark]')];
  assert.equal(lines.length, 2);
  assert.equal(lines[0].style.borderBottomStyle, 'solid');
  assert.equal(lines[1].style.borderBottomStyle, 'dotted');
  assert.equal(lines[0].style.left, '82px');
  assert.equal(lines[0].style.width, '112px');
  assert.equal(lines[1].style.top, '42px');
  root.firstElementChild.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 100, clientY: 32 }));
  assert.equal(clicked, 'f-1');
  assert.deepEqual(controller.getDiagnostics(), { mappedUnits: 1, missingUnitIds: [], mismatchedUnitIds: [], unmappedFindingIds: [], unmappedFeedbackIds: [] });
  controller.dispose();
  dom.window.close();
});

test('stale anchors are diagnosed, resolved and unattached notes are not underlined', () => {
  const { dom, root, units, document } = fixture();
  mockLayout(dom.window);
  const controller = mountVoiceReview({ root, units, findings: [finding({ quote: 'outdated' })], feedback: [feedback({ status: 'needs_reattachment' }), feedback({ id: 'resolved', status: 'resolved' })] });
  assert.deepEqual(controller.getDiagnostics().unmappedFindingIds, ['f-1']);
  assert.equal(document.querySelectorAll('[data-voice-mark]').length, 0);
  root.firstElementChild.textContent = 'Changed';
  controller.update({ findings: [finding()] });
  assert.deepEqual(controller.getDiagnostics().mismatchedUnitIds, ['u-1']);
  controller.dispose();
  dom.window.close();
});

test('mark interaction does not intercept links or editable controls', () => {
  const { dom, root, units } = fixture('<p data-voice-unit="u-1"><a href="#next">Text mit großer Wirkung.</a></p>');
  mockLayout(dom.window);
  let calls = 0;
  const controller = mountVoiceReview({ root, units, findings: [finding()], feedback: [], onFindingSelect: () => calls++ });
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 100, clientY: 32 });
  root.querySelector('a').dispatchEvent(event);
  assert.equal(calls, 0);
  assert.equal(event.defaultPrevented, false);
  controller.dispose();
  dom.window.close();
});

test('client sends exact version/revision preconditions and surfaces stale-write responses', async () => {
  const requests = [];
  const client = createReviewClient({ baseUrl: 'http://localhost:5040/api/', fetch: async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ id: 'doc', reviewRevision: 2 }), { status: 200 });
  } });
  const input = { unitId: 'u-1', quote: 'Text', start: 0, end: 4, comment: 'Konkreter', category: 'wording', expectedVersion: 'sha256:v1', expectedReviewRevision: 1, requestId: 'unique-id' };
  const result = await client.saveFeedback('my project', 'path/name', input);
  assert.equal(result.reviewRevision, 2);
  assert.equal(requests[0].url, 'http://localhost:5040/api/projects/my%20project/documents/path%2Fname/feedback');
  assert.deepEqual(JSON.parse(requests[0].init.body), input);
  const conflictClient = createReviewClient({ fetch: async () => new Response(JSON.stringify({ message: 'Source changed' }), { status: 409 }) });
  await assert.rejects(conflictClient.saveFeedback('p', 'd', input), error => error instanceof ReviewApiError && error.status === 409 && error.message === 'Source changed');
});
