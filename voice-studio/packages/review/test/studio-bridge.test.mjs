import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { connectVoiceStudio, createTextRange } from '../dist/index.js';

const studioOrigin = 'http://127.0.0.1:4188';
const pageUrl = 'http://127.0.0.1:4190/index.html';
const sessionId = 'review-session-123456789';
function fixture(html = '<main><p>Eine präzise Aussage.</p></main>') {
  const host = new JSDOM('', { url: studioOrigin });
  const child = new JSDOM(html, { url: pageUrl, pretendToBeVisual: true });
  Object.defineProperty(child.window, 'opener', { value: host.window, configurable: true });
  const sent = [];
  host.window.postMessage = (message, targetOrigin) => sent.push({ message, targetOrigin });
  const connection = connectVoiceStudio({ studioOrigin, window: child.window });
  const send = (data, origin = studioOrigin, source = host.window) => child.window.dispatchEvent(
    new child.window.MessageEvent('message', { data, origin, source }));
  const connect = () => send({ type: 'voice-studio:connect', sessionId });
  const close = () => { connection.dispose(); child.window.close(); host.window.close(); };
  return { host, child, sent, send, connect, close, connection, document: child.window.document };
}
const unit = (id = 'u-1', text = 'Eine präzise Aussage.') => ({ id, text, kind: 'p', language: 'de', sourceSpan: { start: 0, end: text.length, encoding: 'utf16' } });
const review = (units = [unit()], extra = {}) => ({ type: 'voice-studio:review', sessionId, reviewId: 'review-1', pageUrl, units, findings: [], feedback: [], ...extra });
const mapping = fixture => fixture.sent.filter(item => item.message.type === 'voice-studio:mapping').at(-1)?.message.diagnostics;

test('bridge requires an explicit origin and rejects messages before connection, from other origins or sources', () => {
  const f = fixture();
  assert.throws(() => connectVoiceStudio({ studioOrigin: '*', window: f.child.window }));
  assert.throws(() => connectVoiceStudio({ studioOrigin: studioOrigin + '/path', window: f.child.window }));
  f.send(review());
  f.send({ type: 'voice-studio:connect', sessionId }, 'http://evil.test');
  f.send({ type: 'voice-studio:connect', sessionId }, studioOrigin, f.child.window);
  f.send({ type: 'voice-studio:connect', sessionId: 'short' });
  assert.equal(f.sent.length, 0);
  assert.equal(f.document.querySelector('[data-voice-unit]'), null);
  f.connect();
  assert.deepEqual(f.sent[0], { targetOrigin: studioOrigin, message: { type: 'voice-studio:ready', sessionId, protocolVersion: 1, url: pageUrl, title: '' } });
  f.close();
});

test('only current-session, current-page reviews map and selection replies carry their review ID', () => {
  const f = fixture();
  f.connect();
  f.send(review(undefined, { sessionId: 'different-session-id' }));
  assert.equal(mapping(f), undefined);
  f.send(review(undefined, { pageUrl: pageUrl + '?old=1' }));
  assert.equal(mapping(f), undefined);
  assert.equal(f.sent.at(-2).message.type, 'voice-studio:error');
  f.send(review());
  assert.equal(mapping(f).mappedUnits, 1);
  const paragraph = f.document.querySelector('p');
  f.document.getSelection().addRange(createTextRange(paragraph, 5, 12, unit().text));
  paragraph.dispatchEvent(new f.child.window.MouseEvent('mouseup', { bubbles: true }));
  assert.deepEqual(f.sent.at(-1).message, { type: 'voice-studio:selection', sessionId, reviewId: 'review-1', selection: { unitId: 'u-1', quote: 'präzise', start: 5, end: 12 } });
  assert.equal(f.sent.every(item => item.targetOrigin === studioOrigin), true);
  f.close();
});

test('explicit IDs win over inference, while duplicate or mismatched anchors are never guessed', () => {
  const f = fixture('<p data-voice-unit="explicit">Eine Aussage.</p><p>Eine Aussage.</p><p data-voice-unit="wrong">Alter Text.</p><p>Neuer Text.</p>');
  f.connect();
  f.send(review([unit('explicit', 'Eine Aussage.'), unit('wrong', 'Neuer Text.')]));
  assert.equal(mapping(f).explicitUnits, 1);
  assert.equal(mapping(f).inferredUnits, 0);
  assert.deepEqual(mapping(f).mismatchedUnitIds, ['wrong']);
  f.send(review([unit('unknown', 'Eine Aussage.')]));
  // The one explicitly owned occurrence cannot be reassigned to another ID.
  assert.equal(mapping(f).inferredUnits, 1);
  assert.equal(f.document.querySelector('[data-voice-unit="explicit"]').textContent, 'Eine Aussage.');
  f.close();
});

test('inference chooses one deepest occurrence and rejects repeated text or duplicate source units', () => {
  const f = fixture('<main><div><p><strong>Einmal.</strong></p></div><p>Doppelt.</p><p>Doppelt.</p><p hidden>Einmal.</p><p style="display:none">Einmal.</p></main>');
  f.connect();
  f.send(review([unit('one', 'Einmal.'), unit('two', 'Doppelt.')]));
  assert.equal(mapping(f).mappedUnits, 1);
  assert.equal(f.document.querySelector('[data-voice-unit="one"]').tagName, 'STRONG');
  assert.deepEqual(mapping(f).ambiguousUnitIds, ['two']);
  assert.equal(f.document.querySelector('[data-voice-unit="two"]'), null);
  f.send(review([unit('first', 'Einmal.'), unit('second', 'Einmal.')]));
  assert.equal(mapping(f).mappedUnits, 0);
  assert.deepEqual(mapping(f).ambiguousUnitIds, ['first', 'second']);
  f.close();
});

test('live page DOM, links and native listeners survive mount/update/disconnect', () => {
  const f = fixture('<main><a href="#native"><strong>Eine Aussage.</strong></a><code>Ein Code.</code></main>');
  const link = f.document.querySelector('a');
  const original = f.document.body.innerHTML;
  let nativeClicks = 0;
  link.addEventListener('click', () => nativeClicks++);
  f.connect();
  f.send(review([unit('link', 'Eine Aussage.'), unit('code', 'Ein Code.')]));
  assert.equal(mapping(f).mappedUnits, 1);
  assert.deepEqual(mapping(f).missingUnitIds, ['code']);
  const event = new f.child.window.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(nativeClicks, 1);
  assert.equal(event.defaultPrevented, false);
  assert.equal(f.document.querySelector('a'), link);
  f.send(review([unit('link', 'Eine Aussage.')], { reviewId: 'review-2' }));
  assert.equal(f.document.querySelectorAll('[data-voice-overlay]').length, 1);
  f.send({ type: 'voice-studio:disconnect', sessionId });
  assert.equal(f.document.body.innerHTML, original);
  assert.equal(f.document.querySelector('a'), link);
  f.close();
});

test('SPA navigation clears stale anchors, reports actual location, and supports session-scoped native controls', () => {
  const f = fixture();
  f.connect();
  f.send(review());
  f.child.window.history.pushState({ appState: 1 }, '', '/next.html#section');
  assert.deepEqual(f.child.window.history.state, { appState: 1 });
  assert.equal(f.document.querySelector('[data-voice-unit]'), null);
  assert.equal(f.document.querySelector('[data-voice-overlay]'), null);
  assert.deepEqual(f.sent.at(-1).message, { type: 'voice-studio:location', sessionId, url: 'http://127.0.0.1:4190/next.html#section', title: '' });
  f.send(review());
  assert.equal(f.document.querySelector('[data-voice-overlay]'), null);
  f.send(review(undefined, { pageUrl: f.child.window.location.href, reviewId: 'next-review' }));
  assert.equal(mapping(f).mappedUnits, 1);
  let backs = 0;
  f.child.window.history.back = () => backs++;
  f.send({ type: 'voice-studio:navigate', sessionId: 'old-session', action: 'back' });
  f.send({ type: 'voice-studio:navigate', sessionId, action: 'back' });
  assert.equal(backs, 1);
  f.close();
});

test('refresh handles framework replacements and disposal preserves later app-owned attributes', () => {
  const f = fixture();
  f.connect(); f.send(review());
  const old = f.document.querySelector('p');
  const next = f.document.createElement('p');
  next.textContent = old.textContent;
  old.replaceWith(next);
  f.connection.refresh();
  assert.equal(next.getAttribute('data-voice-unit'), 'u-1');
  assert.equal(old.hasAttribute('data-voice-unit'), false);
  next.setAttribute('data-voice-unit', 'app-owned-now');
  f.connection.dispose();
  assert.equal(next.getAttribute('data-voice-unit'), 'app-owned-now');
  assert.equal(f.document.querySelector('[data-voice-overlay]'), null);
  f.close();
});

test('reconnection replaces the session and duplicate initialization has one live listener/overlay', () => {
  const f = fixture();
  const patchedPush = f.child.window.history.pushState;
  f.connect(); f.send(review());
  const second = connectVoiceStudio({ studioOrigin, window: f.child.window });
  assert.notEqual(f.child.window.history.pushState, patchedPush);
  assert.equal(f.document.querySelector('[data-voice-overlay]'), null);
  const start = f.sent.length;
  f.send({ type: 'voice-studio:connect', sessionId: 'second-session-123456' });
  assert.equal(f.sent.length, start + 1);
  f.send(review());
  assert.equal(f.document.querySelector('[data-voice-overlay]'), null);
  f.send(review(undefined, { sessionId: 'second-session-123456' }));
  assert.equal(f.document.querySelectorAll('[data-voice-overlay]').length, 1);
  f.connection.dispose();
  assert.equal(f.document.querySelectorAll('[data-voice-overlay]').length, 1);
  second.dispose(); f.close();
});
