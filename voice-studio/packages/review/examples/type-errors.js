// @ts-check
import { mountVoiceReview } from '@voice/review';

/** @type {import('@voice/review').SourceSpan} */
// @ts-expect-error The JS consumer must also convert code-point coordinates explicitly.
const wrongJsSpan = { start: 0, end: 2, encoding: 'unicode_code_point' };
mountVoiceReview({
  root: document.body, units: [], findings: [], feedback: [],
  onSelect(selection) {
    /** @type {string} */
    // @ts-expect-error Callback inference supplies number offsets even in plain JavaScript.
    const invalid = selection.start;
    void invalid;
  },
});
void wrongJsSpan;
