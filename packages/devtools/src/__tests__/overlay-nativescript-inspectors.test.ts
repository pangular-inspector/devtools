import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: [string, unknown][] = [];
const attachNgrx = vi.fn(() => ({ push: async () => undefined, stop: () => undefined }));
const installSignalWriteHook = vi.fn(async () => () => undefined);
let connectionMeta: { configs?: object } = {};

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
    ensureTrusted: async () => true,
    connectionMeta,
    close: vi.fn(),
    scope: () => ({
      rpc: {
        register: vi.fn(),
        call: vi.fn(async (name: string, payload: unknown) => {
          calls.push([name, payload]);
          return undefined;
        }),
      },
    }),
  })),
}));

vi.mock('../signal-history.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-history.ts')>()),
  installSignalWriteHook,
}));

vi.mock('../ngrx-overlay.ts', () => ({ attachNgrx }));

async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

const names = () => calls.map(([name]) => name);

describe('NativeScript overlay inspectors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    calls.length = 0;
    attachNgrx.mockClear();
    installSignalWriteHook.mockClear();
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
    connectionMeta = {};
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>)['ng'];
  });

  it('runs every collector by default and forgets each page on dispose', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    // The collectors report one after another.
    await vi.advanceTimersByTimeAsync(50);
    await flush();
    expect(names()).toEqual(
      expect.arrayContaining([
        'push-component-tree',
        'push-signal-graph',
        'push-injector-tree',
        'push-leaks',
        'push-errors',
        'push-startup',
        'report-page-angular',
      ]),
    );
    for (const [name, payload] of calls) {
      if (name.startsWith('push-') || name === 'report-page-angular') {
        expect(payload).toMatchObject({ pageId: expect.any(String) });
      }
    }
    expect(calls.find(([name]) => name === 'push-errors')?.[1]).toMatchObject({
      url: '/',
      title: 'NativeScript (iOS)',
    });
    expect(attachNgrx).toHaveBeenCalledTimes(1);
    expect(installSignalWriteHook).toHaveBeenCalledTimes(1);

    calls.length = 0;
    dispose();
    await flush();
    expect(names()).toEqual(
      expect.arrayContaining([
        'forget-component-page',
        'forget-signal-page',
        'forget-injector-page',
        'forget-ngrx-page',
        'forget-pipes-page',
        'forget-change-detection-page',
        'forget-leaks-page',
        'forget-errors-page',
        'forget-startup-page',
        'forget-page-angular',
      ]),
    );
  });

  it('does not collect, push or forget for inspectors the config turns off', async () => {
    connectionMeta = {
      configs: {
        pangular: {
          inspectors: {
            components: false,
            signals: false,
            ngrx: false,
            pipes: false,
            errors: false,
            tanstackQuery: false,
            plugins: false,
          },
        },
      },
    };
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    await vi.advanceTimersByTimeAsync(300);
    await flush();

    expect(names()).toContain('push-injector-tree');
    expect(names()).not.toContain('push-component-tree');
    expect(names()).not.toContain('push-signal-graph');
    expect(names()).not.toContain('ping-component-tree');
    expect(names()).not.toContain('ping-signal-graph');
    expect(attachNgrx).not.toHaveBeenCalled();
    expect(installSignalWriteHook).not.toHaveBeenCalled();
    expect(names().some((name) => name.includes('pipe'))).toBe(false);
    for (const off of ['change-detection', 'leaks', 'errors', 'tanstack-query', 'redux-stores']) {
      expect(names().some((name) => name.includes(off))).toBe(false);
    }
    expect(names()).toEqual(expect.arrayContaining(['push-startup', 'report-page-angular']));

    calls.length = 0;
    dispose();
    await flush();
    expect(names().sort()).toEqual([
      'forget-injector-page',
      'forget-page-angular',
      'forget-startup-page',
    ]);
  });
});
