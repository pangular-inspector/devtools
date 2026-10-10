import '@angular/compiler';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injector, PLATFORM_ID, REQUEST, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { createHostContext } from 'devframe/node';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry, type HttpCall } from '../http-rules.ts';
import { createSsrMiddleware, renderModeOf } from '../ssr-middleware.ts';
import { SSR_REQUEST_HEADER, ssrRegistry, type SsrRequest } from '../ssr-registry.ts';
import { explainSsrRequestText, sanitizeSsrRequest, ssrRequestStory } from '../rpc/ssr-tools.ts';
import type { HttpPage, HttpState } from '../types.ts';

class FakeResponse extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  writableFinished = false;
  sentHeaders: Record<string, unknown> = {};
  body = '';
  private headers: Record<string, unknown> = {};
  setHeader(name: string, value: unknown) {
    this.headers[name.toLowerCase()] = value;
  }
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  writeHead(status: number, headers?: Record<string, unknown>) {
    this.statusCode = status;
    this.sentHeaders = { ...this.headers, ...headers };
    this.headersSent = true;
    return this;
  }
  write(chunk: string) {
    if (!this.headersSent) this.writeHead(this.statusCode);
    this.body += chunk;
    return true;
  }
  end(chunk?: string) {
    if (!this.headersSent) this.writeHead(this.statusCode);
    if (chunk) this.body += chunk;
    this.writableFinished = true;
    this.emit('finish');
    this.emit('close');
    return this;
  }
}

function request(url = '/destinations', accept = 'text/html') {
  return { method: 'GET', url, headers: { accept } } as unknown as IncomingMessage;
}

const HTML = '<html><body><app-root ng-version="22.1.0" ng-server-context="ssr"></app-root>';

describe('ssrMiddleware', () => {
  const recorded: SsrRequest[] = [];
  beforeEach(() => {
    recorded.length = 0;
    ssrRegistry().record = (r) => recorded.push(r);
  });
  afterEach(() => {
    ssrRegistry().record = undefined;
    ssrRegistry().active.clear();
  });

  it('tags the request, adds Server-Timing and records the render', () => {
    const middleware = createSsrMiddleware({ skip: ['/__devframes/'] });
    const req = request();
    const res = new FakeResponse();
    let id = '';
    middleware(req, res as unknown as ServerResponse, () => {
      id = req.headers[SSR_REQUEST_HEADER] as string;
      expect(ssrRegistry().active.has(id)).toBe(true);
    });
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.write(HTML);
    res.end('</body></html>');

    expect(id).toMatch(/^[a-f0-9]{16}$/);
    expect(res.sentHeaders['server-timing']).toContain(`pangular;desc="${id}"`);
    expect(res.sentHeaders['server-timing']).toMatch(/render;dur=\d+/);
    expect(recorded).toEqual([
      expect.objectContaining({
        id,
        url: '/destinations',
        status: 200,
        renderMode: 'server',
        bytes: HTML.length + '</body></html>'.length,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ]);
    expect(ssrRegistry().active.size).toBe(0);
  });

  it('merges with a Server-Timing value passed to writeHead', () => {
    const middleware = createSsrMiddleware();
    const res = new FakeResponse();
    middleware(request(), res as unknown as ServerResponse, () => {});
    res.writeHead(200, { 'server-timing': 'db;dur=5', 'content-type': 'text/html' });
    res.end(HTML);
    expect(res.sentHeaders['server-timing']).toMatch(/^db;dur=5, pangular;desc="/);
  });

  it('skips non-HTML requests, hub paths and when the http inspector is off', () => {
    const middleware = createSsrMiddleware({ skip: ['/__devframes/'] });
    const passed: string[] = [];
    for (const req of [
      request('/api/products', 'application/json'),
      request('/__devframes/pangular/', 'text/html'),
    ]) {
      middleware(req, new FakeResponse() as unknown as ServerResponse, () => passed.push(req.url!));
      expect(req.headers[SSR_REQUEST_HEADER]).toBeUndefined();
    }
    ssrRegistry().record = undefined;
    const req = request();
    middleware(req, new FakeResponse() as unknown as ServerResponse, () => passed.push(req.url!));
    expect(req.headers[SSR_REQUEST_HEADER]).toBeUndefined();
    expect(passed).toHaveLength(3);
  });

  it('ignores HTML-accepting requests answered with something else', () => {
    const middleware = createSsrMiddleware();
    const res = new FakeResponse();
    middleware(request('/logo.png'), res as unknown as ServerResponse, () => {});
    res.setHeader('content-type', 'image/png');
    res.end('png');
    expect(recorded).toEqual([]);
  });

  it('reads the render mode from ng-server-context', () => {
    expect(renderModeOf(HTML)).toBe('server');
    expect(renderModeOf('<app-root ng-server-context="ssg">')).toBe('prerender');
    expect(renderModeOf('<html><app-root></app-root></html>')).toBe('client');
  });
});

describe('interceptor request id', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
    httpRegistry().calls = [];
  });
  afterEach(() => {
    g.ngDevMode = saved;
    ssrRegistry().active.clear();
  });

  const run = (header: string | undefined) => {
    const headers = new Headers(header ? { [SSR_REQUEST_HEADER]: header } : {});
    const injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: new Request('http://localhost/destinations', { headers }) },
      ],
    });
    runInInjectionContext(injector, () =>
      pangularHttpInterceptor(new HttpRequest('GET', 'http://localhost/api/products'), () =>
        of(new HttpResponse({ status: 200, body: [] }) as HttpEvent<unknown>),
      ),
    ).subscribe();
    return httpRegistry().calls!.at(-1)!;
  };

  it('tags server calls with the active request id and counts them', () => {
    ssrRegistry().active.set('abc123', { fetches: 0, fetchMs: 0 });
    expect(run('abc123')).toMatchObject({ side: 'server', requestId: 'abc123' });
    expect(ssrRegistry().active.get('abc123')!.fetches).toBe(1);
  });

  it('ignores an id that the middleware did not hand out', () => {
    expect(run('forged')).not.toHaveProperty('requestId');
  });
});

const ssrRequest = (overrides: Partial<SsrRequest> = {}): SsrRequest => ({
  id: 'r1',
  method: 'GET',
  url: '/destinations',
  status: 200,
  at: 1000,
  durationMs: 40,
  renderMs: 35,
  bytes: 2048,
  renderMode: 'server',
  fetches: 2,
  fetchMs: 20,
  headers: {},
  ...overrides,
});

const httpCall = (overrides: Partial<HttpCall>): HttpCall => ({
  id: 'c',
  url: 'http://localhost/api/products',
  method: 'GET',
  status: 200,
  durationMs: 10,
  side: 'server',
  cacheHit: false,
  faulted: false,
  at: 1001,
  ...overrides,
});

const page = (overrides: Partial<HttpPage> = {}): HttpPage => ({
  pageId: 'p1',
  url: '/destinations',
  initialUrl: '/destinations',
  title: 'Destinations',
  hydration: null,
  calls: [],
  ssrRequestId: 'r1',
  firstSeenAt: 1100,
  reportedAt: 1100,
  ...overrides,
});

describe('ssrRequestStory', () => {
  it('links the server calls and the page, and finds browser refetches', () => {
    const server = [
      httpCall({ id: 's1', requestId: 'r1' }),
      httpCall({ id: 's2', requestId: 'r1', method: 'POST', url: 'http://localhost/api/quote' }),
      httpCall({ id: 's3', requestId: 'other' }),
    ];
    const pages = [
      page({
        calls: [
          httpCall({ id: 'c1', side: 'client', url: '/api/products', cacheHit: true, at: 1200 }),
          httpCall({ id: 'c2', side: 'client', url: '/api/quote', method: 'POST', at: 1200 }),
        ],
      }),
    ];
    const story = ssrRequestStory(ssrRequest(), server, pages);
    expect(story.serverCalls.map((c) => c.id)).toEqual(['s1', 's2']);
    expect(story.page?.pageId).toBe('p1');
    expect(story.refetched.map((c) => c.id)).toEqual(['c2']);
    const text = explainSsrRequestText([ssrRequest()], server, pages, {});
    expect(text).toContain('1 call ran again in the browser');
    expect(text).toContain('POST `/api/quote`');
  });

  it('explains an unknown id and an empty list', () => {
    expect(explainSsrRequestText([], [], [], {})).toContain('devtools.ssrMiddleware');
    expect(explainSsrRequestText([ssrRequest()], [], [], { id: 'nope' })).toContain(
      'list-ssr-requests',
    );
  });

  it('redacts secrets in recorded URLs and drops unknown headers', () => {
    const clean = sanitizeSsrRequest(
      ssrRequest({
        url: '/reset?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc',
        headers: { 'set-cookie': 'session=1', 'content-type': 'text/html' },
      }),
    );
    expect(clean?.url).not.toContain('eyJhbGci');
    expect(clean?.headers).toEqual({ 'content-type': 'text/html' });
    expect(sanitizeSsrRequest({ ...ssrRequest(), id: '<bad>' })).toBeUndefined();
  });
});

describe('devframe SSR requests', () => {
  async function boot(config?: PangularConfig) {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await (config ? createPangular(config) : pangular).setup(ctx as never);
    const state = async () =>
      (
        await (
          ctx.rpc as unknown as {
            sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
          }
        ).sharedState.get('pangular:http')
      ).value() as HttpState;
    const tool = (id: string, args: Record<string, unknown> = {}) =>
      ctx.agent.list().tools.some((t) => t.id === `pangular:${id}`)
        ? (ctx.agent.invoke(`pangular:${id}`, args) as Promise<{ markdown: string }>)
        : undefined;
    const push = (payload: unknown) =>
      ctx.rpc.invokeLocal('pangular:push-http' as never, ...([payload] as never));
    return { state, tool, push };
  }

  afterEach(() => httpRegistry().dispose?.());

  it('stores recorded requests, links the page and answers the tools', async () => {
    const { state, tool, push } = await boot();
    ssrRegistry().record!(ssrRequest());
    await push({
      pageId: 'p1',
      url: '/destinations',
      initialUrl: '/destinations',
      title: 'Destinations',
      hydration: null,
      calls: [],
      ssrRequestId: 'r1',
      payload: { found: false, size: 0, entries: [] },
    });
    const snapshot = await state();
    expect(snapshot.requests.map((r) => r.id)).toEqual(['r1']);
    expect(snapshot.pages[0].ssrRequestId).toBe('r1');
    expect((await tool('list-ssr-requests'))!.markdown).toMatch(/\| `r1` \|.*\| yes \|/);
    expect((await tool('explain-ssr-request', { id: 'r1' }))!.markdown).toContain('Page `p1`');
  });

  it('records nothing and hides the tools when the http inspector is off', async () => {
    const { tool } = await boot({ inspectors: { http: false } });
    expect(ssrRegistry().record).toBeUndefined();
    expect(tool('list-ssr-requests')).toBeUndefined();
  });
});
