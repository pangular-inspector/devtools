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
});
