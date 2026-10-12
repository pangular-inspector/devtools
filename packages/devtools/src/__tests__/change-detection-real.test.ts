// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  VERSION,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { addProfilerListener, angularMajor, watchChangeDetection } from '../change-detection.ts';
import { angularAtLeast } from './angular-version.ts';

class TripCounter {
  readonly count = signal(0);
}
Component({ selector: 'app-root', template: '<p>{{ count() }} trips</p>' })(TripCounter);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ngOf = () => (globalThis as { ng?: unknown }).ng;

describe('watchChangeDetection with a real app', () => {
  let app: ApplicationRef | null = null;
  let stop: (() => void) | null = null;
  afterEach(() => {
    stop?.();
    stop = null;
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  async function boot() {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripCounter, {
      providers: [provideZonelessChangeDetection()],
    });
    app.tick();
    return app.components[0].instance as TripCounter;
  }

  it('reads the major version from the ng-version attribute', async () => {
    await boot();
    expect(angularMajor(document)).toBe(Number(VERSION.major));
  });

  it('refreshes after a template update through the private profiler hook', async () => {
    const counter = await boot();
    let refreshes = 0;
    const scheduler = watchChangeDetection({
      getNg: ngOf,
      refresh: () => refreshes++,
      debounceMs: 5,
      pollMs: 60_000,
      heartbeatMs: 60_000,
    });
    stop = () => scheduler.stop();
    if (!angularAtLeast('20.0')) {
      // Before Angular 20 there is one profiler slot, so the watcher polls instead.
      expect(scheduler.mode).toBe('poll');
      return;
    }
    expect(scheduler.mode).toBe('change-detection');
    expect(scheduler.intervalMs).toBe(60_000);

    counter.count.set(1);
    await wait(40);
    expect(document.body.textContent).toContain('1 trips');
    expect(refreshes).toBeGreaterThan(0);

    scheduler.stop();
    const before = refreshes;
    counter.count.set(2);
    await wait(40);
    expect(document.body.textContent).toContain('2 trips');
    expect(refreshes).toBe(before);
  });

  it('shares one Angular profiler between listeners and removes it with the last one', async () => {
    const counter = await boot();
    const ng = ngOf();
    expect(typeof (ng as { ɵsetProfiler?: unknown }).ɵsetProfiler).toBe('function');
    const first: number[] = [];
    const second: number[] = [];
    const removeFirst = addProfilerListener(ng, (event) => first.push(event));
    const removeSecond = addProfilerListener(ng, (event) => second.push(event));
    if (!angularAtLeast('20.0')) {
      expect(removeFirst).toBeNull();
      expect(removeSecond).toBeNull();
      return;
    }
    expect(removeFirst).toBeTypeOf('function');

    counter.count.set(1);
    await wait(40);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);

    removeFirst!();
    const kept = first.length;
    counter.count.set(2);
    await wait(40);
    expect(first.length).toBe(kept);
    expect(second.length).toBeGreaterThan(kept);

    removeSecond!();
    const last = second.length;
    counter.count.set(3);
    await wait(40);
    expect(document.body.textContent).toContain('3 trips');
    expect(second.length).toBe(last);
  });
});
