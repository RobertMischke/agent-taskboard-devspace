import type { Feedback, Finding, SelectionTarget, TextUnit } from '@voice/contracts';
import { getUnitText } from './anchors.js';
import { mountVoiceReview, type VoiceReviewController, type VoiceReviewDiagnostics } from './review.js';

export type VoiceStudioParentMessage =
  | { type: 'voice-studio:connect'; sessionId: string }
  | { type: 'voice-studio:review'; sessionId: string; reviewId: string; pageUrl: string; units: TextUnit[]; findings: Finding[]; feedback: Feedback[] }
  | { type: 'voice-studio:select-finding'; sessionId: string; reviewId: string; findingId: string | null }
  | { type: 'voice-studio:navigate'; sessionId: string; action: 'back' | 'forward' | 'reload' }
  | { type: 'voice-studio:disconnect'; sessionId: string };

export interface VoiceStudioMappingDiagnostics extends VoiceReviewDiagnostics {
  totalUnits: number;
  explicitUnits: number;
  inferredUnits: number;
  ambiguousUnitIds: string[];
}

export type VoiceStudioChildMessage =
  | { type: 'voice-studio:ready'; sessionId: string; protocolVersion: 1; url: string; title: string }
  | { type: 'voice-studio:location'; sessionId: string; url: string; title: string }
  | { type: 'voice-studio:mapping'; sessionId: string; reviewId: string; diagnostics: VoiceStudioMappingDiagnostics }
  | { type: 'voice-studio:selection'; sessionId: string; reviewId: string; selection: SelectionTarget }
  | { type: 'voice-studio:finding'; sessionId: string; reviewId: string; findingId: string }
  | { type: 'voice-studio:feedback'; sessionId: string; reviewId: string; feedbackId: string }
  | { type: 'voice-studio:error'; sessionId: string; reviewId?: string; message: string };

export interface ConnectVoiceStudioOptions {
  /** Exact trusted Studio origin, e.g. http://127.0.0.1:4188. No wildcard. */
  studioOrigin: string;
  /** Optional target browsing context; normally omit on the integrated page. */
  window?: Window & typeof globalThis;
}
/** Explicit live-page bridge; backend credentials never cross this transport. */
export interface VoiceStudioConnection {
  /** Re-evaluate source-to-DOM mapping after the host renders new content. */
  refresh(): void;
  /** Remove the bridge, its overlays and listeners, restoring wrapped history methods. */
  dispose(): void;
}
type ReviewMessage = Extract<VoiceStudioParentMessage, { type: 'voice-studio:review' }>;
const bridges = new WeakMap<Window, VoiceStudioConnection>();
const excludedSelector = 'script,style,noscript,template,iframe,object,embed,code,pre,textarea,input,select,option,svg,math,[hidden],[aria-hidden="true"],[data-voice-exclude],[data-voice-overlay],[contenteditable]:not([contenteditable="false"])';

/** Connect an explicitly integrated live page to a trusted Studio parent or
 * opener. The actual app keeps its scripts, styles, routes and event handlers.
 * This transport never receives or sends backend credentials. */
export function connectVoiceStudio(options: ConnectVoiceStudioOptions): VoiceStudioConnection {
  const view = options.window ?? window;
  const document = view.document;
  const configured = new URL(options.studioOrigin);
  if (!/^https?:$/.test(configured.protocol) || configured.username || configured.password ||
      configured.pathname !== '/' || configured.search || configured.hash) {
    throw new Error('studioOrigin must be an explicit HTTP(S) origin without a path, credentials, query or fragment');
  }
  const studioOrigin = configured.origin;
  bridges.get(view)?.dispose();
  let disposed = false;
  let peer: Window | null = null;
  let sessionId: string | null = null;
  let active: ReviewMessage | null = null;
  let review: VoiceReviewController | null = null;
  let lastUrl = view.location.href;
  let lastTitle = document.title;
  let refreshTimer: number | null = null;
  const temporary: { element: HTMLElement; id: string; previous: string | null }[] = [];

  function send(message: VoiceStudioChildMessage) {
    if (!disposed && peer) peer.postMessage(message, studioOrigin);
  }
  function locationMessage(type: 'voice-studio:ready' | 'voice-studio:location') {
    if (!sessionId) return;
    const location = { sessionId, url: view.location.href, title: document.title };
    send(type === 'voice-studio:ready' ? { type, protocolVersion: 1, ...location } : { type, ...location });
  }
  function clearReview() {
    observer.disconnect();
    review?.dispose();
    review = null;
    for (const change of temporary.splice(0)) {
      // Do not undo a later framework/user assignment to this attribute.
      if (change.element.getAttribute('data-voice-unit') !== change.id) continue;
      if (change.previous === null) change.element.removeAttribute('data-voice-unit');
      else change.element.setAttribute('data-voice-unit', change.previous);
    }
  }
  function observe() {
    if (!disposed && document.documentElement) observer.observe(document.documentElement, {
      childList: true, characterData: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-voice-unit', 'data-voice-exclude']
    });
  }
  function eligible(element: HTMLElement): boolean {
    if (element.closest(excludedSelector)) return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = view.getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    return true;
  }
  function canonicalUrl(value: string): string | null {
    try { return new URL(value).href; } catch { return null; }
  }
  function render() {
    if (disposed || !active || !sessionId || !document.body) return;
    if (canonicalUrl(active.pageUrl) !== view.location.href) return;
    const message = active;
    const currentSession = sessionId;
    clearReview();
    const diagnostics: VoiceStudioMappingDiagnostics = {
      totalUnits: message.units.length, mappedUnits: 0, explicitUnits: 0, inferredUnits: 0,
      missingUnitIds: [], mismatchedUnitIds: [], ambiguousUnitIds: [], unmappedFindingIds: [], unmappedFeedbackIds: []
    };
    const all = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(eligible);
    const explicit = all.filter(element => element.hasAttribute('data-voice-unit'));
    if (document.body.hasAttribute('data-voice-unit') && eligible(document.body)) explicit.unshift(document.body);
    const mapped: TextUnit[] = [];
    const assigned = new Set<HTMLElement>();
    const unresolved: TextUnit[] = [];
    for (const unit of message.units) {
      const matches = explicit.filter(element => element.getAttribute('data-voice-unit') === unit.id);
      if (matches.length > 1) { diagnostics.ambiguousUnitIds.push(unit.id); continue; }
      if (matches.length === 1) {
        if (getUnitText(matches[0]) !== unit.text) { diagnostics.mismatchedUnitIds.push(unit.id); continue; }
        assigned.add(matches[0]); mapped.push(unit); diagnostics.explicitUnits++;
      } else unresolved.push(unit);
    }
    const remainingTextCounts = new Map<string, number>();
    for (const unit of unresolved) remainingTextCounts.set(unit.text, (remainingTextCounts.get(unit.text) ?? 0) + 1);
    const candidateText = new Map<string, HTMLElement[]>();
    for (const element of all) {
      // Existing explicit mappings retain ownership, including unknown IDs.
      if (element.closest('[data-voice-unit]') || element.querySelector('[data-voice-unit]')) continue;
      const text = getUnitText(element);
      if (!remainingTextCounts.has(text)) continue;
      const candidates = candidateText.get(text) ?? [];
      candidates.push(element); candidateText.set(text, candidates);
    }
    for (const unit of unresolved) {
      const matches = (candidateText.get(unit.text) ?? []).filter(element => !assigned.has(element));
      // An ancestor and its only text-bearing descendant represent one
      // occurrence. Choose the deepest eligible element, preserving markup.
      const deepest = matches.filter(element => !matches.some(other => other !== element && element.contains(other)));
      if (deepest.length > 1 || (remainingTextCounts.get(unit.text) ?? 0) > 1) {
        diagnostics.ambiguousUnitIds.push(unit.id); continue;
      }
      if (deepest.length === 0) { diagnostics.missingUnitIds.push(unit.id); continue; }
      const element = deepest[0];
      temporary.push({ element, id: unit.id, previous: element.getAttribute('data-voice-unit') });
      element.setAttribute('data-voice-unit', unit.id);
      assigned.add(element); mapped.push(unit); diagnostics.inferredUnits++;
    }
    const stillCurrent = () => !disposed && sessionId === currentSession && active === message && view.location.href === canonicalUrl(message.pageUrl);
    const ids = new Set(mapped.map(unit => unit.id));
    review = mountVoiceReview({
      root: document.body, units: mapped,
      findings: message.findings.filter(item => ids.has(item.unitId)), feedback: message.feedback.filter(item => ids.has(item.unitId)),
      onSelect: selection => { if (stillCurrent()) send({ type: 'voice-studio:selection', sessionId: currentSession, reviewId: message.reviewId, selection }); },
      onFindingSelect: finding => { if (stillCurrent()) send({ type: 'voice-studio:finding', sessionId: currentSession, reviewId: message.reviewId, findingId: finding.id }); },
      onFeedbackSelect: feedback => { if (stillCurrent()) send({ type: 'voice-studio:feedback', sessionId: currentSession, reviewId: message.reviewId, feedbackId: feedback.id }); }
    });
    const mounted = review.getDiagnostics();
    diagnostics.mappedUnits = mounted.mappedUnits;
    diagnostics.unmappedFindingIds = [...message.findings.filter(item => !ids.has(item.unitId)).map(item => item.id), ...mounted.unmappedFindingIds];
    diagnostics.unmappedFeedbackIds = [...message.feedback.filter(item => !ids.has(item.unitId)).map(item => item.id), ...mounted.unmappedFeedbackIds];
    observe();
    send({ type: 'voice-studio:mapping', sessionId: currentSession, reviewId: message.reviewId, diagnostics });
  }
  function checkLocation() {
    const url = view.location.href;
    const title = document.title;
    if (url === lastUrl && title === lastTitle) return false;
    const changedUrl = url !== lastUrl;
    lastUrl = url; lastTitle = title;
    if (changedUrl) { active = null; clearReview(); observe(); }
    locationMessage('voice-studio:location');
    return changedUrl;
  }
  function refresh() {
    if (disposed) return;
    if (!checkLocation()) render();
  }
  function scheduleRefresh() {
    if (disposed || refreshTimer !== null) return;
    refreshTimer = view.setTimeout(() => { refreshTimer = null; refresh(); }, 50);
  }
  const observer = new view.MutationObserver(records => {
    if (records.some(record => {
      const element = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      return !element?.closest('[data-voice-overlay]');
    })) scheduleRefresh();
  });
  function isReview(data: Record<string, unknown>): data is Record<string, unknown> & ReviewMessage {
    return typeof data.reviewId === 'string' && data.reviewId.length > 0 && data.reviewId.length <= 160 &&
      typeof data.pageUrl === 'string' && Array.isArray(data.units) && data.units.length <= 5000 &&
      new Set(data.units.map(unit => unit?.id)).size === data.units.length &&
      data.units.every(unit => unit && typeof unit.id === 'string' && typeof unit.text === 'string' && unit.sourceSpan?.encoding === 'utf16') &&
      Array.isArray(data.findings) && data.findings.every(item => item && typeof item.id === 'string' && typeof item.unitId === 'string' && typeof item.quote === 'string' && Number.isInteger(item.start) && Number.isInteger(item.end)) &&
      Array.isArray(data.feedback) && data.feedback.every(item => item && typeof item.id === 'string' && typeof item.unitId === 'string' && typeof item.quote === 'string' && Number.isInteger(item.start) && Number.isInteger(item.end));
  }
  function receive(event: MessageEvent) {
    if (disposed || event.origin !== studioOrigin || !event.source) return;
    const allowed = (view.parent !== view && event.source === view.parent) || (!!view.opener && event.source === view.opener);
    if (!allowed || (peer && event.source !== peer)) return;
    const data: unknown = event.data;
    if (!data || typeof data !== 'object') return;
    const payload = data as Record<string, unknown>;
    if (payload.type === 'voice-studio:connect') {
      if (typeof payload.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(payload.sessionId)) return;
      active = null; clearReview();
      peer = event.source as Window; sessionId = payload.sessionId;
      lastUrl = view.location.href; lastTitle = document.title;
      observe(); locationMessage('voice-studio:ready'); return;
    }
    if (!sessionId || payload.sessionId !== sessionId) return;
    if (payload.type === 'voice-studio:navigate') {
      if (payload.action === 'back') view.history.back();
      else if (payload.action === 'forward') view.history.forward();
      else if (payload.action === 'reload') view.location.reload();
      return;
    }
    if (payload.type === 'voice-studio:disconnect') { active = null; clearReview(); peer = null; sessionId = null; return; }
    if (payload.type === 'voice-studio:select-finding') {
      if (payload.reviewId === active?.reviewId && (payload.findingId === null || typeof payload.findingId === 'string')) review?.selectFinding(payload.findingId);
      return;
    }
    if (payload.type !== 'voice-studio:review') return;
    if (!isReview(payload)) { send({ type: 'voice-studio:error', sessionId, message: 'Invalid Voice review payload' }); return; }
    if (canonicalUrl(payload.pageUrl) !== view.location.href) {
      send({ type: 'voice-studio:error', sessionId, reviewId: payload.reviewId, message: 'The live page navigated; review its current URL before sending new anchors' });
      locationMessage('voice-studio:location'); return;
    }
    active = payload;
    render();
  }
  const originalPush = view.history.pushState;
  const originalReplace = view.history.replaceState;
  const push: History['pushState'] = function (this: History, ...args) { originalPush.apply(this, args); checkLocation(); };
  const replace: History['replaceState'] = function (this: History, ...args) { originalReplace.apply(this, args); checkLocation(); };
  view.history.pushState = push;
  view.history.replaceState = replace;
  view.addEventListener('message', receive);
  view.addEventListener('popstate', checkLocation);
  view.addEventListener('hashchange', checkLocation);
  view.addEventListener('pageshow', refresh);
  const connection: VoiceStudioConnection = {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true; active = null;
      if (refreshTimer !== null) view.clearTimeout(refreshTimer);
      clearReview(); peer = null; sessionId = null;
      view.removeEventListener('message', receive);
      view.removeEventListener('popstate', checkLocation);
      view.removeEventListener('hashchange', checkLocation);
      view.removeEventListener('pageshow', refresh);
      if (view.history.pushState === push) view.history.pushState = originalPush;
      if (view.history.replaceState === replace) view.history.replaceState = originalReplace;
      if (bridges.get(view) === connection) bridges.delete(view);
    }
  };
  bridges.set(view, connection);
  return connection;
}
