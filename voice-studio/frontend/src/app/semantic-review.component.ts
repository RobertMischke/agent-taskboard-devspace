import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DocumentDetail, Finding } from '@voice/contracts';

interface SemanticStatus { configured: boolean; available: boolean; cli: string | null; model: string | null; thinkingLevel: string | null; message: string; timeoutSeconds: number; }
interface SemanticFinding extends Finding { evidence: string; }
interface SemanticRun { id: string; projectId: string; documentId: string; sourceVersion: string; status: string; cli: string; model: string; thinkingLevel: string; actualModel: string | null; createdAt: string; completedAt: string | null; suppliedUnits: number; reviewedUnitIds: string[]; findings: SemanticFinding[]; notes: string[]; usageSummaries: string[]; error: string | null; contextFiles: {path: string; truncated: boolean}[]; }
export type StudioApi = <T>(path: string, method?: string, body?: unknown) => Promise<T>;

@Component({ selector: 'voice-semantic-review', standalone: true, imports: [FormsModule], templateUrl: './semantic-review.component.html' })
export class SemanticReviewComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) projectId = '';
  @Input({ required: true }) document!: DocumentDetail;
  @Input({ required: true }) api!: StudioApi;
  @Output() chooseFinding = new EventEmitter<Finding>();
  @Output() findingsChange = new EventEmitter<Finding[]>();
  private readonly zone = inject(NgZone);
  private sequence = 0;
  private viewSequence = 0;
  private currentKey = '';
  private currentDocument: DocumentDetail | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;
  readonly status = signal<SemanticStatus | null>(null);
  readonly run = signal<SemanticRun | null>(null);
  readonly history = signal<SemanticRun[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  instruction = '';

  ngOnChanges(): void {
    const key = this.projectId + ':' + this.document?.id + ':' + this.document?.version;
    if (!this.document || key === this.currentKey && this.currentDocument === this.document) return;
    // A fresh document input also reloads context-only changes with the same source hash.
    this.currentKey = key; this.currentDocument = this.document; ++this.sequence; this.beginView();
    this.run.set(null); this.history.set([]); this.status.set(null); this.findingsChange.emit([]);
    void this.load();
  }
  private route(): string { return '/api/projects/' + encodeURIComponent(this.projectId) + '/documents/' + encodeURIComponent(this.document.id) + '/semantic-reviews'; }
  private beginView(): number { clearTimeout(this.pollTimer); this.error.set(''); return ++this.viewSequence; }
  private current(sequence: number, view: number): boolean { return sequence === this.sequence && view === this.viewSequence; }
  isActive(run: SemanticRun | null): boolean { return !!run && (run.status === 'running' || run.status === 'cancelling'); }
  hasActiveRun(): boolean { return this.isActive(this.run()) || this.history().some(run => this.isActive(run)); }

  private async load(): Promise<void> {
    const sequence = this.sequence, view = this.viewSequence, route = this.route();
    this.busy.set(true);
    try {
      const [status, history] = await Promise.all([this.api<SemanticStatus>('/api/semantic-review/status'), this.api<SemanticRun[]>(route)]);
      if (!this.current(sequence, view)) return;
      this.status.set(status); this.history.set(history);
      const latest = history.find(run => this.isActive(run)) ?? history.find(run => this.isCurrent(run)) ?? history[0];
      if (latest) this.showRun(latest);
    } catch (error) { if (this.current(sequence, view)) this.error.set((error as Error).message); }
    finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  async start(): Promise<void> {
    if (this.busy() || !this.status()?.available || this.hasActiveRun()) return;
    const sequence = this.sequence, view = this.beginView(), route = this.route();
    const input = { expectedVersion: this.document.version, requestId: crypto.randomUUID(), instruction: this.instruction.trim() || undefined };
    this.busy.set(true);
    try {
      const run = await this.api<SemanticRun>(route, 'POST', input);
      if (this.current(sequence, view)) this.showRun(run);
    } catch (error) { if (this.current(sequence, view)) this.error.set((error as Error).message); }
    finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  async openRun(run: SemanticRun): Promise<void> {
    if (this.busy()) return;
    const sequence = this.sequence, view = this.beginView(), route = this.route();
    this.busy.set(true); this.run.set(null); this.findingsChange.emit([]);
    try {
      // The server revalidates source and all supplied component snapshots.
      const updated = await this.api<SemanticRun>(route + '/' + encodeURIComponent(run.id));
      if (this.current(sequence, view)) this.showRun(updated);
    } catch (error) { if (this.current(sequence, view)) this.error.set((error as Error).message); }
    finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  async cancel(): Promise<void> {
    const run = this.run(); if (this.busy() || !run || run.status !== 'running') return;
    const sequence = this.sequence, view = this.beginView(), route = this.route();
    this.busy.set(true); this.run.set({ ...run, status: 'cancelling' });
    try {
      const updated = await this.api<SemanticRun>(route + '/' + encodeURIComponent(run.id) + '/cancel', 'POST');
      if (this.current(sequence, view)) this.showRun(updated);
    } catch (error) {
      if (this.current(sequence, view)) { this.showRun(run); this.error.set((error as Error).message); }
    } finally { if (this.current(sequence, view)) this.busy.set(false); }
  }
  private showRun(run: SemanticRun): void {
    clearTimeout(this.pollTimer); this.run.set(run);
    this.history.update(items => items.some(item => item.id === run.id) ? items.map(item => item.id === run.id ? run : item) : [run, ...items]);
    this.findingsChange.emit(this.isCurrent(run) && run.status === 'completed' ? run.findings : []);
    if (this.isActive(run)) this.schedulePoll(run, this.sequence, this.viewSequence);
  }
  private schedulePoll(run: SemanticRun, sequence: number, view: number): void {
    const route = this.route();
    this.pollTimer = setTimeout(() => void this.zone.run(async () => {
      if (!this.current(sequence, view)) return;
      try {
        const updated = await this.api<SemanticRun>(route + '/' + encodeURIComponent(run.id));
        if (this.current(sequence, view)) { this.error.set(''); this.showRun(updated); }
      } catch (error) {
        if (this.current(sequence, view)) { this.error.set((error as Error).message); this.schedulePoll(run, sequence, view); }
      }
    }), 1500);
  }
  isCurrent(run: SemanticRun): boolean { return run.projectId === this.projectId && run.documentId === this.document.id && run.sourceVersion === this.document.version; }
  label(run: SemanticRun): string {
    if (!this.isCurrent(run)) return 'Quelle inzwischen geändert';
    return ({ running: 'Agent prüft die Datei …', cancelling: 'Review wird abgebrochen …', completed: 'Review abgeschlossen', failed: 'Review fehlgeschlagen', cancelled: 'Abgebrochen', stale: 'Quelle oder Komponentenkontext inzwischen geändert', incomplete: 'Unvollständige Antwort', interrupted: 'Durch Neustart unterbrochen' } as Record<string, string>)[run.status] ?? run.status;
  }
  ngOnDestroy(): void { ++this.sequence; ++this.viewSequence; clearTimeout(this.pollTimer); }
}
