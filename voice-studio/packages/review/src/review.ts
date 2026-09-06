import type { Feedback, Finding, SelectionTarget, TextUnit } from '@voice/contracts';
import { createTextRanges, findUnitElement, getUnitText, selectionToTarget } from './anchors.js';

export const CATEGORY_COLORS: Readonly<Record<string, string>> = Object.freeze({
  structure: '#285eb6', claims: '#bd6216', wording: '#8553a6', meta: '#a18720'
});

export interface VoiceReviewOptions {
  root: HTMLElement;
  units: readonly TextUnit[];
  findings: readonly Finding[];
  feedback: readonly Feedback[];
  onSelect?: (selection: SelectionTarget) => void;
  onFindingSelect?: (finding: Finding) => void;
  onFeedbackSelect?: (feedback: Feedback) => void;
}
export type VoiceReviewUpdate = Partial<Omit<VoiceReviewOptions, 'root'>>;
export interface VoiceReviewDiagnostics {
  mappedUnits: number;
  missingUnitIds: string[];
  mismatchedUnitIds: string[];
  unmappedFindingIds: string[];
  unmappedFeedbackIds: string[];
}
export interface VoiceReviewController {
  update(options: VoiceReviewUpdate): void;
  selectFinding(id: string | null): void;
  getDiagnostics(): VoiceReviewDiagnostics;
  dispose(): void;
}
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Mark = { kind: 'finding'; item: Finding; rect: Box } | { kind: 'feedback'; item: Feedback; rect: Box };
const mounts = new WeakMap<HTMLElement, VoiceReviewController>();
const interactiveSelector = 'a,button,input,textarea,select,option,summary,[role="button"],[role="link"],[contenteditable]:not([contenteditable="false"])';

/** Mount a visual adapter on an existing page or same-origin iframe document.
 * Underlines are a separate pointer-transparent layer: text, links, native
 * selection, framework ownership and inline DOM markup remain untouched. */
export function mountVoiceReview(initial: VoiceReviewOptions): VoiceReviewController {
  const root = initial.root;
  mounts.get(root)?.dispose();
  const document = root.ownerDocument;
  const window = document.defaultView;
  if (!window || !document.body) throw new Error('Mount Voice Review after the target document has loaded');
  let options = { ...initial };
  let disposed = false;
  let pendingFrame: number | null = null;
  let selectedId: string | null = null;
  let marks: Mark[] = [];
  let lastSelection = '';
  let diagnostics: VoiceReviewDiagnostics = emptyDiagnostics();
  const overlay = document.createElement('div');
  overlay.setAttribute('data-voice-overlay', '');
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483000', overflow: 'hidden',
    contain: 'strict', userSelect: 'none'
  });
  document.body.appendChild(overlay);

  function emptyDiagnostics(): VoiceReviewDiagnostics {
    return { mappedUnits: 0, missingUnitIds: [], mismatchedUnitIds: [], unmappedFindingIds: [], unmappedFeedbackIds: [] };
  }

  function intersect(rect: Box, clip: Pick<Box, 'left' | 'right' | 'top' | 'bottom'>): Box | null {
    const left = Math.max(rect.left, clip.left);
    const top = Math.max(rect.top, clip.top);
    const right = Math.min(rect.right, clip.right);
    const bottom = Math.min(rect.bottom, clip.bottom);
    if (right <= left || bottom <= top) return null;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function visibleRects(range: Range, element: HTMLElement): Box[] {
    const viewport = { left: 0, top: 0, right: window!.innerWidth, bottom: window!.innerHeight };
    // jsdom and detached documents have no layout API; anchors remain testable.
    if (typeof range.getClientRects !== 'function') return [];
    const clips: Pick<Box, 'left' | 'right' | 'top' | 'bottom'>[] = [viewport];
    for (let parent: HTMLElement | null = element; parent && parent !== document.body; parent = parent.parentElement) {
      const style = window!.getComputedStyle(parent);
      if (/(hidden|clip|auto|scroll)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
        clips.push(parent.getBoundingClientRect());
      }
    }
    const rects: Box[] = [];
    for (const clientRect of Array.from(range.getClientRects())) {
      let rect: Box | null = { left: clientRect.left, top: clientRect.top, right: clientRect.right,
        bottom: clientRect.bottom, width: clientRect.width, height: clientRect.height };
      for (const clip of clips) { if (rect) rect = intersect(rect, clip); }
      if (rect && rect.width > 0 && rect.height > 0) rects.push(rect);
    }
    return rects;
  }

  function paint() {
    if (disposed) return;
    diagnostics = emptyDiagnostics();
    marks = [];
    const elements = new Map<string, { element: HTMLElement; unit: TextUnit }>();
    for (const unit of options.units) {
      const element = findUnitElement(root, unit.id);
      if (!element) { diagnostics.missingUnitIds.push(unit.id); continue; }
      if (getUnitText(element) !== unit.text) { diagnostics.mismatchedUnitIds.push(unit.id); continue; }
      elements.set(unit.id, { element, unit });
      diagnostics.mappedUnits++;
    }
    const candidates: ({ kind: 'finding'; item: Finding } | { kind: 'feedback'; item: Feedback })[] = [
      ...options.findings.map(item => ({ kind: 'finding' as const, item })),
      ...options.feedback.filter(item => item.status === 'open' || item.status === 'needs_recheck')
        .map(item => ({ kind: 'feedback' as const, item }))
    ];
    for (const candidate of candidates) {
      const { item, kind } = candidate;
      const mapped = elements.get(item.unitId);
      const ranges = mapped && mapped.unit.text.slice(item.start, item.end) === item.quote
        ? createTextRanges(mapped.element, item.start, item.end, mapped.unit.text) : [];
      if (!ranges.length || !mapped) {
        (kind === 'finding' ? diagnostics.unmappedFindingIds : diagnostics.unmappedFeedbackIds).push(item.id);
        continue;
      }
      for (const range of ranges) {
        for (const rect of visibleRects(range, mapped.element)) marks.push({ ...candidate, rect } as Mark);
      }
    }
    const fragment = document.createDocumentFragment();
    const placed: { rect: Box; lane: number }[] = [];
    for (const mark of marks) {
      const occupied = new Set(placed.filter(other => Math.abs(other.rect.bottom - mark.rect.bottom) < 3 &&
        other.rect.left < mark.rect.right && other.rect.right > mark.rect.left).map(other => other.lane));
      let lane = 0;
      while (occupied.has(lane)) lane++;
      placed.push({ rect: mark.rect, lane });
      const line = document.createElement('span');
      line.setAttribute('data-voice-mark', mark.item.id);
      line.setAttribute('data-voice-kind', mark.kind);
      const color = CATEGORY_COLORS[mark.item.category] ?? CATEGORY_COLORS.meta;
      Object.assign(line.style, {
        position: 'absolute', left: `${mark.rect.left}px`, top: `${mark.rect.bottom - 1 + lane * 3}px`,
        width: `${mark.rect.width}px`, height: '0', boxSizing: 'content-box',
        borderBottom: `2px ${mark.kind === 'feedback' ? 'dotted' : 'solid'} ${color}`
      });
      fragment.appendChild(line);
      if (mark.kind === 'finding' && mark.item.id === selectedId) {
        const highlight = document.createElement('span');
        Object.assign(highlight.style, {
          position: 'absolute', left: `${mark.rect.left}px`, top: `${mark.rect.top}px`,
          width: `${mark.rect.width}px`, height: `${mark.rect.height}px`, backgroundColor: color, opacity: '0.13'
        });
        fragment.appendChild(highlight);
      }
    }
    overlay.replaceChildren(fragment);
  }

  function schedulePaint() {
    if (disposed || pendingFrame !== null) return;
    if (typeof window!.requestAnimationFrame === 'function') {
      pendingFrame = window!.requestAnimationFrame(() => { pendingFrame = null; paint(); });
    } else {
      pendingFrame = window!.setTimeout(() => { pendingFrame = null; paint(); }, 0);
    }
  }

  function selectText() {
    if (disposed) return;
    const selection = selectionToTarget(root, options.units, document.getSelection());
    if (!selection) { lastSelection = ''; return; }
    const key = `${selection.unitId}:${selection.start}:${selection.end}:${selection.quote}`;
    if (key === lastSelection) return;
    lastSelection = key;
    options.onSelect?.(selection);
  }

  function clickFinding(event: MouseEvent) {
    if (!document.getSelection()?.isCollapsed) return;
    const target = event.target as Element | null;
    if (target?.closest?.(interactiveSelector)) return;
    const hits = marks.filter(mark => event.clientX >= mark.rect.left - 2 && event.clientX <= mark.rect.right + 2 &&
      event.clientY >= mark.rect.top && event.clientY <= mark.rect.bottom + 8);
    // Prefer the most precise anchor; findings retain stable order on ties.
    hits.sort((a, b) => (a.item.end - a.item.start) - (b.item.end - b.item.start));
    const hit = hits[0];
    if (!hit) return;
    if (hit.kind === 'finding') { selectedId = hit.item.id; options.onFindingSelect?.(hit.item); schedulePaint(); }
    else options.onFeedbackSelect?.(hit.item);
  }

  root.addEventListener('mouseup', selectText);
  root.addEventListener('keyup', selectText);
  root.addEventListener('click', clickFinding);
  // Touch selection handles may finalize without mouseup or a keyboard event.
  root.addEventListener('touchend', selectText, { passive: true });
  window.addEventListener('resize', schedulePaint);
  document.addEventListener('scroll', schedulePaint, true);
  const observer = new window.MutationObserver(records => {
    if (records.some(record => record.target !== overlay && !overlay.contains(record.target))) schedulePaint();
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-voice-unit'] });
  const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(schedulePaint) : null;
  resizeObserver?.observe(root);
  document.fonts?.ready.then(schedulePaint).catch(() => {});

  const controller: VoiceReviewController = {
    update(next) { if (disposed) return; options = { ...options, ...next, root }; lastSelection = ''; paint(); },
    selectFinding(id) {
      if (disposed) return;
      selectedId = id;
      const finding = options.findings.find(item => item.id === id);
      if (finding) findUnitElement(root, finding.unitId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      schedulePaint();
    },
    getDiagnostics() { return { ...diagnostics, missingUnitIds: [...diagnostics.missingUnitIds],
      mismatchedUnitIds: [...diagnostics.mismatchedUnitIds], unmappedFindingIds: [...diagnostics.unmappedFindingIds],
      unmappedFeedbackIds: [...diagnostics.unmappedFeedbackIds] }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pendingFrame !== null) {
        if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(pendingFrame);
        else window.clearTimeout(pendingFrame);
      }
      root.removeEventListener('mouseup', selectText);
      root.removeEventListener('keyup', selectText);
      root.removeEventListener('touchend', selectText);
      root.removeEventListener('click', clickFinding);
      window.removeEventListener('resize', schedulePaint);
      document.removeEventListener('scroll', schedulePaint, true);
      observer.disconnect();
      resizeObserver?.disconnect();
      overlay.remove();
      marks = [];
      if (mounts.get(root) === controller) mounts.delete(root);
    }
  };
  mounts.set(root, controller);
  paint();
  return controller;
}
