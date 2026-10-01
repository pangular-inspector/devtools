// @vitest-environment jsdom
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROFILER_EVENT as E, createCdRecorder } from '../cd-recorder.ts';
import { attachChangeDetection } from '../cd-overlay.ts';
import { changeDetectionText, toCdPage, type CdState } from '../rpc/cd-tools.ts';

class Shell {}
class Cart {}
class Price {}

function clocked() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('change detection recorder', () => {
  it('ignores events until it records, then keeps cycles with self times', () => {
    const clock = clocked();
    const recorder = createCdRecorder({ maxCycles: 10, now: clock.now, clock: () => 1000 });
    const shell = new Shell();
    const cart = new Cart();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(recorder.snapshot(() => null).cycles).toEqual([]);

    recorder.start();
    const listener = function onAdd() {};
    recorder.onEvent(E.OutputStart, cart, listener);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    clock.advance(1);
    recorder.onEvent(E.ComponentStart);
    clock.advance(3);
    recorder.onEvent(E.ComponentEnd, cart);
    clock.advance(1);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    clock.advance(2);
    recorder.onEvent(E.ComponentEnd, cart);
    recorder.onEvent(E.ChangeDetectionEnd);

    const snap = recorder.snapshot((instance) => (instance === cart ? 'c1' : null));
    expect(snap.recording).toBe(true);
    expect(snap.cycles).toEqual([
      {
        id: 1,
        at: 1000,
        ms: 7,
        passes: 2,
        trigger: 'Cart (onAdd)',
        checks: 3,
        components: [
          { name: 'Cart', checks: 2, ms: 5 },
          { name: 'Shell', checks: 1, ms: 2 },
        ],
      },
    ]);
    expect(snap.components[0]).toEqual({ name: 'Cart', checks: 2, ms: 5, maxMs: 3, cycles: 1 });
    expect(snap.hosts).toEqual({ c1: 2 });
  });

  it('keeps the latest cycles at the limit and counts the rest', () => {
    const recorder = createCdRecorder({ maxCycles: 3 });
    recorder.start();
    for (let i = 0; i < 5; i++) {
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionEnd);
    }
    const snap = recorder.snapshot(() => null);
    expect(snap.cycles.map((c) => c.id)).toEqual([3, 4, 5]);
    expect(snap.dropped).toBe(2);
    recorder.stop();
    expect(recorder.snapshot(() => null).cycles).toHaveLength(3);
    recorder.clear();
    expect(recorder.snapshot(() => null)).toMatchObject({ cycles: [], dropped: 0 });
  });

  it('does not record outputs that run inside a cycle as its trigger', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.OutputStart, new Price(), () => {});
    recorder.onEvent(E.ChangeDetectionEnd);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(recorder.snapshot(() => null).cycles.map((c) => c.trigger)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('lets components it counted be collected once they are gone', async () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const recorder = createCdRecorder({ maxCycles: 100 });
    recorder.start();
    const refs: WeakRef<object>[] = [];
    (() => {
      for (let i = 0; i < 20; i++) {
        const cart = new Cart();
        refs.push(new WeakRef(cart));
        recorder.onEvent(E.OutputStart, cart, () => {});
        recorder.onEvent(E.ChangeDetectionStart);
        recorder.onEvent(E.ComponentStart);
        recorder.onEvent(E.ComponentEnd, cart);
        recorder.onEvent(E.ChangeDetectionEnd);
      }
    })();
    recorder.stop();
    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();
    gc();
    expect(refs.filter((ref) => ref.deref())).toHaveLength(0);
    const snap = recorder.snapshot(() => 'c1');
    expect(snap.cycles).toHaveLength(20);
    expect(snap.cycles[0].trigger).toBe('Cart');
    expect(snap.hosts).toEqual({});
  });
});

describe('change detection in the overlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function setup(version: string) {
    document.body.innerHTML = `<app-root ng-version="${version}"></app-root>`;
    const profilers: ((event: number, instance?: unknown, hook?: unknown) => void)[] = [];
    const ng = {
      ɵsetProfiler: vi.fn((profiler: (typeof profilers)[number] | null) => {
        if (!profiler) throw new Error('never clear every profiler');
        profilers.push(profiler);
        return () => profilers.splice(profilers.indexOf(profiler), 1);
      }),
      getHostElement: () => document.querySelector('app-root'),
    };
    const sent: { name: string; args: unknown[] }[] = [];
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const my = {
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          sent.push({ name, args });
          return undefined;
        },
        register: (def: { name: string; handler: (...args: unknown[]) => unknown }) =>
          handlers.set(def.name, def.handler),
      },
    };
    const cd = attachChangeDetection(my, 'p1', () => ng, 50);
    const emit = (event: number, instance?: unknown) =>
      profilers.forEach((profiler) => profiler(event, instance));
    return { cd, ng, sent, handlers, profilers, emit };
  }

  it('sends nothing and registers no profiler until recording starts', async () => {
    const { cd, sent, profilers } = setup('22.1.0');
    await cd.push();
    expect(sent).toEqual([]);
    expect(profilers).toHaveLength(0);
  });

  it('records while on, reports hosts by tree id, and removes its profiler on stop', async () => {
    const { cd, sent, handlers, profilers, emit } = setup('22.1.0');
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    expect(profilers).toHaveLength(1);
    emit(E.ChangeDetectionStart);
    emit(E.ComponentStart);
    emit(E.ComponentEnd, new Shell());
    emit(E.ChangeDetectionEnd);
    await cd.push();
    const report = sent.filter((s) => s.name === 'push-change-detection').at(-1)!.args[0] as {
      cycles: unknown[];
      hosts: Record<string, number>;
      supported: boolean;
    };
    expect(report.supported).toBe(true);
    expect(report.cycles).toHaveLength(1);
    expect(Object.values(report.hosts)).toEqual([1]);
    handlers.get('change-detection-record')!({ on: false });
    expect(profilers).toHaveLength(0);
    handlers.get('change-detection-record')!({ pageId: 'other', on: true });
    expect(profilers).toHaveLength(0);
  });

  it('reports that it cannot record before Angular 20', async () => {
    const { ng, sent, handlers } = setup('19.2.0');
    handlers.get('change-detection-record')!({ on: true });
    await Promise.resolve();
    expect(ng.ɵsetProfiler).not.toHaveBeenCalled();
    expect(sent.at(-1)).toMatchObject({
      name: 'push-change-detection',
      args: [{ supported: false, recording: false }],
    });
  });
});

describe('change detection agent text', () => {
  it('lists the slowest and most checked components and notes dropped cycles', () => {
    const page = toCdPage(
      {
        pageId: 'p1',
        supported: true,
        recording: true,
        startedAt: 1,
        dropped: 4,
        cycles: [
          {
            id: 5,
            at: 1,
            ms: 3,
            passes: 1,
            trigger: 'Cart (onAdd)',
            checks: 2,
            components: [{ name: 'Cart', checks: 1, ms: 2 }],
          },
        ],
        components: [
          { name: 'Cart', checks: 2, ms: 9, maxMs: 5, cycles: 2 },
          { name: 'Row', checks: 40, ms: 1, maxMs: 0.1, cycles: 2 },
        ],
        hosts: { c1: 2 },
      },
      200,
    )!;
    const state: CdState = { pages: { p1: page } };
    const text = changeDetectionText(state);
    expect(text).toContain('Recording is on.');
    expect(text.indexOf('`Cart`: 2 check(s)')).toBeLessThan(text.indexOf('**Most often checked**'));
    expect(text.split('**Most often checked**')[1]).toMatch(/^\n- `Row`/);
    expect(text).toContain('after output in `Cart (onAdd)`');
    expect(text).toContain('4 older cycles were dropped');
    expect(changeDetectionText({ pages: {} })).toContain('record: "start"');
    expect(changeDetectionText({ pages: { p1: { ...page, supported: false } } })).toContain(
      'Angular 20',
    );
    expect(toCdPage({ pageId: 5 }, 10)).toBeNull();
  });
});
