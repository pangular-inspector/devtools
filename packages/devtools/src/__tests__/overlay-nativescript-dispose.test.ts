import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const realSetImmediate = setImmediate;
const calls: [string, unknown][] = [];
const handlers = new Map<string, (...args: unknown[]) => unknown>();
let offline = false;

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
        register: (def: { name: string; handler: (...args: unknown[]) => unknown }) =>
          handlers.set(def.name, def.handler),
        call: vi.fn(async (name: string, payload: unknown) => {
          calls.push([name, payload]);
          if (offline && name.startsWith('push-')) throw new Error('offline');
          return name === 'push-signal-graph' ? { delta: true } : undefined;
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

describe('NativeScript overlay disconnect', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    calls.length = 0;
    handlers.clear();
    unhandled.length = 0;
    offline = false;
    process.on('unhandledRejection', onUnhandled);
    (globalThis as Record<string, unknown>)['ng'] = {
      getComponent: (h: unknown) => (h === host ? app : null),
      getRootComponents: () => [app],
      getHostElement: (c: unknown) => (c === app ? host : null),
      getInjector: (h: unknown) => h,
      ɵgetSignalGraph: () => ({
        nodes: [{ id: '1', kind: 'signal', label: 'count', epoch: 0, value: 0 }],
      }),
    };
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>)['ng'];
  });

  it('swallows failed pushes the panel asked for and forgets the signal page on dispose', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    const pageId = (calls.find(([name]) => name === 'push-signal-graph')![1] as { pageId: string })
      .pageId;

    offline = true;
    handlers.get('select-signal-component')!({ pageId, id: null });
    handlers.get('inspect-component-in-page')!({ pageId, id: null });
    await flush();
    await new Promise((resolve) => realSetImmediate(resolve));
    expect(unhandled).toEqual([]);

    calls.length = 0;
    dispose();
    await flush();
    expect(calls).toContainEqual(['forget-signal-page', pageId]);
  });
});
