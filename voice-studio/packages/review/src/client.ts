import type { DocumentDetail, FeedbackInput, ReviewClient } from '@voice/contracts';

export class ReviewApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details: unknown) {
    super(message);
    this.name = 'ReviewApiError';
  }
}

export interface ReviewClientOptions {
  baseUrl?: string;
  token?: string | (() => string | null | undefined);
  fetch?: typeof globalThis.fetch;
}

/** Uses the configured local service for durable sidecar persistence. This
 * client does not keep a second, misleading browser-only feedback store. */
export function createReviewClient(options: ReviewClientOptions = {}): ReviewClient {
  const baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '');
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const documentUrl = (projectId: string, documentId: string) =>
    `${baseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`;
  const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    const token = typeof options.token === 'function' ? options.token() : options.token;
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetcher(url, { ...init, headers });
    const raw = await response.text();
    let body: unknown;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!response.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : `Voice Studio request failed (${response.status})`;
      throw new ReviewApiError(response.status, message, body);
    }
    return body as T;
  };
  return {
    getDocument: (projectId, documentId) => request<DocumentDetail>(documentUrl(projectId, documentId)),
    saveFeedback: (projectId: string, documentId: string, input: FeedbackInput) =>
      request<DocumentDetail>(`${documentUrl(projectId, documentId)}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
      })
  };
}
