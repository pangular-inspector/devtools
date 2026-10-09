import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Client {
  options: { wsOptions: { onDisconnected: () => void } };
}

const clients: Client[] = [];
const restoreHook = vi.fn();
let hookGate: Promise<void> = Promise.resolve();
let hookInstalls = 0;

vi.mock('@nativescript/core', () => ({
  Application: { getRootView: () => null },
  isAndroid: false,
}));

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async (options: Client['options']) => {
    clients.push({ options });
    return {
      status: 'connected',
      close: vi.fn(),
      scope: () => ({ rpc: { call: vi.fn(async () => undefined), register: vi.fn() } }),
    };
  }),
}));

vi.mock('../signal-history.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-history.ts')>()),
  installSignalWriteHook: vi.fn(async () => {
    hookInstalls++;
    await hookGate;
    return restoreHook;
  }),
}));

vi.mock('../ngrx-overlay.ts', () => ({
  attachNgrx: () => ({ push: async () => undefined, stop: () => undefined }),
}));

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('NativeScript overlay sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    clients.length = 0;
    restoreHook.mockClear();
    hookInstalls = 0;
    hookGate = Promise.resolve();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tears down a session whose socket closed while it was still starting', async () => {
    let release!: () => void;
    hookGate = new Promise<void>((resolve) => (release = resolve));
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', retryMs: 100 });
    await flush();
    expect(clients).toHaveLength(1);

    clients[0].options.wsOptions.onDisconnected();
    release();
    await flush();
    expect(restoreHook).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(clients).toHaveLength(2);
    await flush();
    dispose();
    expect(restoreHook).toHaveBeenCalledTimes(2);
    expect(hookInstalls).toBe(2);
  });
});
