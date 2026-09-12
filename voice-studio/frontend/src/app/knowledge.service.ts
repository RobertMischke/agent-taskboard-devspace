import { Injectable, computed, inject, signal } from '@angular/core';
import { I18nService } from './i18n.service';

export interface KnowledgeExample { language: string; before: string; after: string; why: string; }
export interface KnowledgeEntry {
  id: string; title: string; summary: string; section?: string;
  category?: string; message?: string; pattern?: string | null; explanation?: string;
  question?: string; nextStep?: string; acceptable?: string[]; limitations?: string[];
  examples?: KnowledgeExample[]; paragraphs?: string[]; steps?: string[]; related: string[];
  tools?: { name: string; purpose: string; license: string; status: string }[];
  sources?: { title: string; url: string }[];
}
interface KnowledgeDocument { version: string; updatedAt: string; engine: string; overview?: string; rules: KnowledgeEntry[]; articles: KnowledgeEntry[]; }

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly i18n = inject(I18nService);
  private readonly rawData = signal<KnowledgeDocument | null>(null);
  private readonly loadFailed = signal(false);
  readonly data = computed(() => {
    const data = this.rawData();
    return data ? {
      ...data,
      overview: data.overview ? this.i18n.t(data.overview) : undefined,
      rules: data.rules.map(entry => this.localizeEntry(entry)),
      articles: data.articles.map(entry => this.localizeEntry(entry)),
    } : null;
  });
  readonly error = computed(() => this.loadFailed() ? this.i18n.t('Das Regel-Wiki konnte nicht geladen werden.') : '');
  readonly entries = computed(() => {
    const data = this.data();
    return data ? [...data.rules.map(rule => ({ ...rule, section: this.i18n.t('Regeln') })), ...data.articles] : [];
  });
  constructor() { void this.load(); }
  async load(): Promise<void> {
    this.loadFailed.set(false);
    try {
      const response = await fetch(new URL('knowledge/rules.json', document.baseURI));
      if (!response.ok) throw new Error('Knowledge request failed.');
      this.rawData.set(await response.json() as KnowledgeDocument);
    } catch { this.loadFailed.set(true); }
  }
  entry(id: string): KnowledgeEntry | undefined { return this.entries().find(entry => entry.id === id); }

  private localizeEntry(entry: KnowledgeEntry): KnowledgeEntry {
    const translate = (value: string) => this.i18n.t(value);
    return {
      ...entry,
      title: translate(entry.title), summary: translate(entry.summary),
      section: entry.section ? translate(entry.section) : undefined,
      message: entry.message ? translate(entry.message) : undefined,
      explanation: entry.explanation ? translate(entry.explanation) : undefined,
      question: entry.question ? translate(entry.question) : undefined,
      nextStep: entry.nextStep ? translate(entry.nextStep) : undefined,
      acceptable: entry.acceptable?.map(translate), limitations: entry.limitations?.map(translate),
      paragraphs: entry.paragraphs?.map(translate), steps: entry.steps?.map(translate),
      // Before/after quotes remain in their explicitly labelled source language.
      examples: entry.examples?.map(example => ({ ...example, why: translate(example.why) })),
      tools: entry.tools?.map(tool => ({ name: translate(tool.name), purpose: translate(tool.purpose), license: translate(tool.license), status: translate(tool.status) })),
      sources: entry.sources?.map(source => ({ ...source, title: translate(source.title) })),
    };
  }
}
