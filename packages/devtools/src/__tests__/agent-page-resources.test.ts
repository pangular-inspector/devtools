import { createDevServer } from 'devframe/adapters/dev';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pangularMcp } from '../agent-mcp.ts';
import {
  PAGE_RESOURCE_NAMES,
  createPageResourceSource,
  pageResourceText,
  pangularMcpPagesChanged,
  pangularMcpResourceTemplates,
  type PageResourceName,
} from '../agent-page-resources.ts';
import { agentResourceOffered, resolvePangularConfig, type PangularConfig } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { initPangularHub, type PangularHubOptions } from '../hub.ts';
import type { LiveComponentNode } from '../types.ts';
import { makeProject } from './analog-fixture.ts';

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const close of closers.splice(0)) await close();
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

type Send = (request: Request) => Promise<Response>;
type RpcAnswer<T> = { result?: T; error?: { code: number; message: string } };

/** A JSON-RPC client for one stateless MCP endpoint. */
function mcpClient(url: string, send: Send) {
  let id = 0;
  return async <T>(method: string, params: object = {}): Promise<RpcAnswer<T>> => {
    const response = await send(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      }),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    const json = text.startsWith('{') ? text : /^data: (.*)$/m.exec(text)?.[1];
    return JSON.parse(json ?? '{}');
  };
}

const INITIALIZE = {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'test', version: '0' },
};

const HUB_MCP = 'http://localhost/__devframes/__mcp';

async function bootHub(options: PangularHubOptions = {}) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    auth: false,
    allowedOrigins: false,
    ...options,
  });
  closers.push(() => hub.close());
  await hub.ready;
  const ctx = await hub.context;
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  return { hub, ctx, push, call: mcpClient(HUB_MCP, (r) => hub.handler(r)) };
}

type Templates = {
  resourceTemplates: { uriTemplate: string; name: string; title?: string; mimeType?: string }[];
};
type Resources = { resources: { uri: string; name: string; mimeType?: string }[] };
type Contents = { contents: { uri: string; mimeType: string; text: string }[] };

const tree = (name: string): LiveComponentNode[] => [
  { id: 'c1', name, tag: 'app-root', children: [] },
];

function templateNames(config: PangularConfig = {}) {
  return pangularMcpResourceTemplates(resolvePangularConfig(config)).map((t) => t.uriTemplate);
}

describe('pangularMcpResourceTemplates', () => {
  it('offers one page template per page-scoped resource', () => {
    expect(templateNames()).toEqual(
      PAGE_RESOURCE_NAMES.map((name) => `pangular://pages/{pageId}/${name}`),
    );
  });

  it('follows its resource when an inspector or its agent tools are off', () => {
    expect(templateNames({ inspectors: { forms: false } })).not.toContain(
      'pangular://pages/{pageId}/forms',
    );
    expect(templateNames({ agent: { tools: { router: false } } })).not.toContain(
      'pangular://pages/{pageId}/router',
    );
    expect(templateNames({ agent: { tools: { router: false } } })).toContain(
      'pangular://pages/{pageId}/forms',
    );
    // agent.readOnly keeps every read resource.
    expect(templateNames({ agent: { readOnly: true } })).toHaveLength(PAGE_RESOURCE_NAMES.length);
    const config = resolvePangularConfig();
    expect(agentResourceOffered('list-pages', config)).toBe(false);
    expect(agentResourceOffered('no-such-resource', config)).toBe(false);
  });
});

describe('pageResourceText', () => {
  it('keeps only the forms, events and errors of the page', () => {
    const form = (id: string) => ({ id, label: id, kind: 'reactive', root: { status: 'VALID' } });
    const state = {
      forms: [form('Login.form@p1'), form('Cart.form@p2')],
      events: [
        { formId: 'Login.form@p1', path: '', type: 'value', timestamp: 1 },
        { formId: 'Cart.form@p2', path: '', type: 'value', timestamp: 2 },
      ],
      reportedAt: 1,
      pagesReportedAt: { p1: 10, p2: 20 },
      setupErrors: [
        { pageId: 'p1', message: 'one' },
        { pageId: 'p2', message: 'two' },
      ],
      instrumented: ['p2'],
      dropped: { p2: 3 },
    };
    const json = JSON.parse(pageResourceText('forms', state, 'p2')!);
    expect(json._untrusted).toBeTruthy();
    expect(json.forms.map((f: { id: string }) => f.id)).toEqual(['Cart.form@p2']);
    expect(json.events).toHaveLength(1);
    expect(json).toMatchObject({
      reportedAt: 20,
      pagesReportedAt: { p2: 20 },
      setupErrors: [{ pageId: 'p2', message: 'two' }],
      instrumented: ['p2'],
      dropped: { p2: 3 },
    });
    expect(pageResourceText('forms', state, 'p3')).toBeUndefined();
  });

  it('keeps one page of the array states', () => {
    const state = {
      pages: [
        { pageId: 'p1', reportedAt: 1, navigations: [] },
        { pageId: 'p2', reportedAt: 2, navigations: [] },
      ],
    };
    for (const name of ['router', 'ngrx-store'] as const) {
      const json = JSON.parse(pageResourceText(name, state, 'p1')!);
      expect(
        json.pages.map((p: { pageId: string }) => p.pageId),
        name,
      ).toEqual(['p1']);
      expect(pageResourceText(name, state, 'nope'), name).toBeUndefined();
    }
  });

  it('drops the panel selection from the record states', () => {
    const state = {
      pages: { p1: { pageId: 'p1', roots: tree('One'), environment: [], reportedAt: 1 } },
      selectedId: 'c9',
      selectedNodeId: 'n1',
      selectedInjectorId: 'i1',
    };
    for (const name of ['component-tree', 'signal-graph', 'injector-tree'] as const) {
      const json = JSON.parse(pageResourceText(name, state, 'p1')!);
      expect(Object.keys(json.pages), name).toEqual(['p1']);
      expect(json, name).not.toHaveProperty('selectedId');
      expect(json, name).not.toHaveProperty('selectedNodeId');
      expect(json, name).not.toHaveProperty('selectedInjectorId');
    }
  });
});

/** A shared state stand-in: `set` replaces the value and fires `updated`. */
function fakeState(value: unknown) {
  const listeners = new Set<() => void>();
  return {
    value: () => value,
    on: (_event: 'updated', listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: unknown) {
      value = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

describe('createPageResourceSource', () => {
  function source() {
    const states = Object.fromEntries(
      PAGE_RESOURCE_NAMES.map((name) => [
        name,
        fakeState(name === 'forms' ? { pagesReportedAt: {} } : { pages: {} }),
      ]),
    ) as Record<PageResourceName, ReturnType<typeof fakeState>>;
    const touch = vi.fn();
    return { states, touch, source: createPageResourceSource({ states, touch, debounceMs: 500 }) };
  }

  it('sends one change per window, and none for a push that keeps the pages', () => {
    vi.useFakeTimers();
    const { states, source: pages } = source();
    const listener = vi.fn();
    const off = pages.onPagesChanged(['component-tree', 'forms'], listener);
    const components = states['component-tree'];

    components.set({ pages: { p1: {} } });
    components.set({ pages: { p1: {}, p2: {} } });
    components.set({ pages: { p1: {}, p2: {} } });
    vi.advanceTimersByTime(499);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);

    // A fresh report from the same pages changes nothing.
    components.set({ pages: { p1: { reportedAt: 2 }, p2: {} } });
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(1);

    // A page that expires is a change.
    states.forms.set({ pagesReportedAt: { p1: 1 } });
    vi.advanceTimersByTime(500);
    expect(listener).toHaveBeenCalledTimes(2);

    // Resources the templates do not offer are not watched.
    states.router.set({ pages: [{ pageId: 'p9' }] });
    vi.advanceTimersByTime(500);
    expect(listener).toHaveBeenCalledTimes(2);

    off();
    expect(components.listeners.size).toBe(0);
    components.set({ pages: {} });
    vi.advanceTimersByTime(500);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('renews the lease before a read, and answers undefined for an unknown page', async () => {
    const { states, touch, source: pages } = source();
    states.router.set({ pages: [{ pageId: 'p1', navigations: [] }] });
    expect(await pages.read('router', 'p1')).toContain('"pageId":"p1"');
    expect(await pages.read('router', 'p2')).toBeUndefined();
    expect(touch).toHaveBeenCalledTimes(2);
    expect(pages.pageIds('router')).toEqual(['p1']);
  });
});

describe('MCP resource templates over the hub endpoint', () => {
  it('lists the templates', async () => {
    const { call } = await bootHub();
    const init = await call<{ capabilities: Record<string, unknown> }>('initialize', INITIALIZE);
    expect(init.result?.capabilities.resources).toEqual({ listChanged: true });
    const list = await call<Templates>('resources/templates/list');
    expect(list.result?.resourceTemplates.map((t) => t.uriTemplate)).toEqual(templateNames());
    expect(list.result?.resourceTemplates[0]).toMatchObject({
      name: 'pangular:component-tree-of-page',
      title: 'Angular Component Tree of one page',
      mimeType: 'application/json',
    });
  });

  it('reads each page through its template', async () => {
    const { push, call } = await bootHub();
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    await push('push-component-tree', { pageId: 'p2', roots: tree('Second'), count: 1 });

    const read = (uri: string) => call<Contents>('resources/read', { uri });
    const one = (await read('pangular://pages/p1/component-tree')).result!.contents[0]!;
    const two = (await read('pangular://pages/p2/component-tree')).result!.contents[0]!;
    expect(one).toMatchObject({ uri: 'pangular://pages/p1/component-tree' });
    expect(one.mimeType).toBe('application/json');
    expect(JSON.parse(one.text)).toMatchObject({ nodes: [{ name: 'First' }] });
    expect(Object.keys(JSON.parse(one.text).pages)).toEqual(['p1']);
    expect(JSON.parse(two.text)).toMatchObject({ nodes: [{ name: 'Second' }] });

    const unknown = (await read('pangular://pages/zz/component-tree')).result!.contents[0]!;
    expect(unknown.mimeType).toBe('text/markdown');
    expect(unknown.text).toContain('No page `zz` is reporting a component tree');
    expect(unknown.text).toContain('`p1`, `p2`');

    // The static resource still reads every page.
    const all = (await read('devframe://resource/pangular%3Acomponent-tree')).result!.contents[0]!;
    expect(Object.keys(JSON.parse(all.text).pages).sort()).toEqual(['p1', 'p2']);

    // A URI the template does not match stays unknown.
    expect((await read('pangular://pages/p1/x/component-tree')).error).toBeDefined();
  });

  it('names one concrete resource per reporting page in resources/list', async () => {
    const { push, call } = await bootHub();
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    const uris = (await call<Resources>('resources/list')).result!.resources.map((r) => r.uri);
    expect(uris).toContain('pangular://pages/p1/component-tree');
    expect(uris).not.toContain('pangular://pages/p1/router');
    expect(uris).toContain('devframe://resource/pangular%3Acomponent-tree');
  });

  it('leaves out the template of an inspector that is off', async () => {
    const { call } = await bootHub({ inspectors: { components: false } });
    const list = await call<Templates>('resources/templates/list');
    const uris = list.result!.resourceTemplates.map((t) => t.uriTemplate);
    expect(uris).not.toContain('pangular://pages/{pageId}/component-tree');
    expect(uris).toContain('pangular://pages/{pageId}/router');
    const read = await call('resources/read', { uri: 'pangular://pages/p1/component-tree' });
    expect(read.error?.message).toContain('unknown resource URI');
  });

  it('serves no templates when the setting has none', async () => {
    const { push, call } = await bootHub({ mcp: { authorization: false, resourceTemplates: [] } });
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    expect((await call('resources/templates/list')).error).toBeDefined();
    const uris = (await call<Resources>('resources/list')).result!.resources.map((r) => r.uri);
    expect(uris.some((uri) => uri.startsWith('pangular://'))).toBe(false);
    expect(uris).toContain('devframe://resource/pangular%3Acomponent-tree');
    const read = await call('resources/read', { uri: 'pangular://pages/p1/component-tree' });
    expect(read.error).toBeDefined();
  });

  it('calls the list_changed hook when a page comes and goes', async () => {
    const { ctx, push } = await bootHub();
    const notify = vi.fn();
    const off = pangularMcpPagesChanged(resolvePangularConfig())(notify, ctx as never);
    closers.push(async () => off());
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await push('forget-component-page', 'p1');
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(2), { timeout: 2000 });
  });
});

/**
 * Open a 2026-07-28 `subscriptions/listen` stream for resource list changes.
 * `next` resolves with the next notification method, or undefined after `ms`.
 */
async function listenForResources(send: Send) {
  const abort = new AbortController();
  const response = await send(
    new Request(HUB_MCP, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        origin: 'http://localhost:4000',
        'mcp-protocol-version': '2026-07-28',
        'mcp-method': 'subscriptions/listen',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'subscriptions/listen',
        params: {
          notifications: { resourcesListChanged: true },
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    }),
  );
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let pending: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;
  const next = async (ms: number): Promise<string | undefined> => {
    pending ??= reader.read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), ms);
    });
    const chunk = await Promise.race([pending, timeout]);
    clearTimeout(timer);
    if (!chunk) return undefined;
    pending = undefined;
    const data = /^data: (.*)$/m.exec(decoder.decode(chunk.value))?.[1];
    return data ? (JSON.parse(data) as { method: string }).method : undefined;
  };
  closers.push(async () => {
    abort.abort();
    await reader.cancel().catch(() => {});
  });
  expect(await next(2000)).toBe('notifications/subscriptions/acknowledged');
  return next;
}

describe('resources list_changed over the hub endpoint', () => {
  const CHANGED = 'notifications/resources/list_changed';

  it('fires when a page appears or goes, and not for a repeat push', async () => {
    const { hub, push } = await bootHub();
    const next = await listenForResources((r) => hub.handler(r));
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    expect(await next(2000)).toBe(CHANGED);
    await push('push-component-tree', { pageId: 'p1', roots: tree('Again'), count: 1 });
    expect(await next(1000)).toBeUndefined();
    await push('forget-component-page', 'p1');
    expect(await next(2000)).toBe(CHANGED);
  });

  it('comes from the page hook', async () => {
    const { hub, push } = await bootHub({
      mcp: { authorization: false, onResourcesChanged: () => () => {} },
    });
    const next = await listenForResources((r) => hub.handler(r));
    await push('push-component-tree', { pageId: 'p1', roots: tree('First'), count: 1 });
    expect(await next(1000)).toBeUndefined();
  });
});

describe('MCP resource templates over the pangular dev route', () => {
  it('lists and reads them', async () => {
    const config = resolvePangularConfig({ inspectors: { forms: false } });
    const server = await createDevServer(createPangular(config), {
      host: '127.0.0.1',
      port: 0,
      auth: false,
      mcp: pangularMcp(true, config),
    });
    closers.push(() => server.close());
    const call = mcpClient(`${server.origin}/__mcp`, (request) => fetch(request));
    const list = await call<Templates>('resources/templates/list');
    const uris = list.result!.resourceTemplates.map((t) => t.uriTemplate);
    expect(uris).toContain('pangular://pages/{pageId}/router');
    expect(uris).not.toContain('pangular://pages/{pageId}/forms');
    const read = await call<Contents>('resources/read', { uri: 'pangular://pages/p1/router' });
    expect(read.result!.contents[0]!.text).toContain('No page reports router state right now.');
  });
});
