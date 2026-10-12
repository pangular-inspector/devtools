// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachChangeDetection } from '../cd-overlay.ts';
import { createCdLive } from '../cd-live.ts';
import { PERF_TRACK, PERF_TRACK_GROUP, createCdPerfTrack } from '../cd-perf-track.ts';
import { PROFILER_EVENT as E } from '../cd-recorder.ts';
import { toCdOptionsRequest } from '../cd-data.ts';

type Profiler = (event: number, instance?: unknown, hook?: unknown) => void;

class Cart {
  ngOnInit() {}
}

function fakeNg(options: { enableProfiling?: boolean } = {}) {
  const profilers: Profiler[] = [];
  const ng = {
    profilers,
    ɵsetProfiler: vi.fn((profiler: Profiler) => {
      profilers.push(profiler);
      return () => profilers.splice(profilers.indexOf(profiler), 1);
    }),
    getHostElement: () => null,
    emit(event: number, instance?: unknown, hook?: unknown) {
      for (const profiler of [...profilers]) profiler(event, instance, hook);
    },
    ...(options.enableProfiling ? { enableProfiling: vi.fn(() => () => {}) } : {}),
  };
  return ng;
}

function page() {
  document.body.innerHTML = '<app-root ng-version="22.1.7"></app-root>';
}

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Performance panel track', () => {
  afterEach(() => vi.restoreAllMocks());

  it('attaches nothing and writes nothing while it is off', () => {
    page();
    const ng = fakeNg();
    const stamp = vi.fn();
    createCdPerfTrack({ getNg: () => ng, console: { timeStamp: stamp } as unknown as Console });
    ng.emit(E.ComponentStart);
    ng.emit(E.ComponentEnd, new Cart());
    expect(ng.profilers).toHaveLength(0);
    expect(stamp).not.toHaveBeenCalled();
  });

  it('writes one entry per component check, hook and output on the Pangular track', () => {
    page();
    const ng = fakeNg();
    const stamp = vi.fn();
    const time = clock();
    const track = createCdPerfTrack({
      getNg: () => ng,
      now: time.now,
      console: { timeStamp: stamp } as unknown as Console,
    });
    expect(track.set(true)).toBe(true);
    const cart = new Cart();
    function onAdd() {}

    ng.emit(E.OutputStart, cart, onAdd);
    time.advance(1);
    ng.emit(E.OutputEnd, cart, onAdd);
    ng.emit(E.ComponentStart, cart);
    time.advance(2);
    ng.emit(E.LifecycleHookStart, cart, cart.ngOnInit);
    time.advance(3);
    ng.emit(E.LifecycleHookEnd, cart, cart.ngOnInit);
    ng.emit(E.ComponentEnd, cart);

    expect(stamp.mock.calls).toEqual([
      ['Cart output (onAdd)', 0, 1, PERF_TRACK, PERF_TRACK_GROUP, 'tertiary'],
      ['Cart.ngOnInit', 3, 6, PERF_TRACK, PERF_TRACK_GROUP, 'secondary'],
      ['Cart', 1, 6, PERF_TRACK, PERF_TRACK_GROUP, 'primary'],
    ]);
    expect(PERF_TRACK).toBe('Pangular');

    track.set(false);
    expect(ng.profilers).toHaveLength(0);
    ng.emit(E.ComponentStart);
    ng.emit(E.ComponentEnd, cart);
    expect(stamp).toHaveBeenCalledTimes(3);
  });

  it('does nothing where the console has no timeStamp', () => {
    page();
    const ng = fakeNg();
    const track = createCdPerfTrack({ getNg: () => ng, console: {} as Console });
    expect(track.set(true)).toBe(false);
    expect(ng.profilers).toHaveLength(0);
    expect(track.on).toBe(false);
  });
});

describe('change detection views', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls ng.enableProfiling once and reports it as on for good', () => {
    page();
    const ng = fakeNg({ enableProfiling: true });
    const live = createCdLive({ getNg: () => ng });
    expect(live.report()).toBeUndefined();
    live.apply({ angularProfiling: true });
    live.apply({ angularProfiling: true });
    expect(ng.enableProfiling).toHaveBeenCalledTimes(1);
    live.stop();
    expect(live.report()).toMatchObject({
      angularProfiling: true,
      angularProfilingAvailable: true,
    });
  });

  it('reports Angular profiling as unavailable without ng.enableProfiling', () => {
    page();
    const live = createCdLive({ getNg: () => fakeNg() });
    live.apply({ angularProfiling: true });
    expect(live.report()).toEqual({
      flash: false,
      track: false,
      angularProfiling: false,
      angularProfilingAvailable: false,
    });
  });

  it('reads only known fields from a request, and never a request to stop profiling', () => {
    expect(
      toCdOptionsRequest({ flash: true, track: 'yes', angularProfiling: false, x: 1 }),
    ).toEqual({ flash: true });
    expect(toCdOptionsRequest(null)).toEqual({});
  });

  it('shares the one Angular profiler with the recorder', () => {
    page();
    const ng = fakeNg();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const my = {
      rpc: {
        call: async () => undefined,
        register: (def: { name: string; handler: (...args: unknown[]) => unknown }) =>
          handlers.set(def.name, def.handler),
      },
    };
    attachChangeDetection(my, 'p1', () => ng, 50);
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    handlers.get('change-detection-options')!({ pageId: 'p1', flash: true, track: true });
    expect(ng.ɵsetProfiler).toHaveBeenCalledTimes(1);
    expect(ng.profilers).toHaveLength(1);
  });
});

describe('change detection views through the page overlay', () => {
  const had = Object.getOwnPropertyDescriptor(console, 'timeStamp');
  beforeEach(() => {
    Object.defineProperty(console, 'timeStamp', { value: vi.fn(), configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (had) Object.defineProperty(console, 'timeStamp', had);
    else delete (console as { timeStamp?: unknown }).timeStamp;
  });

  function setup() {
    page();
    const ng = fakeNg({ enableProfiling: true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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
    const last = () =>
      sent.filter((s) => s.name === 'push-change-detection').at(-1)?.args[0] as
        { pageId: string; options?: Record<string, boolean> } | undefined;
    return { ng, cd, handlers, last, options: handlers.get('change-detection-options')! };
  }

  it('turns views on for its own page only and reports them with its pageId', async () => {
    const { ng, options, last } = setup();
    options({ pageId: 'other', flash: true });
    expect(ng.profilers).toHaveLength(0);
    expect(last()).toBeUndefined();

    options({ pageId: 'p1', flash: true });
    await Promise.resolve();
    expect(ng.profilers).toHaveLength(1);
    expect(last()).toMatchObject({
      pageId: 'p1',
      options: { flash: true, track: false, angularProfiling: false },
    });

    options({ track: true, angularProfiling: true });
    await Promise.resolve();
    expect(last()?.options).toEqual({
      flash: true,
      track: true,
      angularProfiling: true,
      angularProfilingAvailable: true,
    });

    options({ flash: false, track: false });
    expect(ng.profilers).toHaveLength(0);
  });

  it('turns the views off when the overlay stops', () => {
    const { ng, cd, options } = setup();
    options({ flash: true, track: true });
    expect(ng.profilers).toHaveLength(1);
    cd.stop();
    expect(ng.profilers).toHaveLength(0);
  });

  it('leaves options out of the report until a view is asked for', async () => {
    const { handlers, last } = setup();
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    await Promise.resolve();
    expect(last()).not.toHaveProperty('options');
  });
});
