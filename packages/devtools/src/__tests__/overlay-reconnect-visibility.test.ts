// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeClient {
  status: string;
  readonly isTrusted: boolean;
  calls: { name: string; args: unknown[] }[];
  set(status: string): void;
}

const clients: FakeClient[] = [];
let nextStatus = 'connected';
/** While set, `claim-page` waits for it, so a test can drop the link during the call. */
let claimGate: Promise<void> | null = null;
const configs = { pangular: { inspectors: { analog: false, router: false } } };

function fakeClient(status: string): FakeClient {
  const listeners = new Set<(status: string) => void>();
  const client = {
    status,
    get isTrusted() {
      return client.status === 'connected';
    },
    calls: [] as { name: string; args: unknown[] }[],
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
          if (name === 'claim-page' && claimGate) await claimGate;
          if (client.status !== 'connected') {
            throw new Error('[devframe] Not connected to the devframe server');
          }
          return undefined;
        },
        register: () => {},
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

/** Change-detection watchers (the overlay's refresher) that are started and not stopped. */
let watching = 0;
vi.mock('../change-detection.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../change-detection.ts')>();
  return {
    ...actual,
    watchChangeDetection: (options: Parameters<typeof actual.watchChangeDetection>[0]) => {
      const scheduler = actual.watchChangeDetection(options);
      watching++;
      let stopped = false;
      const stop = scheduler.stop;
      scheduler.stop = () => {
        if (!stopped) watching--;
        stopped = true;
        stop();
      };
      return scheduler;
    },
  };
});

let hidden = false;
const stops: (() => void)[] = [];

async function start() {
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(200);
  stops.push(await pending);
}

function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

const named = (client: FakeClient, name: string) => client.calls.filter((c) => c.name === name);
const visibility = (client: FakeClient) =>
  named(client, 'report-page-visibility').map((call) => call.args[0]);

describe.sequential('overlay reconnect and page visibility', () => {
  beforeEach(() => {
    clients.length = 0;
    nextStatus = 'connected';
    claimGate = null;
    watching = 0;
    hidden = false;
    vi.stubGlobal('BroadcastChannel', undefined);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
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

  it('reports a page that reconnects in a background tab as hidden and keeps it marked', async () => {
    await start();
    const [first] = clients;
    await vi.advanceTimersByTimeAsync(2000);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(visibility(first).at(-1)).toMatchObject({ hidden: true });

    // The server restarts while the tab is in the background.
    first.set('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    const live = clients.at(-1)!;
    expect(live).not.toBe(first);
    expect(named(live, 'claim-page').length).toBe(1);

    // The new server hears that the page is hidden, so it does not expire it.
    expect(visibility(live).at(-1)).toMatchObject({ hidden: true });
    expect(watching).toBe(0);
    live.calls.length = 0;
    await vi.advanceTimersByTimeAsync(130_000);
    const reports = visibility(live);
    expect(reports.length).toBeGreaterThanOrEqual(2);
    expect(reports.every((report) => (report as { hidden: boolean }).hidden)).toBe(true);
    expect(named(live, 'push-component-tree')).toEqual([]);

    // Back to the tab: it reports and collects as usual.
    live.calls.length = 0;
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(visibility(live).at(-1)).toMatchObject({ hidden: false });
    expect(watching).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(named(live, 'page-heartbeat').length).toBeGreaterThan(0);
  });

  it('stays quiet when the link drops again while the page is being claimed', async () => {
    await start();
    const [first] = clients;
    await vi.advanceTimersByTimeAsync(2000);
    expect(watching).toBe(1);

    let openGate = () => {};
    claimGate = new Promise<void>((resolve) => (openGate = resolve));
    first.set('disconnected');
    expect(watching).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    const second = clients.at(-1)!;
    expect(named(second, 'claim-page').length).toBe(1);

    // The new connection drops before the claim answers, and the server stays down.
    nextStatus = 'error';
    second.set('disconnected');
    openGate();
    await vi.advanceTimersByTimeAsync(0);
    expect(watching).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(watching).toBe(0);

    // When the server is back, the page reports as usual.
    claimGate = null;
    nextStatus = 'connected';
    await vi.advanceTimersByTimeAsync(60_000);
    const live = clients.at(-1)!;
    expect(live.status).toBe('connected');
    expect(named(live, 'claim-page').length).toBe(1);
    expect(watching).toBe(1);
    expect(named(live, 'push-component-tree').length).toBeGreaterThan(0);
  });
});
