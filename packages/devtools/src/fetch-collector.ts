// Records the page's own `fetch()` calls (a library, `httpResource` with a
// custom loader, a plain `await fetch(...)`) next to the HttpClient calls
// `withPangular()` records. It wraps `globalThis.fetch` once and only looks:
// the request, the response and the promise the app gets back are the
// originals. Response bodies are never read, so nothing is consumed.

import { outsideAngular } from './outside-angular.ts';
import { captureHeaders, type HeaderSource } from './http-headers.ts';
import { pendingKey, recordHttpCall } from './http-record.ts';
import { httpRegistry, type HttpCall } from './http-rules.ts';

/** URLs of the devtools' own requests, which are never recorded. */
const OWN_REQUEST = /\/__devframes\/|\/__pangular|\/@vite\/|\/@fs\/|\/@id\//;

export interface NativeFetchOptions {
  /** Skips a call when this returns true for its URL, after the devtools' own paths. */
  skip?: (url: string) => boolean;
  /** The clock, for tests. */
  now?: () => number;
}

let seq = 0;

/** The URL and method of a `fetch()` call, without reading a `Request` body. */
export function requestOf(
  input: unknown,
  init: RequestInit | undefined,
): { url: string; method: string; headers?: HeadersInit } {
  let url = '';
  let method = 'GET';
  let headers: HeadersInit | undefined;
  if (typeof input === 'string') url = input;
  else if (input instanceof URL) url = input.href;
  else if (input && typeof input === 'object' && 'url' in input) {
    const request = input as Request;
    url = String(request.url);
    method = request.method || method;
    headers = request.headers;
  }
  if (init?.method) method = init.method;
  if (init?.headers) headers = init.headers;
  return { url, method: method.toUpperCase(), headers };
}

/** `Headers` as the `HttpHeaders` shape the header capture reads. */
function headerSource(init: HeadersInit | Headers | undefined): HeaderSource | undefined {
  if (!init) return undefined;
  try {
    const headers = init instanceof Headers ? init : new Headers(init);
    return {
      keys: () => [...headers.keys()],
      getAll: (name) => {
        const value = headers.get(name);
        return value === null ? null : [value];
      },
    };
  } catch {
    return undefined;
  }
}

/** True for an `AbortController.abort()`, which the app asked for. */
function isAbort(error: unknown): boolean {
  return (
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Whether this `fetch()` belongs to an `HttpClient` request `withPangular()` records. */
function isClientRequest(method: string, url: string): boolean {
  const pending = httpRegistry().clientPending;
  if (!pending?.size) return false;
  const key = pendingKey(method, url);
  return (pending.get(key) ?? 0) > 0;
}

/**
 * Wraps `globalThis.fetch` so each call is recorded as an HTTP call with
 * `nativeFetch: true`. Calls to the devtools' own paths and the `fetch()`
 * that Angular's `FetchBackend` makes for an `HttpClient` request
 * `withPangular()` already records are skipped. Safe to call more than once;
 * the returned function restores the original `fetch`.
 */
export function watchNativeFetch(options: NativeFetchOptions = {}): () => void {
  const g = globalThis as { fetch?: typeof fetch };
  const registry = httpRegistry();
  const original = g.fetch;
  if (typeof original !== 'function') return () => {};
  if (registry.nativeFetch) return () => {};
  registry.nativeFetch = original;
  const now = options.now ?? Date.now;

  const watched = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const result = original.call(this ?? globalThis, input, init);
    let request: ReturnType<typeof requestOf>;
    try {
      request = requestOf(input, init);
    } catch {
      return result;
    }
    const { url, method } = request;
    if (!url || OWN_REQUEST.test(url) || options.skip?.(url) || isClientRequest(method, url)) {
      return result;
    }
    const started = now();
    const pageUrl =
      typeof location === 'undefined' ? undefined : location.pathname + location.search;
    const done = (fields: Partial<HttpCall>, response?: Response) => {
      const call: HttpCall = {
        id: `f${started.toString(36)}${++seq}`,
        url,
        method,
        status: 0,
        durationMs: Math.max(0, now() - started),
        side: 'client',
        cacheHit: false,
        faulted: false,
        at: started,
        nativeFetch: true,
        ...(pageUrl === undefined ? {} : { pageUrl }),
        ...fields,
      };
      // Only references: the headers are read and masked when the call is reported.
      captureHeaders(call, headerSource(request.headers), headerSource(response?.headers));
      recordHttpCall(call);
    };
    // The callbacks run outside the Angular zone, so recording starts no extra tick.
    outsideAngular(() =>
      result.then(
        (response) => {
          const redirected = response.redirected && response.url && response.url !== url;
          done(
            {
              status: response.status,
              ...(redirected ? { redirectedTo: response.url } : {}),
              ...(response.ok ? {} : { error: `${response.status} ${response.statusText}`.trim() }),
            },
            response,
          );
        },
        (error: unknown) => {
          done(
            isAbort(error)
              ? { cancelled: true, error: 'cancelled' }
              : { error: String((error as Error)?.message ?? error).slice(0, 500) },
          );
        },
      ),
    );
    return result;
  } as typeof fetch;

  g.fetch = watched;
  return () => {
    if (g.fetch === watched) g.fetch = original;
    if (registry.nativeFetch === original) delete registry.nativeFetch;
  };
}
