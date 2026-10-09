// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachChangeDetection } from '../cd-overlay.ts';

describe('change detection keepalive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('pings before the page expires when a tick lands just short of the keepalive', async () => {
    const ng = { ɵsetProfiler: () => () => {}, getHostElement: () => null };
    const sent: { name: string; at: number }[] = [];
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const my = {
      rpc: {
        call: async (name: string) => {
          sent.push({ name, at: Date.now() });
          return undefined;
        },
        register: (def: { name: string; handler: (...args: unknown[]) => unknown }) =>
          handlers.set(def.name, def.handler),
      },
    };
    const tick = 8000;
    const cd = attachChangeDetection(
      my,
      'p1',
      () => ng,
      50,
      () => tick,
    );
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    await vi.advanceTimersByTimeAsync(0);
    const start = Date.now();
    for (let elapsed = 0; elapsed < 30_000; elapsed += tick - 1) {
      vi.setSystemTime(start + elapsed);
      await cd.push();
    }
    const times = sent.map((s) => s.at);
    const gaps = times.slice(1).map((at, i) => at - times[i]);
    expect(gaps.every((gap) => gap <= 15_000)).toBe(true);
  });
});
