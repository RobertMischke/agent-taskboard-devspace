import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  DocumentDetail, Finding, Proposal, RunnerReviewStatus, SelectionAlternative,
  SelectionDecision, SelectionDecisionResult, SelectionSuggestionInput, SelectionSuggestionRun, SelectionTarget,
} from '@voice/contracts';
import { I18nService, TranslatePipe } from './i18n.service';
import { KnowledgeService } from './knowledge.service';
import type { StudioApi } from './semantic-review.component';

interface PendingGeneration { route: string; input: SelectionSuggestionInput; }
// Tab storage survives recreation and reload. Memory retains requests if storage is unavailable.
const pendingGenerations = new Map<string, PendingGeneration>();

@Component({
  selector: 'voice-selection-review',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './selection-review.component.html',
  styleUrl: './selection-review.component.css',
})
export class SelectionReviewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) document!: DocumentDetail;
  @Input({ required: true }) selection!: SelectionTarget;
  @Input() finding: Finding | null = null;
  @Input({ required: true }) api!: StudioApi;
  @Input() disabled = false;
  @Output() proposalCreated = new EventEmitter<Proposal>();
  @Output() decisionSaved = new EventEmitter<DocumentDetail>();

  readonly i18n = inject(I18nService);
  private readonly knowledge = inject(KnowledgeService);
  private readonly zone = inject(NgZone);
  readonly status = signal<RunnerReviewStatus | null>(null);
  readonly run = signal<SelectionSuggestionRun | null>(null);
  readonly history = signal<SelectionSuggestionRun[]>([]);
  readonly activeRuns = signal<SelectionSuggestionRun[]>([]);
  readonly pendingRequest = signal<PendingGeneration | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly chosenId = signal('');
  private readonly saved = signal<SelectionDecision | null>(null);
  note = '';
  instruction = '';
  private sequence = 0;
  private viewSequence = 0;
  private currentKey = '';
  private currentDocumentKey = '';
  private pollSequence = 0;
  private draftKey = '';
  private currentDocument: DocumentDetail | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(): void {
    if (!this.document || !this.selection) return;
    const draftKey = JSON.stringify([this.projectId, this.document.id, this.document.version,
      this.selection.unitId, this.selection.start, this.selection.end, this.selection.quote, this.finding?.id]);
    const key = JSON.stringify([draftKey, this.document.reviewRevision]);
    if (key === this.currentKey && this.currentDocument === this.document) return;
    const changedSelection = draftKey !== this.draftKey;
    const documentKey = JSON.stringify([this.projectId, this.document.id]);
    if (documentKey !== this.currentDocumentKey) this.activeRuns.set([]);
    this.currentDocumentKey = documentKey;
    this.pendingRequest.set(this.readPending(this.route()));
    this.currentKey = key; this.draftKey = draftKey; this.currentDocument = this.document;
    ++this.sequence; ++this.viewSequence; this.stopPolling();
    this.error.set(''); this.busy.set(false); this.chosenId.set(''); this.saved.set(null);
    this.run.set(null); this.history.set([]); this.status.set(null);
    if (changedSelection) { this.note = ''; this.instruction = ''; }
    void this.load();
  }

  private route(): string {
    return '/api/projects/' + encodeURIComponent(this.projectId) + '/documents/' + encodeURIComponent(this.document.id);
  }
  private stopPolling(): void { ++this.pollSequence; clearTimeout(this.pollTimer); }
  private belongsToDocument(run: SelectionSuggestionRun): boolean {
    return run.projectId === this.projectId && run.documentId === this.document.id;
  }
  private readPending(route: string): PendingGeneration | null {
    const known = pendingGenerations.get(route);
    if (known) return known;
    try {
      const parsed = JSON.parse(sessionStorage.getItem('voice-studio:pending-suggestion:' + route) ?? 'null') as PendingGeneration | null;
      if (parsed?.route === route && typeof parsed.input?.requestId === 'string' &&
        typeof parsed.input.quote === 'string' && typeof parsed.input.expectedVersion === 'string' &&
        typeof parsed.input.expectedReviewRevision === 'number' && typeof parsed.input.unitId === 'string' &&
        Number.isInteger(parsed.input.start) && Number.isInteger(parsed.input.end)) {
        pendingGenerations.set(route, parsed); return parsed;
      }
    } catch { /* Session storage may be blocked; in-memory retry identity is still retained. */ }
    return null;
  }
  private savePending(request: PendingGeneration): void {
    pendingGenerations.set(request.route, request);
    this.pendingRequest.set(request);
    try { sessionStorage.setItem('voice-studio:pending-suggestion:' + request.route, JSON.stringify(request)); }
    catch { /* The current component and later instances still share the exact request in memory. */ }
  }
  private resolvePending(request: PendingGeneration): void {
    if (pendingGenerations.get(request.route)?.input.requestId !== request.input.requestId) return;
    pendingGenerations.delete(request.route);
    try { sessionStorage.removeItem('voice-studio:pending-suggestion:' + request.route); }
    catch { /* Retrying an older persisted ID still reconciles to the same server run. */ }
    if (this.document && this.route() === request.route) this.pendingRequest.set(null);
  }
  private current(sequence: number, view: number): boolean { return sequence === this.sequence && view === this.viewSequence; }
  private sameSelection(selection: SelectionTarget | null | undefined): boolean {
    return !!selection && selection.unitId === this.selection.unitId && selection.start === this.selection.start &&
      selection.end === this.selection.end && selection.quote === this.selection.quote;
  }
  validSelection(): boolean {
    const unit = this.document?.units.find(item => item.id === this.selection?.unitId);
    return !!unit && this.selection.start >= 0 && this.selection.end > this.selection.start && this.selection.end <= unit.text.length &&
      unit.text.slice(this.selection.start, this.selection.end) === this.selection.quote;
  }
  savedDecision(): SelectionDecision | undefined {
    const decisions = [this.saved(), ...(this.document.decisions ?? [])];
    return decisions.find((decision): decision is SelectionDecision => !!decision && decision.kind === 'keep' &&
      decision.status === 'current' && decision.sourceVersion === this.document.version && this.sameSelection(decision));
  }
  isCurrent(run: SelectionSuggestionRun): boolean {
    return run.projectId === this.projectId && run.documentId === this.document.id &&
      run.sourceVersion === this.document.version && this.sameSelection(run.selection);
  }
  isActive(run: SelectionSuggestionRun | null): boolean {
    return !!run && (run.status === 'running' || run.status === 'cancelling');
  }
  hasActiveRun(): boolean { return this.activeRuns().some(item => this.isActive(item)); }
  hasGeneratedAlternatives(): boolean {
    const run = this.run();
    return !!run && this.isCurrent(run) && run.status === 'completed';
  }
  alternatives(): SelectionAlternative[] {
    const run = this.run();
    if (run && this.hasGeneratedAlternatives()) return run.alternatives;
    const finding = this.finding;
    if (!finding || finding.suggestion === null || !this.sameSelection(finding) || finding.suggestion === this.selection.quote) return [];
    const rule = finding.engine === 'voice-studio/local-rules-v0' ? this.knowledge.entry(finding.ruleId) : undefined;
    return [{ id: 'finding:' + finding.id, replacement: finding.suggestion,
      reason: rule?.explanation?.replaceAll('{quote}', finding.quote) ?? finding.explanation }];
  }

  private async load(): Promise<void> {
    const sequence = this.sequence, view = this.viewSequence, route = this.route();
    this.loading.set(true);
    try {
      const [status, history] = await Promise.all([
        this.api<RunnerReviewStatus>('/api/semantic-review/status'),
        this.api<SelectionSuggestionRun[]>(route + '/suggestions'),
      ]);
      if (!this.current(sequence, view)) return;
      this.status.set(status);
      const documentRuns = history.filter(item => this.belongsToDocument(item));
      // Preserve a newly acknowledged run if this list snapshot predates its acceptance.
      for (const item of documentRuns) this.recordRun(item, false);
      const relevant = documentRuns.filter(item => this.isCurrent(item));
      this.history.set(relevant);
      const latest = relevant.find(item => this.isActive(item)) ?? relevant[0];
      if (latest) this.showRun(latest);
      else { this.run.set(null); this.schedulePoll(); }
    } catch (error) { if (this.current(sequence, view)) this.error.set(this.errorMessage(error)); }
    finally { if (this.current(sequence, view)) { this.loading.set(false); this.schedulePoll(); } }
  }
  async reload(): Promise<void> {
    if (this.busy() || this.loading()) return;
    ++this.viewSequence; this.stopPolling(); this.error.set('');
    await this.load();
  }
  async keep(): Promise<void> {
    if (this.disabled || this.busy() || !this.validSelection() || this.savedDecision()) return;
    const sequence = this.sequence, view = this.viewSequence, route = this.route();
    const input = { ...this.selection, expectedVersion: this.document.version,
      expectedReviewRevision: this.document.reviewRevision, requestId: crypto.randomUUID(),
      findingId: this.finding?.id, note: this.note.trim() || undefined };
    this.error.set(''); this.busy.set(true);
    try {
      const result = await this.api<SelectionDecisionResult>(route + '/decisions', 'POST', input);
      if (!this.current(sequence, view)) return;
      this.saved.set(result.decision); this.note = '';
      this.decisionSaved.emit(result.document);
    } catch (error) { if (this.current(sequence, view)) this.error.set(this.errorMessage(error)); }
    finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  async generate(): Promise<void> {
    if (this.pendingRequest()) { await this.retryGeneration(); return; }
    if (this.disabled || this.busy() || this.loading() || !this.validSelection() || !this.status()?.available || this.hasActiveRun()) return;
    const request: PendingGeneration = { route: this.route(), input: { ...this.selection,
      expectedVersion: this.document.version, expectedReviewRevision: this.document.reviewRevision,
      requestId: crypto.randomUUID(), instruction: this.instruction.trim() || undefined } };
    this.savePending(request);
    await this.submitGeneration(request);
  }
  async retryGeneration(): Promise<void> {
    const request = this.pendingRequest();
    if (!request || request.route !== this.route() || this.busy() || this.loading()) return;
    // A retry belongs to the original document, selection and revision, even after navigation.
    await this.submitGeneration(request);
  }
  private async submitGeneration(request: PendingGeneration): Promise<void> {
    const sequence = this.sequence, view = ++this.viewSequence;
    this.stopPolling(); this.error.set(''); this.busy.set(true); this.chosenId.set('');
    try {
      const run = await this.api<SelectionSuggestionRun>(request.route + '/suggestions', 'POST', request.input);
      const input = request.input;
      if (!run?.id || run.sourceVersion !== input.expectedVersion || run.selection?.unitId !== input.unitId ||
        run.selection.start !== input.start || run.selection.end !== input.end || run.selection.quote !== input.quote ||
        request.route !== '/api/projects/' + encodeURIComponent(run.projectId) + '/documents/' + encodeURIComponent(run.documentId))
        throw new Error('Die Antwort bestätigt die ursprüngliche Anfrage nicht. Bitte erneut prüfen.');
      // Confirmation resolves retry identity even if the user has moved to another selection.
      this.resolvePending(request);
      if (this.current(sequence, view)) this.showRun(run);
      else if (this.belongsToDocument(run) && this.isActive(run)) this.showRun(run, false);
    } catch (error) {
      // An HTTP or network error does not prove that an accepted model request never ran.
      // Only a server proof for this exact ID can release a request that was never accepted.
      const rejected = error as { suggestionRequestId?: string; suggestionRequestAccepted?: boolean } | null;
      if (rejected?.suggestionRequestAccepted === false && rejected.suggestionRequestId === request.input.requestId)
        this.resolvePending(request);
      if (this.current(sequence, view)) this.error.set(this.errorMessage(error));
    } finally {
      if (this.current(sequence, view)) this.busy.set(false);
      if (this.document && request.route === this.route()) this.schedulePoll();
    }
  }
  async choose(alternative: SelectionAlternative): Promise<void> {
    if (this.disabled || this.busy() || !this.validSelection() || alternative.replacement === this.selection.quote ||
      !this.alternatives().some(item => item.id === alternative.id && item.replacement === alternative.replacement)) return;
    const sequence = this.sequence, view = this.viewSequence, route = this.route();
    const input = { unitId: this.selection.unitId, start: this.selection.start, end: this.selection.end,
      replacement: alternative.replacement, expectedVersion: this.document.version };
    this.error.set(''); this.busy.set(true);
    try {
      const proposal = await this.api<Proposal>(route + '/proposals', 'POST', input);
      if (!this.current(sequence, view)) return;
      this.chosenId.set(alternative.id); this.proposalCreated.emit(proposal);
    } catch (error) { if (this.current(sequence, view)) this.error.set(this.errorMessage(error)); }
    finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  async openRun(run: SelectionSuggestionRun): Promise<void> {
    if (this.busy() || this.loading()) return;
    const sequence = this.sequence, view = ++this.viewSequence, route = this.route();
    this.stopPolling(); this.error.set(''); this.busy.set(true); this.chosenId.set('');
    // Hide old candidates until the server has revalidated this saved run.
    this.run.set(null);
    try {
      const updated = await this.api<SelectionSuggestionRun>(route + '/suggestions/' + encodeURIComponent(run.id));
      if (this.current(sequence, view)) this.showRun(updated);
    } catch (error) { if (this.current(sequence, view)) this.error.set(this.errorMessage(error)); }
    finally { if (this.current(sequence, view)) { this.busy.set(false); this.schedulePoll(); } }
  }
  async cancel(target: SelectionSuggestionRun | null = this.run()): Promise<void> {
    const run = this.activeRuns().find(item => item.id === target?.id);
    if (this.busy() || this.loading() || !run || run.status !== 'running' || !this.belongsToDocument(run)) return;
    const sequence = this.sequence, view = ++this.viewSequence, route = this.route();
    this.stopPolling(); this.error.set(''); this.busy.set(true);
    this.recordRun({ ...run, status: 'cancelling' }, this.run()?.id === run.id);
    try {
      const updated = await this.api<SelectionSuggestionRun>(route + '/suggestions/' + encodeURIComponent(run.id) + '/cancel', 'POST');
      if (this.current(sequence, view)) this.showRun(updated, this.run()?.id === run.id);
    } catch (error) {
      if (this.current(sequence, view)) { this.showRun(run, this.run()?.id === run.id); this.error.set(this.errorMessage(error)); }
    } finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  private recordRun(run: SelectionSuggestionRun, select: boolean): void {
    if (!this.belongsToDocument(run)) return;
    this.activeRuns.update(items => this.isActive(run)
      ? (items.some(item => item.id === run.id) ? items.map(item => item.id === run.id ? run : item) : [run, ...items])
      : items.filter(item => item.id !== run.id));
    if (select || this.run()?.id === run.id) this.run.set(run);
    if (this.isCurrent(run)) this.history.update(items => items.some(item => item.id === run.id)
      ? items.map(item => item.id === run.id ? run : item) : [run, ...items]);
  }
  private showRun(run: SelectionSuggestionRun, select = true): void {
    this.recordRun(run, select);
    this.schedulePoll();
  }
  private schedulePoll(): void {
    this.stopPolling();
    if (!this.activeRuns().length) return;
    const route = this.route(), sequence = this.sequence, poll = this.pollSequence;
    this.pollTimer = setTimeout(() => void this.zone.run(async () => {
      if (sequence !== this.sequence || poll !== this.pollSequence) return;
      const results = await Promise.allSettled(this.activeRuns().map(run =>
        this.api<SelectionSuggestionRun>(route + '/suggestions/' + encodeURIComponent(run.id))));
      if (sequence !== this.sequence || poll !== this.pollSequence) return;
      for (const result of results) {
        if (result.status === 'fulfilled') this.recordRun(result.value, false);
        else this.error.set(this.errorMessage(result.reason));
      }
      this.schedulePoll();
    }), 1500);
  }
  label(run: SelectionSuggestionRun): string {
    if (!this.isCurrent(run) && !this.isActive(run)) return 'Die Quelle oder Auswahl hat sich geändert.';
    return ({ running: 'Alternativen werden erstellt …', cancelling: 'Erstellung wird abgebrochen …',
      completed: 'Alternativen bereit', failed: 'Alternativen konnten nicht erstellt werden.',
      cancelled: 'Erstellung abgebrochen', stale: 'Quelle oder Kontext inzwischen geändert. Bitte erneut erstellen.',
      interrupted: 'Durch Neustart unterbrochen' } as Record<string, string>)[run.status] ?? run.status;
  }
  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(this.i18n.locale() === 'de' ? 'de-DE' : 'en-GB',
      { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.';
  }
  ngOnDestroy(): void { ++this.sequence; ++this.viewSequence; this.stopPolling(); }
}
