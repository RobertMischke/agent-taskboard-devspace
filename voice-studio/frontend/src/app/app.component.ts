import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { mountVoiceReview } from "@voice/review";
import type {
  DocumentDetail,
  DocumentSummary,
  Feedback,
  Finding,
  ImprovementRequest,
  ProjectReport,
  ProjectSummary,
  Proposal,
  SelectionTarget,
  BrowserSessionResult,
} from "@voice/contracts";

import { SemanticReviewComponent, type StudioApi } from './semantic-review.component';
import { LiveBrowserComponent } from './live-browser.component';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeWikiComponent } from './knowledge-wiki.component';
import { SourceTasksComponent, type SourceTaskDocumentApplied } from './source-tasks.component';
import { ProjectChecksComponent } from './project-checks.component';

import { SelectionReviewComponent } from './selection-review.component';
import { SourceContextComponent } from './source-context.component';
import { I18nService, TranslatePipe } from './i18n.service';

type NavigationMode = 'full' | 'compact' | 'focus';
function savedNavigation(): NavigationMode {
  try { const mode = localStorage.getItem('voice-studio:navigation'); return mode === 'compact' || mode === 'focus' ? mode : 'full'; } catch { return 'full'; }
}

type StudioTab = "preview" | "source" | "file" | "project";

@Component({
  selector: "voice-studio",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SourceContextComponent, SelectionReviewComponent, LiveBrowserComponent, SemanticReviewComponent, KnowledgeWikiComponent, SourceTasksComponent, ProjectChecksComponent],
  templateUrl: "./app.component.html",
  host: { '[class.compact-navigation]': 'navigationMode() === "compact"', '[class.focus-navigation]': 'focusNavigation()', '[class.navigation-open]': 'navigationOpen()' },
})
export class AppComponent implements OnDestroy, OnInit {
  readonly i18n = inject(I18nService);
  readonly navigationMode = signal<NavigationMode>(savedNavigation());
  readonly navigationOpen = signal(false);
  readonly focusNavigation = computed(() => this.connected() && this.navigationMode() === 'focus' && this.tab() === 'preview');
  @ViewChild(LiveBrowserComponent) liveBrowser?: LiveBrowserComponent;
  private returnNavigationFocus: HTMLElement | null = null;
  setNavigationMode(value: string): void {
    if (value !== 'full' && value !== 'compact' && value !== 'focus') return;
    this.navigationMode.set(value); this.navigationOpen.set(false);
    if (value === 'focus') { this.sidebarCollapsed.set(true); this.reviewOpen.set(false); }
    try { localStorage.setItem('voice-studio:navigation', value); } catch { /* Optional UI preference. */ }
  }
  toggleNavigation(): void {
    if (this.navigationOpen()) { this.closeNavigation(); return; }
    this.returnNavigationFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.navigationOpen.set(true); this.reviewOpen.set(false);
    setTimeout(() => document.querySelector<HTMLElement>('#workspace-navigation button')?.focus());
  }
  closeNavigation(): void { this.navigationOpen.set(false); this.returnNavigationFocus?.focus(); }
  toggleProjects(): void { this.sidebarCollapsed.update(value => !value); this.navigationOpen.set(false); }
  openFocusAddress(address: string): void { if (this.liveBrowser) { this.liveBrowser.address = address; this.liveBrowser.openAddress(); this.closeNavigation(); } }
  @HostListener('document:keydown.escape') escapeOverlay(): void {
    if (!this.focusNavigation()) return;
    if (this.navigationOpen()) this.closeNavigation(); else { this.reviewOpen.set(false); this.sidebarCollapsed.set(true); }
  }
  navigationKeydown(event: KeyboardEvent): void {
    if (!this.focusNavigation() || !this.navigationOpen() || event.key !== 'Tab') return;
    const controls = Array.from(document.querySelectorAll<HTMLElement>('#workspace-navigation button:not([disabled]), #workspace-navigation input, #workspace-navigation select, #workspace-navigation a[href]')).filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  private readonly sanitizer = inject(DomSanitizer);
  private readonly zone = inject(NgZone);
  private token = "";
  private resumeRequest: Promise<boolean> | null = null;
  private sessionSequence = 0;
  readonly resumingSession = signal(true);
  readonly rememberedUntil = signal<string | null>(null);
  rememberBrowser = true;
  private review: ReturnType<typeof mountVoiceReview> | null = null;
  private detachPreviewLinks: (() => void) | null = null;
  private loadSequence = 0;
  @ViewChild("previewFrame") previewFrame?: ElementRef<HTMLIFrameElement>;

  readonly knowledge = inject(KnowledgeService);
  readonly wikiArticle = signal<string | null>(new URLSearchParams(location.search).get('wiki'));
  readonly connected = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly reviewOpen = signal(false);
  readonly liveSourceMatched = signal(false);
  readonly semanticFindings = signal<Finding[]>([]);
  readonly reviewDocument = computed(() => { const detail = this.document(); return detail ? { ...detail, findings: [...detail.findings, ...this.semanticFindings()] } : null; });
  readonly semanticApi: StudioApi = <T>(path: string, method?: string, body?: unknown) => this.api<T>(path, method, body);

  readonly folderPath = signal('');
  readonly visibleFiles = computed(() => this.documents().filter(file => file.path.replaceAll('\\', '/').split('/').slice(0, -1).join('/') === this.folderPath()));
  readonly subfolders = computed(() => {
    const prefix = this.folderPath() ? this.folderPath() + '/' : '';
    const names = new Set(this.documents().map(file => file.path.replaceAll('\\', '/')).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).filter(path => path.includes('/')).map(path => path.split('/')[0]));
    return [...names].sort().map(name => ({ name, path: prefix + name }));
  });
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly notice = signal("");
  readonly stale = signal(false);
  readonly projects = signal<ProjectSummary[]>([]);
  readonly selectedProject = signal<ProjectSummary | null>(null);
  readonly documents = signal<DocumentSummary[]>([]);
  readonly document = signal<DocumentDetail | null>(null);
  readonly projectReport = signal<ProjectReport | null>(null);
  readonly tab = signal<StudioTab>("preview");
  readonly selected = signal<SelectionTarget | null>(null);
  readonly activeFinding = signal<Finding | null>(null);
  readonly activeFeedback = signal<Feedback | null>(null);
  readonly proposal = signal<Proposal | null>(null);
  readonly lastRequest = signal<ImprovementRequest | null>(null);
  readonly savedProposals = signal<Proposal[]>([]);
  readonly savedRequests = signal<ImprovementRequest[]>([]);
  readonly registrationOpen = signal(false);
  readonly showAllFeedback = signal(false);
  readonly previewHtml = signal<SafeHtml>("");
  readonly previewMappingIssue = signal("");
  readonly feedbackList = computed(() =>
    (this.document()?.feedback ?? []).filter(
      (item) => this.showAllFeedback() || item.status !== "resolved",
    ),
  );
  readonly categoryCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const finding of this.document()?.findings ?? [])
      counts[finding.category] = (counts[finding.category] ?? 0) + 1;
    return Object.entries(counts).map(([category, count]) => ({
      category,
      count,
    }));
  });
  readonly projectCategoryCounts = computed(() =>
    Object.entries(this.projectReport()?.categories ?? {}).map(
      ([category, count]) => ({ category, count }),
    ),
  );
  readonly projectRuleCounts = computed(() =>
    Object.entries(this.projectReport()?.rules ?? {}).map(([rule, count]) => ({
      rule,
      count,
    })),
  );
  pairingCode = "";
  projectPath = "";
  projectName = "";
  feedbackComment = "";
  feedbackCategory = "wording";
  replacement = "";
  requestInstruction = "";
  readonly categories = [
    { id: "structure", label: "Satz & Struktur" },
    { id: "claims", label: "Aussage & Beleg" },
    { id: "wording", label: "Wortwahl & Ton" },
    { id: "meta", label: "Meta & Kontext" },
  ];

  ngOnInit(): void { void this.restoreSession(); }

  private async restoreSession(): Promise<void> {
    this.resumingSession.set(true);
    try { if (await this.resumeToken()) await this.loadSessionProjects(); }
    catch (error) { this.handleError(error); }
    finally { this.resumingSession.set(false); }
  }

  private resumeToken(): Promise<boolean> {
    if (this.resumeRequest) return this.resumeRequest;
    const sequence = this.sessionSequence;
    this.resumeRequest = this.api<BrowserSessionResult | { paired: false }>("/api/session/resume", "POST", {})
      .then(result => {
        if (sequence !== this.sessionSequence || !("token" in result)) return false;
        this.acceptSession(result);
        return true;
      }).finally(() => { this.resumeRequest = null; });
    return this.resumeRequest;
  }

  private acceptSession(result: BrowserSessionResult): void {
    ++this.sessionSequence;
    this.token = result.token;
    this.rememberedUntil.set(result.remembered ? result.expiresAt : null);
    this.connected.set(true);
  }

  private async loadSessionProjects(): Promise<void> {
    const sequence = this.sessionSequence;
    const projects = await this.api<ProjectSummary[]>("/api/projects");
    if (sequence !== this.sessionSequence || !this.connected()) return;
    this.projects.set(projects);
    const requested = new URLSearchParams(location.search).get('project');
    let remembered: string | null = null;
    try { remembered = localStorage.getItem('voice-studio:last-project'); } catch { /* Storage is optional. */ }
    const first = this.projects().find(project => project.id === (requested ?? remembered)) ?? this.projects()[0];
    if (first) await this.openProject(first);
    this.notice.set("");
  }

  async pair(): Promise<void> {
    if (!this.pairingCode.trim() || this.busy() || this.resumingSession()) return;
    await this.run(async () => {
      const result = await this.api<BrowserSessionResult>("/api/session/pair", "POST", { code: this.pairingCode.trim(), remember: this.rememberBrowser });
      this.acceptSession(result);
      this.pairingCode = "";
      await this.loadSessionProjects();
    });
  }

  async logout(): Promise<void> {
    if (this.busy()) return;
    await this.run(async () => {
      // Keep the session visible if revocation could not be confirmed; never claim the browser was forgotten on a lost response.
      await this.api("/api/session/logout", "POST", {});
      this.clearSession();
      this.error.set(""); this.notice.set("");
    });
  }

  private clearSession(): void {
    ++this.sessionSequence; ++this.loadSequence;
    this.token = ""; this.pairingCode = "";
    this.connected.set(false); this.rememberedUntil.set(null);
    this.disposeReview(); this.selectedProject.set(null); this.projects.set([]);
    this.document.set(null); this.documents.set([]); this.projectReport.set(null);
    this.savedProposals.set([]); this.savedRequests.set([]); this.clearSelection();
    this.navigationOpen.set(false); this.reviewOpen.set(false); this.loading.set(false);
  }

  rememberedDate(): string {
    const date = this.rememberedUntil();
    return date ? new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'medium' }).format(new Date(date)) : '';
  }

  openWiki(articleId = 'review-basics'): void {
    const id = this.knowledge.entry(articleId) ? articleId : (articleId === 'review-basics' ? articleId : 'semantic-review');
    this.wikiArticle.set(id);
    const url = new URL(location.href); url.searchParams.set('wiki', id);
    history.replaceState(history.state, '', url);
  }
  closeWiki(): void {
    this.wikiArticle.set(null);
    const url = new URL(location.href); url.searchParams.delete('wiki');
    history.replaceState(history.state, '', url);
  }

  async openProject(project: ProjectSummary): Promise<void> {
    this.disposeReview();
    ++this.loadSequence;
    this.selectedProject.set(project);
    try { localStorage.setItem('voice-studio:last-project', project.id); } catch { /* Storage is optional. */ }
    const projectUrl = new URL(location.href);
    projectUrl.searchParams.set('project', project.id);
    history.replaceState(history.state, '', projectUrl);
    this.sidebarCollapsed.set(!!project.liveUrl);
    this.reviewOpen.set(false);
    this.folderPath.set("");
    this.tab.set("preview");
    this.projectReport.set(null);
    this.documents.set([]);
    this.document.set(null);
    this.savedProposals.set([]);
    this.savedRequests.set([]);
    this.clearSelection();
    this.lastRequest.set(null);
    this.loading.set(true);
    this.error.set("");
    try {
      const [documents, report] = await Promise.all([
        this.api<DocumentSummary[]>(
          `/api/projects/${encodeURIComponent(project.id)}/documents`,
        ),
        this.api<ProjectReport>(
          `/api/projects/${encodeURIComponent(project.id)}/report`,
        ),
      ]);
      if (this.selectedProject()?.id !== project.id) return;
      this.documents.set(documents);
      this.projectReport.set(report);
      const initialPath = project.sourceRoutes?.['/'] ?? 'index.html';
      const initial = documents.find(file => file.path === initialPath) ?? documents[0];
      if (initial) await this.openDocument(initial.id);
      else {
        this.loading.set(false);
        this.tab.set("project");
      }
    } catch (error) {
      this.handleError(error);
      this.loading.set(false);
    }
  }

  async openDocument(id: string, nextTab?: StudioTab): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    this.disposeReview();
    const sequence = ++this.loadSequence;
    this.loading.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      const url = `/api/projects/${encodeURIComponent(project.id)}/documents/${encodeURIComponent(id)}`;
      const [detail, proposals, requests] = await Promise.all([
        this.api<DocumentDetail>(url),
        this.api<Proposal[]>(`${url}/proposals`),
        this.api<ImprovementRequest[]>(`${url}/requests`),
      ]);
      if (
        sequence !== this.loadSequence ||
        project.id !== this.selectedProject()?.id
      )
        return;
      this.clearSelection();
      this.semanticFindings.set([]);
      this.lastRequest.set(null);
      this.setDocument(detail, true);
      this.savedProposals.set(proposals.filter(item => !item.taskId));
      this.savedRequests.set(requests);
      this.stale.set(false);
      if (nextTab) this.tab.set(nextTab);
    } catch (error) {
      this.handleError(error);
    } finally {
      if (sequence === this.loadSequence) this.loading.set(false);
    }
  }

  async registerProject(): Promise<void> {
    if (!this.projectPath.trim()) return;
    await this.run(async () => {
      const result = await this.api<ProjectSummary>(
        "/api/projects/register",
        "POST",
        {
          path: this.projectPath.trim(),
          name: this.projectName.trim() || undefined,
        },
      );
      this.projects.set(await this.api<ProjectSummary[]>("/api/projects"));
      this.registrationOpen.set(false);
      this.projectPath = "";
      this.projectName = "";
      await this.openProject(
        this.projects().find((project) => project.id === result.id) ?? result,
      );
      this.notice.set("Lokales Projekt geöffnet.");
    });
  }

  changeTab(tab: StudioTab): void {
    if (tab !== "preview") this.disposeReview();
    this.tab.set(tab);
  }

  previewLoaded(): void {
    this.disposeReview();
    const body = this.previewFrame?.nativeElement.contentDocument?.body;
    const detail = this.document();
    if (!body || !detail) return;
    this.review = mountVoiceReview({
      root: body,
      units: detail.units,
      findings: [...detail.findings, ...this.semanticFindings()],
      feedback: detail.feedback,
      onSelect: (selection) => this.zone.run(() => this.selectText(selection)),
      onFindingSelect: (finding) =>
        this.zone.run(() => this.selectFinding(finding)),
      onFeedbackSelect: (feedback) =>
        this.zone.run(() => this.selectFeedback(feedback)),
    });
    this.updateMappingDiagnostics();
    const preventNavigation = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest("a");
      if (!link) return;
      const href =
        link.getAttribute("data-voice-href") ?? link.getAttribute("href") ?? "";
      if (body.ownerDocument.getSelection()?.toString().trim()) {
        event.preventDefault();
        return;
      }
      if (href.startsWith("#")) return;
      event.preventDefault();
      if (href) this.zone.run(() => this.followPreviewLink(href));
    };
    body.addEventListener("click", preventNavigation);
    this.detachPreviewLinks = () =>
      body.removeEventListener("click", preventNavigation);
  }

  private followPreviewLink(href: string): void {
    const detail = this.document();
    if (!detail) return;
    try {
      const base = new URL(
        detail.path.replaceAll("\\", "/").replace(/^\//, ""),
        "https://voice-studio.local/",
      );
      const target = new URL(href, base);
      if (target.origin !== base.origin || target.protocol !== "https:") {
        this.notice.set(
          "Dieser Link führt aus dem lokalen Projekt. Öffne externe Seiten in deinem Browser; Voice Studio lädt hier nur registrierte Quelldateien.",
        );
        return;
      }
      const path = decodeURIComponent(target.pathname).replace(/^\//, "");
      const candidates = new Set(
        [
          path,
          path.replace(/\/$/, "") + "/index.html",
          path.replace(/\/$/, "") + "/index.md",
          path + ".html",
          path + ".md",
        ].map((value) => value.toLowerCase()),
      );
      const file = this.documents().find((item) =>
        candidates.has(item.path.replaceAll("\\", "/").toLowerCase()),
      );
      if (!file) {
        this.notice.set(
          "Für diesen Link wurde keine HTML- oder Markdown-Quelldatei im Projekt gefunden. Dynamische Routen benötigen einen Quelltext-Adapter.",
        );
        return;
      }
      void this.openDocument(file.id, "preview");
    } catch {
      this.notice.set(
        "Dieser Link kann keiner lokalen Quelldatei zugeordnet werden.",
      );
    }
  }

  selectText(selection: SelectionTarget): void {
    this.reviewOpen.set(true);
    this.review?.selectFinding(null);
    this.selected.set(selection);
    this.activeFinding.set(null);
    this.activeFeedback.set(null);
    this.proposal.set(null);
    this.feedbackComment = "";
    this.replacement = selection.quote;
  }

  selectFinding(finding: Finding): void {
    this.selectText({
      unitId: finding.unitId,
      quote: finding.quote,
      start: finding.start,
      end: finding.end,
    });
    this.activeFinding.set(finding);
    this.feedbackCategory = finding.category;
    this.replacement = finding.suggestion ?? finding.quote;
    this.review?.selectFinding(finding.id);
  }

  selectFeedback(feedback: Feedback): void {
    this.selectText({
      unitId: feedback.unitId,
      quote: feedback.quote,
      start: feedback.start,
      end: feedback.end,
    });
    this.activeFeedback.set(feedback);
    this.feedbackCategory = feedback.category;
  }

  clearSelection(): void {
    this.review?.selectFinding(null);
    this.selected.set(null);
    this.activeFinding.set(null);
    this.activeFeedback.set(null);
    this.proposal.set(null);
    this.feedbackComment = "";
    this.replacement = "";
  }

  async saveFeedback(): Promise<void> {
    const detail = this.document(), selection = this.selected();
    if (!detail || !selection || !this.feedbackComment.trim() || !this.canEditSelection()) return;
    const input = { ...selection, comment: this.feedbackComment.trim(), category: this.feedbackCategory,
      expectedVersion: detail.version, expectedReviewRevision: detail.reviewRevision, requestId: crypto.randomUUID() };
    await this.runDocument(
      url => this.api<DocumentDetail>(url + '/feedback', 'POST', input),
      async updated => {
        this.setDocument(updated); this.feedbackComment = '';
        this.notice.set('Feedback in der Projekt-Metadatei gespeichert.');
        await this.refreshReport();
      },
    );
  }

  async setFeedbackStatus(feedback: Feedback, status: 'open' | 'resolved'): Promise<void> {
    const detail = this.document(); if (!detail) return;
    const input = { status, expectedReviewRevision: detail.reviewRevision };
    await this.runDocument(
      url => this.api<DocumentDetail>(url + '/feedback/' + encodeURIComponent(feedback.id), 'PATCH', input),
      async updated => {
        this.setDocument(updated);
        if (this.activeFeedback()?.id === feedback.id)
          this.activeFeedback.set(updated.feedback.find(item => item.id === feedback.id) ?? null);
        this.notice.set(status === 'resolved' ? 'Feedback als erledigt markiert.' : 'Feedback wieder geöffnet.');
        await this.refreshReport();
      },
    );
  }

  async createProposal(): Promise<void> {
    const detail = this.document(), selection = this.selected();
    if (!detail || !selection || this.replacement === selection.quote || !this.canEditSelection()) return;
    const input = { unitId: selection.unitId, start: selection.start, end: selection.end,
      replacement: this.replacement, expectedVersion: detail.version, feedbackId: this.activeFeedback()?.id };
    await this.runDocument(
      url => this.api<Proposal>(url + '/proposals', 'POST', input),
      created => {
        this.proposal.set(created);
        this.savedProposals.update(items => [created, ...items.filter(item => item.id !== created.id)]);
        this.notice.set('Änderung vorbereitet. Quelltext-Diff vor dem Anwenden prüfen.');
      },
    );
  }

  async applyProposal(): Promise<void> {
    const proposal = this.proposal();
    if (!proposal || proposal.documentId !== this.document()?.id || !this.canApplyProposal()) return;
    await this.runDocument(
      url => this.api<DocumentDetail>(url + '/proposals/' + encodeURIComponent(proposal.id) + '/apply', 'POST', { expectedVersion: proposal.expectedVersion }),
      async updated => {
        this.setDocument(updated, true); this.clearSelection();
        this.notice.set('Änderung in die Quelldatei geschrieben. Analyse aktualisiert; Feedback bitte erneut prüfen.');
        await Promise.all([this.refreshReport(), this.refreshHistory()]);
      },
    );
  }

  async sourceTaskApplied(event: SourceTaskDocumentApplied): Promise<void> {
    if (event.projectId !== this.selectedProject()?.id || event.document.id !== this.document()?.id) return;
    this.setDocument(event.document, true);
    this.clearSelection();
    this.notice.set('Aufgaben-Diff in die Quelldatei übernommen. Prüfe die aktualisierte Seite und das zugehörige Feedback.');
    try { await Promise.all([this.refreshReport(), this.refreshHistory()]); }
    catch (error) {
      if (event.projectId === this.selectedProject()?.id && event.document.id === this.document()?.id) this.handleError(error);
    }
  }

  async saveRequest(): Promise<void> {
    const detail = this.document();
    if (!detail || !this.requestInstruction.trim() || this.stale()) return;
    const active = this.activeFeedback();
    const feedbackIds = active ? [active.id] : detail.feedback.filter(item => item.status !== 'resolved').map(item => item.id);
    const input = { feedbackIds, instruction: this.requestInstruction.trim(), expectedVersion: detail.version, requestId: crypto.randomUUID() };
    await this.runDocument(
      url => this.api<ImprovementRequest>(url + '/requests', 'POST', input),
      request => {
        this.lastRequest.set(request);
        this.savedRequests.update(items => [request, ...items.filter(item => item.id !== request.id)]);
        this.requestInstruction = '';
        this.notice.set('Verbesserungsauftrag lokal gespeichert. Die Ausführung durch einen Agenten ist noch nicht angebunden.');
      },
    );
  }

  selectionProposalCreated(proposal: Proposal): void {
    if (proposal.documentId !== this.document()?.id || proposal.expectedVersion !== this.document()?.version) return;
    this.proposal.set(proposal);
    this.savedProposals.update(items => [proposal, ...items.filter(item => item.id !== proposal.id)]);
    this.notice.set('Änderung vorbereitet. Quelltext-Diff vor dem Anwenden prüfen.');
  }
  selectionDecisionSaved(document: DocumentDetail): void {
    if (document.id !== this.document()?.id || document.version !== this.document()?.version) return;
    this.setDocument(document);
    this.notice.set('Entscheidung gespeichert: Diese Textstelle soll so bleiben.');
  }
  openSavedProposal(proposal: Proposal): void {
    this.reviewOpen.set(true);
    this.clearSelection();
    this.proposal.set(proposal);
  }

  canApplyProposal(): boolean {
    const proposal = this.proposal();
    return (
      !!proposal &&
      !proposal.taskId &&
      proposal.state === "pending" &&
      proposal.expectedVersion === this.document()?.version &&
      !this.stale()
    );
  }

  proposalStatus(proposal: Proposal): string {
    if (proposal.state === "applied") return "Übernommen";
    if (proposal.expectedVersion !== this.document()?.version)
      return "Quellversion veraltet";
    return proposal.state === "pending" ? "Zur Prüfung" : proposal.state;
  }

  requestStatus(request: ImprovementRequest): string {
    return request.status === "queued-local"
      ? "Lokal vorgemerkt"
      : request.status;
  }

  private async refreshHistory(): Promise<void> {
    const url = this.documentUrl();
    const [proposals, requests] = await Promise.all([
      this.api<Proposal[]>(`${url}/proposals`),
      this.api<ImprovementRequest[]>(`${url}/requests`),
    ]);
    if (!this.document() || url !== this.documentUrl()) return;
    this.savedProposals.set(proposals.filter(item => !item.taskId));
    this.savedRequests.set(requests);
  }

  private async refreshReport(): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    const report = await this.api<ProjectReport>(
      `/api/projects/${encodeURIComponent(project.id)}/report`,
    );
    if (project.id !== this.selectedProject()?.id) return;
    this.projectReport.set(report);
    this.documents.set(report.documents);
  }

  private setDocument(detail: DocumentDetail, refreshPreview = false): void {
    const sourceChanged = this.document()?.version !== detail.version;
    if (sourceChanged) this.semanticFindings.set([]);
    this.document.set(detail);
    if (refreshPreview || sourceChanged) {
      this.disposeReview();
      this.previewMappingIssue.set("");
      this.previewHtml.set(
        this.sanitizer.bypassSecurityTrustHtml(detail.renderedHtml),
      );
    } else {
      this.review?.update({
        units: detail.units,
        findings: [...detail.findings, ...this.semanticFindings()],
        feedback: detail.feedback,
      });
      this.updateMappingDiagnostics();
    }
  }

  isLiveWebsite(): boolean { return this.document()?.format !== 'markdown'; }
  parentFolder(): void { this.folderPath.update(folder => folder.split('/').slice(0, -1).join('/')); }
  componentContexts(): string[] { return this.selectedProject()?.sourceContexts?.[this.document()?.path ?? ''] ?? []; }

  async saveLiveUrl(url: string): Promise<void> {
    const current = this.selectedProject(); if (!current) return;
    await this.run(async () => {
      const updated = await this.api<ProjectSummary>(`/api/projects/${encodeURIComponent(current.id)}/browser`, 'PATCH', { url });
      this.selectedProject.set(updated);
      this.projects.update(items => items.map(item => item.id === updated.id ? updated : item));
      this.sidebarCollapsed.set(true);
      this.notice.set('Lokale Website-Adresse im Projekt gespeichert.');
    });
  }
  liveFinding(id: string): void { const finding = this.reviewDocument()?.findings.find(item => item.id === id); if (finding) this.selectFinding(finding); }
  liveFeedback(id: string): void { const feedback = this.document()?.feedback.find(item => item.id === id); if (feedback) this.selectFeedback(feedback); }

  updateSemanticFindings(findings: Finding[]): void {
    const activeId = this.activeFinding()?.id;
    const removedSelection = !!activeId && this.semanticFindings().some(item => item.id === activeId)
      && !findings.some(item => item.id === activeId);
    if (removedSelection) this.clearSelection();
    this.semanticFindings.set(findings);
    const detail = this.document();
    if (detail) this.review?.update({ findings: [...detail.findings, ...findings] });
  }

  findingExplanation(finding: Finding): string {
    const rule = finding.engine.startsWith('voice-studio/local') ? this.knowledge.entry(finding.ruleId) : null;
    return rule ? this.i18n.t(rule.explanation, { quote: finding.quote }) : finding.explanation;
  }
  categoryLabel(category: string): string {
    return (
      this.categories.find((item) => item.id === category)?.label ?? category
    );
  }
  statusLabel(status: string): string {
    return (
      (
        {
          open: "Offen",
          resolved: "Erledigt",
          needs_recheck: "Erneut prüfen",
          needs_reattachment: "Textstelle neu zuordnen",
        } as Record<string, string>
      )[status] ?? status
    );
  }
  feedbackTotal(): number {
    return (
      this.document()?.feedback.filter((item) => item.status !== "resolved")
        .length ?? 0
    );
  }
  sourceLine(spanStart: number): number {
    return (
      (this.document()?.source.slice(0, spanStart).match(/\n/g)?.length ?? 0) +
      1
    );
  }
  unitFor(id: string) {
    return this.document()?.units.find((unit) => unit.id === id);
  }
  setLiveMatch(matched: boolean): void {
    this.liveSourceMatched.set(matched);
    if (!matched && this.tab() === 'preview' && this.isLiveWebsite()) this.clearSelection();
  }
  canEditSelection(): boolean {
    return (
      !!this.selected() &&
      (this.tab() !== 'preview' || !this.isLiveWebsite() || this.liveSourceMatched()) &&
      this.activeFeedback()?.status !== "needs_reattachment" &&
      !this.stale()
    );
  }

  private documentUrl(): string {
    return `/api/projects/${encodeURIComponent(this.selectedProject()!.id)}/documents/${encodeURIComponent(this.document()!.id)}`;
  }
  private async api<T>(
    path: string,
    method = "GET",
    body?: unknown,
    retried = false,
  ): Promise<T> {
    const requestSequence = this.sessionSequence, requestToken = this.token;
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        ...(path.startsWith("/api/session/") ? { "X-Voice-Studio-Session": "1" } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sessionApi = path.startsWith("/api/session/");
    if (response.status === 401 && !sessionApi && (requestSequence !== this.sessionSequence || requestToken !== this.token)) {
      if (this.token && method === "GET" && !retried) return this.api<T>(path, method, body, true);
      throw new Error("Die Sitzung hat sich geändert. Bitte führe die letzte Aktion erneut aus.");
    }
    if (response.status === 401 && !retried && !sessionApi) {
      if (await this.resumeToken()) {
        if (method === "GET") return this.api<T>(path, method, body, true);
        // Restore login, but never replay a source mutation or a model launch automatically.
        throw new Error("Die Sitzung wurde wiederhergestellt. Bitte führe die letzte Aktion erneut aus.");
      }
    }
    if (response.status === 401 && !sessionApi && requestSequence !== this.sessionSequence) {
      throw new Error("Die Sitzung hat sich geändert. Bitte führe die letzte Aktion erneut aus.");
    }
    const sessionExpired = response.status === 401 && !sessionApi && requestSequence === this.sessionSequence;
    if (sessionExpired) {
      this.clearSession();
      this.error.set("Die Sitzung ist abgelaufen. Bitte mit dem aktuellen Code erneut verbinden.");
    }
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        value.message ??
        value.detail ??
        value.error ??
        value.title ??
        `Anfrage fehlgeschlagen (${response.status}).`;
      const error = new Error(
        typeof message === "string" ? message : JSON.stringify(message),
      ) as Error & { status: number; suggestionRequestId?: string; suggestionRequestAccepted?: boolean };
      error.status = response.status;
      if (sessionExpired) Object.assign(error, { sessionExpired: true });
      if (value.suggestionRequestAccepted === false && typeof value.suggestionRequestId === "string") {
        error.suggestionRequestId = value.suggestionRequestId;
        error.suggestionRequestAccepted = false;
      }
      throw error;
    }
    return value as T;
  }
  private async runDocument<T>(
    request: (url: string) => Promise<T>,
    accept: (value: T) => void | Promise<void>,
  ): Promise<void> {
    if (this.busy() || this.loading() || !this.document() || !this.selectedProject()) return;
    const url = this.documentUrl(), sequence = this.loadSequence;
    const current = () => sequence === this.loadSequence && !!this.document() && !!this.selectedProject() && url === this.documentUrl();
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await request(url);
      // Native iframe navigation remains available while a request is pending.
      // Its source write is valid, but its response must not replace another file.
      if (current()) await accept(result);
    } catch (error) {
      if (current()) this.handleError(error);
    } finally { this.busy.set(false); }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      await action();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.busy.set(false);
    }
  }
  private handleError(error: unknown): void {
    if ((error as { sessionExpired?: boolean })?.sessionExpired) return; // Central API lifecycle already handled this generation.
    const status = (error as { status?: number })?.status;
    if (status === 409 || status === 412) {
      this.stale.set(true);
      this.error.set(
        "Datei oder Feedback wurde inzwischen geändert. Lade den aktuellen Stand und prüfe deine Änderung erneut.",
      );
    } else if (status === 401) {
      this.error.set(
        (this.connected() || (error as { sessionExpired?: boolean })?.sessionExpired)
          ? "Die Sitzung ist abgelaufen. Bitte mit dem aktuellen Code erneut verbinden."
          : "Der Code ist ungültig. Verwende den Code aus dem laufenden Voice-Studio-Terminal.",
      );
      // API expiry already clears the matching session generation. An invalid pair must not clear a newer login.
    } else
      this.error.set(
        error instanceof Error
          ? error.message
          : "Die Anfrage konnte nicht abgeschlossen werden.",
      );
  }
  private updateMappingDiagnostics(): void {
    const diagnostics = this.review?.getDiagnostics();
    if (!diagnostics) return;
    const missingUnits = new Set([
      ...diagnostics.missingUnitIds,
      ...diagnostics.mismatchedUnitIds,
    ]).size;
    const unmapped =
      diagnostics.unmappedFindingIds.length +
      diagnostics.unmappedFeedbackIds.length;
    this.previewMappingIssue.set(
      missingUnits || unmapped
        ? "Einige Textstellen können in dieser Vorschau nicht sicher markiert werden. Die vollständigen Befunde und Textabschnitte bleiben im Dateibericht zugänglich."
        : "",
    );
  }

  private disposeReview(): void {
    this.review?.dispose();
    this.review = null;
    this.detachPreviewLinks?.();
    this.detachPreviewLinks = null;
  }
  ngOnDestroy(): void {
    this.disposeReview();
  }
}
