import '@angular/compiler';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { createHostContext } from 'devframe/node';
import {
  createApp,
  eventHandler,
  getRequestHeader,
  setResponseHeader,
  toNodeListener,
  toWebHandler,
} from 'h3';
import { Hono } from 'hono';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry } from '../http-rules.ts';
import { pangularSsrEventHandler, withPangularSsr } from '../ssr.ts';
import { renderModeOf } from '../ssr-trace.ts';
import { runInSsrRequest } from '../ssr-context.ts';
import type { SsrOverride } from '../ssr-overrides.ts';
import {
  ACTIVE_SSR_TTL_MS,
  SSR_REQUEST_HEADER,
  ssrRegistry,
  sweepActiveSsrRequests,
  type SsrRequest,
} from '../ssr-registry.ts';
import type { HttpState } from '../types.ts';

const HTML = '<html><body><app-root ng-version="22.1.0" ng-server-context="ssr"></app-root>';
const STATE_HTML =
  '<html><body><app-root ng-server-context="ssr"></app-root>' +
  '<script id="ng-state" type="application/json">{"a":{"b":1}}</script></body></html>';

const page = (url = '/destinations', accept = 'text/html', init: RequestInit = {}) =>
  new Request(`http://localhost${url}`, { ...init, headers: { accept, ...init.headers } });

const html = (body: string | null, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers },
  });

const override = (o: Partial<SsrOverride>): SsrOverride => ({
  id: 'o1',
  kind: 'state-edit',
  pattern: '/destinations',
  enabled: true,
  ...o,
});

describe('withPangularSsr', () => {
  const recorded: SsrRequest[] = [];
  beforeEach(() => {
    recorded.length = 0;
    ssrRegistry().record = (r) => recorded.push(r);
  });
  afterEach(() => {
    ssrRegistry().record = undefined;
    ssrRegistry().overrides = undefined;
    ssrRegistry().active.clear();
  });

  it('tags the request, merges Server-Timing and records the render once the body is read', async () => {
    let id = '';
    const handler = withPangularSsr(async (request: Request) => {
      id = request.headers.get(SSR_REQUEST_HEADER) ?? '';
      expect(ssrRegistry().active.get(id)).toMatchObject({ url: '/destinations?q=1' });
      return html(HTML, { headers: { 'server-timing': 'db;dur=5' } });
    });
    const response = await handler(page('/destinations?q=1'));
    expect(id).toMatch(/^[a-f0-9]{16}$/);
    expect(response!.headers.get('server-timing')).toMatch(
      new RegExp(`^db;dur=5, pangular;desc="${id}", render;dur=\\d+, fetch;desc="0 calls";dur=0$`),
    );
    // Nothing is recorded until the body has gone out.
    expect(recorded).toEqual([]);
    expect(await response!.text()).toBe(HTML);
    expect(recorded).toEqual([
      expect.objectContaining({
        id,
        method: 'GET',
        url: '/destinations?q=1',
        status: 200,
        renderMode: 'server',
        bytes: HTML.length,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ]);
    expect(ssrRegistry().active.size).toBe(0);
  });

  it('calls the handler with the same request when the http inspector is off', async () => {
    ssrRegistry().record = undefined;
    const sent = page();
    let seen: Request | undefined;
    const response = await withPangularSsr(async (request: Request) => {
      seen = request;
      return html(HTML);
    })(sent);
    expect(seen).toBe(sent);
    expect(response!.headers.has('server-timing')).toBe(false);
  });

  it('drops a forged id from requests it does not trace and records nothing', async () => {
    let header: string | null = 'unset';
    const handler = withPangularSsr(async (request: Request) => {
      header = request.headers.get(SSR_REQUEST_HEADER);
      return Response.json({ ok: true });
    });
    await handler(
      page('/api/trips', 'application/json', { headers: { [SSR_REQUEST_HEADER]: 'x' } }),
    );
    expect(header).toBeNull();
    await (await handler(page('/__devframes/'))).text();
    expect(recorded).toEqual([]);
  });

  it('passes a null answer through untraced', async () => {
    const response = await withPangularSsr(async () => null)(page());
    expect(response).toBeNull();
    expect(recorded).toEqual([]);
    expect(ssrRegistry().active.size).toBe(0);
  });

  it('records a handler that throws as a failed render and rethrows', async () => {
    const handler = withPangularSsr(async (): Promise<Response> => {
      throw new Error('render failed');
    });
    await expect(handler(page())).rejects.toThrow('render failed');
    expect(recorded[0]).toMatchObject({ status: 500, renderMode: 'not-rendered' });
  });

  it('adds Server-Timing to a redirect whose headers cannot change', async () => {
    const response = await withPangularSsr(async () =>
      Response.redirect('http://localhost/login', 302),
    )(page());
    expect(response!.status).toBe(302);
    expect(response!.headers.get('location')).toBe('http://localhost/login');
    expect(response!.headers.get('server-timing')).toContain('pangular;desc=');
    expect(recorded[0]).toMatchObject({ status: 302, renderMode: 'redirect' });
  });

  it('records an aborted render when the client stops reading', async () => {
    const response = await withPangularSsr(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(HTML));
        },
      });
      return html(stream as unknown as string);
    })(page());
    const reader = response!.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(recorded[0]).toMatchObject({ aborted: true, bytes: HTML.length });
  });

  it('keeps a slow stream that still sends chunks past the TTL, and expires it once idle', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      const encoder = new TextEncoder();
      let source!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          source = controller;
        },
      });
      const response = await withPangularSsr(async () => html(stream as unknown as string))(
        page('/slow'),
      );
      const reader = response!.body!.getReader();
      const chunkAt = async (at: number, text: string) => {
        vi.setSystemTime(at);
        source.enqueue(encoder.encode(text));
        expect(new TextDecoder().decode((await reader.read()).value)).toBe(text);
      };

      // A chunk every four minutes, so the stream runs well past five minutes in all.
      const step = ACTIVE_SSR_TTL_MS - 60_000;
      await chunkAt(1_000_000 + step, '<html>');
      await chunkAt(1_000_000 + 2 * step, '<body>');
      vi.setSystemTime(1_000_000 + 2 * step + ACTIVE_SSR_TTL_MS);
      sweepActiveSsrRequests();
      expect(ssrRegistry().active.size).toBe(1);
      expect(recorded).toEqual([]);

      // Five minutes and a moment with no chunk: the sweep ends it as aborted.
      vi.setSystemTime(1_000_000 + 2 * step + ACTIVE_SSR_TTL_MS + 1);
      sweepActiveSsrRequests();
      expect(ssrRegistry().active.size).toBe(0);
      expect(recorded).toMatchObject([{ url: '/slow', aborted: true, bytes: 12 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('expires a trace whose Response was dropped unread, and records it as aborted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      const dropped = await withPangularSsr(async () => html(HTML))(page('/dropped'));
      expect(dropped).toBeTruthy();
      expect(ssrRegistry().active.size).toBe(1);
      expect(recorded).toEqual([]);

      // Still in flight before the TTL.
      vi.setSystemTime(1_000_000 + ACTIVE_SSR_TTL_MS);
      sweepActiveSsrRequests();
      expect(ssrRegistry().active.size).toBe(1);

      vi.setSystemTime(1_000_000 + ACTIVE_SSR_TTL_MS + 1);
      const next = await withPangularSsr(async () => html(null, { status: 302 }))(page('/next'));
      expect(next!.status).toBe(302);
      expect(recorded.map((r) => [r.url, r.aborted ?? false])).toEqual([
        ['/dropped', true],
        ['/next', false],
      ]);
      expect(ssrRegistry().active.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('serves index.csr.html for a forced Client render without calling the handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangular-'));
    writeFileSync(
      join(dir, 'index.csr.html'),
      '<app-root></app-root><script src="main.js" type="module"></script>',
    );
    ssrRegistry().overrides = [override({ kind: 'client-render' })];
    let called = false;
    const response = await withPangularSsr(
      async () => {
        called = true;
        return html(HTML);
      },
      { browserDistFolder: dir },
    )(page());
    expect(called).toBe(false);
    expect(response!.headers.get('x-pangular-override')).toBe('client-render');
    expect(await response!.text()).toContain('<app-root></app-root>');
    expect(recorded[0]).toMatchObject({
      renderMode: 'client',
      overrides: [{ kind: 'client-render', applied: true }],
    });
  });

  it('renders normally and says why when the shell is missing', async () => {
    ssrRegistry().overrides = [override({ kind: 'client-render' })];
    await (await withPangularSsr(async () => html(HTML))(page()))!.text();
    expect(recorded[0].overrides).toEqual([
      expect.objectContaining({
        applied: false,
        note: 'no index.csr.html: pass browserDistFolder to withPangularSsr',
      }),
    ]);
  });

  it('edits the TransferState script, fixes content-length and drops the validators', async () => {
    ssrRegistry().overrides = [override({ key: 'a', value: '{"b":"longer value"}' })];
    let validator: string | null = 'unset';
    const response = await withPangularSsr(async (request: Request) => {
      validator = request.headers.get('if-none-match');
      return html(STATE_HTML, { headers: { etag: '"v1"', 'content-length': '10' } });
    })(page('/destinations', 'text/html', { headers: { 'if-none-match': '"v1"' } }));
    const body = await response!.text();
    expect(validator).toBeNull();
    expect(body).toContain('longer value');
    expect(response!.headers.get('content-length')).toBe(String(Buffer.byteLength(body)));
    expect(response!.headers.has('etag')).toBe(false);
    expect(response!.headers.get('x-pangular-override')).toBe('state-edit');
    expect(recorded[0].overrides).toEqual([
      expect.objectContaining({ kind: 'state-edit', applied: true, note: 'set a' }),
    ]);
  });

  it('leaves a compressed body alone and says where to wrap the handler', async () => {
    ssrRegistry().overrides = [override({ key: 'a', value: '1' })];
    const gzipped = new Uint8Array([31, 139, 8, 0]);
    const response = await withPangularSsr(async () =>
      html(gzipped as unknown as string, { headers: { 'content-encoding': 'gzip' } }),
    )(page());
    expect(new Uint8Array(await response!.arrayBuffer())).toEqual(gzipped);
    expect(recorded[0]).toMatchObject({
      compressedBeforeTrace: true,
      overrides: [{ applied: false, note: expect.stringContaining('inside any compression') }],
    });
  });
});

describe('withPangularSsr in real servers', () => {
  const recorded: SsrRequest[] = [];
  beforeEach(() => {
    recorded.length = 0;
    ssrRegistry().record = (r) => recorded.push(r);
  });
  afterEach(() => {
    ssrRegistry().record = undefined;
    ssrRegistry().active.clear();
  });

  it('traces a Hono app', async () => {
    const app = new Hono();
    let id: string | undefined;
    app.get('/api/*', (c) => c.json({ trips: [] }));
    app.get('*', (c) => {
      id = c.req.header(SSR_REQUEST_HEADER);
      return c.html(HTML);
    });
    const fetch = withPangularSsr(app.fetch);
    const response = await fetch(page('/trips'));
    expect(await response.text()).toBe(HTML);
    expect(response.headers.get('server-timing')).toContain(`pangular;desc="${id}"`);
    await (await fetch(page('/api/trips', 'application/json'))).text();
    expect(recorded.map((r) => [r.url, r.renderMode])).toEqual([['/trips', 'server']]);
  });

  it('traces an h3 app through its web handler', async () => {
    const app = createApp();
    app.use(
      eventHandler((event) => {
        setResponseHeader(event, 'content-type', 'text/html');
        return `${HTML}<!-- ${getRequestHeader(event, SSR_REQUEST_HEADER)} -->`;
      }),
    );
    const response = await withPangularSsr(toWebHandler(app))(page('/trips'));
    const body = await response.text();
    expect(body).toContain(`<!-- ${recorded[0]?.id} -->`);
    expect(recorded[0]).toMatchObject({ url: '/trips', renderMode: 'server' });
  });

  it('traces a Node render behind an h3 middleware, as in Analog', async () => {
    const app = createApp();
    const trace = pangularSsrEventHandler();
    app.use(eventHandler((event) => trace(event)));
    app.use(
      eventHandler((event) => {
        setResponseHeader(event, 'content-type', 'text/html');
        return HTML.replace('ng-server-context="ssr"', 'ng-server-context="ssr-analog"');
      }),
    );
    const server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/blog`, {
        headers: { accept: 'text/html' },
      });
      await response.text();
      expect(response.headers.get('server-timing')).toContain('pangular;desc=');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(recorded[0]).toMatchObject({ url: '/blog', renderMode: 'server' });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('render mode', () => {
  it('reads an Analog server render as Server', () => {
    expect(renderModeOf('<app-root ng-server-context="ssr-analog"></app-root>')).toBe('server');
  });
});

describe('server calls without an Angular REQUEST', () => {
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

  const run = (requestId?: string, injector = serverInjector()) => {
    const call = () =>
      runInInjectionContext(injector, () =>
        pangularHttpInterceptor(new HttpRequest('GET', 'http://localhost/api/posts'), () =>
          of(new HttpResponse({ status: 200, body: [] }) as HttpEvent<unknown>),
        ),
      ).subscribe();
    if (requestId) runInSsrRequest(requestId, call);
    else call();
    return httpRegistry().calls!.at(-1)!;
  };
  const serverInjector = () =>
    Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });

  it('counts a server call as activity on the trace', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000_000);
      ssrRegistry().active.set('abc123', {
        fetches: 0,
        fetchMs: 0,
        url: '/blog',
        startedAt: 1_000_000,
      });
      vi.setSystemTime(1_000_000 + ACTIVE_SSR_TTL_MS - 1);
      expect(run('abc123')).toMatchObject({ requestId: 'abc123' });
      // Past the TTL since the start, but not since the call.
      vi.setSystemTime(1_000_000 + 2 * ACTIVE_SSR_TTL_MS - 2);
      sweepActiveSsrRequests();
      expect(ssrRegistry().active.has('abc123')).toBe(true);
      vi.setSystemTime(1_000_000 + 2 * ACTIVE_SSR_TTL_MS);
      sweepActiveSsrRequests();
      expect(ssrRegistry().active.has('abc123')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('links a call to the traced request it runs under', () => {
    ssrRegistry().active.set('abc123', { fetches: 0, fetchMs: 0, url: '/blog' });
    ssrRegistry().active.set('def456', { fetches: 0, fetchMs: 0, url: '/about' });
    expect(run('abc123')).toMatchObject({ requestId: 'abc123', pageUrl: '/blog' });
    expect(run('def456')).toMatchObject({ requestId: 'def456', pageUrl: '/about' });
    expect(ssrRegistry().active.get('abc123')!.fetches).toBe(1);
    expect(ssrRegistry().active.get('def456')!.fetches).toBe(1);
  });

  it('links nothing to a request that is no longer in flight', () => {
    ssrRegistry().active.set('def456', { fetches: 0, fetchMs: 0, url: '/about' });
    expect(run('abc123')).not.toHaveProperty('requestId');
  });

  it('links nothing outside a traced request, even with one in flight', () => {
    ssrRegistry().active.set('abc123', { fetches: 0, fetchMs: 0, url: '/blog' });
    expect(run()).not.toHaveProperty('requestId');
    expect(run()).toMatchObject({ pageUrl: undefined });
  });

  it('keeps an app on the request it first ran under, when a later call loses the context', () => {
    ssrRegistry().active.set('abc123', { fetches: 0, fetchMs: 0, url: '/blog' });
    ssrRegistry().active.set('def456', { fetches: 0, fetchMs: 0, url: '/about' });
    const app = serverInjector();
    expect(run('abc123', app)).toMatchObject({ requestId: 'abc123' });
    // A zone.js microtask, for one, can run the call under another request's context.
    expect(run('def456', app)).toMatchObject({ requestId: 'abc123' });
    expect(run(undefined, app)).toMatchObject({ requestId: 'abc123' });
  });
});

describe('withPangularSsr with the devframe server', () => {
  afterEach(() => httpRegistry().dispose?.());

  it('shows a traced render in the shared state and the SSR tools', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    await (await withPangularSsr(async () => html(HTML))(page('/trips')))!.text();
    const state = (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get('pangular:http')
    ).value() as HttpState;
    expect(state.requests.map((r) => r.url)).toEqual(['/trips']);
    const text = (await ctx.agent.invoke('pangular:list-ssr-requests', {})) as string;
    expect(text).toContain('/trips');
  });
});
