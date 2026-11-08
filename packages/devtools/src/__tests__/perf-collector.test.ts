// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { elementById } from '../element-id.ts';
import {
  attachPerformance,
  describeElement,
  perfRating,
  type PerfDebugNg,
  type PerfEntry,
  type PerfEnv,
} from '../perf-collector.ts';
import { KEEPALIVE_MS } from '../change-detection.ts';

/** A browser stand-in: entries are delivered with `emit`, as a PerformanceObserver would. */
function fakeEnv(supported: string[], navigation: PerfEntry[] = []) {
  const listeners = new Map<string, (entries: PerfEntry[]) => void>();
  const stopped: string[] = [];
  const env: PerfEnv = {
    observe(type, onEntries) {
      if (!supported.includes(type)) return null;
      listeners.set(type, onEntries);
      return () => stopped.push(type);
    },
    entries: (type) => (type === 'navigation' ? navigation : []),
  };
  const emit = (type: string, entries: Partial<PerfEntry>[]) =>
    listeners.get(type)?.(
      entries.map((e) => ({ entryType: type, startTime: 0, duration: 0, ...e }) as PerfEntry),
    );
  return { env, emit, stopped, listeners };
}

class TripCard {}

/** A fake `ng` whose only component owns everything under `host`. */
function fakeNg(host: Element): PerfDebugNg {
  const card = new TripCard();
  return {
    getOwningComponent: (el) => (host.contains(el) ? card : null),
    getHostElement: (component) => (component === card ? host : null),
  };
}

function rpc() {
  const calls: { name: string; args: unknown[] }[] = [];
  return {
    calls,
    my: {
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, args });
          return undefined;
        },
      },
    },
  };
}

const ALL = ['largest-contentful-paint', 'paint', 'layout-shift', 'event', 'longtask'];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('attachPerformance', () => {
  it('reads LCP with its element and owning component, by stable ids', () => {
    document.body.innerHTML = '<app-trip-card><img id="hero" class="cover" /></app-trip-card>';
    const host = document.querySelector('app-trip-card')!;
    const img = document.querySelector('img')!;
    const { env, emit } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => fakeNg(host), { env });
    emit('largest-contentful-paint', [
      { startTime: 900, renderTime: 1200, element: img },
      { startTime: 2600, renderTime: 2700, element: img },
    ]);
    const lcp = perf.report().metrics.LCP!;
    expect(lcp).toMatchObject({ value: 2700, rating: 'needs-improvement', target: 'img#hero' });
    expect(lcp.owner!.name).toBe('TripCard');
    expect(elementById(lcp.owner!.id)).toBe(host);
    // The same element gets the same id on the next report.
    emit('largest-contentful-paint', [{ startTime: 2800, element: img }]);
    expect(perf.report().metrics.LCP!.owner!.id).toBe(lcp.owner!.id);
  });

  it('sums layout shifts in session windows and skips shifts after input', () => {
    const { env, emit } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    expect(perf.report().metrics.CLS).toEqual({ value: 0, rating: 'good' });
    emit('layout-shift', [
      { startTime: 100, value: 0.05 },
      { startTime: 600, value: 0.04 },
      // Typing moved this one, so it doesn't count.
      { startTime: 900, value: 0.5, hadRecentInput: true },
      // More than a second later: a new window, smaller than the first.
      { startTime: 3000, value: 0.02 },
    ]);
    expect(perf.report().metrics.CLS).toEqual({ value: 0.09, rating: 'good' });
    emit('layout-shift', [
      { startTime: 3500, value: 0.1 },
      { startTime: 4000, value: 0.1 },
    ]);
    expect(perf.report().metrics.CLS).toEqual({ value: 0.22, rating: 'needs-improvement' });
  });

  it('takes the slowest event of each interaction for INP and lists the slowest', () => {
    document.body.innerHTML = '<app-trip-card><button id="book">Book</button></app-trip-card>';
    const host = document.querySelector('app-trip-card')!;
    const button = document.querySelector('button')!;
    const { env, emit } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => fakeNg(host), { env });
    emit('event', [
      { name: 'pointerdown', interactionId: 1, duration: 80, startTime: 10, target: button },
      { name: 'click', interactionId: 1, duration: 320, startTime: 12, target: button },
      { name: 'keydown', interactionId: 2, duration: 120, startTime: 50 },
      // No interaction id: a hover, not an interaction.
      { name: 'pointermove', duration: 900, startTime: 60 },
    ]);
    const report = perf.report();
    expect(report.metrics.INP).toMatchObject({
      value: 320,
      rating: 'needs-improvement',
      event: 'click',
      target: 'button#book',
    });
    expect(report.metrics.INP!.owner!.name).toBe('TripCard');
    expect(report.interactions.map((i) => [i.event, i.durationMs])).toEqual([
      ['click', 320],
      ['keydown', 120],
    ]);
  });

  it('skips the slowest interaction per 50 for the 98th percentile', () => {
    const { env, emit } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    emit(
      'event',
      Array.from({ length: 60 }, (_, i) => ({
        name: 'click',
        interactionId: i + 1,
        duration: i === 0 ? 2000 : 100 + i,
      })),
    );
    expect(perf.report().metrics.INP!.value).toBe(159);
  });

  it('counts fast interactions the browser reports but the 40 ms observer never sends', () => {
    const { env, emit } = fakeEnv(ALL);
    // 10 slow interactions observed, 140 in all: skip the slowest 2 of them.
    env.interactionCount = () => 140;
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    emit(
      'event',
      Array.from({ length: 10 }, (_, i) => ({
        name: 'click',
        interactionId: i + 1,
        duration: 100 + i,
      })),
    );
    expect(perf.report().metrics.INP!.value).toBe(107);
  });

  it('keeps counting interactions after the map is trimmed', () => {
    const { env, emit } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    // 250 interactions, so the map keeps only the slowest 100: still skip 5.
    emit(
      'event',
      Array.from({ length: 250 }, (_, i) => ({
        name: 'click',
        interactionId: i + 1,
        duration: 40 + i,
      })),
    );
    expect(perf.report().metrics.INP!.value).toBe(284);
  });

  it('counts long tasks and their blocking time, and prefers long animation frames', () => {
    const tasks = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env: tasks.env });
    tasks.emit('longtask', [
      { startTime: 100, duration: 120 },
      { startTime: 500, duration: 60 },
    ]);
    expect(perf.report()).toMatchObject({ longTaskCount: 2, totalBlockingMs: 80 });
    const frames = fakeEnv([...ALL, 'long-animation-frame']);
    const withFrames = attachPerformance(rpc().my, 'tab1', () => undefined, { env: frames.env });
    expect(frames.listeners.has('longtask')).toBe(false);
    frames.emit('long-animation-frame', [
      {
        startTime: 10,
        duration: 90,
        scripts: [
          { sourceURL: 'http://localhost/main.js?token=abc', duration: 70 },
          { invoker: 'Window.setTimeout', duration: 10 },
        ],
      },
    ]);
    const task = withFrames.report().longTasks[0]!;
    expect(task).toMatchObject({ kind: 'long-animation-frame', durationMs: 90 });
    expect(task.source).toContain('main.js');
  });

  it('reads FCP and TTFB, and says which entry types the browser observes', () => {
    const { env, emit } = fakeEnv(
      ['paint'],
      [{ entryType: 'navigation', startTime: 0, duration: 0, responseStart: 950 }],
    );
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    emit('paint', [
      { name: 'first-paint', startTime: 500 },
      { name: 'first-contentful-paint', startTime: 700 },
    ]);
    const report = perf.report();
    expect(report.metrics.FCP).toMatchObject({ value: 700, rating: 'good' });
    expect(report.metrics.TTFB).toMatchObject({ value: 950, rating: 'needs-improvement' });
    expect(report.metrics.CLS).toBeUndefined();
    expect(report.supported).toEqual(['paint']);
  });

  it('pushes on change only, again when the keepalive is due, and forgets the page on leave', async () => {
    const { env, emit, stopped } = fakeEnv(ALL);
    const { my, calls } = rpc();
    let now = 1_000;
    const perf = attachPerformance(my, 'tab1', () => undefined, { env, now: () => now });
    await perf.push();
    await perf.push();
    expect(calls.filter((c) => c.name === 'push-performance')).toHaveLength(1);
    emit('paint', [{ name: 'first-contentful-paint', startTime: 400 }]);
    await perf.push();
    expect(calls.filter((c) => c.name === 'push-performance')).toHaveLength(2);
    expect((calls.at(-1)!.args[0] as { pageId: string }).pageId).toBe('tab1');
    now += KEEPALIVE_MS + 1;
    await perf.push();
    expect(calls.filter((c) => c.name === 'push-performance')).toHaveLength(3);
    perf.leave();
    await perf.push();
    expect(calls.at(-1)).toEqual({ name: 'forget-performance-page', args: ['tab1'] });
    perf.stop();
    expect(stopped.sort()).toEqual([...ALL].sort());
  });

  it('ignores a malformed entry', () => {
    const { env, listeners } = fakeEnv(ALL);
    const perf = attachPerformance(rpc().my, 'tab1', () => undefined, { env });
    expect(() => listeners.get('event')!(null as never)).not.toThrow();
    expect(perf.report().interactions).toEqual([]);
  });
});

describe('perf helpers', () => {
  it('rates by the web.dev thresholds', () => {
    expect(perfRating('LCP', 2500)).toBe('good');
    expect(perfRating('LCP', 2501)).toBe('needs-improvement');
    expect(perfRating('INP', 501)).toBe('poor');
    expect(perfRating('CLS', 0.1)).toBe('good');
  });

  it('describes an element by tag, id or first class', () => {
    document.body.innerHTML = '<p class="lead big"></p><div id="x" class="y"></div>';
    expect(describeElement(document.querySelector('p'))).toBe('p.lead');
    expect(describeElement(document.querySelector('div'))).toBe('div#x');
    expect(describeElement(null)).toBeUndefined();
  });
});
