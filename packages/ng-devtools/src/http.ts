import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  withInterceptors,
} from '@angular/common/http';
import type { HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import {
  ApplicationRef,
  PLATFORM_ID,
  REQUEST,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { Observable, throwError, timer, of } from 'rxjs';
import type { Subscription } from 'rxjs';

import { appIdOf, isHydrationMessage } from './http-hydration.ts';

import {
  MAX_CALLS,
  MAX_DELAY_MS,
  clientRules,
  httpRegistry,
  matchRule,
  type HttpCall,
  type HttpSide,
} from './http-rules.ts';

export * from './http-rules.ts';
export { decodePayload, type PayloadEntry, type PayloadSummary } from './http-payload.ts';

const MAX_WARNINGS = 50;
const PREVIEW_CHARS = 2000;

export function parseBody(body: string | undefined, responseType = 'json'): unknown {
  if (responseType === 'text') return body ?? '';
  if (body === undefined || body === '') return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function preview(body: unknown): string | undefined {
  if (body === null || body === undefined) return undefined;
  try {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
  } catch {
    return undefined;
  }
}

function record(call: HttpCall) {
  const registry = httpRegistry();
  if (registry.record) return registry.record(call);
  const calls = (registry.calls ??= []);
  calls.push(call);
  if (calls.length > MAX_CALLS) calls.splice(0, calls.length - MAX_CALLS);
}

let seq = 0;

function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

let transferUrls: string[] | null = null;
const claimedTransfer = new Set<number>();

function readTransferUrls(doc: Document): string[] {
  const script = doc.getElementById(`${appIdOf(doc)}-state`);
  try {
    const data = JSON.parse(script?.textContent || '{}') as Record<string, unknown>;
    return Object.entries(data).flatMap(([key, raw]) => {
      if (!raw || typeof raw !== 'object') return [];
      const r = raw as Record<string, unknown>;
      const url = key.startsWith('analog_') ? r['url'] : r['u'];
      return typeof url === 'string' ? [pathOf(url)] : [];
    });
  } catch {
    return [];
  }
}

/**
 * True the first time a GET or HEAD response matches a TransferState entry,
 * so hits are detected even when another interceptor sits between this one
 * and the transfer cache.
 */
export function claimTransferEntry(url: string, urlWithParams: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (typeof document === 'undefined') return false;
  transferUrls ??= readTransferUrls(document);
  const wanted = new Set([pathOf(url), pathOf(urlWithParams)]);
  const index = transferUrls.findIndex((u, i) => !claimedTransfer.has(i) && wanted.has(u));
  if (index < 0) return false;
  claimedTransfer.add(index);
  return true;
}

export function resetTransferEntries() {
  transferUrls = null;
  claimedTransfer.clear();
}

const stableApps = new WeakSet<object>();
const watchedApps = new WeakSet<object>();

function transferWindowOpen(): boolean {
  const appRef = inject(ApplicationRef, { optional: true });
  if (!appRef) return true;
  if (!watchedApps.has(appRef)) {
    watchedApps.add(appRef);
    void appRef.whenStable().then(() => stableApps.add(appRef));
  }
  return !stableApps.has(appRef);
}

export function transferCacheEligible(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (req.transferCache === false || req.withCredentials) return false;
  if (req.cache === 'no-cache' || req.cache === 'no-store') return false;
  const headers = req.headers;
  if (['authorization', 'proxy-authorization', 'cookie'].some((name) => headers.has(name))) {
    return false;
  }
  const cacheControl = headers.get('cache-control') ?? '';
  return !/(^|,)\s*(no-store|private|no-cache)\b/i.test(cacheControl);
}

function devMode(): boolean {
  return !!(globalThis as { ngDevMode?: unknown }).ngDevMode;
}

/**
 * Records every request for the SSR & HTTP tab and applies the fault rules
 * set there. It does nothing in production builds.
 */
export const ngDevtoolsHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!devMode()) return next(req);
  const side: HttpSide = isPlatformServer(inject(PLATFORM_ID)) ? 'server' : 'client';
  const request = side === 'server' ? inject(REQUEST, { optional: true }) : null;
  let pageUrl: string | undefined;
  if (request) {
    try {
      const url = new URL(request.url);
      pageUrl = url.pathname + url.search;
    } catch {
      pageUrl = undefined;
    }
  } else if (side === 'client') {
    pageUrl = location.pathname + location.search;
  }
  const url = req.urlWithParams;
  const rules = side === 'client' ? clientRules() : httpRegistry().rules;
  const rule = matchRule(url, req.method, rules, side);
  const started = Date.now();
  const base = {
    url,
    method: req.method,
    side,
    pageUrl,
    faulted: !!rule,
    ruleId: rule?.id,
  };
  const done = (fields: Pick<HttpCall, 'status' | 'cacheHit'> & Partial<HttpCall>) =>
    record({
      id: `${side[0]}${Date.now().toString(36)}${++seq}`,
      at: started,
      durationMs: Date.now() - started,
      ...base,
      ...fields,
    });

  let source: Observable<HttpEvent<unknown>>;
  const delay = Math.min(Math.max(rule?.delayMs ?? 0, 0), MAX_DELAY_MS);
  const status = rule?.status;
  if (status !== undefined) {
    const body = parseBody(rule?.body, req.responseType);
    source =
      status >= 400
        ? throwError(
            () =>
              new HttpErrorResponse({
                status,
                statusText: 'Injected by Angular DevTools',
                url,
                error: body,
              }),
          )
        : of(
            new HttpResponse({
              status,
              statusText: 'Mocked by Angular DevTools',
              url,
              body,
              headers: new HttpHeaders({ 'content-type': 'application/json' }),
            }),
          );
  } else {
    source = next(req);
  }
  const mocked = status !== undefined;
  const cacheable = side === 'client' && !mocked && transferWindowOpen();
  const claimable = cacheable && transferCacheEligible(req);
  const observed = new Observable<HttpEvent<unknown>>((subscriber) => {
    // The transfer cache replays a hit synchronously, so a response that
    // arrives before subscribe() returns came from the SSR payload.
    let sync = true;
    let settled = false;
    const inner = source.subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          settled = true;
          const fromPayload = claimable && claimTransferEntry(req.url, url, req.method);
          done({
            status: event.status,
            cacheHit: side === 'client' ? cacheable && (sync || fromPayload) : !mocked && sync,
            preview: preview(event.body),
          });
        }
        subscriber.next(event);
      },
      error: (error: unknown) => {
        const failed = error instanceof HttpErrorResponse;
        const message = failed ? error.message : String(error);
        settled = true;
        done({ status: failed ? error.status : 0, cacheHit: false, error: message.slice(0, 500) });
        subscriber.error(error);
      },
      complete: () => subscriber.complete(),
    });
    sync = false;
    return () => {
      if (!settled) {
        settled = true;
        done({ status: 0, cacheHit: false, error: 'cancelled' });
      }
      inner.unsubscribe();
    };
  });
  if (!delay) return observed;
  return new Observable<HttpEvent<unknown>>((subscriber) => {
    let started = false;
    let inner: Subscription | undefined;
    const wait = timer(delay).subscribe(() => {
      started = true;
      inner = observed.subscribe(subscriber);
    });
    return () => {
      wait.unsubscribe();
      if (started) inner?.unsubscribe();
      else done({ status: 0, cacheHit: false, error: 'cancelled during the delay' });
    };
  });
};

function captureHydrationWarnings() {
  if (typeof document === 'undefined' || !devMode()) return;
  const registry = httpRegistry();
  if (registry.warnings) return;
  const warnings: string[] = (registry.warnings = []);
  for (const level of ['warn', 'error'] as const) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
      const warning = text.slice(0, 1000);
      if (isHydrationMessage(text) && !warnings.includes(warning)) {
        warnings.push(warning);
        if (warnings.length > MAX_WARNINGS) warnings.shift();
      }
      original.apply(console, args);
    };
  }
}

/** `provideHttpClient(withNgDevtools())` registers the DevTools interceptor. */
export function withNgDevtools() {
  return withInterceptors([ngDevtoolsHttpInterceptor]);
}

/**
 * Captures hydration warnings (NG05xx) before the overlay loads. Add it next
 * to `provideHttpClient(withNgDevtools())`.
 */
export function provideNgDevtoolsHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([provideEnvironmentInitializer(captureHydrationWarnings)]);
}
