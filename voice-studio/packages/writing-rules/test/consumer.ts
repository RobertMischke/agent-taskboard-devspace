import {
  writingCatalogue, getWritingRule, selectWritingRules,
  composeWritingReviewPrompt, findWritingSignals,
  type WritingRule, type WritingSignalResult, type WritingProfileId,
} from '@voice/writing-rules';

const profile: WritingProfileId = 'public-docs';
const rule: WritingRule | undefined = getWritingRule('current-state');
const selected: readonly WritingRule[] = selectWritingRules({ profile });
const result: WritingSignalResult = findWritingSignals('A powerful example.', { language: 'en' });
const exact: 'utf16' | undefined = result.signals[0]?.encoding;
const prompt: string = composeWritingReviewPrompt({ audience: 'Developers', goal: 'Open a document', profile }).prompt;
void [rule, selected, exact, prompt];
// @ts-expect-error Unsupported locale is not silently treated as English.
findWritingSignals('text', { language: 'fr' });
// @ts-expect-error A goal is required for prompt composition.
composeWritingReviewPrompt({ audience: 'Developers' });
// @ts-expect-error Signal candidates never expose authorship probability.
result.signals[0]?.aiProbability;
// @ts-expect-error Public catalogue data cannot be mutated.
writingCatalogue.rules[0].severity = 'error';
