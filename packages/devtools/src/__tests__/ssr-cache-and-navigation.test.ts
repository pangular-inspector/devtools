import '@angular/compiler';
import {
  Injector,
  PLATFORM_ID,
  REQUEST,
  TransferState,
  makeStateKey,
  runInInjectionContext,
} from '@angular/core';
import {
  HttpErrorResponse,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
} from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pangularHttpInterceptor } from '../http.ts';
import { transferCacheKeys } from '../http-cache-key.ts';
import { cacheSkipReason } from '../http-cache-reason.ts';
import { httpRegistry, sanitizeCalls, type HttpCall } from '../http-rules.ts';
import { EventType } from '../router.ts';
import { watchSsrNavigations } from '../ssr-navigation.ts';
import { ssrRegistry, type SsrRequest } from '../ssr-registry.ts';
import { explainSsrRequestText, sanitizeSsrRequest } from '../rpc/ssr-tools.ts';

const ok = { ok: true, headers: new HttpHeaders() };

describe('cacheSkipReason', () => {
  it('follows the order Angular checks a request in', () => {
    const get = (init: ConstructorParameters<typeof HttpRequest>[3] = {}) =>
      new HttpRequest('GET', '/api/a', null, init);
    expect(cacheSkipReason(get({ transferCache: false }), ok)).toBe('opted-out');
    expect(cacheSkipReason(new HttpRequest('POST', '/api/a', {}), ok)).toBe('post');
    expect(cacheSkipReason(new HttpRequest('PUT', '/api/a', {}), ok)).toBe('method');
    expect(
      cacheSkipReason(get({ headers: new HttpHeaders({ Authorization: 'Bearer x' }) }), ok),
    ).toBe('auth-headers');
    expect(cacheSkipReason(get({ withCredentials: true }), ok)).toBe('credentials');
    expect(cacheSkipReason(get({ cache: 'no-store' }), ok)).toBe('no-cache-request');
    expect(cacheSkipReason(get(), null)).toBe('error');
    expect(
      cacheSkipReason(get(), {
        ok: true,
        headers: new HttpHeaders({ 'cache-control': 'private' }),
      }),
    ).toBe('no-cache-response');
    expect(
      cacheSkipReason(get(), { ok: true, headers: new HttpHeaders({ 'set-cookie': 'a=1' }) }),
    ).toBe('set-cookie');
    expect(cacheSkipReason(get(), ok)).toBe('cache-off-or-filter');
  });

  it('lets a POST through when the request opts in', () => {
    const req = new HttpRequest('POST', '/api/a', {}, { transferCache: true });
    expect(cacheSkipReason(req, ok)).toBe('cache-off-or-filter');
  });
});

describe('interceptor transfer cache outcome', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
    httpRegistry().calls = [];
    httpRegistry().rules = [];
  });
  afterEach(() => {
    g.ngDevMode = saved;
    delete httpRegistry().rules;
  });

  const run = (req: HttpRequest<unknown>, store: boolean, fail = false) => {
    const state = new TransferState();
    const injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: new Request('http://localhost/x') },
        { provide: TransferState, useValue: state },
      ],
    });
    runInInjectionContext(injector, () =>
      pangularHttpInterceptor(req, () => {
        // The transfer cache runs inside this interceptor and stores before the response returns.
        if (store) state.set(makeStateKey<{ b: unknown[] }>(transferCacheKeys(req)[0]), { b: [] });
        return fail
          ? throwError(() => new HttpErrorResponse({ status: 503 }))
          : of(new HttpResponse({ status: 200, body: [] }) as HttpEvent<unknown>);
      }),
    ).subscribe({ error: () => {} });
    return httpRegistry().calls!.at(-1)!;
  };

  it('marks a stored response, and gives the reason for one that was not', () => {
    const get = new HttpRequest('GET', 'http://localhost/api/products');
    expect(run(get, true)).toMatchObject({ cacheStored: true });
    expect(run(get, true)).not.toHaveProperty('cacheSkip');
    expect(run(new HttpRequest('POST', 'http://localhost/api/quote', {}), false)).toMatchObject({
      cacheStored: false,
      cacheSkip: 'post',
    });
    expect(run(get, false, true)).toMatchObject({ cacheStored: false, cacheSkip: 'error' });
  });

  it('blames a fault rule that answered on the server', () => {
    const recorded: HttpCall[] = [];
    // Server rules apply only while the devframe server has installed its recorder.
    httpRegistry().record = (c) => recorded.push(c);
    httpRegistry().rules = [
      {
        id: 'r',
        pattern: '/api/products',
        enabled: true,
        target: 'server',
        status: 200,
        body: '[]',
      },
    ];
    try {
      run(new HttpRequest('GET', 'http://localhost/api/products'), false);
    } finally {
      httpRegistry().record = undefined;
    }
    expect(recorded.at(-1)).toMatchObject({ mocked: true, cacheSkip: 'mocked' });
  });

  it('keeps the outcome through sanitizeCalls and drops unknown reasons', () => {
    const call = { id: 'a', url: '/a', method: 'GET', at: 1 };
    expect(sanitizeCalls([{ ...call, cacheStored: false, cacheSkip: 'post' }])[0]).toMatchObject({
      cacheStored: false,
      cacheSkip: 'post',
    });
    expect(sanitizeCalls([{ ...call, cacheSkip: '<script>' }])[0]).not.toHaveProperty('cacheSkip');
  });
});

describe('watchSsrNavigations', () => {
  const g = globalThis as { ng?: unknown };
  afterEach(() => {
    delete g.ng;
    ssrRegistry().active.clear();
  });

  it('records guard and resolver timings on the traced request', () => {
    const events = new Subject<Record<string, unknown>>();
    const router = {
      navigateByUrl: () => {},
      routerState: { snapshot: { root: { children: [] } } },
      events,
      url: '/',
      serializeUrl: (u: unknown) => String(u),
    };
    g.ng = { ɵgetRouterInstance: () => router };
    ssrRegistry().active.set('r1', { fetches: 0, fetchMs: 0 });
    const stop = watchSsrNavigations('r1', {});
    events.next({ type: EventType.NavigationStart, id: 1, url: '/destinations/3' });
    events.next({ type: EventType.GuardsCheckStart, id: 1, state: { root: { children: [] } } });
    events.next({ type: EventType.GuardsCheckEnd, id: 1, shouldActivate: true });
    events.next({ type: EventType.ResolveStart, id: 1 });
    events.next({ type: EventType.ResolveEnd, id: 1 });
    events.next({ type: EventType.NavigationEnd, id: 1, urlAfterRedirects: '/destinations/3' });
    stop();
    events.next({ type: EventType.NavigationStart, id: 2, url: '/late' });
    const navs = ssrRegistry().active.get('r1')!.navigations!;
    expect(navs).toHaveLength(1);
    expect(navs[0]).toMatchObject({
      url: '/destinations/3',
      outcome: 'succeeded',
      guards: { passed: true, ms: expect.any(Number) },
      resolvers: { ms: expect.any(Number) },
    });
  });

  it('does nothing without the dev-mode router util or an active request', () => {
    expect(() => watchSsrNavigations('missing', {})()).not.toThrow();
    g.ng = { ɵgetRouterInstance: () => null };
    ssrRegistry().active.set('r1', { fetches: 0, fetchMs: 0 });
    watchSsrNavigations('r1', {})();
    expect(ssrRegistry().active.get('r1')!.navigations).toBeUndefined();
  });
});

describe('explain-ssr-request with reasons and navigations', () => {
  const request = (overrides: Partial<SsrRequest> = {}): SsrRequest => ({
    id: 'r1',
    method: 'GET',
    url: '/examples/ssr',
    status: 200,
    at: 1000,
    durationMs: 40,
    renderMs: 35,
    bytes: 100,
    renderMode: 'server',
    fetches: 2,
    fetchMs: 10,
    headers: {},
    ...overrides,
  });
  const call = (overrides: Partial<HttpCall>): HttpCall => ({
    id: 'c',
    url: 'http://localhost/api/quote',
    method: 'POST',
    status: 200,
    durationMs: 4,
    side: 'server',
    cacheHit: false,
    faulted: false,
    at: 1001,
    requestId: 'r1',
    ...overrides,
  });

  it('names the skip reason of each refetched call and lists router timings', () => {
    const clean = sanitizeSsrRequest({
      ...request(),
      navigations: [
        {
          url: '/examples/ssr?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc',
          outcome: 'succeeded',
          durationMs: 20,
          guards: { names: ['adminGuard'], passed: true, ms: 3 },
          resolvers: { names: ['user: userResolver'], ms: 12 },
        },
        { url: '/x', outcome: 'nonsense' },
      ],
    })!;
    expect(clean.navigations).toHaveLength(1);
    expect(clean.navigations![0].url).not.toContain('eyJhbGci');
    const server = [
      call({ id: 's1', cacheStored: false, cacheSkip: 'post' }),
      call({ id: 's2', method: 'GET', url: 'http://localhost/api/products', cacheStored: true }),
    ];
    const pages = [
      {
        pageId: 'p1',
        url: '/examples/ssr',
        initialUrl: '/examples/ssr',
        title: '',
        hydration: null,
        ssrRequestId: 'r1',
        firstSeenAt: 1100,
        reportedAt: 1100,
        calls: [call({ id: 'b1', side: 'client', url: '/api/quote', at: 1200 })],
      },
    ];
    const text = explainSsrRequestText([clean], server, pages, {});
    expect(text).toContain('### Router during the render');
    expect(text).toContain('Guards `adminGuard`: passed in 3 ms');
    expect(text).toContain('Resolvers `user: userResolver`: 12 ms');
    expect(text).toContain('stored in the transfer cache');
    expect(text).toContain(
      'POST `/api/quote`: POST requests are left out unless includePostRequests is set',
    );
    expect(text).not.toContain('anything the `filter` option rejects');
  });
});
