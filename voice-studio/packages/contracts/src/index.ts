/** Voice Studio review API v0. Source offsets are UTF-16 code units, half-open.
 * The review adapter must explicitly convert when consuming Voice Lint's
 * proposed unicode_code_point analysis contract. These are not core spans. */
export type DocumentFormat = 'html' | 'markdown' | 'typescript';
export interface ProjectSummary { id: string; name: string; description: string; documentCount: number; liveUrl?: string | null; sourceRoutes?: Record<string, string>; sourceContexts?: Record<string, string[]>; }
export interface SourceSpan { start: number; end: number; encoding: 'utf16'; }
export interface TextUnit { id: string; text: string; sourceSpan: SourceSpan; kind: string; language: string; }
export interface Finding { id: string; ruleId: string; category: 'structure' | 'claims' | 'wording' | 'meta'; severity: 'info' | 'warning' | 'error'; message: string; explanation: string; quote: string; unitId: string; start: number; end: number; suggestion: string | null; engine: string; }
export interface Feedback { id: string; unitId: string; quote: string; prefix: string; suffix: string; start: number; end: number; comment: string; category: string; status: 'open' | 'resolved' | 'needs_recheck' | 'needs_reattachment'; sourceVersion: string; createdAt: string; updatedAt: string; }
export interface DocumentSummary { id: string; path: string; title: string; format: DocumentFormat; language: string; version: string; wordCount: number; findingCount: number; openFeedbackCount: number; }
export interface DocumentDetail extends DocumentSummary { source: string; renderedHtml: string; units: TextUnit[]; findings: Finding[]; feedback: Feedback[]; reviewRevision: number; coverage: { checkedUnits: number; totalUnits: number; excludedRegions: number; notes: string[] }; }
export interface ProjectReport { projectId: string; documents: DocumentSummary[]; totalWords: number; findingCount: number; openFeedbackCount: number; categories: Record<string, number>; rules: Record<string, number>; }
export interface FeedbackInput { unitId: string; quote: string; start: number; end: number; comment: string; category: string; expectedVersion: string; expectedReviewRevision: number; requestId: string; }
export interface ProposalInput { unitId: string; start: number; end: number; replacement: string; expectedVersion: string; feedbackId?: string; }
export interface Proposal { id: string; documentId: string; before: string; after: string; replacement: string; sourceBefore: string; sourceAfter: string; expectedVersion: string; sourceSpan: SourceSpan; feedbackId: string | null; reason: string; state: string; }
export interface ImprovementRequest { id: string; projectId: string; documentId: string; feedbackIds: string[]; instruction: string; expectedVersion: string; status: string; createdAt: string; }
export interface SelectionTarget { unitId: string; quote: string; start: number; end: number; }
export interface ReviewClient {
  getDocument(projectId: string, documentId: string): Promise<DocumentDetail>;
  saveFeedback(projectId: string, documentId: string, input: FeedbackInput): Promise<DocumentDetail>;
}
