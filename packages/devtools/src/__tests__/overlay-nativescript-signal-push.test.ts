import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Call = [string, Record<string, unknown>];

const calls: Call[] = [];
let signalValue = 0;
let failNext = false;

const host = {
  typeName: 'AppHostView',
  parent: null,
  isLoaded: true,
  eachChildView: () => undefined,
};
class AppComponent {}
Object.assign(AppComponent, { ɵcmp: { selectors: [['ns-app']] } });
const app = new AppComponent();

vi.mock('@nativescript/core', () => ({
  Application: { getRootView: () => host },
  isAndroid: false,
}));

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async () => ({
    status: 'connected',
    close: vi.fn(),
    scope: () => ({
      rpc: {
        register: vi.fn(),
        call: vi.fn(async (name: string, payload: Record<string, unknown>) => {
          if (name === 'push-signal-graph') {
            if (failNext) {
              failNext = false;
              throw new Error('offline');
            }
            calls.push([name, payload]);
            return { delta: true };
          }
          return undefined;
        }),
      },
    }),
  })),
}));

vi.mock('../signal-history.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-history.ts')>()),
  installSignalWriteHook: vi.fn(async () => () => undefined),
}));

vi.mock('../ngrx-overlay.ts', () => ({
  attachNgrx: () => ({ push: async () => undefined, stop: () => undefined }),
}));

async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

describe('NativeScript signal graph pushes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    calls.length = 0;
    signalValue = 0;
    failNext = false;
    (globalThis as Record<string, unknown>)['ng'] = {
      getComponent: (h: unknown) => (h === host ? app : null),
      getRootComponents: () => [app],
      getHostElement: (c: unknown) => (c === app ? host : null),
      getInjector: (h: unknown) => h,
      ɵgetSignalGraph: () => ({
        nodes: [
          { id: '1', kind: 'signal', label: 'count', epoch: signalValue, value: signalValue },
        ],
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>)['ng'];
  });

  it('sends the full history again after a failed push', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toHaveProperty('history');

    signalValue = 1;
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toHaveProperty('historyDelta');

    signalValue = 2;
    failNext = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);

    signalValue = 3;
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(3);
    expect(calls[2][1]).toHaveProperty('history');
    expect(calls[2][1]).not.toHaveProperty('historyDelta');
    dispose();
  });
});
