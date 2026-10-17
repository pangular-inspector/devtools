// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeClient {
  status: string;
  readonly isTrusted: boolean;
  calls: { name: string; args: unknown[] }[];
  handlers: Map<string, (...args: unknown[]) => unknown>;
  set(status: string): void;
}

const clients: FakeClient[] = [];
let nextStatus = 'connected';
const configs = { pangular: { inspectors: { analog: false, router: true, forms: true } } };

function fakeClient(status: string): FakeClient {
  const listeners = new Set<(status: string) => void>();
  const client = {
    status,
    get isTrusted() {
      return client.status === 'connected';
    },
    calls: [] as { name: string; args: unknown[] }[],
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    connectionMeta: { backend: 'websocket', configs },
    events: {
      on: (event: string, listener: (status: string) => void) => {
        if (event !== 'connection:status') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          client.calls.push({ name, args });
          if (client.status !== 'connected') {
            throw new Error('[devframe] Not connected to the devframe server');
          }
          return undefined;
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

const stops: (() => void)[] = [];

async function start() {
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(200);
  stops.push(await pending);
}

const named = (client: FakeClient, name: string) => client.calls.filter((c) => c.name === name);

describe.sequential('overlay after a server restart', () => {
  beforeEach(() => {
    clients.length = 0;
    nextStatus = 'connected';
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('goes quiet while the server is down, then claims the page and reports again', async () => {
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      await start();
      const [first] = clients;
      await vi.advanceTimersByTimeAsync(2000);
      const pageId = window.__pangularPageId;
      expect(pageId).toBeTruthy();
      expect(named(first, 'push-component-tree').length).toBeGreaterThan(0);

      // The server stops; the next attempts find nothing.
      const kept = globalThis as Record<string, unknown>;
      kept['__DEVFRAME_CONNECTION__'] = { connectionMeta: { websocket: 9777 } };
      nextStatus = 'error';
      first.set('disconnected');
      const before = first.calls.length;
      await vi.advanceTimersByTimeAsync(20_000);
      // Nothing reaches the dead client, and every attempt so far failed.
      expect(first.calls.length).toBe(before);
      expect(clients.length).toBeGreaterThan(2);
      expect(clients.slice(1).every((client) => client.calls.length === 0)).toBe(true);

      // The server is back.
      nextStatus = 'connected';
      await vi.advanceTimersByTimeAsync(6000);
      const live = clients.at(-1)!;
      expect(live.status).toBe('connected');
      expect(named(live, 'claim-page')[0]?.args[0]).toMatchObject({ pageId });
      // The page functions are registered on the new connection.
      expect(live.handlers.has('page-interest-changed')).toBe(true);
      expect(live.handlers.has('inspect-component-in-page')).toBe(true);
      // Every report goes out again, in full, under the same page id.
      const tree = named(live, 'push-component-tree');
      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0].args[0]).toMatchObject({ pageId });
      expect(named(live, 'push-router').length).toBeGreaterThan(0);
      expect(window.__pangularPageId).toBe(pageId);
      // Each attempt reads the connection file again, in case the port changed.
      expect(kept['__DEVFRAME_CONNECTION__']).toBeUndefined();
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(seen).toEqual([]);
  });

  it('keeps calls that fail while the socket closes out of the unhandled rejections', async () => {
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      await start();
      const [first] = clients;
      // The socket is closing: calls fail before the status changes.
      first.status = 'closing';
      await vi.advanceTimersByTimeAsync(10_000);
      first.calls.length = 0;
      first.handlers.get('inspect-component-in-page')?.({ id: null });
      first.handlers.get('page-interest-changed')?.({ watching: true, wake: true });
      await vi.advanceTimersByTimeAsync(10_000);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(first.calls.length).toBeGreaterThan(0);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(seen).toEqual([]);
  });
});
