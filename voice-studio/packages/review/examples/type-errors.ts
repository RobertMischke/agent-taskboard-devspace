// Deliberately invalid consumers: each expected error must remain a real type error.
import { mountVoiceReview, type SourceSpan, type Finding } from '@voice/review';

// @ts-expect-error A code-point span must be converted before it enters this API.
const wrongEncoding: SourceSpan = { start: 0, end: 2, encoding: 'unicode_code_point' };
// @ts-expect-error root is an HTMLElement, not a CSS selector string.
mountVoiceReview({ root: '#preview', units: [], findings: [], feedback: [] });
declare const controller: ReturnType<typeof mountVoiceReview>;
// @ts-expect-error Root identity cannot change through update; dispose and mount the new root.
controller.update({ root: document.body });
// @ts-expect-error Categories remain a closed public union.
const wrongCategory: Finding['category'] = 'seo';
mountVoiceReview({
  root: document.body, units: [], findings: [], feedback: [],
  onSelect(selection) {
    // @ts-expect-error Inferred selection offsets are numbers, not strings or any.
    const invalid: string = selection.start;
    void invalid;
  },
});
void wrongEncoding; void wrongCategory;
