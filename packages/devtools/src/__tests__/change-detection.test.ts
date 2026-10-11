// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { angularMajor, outsideAngular, watchChangeDetection } from '../change-detection.ts';

type Profiler = (event: number) => void;

/** Mirrors Angular's v20+ profiler registry: several profilers, each with a remover. */
function fakeNg() {
  const profilers: Profiler[] = [];
  return {
    profilers,
    ɵsetProfiler: vi.fn((profiler: Profiler | null) => {
      if (!profiler) {
        profilers.length = 0;
        return () => {};
      }
      profilers.push(profiler);
      return () => profilers.splice(profilers.indexOf(profiler), 1);
    }),
    emit(event: number) {
      for (const profiler of [...profilers]) profiler(event);
    },
  };
}

function page(version: string | null) {
  document.body.innerHTML = version
    ? `<app-root ng-version="${version}"></app-root>`
    : '<div></div>';
}

describe('watchChangeDetection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('refreshes once per burst of template updates', () => {
    page('22.1.7');
    const ng = fakeNg();
    const refresh = vi.fn();
    const watcher = watchChangeDetection({ getNg: () => ng, refresh });
    expect(watcher.mode).toBe('change-detection');

    for (let i = 0; i < 50; i++) ng.emit(2);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(refresh).toHaveBeenCalledTimes(1);

    ng.emit(0);
    vi.advanceTimersByTime(250);
    expect(refresh).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it('ignores ticks that update no template', () => {
    page('22.1.7');
    const ng = fakeNg();
    const refresh = vi.fn();
    const watcher = watchChangeDetection({ getNg: () => ng, refresh });
    for (const event of [12, 14, 15, 16, 17, 13]) ng.emit(event);
    vi.advanceTimersByTime(1000);
    expect(refresh).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('keeps a slow heartbeat while hooked', () => {
    page('22.1.7');
    const refresh = vi.fn();
    const watcher = watchChangeDetection({ getNg: () => fakeNg(), refresh });
    vi.advanceTimersByTime(12_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    watcher.stop();
  });

  it('polls when the page has no profiler hook, and hooks in once it appears', () => {
    page('22.1.7');
    let ng: ReturnType<typeof fakeNg> | undefined;
    const refresh = vi.fn();
    const watcher = watchChangeDetection({ getNg: () => ng, refresh });
    expect(watcher.mode).toBe('poll');
    vi.advanceTimersByTime(6000);
    expect(refresh).toHaveBeenCalledTimes(2);

    ng = fakeNg();
    vi.advanceTimersByTime(3000);
    expect(watcher.mode).toBe('change-detection');
    expect(ng.profilers).toHaveLength(1);
    watcher.stop();
  });

  it('polls on the given interval and keeps the heartbeat fixed once hooked', () => {
    page('19.2.0');
    const refresh = vi.fn();
    const polling = watchChangeDetection({ getNg: () => fakeNg(), refresh, pollMs: 1000 });
    vi.advanceTimersByTime(3000);
    expect(refresh).toHaveBeenCalledTimes(3);
    polling.stop();

    page('22.1.7');
    refresh.mockClear();
    const hooked = watchChangeDetection({ getNg: () => fakeNg(), refresh, pollMs: 1000 });
    vi.advanceTimersByTime(3000);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    hooked.stop();
  });

  it('does not take the single profiler slot of Angular before v20', () => {
    page('19.2.0');
    const ng = fakeNg();
    const watcher = watchChangeDetection({ getNg: () => ng, refresh: vi.fn() });
    expect(watcher.mode).toBe('poll');
    expect(ng.ɵsetProfiler).not.toHaveBeenCalled();
    watcher.stop();
  });

  it('removes only its own profiler on stop and clears its timers', () => {
    page('22.1.7');
    const ng = fakeNg();
    const other = vi.fn();
    ng.ɵsetProfiler(other);
    const refresh = vi.fn();
    const watcher = watchChangeDetection({ getNg: () => ng, refresh });
    ng.emit(2);
    watcher.stop();

    expect(ng.profilers).toEqual([other]);
    expect(ng.ɵsetProfiler).not.toHaveBeenCalledWith(null);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('schedules its timers in the root zone', () => {
    page('22.1.7');
    const ng = fakeNg();
    const run = vi.fn((fn: () => unknown) => fn());
    vi.stubGlobal('Zone', { root: { run } });
    const watcher = watchChangeDetection({ getNg: () => ng, refresh: vi.fn() });
    expect(run).toHaveBeenCalledTimes(1);
    ng.emit(2);
    expect(run).toHaveBeenCalledTimes(2);
    watcher.stop();
  });
});

describe('helpers', () => {
  it('reads the Angular major version from the page', () => {
    page('20.0.0-next.3');
    expect(angularMajor()).toBe(20);
    page(null);
    expect(angularMajor()).toBe(0);
  });

  it('runs directly without zone.js', () => {
    expect(outsideAngular(() => 42)).toBe(42);
  });
});
