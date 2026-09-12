// @ts-check
import { mountVoiceReview, codePointOffsetToUtf16 } from '@voice/review';

/**
 * Plain JavaScript with inferred callbacks and checked JSDoc imports.
 * @param {HTMLElement} root The host-owned preview root.
 * @returns {() => void} Cleanup to call when the host removes this view.
 */
export function runPlainTextExample(root) {
  const source = '🧭 Clear copy.';
  /** @type {import('@voice/review').SourceSpan} */
  const sourceSpan = { start: 0, end: source.length, encoding: 'utf16' };
  /** @type {import('@voice/review').TextUnit} */
  const unit = { id: 'intro', text: source, sourceSpan, kind: 'paragraph', language: 'en' };
  /** @type {import('@voice/review').Finding} */
  const finding = {
    id: 'demo-wording', ruleId: 'host.example', category: 'wording', severity: 'info',
    message: 'Example finding supplied by the host', explanation: 'Example data; no analysis is run.',
    quote: 'Clear', unitId: unit.id,
    start: codePointOffsetToUtf16(source, 2), end: codePointOffsetToUtf16(source, 7),
    suggestion: null, engine: 'host/example',
  };
  const paragraph = root.ownerDocument.createElement('p');
  paragraph.dataset.voiceUnit = unit.id;
  paragraph.textContent = source;
  root.replaceChildren(paragraph); // Only this example host changes its own DOM.
  const controller = mountVoiceReview({
    root, units: [unit], findings: [finding], feedback: [],
    onSelect(selection) { console.info('Selected text:', selection.quote); },
  });
  controller.getDiagnostics();
  controller.update({ findings: [finding] });
  return () => controller.dispose();
}
