import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  withInterceptors,
  type HttpEvent,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import {
  PLATFORM_ID,
  REQUEST,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { Observable, throwError, timer, of, switchMap } from 'rxjs';

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

function parseBody(body: string | undefined): unknown {
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
    const body = parseBody(rule?.body);
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
  const observed = new Observable<HttpEvent<unknown>>((subscriber) => {
    // The transfer cache replays a hit synchronously, so a response that
    // arrives before subscribe() returns came from the SSR payload.
    let sync = true;
    let settled = false;
    const inner = source.subscribe({
      next: (event) => {
        if (event instanceof HttpResponse) {
          settled = true;
          done({
            status: event.status,
            cacheHit: sync && !mocked,
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
  return delay ? timer(delay).pipe(switchMap(() => observed)) : observed;
};

const HYDRATION_CODE = /NG0?5\d\d/;

function captureHydrationWarnings() {
  if (typeof document === 'undefined' || !devMode()) return;
  const registry = httpRegistry();
  if (registry.warnings) return;
  const warnings: string[] = (registry.warnings = []);
  for (const level of ['warn', 'error'] as const) {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
      if (HYDRATION_CODE.test(text)) {
        warnings.push(text.slice(0, 1000));
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
