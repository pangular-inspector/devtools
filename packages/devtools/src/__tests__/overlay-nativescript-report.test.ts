import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; at: number }[] = [];
let failTree = false;
let failOnce: string | null = null;

vi.mock('@nativescript/core', () => ({
  Application: { getRootView: () => null },
  isAndroid: false,
}));

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async () => ({
    status: 'connected',
    close: vi.fn(),
    scope: () => ({
      rpc: {
        call: vi.fn(async (name: string) => {
          calls.push({ name, at: Date.now() });
          if (failTree && name === 'push-component-tree') throw new Error('rejected');
          if (failOnce === name) {
            failOnce = null;
            throw new Error('rejected');
          }
          return undefined;
        }),
        register: vi.fn(),
      },
    }),
  })),
}));

vi.mock('../signal-history.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-history.ts')>()),
  installSignalWriteHook: vi.fn(async () => () => undefined),
}));

vi.mock('../ngrx-overlay.ts', () => ({
  attachNgrx: () => ({
    push: async () => {
      calls.push({ name: 'push-ngrx', at: Date.now() });
    },
    stop: () => undefined,
  }),
}));

vi.mock('../component-tree.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../component-tree.ts')>()),
  collectComponentTree: () => ({ count: 0, roots: [] }),
}));

vi.mock('../signal-graph.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-graph.ts')>()),
  collectSignalGraph: () => ({ component: null, nodes: [] }),
  graphKey: () => 'same',
}));

vi.mock('../injector-tree.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../injector-tree.ts')>()),
  collectInjectorTree: () => ({ count: 0, roots: [] }),
}));

async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

describe('NativeScript overlay reports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    vi.stubGlobal('ng', { getComponent: () => null });
    calls.length = 0;
    failTree = false;
    failOnce = null;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps sending the other collectors when one push is rejected', async () => {
    failTree = true;
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({
      baseURL: 'http://localhost:9999/',
      intervalMs: 3000,
    });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    const names = calls.map((c) => c.name);
    expect(names).toContain('push-component-tree');
    expect(names).toContain('push-signal-graph');
    expect(names).toContain('push-injector-tree');
    expect(names).toContain('push-ngrx');
    dispose();
  });

  it.each(['push-component-tree', 'push-injector-tree'])(
    'retries an unchanged %s on the next tick after it was rejected',
    async (name) => {
      failOnce = name;
      const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
      const dispose = initNativeScriptOverlay({
        baseURL: 'http://localhost:9999/',
        intervalMs: 3000,
      });
      await vi.advanceTimersByTimeAsync(0);
      await flush();
      await vi.advanceTimersByTimeAsync(3000);
      expect(calls.filter((c) => c.name === name)).toHaveLength(2);
      dispose();
    },
  );

  it('re-sends an unchanged tree within the page expiry at a slow interval', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({
      baseURL: 'http://localhost:9999/',
      intervalMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    const times = calls.filter((c) => c.name === 'push-component-tree').map((c) => c.at);
    const gaps = times.slice(1).map((at, i) => at - times[i]);
    expect(times.length).toBeGreaterThan(2);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(15_000);
    dispose();
  });
});
