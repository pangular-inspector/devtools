// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capacitorHook } from '../capacitor-collector.ts';
import { attachCapacitor } from '../capacitor-overlay.ts';
import type { CapacitorReport } from '../rpc/capacitor-tools.ts';

function fakeCapacitor() {
  return {
    getPlatform: () => 'ios',
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
    Plugins: { Preferences: {} },
    nativePromise: vi.fn(async (_plugin: string, method: string, _options?: unknown) =>
      method === 'get' ? { value: 'dark' } : undefined,
    ),
    nativeCallback: vi.fn(() => '1'),
  };
}

function fakeRpc(answer: (report: CapacitorReport) => unknown = () => ({ known: true })) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    pushes: () =>
      calls
        .filter(([name]) => name === 'push-capacitor')
        .map(([, report]) => report as CapacitorReport),
    my: {
      rpc: {
        call: vi.fn(async (name: string, arg: unknown) => {
          calls.push([name, arg]);
          return name === 'push-capacitor' ? answer(arg as CapacitorReport) : undefined;
        }),
      },
    },
  };
}

const stops: (() => void)[] = [];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.useRealTimers();
});

function attach(rpc: ReturnType<typeof fakeRpc>, win: { Capacitor?: unknown }) {
  const capacitor = attachCapacitor(rpc.my, 'cap1', {
    maxCalls: 50,
    devtoolsUrl: 'http://192.168.1.20:4000/__devframes/pangular/__connection.json',
    win,
  });
  stops.push(capacitor.stop);
  return capacitor;
}

describe('attachCapacitor', () => {
  it('sends nothing on a page without Capacitor', async () => {
    const rpc = fakeRpc();
    attach(rpc, {});
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rpc.calls).toEqual([]);
  });

  it('sends the platform first, then only the calls that changed', async () => {
    const rpc = fakeRpc();
    const cap = fakeCapacitor();
    attach(rpc, { Capacitor: cap });
    await vi.advanceTimersByTimeAsync(0);

    const [first] = rpc.pushes();
    expect(first).toMatchObject({ pageId: 'cap1', full: true, calls: [], listeners: [] });
    expect(first.info).toMatchObject({ platform: 'ios', native: true, bridge: true });

    await cap.nativePromise('Preferences', 'get', { key: 'theme' });
    await vi.advanceTimersByTimeAsync(300);
    await cap.nativePromise('Preferences', 'set', { key: 'theme', value: 'light' });
    await vi.advanceTimersByTimeAsync(300);

    const [, second, third] = rpc.pushes();
    expect(second).toMatchObject({ full: false, calls: [{ method: 'get', status: 'ok' }] });
    expect(second.info).toBeUndefined();
    expect(third.calls.map((call) => call.method)).toEqual(['set']);
  });

  it('pings while nothing changes, so the server keeps the page', async () => {
    const rpc = fakeRpc();
    attach(rpc, { Capacitor: fakeCapacitor() });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rpc.pushes()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(8_000);
    const pushes = rpc.pushes();
    expect(pushes.length).toBeGreaterThan(1);
    expect(pushes.at(-1)).toMatchObject({ full: false, calls: [] });
  });

  it('sends everything again when the server no longer knows the page', async () => {
    let known = true;
    // Like the server: a full report is always taken.
    const rpc = fakeRpc((report) => ({ known: report.full || known }));
    const cap = fakeCapacitor();
    attach(rpc, { Capacitor: cap });
    await vi.advanceTimersByTimeAsync(0);
    await cap.nativePromise('Preferences', 'get', {});
    await vi.advanceTimersByTimeAsync(300);

    known = false;
    await cap.nativePromise('Preferences', 'set', {});
    await vi.advanceTimersByTimeAsync(300);
    known = true;
    await vi.advanceTimersByTimeAsync(10);

    const last = rpc.pushes().at(-1)!;
    expect(last.full).toBe(true);
    expect(last.info).toBeDefined();
    expect(last.calls.map((call) => call.method)).toEqual(['get', 'set']);
  });

  it("leaves the overlay's own requests to the devtools server out of the log", async () => {
    const rpc = fakeRpc();
    const cap = fakeCapacitor();
    attach(rpc, { Capacitor: cap });
    await vi.advanceTimersByTimeAsync(0);

    await cap.nativePromise('CapacitorHttp', 'request', {
      url: 'http://192.168.1.20:4000/__devframes/__sse',
    });
    await cap.nativePromise('CapacitorHttp', 'request', { url: 'https://api.example.com/trips' });
    await vi.advanceTimersByTimeAsync(300);

    const logged = rpc.pushes().flatMap((report) => report.calls);
    expect(logged.map((call) => (call.args as { url: string }).url)).toEqual([
      'https://api.example.com/trips',
    ]);
  });

  it('tells the server to forget the page when it leaves, and reports again after pageshow', async () => {
    const rpc = fakeRpc();
    const capacitor = attach(rpc, { Capacitor: fakeCapacitor() });
    await vi.advanceTimersByTimeAsync(0);

    capacitor.leave();
    expect(rpc.calls.at(-1)).toEqual(['forget-capacitor-page', 'cap1']);
    const before = rpc.pushes().length;
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rpc.pushes()).toHaveLength(before);

    capacitor.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.pushes().at(-1)?.full).toBe(true);
  });

  it('forgets a page that leaves while its first push is on its way, once the push lands', async () => {
    let land!: () => void;
    const rpc = fakeRpc();
    const call = rpc.my.rpc.call.getMockImplementation()!;
    rpc.my.rpc.call.mockImplementation(async (name: string, arg: unknown) => {
      if (name === 'push-capacitor' && !land) await new Promise<void>((done) => (land = done));
      return call(name, arg);
    });
    const capacitor = attach(rpc, { Capacitor: fakeCapacitor() });
    await vi.advanceTimersByTimeAsync(0);

    capacitor.leave();
    expect(rpc.calls).toEqual([]);
    land();
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.calls.map(([name]) => name)).toEqual(['push-capacitor', 'forget-capacitor-page']);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rpc.calls).toHaveLength(2);
  });

  it('waits for a forget on its way before it reports again after pageshow', async () => {
    let forgotten!: () => void;
    const rpc = fakeRpc();
    const call = rpc.my.rpc.call.getMockImplementation()!;
    rpc.my.rpc.call.mockImplementation(async (name: string, arg: unknown) => {
      if (name === 'forget-capacitor-page') await new Promise<void>((done) => (forgotten = done));
      return call(name, arg);
    });
    const capacitor = attach(rpc, { Capacitor: fakeCapacitor() });
    await vi.advanceTimersByTimeAsync(0);

    capacitor.leave();
    capacitor.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.pushes()).toHaveLength(1);
    forgotten();
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.calls.map(([name]) => name)).toEqual([
      'push-capacitor',
      'forget-capacitor-page',
      'push-capacitor',
    ]);
  });

  it('restores the bridge when it stops', () => {
    const cap = fakeCapacitor();
    const original = cap.nativePromise;
    const capacitor = attach(fakeRpc(), { Capacitor: cap });
    expect(cap.nativePromise).not.toBe(original);
    capacitor.stop();
    expect(cap.nativePromise).toBe(original);
  });

  it('sends the calls an early hook logged before the overlay started, and leaves that hook running', async () => {
    const cap = fakeCapacitor();
    const win = { Capacitor: cap };
    const { hook } = capacitorHook(win as Parameters<typeof capacitorHook>[0]);
    await cap.nativePromise('SplashScreen', 'hide', {});

    const rpc = fakeRpc();
    const capacitor = attach(rpc, win);
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.pushes()[0].calls.map((call) => call.method)).toEqual(['hide']);

    capacitor.stop();
    await cap.nativePromise('StatusBar', 'hide', {});
    expect(hook.calls().map((call) => call.plugin)).toEqual(['SplashScreen', 'StatusBar']);
    hook.stop();
  });

  it('starts reporting when Capacitor shows up a little after the overlay, and counts dropped calls', async () => {
    const rpc = fakeRpc();
    const win: { Capacitor?: ReturnType<typeof fakeCapacitor> } = {};
    const capacitor = attachCapacitor(rpc.my, 'cap1', { maxCalls: 2, tickMs: 1000, win });
    stops.push(capacitor.stop);
    await vi.advanceTimersByTimeAsync(1000);
    expect(rpc.pushes()).toEqual([]);

    win.Capacitor = fakeCapacitor();
    await vi.advanceTimersByTimeAsync(1000);
    for (const method of ['get', 'set', 'remove']) {
      await win.Capacitor.nativePromise('Preferences', method, {});
    }
    await vi.advanceTimersByTimeAsync(300);

    expect(rpc.pushes().flatMap((r) => r.calls.map((c) => c.method))).toContain('remove');
    expect(rpc.pushes().at(-1)?.dropped).toBe(1);
  });

  it('gives up on a page without Capacitor after a few checks, wrapping nothing', async () => {
    const rpc = fakeRpc();
    const win: { Capacitor?: unknown; __pangularCapacitorHook?: unknown } = {};
    const capacitor = attachCapacitor(rpc.my, 'cap1', { maxCalls: 50, tickMs: 1000, win });
    stops.push(capacitor.stop);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.getTimerCount()).toBe(0);

    win.Capacitor = fakeCapacitor();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rpc.calls).toEqual([]);
    expect(win.__pangularCapacitorHook).toBeUndefined();

    capacitor.leave();
    // Nothing went out, so there is nothing to forget.
    expect(rpc.calls).toEqual([]);
  });

  it('backs off after a failed push instead of resending at once', async () => {
    const rpc = fakeRpc();
    rpc.my.rpc.call.mockImplementation(async (name: string, arg: unknown) => {
      rpc.calls.push([name, arg]);
      throw new Error('socket closed');
    });
    const cap = fakeCapacitor();
    attach(rpc, { Capacitor: cap });
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.pushes()).toHaveLength(1);

    // A change right after the failure waits for the backoff.
    await cap.nativePromise('Preferences', 'get', {});
    await vi.advanceTimersByTimeAsync(900);
    expect(rpc.pushes()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(rpc.pushes()).toHaveLength(2);

    // The waits double: about 2s, then 4s.
    await vi.advanceTimersByTimeAsync(1_700);
    expect(rpc.pushes()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(rpc.pushes()).toHaveLength(3);
  });

  it('stops pushing when the server has no push-capacitor function', async () => {
    const rpc = fakeRpc();
    rpc.my.rpc.call.mockImplementation(async (name: string, arg: unknown) => {
      rpc.calls.push([name, arg]);
      throw new Error('[birpc] function "pangular:push-capacitor" not found');
    });
    const cap = fakeCapacitor();
    attach(rpc, { Capacitor: cap });
    await vi.advanceTimersByTimeAsync(0);
    await cap.nativePromise('Preferences', 'get', {});
    await vi.advanceTimersByTimeAsync(20_000);
    expect(rpc.pushes()).toHaveLength(1);
  });

  it('pauses while the tab is hidden', async () => {
    const rpc = fakeRpc();
    const events = new EventTarget();
    const doc = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    const capacitor = attachCapacitor(rpc.my, 'cap1', {
      maxCalls: 50,
      win: { Capacitor: fakeCapacitor() },
      doc,
    });
    stops.push(capacitor.stop);
    await vi.advanceTimersByTimeAsync(0);
    const first = rpc.pushes().length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(rpc.pushes()).toHaveLength(first);

    doc.visibilityState = 'visible';
    events.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rpc.pushes().length).toBeGreaterThan(first);
  });

  it("runs its timers and pushes outside Angular's zone", async () => {
    const run = vi.fn((fn: () => unknown) => fn());
    vi.stubGlobal('Zone', { root: { run } });
    try {
      attach(fakeRpc(), { Capacitor: fakeCapacitor() });
      await vi.advanceTimersByTimeAsync(0);
      expect(run.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
