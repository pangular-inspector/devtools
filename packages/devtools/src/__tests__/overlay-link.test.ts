import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDevframe } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OverlayOfflineError,
  createOverlayLink,
  type LinkClient,
  type PageFunction,
} from '../overlay-link.ts';
import { initPangularHub } from '../hub.ts';

/** A devframe client stand-in whose status the test drives. */
function fakeClient(status = 'connected') {
  const listeners = new Set<(status: string) => void>();
  const calls: { name: string; args: unknown[] }[] = [];
  const registered: PageFunction[] = [];
  const client = {
    status,
    get isTrusted() {
      return client.status === 'connected';
    },
    events: {
      on: (_event: 'connection:status', listener: (status: string) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, args });
          return { known: true };
        },
        register: (definition: PageFunction) => registered.push(definition),
      },
    }),
    close: vi.fn(),
    calls,
    registered,
    set(next: string) {
      client.status = next;
      for (const listener of [...listeners]) listener(next);
    },
  };
  return client;
}

const handler: PageFunction = {
  name: 'page-interest-changed',
  type: 'event',
  jsonSerializable: true,
  handler: () => {},
};

describe('overlay link', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls the live client and registers page functions on it', async () => {
    const first = fakeClient();
    const link = createOverlayLink(first as LinkClient, { connect: vi.fn() });
    link.scope.rpc.register(handler);
    await link.scope.rpc.call('push-router', { pageId: 'p1' });
    expect(first.registered.map((d) => d.name)).toEqual(['page-interest-changed']);
    expect(first.calls).toEqual([{ name: 'push-router', args: [{ pageId: 'p1' }] }]);
    link.stop();
  });

  it('pauses on a drop, rejects calls quietly, and reconnects with backoff', async () => {
    const first = fakeClient();
    const second = fakeClient('connecting');
    const connect = vi
      .fn<() => Promise<LinkClient>>()
      .mockRejectedValueOnce(new Error('server down'))
      .mockResolvedValueOnce(second as LinkClient);
    const dropped = vi.fn();
    const restored = vi.fn();
    const link = createOverlayLink(first as LinkClient, { connect, delaysMs: [100, 1000] });
    link.follow({ dropped, restored });
    link.scope.rpc.register(handler);

    first.set('disconnected');
    expect(dropped).toHaveBeenCalledTimes(1);
    expect(first.close).toHaveBeenCalled();
    await expect(link.scope.rpc.call('push-forms', {})).rejects.toBeInstanceOf(OverlayOfflineError);

    await vi.advanceTimersByTimeAsync(100);
    expect(connect).toHaveBeenCalledTimes(1);
    // The second attempt waits for the next delay.
    await vi.advanceTimersByTimeAsync(999);
    expect(connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(connect).toHaveBeenCalledTimes(2);
    // Not trusted yet: nothing is sent and the page is not restored.
    expect(restored).not.toHaveBeenCalled();

    second.set('connected');
    await vi.advanceTimersByTimeAsync(0);
    expect(second.registered.map((d) => d.name)).toEqual(['page-interest-changed']);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(dropped).toHaveBeenCalledTimes(1);
    await link.scope.rpc.call('push-forms', { pageId: 'p1' });
    expect(second.calls.map((c) => c.name)).toEqual(['push-forms']);
    expect(first.calls).toEqual([]);
    link.stop();
  });

  it('drops a connection that does not get trusted in time and tries again', async () => {
    const first = fakeClient();
    const stuck = fakeClient('connecting');
    const next = fakeClient('connected');
    const connect = vi
      .fn<() => Promise<LinkClient>>()
      .mockResolvedValueOnce(stuck as LinkClient)
      .mockResolvedValueOnce(next as LinkClient);
    const restored = vi.fn();
    const link = createOverlayLink(first as LinkClient, {
      connect,
      delaysMs: [10],
      trustTimeoutMs: 500,
    });
    link.follow({ dropped: () => {}, restored });
    first.set('error');
    await vi.advanceTimersByTimeAsync(10);
    expect(restored).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(stuck.close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(restored).toHaveBeenCalledTimes(1);
    link.stop();
  });

  it('goes quiet with one warning when the server revokes the page, and does not reconnect', async () => {
    const first = fakeClient();
    const connect = vi.fn<() => Promise<LinkClient>>();
    const warn = vi.fn();
    const dropped = vi.fn();
    const restored = vi.fn();
    const link = createOverlayLink(first as LinkClient, { connect, delaysMs: [10], warn });
    link.follow({ dropped, restored });

    first.set('unauthorized');
    first.set('unauthorized');
    expect(dropped).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/revoked/);
    await expect(link.scope.rpc.call('push-forms', {})).rejects.toBeInstanceOf(OverlayOfflineError);
    expect(first.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(connect).not.toHaveBeenCalled();
    expect(first.close).not.toHaveBeenCalled();

    // Trusted again (a code entered in another tab): reports resume on the same client.
    first.set('connected');
    await vi.advanceTimersByTimeAsync(0);
    expect(restored).toHaveBeenCalledTimes(1);
    await link.scope.rpc.call('push-forms', { pageId: 'p1' });
    expect(first.calls.map((c) => c.name)).toEqual(['push-forms']);
    link.stop();
  });

  it('leaves a first connection that waits for its code alone', async () => {
    const first = fakeClient('connecting');
    const warn = vi.fn();
    const dropped = vi.fn();
    const link = createOverlayLink(first as LinkClient, { connect: vi.fn(), warn });
    link.follow({ dropped, restored: vi.fn() });
    first.set('unauthorized');
    expect(dropped).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    link.stop();
  });

  it('stops trying with one warning when the server refuses the page', async () => {
    const first = fakeClient();
    const refused = fakeClient('unauthorized');
    const connect = vi.fn(async () => refused as LinkClient);
    const warn = vi.fn();
    const link = createOverlayLink(first as LinkClient, { connect, delaysMs: [10], warn });
    link.follow({ dropped: () => {}, restored: () => {} });
    first.set('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Reload the page/);
    link.stop();
  });

  it('stops reconnecting once stopped', async () => {
    const first = fakeClient();
    const connect = vi.fn(async () => fakeClient() as LinkClient);
    const link = createOverlayLink(first as LinkClient, { connect, delaysMs: [10] });
    first.set('disconnected');
    link.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('overlay link against a real server', () => {
  const cleanups: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** Starts a hub on `port` (0 picks one) and returns its port and a stop function. */
  async function serve(port = 0) {
    const hub = initPangularHub({ ws: false, auth: false, mcp: false });
    const server: Server = createServer((req, res) =>
      hub.nodeMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    const stop = async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await hub.close();
    };
    return { port: (server.address() as AddressInfo).port, stop };
  }

  it('reconnects after the server restarts and sends through the new connection', async () => {
    const storage = mkdtempSync(join(tmpdir(), 'pangular-link-'));
    vi.stubEnv('XDG_CONFIG_HOME', storage);
    cleanups.push(() => rmSync(storage, { recursive: true, force: true }));
    const first = await serve();
    let current = first.stop;
    cleanups.push(() => current());
    vi.stubGlobal('location', new URL(`http://127.0.0.1:${first.port}/`));
    const baseURL = `http://127.0.0.1:${first.port}/__devframes/pangular/`;
    const connect = async () =>
      (await connectDevframe({
        baseURL,
        simpleAuth: false,
        otpParam: false,
        webmcp: false,
      })) as unknown as LinkClient;

    const client = await connect();
    const link = createOverlayLink(client, { connect, delaysMs: [100] });
    cleanups.push(() => link.stop());
    const dropped = vi.fn();
    let restoredAt = 0;
    link.follow({ dropped, restored: () => void (restoredAt = Date.now()) });
    await vi.waitFor(() => expect(client.status).toBe('connected'), { timeout: 5000 });
    expect(await link.scope.rpc.call('ping-router', 'page-1')).toEqual({ known: false });

    await first.stop();
    await vi.waitFor(() => expect(dropped).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await expect(link.scope.rpc.call('ping-router', 'page-1')).rejects.toBeInstanceOf(
      OverlayOfflineError,
    );

    const startedAt = Date.now();
    const second = await serve(first.port);
    current = second.stop;
    await vi.waitFor(() => expect(restoredAt).toBeGreaterThan(0), { timeout: 10_000 });
    expect(restoredAt - startedAt).toBeLessThan(5000);
    expect(
      await link.scope.rpc.call('push-router', {
        pageId: 'page-1',
        snapshot: null,
        navigations: [],
      }),
    ).toBeDefined();
    expect(await link.scope.rpc.call('ping-router', 'page-1')).toEqual({ known: true });
  }, 30_000);
});

describe('overlay reconnect options', () => {
  it('tries only the mount that answered, without the blocking prompt', async () => {
    const { overlayReconnectOptions } = await import('../overlay-connection.ts');
    const options = overlayReconnectOptions(
      {},
      ['/__pangular/', '/__devframes/pangular/'],
      'http://localhost:4000/__devframes/pangular/__connection.json',
      {},
    );
    expect(options).toMatchObject({
      baseURL: 'http://localhost:4000/__devframes/pangular/',
      simpleAuth: false,
    });
  });

  it('keeps the bases it was given when it never connected or got connectionMeta', async () => {
    const { overlayReconnectOptions } = await import('../overlay-connection.ts');
    expect(overlayReconnectOptions({}, ['/__pangular/'], undefined, {}).baseURL).toEqual([
      '/__pangular/',
    ]);
    const manual = overlayReconnectOptions(
      {
        baseURL: 'http://192.168.1.20:9999/',
        connectionMeta: { configs: { pangular: {} } },
      },
      ['/__pangular/'],
      'http://192.168.1.20:9999/elsewhere/__connection.json',
      {},
    );
    expect(manual.baseURL).toBe('http://192.168.1.20:9999/');
  });
});
