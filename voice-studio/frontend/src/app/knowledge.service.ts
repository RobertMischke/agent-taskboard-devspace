import { Injectable, computed, signal } from '@angular/core';

export interface KnowledgeExample { language: string; before: string; after: string; why: string; }
export interface KnowledgeEntry {
  id: string; title: string; summary: string; section?: string;
  category?: string; message?: string; pattern?: string | null; explanation?: string;
  question?: string; nextStep?: string; acceptable?: string[]; limitations?: string[];
  examples?: KnowledgeExample[]; paragraphs?: string[]; steps?: string[]; related: string[];
  tools?: { name: string; purpose: string; license: string; status: string }[];
  sources?: { title: string; url: string }[];
}
interface KnowledgeDocument { version: string; updatedAt: string; engine: string; rules: KnowledgeEntry[]; articles: KnowledgeEntry[]; }

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  readonly data = signal<KnowledgeDocument | null>(null);
  readonly error = signal('');
  readonly entries = computed(() => {
    const data = this.data();
    return data ? [...data.rules.map(rule => ({ ...rule, section: 'Regeln' })), ...data.articles] : [];
  });
  constructor() { void this.load(); }
  async load(): Promise<void> {
    this.error.set('');
    try {
      const response = await fetch(new URL('knowledge/rules.json', document.baseURI));
      if (!response.ok) throw new Error('Das Regel-Wiki konnte nicht geladen werden.');
      this.data.set(await response.json() as KnowledgeDocument);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Das Regel-Wiki konnte nicht geladen werden.'); }
  }
  entry(id: string): KnowledgeEntry | undefined { return this.entries().find(entry => entry.id === id); }
}
