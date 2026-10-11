// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_INSPECTORS } from '../config.ts';
import { createScanBackoff } from '../router-attach.ts';

const calls: string[] = [];
const routerReports: { navigations: { id: number; url: string; outcome: string }[] }[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: {
      backend: 'websocket',
      configs: {
        pangular: {
          inspectors: Object.fromEntries(PANGULAR_INSPECTORS.map((key) => [key, key === 'router'])),
          limits: { refreshMs: 500 },
        },
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, arg: unknown) => {
          calls.push(name);
          if (name === 'push-router') routerReports.push(JSON.parse(JSON.stringify(arg)));
          return undefined;
        },
        register: () => {},
      },
    }),
  }),
}));

describe('router scan back-off', () => {
  it('waits 1, 2, 4 ... pushes between scans up to the cap', () => {
    const backoff = createScanBackoff(4);
    const runs: number[] = [];
    for (let push = 0; push < 30; push++) {
      if (backoff.due()) {
        runs.push(push);
        backoff.miss();
      }
    }
    expect(runs).toEqual([0, 2, 5, 10, 15, 20, 25]);
  });
});

describe('overlay router lookup without an Angular root', () => {
  beforeEach(() => {
    calls.length = 0;
    document.body.innerHTML = '<main><p>static page</p></main>';
    (window as { ng?: unknown }).ng = { getComponent: () => null };
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as { ng?: unknown }).ng;
    document.body.innerHTML = '';
  });

  it('backs off the full DOM scan instead of running it on every push', async () => {
    const all = vi.spyOn(document, 'querySelectorAll');
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(60_000);
      // 120 polls at 500 ms; without the back-off every one of them scans.
      const scans = all.mock.calls.filter(([selector]) => selector === '*').length;
      expect(calls).toContain('push-router');
      expect(scans).toBeGreaterThan(0);
      expect(scans).toBeLessThan(10);
    } finally {
      dispose();
    }
  });
});

describe('overlay router lookup after the router goes away', () => {
  function fakeRouter() {
    const listeners = new Set<unknown>();
    return {
      listeners,
      config: [{ path: 'a' }],
      navigated: true,
      url: '/',
      routerState: { snapshot: null },
      disposed: false,
      navigateByUrl: () => Promise.resolve(true),
      events: {
        subscribe(listener: unknown) {
          listeners.add(listener);
          return { unsubscribe: () => listeners.delete(listener) };
        },
      },
    };
  }

  let current = fakeRouter();

  beforeEach(() => {
    calls.length = 0;
    document.body.innerHTML = '<app-root ng-version="22.0.0"></app-root>';
    (window as { ng?: unknown }).ng = {
      getComponent: () => ({}),
      getInjector: () => ({}),
      ɵgetRouterInstance: () => current,
    };
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as { ng?: unknown }).ng;
    document.body.innerHTML = '';
  });

  it('lets go of a disposed router and watches the new one', async () => {
    const first = fakeRouter();
    current = first;
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(2_000);
      expect(first.listeners.size).toBeGreaterThan(0);
      const second = fakeRouter();
      first.disposed = true;
      current = second;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(first.listeners.size).toBe(0);
      expect(second.listeners.size).toBeGreaterThan(0);
    } finally {
      dispose();
    }
  });

  it('does not fold the new router navigation ids into the old router records', async () => {
    const emit = (router: ReturnType<typeof fakeRouter>, event: Record<string, unknown>) => {
      for (const listener of router.listeners) (listener as (event: unknown) => void)(event);
    };
    const first = fakeRouter();
    current = first;
    routerReports.length = 0;
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(2_000);
      emit(first, { type: 0, id: 1, url: '/a' });
      emit(first, { type: 1, id: 1, url: '/a', urlAfterRedirects: '/a' });
      await vi.advanceTimersByTimeAsync(2_000);
      const second = fakeRouter();
      first.disposed = true;
      current = second;
      await vi.advanceTimersByTimeAsync(2_000);
      emit(second, { type: 0, id: 1, url: '/b' });
      emit(second, { type: 1, id: 1, url: '/b', urlAfterRedirects: '/b' });
      await vi.advanceTimersByTimeAsync(2_000);
      const last = routerReports.at(-1)!;
      expect(last.navigations.map(({ id, url, outcome }) => ({ id, url, outcome }))).toEqual([
        { id: 1, url: '/b', outcome: 'succeeded' },
      ]);
    } finally {
      dispose();
    }
  });

  it('keeps looking, with a back-off, when the root has no router yet', async () => {
    current = null as never;
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(10_000);
      const late = fakeRouter();
      current = late;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(late.listeners.size).toBeGreaterThan(0);
    } finally {
      dispose();
    }
  });
});
