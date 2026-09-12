import {
  mountVoiceReview, codePointOffsetToUtf16,
  type Finding, type SelectionTarget, type SourceSpan, type TextUnit,
  type VoiceReviewController,
} from '@voice/review';

/** Host-owned source adapter output. Real HTML/Markdown needs its own file mapping. */
export interface ReviewSnapshot {
  source: string;
  sourceVersion: string;
  units: readonly TextUnit[];
  findings: readonly Finding[];
}

/** Mount supplied findings; neither this function nor the library runs an analyzer. */
export function mountSnapshot(
  root: HTMLElement,
  snapshot: ReviewSnapshot,
  onSelect: (selection: SelectionTarget, sourceVersion: string) => void,
): VoiceReviewController {
  const controller = mountVoiceReview({
    root, units: snapshot.units, findings: snapshot.findings, feedback: [],
    onSelect(selection) {
      // Inferred SelectionTarget: quote is text; start/end are unit-local UTF-16 offsets.
      if (selection.quote) onSelect(selection, snapshot.sourceVersion);
    },
  });
  controller.getDiagnostics();
  return controller;
}

// An exact plain-text source example: the emoji occupies two UTF-16 code units.
// A real source adapter supplies these units and the checked source version.
export const source = '🧭 Clear copy.';
export const sourceSpan: SourceSpan = { start: 0, end: source.length, encoding: 'utf16' };
export const unit: TextUnit = { id: 'intro', text: source, sourceSpan, kind: 'paragraph', language: 'en' };
export const finding: Finding = {
  id: 'demo-wording', ruleId: 'host.example', category: 'wording', severity: 'info',
  message: 'Example finding supplied by the host', explanation: 'This is example data, not an analysis result.',
  quote: 'Clear', unitId: unit.id,
  start: codePointOffsetToUtf16(source, 2), end: codePointOffsetToUtf16(source, 7),
  suggestion: null, engine: 'host/example',
};

export function runPlainTextExample(root: HTMLElement): () => void {
  const paragraph = root.ownerDocument.createElement('p');
  paragraph.dataset.voiceUnit = unit.id;
  paragraph.textContent = source;
  root.replaceChildren(paragraph); // The example host owns its markup, not the library.
  const controller = mountSnapshot(root, {
    source, sourceVersion: 'example-v1', units: [unit], findings: [finding],
  }, selection => {
    console.info('Selected text:', selection.quote); // A real host opens its own feedback form.
  });
  controller.update({ findings: [finding] });
  controller.selectFinding(finding.id);
  return () => controller.dispose(); // Invoke on route change/component teardown.
}
