// @vitest-environment jsdom
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OUTPUT_TRIGGER_MS, PROFILER_EVENT as E, createCdRecorder } from '../cd-recorder.ts';
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
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(recorder.snapshot(() => null).cycles).toEqual([]);

    recorder.start();
    const listener = function onAdd() {};
    recorder.onEvent(E.OutputStart, cart, listener);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, shell);
    clock.advance(1);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, cart);
    clock.advance(3);
    recorder.onEvent(E.ComponentEnd, cart);
    clock.advance(1);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, cart);
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
        t: 0,
        spans: [
          [0, 0, 5, 0, 'c'],
          [1, 1, 3, 1, 'c'],
          [1, 5, 2, 0, 'c'],
        ],
      },
    ]);
    expect(snap.spanNames).toEqual(['Shell', 'Cart']);
    expect(snap.components[0]).toEqual({ name: 'Cart', checks: 2, ms: 5, maxMs: 3, cycles: 1 });
    expect(snap.hosts).toEqual({ c1: 2 });
  });

  it('counts only components whose template ran, outside the checkNoChanges pass', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    const shell = new Shell();
    const cart = new Cart();
    const price = new Price();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, shell);
    // A clean OnPush child: walked past, its template never ran.
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.ComponentEnd, price);
    // A child whose embedded view ran but not its own template.
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, {});
    recorder.onEvent(E.ComponentEnd, cart);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionSyncEnd);
    // The dev-mode checkNoChanges pass.
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, shell);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionEnd);
    const snap = recorder.snapshot((instance) => (instance === shell ? 's1' : 'other'));
    expect(snap.cycles[0]).toMatchObject({ checks: 1, components: [{ name: 'Shell', checks: 1 }] });
    expect(snap.components.map((c) => c.name)).toEqual(['Shell']);
    expect(snap.hosts).toEqual({ s1: 1 });
  });

  it('keeps the latest cycles at the limit and counts the rest', () => {
    const recorder = createCdRecorder({ maxCycles: 3 });
    recorder.start();
    for (let i = 0; i < 5; i++) {
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionSyncStart);
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

  it('counts the component classes and instances it checked past its caps', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    const classes = Array.from({ length: 1005 }, () => class {});
    const check = (instance: object) => {
      recorder.onEvent(E.ComponentStart);
      recorder.onEvent(E.TemplateUpdateStart, instance);
      recorder.onEvent(E.ComponentEnd, instance);
    };
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    // 2005 instances of 1005 classes, and the last class checked twice.
    const instances = [...classes, ...classes.slice(0, 1000)].map((Ctor) => new Ctor());
    for (const instance of instances) check(instance);
    check(instances[1004]!);
    recorder.onEvent(E.ChangeDetectionEnd);

    const snap = recorder.snapshot(() => null);
    expect(snap.components).toHaveLength(100);
    // 900 kept classes past the 100 listed, and 5 classes never kept.
    expect(snap.droppedClasses).toBe(905);
    // The last 5 instances, each counted once.
    expect(snap.droppedHosts).toBe(5);

    recorder.clear();
    const empty = recorder.snapshot(() => null);
    expect(empty.droppedClasses).toBeUndefined();
    expect(empty.droppedHosts).toBeUndefined();
  });

  it("carries an untracked instance's checks over when a slot frees up", () => {
    // A WeakRef the test can clear, standing in for garbage collection.
    const collected = new WeakSet<object>();
    class TestRef<T extends object> {
      constructor(private target: T) {}
      deref() {
        return collected.has(this.target) ? undefined : this.target;
      }
    }
    vi.stubGlobal('WeakRef', TestRef);
    try {
      const recorder = createCdRecorder({ maxCycles: 10 });
      recorder.start();
      const check = (instance: object) => {
        recorder.onEvent(E.ComponentStart);
        recorder.onEvent(E.TemplateUpdateStart, instance);
        recorder.onEvent(E.ComponentEnd, instance);
      };
      const kept = Array.from({ length: 2000 }, () => new Cart());
      const late = new Price();
      const other = new Price();
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionSyncStart);
      for (const instance of kept) check(instance);
      check(late);
      check(other);
      recorder.onEvent(E.ChangeDetectionEnd);
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionSyncStart);
      check(late);
      recorder.onEvent(E.ChangeDetectionEnd);
      expect(recorder.snapshot(() => null).droppedHosts).toBe(2);

      collected.add(kept[0]!);
      recorder.onEvent(E.ChangeDetectionStart);
      recorder.onEvent(E.ChangeDetectionSyncStart);
      check(late);
      recorder.onEvent(E.ChangeDetectionEnd);
      const snap = recorder.snapshot((instance) => (instance === late ? 'late' : null));
      // Two checks while untracked, one after it got a slot.
      expect(snap.hosts).toEqual({ late: 3 });
      expect(snap.droppedHosts).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports no dropped classes or hosts below its caps', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    const checked1 = new Cart();
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, checked1);
    recorder.onEvent(E.ComponentEnd, checked1);
    recorder.onEvent(E.ChangeDetectionEnd);
    const snap = recorder.snapshot(() => null);
    expect(snap).not.toHaveProperty('droppedClasses');
    expect(snap).not.toHaveProperty('droppedHosts');
  });

  it('does not record outputs that run inside a cycle as its trigger', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.OutputStart, new Price(), () => {});
    recorder.onEvent(E.ChangeDetectionEnd);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(recorder.snapshot(() => null).cycles.map((c) => c.trigger)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('drops an output trigger when the next tick starts long after it ended', () => {
    const clock = clocked();
    const recorder = createCdRecorder({ maxCycles: 10, now: clock.now });
    recorder.start();
    recorder.onEvent(E.OutputStart, new Cart(), function onAdd() {});
    recorder.onEvent(E.OutputEnd);
    clock.advance(OUTPUT_TRIGGER_MS + 1);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    recorder.onEvent(E.OutputStart, new Price(), function onPick() {});
    clock.advance(OUTPUT_TRIGGER_MS * 2);
    recorder.onEvent(E.OutputEnd);
    clock.advance(4);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    expect(recorder.snapshot(() => null).cycles.map((c) => c.trigger)).toEqual([
      undefined,
      'Price (onPick)',
    ]);
  });

  it('keeps the outer cycle when a nested tick starts and ends inside it', () => {
    const recorder = createCdRecorder({ maxCycles: 10 });
    recorder.start();
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    const checked2 = new Shell();
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, checked2);
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ChangeDetectionEnd);
    recorder.onEvent(E.ComponentEnd, checked2);
    recorder.onEvent(E.ChangeDetectionEnd);
    const cycles = recorder.snapshot(() => null).cycles;
    expect(cycles.map((c) => [c.id, c.checks])).toEqual([
      [2, 0],
      [1, 1],
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
        recorder.onEvent(E.ChangeDetectionSyncStart);
        recorder.onEvent(E.ComponentStart);
        recorder.onEvent(E.TemplateUpdateStart, cart);
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
    emit(E.ChangeDetectionSyncStart);
    const checked3 = new Shell();
    emit(E.ComponentStart);
    emit(E.TemplateUpdateStart, checked3);
    emit(E.ComponentEnd, checked3);
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

  it('keeps a running recording when a second start arrives', async () => {
    const { cd, sent, handlers, emit } = setup('22.1.0');
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    emit(E.ChangeDetectionStart);
    emit(E.ChangeDetectionSyncStart);
    emit(E.ChangeDetectionEnd);
    handlers.get('change-detection-record')!({ on: true });
    await cd.push(true);
    const last = () =>
      sent.filter((s) => s.name === 'push-change-detection').at(-1)!.args[0] as {
        cycles: unknown[];
      };
    expect(last().cycles).toHaveLength(1);
    handlers.get('change-detection-record')!({ on: true, clear: true });
    await cd.push(true);
    expect(last()).toMatchObject({ recording: true, cycles: [] });
  });

  it('reads a host again when it could not be read before', async () => {
    const { cd, ng, sent, handlers, emit } = setup('22.1.0');
    let ready = false;
    ng.getHostElement = () => (ready ? document.querySelector('app-root') : null);
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    emit(E.ChangeDetectionStart);
    emit(E.ChangeDetectionSyncStart);
    const checked4 = new Shell();
    emit(E.ComponentStart);
    emit(E.TemplateUpdateStart, checked4);
    emit(E.ComponentEnd, checked4);
    emit(E.ChangeDetectionEnd);
    const hosts = () =>
      (
        sent.filter((s) => s.name === 'push-change-detection').at(-1)!.args[0] as {
          hosts: Record<string, number>;
        }
      ).hosts;
    await cd.push(true);
    expect(hosts()).toEqual({});
    ready = true;
    await cd.push(true);
    expect(Object.values(hosts())).toEqual([1]);
  });

  it('sends a stopped recording again after leave, as on a bfcache restore', async () => {
    const { cd, sent, handlers, emit } = setup('22.1.0');
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    emit(E.ChangeDetectionStart);
    emit(E.ChangeDetectionSyncStart);
    const checked5 = new Shell();
    emit(E.ComponentStart);
    emit(E.TemplateUpdateStart, checked5);
    emit(E.ComponentEnd, checked5);
    emit(E.ChangeDetectionEnd);
    handlers.get('change-detection-record')!({ pageId: 'p1', on: false });
    await Promise.resolve();
    await cd.push();
    cd.leave();
    sent.length = 0;
    await cd.push();
    const pushes = sent.filter((s) => s.name === 'push-change-detection');
    expect(pushes).toHaveLength(1);
    expect(pushes[0].args[0]).toMatchObject({ recording: false, cycles: [{ id: 1 }] });
    sent.length = 0;
    handlers.get('change-detection-record')!({ pageId: 'p1', clear: true });
    await Promise.resolve();
    cd.leave();
    sent.length = 0;
    await cd.push();
    expect(sent).toEqual([]);
  });

  it('attaches on a later push when Angular had not started at the first start', async () => {
    const { ng, sent, handlers, profilers, emit } = setup('22.1.0');
    let started = false;
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
    const cd = attachChangeDetection(my, 'p2', () => (started ? ng : undefined), 50);
    const last = () => sent.filter((s) => s.name === 'push-change-detection').at(-1)!.args[0];
    handlers.get('change-detection-record')!({ pageId: 'p2', on: true });
    await Promise.resolve();
    expect(last()).toMatchObject({ pageId: 'p2', supported: false, recording: false });

    started = true;
    await cd.push();
    expect(profilers).toHaveLength(1);
    expect(last()).toMatchObject({ pageId: 'p2', supported: true, recording: true });
    emit(E.ChangeDetectionStart);
    emit(E.ChangeDetectionSyncStart);
    emit(E.ChangeDetectionEnd);
    await cd.push();
    expect(last()).toMatchObject({ cycles: [{ id: 1 }] });

    // Once stopped, it no longer tries.
    handlers.get('change-detection-record')!({ pageId: 'p2', on: false });
    started = false;
    expect(profilers).toHaveLength(0);
    started = true;
    await cd.push(true);
    expect(profilers).toHaveLength(0);
  });

  it('records on an app without ng-version when ng.enableProfiling marks Angular 20 or later', async () => {
    const { ng, profilers, handlers } = setup('22.1.0');
    document.querySelector('app-root')!.removeAttribute('ng-version');
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    expect(ng.ɵsetProfiler).not.toHaveBeenCalled();
    handlers.get('change-detection-record')!({ pageId: 'p1', on: false });

    Object.assign(ng, { enableProfiling: () => {} });
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    expect(profilers).toHaveLength(1);
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
    // A page whose capabilities say it has the hook could not attach yet: not its version.
    const unattached = changeDetectionText(
      { pages: { p1: { ...page, supported: false } } },
      {},
      () => ({ version: '22.1.0', capabilities: { profiler: true } }),
    );
    expect(unattached).toContain('could not attach');
    expect(unattached).not.toContain('Angular 20');
    expect(
      changeDetectionText({ pages: { p1: { ...page, supported: false } } }, {}, () => ({
        version: '19.2.0',
        capabilities: { profiler: false },
      })),
    ).toContain('needs Angular 20.0 or later; this page runs Angular 19.2.');
    expect(toCdPage({ pageId: 5 }, 10)).toBeNull();
  });

  it('keeps the dropped class and host counts and notes them', () => {
    const base = {
      pageId: 'p1',
      recording: false,
      startedAt: 1,
      dropped: 0,
      cycles: [{ id: 1, at: 1, ms: 1, passes: 1, checks: 1, components: [] }],
      components: [{ name: 'Cart', checks: 2, ms: 9, maxMs: 5, cycles: 2 }],
      hosts: {},
    };
    const page = toCdPage({ ...base, droppedClasses: 905, droppedHosts: 1 }, 200)!;
    expect(page).toMatchObject({ droppedClasses: 905, droppedHosts: 1 });
    const text = changeDetectionText({ pages: { p1: page } });
    expect(text).toContain('905 more component classes were checked but are not listed');
    expect(text).toContain('1 component instance was checked past the 2000 instances');

    const plain = toCdPage({ ...base, droppedClasses: -3, droppedHosts: 'x' }, 200)!;
    expect(plain).not.toHaveProperty('droppedClasses');
    expect(plain).not.toHaveProperty('droppedHosts');
    expect(changeDetectionText({ pages: { p1: plain } })).not.toContain('not listed');

    // A page that sends more than the server keeps has the rest counted too.
    const components = Array.from({ length: 103 }, (_, i) => ({
      name: `C${i}`,
      checks: 1,
      ms: 1,
      maxMs: 1,
      cycles: 1,
    }));
    const hosts = Object.fromEntries(Array.from({ length: 2002 }, (_, i) => [`h${i}`, 1]));
    const big = toCdPage({ ...base, components, hosts, droppedClasses: 2 }, 200)!;
    expect(big.components).toHaveLength(100);
    expect(big.droppedClasses).toBe(5);
    expect(big.droppedHosts).toBe(2);
  });

  it('falls back to the default limit when `limit` is not a number', () => {
    const components = Array.from({ length: 15 }, (_, i) => ({
      name: `Row${i}`,
      checks: i + 1,
      ms: i + 1,
      maxMs: 1,
      cycles: 1,
    }));
    const page = toCdPage(
      {
        pageId: 'p1',
        supported: true,
        recording: true,
        cycles: components.map((_, i) => ({ id: i, at: i, ms: 1, passes: 1, checks: 1 })),
        components,
      },
      200,
    )!;
    const state: CdState = { pages: { p1: page } };
    const slowest = (limit: unknown) =>
      changeDetectionText(state, { limit: limit as never })
        .split('**Slowest components**\n')[1]!
        .split('\n\n')[0]!
        .split('\n').length;
    for (const limit of ['abc', Number.NaN, null, Infinity]) expect(slowest(limit)).toBe(10);
    expect(slowest('3')).toBe(3);
  });
});
