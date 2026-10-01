import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analogMiddleware,
  classify,
  clearCalls,
  duplicateLoads,
  loadRoute,
  previewOf,
  recentCalls,
  redactMessage,
  type AnalogCall,
} from '../analog-server-log.ts';
import ngDevtoolsVite from '../vite.ts';
import { isRedactedKey as isSecretKey } from '../forms-privacy.ts';

class FakeRes extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  write(chunk: unknown) {
    this.body += String(chunk);
    return true;
  }
  end(chunk?: unknown) {
    if (chunk !== undefined) this.body += String(chunk);
    this.emit('finish');
    return this;
  }
}

function run(
  url: string,
  respond: (res: FakeRes) => void,
  headers: Record<string, string> = {},
  method = 'GET',
) {
  const req = { url: '/index.html', originalUrl: url, method, headers } as never;
  const res = new FakeRes();
  let nexted = false;
  analogMiddleware('api')(req, res as never, () => {
    nexted = true;
  });
  respond(res);
  return { nexted, call: recentCalls().at(-1) };
}

afterEach(() => clearCalls());

describe('Analog server call log', () => {
  it('classifies load, server function, API and page requests', () => {
    expect(classify('/api/_analog/pages/products/1', 'GET', '', 'api')).toEqual({
      kind: 'load',
      route: '/products/1',
    });
    expect(classify('/_analog/pages/', 'GET', '', 'api')).toEqual({ kind: 'load', route: '/' });
    expect(classify('/api/_analog/pages/index', 'GET', '', 'api')).toEqual({
      kind: 'load',
      route: '/',
    });
    expect(classify('/api/_analog/pages/products/index', 'GET', '', 'api')).toEqual({
      kind: 'load',
      route: '/products',
    });
    expect(classify('/api/_analog/fn/abc', 'POST', '', 'api')).toEqual({
      kind: 'fn',
      route: 'abc',
    });
    expect(classify('/api/v1/hello?x=1', 'GET', '', 'api')).toEqual({
      kind: 'api',
      route: '/api/v1/hello',
    });
    expect(classify('/products/1', 'GET', 'text/html,*/*', 'api')).toEqual({
      kind: 'page',
      route: '/products/1',
    });
    expect(classify('/main.js', 'GET', 'text/html', 'api')).toBeNull();
    expect(classify('/@vite/client', 'GET', 'text/html', 'api')).toBeNull();
    expect(classify('/__ng-devtools/', 'GET', 'text/html', 'api')).toBeNull();
  });

  it('records a load call with a redacted preview and who called it', () => {
    const { nexted, call } = run(
      '/api/_analog/pages/account',
      (res) => {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({ name: 'Ada', password: 'hunter2', apiKey: 'k', note: 'Bearer abc.def' }),
        );
      },
      { 'user-agent': 'node' },
    );
    expect(nexted).toBe(true);
    expect(call).toMatchObject({ kind: 'load', route: '/account', status: 200, from: 'ssr' });
    expect(call!.preview).toContain('"name":"Ada"');
    expect(call!.preview).not.toMatch(/hunter2|"k"|abc\.def/);
  });

  it('uses the original URL and detects server rendered versus client only pages', () => {
    const ssr = run('/products/1', (res) => res.end('<app-root ng-server-context="ssr-analog">'), {
      accept: 'text/html',
      'user-agent': 'Mozilla',
    });
    expect(ssr.call).toMatchObject({
      kind: 'page',
      url: '/products/1',
      render: 'ssr',
      from: 'browser',
    });
    expect(ssr.call!.preview).toBeUndefined();
    const client = run('/dashboard', (res) => res.end('<app-root></app-root>'), {
      accept: 'text/html',
      'user-agent': 'Mozilla',
    });
    expect(client.call!.render).toBe('client');
    const devtools = run('/api/v1/hello', (res) => res.end('{}'), { 'x-ng-devtools': '1' });
    expect(devtools.call!.from).toBe('devtools');
  });

  it('classifies non-GET page endpoint requests as form actions', () => {
    expect(classify('/api/_analog/pages/contact', 'POST', '*/*', 'api')).toEqual({
      kind: 'action',
      route: '/contact',
    });
    expect(classify('/_analog/pages/(auth)/login', 'DELETE', '', 'api')).toEqual({
      kind: 'action',
      route: '/login',
    });
    expect(classify('/api/_analog/pages/contact', 'HEAD', '', 'api')!.kind).toBe('load');
  });

  it('records form action outcomes with redacted validation errors and redirects', () => {
    const browser = { 'user-agent': 'Mozilla' };
    const ok = run(
      '/api/_analog/pages/contact',
      (res) => {
        res.setHeader('content-type', 'application/json');
        res.end('{"sent":true}');
      },
      browser,
      'POST',
    );
    expect(ok.call).toMatchObject({ kind: 'action', outcome: 'success', route: '/contact' });
    const invalid = run(
      '/api/_analog/pages/contact',
      (res) => {
        res.statusCode = 422;
        res.setHeader('x-analog-errors', 'true');
        res.setHeader('content-type', 'text/plain;charset=UTF-8');
        res.end('{"email":"Email is required","password":"hunter2 is too short"}');
      },
      browser,
      'POST',
    );
    expect(invalid.call).toMatchObject({ kind: 'action', outcome: 'invalid', status: 422 });
    expect(invalid.call!.preview).toContain('"email":"Email is required"');
    expect(invalid.call!.preview).not.toContain('hunter2');
    const redirect = run(
      '/api/_analog/pages/contact',
      (res) => {
        res.statusCode = 302;
        res.setHeader('location', '/thanks?token=abc');
        res.end();
      },
      browser,
      'POST',
    );
    expect(redirect.call).toMatchObject({
      kind: 'action',
      outcome: 'redirect',
      location: '/thanks?token=[redacted]',
    });
    const failed = run(
      '/api/_analog/pages/contact',
      (res) => {
        res.statusCode = 500;
        res.end('boom');
      },
      browser,
      'POST',
    );
    expect(failed.call!.outcome).toBe('error');
  });

  it('keeps load pairing when a form action posts in between', () => {
    const base = { method: 'GET', url: '', status: 200, ms: 1, kind: 'load' as const };
    const list: AnalogCall[] = [
      { ...base, id: 1, at: 1000, route: '/a', from: 'ssr' },
      { ...base, id: 2, at: 1100, kind: 'page', route: '/a', from: 'browser', render: 'ssr' },
      { ...base, id: 3, at: 1200, kind: 'action', method: 'POST', route: '/a', from: 'browser' },
      { ...base, id: 4, at: 1300, route: '/a', from: 'browser' },
    ];
    expect(duplicateLoads(list)).toEqual([{ route: '/a', ssrAt: 1000, browserAt: 1300 }]);
  });

  it('passes unrelated requests straight through', () => {
    const { nexted, call } = run('/src/main.ts', (res) => res.end('code'));
    expect(nexted).toBe(true);
    expect(call).toBeUndefined();
  });

  it('finds loads fetched on the server and again in the browser', () => {
    const base = { method: 'GET', url: '', status: 200, ms: 1, kind: 'load' as const };
    const page = { ...base, kind: 'page' as const, from: 'browser' as const };
    const list: AnalogCall[] = [
      { ...base, id: 1, at: 1000, route: '/a', from: 'ssr' },
      { ...page, id: 2, at: 1100, route: '/a', render: 'ssr' },
      { ...base, id: 3, at: 1500, route: '/a', from: 'browser' },
      { ...base, id: 4, at: 1600, route: '/a', from: 'browser' },
      { ...base, id: 5, at: 2000, route: '/b', from: 'ssr' },
      { ...page, id: 6, at: 2100, route: '/b', render: 'ssr' },
      { ...base, id: 7, at: 60_000, route: '/b', from: 'browser' },
      { ...base, id: 8, at: 61_000, route: '/c', from: 'ssr' },
      { ...page, id: 9, at: 61_100, route: '/c', render: 'ssr' },
      { ...base, id: 10, at: 61_200, route: '/d', from: 'browser' },
      { ...base, id: 11, at: 61_300, route: '/c', from: 'browser' },
      { ...base, id: 12, at: 70_000, route: '/e', from: 'ssr' },
      { ...page, id: 13, at: 70_100, route: '/e', render: 'client' },
      { ...base, id: 14, at: 70_200, route: '/e', from: 'browser' },
      { ...base, id: 15, at: 71_000, route: '/f', from: 'devtools' },
    ];
    expect(duplicateLoads(list)).toEqual([{ route: '/a', ssrAt: 1000, browserAt: 1500 }]);
  });

  it('only pairs loads that belong to the rendered page or its parents', () => {
    const base = { method: 'GET', url: '', status: 200, ms: 1, kind: 'load' as const };
    const page = { ...base, kind: 'page' as const, from: 'browser' as const };
    const list: AnalogCall[] = [
      { ...base, id: 1, at: 1000, route: '/a', from: 'ssr' },
      { ...base, id: 2, at: 1010, route: '/products', from: 'ssr' },
      { ...page, id: 3, at: 1100, route: '/products/1', render: 'ssr' },
      { ...base, id: 4, at: 1200, route: '/a', from: 'browser' },
    ];
    expect(duplicateLoads(list)).toEqual([]);
    const parent: AnalogCall[] = [
      ...list.slice(0, 3),
      { ...base, id: 5, at: 1200, route: '/products', from: 'browser' },
    ];
    expect(duplicateLoads(parent)).toEqual([{ route: '/products', ssrAt: 1010, browserAt: 1200 }]);
  });

  it('maps group, index and named-group endpoints back to page routes', () => {
    expect(loadRoute('/(auth)/login')).toBe('/login');
    expect(loadRoute('/-home-')).toBe('/');
    expect(loadRoute('/products/index')).toBe('/products');
    expect(loadRoute('/products/7')).toBe('/products/7');
  });

  it('redacts secrets in text and keys', () => {
    expect(isSecretKey('sessionToken')).toBe(true);
    expect(isSecretKey('passenger')).toBe(false);
    expect(redactMessage('/cb?token=abc&x=1')).toBe('/cb?token=[redacted]&x=1');
    expect(previewOf('<html>', 'text/html')).toBeUndefined();
    expect(previewOf('x'.repeat(2000), 'text/plain')!.length).toBeLessThan(1100);
  });

  it('redacts secret keys in JSON bodies cut at the capture limit', () => {
    const body = JSON.stringify({
      user: { password: 'hunter2', apiKey: 'k123', name: 'ada', note: 'say \\"token\\": x' },
      credentials: { user: 'ada', value: 'nested-secret' },
      items: Array.from({ length: 2000 }, (_, i) => ({ id: i, sessionToken: `t${i}` })),
    }).slice(0, 16_000);
    const preview = previewOf(body, 'application/json')!;
    expect(
      preview.startsWith('{"user":{"password":"[redacted]","apiKey":"[redacted]","name":"ada"'),
    ).toBe(true);
    expect(preview).toContain(
      '"credentials":"[redacted]","items":[{"id":0,"sessionToken":"[redacted]"}',
    );
    expect(preview).not.toMatch(/hunter2|k123|nested-secret|"t\d+"/);
    expect(previewOf('{"a":1,"token":"abc', 'application/json')).toBe(
      '{"a":1,"token":"[redacted]"',
    );
  });

  it('replaces JSON nested past the depth limit instead of keeping it raw', () => {
    const body = JSON.stringify({
      a: { b: { c: { d: { e: { f: { g: { password: 'hunter2' } } } } } } },
    });
    const preview = previewOf(body, 'application/json')!;
    expect(preview).not.toContain('hunter2');
    expect(preview).toContain('[Truncated]');
  });
});

describe('Vite plugin', () => {
  it('runs in dev before Analog and mounts the log before the devtools server', () => {
    const plugin = ngDevtoolsVite();
    expect(plugin).toMatchObject({ name: 'ng-devtools', apply: 'serve', enforce: 'pre' });
    const used: unknown[] = [];
    let onListening: (() => void) | undefined;
    const server = {
      config: { root: process.cwd() },
      middlewares: { use: (fn: unknown) => used.push(fn) },
      httpServer: {
        on: () => {},
        once: (event: string, fn: () => void) => {
          if (event === 'listening') onListening = fn;
        },
      },
      resolvedUrls: { local: ['http://localhost:5174/'] },
    };
    (plugin.configureServer as (server: unknown) => void)(server);
    expect(used).toHaveLength(3);
    const probe = used[0] as (req: unknown, res: unknown, next: () => void) => void;
    const res = new FakeRes();
    let passed = false;
    probe({ url: '/products/__connection.json' }, res, () => (passed = true));
    expect([res.statusCode, passed]).toEqual([404, false]);
    const local = { remoteAddress: '::ffff:127.0.0.1' };
    probe(
      { url: '/__devframes/ng-devtools/__connection.json', socket: local },
      new FakeRes(),
      () => (passed = true),
    );
    expect(passed).toBe(true);
    const remote = new FakeRes();
    passed = false;
    probe(
      { url: '/__devframes/__sse', socket: { remoteAddress: '192.168.1.20' } },
      remote,
      () => (passed = true),
    );
    expect([remote.statusCode, passed]).toEqual([403, false]);
    expect(onListening).toBeTypeOf('function');
  });
});
