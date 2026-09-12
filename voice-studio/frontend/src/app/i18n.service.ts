import { DOCUMENT } from '@angular/common';
import { Injectable, Pipe, PipeTransform, effect, inject, signal } from '@angular/core';
import { selectionMessages } from './messages.selection';
import { contextMessages } from './messages.context';
import { appMessages } from './messages.app';
import { browserMessages } from './messages.browser';
import { workflowMessages } from './messages.workflows';
import { wikiMessages } from './messages.wiki';

export type StudioLocale = 'en' | 'de';
export type TranslationParams = Record<string, string | number>;
const storageKey = 'voice-studio:locale';
const messages: Record<string, string> = { ...appMessages, ...contextMessages, ...selectionMessages, ...browserMessages, ...workflowMessages, ...wikiMessages };
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const normalizedMessages = new Map(Object.entries(messages).map(([key, value]) => [normalize(key), value]));

function storedLocale(): StudioLocale {
  try { return localStorage.getItem(storageKey) === 'de' ? 'de' : 'en'; }
  catch { return 'en'; }
}

/** Translates Studio controls; reviewed source, feedback and model output retain their language. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly locale = signal<StudioLocale>(storedLocale());

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.locale();
      this.document.title = this.locale() === 'en' ? 'Voice Studio · Review locally' : 'Voice Studio · Lokal prüfen';
    });
  }

  setLocale(value: string): void {
    if (value !== 'en' && value !== 'de') return;
    this.locale.set(value);
    try { localStorage.setItem(storageKey, value); }
    catch { /* A blocked preference store must not prevent an in-session language change. */ }
  }

  t(source: string | null | undefined, params?: TranslationParams): string {
    if (source == null) return '';
    const value = this.locale() === 'de' ? source : (messages[source] ?? normalizedMessages.get(normalize(source)) ?? source);
    if (!params) return value;
    return value.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : placeholder);
  }
}

@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(source: string | null | undefined, params?: TranslationParams): string {
    return this.i18n.t(source, params);
  }
}
