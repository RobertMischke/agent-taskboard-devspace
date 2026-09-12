import { Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, TranslatePipe, type TranslationParams } from './i18n.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type { DocumentDetail, DocumentSummary, ProjectSummary, SelectionTarget } from '@voice/contracts';

/** Review transport is restricted to the project's local development server. */
@Component({ selector: 'voice-live-browser', standalone: true, imports: [FormsModule, TranslatePipe], templateUrl: './live-browser.component.html' })
export class LiveBrowserComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) project!: ProjectSummary;
  @Input() documents: DocumentSummary[] = [];
  @Input() detail: DocumentDetail | null = null;
  @Input() loading = false;
  @Input() activeFindingId: string | null = null;
  @Output() documentNavigate = new EventEmitter<string>();
  @Output() selection = new EventEmitter<SelectionTarget>();
  @Output() finding = new EventEmitter<string>();
  @Output() feedback = new EventEmitter<string>();
  @Output() saveUrl = new EventEmitter<string>();
  @Output() sourceMatched = new EventEmitter<boolean>();
  @ViewChild('liveFrame') liveFrame?: ElementRef<HTMLIFrameElement>;
  readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly zone = inject(NgZone);
  private sessionId = crypto.randomUUID();
  private reviewId = '';
  private expectedOrigin = '';
  private handshakeTimer?: ReturnType<typeof setInterval>;
  private reviewSentFor = '';
  private reviewSentDetail: DocumentDetail | null = null;
  private pendingDocument = '';
  private manualDocument = '';
  private navigationSequence = 0;
  readonly frameUrl = signal<SafeResourceUrl | null>(null);
  readonly currentUrl = signal('');
  readonly pageTitle = signal('Website');
  readonly bridgeReady = signal(false);
  readonly status = signal('Lokale Website öffnen');
  private readonly mappingMessage = signal('');
  private readonly mappingParams = signal<TranslationParams>({});
  readonly mappingNote = computed(() => this.mappingMessage().split('\n').map(message => this.i18n.t(message, this.mappingParams())).join(' '));
  readonly markerNote = computed(() => !this.showMarks() ? this.i18n.t('Markierungen sind ausgeblendet. Schalte sie oben ein, um Befunde und offene Rückmeldungen zu sehen.') : this.mappingNote());
  readonly matchedFile = signal('');
  readonly showMarks = signal(true);
  address = '';
  sourceChoice = '';
  readonly integrationCode = `<script src="http://127.0.0.1:5188/library/voice-review.js"></script>\n<script>VoiceReview.connectVoiceStudio({studioOrigin: '${window.location.origin}'});</script>`;
  private readonly receive = (event: MessageEvent) => this.zone.run(() => this.onMessage(event));
  constructor() { window.addEventListener('message', this.receive); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && (changes['project'].firstChange || changes['project'].previousValue?.id !== this.project.id || changes['project'].previousValue?.liveUrl !== this.project.liveUrl)) {
      this.pendingDocument = ''; this.manualDocument = ''; this.address = this.project.liveUrl ?? '';
      if (this.address) this.navigate(this.address);
      else { this.disconnect(); this.frameUrl.set(null); this.currentUrl.set(''); this.status.set('Adresse des laufenden lokalen Entwicklungsservers eingeben.'); }
      return;
    }
    if (changes['detail'] && this.detail && this.currentUrl()) {
      const previous = changes['detail'].previousValue as DocumentDetail | null;
      const expected = this.resolveDocument(this.currentUrl());
      if (previous?.id === this.detail.id && previous.version !== this.detail.version && expected?.id === this.detail.id) this.navigate(this.currentUrl());
      else if (this.detail.id === this.pendingDocument || expected?.id === this.detail.id) { this.pendingDocument = ''; this.sendReview(); }
      else if (previous?.id !== this.detail.id && !this.loading) { const target = this.urlForDocument(this.detail); if (target) this.navigate(target); }
    }
    if (changes['loading'] || changes['documents'] || changes['detail']) this.sendReview();
    if (changes['activeFindingId'] && this.reviewId) this.post({ type: 'voice-studio:select-finding', reviewId: this.reviewId, findingId: this.activeFindingId });
  }
  openAddress(): void {
    try {
      const url = this.validateUrl(this.address);
      if (!this.project.liveUrl || new URL(this.project.liveUrl).origin !== url.origin) this.saveUrl.emit(url.href);
      else this.navigate(url.href);
    } catch (error) { this.status.set((error as Error).message); }
  }
  useAsStart(): void { try { this.saveUrl.emit(this.validateUrl(this.address).href); } catch (error) { this.status.set((error as Error).message); } }
  navigate(raw: string): void {
    let url: URL;
    try { url = this.validateUrl(raw); } catch (error) { this.status.set((error as Error).message); return; }
    url.searchParams.set('voice-studio', '1');
    url.searchParams.set('voice-studio-origin', window.location.origin);
    this.disconnect(); this.sessionId = crypto.randomUUID(); this.expectedOrigin = url.origin;
    this.currentUrl.set(url.href); this.address = url.href; this.status.set('Website wird geladen …');
    this.frameUrl.set(null);
    const sequence = ++this.navigationSequence;
    setTimeout(() => { if (sequence === this.navigationSequence) this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url.href)); });
  }
  frameLoaded(): void {
    this.bridgeReady.set(false); this.reviewId = ''; this.reviewSentFor = ''; this.reviewSentDetail = null; this.sourceMatched.emit(false);
    this.status.set('Website geöffnet · Verbindung zur Review-Library wird hergestellt …');
    clearInterval(this.handshakeTimer); let attempts = 0;
    const connect = () => {
      this.post({ type: 'voice-studio:connect' });
      if (++attempts >= 16 && !this.bridgeReady()) { clearInterval(this.handshakeTimer); this.status.set('Website ohne Review-Verbindung. Library einbinden oder die Seite in einem eigenen Tab öffnen.'); }
    };
    connect(); this.handshakeTimer = setInterval(connect, 500);
  }
  history(action: 'back' | 'forward' | 'reload'): void {
    if (this.bridgeReady()) this.post({ type: 'voice-studio:navigate', action });
    else if (action === 'reload') this.navigate(this.currentUrl());
  }
  toggleMarks(): void { this.showMarks.update(value => !value); this.reviewSentFor = ''; this.reviewSentDetail = null; this.sendReview(); }
  chooseSource(): void {
    if (!this.sourceChoice) {
      this.manualDocument = ''; this.pendingDocument = ''; this.reviewSentFor = ''; this.reviewSentDetail = null;
      const automatic = this.resolveDocument(this.currentUrl());
      if (automatic && automatic.id !== this.detail?.id) { this.pendingDocument = automatic.id; this.documentNavigate.emit(automatic.id); }
      else this.sendReview();
      return;
    }
    const file = this.documents.find(item => item.id === this.sourceChoice); if (!file) return;
    this.manualDocument = file.id; this.pendingDocument = file.id; this.reviewSentFor = ''; this.reviewSentDetail = null;
    if (this.detail?.id !== file.id) this.documentNavigate.emit(file.id); else this.sendReview();
  }
  private validateUrl(value: string): URL {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Eine lokale Entwicklungsadresse auf localhost oder 127.0.0.1 ohne Zugangsdaten eingeben. Review-Daten bleiben auf diesem Rechner.');
    if (url.origin === window.location.origin || ['5188', '4188'].includes(url.port)) throw new Error('Die Website braucht einen eigenen Server-Port; hier steht die Adresse des Studios.');
    return url;
  }
  private onMessage(event: MessageEvent): void {
    if (event.source !== this.liveFrame?.nativeElement.contentWindow || event.origin !== this.expectedOrigin) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.sessionId !== this.sessionId || typeof message.type !== 'string') return;
    if (message.type === 'voice-studio:ready' || message.type === 'voice-studio:location') {
      if (typeof message.url !== 'string') return;
      let url: URL; try { url = this.validateUrl(message.url); } catch { return; }
      if (url.origin !== this.expectedOrigin) return;
      clearInterval(this.handshakeTimer);
      if (this.currentUrl() !== url.href) this.manualDocument = '';
      this.bridgeReady.set(true); this.currentUrl.set(url.href); this.address = url.href;
      this.pageTitle.set(typeof message.title === 'string' ? message.title : 'Website');
      this.reviewSentFor = ''; this.reviewSentDetail = null; this.reviewId = ''; this.status.set('Live verbunden · Originalseite mit ihren Styles und Skripten');
      const file = this.resolveDocument(url.href); this.matchedFile.set(file?.path ?? ''); this.sourceChoice = file?.id ?? ''; this.sourceMatched.emit(false);
      if (file && this.detail?.id !== file.id) { this.pendingDocument = file.id; this.documentNavigate.emit(file.id); } else this.sendReview();
      return;
    }
    if (!this.reviewId || message.reviewId !== this.reviewId || this.loading) return;
    if (message.type === 'voice-studio:selection' && this.isValidSelection(message.selection)) this.selection.emit(message.selection);
    if (message.type === 'voice-studio:finding' && this.detail?.findings.some(item => item.id === message.findingId)) this.finding.emit(message.findingId);
    if (message.type === 'voice-studio:feedback' && this.detail?.feedback.some(item => item.id === message.feedbackId)) this.feedback.emit(message.feedbackId);
    if (message.type === 'voice-studio:mapping') {
      const diagnostics = message.diagnostics;
      const count = this.detail?.units.length ?? 0;
      const mapped = typeof diagnostics?.mappedUnits === 'number' && Number.isFinite(diagnostics.mappedUnits)
        ? Math.max(0, Math.min(count, diagnostics.mappedUnits)) : 0;
      const unmappedFindings = new Set(Array.isArray(diagnostics?.unmappedFindingIds) ? diagnostics.unmappedFindingIds : []);
      const unmappedFeedback = new Set(Array.isArray(diagnostics?.unmappedFeedbackIds) ? diagnostics.unmappedFeedbackIds : []);
      const findings = this.detail?.findings ?? [];
      const feedback = this.detail?.feedback.filter(item => item.status === 'open' || item.status === 'needs_recheck') ?? [];
      const anchoredFindings = findings.filter(item => !unmappedFindings.has(item.id)).length;
      const anchoredFeedback = feedback.filter(item => !unmappedFeedback.has(item.id)).length;
      const matched = !!this.detail && this.resolveDocument(this.currentUrl())?.id === this.detail.id;
      if (matched && this.showMarks()) {
        const hint = !mapped ? 'Kein Quelltext passt eindeutig zum sichtbaren Seitentext. Prüfe die Quelldatei und die Sprache der Website.'
          : !findings.length && !feedback.length ? 'Für diese Quelle liegen keine Befunde oder offenen Rückmeldungen vor. Zugeordnete Texte lassen sich für Feedback auswählen.'
          : !anchoredFindings && !anchoredFeedback ? 'Die Befunde liegen außerhalb der zugeordneten Textstellen. Details stehen im Dateibericht.'
          : 'Unterstrichen werden nur betroffene Textstellen; sie können weiter unten auf der Seite liegen.';
        this.mappingParams.set({ mapped, total: count, findings: anchoredFindings, totalFindings: findings.length, feedback: anchoredFeedback });
        this.mappingMessage.set('{mapped} von {total} Quelltextabschnitten auf dieser Seite zugeordnet.\n{findings} von {totalFindings} Befunden und {feedback} offenen Rückmeldungen auf dieser Seite verankert.\n' + hint);
      }
      this.sourceMatched.emit(matched && mapped > 0 && this.showMarks());
    }
    if (message.type === 'voice-studio:error' && typeof message.message === 'string') this.mappingMessage.set(message.message);
  }
  private resolveDocument(raw: string): DocumentSummary | undefined {
    if (this.manualDocument) return this.documents.find(file => file.id === this.manualDocument);
    try {
      const url = new URL(raw);
      const route = this.project.sourceRoutes?.[url.pathname] ?? this.project.sourceRoutes?.[url.pathname.replace(/\/$/, '') || '/'];
      if (route) return this.documents.find(file => file.path.replaceAll('\\', '/') === route);
      const base = new URL('.', this.project.liveUrl ?? raw);
      const relative = decodeURIComponent(url.pathname.startsWith(base.pathname) ? url.pathname.slice(base.pathname.length) : url.pathname.replace(/^\//, ''));
      const candidates = [relative, relative.endsWith('/') || !relative ? relative + 'index.html' : relative + '.html'];
      return this.documents.find(file => candidates.includes(file.path.replaceAll('\\', '/')));
    } catch { return undefined; }
  }
  private urlForDocument(file: DocumentSummary): string | null {
    if (!this.project.liveUrl || file.format === 'markdown') return null;
    const route = Object.entries(this.project.sourceRoutes ?? {}).find(([, source]) => source === file.path.replaceAll('\\', '/'))?.[0];
    if (route) return new URL(route, this.project.liveUrl).href;
    if (file.format === 'html') return new URL(file.path.replaceAll('\\', '/'), new URL('.', this.project.liveUrl)).href;
    return null;
  }
  private sendReview(): void {
    if (!this.bridgeReady() || this.loading) return;
    // The selected project explicitly registers the local recipient; never export to another origin.
    if (!this.project.liveUrl || this.validateUrl(this.project.liveUrl).origin !== this.expectedOrigin) return;
    const file = this.resolveDocument(this.currentUrl()); const detail = this.detail;
    const matched = !!file && !!detail && file.id === detail.id;
    this.matchedFile.set(matched ? file.path : ''); if (!matched || !this.showMarks()) this.sourceMatched.emit(false);
    if (!matched) this.mappingMessage.set('Für diese Route ist noch keine Quelle zugeordnet. Wähle eine Datei, um passende Textstellen im Original zu prüfen.');
    const key = `${this.currentUrl()}:${matched ? detail.version + ':' + detail.reviewRevision + ':' + detail.findings.map(finding => finding.id).join(',') : 'unmapped'}:${this.showMarks()}`;
    // A fresh adapter snapshot may remap units without changing source or feedback hashes.
    const mappedDetail = matched ? detail : null;
    if (this.reviewSentFor === key && this.reviewSentDetail === mappedDetail) return;
    this.reviewSentFor = key; this.reviewSentDetail = mappedDetail; this.reviewId = crypto.randomUUID();
    this.post({ type: 'voice-studio:review', reviewId: this.reviewId, pageUrl: this.currentUrl(), units: matched && this.showMarks() ? detail.units : [], findings: matched && this.showMarks() ? detail.findings : [], feedback: matched && this.showMarks() ? detail.feedback : [] });
  }
  private isValidSelection(value: unknown): value is SelectionTarget {
    if (!value || typeof value !== 'object' || !this.detail || !this.showMarks() || this.resolveDocument(this.currentUrl())?.id !== this.detail.id) return false;
    const target = value as SelectionTarget; const unit = this.detail.units.find(item => item.id === target.unitId);
    return !!unit && Number.isInteger(target.start) && Number.isInteger(target.end) && target.start >= 0 && target.end > target.start && target.end <= unit.text.length && unit.text.slice(target.start, target.end) === target.quote;
  }
  private post(message: Record<string, unknown>): void { if (this.expectedOrigin) this.liveFrame?.nativeElement.contentWindow?.postMessage({ ...message, sessionId: this.sessionId }, this.expectedOrigin); }
  private disconnect(): void { this.post({ type: 'voice-studio:disconnect' }); clearInterval(this.handshakeTimer); this.bridgeReady.set(false); this.reviewId = ''; this.reviewSentFor = ''; this.reviewSentDetail = null; this.mappingMessage.set(''); this.matchedFile.set(''); this.sourceMatched.emit(false); }
  ngOnDestroy(): void { ++this.navigationSequence; this.disconnect(); window.removeEventListener('message', this.receive); }
}
