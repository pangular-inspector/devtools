// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_INSPECTORS } from '../config.ts';
import { createScanBackoff } from '../router-attach.ts';

const calls: string[] = [];

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
        call: async (name: string) => {
          calls.push(name);
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
