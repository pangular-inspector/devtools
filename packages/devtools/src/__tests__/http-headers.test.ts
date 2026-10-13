// @vitest-environment jsdom
import '@angular/compiler';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import {
  HttpErrorResponse,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
} from '@angular/common/http';
import { createHostContext } from 'devframe/node';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { setRedaction } from '../forms-privacy.ts';
import { pangularHttpInterceptor } from '../http.ts';
import {
  MAX_HEADERS,
  captureHeaders,
  readHeaders,
  sanitizeHeaders,
  withCapturedHeaders,
  type HeaderSource,
} from '../http-headers.ts';
import { attachHttp } from '../http-overlay.ts';
import { redactCall, redactHeaders } from '../http-redact.ts';
import { httpRegistry, sanitizeCalls, type HttpCall } from '../http-rules.ts';
import { listHttpCallsText } from '../rpc/http-tools.ts';
import { httpWaterfallText, waterfallGroups } from '../rpc/http-waterfall.ts';
import type { HttpPage } from '../types.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

const call = (overrides: Partial<HttpCall> = {}): HttpCall => ({
  id: 'c1',
  url: '/api/trips',
  method: 'GET',
  status: 200,
  durationMs: 40,
  side: 'client',
  cacheHit: false,
  faulted: false,
  at: 1000,
  pageUrl: '/trips',
  ...overrides,
});

const page = (calls: HttpCall[], overrides: Partial<HttpPage> = {}): HttpPage => ({
  pageId: 'p1',
  url: '/trips',
  initialUrl: '/trips',
  title: 'Trips',
  hydration: null,
  calls,
  firstSeenAt: 900,
  reportedAt: 5000,
  ...overrides,
});

describe('header capture in the interceptor', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
    httpRegistry().calls = [];
  });
  afterEach(() => {
    g.ngDevMode = saved;
    httpRegistry().calls = [];
  });

  const run = (req: HttpRequest<unknown>, answer: () => Observable<HttpEvent<unknown>>) => {
    const injector = Injector.create({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    runInInjectionContext(injector, () => pangularHttpInterceptor(req, answer)).subscribe({
      error: () => {},
    });
    return httpRegistry().calls!.at(-1)!;
  };

  it('keeps only a reference until the call is reported', () => {
    let reads = 0;
    const headers = new HttpHeaders({ accept: 'application/json' });
    const keys = headers.keys.bind(headers);
    headers.keys = () => {
      reads++;
      return keys();
    };
    const recorded = run(new HttpRequest('GET', '/api/trips', { headers }), () =>
      of(new HttpResponse({ status: 200, body: [], headers: new HttpHeaders({ etag: '"1"' }) })),
    );
    expect(recorded).not.toHaveProperty('requestHeaders');
    expect(reads).toBe(0);
    const reported = withCapturedHeaders(recorded);
    expect(reported.requestHeaders).toEqual({ accept: 'application/json' });
    expect(reported.responseHeaders).toEqual({ etag: '"1"' });
    // Read once, however often the call is reported.
    withCapturedHeaders(recorded);
    expect(reads).toBe(1);
  });

  it('captures the headers of an error response', () => {
    const recorded = run(new HttpRequest('GET', '/api/trips'), () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            headers: new HttpHeaders({ 'retry-after': '30' }),
          }),
      ),
    );
    expect(withCapturedHeaders(recorded).responseHeaders).toEqual({ 'retry-after': '30' });
  });

  it('reads the headers right away when the devframe server records server calls', () => {
    const seen: HttpCall[] = [];
    httpRegistry().record = (c) => seen.push(c);
    try {
      const injector = Injector.create({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });
      runInInjectionContext(injector, () =>
        pangularHttpInterceptor(
          new HttpRequest('GET', 'http://api/trips', {
            headers: new HttpHeaders({ 'x-request-id': '42' }),
          }),
          () => of(new HttpResponse({ status: 200, body: [] }) as HttpEvent<unknown>),
        ),
      ).subscribe();
    } finally {
      httpRegistry().record = undefined;
    }
    expect(seen[0].requestHeaders).toEqual({ 'x-request-id': '42' });
  });
});

describe('readHeaders and sanitizeHeaders', () => {
  it('joins repeated values, lowercases names and caps the count', () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < MAX_HEADERS + 5; i++) many[`X-Item-${i}`] = String(i);
    const read = readHeaders(new HttpHeaders(many))!;
    expect(Object.keys(read)).toHaveLength(MAX_HEADERS);
    expect(read['x-item-0']).toBe('0');
    expect(readHeaders(new HttpHeaders().append('Vary', 'a').append('vary', 'b'))).toEqual({
      vary: 'a, b',
    });
  });

  it('leaves out a headers object that throws', () => {
    const broken: HeaderSource = {
      keys: () => {
        throw new Error('nope');
      },
      getAll: () => null,
    };
    expect(readHeaders(broken)).toBeUndefined();
  });

  it('drops values that are not strings and names that are not header names', () => {
    expect(sanitizeHeaders({ Accept: 'x', 'bad name': 'y', count: 3 })).toEqual({ accept: 'x' });
    expect(sanitizeHeaders(['a'])).toBeUndefined();
    expect(
      sanitizeCalls([{ ...call(), requestHeaders: { accept: 'x' }, responseHeaders: 'no' }]),
    ).toEqual([expect.objectContaining({ requestHeaders: { accept: 'x' } })]);
  });
});

describe('redactHeaders', () => {
  afterEach(() => setRedaction());

  it('masks credentials, cookies, secret names, JWTs and bearer tokens', () => {
    setRedaction({ secretNames: ['tenant'], unmask: ['authorization', 'cookie'] });
    const out = redactHeaders({
      Authorization: 'Basic dXNlcjpwYXNz',
      'Proxy-Authorization': 'Digest x',
      Cookie: 'sid=1',
      'Set-Cookie': 'sid=1; HttpOnly',
      'X-Api-Key': 'abc123',
      'X-Tenant': 'acme',
      'X-Forwarded-Auth': `Bearer ${JWT}`,
      'X-Trace': `id=${JWT}`,
      accept: 'application/json',
    });
    expect(out).toEqual({
      authorization: '[redacted]',
      'proxy-authorization': '[redacted]',
      cookie: '[redacted]',
      'set-cookie': '[redacted]',
      'x-api-key': '[redacted]',
      'x-tenant': '[redacted]',
      'x-forwarded-auth': 'Bearer [redacted]',
      'x-trace': 'id=[redacted]',
      accept: 'application/json',
    });
    expect(JSON.stringify(out)).not.toContain(JWT);
  });

  it('runs in redactCall, so every path that redacts a call masks its headers', () => {
    const out = redactCall(
      call({
        requestHeaders: { authorization: 'Bearer x' },
        responseHeaders: { 'set-cookie': 'a' },
      }),
    );
    expect(out.requestHeaders).toEqual({ authorization: '[redacted]' });
    expect(out.responseHeaders).toEqual({ 'set-cookie': '[redacted]' });
  });
});

describe('attachHttp headers', () => {
  afterEach(() => {
    httpRegistry().calls = [];
  });

  it('reads and masks the headers when it pushes a call', async () => {
    const sent: { calls: HttpCall[] }[] = [];
    const my = {
      rpc: {
        call: async (name: string, report?: unknown) => {
          if (name === 'push-http') sent.push(report as { calls: HttpCall[] });
          return name === 'get-http-rules' ? [] : undefined;
        },
        register: () => {},
      },
    };
    const recorded = call();
    captureHeaders(
      recorded,
      new HttpHeaders({ authorization: `Bearer ${JWT}`, accept: 'application/json' }),
      new HttpHeaders({ 'set-cookie': 'sid=1', 'content-type': 'application/json' }),
    );
    httpRegistry().calls = [recorded];
    await attachHttp(my, 'p1').push();
    expect(sent[0].calls[0].requestHeaders).toEqual({
      authorization: '[redacted]',
      accept: 'application/json',
    });
    expect(sent[0].calls[0].responseHeaders).toEqual({
      'set-cookie': '[redacted]',
      'content-type': 'application/json',
    });
    expect(JSON.stringify(sent)).not.toContain(JWT);
  });
});

describe('waterfallGroups', () => {
  it('groups client calls by navigation in start order with offsets and spans', () => {
    const groups = waterfallGroups([
      call({ id: 'b', at: 1100, durationMs: 50 }),
      call({ id: 'a', at: 1000, durationMs: 300 }),
      call({ id: 's', side: 'server', at: 900 }),
      call({ id: 'c', at: 5000, durationMs: 20, pageUrl: '/trips/7' }),
      call({ id: 'd', at: 6000, durationMs: 10, pageUrl: '/trips' }),
    ]);
    expect(
      groups.map((g) => [g.url, g.spanMs, g.calls.map((c) => [c.call.id, c.offsetMs])]),
    ).toEqual([
      [
        '/trips',
        300,
        [
          ['a', 0],
          ['b', 100],
        ],
      ],
      ['/trips/7', 20, [['c', 0]]],
      ['/trips', 10, [['d', 0]]],
    ]);
  });
});

describe('http-waterfall text', () => {
  const state = {
    pages: [
      page([
        call({ id: 'a', at: 1000, durationMs: 200 }),
        call({ id: 'b', at: 1100, durationMs: 100, url: '/api/trips?token=abc123', status: 500 }),
        call({
          id: 'c',
          at: 3000,
          durationMs: 30,
          pageUrl: '/trips/7',
          url: '/api/trips/7',
          requestHeaders: { authorization: 'Bearer abc' },
          responseHeaders: { 'x-cache': 'HIT' },
        }),
      ]),
    ],
  };

  it('shows the newest navigation first with offsets, durations and bars', () => {
    const text = httpWaterfallText(state, {}, 10_000);
    expect(text.indexOf('`/trips/7`')).toBeLessThan(text.indexOf('### `/trips`'));
    expect(text).toContain(
      '| +100 ms | 100 ms | GET `/api/trips?token=[redacted]` | 500 (failed) |',
    );
    expect(text).toContain('`............############`');
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('#### Headers');
  });

  it('adds masked headers when asked and limits the navigations', () => {
    const text = httpWaterfallText(state, { headers: true, limit: 1 }, 10_000);
    expect(text).toContain('showing 1, raise `limit` for more');
    expect(text).toContain('- `authorization`: `[redacted]`');
    expect(text).toContain('- `x-cache`: `HIT`');
    expect(text).not.toContain('Bearer abc');
  });

  it('explains an empty state and an unknown page', () => {
    expect(httpWaterfallText({ pages: [] })).toContain('No page reports HTTP calls');
    expect(httpWaterfallText({ pages: [page([])] })).toContain('has made no HttpClient calls');
    expect(httpWaterfallText(state, { page: 'nope' })).toContain('p1');
  });
});

describe('list-http-calls headers', () => {
  it('adds each listed call’s masked headers only when asked', () => {
    const state = {
      serverCalls: [],
      pages: [page([call({ requestHeaders: { cookie: 'sid=1', accept: 'text/plain' } })])],
    };
    expect(listHttpCallsText(state, {}, 10_000)).not.toContain('### Headers');
    const text = listHttpCallsText(state, { headers: true }, 10_000);
    expect(text).toContain('### Headers');
    expect(text).toContain('- `cookie`: `[redacted]`');
    expect(text).toContain('- Response headers: none recorded');
  });
});

describe('http-waterfall tool', () => {
  afterEach(() => httpRegistry().dispose?.());

  async function boot(config?: Parameters<typeof createPangular>[0]) {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await (config ? createPangular(config) : pangular).setup(ctx as never);
    return ctx;
  }

  it('answers from the calls a page pushed, with headers masked again on the server', async () => {
    const ctx = await boot();
    await ctx.rpc.invokeLocal(
      'pangular:push-http' as never,
      ...([
        {
          pageId: 'p1',
          url: '/trips',
          initialUrl: '/trips',
          title: 'Trips',
          hydration: null,
          full: true,
          calls: [call({ requestHeaders: { authorization: 'Token abcdef123456' } })],
          payload: { found: false, size: 0, entries: [] },
        },
      ] as never),
    );
    const { markdown } = (await ctx.agent.invoke('pangular:http-waterfall', {
      headers: true,
    })) as { markdown: string };
    expect(markdown).toContain('GET `/api/trips`');
    expect(markdown).toContain('- `authorization`: `[redacted]`');
    expect(markdown).not.toContain('abcdef123456');
  });

  it('is hidden with the http inspector', async () => {
    const ctx = await boot({ inspectors: { http: false } });
    expect(ctx.agent.list().tools.some((t) => t.id === 'pangular:http-waterfall')).toBe(false);
  });
});
