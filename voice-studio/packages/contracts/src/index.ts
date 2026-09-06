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
export interface Proposal { id: string; documentId: string; before: string; after: string; replacement: string; sourceBefore: string; sourceAfter: string; expectedVersion: string; sourceSpan: SourceSpan; feedbackId: string | null; reason: string; state: string; taskId?: string | null; runId?: string | null; edits?: ProposalEdit[] | null; }
export interface ImprovementRequest { id: string; projectId: string; documentId: string; feedbackIds: string[]; instruction: string; expectedVersion: string; status: string; createdAt: string; }
export interface SelectionTarget { unitId: string; quote: string; start: number; end: number; }
export interface ReviewClient {
  getDocument(projectId: string, documentId: string): Promise<DocumentDetail>;
  saveFeedback(projectId: string, documentId: string, input: FeedbackInput): Promise<DocumentDetail>;
}

export interface ProposalEdit { unitId: string; start: number; end: number; quote: string; replacement: string; reason: string; }
export type ImprovementTaskStatus = 'queued' | 'running' | 'cancelling' | 'ready' | 'failed' | 'cancelled' | 'applied' | 'stale' | 'interrupted' | 'completed' | 'needs_review';
export interface ImprovementTask { id: string; projectId: string; documentId: string; instruction: string; feedbackIds: string[]; sourceVersion: string; reviewRevision: number; revision: number; status: ImprovementTaskStatus; createdAt: string; updatedAt: string; runId: string | null; proposalId: string | null; error: string | null; proposal: Proposal | null; notes?: string[] | null; resolution?: 'agent_no_changes' | 'manual' | null; }
export interface ImprovementTaskInput { instruction: string; feedbackIds: string[]; expectedVersion: string; expectedReviewRevision: number; requestId: string; }
export interface TaskStartInput { expectedTaskRevision: number; expectedVersion: string; expectedReviewRevision: number; requestId: string; }
export interface TaskPrompt { prompt: string; sourceVersion: string; reviewRevision: number; }
export interface TaskApplyResult { task: ImprovementTask; document: DocumentDetail; }

export interface TaskResolveInput { expectedTaskRevision: number; expectedVersion: string; expectedReviewRevision: number; note: string; }
export interface RunnerReviewStatus { configured: boolean; available: boolean; cli: string | null; model: string | null; thinkingLevel: string | null; permissionMode: string; contextMode: string; qualification: string; routing: string; message: string; timeoutSeconds: number; }

/** Host-configured local build/test process; never a model run. */
export type ProjectCheckStatus = 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'stale';
export interface ProjectCheckConfiguration {
  configured: boolean;
  startable: boolean;
  label?: string;
  message?: string;
  currentSourceVersion?: string;
  configurationVersion?: string;
  timeoutSeconds?: number;
  inputFileCount?: number;
  inputBytes?: number;
  logLimitChars: number;
}
export interface ProjectCheckRun {
  id: string;
  projectId: string;
  label: string;
  sourceVersion: string;
  configurationVersion: string;
  status: ProjectCheckStatus;
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  error?: string;
  log: string;
  logTruncated: boolean;
  inputFileCount: number;
  inputBytes: number;
  outcome?: 'completed' | 'failed' | 'cancelled';
}
export interface ProjectCheckStartInput { expectedSourceVersion: string; expectedConfigurationVersion: string; requestId: string; }
