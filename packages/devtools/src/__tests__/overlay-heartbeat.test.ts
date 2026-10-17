// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_HEARTBEAT_MS } from '../page-heartbeat.ts';

// The whole overlay on an idle page, against a fake server that answers like
// `devframe.ts`: once everything went out, only the page heartbeat is sent.

interface FakeClient {
  status: string;
  readonly isTrusted: boolean;
  calls: { name: string; arg: unknown }[];
  handlers: Map<string, (...args: unknown[]) => unknown>;
  set(status: string): void;
}

const clients: FakeClient[] = [];
let nextStatus = 'connected';
let watching = false;
/** Whether the server holds the page, as `page-heartbeat` answers. */
let known = true;
/** A server from before the heartbeat. */
let heartbeatSupported = true;

function answer(name: string, arg: unknown): unknown {
  if (name === 'page-heartbeat') {
    if (!heartbeatSupported) throw new Error('[birpc] function "page-heartbeat" not found');
    return { known, watching };
  }
  if (name === 'page-interest') return { watching };
  if (name === 'claim-page') return { ok: true };
  if (name.startsWith('ping-')) return { known: true };
  if (name === 'push-ngrx-state') return { seq: (arg as { since?: number })?.since ?? 0 };
  if (name.startsWith('push-')) return { delta: true, known: true };
  return undefined;
}

function fakeClient(status: string): FakeClient {
  const listeners = new Set<(status: string) => void>();
  const client = {
    status,
    get isTrusted() {
      return client.status === 'connected';
    },
    calls: [] as { name: string; arg: unknown }[],
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    connectionMeta: {
      backend: 'websocket',
      configs: { pangular: { inspectors: { analog: false } } },
    },
    events: {
      on: (event: string, listener: (status: string) => void) => {
        if (event !== 'connection:status') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, arg?: unknown) => {
          client.calls.push({ name, arg: JSON.parse(JSON.stringify(arg ?? null)) });
          if (client.status !== 'connected') {
            throw new Error('[devframe] Not connected to the devframe server');
          }
          return answer(name, arg);
        },
        register: (definition: { name: string; handler: (...args: unknown[]) => unknown }) => {
          client.handlers.set(definition.name, definition.handler);
        },
      },
    }),
    close: () => {},
    set(next: string) {
      client.status = next;
      for (const listener of [...listeners]) listener(next);
    },
  };
  return client;
}

vi.mock('devframe/client', () => ({
  connectDevframe: async () => {
    const client = fakeClient(nextStatus);
    clients.push(client);
    return client;
  },
}));

class App {}
class Item {}
// One instance per element, like Angular: a new one would read as a destroyed component.
const instances = new WeakMap<Element, object>();
const getComponent = vi.fn((el: Element) => {
  const type = el.tagName === 'APP-ROOT' ? App : el.tagName === 'APP-ITEM' ? Item : null;
  if (!type) return null;
  if (!instances.has(el)) instances.set(el, new type());
  return instances.get(el)!;
});

const stops: (() => void)[] = [];

async function start() {
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(300);
  stops.push(await pending);
}

/** Lets the first reports go out and the page settle into idle. */
async function settle(client: FakeClient) {
  await vi.advanceTimersByTimeAsync(30_000);
  client.calls.length = 0;
}

const names = (client: FakeClient) => client.calls.map((call) => call.name);
/** Every call but the heartbeat: reports, keepalive pings, lease polls. */
const others = (client: FakeClient) => names(client).filter((name) => name !== 'page-heartbeat');

describe.sequential('overlay page heartbeat', () => {
  beforeEach(() => {
    clients.length = 0;
    nextStatus = 'connected';
    watching = false;
    known = true;
    heartbeatSupported = true;
    vi.stubGlobal('BroadcastChannel', undefined);
    document.body.innerHTML = '<app-root ng-version="22.0.0"><app-item></app-item></app-root>';
    document.title = 'Home';
    (window as unknown as { ng: unknown }).ng = { getComponent, getDirectives: () => [] };
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    delete (window as unknown as { ng?: unknown }).ng;
  });

  it('sends one heartbeat per interval and no report while the page is idle', async () => {
    await start();
    const [client] = clients;
    expect(names(client)).toContain('page-heartbeat');
    await settle(client);

    const minutes = 3;
    await vi.advanceTimersByTimeAsync(minutes * 60_000);
    expect(others(client)).toEqual([]);
    expect(names(client)).toHaveLength((minutes * 60_000) / PAGE_HEARTBEAT_MS);
    expect(client.calls[0]!.arg).toEqual({ pageId: window.__pangularPageId });
  });

  it('sends a report that changed', async () => {
    watching = true;
    await start();
    const [client] = clients;
    await settle(client);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(others(client)).toEqual([]);

    document.querySelector('app-root')!.append(document.createElement('app-item'));
    await vi.advanceTimersByTimeAsync(5000);
    const pushes = client.calls.filter((call) => call.name === 'push-component-tree');
    expect(pushes).toHaveLength(1);
    // Only what changed: a delta, not the whole tree.
    expect(pushes[0]!.arg).not.toHaveProperty('roots');
  });

  it('sends every report again when the heartbeat says the server lost the page', async () => {
    await start();
    const [client] = clients;
    await vi.advanceTimersByTimeAsync(30_000);
    const reported = new Set(others(client).filter((name) => /^(push|report|ping)-/.test(name)));
    reported.delete('report-page-visibility');
    client.calls.length = 0;

    known = false;
    await vi.advanceTimersByTimeAsync(PAGE_HEARTBEAT_MS);
    known = true;
    await vi.advanceTimersByTimeAsync(10_000);
    const again = new Set(others(client));
    // Each report is sent again, or checked with its ping, which resends it in full.
    const missing = [...reported].filter(
      (name) => !again.has(name) && !again.has(name.replace(/^push-/, 'ping-')),
    );
    expect(missing).toEqual([]);
    expect(reported.size).toBeGreaterThan(5);

    // Then quiet again.
    client.calls.length = 0;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(others(client)).toEqual([]);
  });

  it('sends every report again after the server restarted', async () => {
    await start();
    const [first] = clients;
    await vi.advanceTimersByTimeAsync(30_000);
    const reported = new Set(others(first).filter((name) => /^push-/.test(name)));

    const kept = globalThis as Record<string, unknown>;
    kept['__DEVFRAME_CONNECTION__'] = { connectionMeta: { websocket: 9777 } };
    nextStatus = 'error';
    first.set('disconnected');
    await vi.advanceTimersByTimeAsync(20_000);
    nextStatus = 'connected';
    await vi.advanceTimersByTimeAsync(20_000);
    const live = clients.at(-1)!;
    expect(live.status).toBe('connected');
    expect(names(live)[0]).toBe('claim-page');
    const again = new Set(names(live));
    const missing = [...reported].filter(
      (name) => !again.has(name) && !again.has(name.replace(/^push-/, 'ping-')),
    );
    expect(missing).toEqual([]);
    expect(again.has('page-heartbeat')).toBe(true);
  });

  it('keeps its own keepalives against a server without the heartbeat', async () => {
    heartbeatSupported = false;
    await start();
    const [client] = clients;
    await settle(client);
    await vi.advanceTimersByTimeAsync(20_000);
    // The tree's keepalive ping and the lease poll, as before.
    expect(names(client)).toContain('ping-component-tree');
    expect(names(client)).toContain('page-interest');
  });
});
