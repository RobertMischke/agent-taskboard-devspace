import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KnowledgeService } from './knowledge.service';

@Component({
  selector: 'voice-knowledge-wiki',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './knowledge-wiki.component.html',
  styleUrl: './knowledge-wiki.component.css',
})
export class KnowledgeWikiComponent implements AfterViewInit {
  readonly knowledge = inject(KnowledgeService);
  readonly selectedId = signal('review-basics');
  readonly search = signal('');
  @Input() set articleId(value: string) { this.selectedId.set(value || 'review-basics'); }
  @Output() closed = new EventEmitter<void>();
  @Output() articleChanged = new EventEmitter<string>();
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('article') articleElement?: ElementRef<HTMLElement>;
  readonly selected = computed(() => this.knowledge.entry(this.selectedId()) ?? this.knowledge.entry('review-basics'));
  readonly results = computed(() => {
    const terms = this.search().toLocaleLowerCase('de').trim().split(/\s+/).filter(Boolean);
    return this.knowledge.entries().filter(entry => terms.every(term => JSON.stringify(entry).toLocaleLowerCase('de').includes(term)));
  });
  readonly sections = computed(() => [...new Set(this.results().map(entry => entry.section))]);
  ngAfterViewInit(): void { this.dialog?.nativeElement.showModal(); }
  choose(id: string): void {
    this.selectedId.set(id); this.linkCopied.set(false); this.articleChanged.emit(id);
    if (this.articleElement) this.articleElement.nativeElement.scrollTop = 0;
  }
  close(event?: Event): void { event?.preventDefault(); this.closed.emit(); }
  async copyLink(): Promise<void> {
    try { await navigator.clipboard.writeText(location.href); this.linkCopied.set(true); }
    catch { this.linkCopied.set(false); }
  }
  readonly linkCopied = signal(false);
  sourceFor(id: string): string {
    if (this.knowledge.data()?.rules.some(rule => rule.id === id)) return 'knowledge/rules.json · backend/VoiceStudio.Api/RuleCatalog.cs';
    const sources: Record<string, string> = {
      'source-mapping': 'packages/review/src/studio-bridge.ts · backend/VoiceStudio.Api/DocumentParser.cs',
      'angular-sources': 'backend/VoiceStudio.Api/TypeScriptExtractor.mjs · TypeScriptContentAdapter.cs',
      'markdown-sources': 'backend/VoiceStudio.Api/DocumentParser.cs · PreviewRenderer.cs',
      'coverage': 'backend/VoiceStudio.Api/ProjectStore.cs',
      'semantic-review': 'backend/VoiceStudio.Api/RunnerReviewService.cs · docs/runner-integration.md',
      'model-choice': 'docs/model-strategy.md',
      'source-tasks': 'docs/workflow.md · backend/VoiceStudio.Api',
      'feedback': 'backend/VoiceStudio.Api/ProjectStore.cs',
    };
    return sources[id] ?? 'docs/workflow.md';
  }
}
