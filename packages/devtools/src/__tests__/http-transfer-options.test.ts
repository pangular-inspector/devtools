// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentInjector,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  type EnvironmentInjector,
  type Provider,
} from '@angular/core';
import {
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  ɵwithHttpTransferCache,
  type HttpEvent,
  type HttpHandlerFn,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { angularAtLeast } from './angular-version.ts';
import { cacheSkipReason, requestSkipReason } from '../http-cache-reason.ts';
import { CACHE_SKIP_TEXT } from '../config.ts';
import { httpRegistry } from '../http-rules.ts';
import { resetTransferEntries } from '../http-internals.ts';
import { transferCacheKeys } from '../http-cache-key.ts';

// `withPangular()` imports `provideEnvironmentInitializer` and `REQUEST`, which arrived in 19.0.
const httpEntry = angularAtLeast('19.0');

describe('transfer cache options in the skip reasons', () => {
  const auth = new HttpHeaders({ Authorization: 'Bearer x' });

  it("follows Angular's defaults without options", () => {
    expect(requestSkipReason(new HttpRequest('POST', '/api', {}))).toBe('post');
    expect(requestSkipReason(new HttpRequest('GET', '/api', null, { headers: auth }))).toBe(
      'auth-headers',
    );
    expect(requestSkipReason(new HttpRequest('GET', '/api', null, { withCredentials: true }))).toBe(
      'credentials',
    );
    expect(requestSkipReason(new HttpRequest('GET', '/api'))).toBeUndefined();
  });

  it('lets through what the options include', () => {
    expect(
      requestSkipReason(new HttpRequest('POST', '/api', {}), { includePostRequests: true }),
    ).toBeUndefined();
    expect(
      requestSkipReason(new HttpRequest('GET', '/api', null, { headers: auth }), {
        includeRequestsWithAuthHeaders: true,
      }),
    ).toBeUndefined();
    expect(
      requestSkipReason(new HttpRequest('GET', '/api', null, { withCredentials: true }), {
        includeRequestsWithCredentials: true,
      }),
    ).toBeUndefined();
    const noStore = new HttpRequest('GET', '/api', null, {
      headers: new HttpHeaders({ 'Cache-Control': 'no-store' }),
    });
    expect(requestSkipReason(noStore)).toBe('no-cache-request');
    expect(requestSkipReason(noStore, { includeNonCacheableRequests: true })).toBeUndefined();
    // `transferCache: false` on the request always wins.
    expect(
      requestSkipReason(new HttpRequest('GET', '/api', null, { transferCache: false }), {
        includePostRequests: true,
      }),
    ).toBe('opted-out');
  });

  it('names the filter when it leaves a request out', () => {
    const filter = (req: HttpRequest<unknown>) => !req.url.includes('/live');
    expect(requestSkipReason(new HttpRequest('GET', '/api/live'), { filter })).toBe('filter');
    expect(requestSkipReason(new HttpRequest('GET', '/api/list'), { filter })).toBeUndefined();
    expect(CACHE_SKIP_TEXT.filter).toContain('withPangular()');
  });

  it('keeps no-cache and set-cookie responses with includeNonCacheableRequests', () => {
    const req = new HttpRequest('GET', '/api');
    const response = { ok: true, headers: new HttpHeaders({ 'Set-Cookie': 'a=1' }) };
    expect(cacheSkipReason(req, response)).toBe('set-cookie');
    expect(cacheSkipReason(req, response, { includeNonCacheableRequests: true })).toBe(
      'cache-off-or-filter',
    );
  });
});

describe.runIf(httpEntry)('withPangular({ transferCache })', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
    httpRegistry().calls = [];
    httpRegistry().rules = [];
    resetTransferEntries();
  });
  afterEach(() => {
    g.ngDevMode = saved;
    vi.restoreAllMocks();
    delete httpRegistry().rules;
  });

  async function setup(providers: (Provider | ReturnType<typeof provideHttpClient>)[]) {
    const { withPangular } = await import('../http.ts');
    const { angularCacheOptionsToken, PANGULAR_TRANSFER_CACHE } =
      await import('../http-transfer-options.ts');
    const parent = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
    const injector: EnvironmentInjector = createEnvironmentInjector(
      providers.map((p) => (p === WITH_PANGULAR ? provideHttpClient(withPangular(OPTIONS)) : p)),
      parent as EnvironmentInjector,
    );
    const token = angularCacheOptionsToken()!;
    return { injector, token, PANGULAR_TRANSFER_CACHE };
  }

  const WITH_PANGULAR = Symbol('withPangular') as unknown as Provider;
  const filter = (req: HttpRequest<unknown>) => !req.url.includes('/live');
  const OPTIONS = {
    transferCache: { includePostRequests: true, includeHeaders: ['etag'], filter },
  };

  it("finds Angular's private cache options token", async () => {
    const { angularCacheOptionsToken } = await import('../http-transfer-options.ts');
    const token = angularCacheOptionsToken();
    expect(token).not.toBeNull();
    expect(String(token)).toContain('HTTP_TRANSFER_STATE_CACHE_OPTIONS');
  });

  it("passes the options to Angular's transfer cache, before or after hydration", async () => {
    for (const order of [
      [ɵwithHttpTransferCache({}), WITH_PANGULAR],
      [WITH_PANGULAR, ɵwithHttpTransferCache({})],
    ]) {
      const { injector, token } = await setup(order.flat());
      const cache = injector.get(token);
      expect(cache).toMatchObject({
        isCacheActive: true,
        includePostRequests: true,
        includeHeaders: ['etag'],
      });
      expect(cache['filter']).toBe(filter);
      injector.destroy();
    }
  });

  it('warns when the app has no transfer cache to configure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { injector } = await setup([WITH_PANGULAR]);
    expect(warn.mock.calls.flat().join(' ')).toContain('provideClientHydration()');
    injector.destroy();
  });

  it('uses the options to tell which calls the cache could answer', async () => {
    const { pangularHttpInterceptor } = await import('../http.ts');
    const { injector, PANGULAR_TRANSFER_CACHE } = await setup([
      ɵwithHttpTransferCache({}),
      WITH_PANGULAR,
    ]);
    expect(injector.get(PANGULAR_TRANSFER_CACHE)).toBe(OPTIONS.transferCache);
    const ok: HttpHandlerFn = () =>
      new Observable<HttpEvent<unknown>>((subscriber) => {
        subscriber.next(new HttpResponse({ status: 200, body: [] }));
        subscriber.complete();
      });
    // With includePostRequests, a plain POST the server stored counts as a cache hit.
    const post = new HttpRequest('POST', '/api/search', { q: 'a' });
    document.body.innerHTML = `<script id="ng-state" type="application/json">${JSON.stringify({
      [transferCacheKeys(post)[0]]: { b: [], s: 200, u: post.url },
    })}</script>`;
    await new Promise<void>((resolve) =>
      runInInjectionContext(injector, () => pangularHttpInterceptor(post, ok)).subscribe({
        complete: resolve,
      }),
    );
    expect(httpRegistry().calls?.map((c) => c.cacheHit)).toEqual([true]);
    document.body.innerHTML = '';
    injector.destroy();
  });

  it('returns the plain interceptor feature without options', async () => {
    const { withPangular } = await import('../http.ts');
    const plain = withPangular();
    expect(plain.ɵproviders).toHaveLength(1);
    expect(withPangular(OPTIONS).ɵproviders.length).toBeGreaterThan(1);
  });
});
