import { I18nService, TranslatePipe } from './i18n.service';
import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import type {
  DocumentDetail,
  Feedback,
  ImprovementRequest,
  ImprovementTask,
  TaskApplyResult,
  TaskPrompt,
  RunnerReviewStatus,
} from "@voice/contracts";
import type { StudioApi } from "./semantic-review.component";

export interface SourceTaskDocumentApplied {
  projectId: string;
  document: DocumentDetail;
}

@Component({
  selector: "voice-source-tasks",
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: "./source-tasks.component.html",
  styleUrl: "./source-tasks.component.css",
})
export class SourceTasksComponent implements OnChanges, OnDestroy {
  readonly i18n = inject(I18nService);

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(this.i18n.locale() === 'de' ? 'de-DE' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  @Input({ required: true }) projectId = "";
  @Input({ required: true }) document!: DocumentDetail;
  @Input({ required: true }) api!: StudioApi;
  @Input() activeFeedbackId: string | null = null;
  @Input() disabled = false;
  @Output() documentApplied = new EventEmitter<SourceTaskDocumentApplied>();
  @Output() refreshSource = new EventEmitter<void>();

  private readonly zone = inject(NgZone);
  private sequence = 0;
  private viewSequence = 0;
  private documentKey = "";
  private currentDocument: DocumentDetail | null = null;
  private previousFeedbackId: string | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private createAttempt: { key: string; requestId: string } | null = null;
  private readonly startAttempts = new Map<string, string>();

  readonly tasks = signal<ImprovementTask[]>([]);
  readonly selectedTask = signal<ImprovementTask | null>(null);
  readonly legacyRequests = signal<ImprovementRequest[]>([]);
  readonly runner = signal<RunnerReviewStatus | null>(null);
  readonly runnerLoading = signal(false);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal("");
  readonly notice = signal("");
  readonly conflict = signal(false);
  readonly composeOpen = signal(true);
  readonly attachedFeedbackIds = signal<string[]>([]);
  readonly manualPrompt = signal<TaskPrompt | null>(null);
  instruction = "";
  resolutionNote = "";

  ngOnChanges(): void {
    if (!this.document) return;
    const key = this.projectId + ":" + this.document.id;
    const changedDocument = key !== this.documentKey;
    if (changedDocument || this.currentDocument !== this.document) {
      const previousTaskId = changedDocument
        ? null
        : (this.selectedTask()?.id ?? null);
      this.documentKey = key;
      this.currentDocument = this.document;
      ++this.sequence;
      this.beginView();
      this.loading.set(true);
      this.mutating.set(false);
      this.conflict.set(false);
      this.selectedTask.set(null);
      this.runner.set(null);
      this.runnerLoading.set(false);
      this.tasks.set([]);
      this.legacyRequests.set([]);
      if (changedDocument) {
        this.instruction = "";
        this.resolutionNote = "";
        this.createAttempt = null;
        this.startAttempts.clear();
        this.composeOpen.set(true);
        this.attachedFeedbackIds.set([]);
        this.previousFeedbackId = null;
      } else {
        const ids = new Set(this.document.feedback.map((item) => item.id));
        this.attachedFeedbackIds.update((items) =>
          items.filter((id) => ids.has(id)),
        );
      }
      void this.load(previousTaskId, changedDocument);
    }
    if (
      this.activeFeedbackId &&
      this.activeFeedbackId !== this.previousFeedbackId &&
      this.document.feedback.some((item) => item.id === this.activeFeedbackId)
    ) {
      this.attachedFeedbackIds.set([this.activeFeedbackId]);
    }
    this.previousFeedbackId = this.activeFeedbackId;
  }

  private route(): string {
    return (
      "/api/projects/" +
      encodeURIComponent(this.projectId) +
      "/documents/" +
      encodeURIComponent(this.document.id) +
      "/tasks"
    );
  }

  private beginView(): number {
    clearTimeout(this.pollTimer);
    this.error.set("");
    this.notice.set("");
    this.manualPrompt.set(null);
    return ++this.viewSequence;
  }

  private current(sequence: number, view: number): boolean {
    return sequence === this.sequence && view === this.viewSequence;
  }

  private async load(
    previousTaskId: string | null,
    changedDocument: boolean,
  ): Promise<void> {
    const sequence = this.sequence,
      view = this.viewSequence,
      route = this.route();
    try {
      const [runner, tasks, requests] = await Promise.all([
        this.api<RunnerReviewStatus>("/api/semantic-review/status"),
        this.api<ImprovementTask[]>(route),
        this.api<ImprovementRequest[]>(route.replace(/\/tasks$/, "/requests")),
      ]);
      if (!this.current(sequence, view)) return;
      this.runner.set(runner);
      this.tasks.set(tasks);
      this.legacyRequests.set(requests);
      const selected =
        tasks.find((item) => item.id === previousTaskId) ??
        tasks.find((item) => this.isActive(item)) ??
        tasks.find((item) => item.status === "ready") ??
        tasks[0];
      this.selectedTask.set(selected ?? null);
      if (changedDocument && tasks.length) this.composeOpen.set(false);
      this.schedulePoll(sequence, view);
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      if (this.current(sequence, view)) this.loading.set(false);
    }
  }

  async refreshRunner(): Promise<void> {
    if (this.runnerLoading()) return;
    const sequence = this.sequence;
    this.runnerLoading.set(true);
    try {
      const status = await this.api<RunnerReviewStatus>(
        "/api/semantic-review/status",
      );
      if (sequence === this.sequence) this.runner.set(status);
    } catch (error) {
      if (sequence === this.sequence) this.showError(error);
    } finally {
      if (sequence === this.sequence) this.runnerLoading.set(false);
    }
  }

  isBusy(): boolean {
    return this.disabled || this.loading() || this.mutating();
  }
  isActive(task: ImprovementTask): boolean {
    return task.status === "running" || task.status === "cancelling";
  }
  hasActiveTask(): boolean {
    return this.tasks().some((task) => this.isActive(task));
  }
  isCurrent(task: ImprovementTask): boolean {
    return (
      task.projectId === this.projectId &&
      task.documentId === this.document.id &&
      task.sourceVersion === this.document.version &&
      task.reviewRevision === this.document.reviewRevision
    );
  }
  canStart(task: ImprovementTask): boolean {
    return (
      !this.isBusy() &&
      !this.conflict() &&
      !!this.runner()?.available &&
      task.status === "queued" &&
      this.isCurrent(task) &&
      !this.hasActiveTask()
    );
  }
  canApply(task: ImprovementTask): boolean {
    return (
      !this.isBusy() &&
      !this.conflict() &&
      task.status === "ready" &&
      this.isCurrent(task) &&
      task.proposal?.state === "pending" &&
      task.proposal.expectedVersion === this.document.version
    );
  }
  label(task: ImprovementTask): string {
    if (task.status === "completed")
      return task.resolution === "manual"
        ? "Als bearbeitet markiert"
        : "Vom Agent als erfüllt bewertet";
    return (
      (
        {
          queued: "Bereit zur Übergabe",
          running: "In Bearbeitung",
          cancelling: "Abbruch läuft",
          ready: "Ergebnis prüfen",
          failed: "Fehlgeschlagen",
          cancelled: "Abgebrochen",
          applied: "Übernommen",
          stale: "Quelle oder Feedback geändert",
          interrupted: "Durch Neustart unterbrochen",
          needs_review: "Klärung nötig",
        } as Record<string, string>
      )[task.status] ?? task.status
    );
  }
  feedbackFor(id: string): Feedback | undefined {
    return this.document.feedback.find((item) => item.id === id);
  }
  selectableFeedback(): Feedback[] {
    return this.document.feedback.filter((item) => item.status !== "resolved");
  }
  feedbackHeading(feedback: Feedback): string {
    const firstLine =
      feedback.comment
        .replace(/^\[[^\]\r\n]+\]\s*/, "")
        .split(/\r?\n/)
        .find((line) => line.trim())
        ?.trim() ?? this.i18n.t("Rückmeldung");
    return this.feedbackExcerpt(firstLine, 130);
  }
  feedbackExcerpt(value: string, limit = 110): string {
    const text = value.replace(/\s+/g, " ").trim();
    return text.length > limit
      ? text.slice(0, limit - 1).trimEnd() + "…"
      : text;
  }

  feedbackAttached(id: string): boolean {
    return this.attachedFeedbackIds().includes(id);
  }
  toggleFeedback(id: string): void {
    this.attachedFeedbackIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  newTask(): void {
    this.composeOpen.set(true);
    this.notice.set("");
    this.error.set("");
  }

  prepareTask(instruction: string, feedbackIds: string[]): void {
    if (this.isBusy()) return;
    this.instruction = instruction;
    this.attachedFeedbackIds.set(
      feedbackIds.filter((id) => !!this.feedbackFor(id)),
    );
    this.createAttempt = null;
    this.composeOpen.set(true);
    this.notice.set(
      "Entwurf vorbereitet. Erst Speichern legt eine neue Aufgabe an.",
    );
  }

  async create(): Promise<void> {
    if (this.isBusy() || this.conflict() || !this.instruction.trim()) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    const values = {
      instruction: this.instruction.trim(),
      feedbackIds: [...this.attachedFeedbackIds()],
      expectedVersion: this.document.version,
      expectedReviewRevision: this.document.reviewRevision,
    };
    const key = JSON.stringify(values);
    if (this.createAttempt?.key !== key)
      this.createAttempt = { key, requestId: crypto.randomUUID() };
    this.mutating.set(true);
    try {
      const task = await this.api<ImprovementTask>(route, "POST", {
        ...values,
        requestId: this.createAttempt.requestId,
      });
      if (!this.current(sequence, view)) return;
      this.showTask(task);
      this.instruction = "";
      this.createAttempt = null;
      this.composeOpen.set(false);
      this.notice.set(
        "Aufgabe bei der Quelldatei gespeichert. Du kannst sie jetzt an den Runner übergeben.",
      );
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async openTask(task: ImprovementTask): Promise<void> {
    if (this.isBusy()) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    this.mutating.set(true);
    try {
      const updated = await this.api<ImprovementTask>(
        route + "/" + encodeURIComponent(task.id),
      );
      if (this.current(sequence, view)) this.showTask(updated);
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async start(task: ImprovementTask): Promise<void> {
    if (!this.canStart(task)) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    const key = task.id + ":" + task.revision;
    if (!this.startAttempts.has(key))
      this.startAttempts.set(key, crypto.randomUUID());
    const input = {
      expectedTaskRevision: task.revision,
      expectedVersion: this.document.version,
      expectedReviewRevision: this.document.reviewRevision,
      requestId: this.startAttempts.get(key)!,
    };
    this.mutating.set(true);
    try {
      const updated = await this.api<ImprovementTask>(
        route + "/" + encodeURIComponent(task.id) + "/start",
        "POST",
        input,
      );
      if (this.current(sequence, view)) this.showTask(updated);
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async cancel(task: ImprovementTask): Promise<void> {
    if (this.isBusy() || task.status !== "running") return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    this.mutating.set(true);
    try {
      const updated = await this.api<ImprovementTask>(
        route + "/" + encodeURIComponent(task.id) + "/cancel",
        "POST",
        { expectedTaskRevision: task.revision },
      );
      if (this.current(sequence, view)) this.showTask(updated);
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async apply(task: ImprovementTask): Promise<void> {
    if (!this.canApply(task)) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route(),
      projectId = this.projectId;
    const input = {
      expectedTaskRevision: task.revision,
      expectedVersion: this.document.version,
      expectedReviewRevision: this.document.reviewRevision,
    };
    this.mutating.set(true);
    try {
      const result = await this.api<TaskApplyResult>(
        route + "/" + encodeURIComponent(task.id) + "/apply",
        "POST",
        input,
      );
      if (!this.current(sequence, view)) return;
      this.showTask(result.task);
      this.notice.set(
        "Änderung in die Quelldatei übernommen. Das Feedback bleibt zur Nachprüfung erhalten.",
      );
      this.documentApplied.emit({ projectId, document: result.document });
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  canResolve(task: ImprovementTask): boolean {
    return (
      !this.isBusy() &&
      !this.conflict() &&
      !this.isActive(task) &&
      task.status !== "completed" &&
      task.status !== "applied" &&
      !!this.resolutionNote.trim() &&
      this.resolutionNote.trim().length <= 4000
    );
  }

  async resolve(task: ImprovementTask): Promise<void> {
    if (!this.canResolve(task)) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    const input = {
      expectedTaskRevision: task.revision,
      expectedVersion: this.document.version,
      expectedReviewRevision: this.document.reviewRevision,
      note: this.resolutionNote.trim(),
    };
    this.mutating.set(true);
    try {
      const updated = await this.api<ImprovementTask>(
        route + "/" + encodeURIComponent(task.id) + "/resolve",
        "POST",
        input,
      );
      if (!this.current(sequence, view)) return;
      this.showTask(updated);
      this.resolutionNote = "";
      this.notice.set("");
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async showPrompt(task: ImprovementTask): Promise<void> {
    if (this.isBusy()) return;
    const sequence = this.sequence,
      view = this.beginView(),
      route = this.route();
    this.mutating.set(true);
    try {
      const prompt = await this.api<TaskPrompt>(
        route + "/" + encodeURIComponent(task.id) + "/prompt",
      );
      if (this.current(sequence, view)) this.manualPrompt.set(prompt);
    } catch (error) {
      if (this.current(sequence, view)) this.showError(error);
    } finally {
      this.finishMutation(sequence, view);
    }
  }

  async copyPrompt(): Promise<void> {
    const prompt = this.manualPrompt();
    if (!prompt) return;
    const sequence = this.sequence,
      view = this.viewSequence;
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      if (this.current(sequence, view))
        this.notice.set(
          "Prompt kopiert. Diese manuelle Übergabe startet keinen Runner und aktualisiert den Aufgabenstatus nicht.",
        );
    } catch {
      if (this.current(sequence, view))
        this.error.set(
          "Kopieren war nicht möglich. Du kannst den angezeigten Prompt markieren und selbst kopieren.",
        );
    }
  }

  private showTask(task: ImprovementTask): void {
    if (this.selectedTask()?.id !== task.id) this.resolutionNote = "";
    this.tasks.update((items) =>
      items.some((item) => item.id === task.id)
        ? items.map((item) => (item.id === task.id ? task : item))
        : [task, ...items],
    );
    this.selectedTask.set(task);
  }

  private finishMutation(sequence: number, view: number): void {
    if (!this.current(sequence, view)) return;
    this.mutating.set(false);
    this.schedulePoll(sequence, view);
  }

  private schedulePoll(sequence: number, view: number): void {
    clearTimeout(this.pollTimer);
    const active = this.tasks().filter((task) => this.isActive(task));
    if (!active.length) return;
    const route = this.route();
    this.pollTimer = setTimeout(
      () =>
        void this.zone.run(async () => {
          if (!this.current(sequence, view)) return;
          try {
            const updates = await Promise.all(
              active.map((task) =>
                this.api<ImprovementTask>(
                  route + "/" + encodeURIComponent(task.id),
                ),
              ),
            );
            if (!this.current(sequence, view)) return;
            this.tasks.update((items) =>
              items.map(
                (item) =>
                  updates.find((update) => update.id === item.id) ?? item,
              ),
            );
            const selected = this.selectedTask();
            if (selected)
              this.selectedTask.set(
                updates.find((update) => update.id === selected.id) ?? selected,
              );
            this.error.set("");
          } catch (error) {
            if (this.current(sequence, view))
              this.error.set(
                (error as Error).message ||
                  "Der Aufgabenstatus konnte nicht aktualisiert werden.",
              );
          } finally {
            if (this.current(sequence, view)) this.schedulePoll(sequence, view);
          }
        }),
      1800,
    );
  }

  private showError(error: unknown): void {
    const status = (error as { status?: number })?.status;
    if (status === 409 || status === 412) this.conflict.set(true);
    this.error.set(
      error instanceof Error
        ? error.message
        : "Die Aufgabe konnte nicht aktualisiert werden.",
    );
  }

  ngOnDestroy(): void {
    ++this.sequence;
    ++this.viewSequence;
    clearTimeout(this.pollTimer);
  }
}
