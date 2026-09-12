import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import type { DocumentDetail } from '@voice/contracts';
import type { StudioApi } from './semantic-review.component';
import { I18nService, TranslatePipe } from './i18n.service';

interface SourceContext {
  path: string; absolutePath: string; sourceVersion: string;
  git?: { available: boolean; isRepository: boolean; repositoryRoot?: string; branch?: string; head?: string; relativePath?: string; status?: string; dirty?: boolean; repositoryDirty?: boolean; tracked?: boolean; error?: string };
}

@Component({selector:'voice-source-context',standalone:true,imports:[TranslatePipe],templateUrl:'./source-context.component.html',styleUrl:'./source-context.component.css'})
export class SourceContextComponent implements OnChanges, OnDestroy {
  @Input({required:true}) projectId='';
  @Input({required:true}) document!: DocumentDetail;
  @Input({required:true}) api!: StudioApi;
  readonly i18n=inject(I18nService);
  readonly context=signal<SourceContext|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly showGit=signal(true);
  private sequence=0;
  ngOnChanges():void { void this.refresh(); }
  async refresh():Promise<void> {
    if(!this.projectId||!this.document||!this.api)return;
    const sequence=++this.sequence;
    this.loading.set(true); this.error.set(''); this.context.set(null);
    try {
      const result=await this.api<SourceContext>(`/api/projects/${encodeURIComponent(this.projectId)}/documents/${encodeURIComponent(this.document.id)}/source-context?includeGit=true`);
      if(sequence===this.sequence)this.context.set(result);
    } catch(error) { if(sequence===this.sequence)this.error.set((error as Error).message); }
    finally { if(sequence===this.sequence)this.loading.set(false); }
  }
  ngOnDestroy():void { ++this.sequence; }
}
