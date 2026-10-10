import '@angular/compiler';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApplicationRef,
  EnvironmentInjector,
  PLATFORM_ID,
  REQUEST,
  createEnvironmentInjector,
} from '@angular/core';
import { createHostContext } from 'devframe/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import { httpRegistry } from '../http-rules.ts';
import { providePangularHttp } from '../http.ts';
import { createSsrMiddleware } from '../ssr-middleware.ts';
import {
  editTransferState,
  matchingOverrides,
  sanitizeSsrOverrides,
  type SsrOverride,
} from '../ssr-overrides.ts';
import { SSR_REQUEST_HEADER, ssrRegistry, type SsrRequest } from '../ssr-registry.ts';
import { explainSsrRequestText, sanitizeSsrRequest } from '../rpc/ssr-tools.ts';
import type { HttpState } from '../types.ts';

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
  flushHeaders() {
    if (!this.headersSent) this.writeHead(this.statusCode);
  }
  removeHeader(name: string) {
    delete this.headers[name.toLowerCase()];
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
  end(chunk?: string | Buffer) {
    if (!this.headersSent) this.writeHead(this.statusCode);
    if (chunk) this.body += chunk.toString();
    this.writableFinished = true;
    this.emit('finish');
    this.emit('close');
    return this;
  }
}

const override = (o: Partial<SsrOverride> & Pick<SsrOverride, 'kind'>): SsrOverride => ({
  id: 'o1',
  pattern: '/examples/ssr',
  enabled: true,
  ...o,
});

const STATE_HTML =
  '<html><body><app-root ng-server-context="ssr"></app-root>' +
  '<script id="ng-state" type="application/json">{"a":{"b":1},"keep":2}</script></body></html>';

describe('sanitizeSsrOverrides', () => {
  it('keeps valid overrides and drops bad kinds, empty patterns and invalid JSON', () => {
    const out = sanitizeSsrOverrides([
      { kind: 'render-error', pattern: ' /a ', message: 'boom' },
      { kind: 'client-render', pattern: '/b' },
      { kind: 'state-edit', pattern: '/c', key: 'k', value: '{"x":1}' },
      { kind: 'state-edit', pattern: '/c', key: 'k', value: '{not json' },
      { kind: 'state-edit', pattern: '/c' },
      { kind: 'toString', pattern: '/d' },
      { kind: 'client-render', pattern: '   ' },
    ]);
    expect(out.map((o) => o.kind)).toEqual(['render-error', 'client-render', 'state-edit']);
    expect(out[0]).toMatchObject({ pattern: '/a', message: 'boom' });
    expect(out[2]).toMatchObject({ key: 'k', value: '{"x":1}' });
  });

  it('matches enabled overrides of one kind by glob', () => {
    const list = [
      override({ kind: 'client-render', pattern: '/examples/*' }),
      override({ kind: 'client-render', pattern: '/other', id: 'o2' }),
      override({ kind: 'render-error', pattern: '/examples/*', id: 'o3' }),
      override({ kind: 'client-render', pattern: '/examples/*', id: 'o4', enabled: false }),
    ];
    expect(matchingOverrides(list, '/examples/ssr', 'client-render').map((o) => o.id)).toEqual([
      'o1',
    ]);
  });
});

describe('editTransferState', () => {
  it('sets and removes keys and escapes the JSON like Angular does', () => {
    const out = editTransferState(STATE_HTML, [
      override({ kind: 'state-edit', key: 'a', value: '{"b":"</script><x>"}' }),
      override({ kind: 'state-edit', key: 'keep' }),
    ])!;
    expect(out.keys).toEqual(['a', 'keep']);
    const json = /<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/.exec(out.html)![1];
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual({ a: { b: '</script><x>' } });
  });

  it('writes a __proto__ key as an entry instead of changing the prototype', () => {
    const out = editTransferState(STATE_HTML, [
      override({ kind: 'state-edit', key: '__proto__', value: '{"polluted":true}' }),
    ])!;
    const json = /<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/.exec(out.html)![1];
    expect(json).toContain('"__proto__":{"polluted":true}');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('edits the TransferState script, not a script with a data-id ending in -state', () => {
    const other = '<script type="application/json" data-id="config-state">{"a":0}</script>';
    const out = editTransferState(other + STATE_HTML, [
      override({ kind: 'state-edit', key: 'a', value: '2' }),
    ])!;
    expect(out.html).toContain(other);
    const json = /<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/.exec(out.html)![1];
    expect(JSON.parse(json)).toEqual({ a: 2, keep: 2 });
  });

  it('returns null with no state script or nothing to change', () => {
    const edit = override({ kind: 'state-edit', key: 'missing' });
    expect(editTransferState('<html></html>', [edit])).toBeNull();
    expect(editTransferState(STATE_HTML, [edit])).toBeNull();
  });
});

describe('ssrMiddleware overrides', () => {
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

  const request = (url = '/examples/ssr') =>
    ({ method: 'GET', url, headers: { accept: 'text/html' } }) as unknown as IncomingMessage;

  it('serves index.csr.html for a forced Client render without calling next', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangular-'));
    writeFileSync(
      join(dir, 'index.csr.html'),
      '<app-root></app-root><script src="main.js" type="module"></script>',
    );
    ssrRegistry().overrides = [override({ kind: 'client-render' })];
    const res = new FakeResponse();
    let called = false;
    createSsrMiddleware({ browserDistFolder: dir })(
      request(),
      res as unknown as ServerResponse,
      () => (called = true),
    );
    expect(called).toBe(false);
    expect(res.body).toContain('<app-root></app-root>');
    expect(res.sentHeaders['x-pangular-override']).toBe('client-render');
    expect(recorded[0]).toMatchObject({
      renderMode: 'client',
      overrides: [{ kind: 'client-render', applied: true }],
    });
  });

  it('renders normally and says why when the shell is missing', () => {
    ssrRegistry().overrides = [override({ kind: 'client-render' })];
    const res = new FakeResponse();
    let called = false;
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => (called = true));
    expect(called).toBe(true);
    res.setHeader('content-type', 'text/html');
    res.end(STATE_HTML);
    expect(recorded[0].overrides).toEqual([
      expect.objectContaining({
        applied: false,
        note: expect.stringContaining('browserDistFolder'),
      }),
    ]);
  });

  it('keeps headers back when the adapter flushes them, so content-length matches the edit', () => {
    ssrRegistry().overrides = [
      override({ kind: 'state-edit', key: 'a', value: '{"b":"longer value"}' }),
    ];
    const res = new FakeResponse();
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => {});
    res.setHeader('content-type', 'text/html');
    res.setHeader('content-length', Buffer.byteLength(STATE_HTML));
    res.flushHeaders();
    expect(res.headersSent).toBe(false);
    res.end(STATE_HTML);
    expect(res.body).toContain('longer value');
    expect(res.sentHeaders['content-length']).toBe(Buffer.byteLength(res.body));
  });

  it('says a set failed, not that an entry was missing, when the state does not parse', () => {
    ssrRegistry().overrides = [override({ kind: 'state-edit', key: 'a', value: '1' })];
    const res = new FakeResponse();
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => {});
    res.setHeader('content-type', 'text/html');
    res.end('<script id="ng-state" type="application/json">{broken</script>');
    expect(recorded[0].overrides).toEqual([
      expect.objectContaining({
        applied: false,
        note: 'could not edit the TransferState script for a',
      }),
    ]);
  });

  it('rewrites the TransferState script before the response is sent', () => {
    ssrRegistry().overrides = [override({ kind: 'state-edit', key: 'a', value: '{"b":2}' })];
    const res = new FakeResponse();
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => {});
    res.setHeader('content-type', 'text/html');
    res.write(STATE_HTML.slice(0, 40));
    res.end(STATE_HTML.slice(40));
    expect(res.body).toContain('{"a":{"b":2},"keep":2}');
    expect(res.sentHeaders['content-length']).toBe(Buffer.byteLength(res.body));
    expect(recorded[0]).toMatchObject({
      renderMode: 'server',
      overrides: [{ kind: 'state-edit', applied: true, note: 'set a' }],
    });
  });

  it('does not report an edit on a page without TransferState, such as an error page', () => {
    ssrRegistry().overrides = [override({ kind: 'state-edit', key: 'a', value: '1' })];
    const res = new FakeResponse();
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => {});
    res.statusCode = 500;
    res.setHeader('content-type', 'text/html');
    res.end('<pre>Error</pre>');
    expect(res.body).toBe('<pre>Error</pre>');
    expect(recorded[0]).not.toHaveProperty('overrides');
  });

  it('leaves requests that match no override alone', () => {
    ssrRegistry().overrides = [override({ kind: 'state-edit', pattern: '/elsewhere', key: 'a' })];
    const res = new FakeResponse();
    createSsrMiddleware()(request(), res as unknown as ServerResponse, () => {});
    res.setHeader('content-type', 'text/html');
    res.end(STATE_HTML);
    expect(res.body).toBe(STATE_HTML);
    expect(res.sentHeaders).not.toHaveProperty('x-pangular-override');
    expect(recorded[0]).not.toHaveProperty('overrides');
  });
});

describe('render error override', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode = true;
  });
  afterEach(() => {
    g.ngDevMode = saved;
    ssrRegistry().overrides = undefined;
    ssrRegistry().active.clear();
  });

  const boot = (url: string) => {
    ssrRegistry().active.set('r1', { fetches: 0, fetchMs: 0 });
    const parent = createEnvironmentInjector(
      [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: REQUEST,
          useValue: new Request(`http://localhost${url}`, {
            headers: { [SSR_REQUEST_HEADER]: 'r1' },
          }),
        },
      ],
      null as unknown as EnvironmentInjector,
    );
    return () => createEnvironmentInjector([providePangularHttp()], parent);
  };

  it('throws during the server render of a matching URL and records it', () => {
    ssrRegistry().overrides = [
      override({ kind: 'render-error', pattern: '/examples/ssr', message: 'db down' }),
    ];
    expect(boot('/examples/ssr')).toThrow('[Pangular Inspector] db down');
    expect(ssrRegistry().active.get('r1')!.overrides).toEqual([
      { id: 'o1', kind: 'render-error', applied: true, note: 'db down' },
    ]);
    expect(boot('/about')).not.toThrow();
  });
});

describe('time until stable', () => {
  const g = globalThis as { ngDevMode?: unknown };
  afterEach(() => delete httpRegistry().stableMs);

  it('records once when the app first becomes stable in the browser', async () => {
    const saved = g.ngDevMode;
    g.ngDevMode = true;
    let resolve!: () => void;
    const stable = new Promise<void>((r) => (resolve = r));
    try {
      const parent = createEnvironmentInjector(
        [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: ApplicationRef, useValue: { whenStable: () => stable } },
        ],
        null as unknown as EnvironmentInjector,
      );
      createEnvironmentInjector([providePangularHttp()], parent);
      expect(httpRegistry().stableMs).toBeUndefined();
      resolve();
      await stable;
      await Promise.resolve();
      expect(httpRegistry().stableMs).toEqual(expect.any(Number));
    } finally {
      g.ngDevMode = saved;
    }
  });
});

describe('set-ssr-overrides and the tool output', () => {
  async function setup(config?: PangularConfig) {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await (config ? createPangular(config) : pangular).setup(ctx as never);
    const call = (payload: unknown) =>
      ctx.rpc.invokeLocal('pangular:set-ssr-overrides' as never, ...([payload] as never));
    const state = async () =>
      (
        await (
          ctx.rpc as unknown as {
            sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
          }
        ).sharedState.get('pangular:http')
      ).value() as HttpState;
    return { call, state };
  }
  afterEach(() => httpRegistry().dispose?.());

  it('stores sanitized overrides in shared state and the registry', async () => {
    const { call, state } = await setup();
    await call([
      { kind: 'client-render', pattern: '/x' },
      { kind: 'nope', pattern: '/y' },
    ]);
    expect((await state()).ssrOverrides).toEqual([
      expect.objectContaining({ kind: 'client-render', pattern: '/x' }),
    ]);
    expect(ssrRegistry().overrides).toHaveLength(1);
  });

  it('refuses writes when actions.http is off', async () => {
    const { call } = await setup({ actions: { http: false } });
    await expect(call([{ kind: 'client-render', pattern: '/x' }])).rejects.toThrow();
    expect(ssrRegistry().overrides).toEqual([]);
  });

  it('marks an overridden response in explain-ssr-request', () => {
    const r = sanitizeSsrRequest({
      id: 'r1',
      method: 'GET',
      url: '/examples/ssr',
      status: 500,
      at: 1,
      durationMs: 1,
      renderMs: 1,
      bytes: 1,
      renderMode: 'not-rendered',
      fetches: 0,
      fetchMs: 0,
      headers: {},
      overrides: [{ id: 'o1', kind: 'render-error', applied: true, note: 'db down' }],
    })!;
    const text = explainSsrRequestText([r], [], [], {});
    expect(text).toContain('### Overrides from the panel');
    expect(text).toContain('Render error: applied, `db down`');
  });
});
