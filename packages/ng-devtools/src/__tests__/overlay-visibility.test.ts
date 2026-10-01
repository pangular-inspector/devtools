// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEEPALIVE_MS, keepaliveDue } from '../change-detection.ts';

const calls: { name: string; at: number; args: unknown[] }[] = [];
let configs: Record<string, unknown> | undefined;

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: { backend: 'websocket', configs },
    scope: () => ({
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, at: Date.now(), args });
          return undefined;
        },
        register: () => {},
      },
    }),
  }),
}));

let hidden = false;
const stops: (() => void)[] = [];

async function start(config: Record<string, unknown> = {}) {
  configs = { 'ng-devtools': { inspectors: { router: false, analog: false }, ...config } };
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(200);
  stops.push(await pending);
}

const sent = (name: string) => calls.filter((call) => call.name === name);

function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

describe.sequential('overlay keepalive and background tabs', () => {
  beforeEach(() => {
    calls.length = 0;
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

  it('sends an unchanged report on a tick when the next tick would be too late', () => {
    expect(keepaliveDue(10, 8000, 8000)).toBe(true);
    expect(keepaliveDue(10, 4000, 4000)).toBe(false);
    expect(keepaliveDue(10, 4000, 8000)).toBe(true);
    expect(keepaliveDue(0, 0, KEEPALIVE_MS)).toBe(false);
  });

  it.each([7600, 8000])('reports well inside the 15 s TTL with refreshMs %i', async (refreshMs) => {
    await start({ limits: { refreshMs } });
    const from = Date.now();
    calls.length = 0;
    await vi.advanceTimersByTimeAsync(60_000);
    for (const name of ['component-tree', 'injector-tree', 'http']) {
      const reports = [...sent(`push-${name}`), ...sent(`ping-${name}`)].map((call) => call.at);
      const times = [from, ...reports.sort((a, b) => a - b)];
      const gaps = times.slice(1).map((at, i) => at - times[i]);
      expect(gaps.length, name).toBeGreaterThan(0);
      expect(Math.max(...gaps), name).toBeLessThanOrEqual(refreshMs);
    }
  });

  it('stops collecting in a background tab and says so, then reports again when back', async () => {
    await start();
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent('report-page-visibility').at(-1)?.args[0]).toMatchObject({ hidden: true });

    calls.length = 0;
    await vi.advanceTimersByTimeAsync(130_000);
    expect(sent('push-component-tree')).toEqual([]);
    expect(sent('ping-component-tree')).toEqual([]);
    expect(sent('report-page-visibility').length).toBeGreaterThanOrEqual(2);

    calls.length = 0;
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent('report-page-visibility').at(-1)?.args[0]).toMatchObject({ hidden: false });
    expect(sent('push-component-tree').length + sent('ping-component-tree').length).toBe(1);
  });

  it('clears the background mark when the page goes away', async () => {
    await start();
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent('report-page-visibility').at(-1)?.args[0]).toMatchObject({ hidden: false });
  });

  it('does not mark a closed tab as in the background', async () => {
    await start();
    window.dispatchEvent(new Event('pagehide'));
    setHidden(true);
    await vi.advanceTimersByTimeAsync(130_000);
    const reports = sent('report-page-visibility').map((call) => call.args[0]);
    expect(reports).not.toContainEqual(expect.objectContaining({ hidden: true }));
    expect(reports.at(-1)).toMatchObject({ hidden: false });
  });

  it('stops the background heartbeat when a hidden tab goes away', async () => {
    await start();
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('pagehide'));
    calls.length = 0;
    await vi.advanceTimersByTimeAsync(130_000);
    expect(sent('report-page-visibility')).toEqual([]);
  });

  it('reports a background tab again after it comes back from the back/forward cache', async () => {
    await start();
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    calls.length = 0;
    window.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(0);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent('report-page-visibility').at(-1)?.args[0]).toMatchObject({ hidden: true });
  });
});
