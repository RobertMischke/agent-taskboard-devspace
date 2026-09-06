import type { SelectionTarget, TextUnit } from '@voice/contracts';

type TextSegment = { node: Text; start: number; end: number };
const excludedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** The adapter's coordinate space: concatenated eligible DOM text, in UTF-16.
 * No trim, whitespace collapse, HTML serialization or Unicode normalization. */
function textSegments(root: Node): TextSegment[] {
  const segments: TextSegment[] = [];
  let offset = 0;
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const text = node as Text;
      segments.push({ node: text, start: offset, end: offset + text.data.length });
      offset += text.data.length;
      return;
    }
    if (node.nodeType === 1) {
      const element = node as Element;
      if (excludedTags.has(element.tagName) || element.hasAttribute('data-voice-overlay') || element.hasAttribute('data-voice-exclude') ||
          element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return;
    }
    for (const child of Array.from(node.childNodes)) visit(child);
  };
  visit(root);
  return segments;
}

export function getUnitText(element: Node): string {
  return textSegments(element).map(segment => segment.node.data).join('');
}

export function findUnitElement(root: HTMLElement, unitId: string): HTMLElement | null {
  if (root.getAttribute('data-voice-unit') === unitId) return root;
  for (const element of root.querySelectorAll<HTMLElement>('[data-voice-unit]')) {
    if (element.getAttribute('data-voice-unit') === unitId) return element;
  }
  return null;
}

/** Resolve a half-open UTF-16 span across inline markup, without modifying it.
 * expectedText makes stale/mismatched DOM anchors fail closed. */
export function createTextRange(element: HTMLElement, start: number, end: number, expectedText?: string): Range | null {
  const segments = textSegments(element);
  const text = segments.map(segment => segment.node.data).join('');
  if (expectedText !== undefined && text !== expectedText) return null;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return null;
  const first = segments.find(segment => segment.end > start);
  const last = segments.find(segment => segment.start < end && segment.end >= end);
  if (!first || !last) return null;
  const range = element.ownerDocument.createRange();
  range.setStart(first.node, start - first.start);
  range.setEnd(last.node, end - last.start);
  return range;
}

/** Split visual spans at eligible text-node boundaries. Excluded inline
 * content stays visible but never acquires an underline from adjacent text. */
export function createTextRanges(element: HTMLElement, start: number, end: number, expectedText?: string): Range[] {
  const segments = textSegments(element);
  const text = segments.map(segment => segment.node.data).join('');
  if (expectedText !== undefined && text !== expectedText) return [];
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return [];
  return segments.filter(segment => segment.end > start && segment.start < end).map(segment => {
    const range = element.ownerDocument.createRange();
    range.setStart(segment.node, Math.max(0, start - segment.start));
    range.setEnd(segment.node, Math.min(segment.node.length, end - segment.start));
    return range;
  });
}

function isExcludedBoundary(node: Node, unit: HTMLElement): boolean {
  for (let element = node.nodeType === 1 ? node as Element : node.parentElement;
    element && element !== unit; element = element.parentElement) {
    if (excludedTags.has(element.tagName) || element.hasAttribute('data-voice-exclude') ||
      element.hasAttribute('data-voice-overlay') || element.hasAttribute('hidden') ||
      element.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

function containingUnit(root: HTMLElement, node: Node): HTMLElement | null {
  const element = node.nodeType === 1 ? node as Element : node.parentElement;
  const unit = element?.closest<HTMLElement>('[data-voice-unit]') ?? null;
  return unit && (unit === root || root.contains(unit)) ? unit : null;
}

/** Return a single-unit selection only. Cross-unit selections need separate
 * feedback anchors and are deliberately not silently shortened. */
export function selectionToTarget(root: HTMLElement, units: readonly TextUnit[], selection: Selection | null): SelectionTarget | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const element = containingUnit(root, range.startContainer);
  if (!element || containingUnit(root, range.endContainer) !== element) return null;
  const unit = units.find(item => item.id === element.getAttribute('data-voice-unit'));
  if (!unit || getUnitText(element) !== unit.text || isExcludedBoundary(range.startContainer, element) || isExcludedBoundary(range.endContainer, element)) return null;
  const before = element.ownerDocument.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  const start = getUnitText(before.cloneContents()).length;
  const contents = range.cloneContents();
  const selected = getUnitText(contents);
  // A selection crossing excluded code is not one exact visible-text anchor.
  // Reject it; selections wholly on either side retain correct unit offsets.
  if (selected !== contents.textContent) return null;
  const end = start + selected.length;
  if (!selected.trim() || unit.text.slice(start, end) !== selected) return null;
  return { unitId: unit.id, start, end, quote: selected };
}

/** Explicit conversion for adapters consuming unicode_code_point engines. */
export function codePointOffsetToUtf16(text: string, codePointOffset: number): number {
  if (!Number.isInteger(codePointOffset) || codePointOffset < 0) throw new RangeError('Expected a non-negative code point offset');
  let count = 0;
  let offset = 0;
  for (const point of text) {
    if (count === codePointOffset) return offset;
    offset += point.length;
    count += 1;
  }
  if (count === codePointOffset) return offset;
  throw new RangeError('Code point offset exceeds text length');
}
