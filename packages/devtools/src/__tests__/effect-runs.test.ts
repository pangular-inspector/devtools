// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createEffectRunListener, trackEffectRuns } from '../effect-runs.ts';
import type { SignalGraphNode } from '../types.ts';

/** A profiler event number Angular does not use for effects today. */
const EFFECT_START = 40;
const EFFECT_END = 41;

function fakeNg() {
  let profiler: ((event: number, instance?: unknown) => void) | null = null;
  return {
    ng: {
      enableProfiling: () => {},
      ɵsetProfiler: (fn: typeof profiler) => {
        profiler = fn;
        return () => (profiler = null);
      },
    },
    emit: (event: number, instance?: unknown) => profiler?.(event, instance),
    registered: () => profiler !== null,
  };
}

describe('effect run counts', () => {
  it('stays off until the profiler reports an effect run', () => {
    let clock = 0;
    const page = fakeNg();
    const tracker = trackEffectRuns(
      () => page.ng,
      { major: 22 },
      () => clock,
    );
    expect(page.registered()).toBe(true);
    // Template and lifecycle events carry no effect node.
    page.emit(2, { constructor: class Card {} });
    page.emit(3, { constructor: class Card {} });
    const nodes: SignalGraphNode[] = [{ id: '1', kind: 'effect', label: 'persist', epoch: 0 }];
    tracker.attach(nodes);
    expect(tracker.active).toBe(false);
    expect(nodes[0]!.runs).toBeUndefined();

    const node = { kind: 'effect', debugName: 'persist' };
    page.emit(EFFECT_START, node);
    clock = 3;
    page.emit(EFFECT_END, node);
    // An effect ref that holds its node under the SIGNAL symbol counts as the same effect.
    const ref = { [Symbol('SIGNAL')]: node };
    page.emit(EFFECT_START, ref);
    clock = 4.5;
    page.emit(EFFECT_END, ref);
    tracker.attach(nodes);
    expect(tracker.active).toBe(true);
    expect(nodes[0]).toMatchObject({ runs: 2, runMs: 4.5, lastRunMs: 1.5 });
    tracker.stop();
    expect(page.registered()).toBe(false);
  });

  it('attaches nothing when two effects share a name', () => {
    const runs = createEffectRunListener(() => 0);
    runs.listener(EFFECT_START, { kind: 'effect', debugName: 'sync' });
    runs.listener(EFFECT_START, { kind: 'effect', debugName: 'sync' });
    expect(runs.active).toBe(true);
    expect(runs.statsFor('sync')).toBeUndefined();
  });

  it('leaves the profiler alone before Angular 20', () => {
    const page = fakeNg();
    const tracker = trackEffectRuns(() => page.ng, { major: 19 });
    expect(page.registered()).toBe(false);
    expect(tracker.active).toBe(false);
  });
});
