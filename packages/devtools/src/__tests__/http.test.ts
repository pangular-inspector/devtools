// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationRef,
  createEnvironmentInjector,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import {
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
  type HttpHandlerFn,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { transferCacheKeys } from '../http-cache-key.ts';
import {
  pangularHttpInterceptor,
  parseBody,
  providePangularHttp,
  resetTransferEntries,
} from '../http.ts';
import { appIdOf, isHydrationMessage, scanHydration } from '../http-hydration.ts';
import { attachHttp } from '../http-overlay.ts';
import {
  MAX_DELAY_MS,
  MAX_RULES,
  RULES_STORAGE_KEY,
  clientRules,
  httpRegistry,
  MAX_CALLS,
  matchRule,
  sanitizeCalls,
  sanitizeRules,
  storeRules,
  type HttpRule,
} from '../http-rules.ts';
import { decodePayload, sanitizeHydration, sanitizePayload } from '../http-payload.ts';
import { setRedaction } from '../forms-privacy.ts';

const rule = (overrides: Partial<HttpRule> = {}): HttpRule => ({
  id: 'r1',
  pattern: '/api/products',
  enabled: true,
  target: 'both',
  status: 500,
  ...overrides,
});

describe('matchRule', () => {
  it('matches by substring on relative and absolute URLs', () => {
    const rules = [rule()];
    expect(matchRule('/api/products?x=1', 'GET', rules, 'client')?.id).toBe('r1');
    expect(matchRule('http://localhost:4000/api/products', 'GET', rules, 'server')?.id).toBe('r1');
    expect(matchRule('/api/users', 'GET', rules, 'client')).toBeUndefined();
  });

  it('supports * globs', () => {
    const rules = [rule({ pattern: '/api/*/42' })];
    expect(matchRule('/api/products/42', 'GET', rules, 'client')).toBeDefined();
    expect(matchRule('http://host/api/orders/42', 'GET', rules, 'server')).toBeDefined();
    expect(matchRule('/api/products/7', 'GET', rules, 'client')).toBeUndefined();
  });

  it('filters by method, side and enabled flag', () => {
    expect(matchRule('/api/products', 'post', [rule({ method: 'POST' })], 'client')).toBeDefined();
    expect(matchRule('/api/products', 'GET', [rule({ method: 'POST' })], 'client')).toBeUndefined();
    expect(
      matchRule('/api/products', 'GET', [rule({ target: 'server' })], 'client'),
    ).toBeUndefined();
    expect(matchRule('/api/products', 'GET', [rule({ target: 'server' })], 'server')).toBeDefined();
    expect(matchRule('/api/products', 'GET', [rule({ enabled: false })], 'client')).toBeUndefined();
    expect(matchRule('/api/products', 'GET', undefined, 'client')).toBeUndefined();
  });

  it('returns the first matching rule', () => {
    const rules = [rule({ id: 'a', enabled: false }), rule({ id: 'b' }), rule({ id: 'c' })];
    expect(matchRule('/api/products', 'GET', rules, 'client')?.id).toBe('b');
  });
});

describe('sanitizeRules', () => {
  it('drops malformed input', () => {
    expect(sanitizeRules(null)).toEqual([]);
    expect(sanitizeRules('x')).toEqual([]);
    expect(sanitizeRules([null, 1, {}, { pattern: '   ' }])).toEqual([]);
  });

  it('normalises fields', () => {
    const [r] = sanitizeRules([
      {
        pattern: ' /api ',
        method: 'get',
        target: 'weird',
        status: 42,
        delayMs: 999_999,
        body: '{}',
      },
    ]);
    expect(r).toMatchObject({
      id: 'r1',
      pattern: '/api',
      method: 'GET',
      target: 'both',
      enabled: true,
      body: '{}',
    });
    expect(r.status).toBe(200);
    expect(r.delayMs).toBe(MAX_DELAY_MS);
  });

  it('gives a body-only rule status 200 and drops rules that change nothing', () => {
    const rules = sanitizeRules([
      { id: 'body', pattern: '/a', body: '{"a":1}' },
      { id: 'none', pattern: '/b' },
      { id: 'blank', pattern: '/c', body: '  ', status: 42 },
      { id: 'slow', pattern: '/d', delayMs: 300 },
    ]);
    expect(rules.map((r) => [r.id, r.status, r.delayMs])).toEqual([
      ['body', 200, undefined],
      ['slow', undefined, 300],
    ]);
  });

  it('keeps only statuses from the rule status list', () => {
    const rules = sanitizeRules([
      { id: 'cf', pattern: '/a', status: 522 },
      { id: 'nginx', pattern: '/b', status: 499 },
      { id: 'unknown', pattern: '/c', status: 599 },
      { id: 'info', pattern: '/d', status: 101 },
      { id: 'body', pattern: '/e', status: 599, body: '{}' },
    ]);
    expect(rules.map((r) => [r.id, r.status])).toEqual([
      ['cf', 522],
      ['nginx', 499],
      ['body', 200],
    ]);
  });

  it('rejects bad methods and caps the rule count', () => {
    expect(
      sanitizeRules([{ pattern: '/a', method: 'G T', status: 500 }])[0].method,
    ).toBeUndefined();
    const many = Array.from({ length: MAX_RULES + 10 }, (_, i) => ({
      pattern: `/p${i}`,
      status: 500,
    }));
    expect(sanitizeRules(many)).toHaveLength(MAX_RULES);
  });
});

describe('push-http report sanitizers', () => {
  it('drops malformed calls and caps the count', () => {
    const ok = { id: 'c1', url: '/a', method: 'GET', status: 200 };
    expect(sanitizeCalls([null, {}, { id: 'x' }, ok])).toEqual([
      expect.objectContaining({ ...ok, side: 'client', cacheHit: false, durationMs: 0 }),
    ]);
    expect(sanitizeCalls('x')).toEqual([]);
    const many = Array.from({ length: MAX_CALLS + 5 }, (_, i) => ({ ...ok, id: `c${i}` }));
    expect(sanitizeCalls(many)).toHaveLength(MAX_CALLS);
  });

  it('keeps the rule notes and the cancelled flag', () => {
    const [call] = sanitizeCalls([
      {
        id: 'c1',
        url: '/a',
        method: 'GET',
        cancelled: true,
        mocked: 'yes',
        delayMs: 300,
        rulePattern: '/a*',
      },
    ]);
    expect(call).toMatchObject({ cancelled: true, delayMs: 300, rulePattern: '/a*' });
    expect(call.mocked).toBeUndefined();
  });

  it('falls back for malformed payloads and hydration stats', () => {
    expect(sanitizePayload(null)).toEqual({ found: false, size: 0, entries: [] });
    expect(sanitizePayload({ found: true, entries: [1, { key: 'k', value: 2 }] }).entries).toEqual([
      { key: 'k', size: 0, value: 2 },
    ]);
    expect(sanitizeHydration({})).toBeNull();
    expect(sanitizeHydration({ enabled: true, warnings: ['w', 3] })).toMatchObject({
      enabled: true,
      skipHydrationHosts: [],
      warnings: ['w'],
    });
  });
});

describe('client rule storage', () => {
  afterEach(() => {
    sessionStorage.clear();
    delete httpRegistry().rules;
  });

  it('persists rules and reads them back after a reload', () => {
    storeRules([rule()]);
    expect(JSON.parse(sessionStorage.getItem(RULES_STORAGE_KEY) ?? '[]')).toHaveLength(1);
    delete httpRegistry().rules;
    expect(clientRules()[0].pattern).toBe('/api/products');
  });

  it('removes storage when rules are cleared and survives bad JSON', () => {
    storeRules([rule()]);
    storeRules([]);
    expect(sessionStorage.getItem(RULES_STORAGE_KEY)).toBeNull();
    delete httpRegistry().rules;
    sessionStorage.setItem(RULES_STORAGE_KEY, '{nope');
    expect(clientRules()).toEqual([]);
  });
});

describe('decodePayload', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const addState = (text: string, id = 'ng-state') => {
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/json';
    script.textContent = text;
    document.body.append(script);
  };

  it('reports a missing payload', () => {
    expect(decodePayload(document)).toEqual({ found: false, size: 0, entries: [] });
  });

  it('decodes HTTP transfer-cache entries and plain keys', () => {
    addState(
      JSON.stringify({
        '123': { b: [{ id: 1 }], s: 200, st: 'OK', u: '/api/products', rt: 'json' },
        theme: 'dark',
      }),
    );
    const summary = decodePayload(document);
    expect(summary.found).toBe(true);
    expect(summary.entries).toHaveLength(2);
    const http = summary.entries.find((e) => e.key === '123');
    expect(http?.http).toEqual({
      url: '/api/products',
      status: 200,
      statusText: 'OK',
      responseType: 'json',
    });
    expect(http?.value).toEqual([{ id: 1 }]);
    expect(summary.entries.find((e) => e.key === 'theme')?.value).toBe('dark');
  });

  it('uses a custom app id and reports parse errors', () => {
    addState('{bad', 'shop-state');
    const summary = decodePayload(document, 'shop');
    expect(summary.found).toBe(true);
    expect(summary.error).toBeTruthy();
  });
});

describe('TransferState payload labels', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('decodes Analog entries and labels hydration annotations', () => {
    const script = document.createElement('script');
    script.id = 'ng-state';
    script.type = 'application/json';
    script.textContent = JSON.stringify({
      analog_123: { body: { ok: true }, status: 200, statusText: 'OK', url: '/api/x', headers: {} },
      __nghData__: [{ c: 1 }],
      __nghDeferData__: {},
      '9': { b: 'hi', s: 200, u: '/api/y' },
    });
    document.body.append(script);
    const entries = decodePayload(document).entries;
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
    expect(byKey['analog_123']).toMatchObject({
      source: 'analog',
      http: { url: '/api/x', status: 200, statusText: 'OK' },
      value: { ok: true },
    });
    expect(byKey['__nghData__'].source).toBe('hydration');
    expect(byKey['__nghDeferData__'].source).toBe('hydration');
    expect(byKey['9'].source).toBe('http');
    expect(sanitizePayload({ found: true, entries }).entries.map((e) => e.source)).toEqual([
      'http',
      'analog',
      'hydration',
      'hydration',
    ]);
  });
});

describe('hydration helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('matches only hydration error codes', () => {
    expect(isHydrationMessage('NG0500: During hydration Angular expected')).toBe(true);
    expect(isHydrationMessage('NG0507: HTML was modified')).toBe(true);
    expect(isHydrationMessage('NG05104: The selector did not match')).toBe(false);
    expect(isHydrationMessage('NG0200: circular dependency')).toBe(false);
  });

  it('reads the app id and counts node statuses with mismatch details', () => {
    document.body.innerHTML =
      '<app-shop><p>a</p><app-card></app-card></app-shop><script id="shop-state" type="application/json">{}</script>';
    const patch = (selector: string, info: unknown) =>
      ((document.querySelector(selector) as unknown as Record<string, unknown>)[
        '__ngDebugHydrationInfo__'
      ] = info);
    patch('app-shop', { status: 'hydrated' });
    patch('p', { status: 'skipped' });
    patch('app-card', {
      status: 'mismatched',
      expectedNodeDetails: '<div>',
      actualNodeDetails: '<span>',
    });
    expect(appIdOf(document)).toBe('shop');
    expect(scanHydration(document)).toEqual({
      hydrated: 1,
      skipped: 1,
      mismatched: 1,
      mismatches: [{ component: 'app-card', expected: '<div>', actual: '<span>' }],
    });
  });

  it('sanitizes the new hydration fields', () => {
    expect(
      sanitizeHydration({
        enabled: true,
        nodes: { hydrated: 3, skipped: 'x' },
        mismatches: [{ component: 'app-card', expected: '<div>' }, { expected: 'x' }],
        warningsCaptured: true,
      }),
    ).toMatchObject({
      nodes: { hydrated: 3, skipped: 0, mismatched: 0 },
      mismatches: [{ component: 'app-card', expected: '<div>' }],
      warningsCaptured: true,
    });
    expect(sanitizeHydration({ enabled: false })?.warningsCaptured).toBe(false);
  });
});

describe('interceptor', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode ??= true;
    httpRegistry().calls = [];
    httpRegistry().rules = [];
    resetTransferEntries();
  });
  afterEach(() => {
    g.ngDevMode = saved;
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete httpRegistry().rules;
    sessionStorage.clear();
  });

  const injector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
  const run = (req: HttpRequest<unknown>, next: HttpHandlerFn) =>
    runInInjectionContext(injector, () => pangularHttpInterceptor(req, next));
  const stateScript = (req: HttpRequest<unknown>) =>
    `<script id="ng-state" type="application/json">${JSON.stringify({
      [transferCacheKeys(req)[0]]: { b: [], s: 200, u: req.url },
    })}</script>`;
  const later =
    (body: unknown): HttpHandlerFn =>
    () =>
      new Observable<HttpEvent<unknown>>((subscriber) => {
        const t = setTimeout(() => {
          subscriber.next(new HttpResponse({ status: 200, body }));
          subscriber.complete();
        }, 5);
        return () => clearTimeout(t);
      });

  it('keeps text mock bodies as text and parses JSON ones', () => {
    expect(parseBody('{"a":1}', 'text')).toBe('{"a":1}');
    expect(parseBody(undefined, 'text')).toBe('');
    expect(parseBody('{"a":1}')).toEqual({ a: 1 });
  });

  it('builds mock bodies and content types that match the response type', async () => {
    const answer = (responseType: 'json' | 'text' | 'blob' | 'arraybuffer', status: number) =>
      new Promise<{ body: unknown; type: string | null }>((resolve) =>
        run(new HttpRequest('GET', '/api/products', null, { responseType }), () => {
          throw new Error('the request should not reach the backend');
        }).subscribe({
          next: (event) => {
            if (event instanceof HttpResponse)
              resolve({ body: event.body, type: event.headers.get('content-type') });
          },
          error: (error: HttpErrorResponse) =>
            resolve({ body: error.error, type: error.headers.get('content-type') }),
        }),
      );
    for (const status of [200, 500]) {
      storeRules([rule({ status, body: '{"a":1}' })]);
      const json = await answer('json', status);
      expect(json).toEqual({ body: { a: 1 }, type: 'application/json' });
      const text = await answer('text', status);
      expect(text).toEqual({ body: '{"a":1}', type: 'text/plain' });
      const blob = await answer('blob', status);
      expect(blob.body).toBeInstanceOf(Blob);
      expect(await (blob.body as Blob).text()).toBe('{"a":1}');
      expect(blob.type).toBe('application/octet-stream');
      const buffer = await answer('arraybuffer', status);
      expect(buffer.body).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(buffer.body as ArrayBuffer)).toBe('{"a":1}');
      expect(buffer.type).toBe('application/octet-stream');
    }
    expect(httpRegistry().calls?.[2]).toMatchObject({ mocked: true, preview: '{"a":1}' });
  });

  it('records a request cancelled during a delay rule', () => {
    vi.useFakeTimers();
    storeRules([rule({ status: undefined, delayMs: 1000 })]);
    const sub = run(new HttpRequest('GET', '/api/products'), later([])).subscribe();
    vi.advanceTimersByTime(100);
    sub.unsubscribe();
    expect(httpRegistry().calls).toEqual([
      expect.objectContaining({
        error: 'cancelled during the delay',
        status: 0,
        cancelled: true,
        faulted: false,
        delayMs: 1000,
        ruleId: 'r1',
        rulePattern: '/api/products',
      }),
    ]);
  });

  it('marks a request cancelled before its response', () => {
    const sub = run(new HttpRequest('GET', '/api/search?q=a'), later([])).subscribe();
    sub.unsubscribe();
    expect(httpRegistry().calls).toEqual([
      expect.objectContaining({ status: 0, cancelled: true, error: 'cancelled', faulted: false }),
    ]);
  });

  it('does not mark a failed request as cancelled', async () => {
    storeRules([rule({ status: 503 })]);
    await new Promise<void>((resolve) =>
      run(new HttpRequest('GET', '/api/products'), later([])).subscribe({ error: () => resolve() }),
    );
    const [call] = httpRegistry().calls ?? [];
    expect(call).toMatchObject({ status: 503, faulted: true });
    expect(call.cancelled).toBeUndefined();
    expect(call.mocked).toBeUndefined();
  });

  it('tags delayed, mocked and faulted calls apart', async () => {
    vi.useFakeTimers();
    storeRules([
      rule({ id: 'slow', pattern: '/slow', status: undefined, delayMs: 50 }),
      rule({ id: 'mock', pattern: '/mock', status: 201, body: '{"ok":true}' }),
      rule({ id: 'fail', pattern: '/fail', status: 500 }),
    ]);
    for (const url of ['/slow', '/mock', '/fail']) {
      run(new HttpRequest('GET', url), later([])).subscribe({ error: () => {} });
    }
    await vi.advanceTimersByTimeAsync(100);
    const byUrl = Object.fromEntries((httpRegistry().calls ?? []).map((c) => [c.url, c]));
    expect(byUrl['/slow']).toMatchObject({ status: 200, delayMs: 50, faulted: false });
    expect(byUrl['/slow'].mocked).toBeUndefined();
    expect(byUrl['/mock']).toMatchObject({ status: 201, mocked: true, faulted: false });
    expect(byUrl['/mock'].delayMs).toBeUndefined();
    expect(byUrl['/fail']).toMatchObject({ status: 500, faulted: true, rulePattern: '/fail' });
  });

  it('answers a body-only rule with a 200 mock', async () => {
    storeRules([rule({ status: undefined, body: '{"items":[]}' })]);
    let body: unknown;
    await new Promise<void>((resolve) =>
      run(new HttpRequest('GET', '/api/products'), () => {
        throw new Error('the request should not reach the backend');
      }).subscribe({
        next: (event) => {
          if (event instanceof HttpResponse) body = event.body;
        },
        complete: resolve,
      }),
    );
    expect(body).toEqual({ items: [] });
    expect(httpRegistry().calls).toEqual([
      expect.objectContaining({ status: 200, mocked: true, faulted: false }),
    ]);
  });

  it('ignores a pattern-only rule', async () => {
    storeRules([rule({ status: undefined }), rule({ id: 'r2', status: 418 })]);
    await new Promise<void>((resolve) =>
      run(new HttpRequest('GET', '/api/products'), later([])).subscribe({
        error: () => resolve(),
        complete: resolve,
      }),
    );
    expect(httpRegistry().calls).toEqual([
      expect.objectContaining({ status: 418, faulted: true, ruleId: 'r2' }),
    ]);
  });

  it('counts the calls it drops at the limit', () => {
    vi.useFakeTimers();
    const registry = httpRegistry();
    registry.maxCalls = 10;
    delete registry.dropped;
    for (let i = 0; i < 12; i++) {
      run(new HttpRequest('GET', `/api/${i}`), later([])).subscribe();
      vi.advanceTimersByTime(10);
    }
    expect(registry.calls?.map((c) => c.url).slice(0, 2)).toEqual(['/api/2', '/api/3']);
    expect(registry.dropped).toBe(2);
    delete registry.maxCalls;
    delete registry.dropped;
  });

  it('counts a TransferState match as a cache hit once', async () => {
    document.body.innerHTML = stateScript(new HttpRequest('GET', '/api/products'));
    const get = () =>
      new Promise<void>((resolve) =>
        run(new HttpRequest('GET', '/api/products'), later([])).subscribe({
          complete: resolve,
        }),
      );
    await get();
    await get();
    expect(httpRegistry().calls?.map((c) => c.cacheHit)).toEqual([true, false]);
  });

  it('does not count a request with other params as a cache hit', async () => {
    const page = (n: number) =>
      new HttpRequest('GET', '/api/feed', null, {
        params: new HttpParams({ fromObject: { page: n } }),
      });
    document.body.innerHTML = stateScript(page(1));
    const get = (req: HttpRequest<unknown>) =>
      new Promise<void>((resolve) => run(req, later([])).subscribe({ complete: resolve }));
    await get(page(2));
    await get(page(1));
    expect(httpRegistry().calls?.map((c) => [c.url, c.cacheHit])).toEqual([
      ['/api/feed?page=2', false],
      ['/api/feed?page=1', true],
    ]);
  });

  it('does not tag a payload URL as a cache hit when Angular would skip the cache', async () => {
    document.body.innerHTML = stateScript(new HttpRequest('GET', '/api/trips'));
    const get = (req: HttpRequest<unknown>, via = run) =>
      new Promise<void>((resolve) => via(req, later([])).subscribe({ complete: resolve }));
    await get(
      new HttpRequest('GET', '/api/trips', null, {
        headers: new HttpHeaders({ Authorization: 'Bearer x' }),
      }),
    );
    await get(new HttpRequest('GET', '/api/trips', null, { transferCache: false }));
    await get(new HttpRequest('GET', '/api/trips', null, { withCredentials: true }));
    expect(httpRegistry().calls?.map((c) => c.cacheHit)).toEqual([false, false, false]);

    const stable = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ApplicationRef, useValue: { whenStable: () => Promise.resolve() } },
      ],
    });
    const runStable = (req: HttpRequest<unknown>, next: HttpHandlerFn) =>
      runInInjectionContext(stable, () => pangularHttpInterceptor(req, next));
    runStable(new HttpRequest('GET', '/other'), later([])).subscribe().unsubscribe();
    await Promise.resolve();
    await get(new HttpRequest('GET', '/api/trips'), runStable);
    expect(httpRegistry().calls?.at(-1)?.cacheHit).toBe(false);
    await get(new HttpRequest('GET', '/api/trips'));
    expect(httpRegistry().calls?.at(-1)?.cacheHit).toBe(true);
  });
});

describe('attachHttp', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sends the payload once, then again only when the server asks for it', async () => {
    const sent: Record<string, unknown>[] = [];
    let answer: unknown = { needPayload: false };
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report as Record<string, unknown>);
          if (name === 'get-http-rules') return [];
          return name === 'push-http' ? answer : undefined;
        },
        register: () => {},
      },
    };
    const http = attachHttp(my, 'p1');
    await http.push();
    httpRegistry().calls = [
      {
        id: 'c',
        url: '/a',
        method: 'GET',
        status: 200,
        durationMs: 1,
        side: 'client',
        cacheHit: false,
        faulted: false,
        at: 1,
      },
    ];
    answer = { needPayload: true };
    await http.push();
    answer = { needPayload: false };
    await http.push();
    expect(sent.map((r) => 'payload' in r)).toEqual([true, false, true]);
    expect(sent[0]).toMatchObject({ pageId: 'p1', initialUrl: '/' });
    expect(sent[0]['hydration']).toMatchObject({ warningsCaptured: false, mismatches: [] });
    httpRegistry().calls = [];
  });
});

describe('attachHttp pushes', () => {
  const call = (id: string) => ({
    id,
    url: `/api/${id}`,
    method: 'GET',
    status: 200,
    durationMs: 1,
    side: 'client' as const,
    cacheHit: false,
    faulted: false,
    at: 1,
  });

  afterEach(() => {
    vi.useRealTimers();
    httpRegistry().calls = [];
    delete httpRegistry().dropped;
  });

  it('sends only new calls, nothing while idle, then a ping', async () => {
    vi.useFakeTimers();
    const sent: { name: string; report: unknown }[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name !== 'get-http-rules') sent.push({ name, report });
          if (name === 'get-http-rules') return [];
          if (name === 'ping-http') return { known: true };
          return { needPayload: false };
        },
        register: () => {},
      },
    };
    httpRegistry().calls = [call('a'), call('b')];
    const http = attachHttp(my, 'p1');
    await http.push();
    httpRegistry().calls!.push(call('c'));
    await http.push();
    await http.push();
    vi.advanceTimersByTime(9000);
    await http.push();
    const ids = (entry: { report: unknown }) =>
      ((entry.report as { calls: { id: string }[] }).calls ?? []).map((c) => c.id);
    expect(sent.map((s) => s.name)).toEqual(['push-http', 'push-http', 'ping-http']);
    expect(sent[0].report).toMatchObject({ full: true });
    expect(ids(sent[0])).toEqual(['a', 'b']);
    expect(sent[1].report).toMatchObject({ full: false });
    expect(sent[1].report).not.toHaveProperty('payload');
    expect(ids(sent[1])).toEqual(['c']);
    expect(sent[2].report).toBe('p1');
  });

  it('resends everything when the server forgot the page', async () => {
    vi.useFakeTimers();
    const sent: Record<string, unknown>[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report as Record<string, unknown>);
          if (name === 'ping-http') return { known: false };
          return name === 'get-http-rules' ? [] : { needPayload: false };
        },
        register: () => {},
      },
    };
    httpRegistry().calls = [call('a')];
    const http = attachHttp(my, 'p1');
    await http.push();
    vi.advanceTimersByTime(9000);
    await http.push();
    await http.push();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ full: true, calls: [{ id: 'a' }] });
    expect(sent[1]).toHaveProperty('payload');
  });
});

describe('attachHttp redaction', () => {
  afterEach(() => {
    httpRegistry().calls = [];
    setRedaction();
  });

  it('redacts call URLs and errors before they leave the page', async () => {
    setRedaction({ secretNames: ['tenant'] });
    const sent: Record<string, unknown>[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report as Record<string, unknown>);
          return name === 'get-http-rules' ? [] : { needPayload: false };
        },
        register: () => {},
      },
    };
    httpRegistry().calls = [
      {
        id: 'c',
        url: '/api/me?api_key=k3y&tenant=acme',
        method: 'GET',
        status: 401,
        durationMs: 1,
        side: 'client',
        cacheHit: false,
        faulted: false,
        pageUrl: '/login?next=%2Fhome',
        at: 1,
        error: 'Http failure response for /api/me?api_key=k3y: 401 Unauthorized',
      },
    ];
    await attachHttp(my, 'p1').push();
    expect(sent[0]['calls']).toEqual([
      expect.objectContaining({
        url: '/api/me?api_key=[redacted]&tenant=[redacted]',
        pageUrl: '/login?next=%2Fhome',
        error: expect.not.stringContaining('k3y'),
      }),
    ]);
    expect(httpRegistry().calls?.[0].url).toBe('/api/me?api_key=k3y&tenant=acme');
  });
});

describe('hydration scanner', () => {
  it('reuses the DOM scan until the hydration counters change', async () => {
    const { createHydrationScanner } = await import('../http-overlay.ts');
    let calls = 0;
    const scanner = createHydrationScanner(() => {
      calls++;
      return { hydrated: 3, skipped: 0, mismatched: 0, mismatches: [] };
    });
    const counters = { hydratedNodes: 3 };
    for (let i = 0; i < 10; i++) scanner(counters);
    expect(calls).toBe(3);
    scanner({ hydratedNodes: 5 });
    expect(calls).toBe(4);
  });
});

describe('hydration warning capture', () => {
  const originals = { warn: console.warn, error: console.error };

  afterEach(() => {
    console.warn = originals.warn;
    console.error = originals.error;
    delete httpRegistry().warnings;
  });

  it('forwards arguments that cannot be turned into text', () => {
    const seen: unknown[][] = [];
    console.warn = (...args: unknown[]) => void seen.push(args);
    delete httpRegistry().warnings;
    createEnvironmentInjector([providePangularHttp()], Injector.NULL as EnvironmentInjector);
    const bare = Object.create(null);
    const throwing = {
      toString() {
        throw new Error('no text');
      },
    };
    expect(() => console.warn(bare)).not.toThrow();
    expect(() => console.warn('NG0500: During hydration', throwing)).not.toThrow();
    expect(seen).toEqual([[bare], ['NG0500: During hydration', throwing]]);
    expect(httpRegistry().warnings).toEqual(['NG0500: During hydration ']);
  });
});
