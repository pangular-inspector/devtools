// Request and response headers of recorded HttpClient calls. The interceptor
// only keeps a reference to the `HttpHeaders` objects Angular already built;
// they are read and capped when a call leaves the page or the
// server process (`redactHeaders` in `http-redact.ts` masks them), so a page with no devtools connected copies nothing.

import type { HttpCall } from './http-rules.ts';
import { clip } from './text.ts';

/** Headers kept per side of a call. */
export const MAX_HEADERS = 40;
/** Characters kept per header value. */
export const MAX_HEADER_VALUE = 500;

/** The part of Angular's `HttpHeaders` this module reads. */
export interface HeaderSource {
  keys(): string[];
  getAll(name: string): string[] | null;
}

export type HeaderRecord = Record<string, string>;

interface Captured {
  request?: HeaderSource;
  response?: HeaderSource;
  read?: { requestHeaders?: HeaderRecord; responseHeaders?: HeaderRecord };
}

const captured = new WeakMap<HttpCall, Captured>();

/** Keeps the headers of a call for later; nothing is read or copied yet. */
export function captureHeaders(
  call: HttpCall,
  request: HeaderSource | null | undefined,
  response: HeaderSource | null | undefined,
): void {
  if (!request && !response) return;
  captured.set(call, { request: request ?? undefined, response: response ?? undefined });
}

/** Reads `HttpHeaders` into a plain record with lowercase names, capped. */
export function readHeaders(source: HeaderSource | undefined): HeaderRecord | undefined {
  if (!source) return undefined;
  const out: HeaderRecord = {};
  let count = 0;
  try {
    for (const name of source.keys()) {
      if (count >= MAX_HEADERS) break;
      const values = source.getAll(name);
      if (!values?.length) continue;
      out[name.toLowerCase()] = clip(values.join(', '), MAX_HEADER_VALUE);
      count++;
    }
  } catch {
    // A headers object that throws while read is left out.
    return undefined;
  }
  return count ? out : undefined;
}

/**
 * The call with its captured headers read in, or the call itself when none
 * were captured. The headers are read once per call.
 */
export function withCapturedHeaders(call: HttpCall): HttpCall {
  const entry = captured.get(call);
  if (!entry) return call;
  entry.read ??= {
    requestHeaders: readHeaders(entry.request),
    responseHeaders: readHeaders(entry.response),
  };
  const { requestHeaders, responseHeaders } = entry.read;
  return {
    ...call,
    ...(requestHeaders ? { requestHeaders } : {}),
    ...(responseHeaders ? { responseHeaders } : {}),
  };
}

/** Validates a header record that came over RPC; anything else is dropped. */
export function sanitizeHeaders(input: unknown): HeaderRecord | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const out: HeaderRecord = {};
  let count = 0;
  for (const [name, value] of Object.entries(input)) {
    if (count >= MAX_HEADERS) break;
    if (typeof value !== 'string' || !/^[\w!#$%&'*+.^`|~-]{1,100}$/.test(name)) continue;
    out[name.toLowerCase()] = value.slice(0, MAX_HEADER_VALUE + 1);
    count++;
  }
  return count ? out : undefined;
}
