import '@angular/compiler';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { createApp, eventHandler, setResponseHeader, toNodeListener } from 'h3';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry, type HttpCall } from '../http-rules.ts';
import { pangularSsrEventHandler, pangularSsrMiddleware, withPangularSsr } from '../ssr.ts';
import { ssrRegistry, type SsrRequest } from '../ssr-registry.ts';

const HTML = '<html><body><app-root ng-server-context="ssr-analog"></app-root></body></html>';

/** A server HttpClient call made the way an Analog render makes it: no Angular `REQUEST`. */
function serverCall(path: string, injector = serverInjector()): HttpCall {
  runInInjectionContext(injector, () =>
    pangularHttpInterceptor(new HttpRequest('GET', `http://localhost${path}`), () =>
      of(new HttpResponse({ status: 200, body: [] }) as HttpEvent<unknown>),
    ),
  ).subscribe();
  return callTo(path);
}

function callTo(path: string): HttpCall {
  return httpRegistry().calls!.find((call) => call.url === `http://localhost${path}`)!;
}

function serverInjector() {
  return Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
}

/** Resolves once `count` renders have reached it, so they all overlap. */
function barrier(count: number) {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  let waiting = 0;
  return () => {
    if (++waiting === count) open();
    return opened;
  };
}

function timingId(response: Response): string | undefined {
  return /pangular;desc="([a-f0-9]+)"/.exec(response.headers.get('server-timing') ?? '')?.[1];
}

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    get: (path: string, accept: string) =>
      fetch(`http://127.0.0.1:${port}${path}`, { headers: { accept } }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('server calls of overlapping renders', () => {
  const g = globalThis as { ngDevMode?: unknown };
  const recorded: SsrRequest[] = [];
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
    recorded.length = 0;
    httpRegistry().calls = [];
    ssrRegistry().record = (request) => recorded.push(request);
  });
  afterEach(() => {
    g.ngDevMode = saved;
    ssrRegistry().record = undefined;
    ssrRegistry().active.clear();
  });

  /** An Analog-style h3 app: the tracer as a server middleware, then a render without `REQUEST`. */
  function analogApp(renders: number) {
    const app = createApp();
    const trace = pangularSsrEventHandler();
    const overlap = barrier(renders);
    app.use(eventHandler((event) => trace(event)));
    app.use(
      eventHandler(async (event) => {
        await overlap();
        serverCall(`/api${event.path}`);
        setResponseHeader(event, 'content-type', 'text/html');
        return HTML;
      }),
    );
    return listen(toNodeListener(app));
  }

  it('does not link an untraced render to a traced one running at the same time', async () => {
    const server = await analogApp(2);
    try {
      const [traced, untraced] = await Promise.all([
        server.get('/blog', 'text/html'),
        server.get('/feed', '*/*'),
      ]);
      await Promise.all([traced.text(), untraced.text()]);
      const id = timingId(traced);
      expect(id).toBeDefined();
      expect(timingId(untraced)).toBeUndefined();
      expect(callTo('/api/blog')).toMatchObject({ requestId: id, pageUrl: '/blog' });
      expect(callTo('/api/feed')).not.toHaveProperty('requestId');
      expect(callTo('/api/feed').pageUrl).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it('links each of two traced renders running at the same time to its own request', async () => {
    const server = await analogApp(2);
    try {
      const [blog, about] = await Promise.all([
        server.get('/blog', 'text/html'),
        server.get('/about', 'text/html'),
      ]);
      await Promise.all([blog.text(), about.text()]);
      expect(callTo('/api/blog')).toMatchObject({ requestId: timingId(blog) });
      expect(callTo('/api/about')).toMatchObject({ requestId: timingId(about) });
      expect(timingId(blog)).not.toBe(timingId(about));
      // The calls finished before the headers went out, so each render counts its own.
      expect(blog.headers.get('server-timing')).toContain('fetch;desc="1 calls"');
      expect(about.headers.get('server-timing')).toContain('fetch;desc="1 calls"');
    } finally {
      await server.close();
    }
  });

  it('links calls through the Node tracer for servers without Angular REQUEST', async () => {
    const trace = pangularSsrMiddleware();
    const overlap = barrier(2);
    const server = await listen((req, res) =>
      trace(req, res, async () => {
        await overlap();
        serverCall(`/api${req.url}`);
        res.setHeader('content-type', 'text/html');
        res.end(HTML);
      }),
    );
    try {
      const [traced, untraced] = await Promise.all([
        server.get('/trips', 'text/html'),
        server.get('/robots', 'text/plain'),
      ]);
      await Promise.all([traced.text(), untraced.text()]);
      expect(callTo('/api/trips')).toMatchObject({ requestId: timingId(traced) });
      expect(callTo('/api/robots')).not.toHaveProperty('requestId');
    } finally {
      await server.close();
    }
  });

  it('links calls of overlapping web-standard renders to their own request only', async () => {
    const overlap = barrier(3);
    const render = withPangularSsr(async (request: Request) => {
      await overlap();
      serverCall(`/api${new URL(request.url).pathname}`);
      return new Response(HTML, { headers: { 'content-type': 'text/html' } });
    });
    const get = (path: string, accept: string) =>
      render(new Request(`http://localhost${path}`, { headers: { accept } }));
    const [trips, hotels, feed] = await Promise.all([
      get('/trips', 'text/html'),
      get('/hotels', 'text/html'),
      get('/feed', 'application/json'),
    ]);
    await Promise.all([trips.text(), hotels.text(), feed.text()]);
    expect(callTo('/api/trips')).toMatchObject({ requestId: timingId(trips) });
    expect(callTo('/api/hotels')).toMatchObject({ requestId: timingId(hotels) });
    expect(callTo('/api/feed')).not.toHaveProperty('requestId');
  });

  it('links a render that runs without any tracer to nothing, even with one trace in flight', async () => {
    let finish!: () => void;
    const pending = withPangularSsr(
      () =>
        new Promise<Response>((resolve) => {
          finish = () => resolve(new Response(HTML, { headers: { 'content-type': 'text/html' } }));
        }),
    )(new Request('http://localhost/slow', { headers: { accept: 'text/html' } }));
    await Promise.resolve();
    expect(ssrRegistry().active.size).toBe(1);
    expect(serverCall('/api/elsewhere')).not.toHaveProperty('requestId');
    finish();
    await (await pending).text();
  });
});
