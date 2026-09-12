import { I18nService, TranslatePipe } from './i18n.service';
import {
  Component,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import type {
  DocumentDetail,
  ProjectCheckConfiguration,
  ProjectCheckRun,
  ProjectCheckStartInput,
} from "@voice/contracts";
import type { StudioApi } from "./semantic-review.component";

@Component({
  selector: "voice-project-checks",
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: "./project-checks.component.html",
  styleUrl: "./project-checks.component.css",
})
export class ProjectChecksComponent implements OnChanges, OnDestroy {
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
  @Input({ required: true }) api!: StudioApi;
  @Input() sourceSnapshot: DocumentDetail | null = null;
  @Input() disabled = false;
  readonly configuration = signal<ProjectCheckConfiguration | null>(null);
  readonly runs = signal<ProjectCheckRun[]>([]);
  readonly selectedRun = signal<ProjectCheckRun | null>(null);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal("");
  private readonly zone = inject(NgZone);
  private contextProject = "";
  private contextSource: DocumentDetail | null = null;
  private sequence = 0;
  private mutationRevision = 0;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private startAttempt: { key: string; requestId: string } | null = null;

  ngOnChanges(): void {
    if (!this.projectId) return;
    if (
      this.projectId !== this.contextProject ||
      this.sourceSnapshot !== this.contextSource
    ) {
      const changedProject = this.contextProject !== this.projectId;
      this.contextProject = this.projectId;
      this.contextSource = this.sourceSnapshot;
      if (changedProject) {
        this.runs.set([]);
        this.selectedRun.set(null);
        this.startAttempt = null;
      }
      void this.reload();
    }
  }

  private route(): string {
    return "/api/projects/" + encodeURIComponent(this.projectId) + "/checks";
  }
  isActive(run: ProjectCheckRun): boolean {
    return run.status === "running" || run.status === "cancelling";
  }
  activeRun(): ProjectCheckRun | undefined {
    return this.runs().find((run) => this.isActive(run));
  }
  isBusy(): boolean {
    return this.disabled || this.loading() || this.mutating();
  }
  isStale(run: ProjectCheckRun): boolean {
    if (this.isActive(run)) return false;
    const config = this.configuration();
    return (
      run.status === "stale" ||
      !!(
        config?.currentSourceVersion &&
        run.sourceVersion !== config.currentSourceVersion
      ) ||
      !!(
        config?.configurationVersion &&
        run.configurationVersion !== config.configurationVersion
      )
    );
  }
  currentStandKnown(): boolean {
    return !!this.configuration()?.currentSourceVersion;
  }
  resultStatus(run: ProjectCheckRun): string {
    return this.isActive(run)
      ? run.status
      : !this.currentStandKnown()
        ? "unknown"
        : this.isStale(run)
          ? "stale"
          : run.status;
  }
  label(run: ProjectCheckRun): string {
    if (!this.isActive(run) && !this.currentStandKnown())
      return "Prüfstand nicht bestätigt";
    if (this.isStale(run)) return "Prüfung veraltet";
    return {
      running: "Prüfung läuft",
      cancelling: "Abbruch läuft",
      completed: "Prüfung bestanden",
      failed: "Prüfung fehlgeschlagen",
      cancelled: "Prüfung abgebrochen",
      stale: "Prüfung veraltet",
    }[run.status];
  }
  outcome(run: ProjectCheckRun): string {
    return {
      completed: "bestanden",
      failed: "fehlgeschlagen",
      cancelled: "abgebrochen",
    }[run.outcome ?? "failed"];
  }
  canStart(): boolean {
    const config = this.configuration();
    return (
      !this.isBusy() &&
      !!config?.configured &&
      !!config.startable &&
      !!config.currentSourceVersion &&
      !!config.configurationVersion &&
      !this.activeRun()
    );
  }

  async reload(): Promise<void> {
    const sequence = ++this.sequence;
    clearTimeout(this.pollTimer);
    const route = this.route(),
      previousId = this.selectedRun()?.id;
    this.loading.set(true);
    this.mutating.set(false);
    this.error.set("");
    this.configuration.set(null);
    try {
      const [configuration, runs] = await Promise.all([
        this.api<ProjectCheckConfiguration>(route + "/configuration"),
        this.api<ProjectCheckRun[]>(route),
      ]);
      if (sequence !== this.sequence) return;
      if (
        !configuration ||
        typeof configuration.configured !== "boolean" ||
        !Array.isArray(runs)
      ) {
        throw new Error(
          "Diese API stellt noch keine Projektprüfungen bereit. Aktualisiere das Backend und lies den Prüfstand erneut ein.",
        );
      }
      this.configuration.set(configuration);
      this.runs.set(runs);
      this.selectedRun.set(
        runs.find((run) => run.id === previousId) ??
          runs.find((run) => this.isActive(run)) ??
          runs[0] ??
          null,
      );
    } catch (error) {
      if (sequence === this.sequence) this.showError(error);
    } finally {
      if (sequence === this.sequence) {
        this.loading.set(false);
        this.schedulePoll(sequence);
      }
    }
  }

  selectRun(run: ProjectCheckRun): void {
    if (!this.mutating()) this.selectedRun.set(run);
  }

  async start(): Promise<void> {
    if (!this.canStart()) return;
    const sequence = this.sequence,
      route = this.route();
    const expectedSourceVersion = this.configuration()!.currentSourceVersion!;
    const expectedConfigurationVersion =
      this.configuration()!.configurationVersion!;
    const key =
      this.projectId +
      ":" +
      expectedSourceVersion +
      ":" +
      this.configuration()!.configurationVersion;
    if (this.startAttempt?.key !== key)
      this.startAttempt = { key, requestId: crypto.randomUUID() };
    ++this.mutationRevision;
    this.mutating.set(true);
    this.error.set("");
    clearTimeout(this.pollTimer);
    try {
      const input: ProjectCheckStartInput = {
        expectedSourceVersion,
        expectedConfigurationVersion,
        requestId: this.startAttempt.requestId,
      };
      const run = await this.api<ProjectCheckRun>(route, "POST", input);
      if (sequence !== this.sequence) return;
      this.updateRun(run);
      this.selectedRun.set(run);
      this.startAttempt = null;
    } catch (error) {
      if (sequence === this.sequence) this.showError(error);
    } finally {
      if (sequence === this.sequence) {
        this.mutating.set(false);
        this.schedulePoll(sequence);
      }
    }
  }

  async cancel(run: ProjectCheckRun): Promise<void> {
    if (this.isBusy() || run.status !== "running") return;
    const sequence = this.sequence,
      route = this.route();
    ++this.mutationRevision;
    this.mutating.set(true);
    this.error.set("");
    clearTimeout(this.pollTimer);
    try {
      const updated = await this.api<ProjectCheckRun>(
        route + "/" + encodeURIComponent(run.id) + "/cancel",
        "POST",
      );
      if (sequence === this.sequence) this.updateRun(updated);
    } catch (error) {
      if (sequence === this.sequence) this.showError(error);
    } finally {
      if (sequence === this.sequence) {
        this.mutating.set(false);
        this.schedulePoll(sequence);
      }
    }
  }

  private updateRun(run: ProjectCheckRun): void {
    this.runs.update((runs) =>
      runs.some((item) => item.id === run.id)
        ? runs.map((item) => (item.id === run.id ? run : item))
        : [run, ...runs],
    );
    if (this.selectedRun()?.id === run.id) this.selectedRun.set(run);
  }
  private schedulePoll(sequence: number): void {
    clearTimeout(this.pollTimer);
    if (sequence !== this.sequence || !this.activeRun()) return;
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setTimeout(
        () => this.zone.run(() => void this.poll(sequence)),
        1800,
      );
    });
  }
  private async poll(sequence: number): Promise<void> {
    const active = this.activeRun(),
      mutationRevision = this.mutationRevision;
    if (sequence !== this.sequence || !active || this.mutating()) return;
    try {
      const run = await this.api<ProjectCheckRun>(
        this.route() + "/" + encodeURIComponent(active.id),
      );
      if (
        sequence !== this.sequence ||
        mutationRevision !== this.mutationRevision
      )
        return;
      // A cancellation response may have arrived while this read was in flight.
      const current = this.runs().find((item) => item.id === run.id);
      if (current?.status === "cancelling" && run.status === "running") return;
      if (current && !this.isActive(current) && this.isActive(run)) return;
      this.updateRun(run);
    } catch (error) {
      if (sequence === this.sequence) this.showError(error);
    } finally {
      if (sequence === this.sequence) this.schedulePoll(sequence);
    }
  }
  private showError(error: unknown): void {
    const value = error as { message?: string; status?: number };
    if (value?.status === 409 || value?.status === 412) {
      this.configuration.set(null);
      this.error.set(
        "Der Projektstand hat sich geändert. Aktualisiere den Stand vor einer neuen Prüfung.",
      );
    } else
      this.error.set(
        value?.message ?? "Projektprüfung konnte nicht geladen werden.",
      );
  }
  ngOnDestroy(): void {
    ++this.sequence;
    clearTimeout(this.pollTimer);
  }
}
