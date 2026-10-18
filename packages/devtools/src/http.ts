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
  DestroyRef,
  EnvironmentInjector,
  Injector,
  PLATFORM_ID,
  REQUEST,
  TransferState,
  inject,
  makeStateKey,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { Observable, throwError, timer, of } from 'rxjs';
import type { Subscription } from 'rxjs';

import { redactMessage } from './forms-privacy.ts';
import { transferCacheKeys } from './http-cache-key.ts';
import { cacheSkipReason, requestSkipReason, type CacheSkip } from './http-cache-reason.ts';
import { isHydrationMessage } from './http-hydration.ts';
import { captureHeaders, withCapturedHeaders, type HeaderSource } from './http-headers.ts';

import {
  MAX_CALLS,
  MAX_DELAY_MS,
  clientRules,
  httpRegistry,
  matchRule,
  ruleStatus,
  type HttpCall,
  type HttpSide,
} from './http-rules.ts';
import {
  SSR_REQUEST_HEADER,
  activeSsrRequest,
  noteOverride,
  noteSsrFetch,
  ssrRegistry,
} from './ssr-registry.ts';
import { currentSsrRequest } from './ssr-context.ts';
import { matchingOverrides } from './ssr-overrides.ts';
import { watchSsrNavigations } from './ssr-navigation.ts';
import { tapConsole } from './console-tap.ts';

export * from './http-rules.ts';
import { redirectOf } from './http-redirect.ts';
import { claimTransferEntry, mockContentType, parseBody } from './http-internals.ts';
export { decodePayload, type PayloadEntry, type PayloadSummary } from './http-payload.ts';

const MAX_WARNINGS = 50;
const PREVIEW_CHARS = 2000;

function preview(body: unknown): string | undefined {
  if (body === null || body === undefined) return undefined;
  try {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
  } catch {
    return undefined;
  }
}

/**
 * The body of a failed response worth previewing: text, or parsed JSON. A
 * network failure carries a ProgressEvent (or an Error), which says nothing.
 */
function errorBody(body: unknown): unknown {
  if (typeof body === 'string') return body || undefined;
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && Object.getPrototypeOf(body) === Object.prototype)
    return body;
  return undefined;
}

function optionalPreview(body: unknown): { preview?: string } {
  const text = preview(body);
  return text === undefined ? {} : { preview: text };
}

function record(call: HttpCall) {
  const registry = httpRegistry();
  // The devframe server takes the call right away, so its headers are read now.
  if (registry.record) return registry.record(withCapturedHeaders(call));
  const calls = (registry.calls ??= []);
  calls.push(call);
  const extra = calls.length - (registry.maxCalls ?? MAX_CALLS);
  if (extra > 0) {
    calls.splice(0, extra);
    registry.dropped = (registry.dropped ?? 0) + extra;
  }
}

let seq = 0;

const stableApps = new WeakSet<object>();
const watchedApps = new WeakSet<object>();

function transferWindowOpen(): boolean {
  // Angular turns its transfer cache off once the app is stable. `timeUntilStable` notes that
  // from the start; the first request after it would otherwise still claim a payload entry.
  if (httpRegistry().stableMs !== undefined) return false;
  const appRef = inject(ApplicationRef, { optional: true });
  if (!appRef) return true;
  if (!watchedApps.has(appRef)) {
    watchedApps.add(appRef);
    void appRef.whenStable().then(() => stableApps.add(appRef));
  }
  return !stableApps.has(appRef);
}

/** True when Angular's transfer cache, with its default options, may answer this request. */
export function transferCacheEligible(req: HttpRequest<unknown>): boolean {
  return requestSkipReason(req) === undefined;
}

function devMode(): boolean {
  return !!(globalThis as { ngDevMode?: unknown }).ngDevMode;
}

/**
 * The traced request of a render that has no Angular `REQUEST`, such as an
 * Analog page: the one the tracer marked the render's async context with
 * (`ssr-context.ts`). A render the tracer did not trace, or never saw, is
 * linked to nothing, even while other renders are in flight.
 */
function untaggedServerRequest(): { requestId?: string; pageUrl?: string } {
  const requestId = currentSsrRequest(inject(Injector));
  if (!requestId) return {};
  return { requestId, pageUrl: ssrRegistry().active.get(requestId)?.url };
}

/**
 * Records every request for the SSR & HTTP tab and applies the fault rules
 * set there. It does nothing in production builds.
 */
export const pangularHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!devMode()) return next(req);
  const side: HttpSide = isPlatformServer(inject(PLATFORM_ID)) ? 'server' : 'client';
  const request = side === 'server' ? inject(REQUEST, { optional: true }) : null;
  let pageUrl: string | undefined;
  let requestId: string | undefined;
  if (request) {
    try {
      const url = new URL(request.url);
      pageUrl = url.pathname + url.search;
    } catch {
      pageUrl = undefined;
    }
    requestId = activeSsrRequest(request.headers.get(SSR_REQUEST_HEADER));
  } else if (side === 'server') {
    ({ requestId, pageUrl } = untaggedServerRequest());
  } else {
    pageUrl = location.pathname + location.search;
  }
  const url = req.urlWithParams;
  const registry = httpRegistry();
  const rules = side === 'client' ? clientRules() : registry.record && registry.rules;
  const rule = matchRule(url, req.method, rules, side);
  const started = Date.now();
  const delay = Math.min(Math.max(rule?.delayMs ?? 0, 0), MAX_DELAY_MS);
  const status = rule ? ruleStatus(rule) : undefined;
  const mocked = status !== undefined;
  const base = {
    url,
    method: req.method,
    side,
    pageUrl,
    ...(requestId ? { requestId } : {}),
    faulted: mocked && status >= 400,
    ...(mocked && status < 400 ? { mocked: true } : {}),
    ...(delay ? { delayMs: delay } : {}),
    ...(rule ? { ruleId: rule.id, rulePattern: rule.pattern } : {}),
  };
  const done = (
    fields: Pick<HttpCall, 'status' | 'cacheHit'> & Partial<HttpCall>,
    responseHeaders?: HeaderSource | null,
  ) => {
    const durationMs = Date.now() - started;
    if (requestId) noteSsrFetch(requestId, durationMs);
    const call: HttpCall = {
      id: `${side[0]}${Date.now().toString(36)}${++seq}`,
      at: started,
      durationMs,
      ...base,
      ...fields,
    };
    // Only references: the headers are read when the call is reported.
    captureHeaders(call, req.headers, responseHeaders);
    record(call);
  };

  let source: Observable<HttpEvent<unknown>>;
  if (status !== undefined) {
    const body = parseBody(rule?.body, req.responseType);
    const headers = new HttpHeaders({ 'content-type': mockContentType(req.responseType) });
    source =
      status >= 400
        ? throwError(
            () =>
              new HttpErrorResponse({
                status,
                statusText: 'Injected by Pangular Inspector',
                url,
                error: body,
                headers,
              }),
          )
        : of(
            new HttpResponse({
              status,
              statusText: 'Mocked by Pangular Inspector',
              url,
              body,
              headers,
            }),
          );
  } else {
    source = next(req);
  }
  const cacheable = side === 'client' && !mocked && transferWindowOpen();
  const claimable = cacheable && transferCacheEligible(req);
  const transferState = side === 'server' ? inject(TransferState, { optional: true }) : null;
  const serverCache = (
    response: { ok: boolean; headers?: HttpHeaders } | null,
  ): { cacheStored: boolean; cacheSkip?: CacheSkip } | Record<string, never> => {
    if (side !== 'server' || !transferState) return {};
    if (mocked) return { cacheStored: false, cacheSkip: 'mocked' };
    const stored = transferCacheKeys(req).some((key) => transferState.hasKey(makeStateKey(key)));
    return stored
      ? { cacheStored: true }
      : { cacheStored: false, cacheSkip: cacheSkipReason(req, response) };
  };
  const observed = new Observable<HttpEvent<unknown>>((subscriber) => {
    // The transfer cache replays a hit synchronously, so a response that
    // arrives before subscribe() returns came from the SSR payload.
    let sync = true;
    let settled = false;
    const inner = source.subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          settled = true;
          const fromPayload = claimable && claimTransferEntry(req);
          done(
            {
              status: event.status,
              ...redirectOf(url, event.url),
              // Only the browser reads the transfer cache. On the server, cacheStored says what it kept.
              cacheHit: cacheable && (sync || fromPayload),
              preview: preview(mocked ? rule?.body : event.body),
              ...serverCache({ ok: event.ok, headers: event.headers }),
            },
            event.headers,
          );
        }
        subscriber.next(event);
      },
      error: (error: unknown) => {
        const failed = error instanceof HttpErrorResponse;
        const message = failed ? error.message : String(error);
        settled = true;
        done(
          {
            status: failed ? error.status : 0,
            ...(failed ? redirectOf(url, error.url) : {}),
            cacheHit: false,
            error: message.slice(0, 500),
            // The body the server sent with the error, such as validation messages.
            ...(failed ? optionalPreview(errorBody(error.error)) : {}),
            ...serverCache(null),
          },
          failed ? error.headers : null,
        );
        subscriber.error(error);
      },
      complete: () => subscriber.complete(),
    });
    sync = false;
    return () => {
      if (!settled) {
        settled = true;
        done({ status: 0, cacheHit: false, cancelled: true, error: 'cancelled' });
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
      else {
        done({ status: 0, cacheHit: false, cancelled: true, error: 'cancelled during the delay' });
      }
    };
  });
};

function textOf(value: unknown): string {
  try {
    return value instanceof Error ? value.message : String(value);
  } catch {
    return '';
  }
}

function captureHydrationWarnings() {
  if (typeof document === 'undefined' || !devMode()) return;
  const registry = httpRegistry();
  if (registry.warnings) return;
  const warnings: string[] = (registry.warnings = []);
  // Kept for the page's life, like the registry it fills.
  tapConsole(['warn', 'error'], (_level, args) => {
    const text = args.map(textOf).join(' ');
    if (!isHydrationMessage(text)) return;
    const warning = redactMessage(text.slice(0, 5000)).slice(0, 1000);
    if (!warnings.includes(warning)) {
      warnings.push(warning);
      if (warnings.length > MAX_WARNINGS) warnings.shift();
    }
  });
}

/** `provideHttpClient(withPangular())` registers the DevTools interceptor. */
export function withPangular() {
  return withInterceptors([pangularHttpInterceptor]);
}

function watchServerNavigations() {
  const platform = inject(PLATFORM_ID, { optional: true });
  if (!devMode() || !platform || !isPlatformServer(platform)) return;
  const request = inject(REQUEST, { optional: true });
  let requestId: string | undefined;
  let pageUrl: string | undefined;
  if (request) {
    requestId = activeSsrRequest(request.headers.get(SSR_REQUEST_HEADER));
    if (!requestId) return;
    const url = new URL(request.url);
    pageUrl = url.pathname + url.search;
  } else {
    ({ requestId, pageUrl } = untaggedServerRequest());
  }
  if (!requestId || pageUrl === undefined) return;
  const fault = matchingOverrides(ssrRegistry().overrides, pageUrl, 'render-error')[0];
  if (fault) {
    noteOverride(requestId, {
      id: fault.id,
      kind: 'render-error',
      applied: true,
      note: fault.message,
    });
    throw new Error(`[Pangular Inspector] ${fault.message}`);
  }
  // Subscribe now: the initial navigation starts in an app initializer, before any microtask.
  inject(DestroyRef).onDestroy(watchSsrNavigations(requestId, inject(EnvironmentInjector)));
}

/**
 * Captures hydration warnings (NG05xx) before the overlay loads. During a
 * server render traced by `ssrMiddleware`, it also records the router's guard
 * and resolver timings and applies render-error overrides from the panel.
 * Add it next to `provideHttpClient(withPangular())`.
 */
export function providePangularHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(captureHydrationWarnings),
    provideEnvironmentInitializer(watchServerNavigations),
    provideEnvironmentInitializer(timeUntilStable),
  ]);
}

/** Milliseconds from navigation start until the app first became stable, the point hydration finishes. */
function timeUntilStable() {
  const platform = inject(PLATFORM_ID, { optional: true });
  if (!devMode() || !platform || isPlatformServer(platform) || typeof performance === 'undefined') {
    return;
  }
  const appRef = inject(ApplicationRef, { optional: true });
  void appRef?.whenStable().then(() => {
    httpRegistry().stableMs ??= Math.round(performance.now());
  });
}
