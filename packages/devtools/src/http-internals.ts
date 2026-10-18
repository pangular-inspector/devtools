// Helpers of the HTTP interceptor (`http.ts`) kept out of the `./http` entry,
// so the ones tests reach into don't become public API.
import type { HttpRequest } from '@angular/common/http';
import { transferCacheKeys } from './http-cache-key.ts';
import { appIdOf } from './http-hydration.ts';

export function mockContentType(responseType = 'json'): string {
  if (responseType === 'text') return 'text/plain';
  if (responseType === 'blob' || responseType === 'arraybuffer') return 'application/octet-stream';
  return 'application/json';
}

export function parseBody(body: string | undefined, responseType = 'json'): unknown {
  if (responseType === 'text') return body ?? '';
  if (responseType === 'blob') return new Blob([body ?? ''], { type: mockContentType('blob') });
  if (responseType === 'arraybuffer')
    return Uint8Array.from(new TextEncoder().encode(body ?? '')).buffer;
  if (body === undefined || body === '') return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

interface TransferEntry {
  key: string;
  url?: string;
}

let transferEntries: TransferEntry[] | null = null;
const claimedTransfer = new Set<number>();

function readTransferEntries(doc: Document): TransferEntry[] {
  const script = doc.getElementById(`${appIdOf(doc)}-state`);
  try {
    const data = JSON.parse(script?.textContent || '{}') as Record<string, unknown>;
    return Object.entries(data).flatMap(([key, raw]) => {
      if (!raw || typeof raw !== 'object') return [];
      if (!key.startsWith('analog_')) return [{ key }];
      const url = (raw as Record<string, unknown>)['url'];
      return typeof url === 'string' ? [{ key, url: pathOf(url) }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * True the first time a GET or HEAD response, or a POST that opted into the
 * transfer cache, matches a TransferState entry, so hits are detected even
 * when another interceptor sits between this one and the transfer cache.
 * HttpClient entries match on Angular's cache key (method, response type,
 * URL, body and params); Analog entries on the URL, for GET and HEAD only,
 * since a URL alone can't tell POST bodies apart.
 */
export function claimTransferEntry(req: HttpRequest<unknown>): boolean {
  const post = req.method === 'POST' && !!req.transferCache;
  if (req.method !== 'GET' && req.method !== 'HEAD' && !post) return false;
  if (typeof document === 'undefined') return false;
  transferEntries ??= readTransferEntries(document);
  const keys = new Set(transferCacheKeys(req));
  const urls = new Set([pathOf(req.url), pathOf(req.urlWithParams)]);
  const index = transferEntries.findIndex(
    (entry, i) =>
      !claimedTransfer.has(i) &&
      (entry.url === undefined ? keys.has(entry.key) : !post && urls.has(entry.url)),
  );
  if (index < 0) return false;
  claimedTransfer.add(index);
  return true;
}

export function resetTransferEntries() {
  transferEntries = null;
  claimedTransfer.clear();
}
