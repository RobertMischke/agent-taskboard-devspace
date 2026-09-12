export type { DocumentDetail, Feedback, FeedbackInput, Finding, SelectionTarget, SourceSpan, TextUnit, ReviewClient } from '@voice/contracts';
export { createTextRange, createTextRanges, findUnitElement, getUnitText, selectionToTarget, codePointOffsetToUtf16 } from './anchors.js';
export { createReviewClient, ReviewApiError } from './client.js';
export type { ReviewClientOptions } from './client.js';
export { mountVoiceReview, CATEGORY_COLORS } from './review.js';
export type { VoiceReviewOptions, VoiceReviewController, VoiceReviewDiagnostics, VoiceReviewUpdate } from './review.js';

export { connectVoiceStudio } from './studio-bridge.js';
export type { ConnectVoiceStudioOptions, VoiceStudioConnection, VoiceStudioParentMessage, VoiceStudioChildMessage, VoiceStudioMappingDiagnostics } from './studio-bridge.js';
