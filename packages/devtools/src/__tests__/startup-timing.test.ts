// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_RECORD_MS,
  applicationRefOf,
  createStampReader,
  installStartupRecorder,
  startupBuffer,
  watchFirstStable,
  type StartupBuffer,
} from '../startup-recorder.ts';
import {
  attachStartup,
  readStartupTiming,
  slowestProviders,
  type StartupReport,
} from '../startup-timing.ts';

type AnyRecord = Record<string, any>;

/** A BehaviorSubject-like stream, as `ApplicationRef.isStable` is from 16.0. */
function stream(initial: boolean) {
  let value = initial;
  const listeners = new Set<(v: boolean) => void>();
  return {
    set(next: boolean) {
      value = next;
      for (const listener of [...listeners]) listener(next);
    },
    subscribe(fn: (v: boolean) => void) {
      listeners.add(fn);
      fn(value);
      return { unsubscribe: () => listeners.delete(fn) };
    },
    get size() {
      return listeners.size;
    },
  };
}

// Named like the class Angular minifies to in a dev build.
class _ApplicationRef {
  constructor(readonly isStable: ReturnType<typeof stream>) {}
  tick() {}
}

/** A fake `ng` whose root injector provides an ApplicationRef. */
function fakeNg(appRef: _ApplicationRef) {
  const injector = { get: (token: unknown) => (token === _ApplicationRef ? appRef : null) };
  return {
    getComponent: () => ({}),
    getInjector: () => injector,
    ɵgetInjectorResolutionPath: () => [injector, { env: true }],
    ɵgetInjectorProviders: (candidate: unknown) =>
      candidate === injector ? [] : [{ token: class Router {} }, { token: _ApplicationRef }],
  };
}

function root(version = '22.1.7') {
  document.body.innerHTML = `<app-root ng-version="${version}"></app-root>`;
  return document.querySelector('app-root')!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applicationRefOf and watchFirstStable', () => {
  it('finds the ApplicationRef by name through the injector resolution path', () => {
    const appRef = new _ApplicationRef(stream(false));
    expect(applicationRefOf(fakeNg(appRef), root())).toBe(appRef);
    expect(applicationRefOf({}, root())).toBeNull();
  });

  it('records the moment the app becomes stable as exact', async () => {
    const isStable = stream(false);
    let now = 100;
    const seen: unknown[] = [];
    watchFirstStable(
      new _ApplicationRef(isStable),
      (stable) => seen.push(stable),
      () => now,
    );
    now = 250.04;
    isStable.set(true);
    isStable.set(false);
    isStable.set(true);
    expect(seen).toEqual([{ at: 250, exact: true }]);
    await Promise.resolve();
    expect(isStable.size).toBe(0);
  });

  it('marks a stable state seen at the first look as an upper bound', () => {
    const seen: unknown[] = [];
    watchFirstStable(
      new _ApplicationRef(stream(true)),
      (stable) => seen.push(stable),
      () => 80,
    );
    expect(seen).toEqual([{ at: 80, exact: false }]);
  });
});

describe('the provider stamp reader', () => {
  it("pairs Angular's provider stamps and takes nested creations out of the own time", () => {
    const buffer: StartupBuffer = {
      version: 1,
      hookAt: 0,
      providers: [],
      providerRecording: 'recording',
    };
    let now = 10;
    const read = createStampReader(buffer, () => now);
    read(['Event_100_0']);
    now = 12;
    read(['Event_100_1']);
    now = 17;
    read(['HttpClient', 'Event_100_1', undefined, '🅰️ Angular', undefined, 'tertiary-dark']);
    // Other events (change detection) are not providers.
    read(['Event_12_2']);
    read(['Change detection 0', 'Event_12_2']);
    now = 20;
    read(['_TripService', 'Event_100_0', undefined, '🅰️ Angular', undefined, 'tertiary-dark']);
    expect(buffer.providers).toEqual([
      { name: 'HttpClient', at: 12, ms: 5, selfMs: 5 },
      { name: '_TripService', at: 10, ms: 10, selfMs: 5 },
    ]);
  });
});

describe('installStartupRecorder', () => {
  function fakeWorld() {
    const stamps: unknown[][] = [];
    const timers: { fn: () => void; ms: number }[] = [];
    let now = 5;
    const target: AnyRecord = {
      document,
      console: { timeStamp: (...args: unknown[]) => void stamps.push(args) },
    };
    const clock = {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const timer = { fn, ms };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (handle: unknown) => {
        const index = timers.indexOf(handle as (typeof timers)[number]);
        if (index >= 0) timers.splice(index, 1);
      },
    };
    return { target, clock, stamps, timers, tick: (ms: number) => (now += ms) };
  }

  it('records Angular publishing ng, the root component, provider spans and the first stable state', async () => {
    const world = fakeWorld();
    const buffer = installStartupRecorder(world.target, world.clock);
    expect(buffer.hookAt).toBe(5);
    expect(startupBuffer(world.target)).toBe(buffer);
    // Calling it again keeps the first recording.
    expect(installStartupRecorder(world.target, world.clock)).toBe(buffer);

    let profiler: ((event: number) => void) | null = null;
    let profilingOn = false;
    const isStable = stream(false);
    const appRef = new _ApplicationRef(isStable);
    // What `publishDefaultGlobalUtils()` does as `bootstrapApplication()` starts.
    world.tick(10);
    world.target['ng'] ??= {};
    const ng = world.target['ng'] as AnyRecord;
    Object.assign(ng, fakeNg(appRef));
    ng['ɵsetProfiler'] = (fn: (event: number) => void) => {
      profiler = fn;
      return () => (profiler = null);
    };
    ng['enableProfiling'] = () => {
      profilingOn = true;
      return () => (profilingOn = false);
    };
    expect(buffer.ngAt).toBe(15);
    // Provider profiling waits until bootstrapApplication() returned.
    expect(profilingOn).toBe(false);
    await Promise.resolve();
    expect(profilingOn).toBe(true);
    expect(buffer.providerRecording).toBe('recording');

    const stamp = world.target['console'].timeStamp as (...args: unknown[]) => void;
    stamp('Event_100_0');
    world.tick(4);
    stamp('TripService', 'Event_100_0', undefined, '🅰️ Angular');
    expect(world.stamps).toHaveLength(2);
    profiler!(10);
    world.tick(3);
    profiler!(11);
    expect(buffer.bootstrapComponent).toEqual({ start: 19, end: 22 });
    expect(buffer.providers).toEqual([{ name: 'TripService', at: 15, ms: 4, selfMs: 4 }]);

    // The root shows up; the recorder finds the ApplicationRef and waits for it.
    root();
    world.timers.find((timer) => timer.ms === 25)!.fn();
    world.tick(30);
    isStable.set(true);
    expect(buffer.stable).toEqual({ at: 52, exact: true });
    world.timers.find((timer) => timer.ms === 1000)!.fn();
    expect(buffer.providerRecording).toBe('done');
    expect(profilingOn).toBe(false);
    expect(profiler).toBeNull();
    expect(world.target['console'].timeStamp).not.toBe(stamp);
  });

  it('stops by itself when the app is never stable', async () => {
    const world = fakeWorld();
    const buffer = installStartupRecorder(world.target, world.clock);
    world.target['ng'] ??= {};
    world.target['ng']['enableProfiling'] = () => () => {};
    await Promise.resolve();
    world.timers.find((timer) => timer.ms === MAX_RECORD_MS)!.fn();
    expect(buffer.providerRecording).toBe('done');
  });

  it('says provider timing is unavailable when Angular already started', () => {
    const world = fakeWorld();
    world.target['ng'] = { getComponent: () => null };
    const buffer = installStartupRecorder(world.target, world.clock);
    expect(buffer.providerRecording).toBe('unavailable');
    expect(buffer.providerNote).toMatch(/after Angular started/);
  });

  it('never turns Angular profiling on without console.timeStamp', async () => {
    const world = fakeWorld();
    delete world.target['console'].timeStamp;
    const buffer = installStartupRecorder(world.target, world.clock);
    let profilingOn = false;
    world.target['ng'] ??= {};
    world.target['ng']['enableProfiling'] = () => {
      profilingOn = true;
    };
    await Promise.resolve();
    expect(profilingOn).toBe(false);
    expect(buffer.providerRecording).toBe('unavailable');
  });

  it('marks provider timing unavailable when Angular never publishes enableProfiling', () => {
    const world = fakeWorld();
    const buffer = installStartupRecorder(world.target, world.clock);
    world.target['ng'] ??= {};
    buffer.stop!();
    expect(buffer.providerRecording).toBe('unavailable');
    expect(buffer.providerNote).toMatch(/Angular 20/);
  });

  it('puts back a plain enableProfiling when Angular never sets it, and stops waiting by itself', () => {
    const world = fakeWorld();
    const buffer = installStartupRecorder(world.target, world.clock);
    // Angular 19 publishes `ng` without enableProfiling.
    world.target['ng'] ??= {};
    const ng = world.target['ng'] as AnyRecord;
    expect(Object.getOwnPropertyDescriptor(ng, 'enableProfiling')?.get).toBeTypeOf('function');
    world.timers.find((timer) => timer.ms === MAX_RECORD_MS)!.fn();
    expect(buffer.providerRecording).toBe('unavailable');
    expect(Object.getOwnPropertyDescriptor(ng, 'enableProfiling')).toEqual({
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    // A later assignment is a plain write: no recording starts.
    const enable = () => () => {};
    ng['enableProfiling'] = enable;
    expect(ng['enableProfiling']).toBe(enable);
    expect(buffer.ngAt).toBeUndefined();
  });

  it('removes its ng trap when no Angular ever loads', () => {
    const world = fakeWorld();
    const buffer = installStartupRecorder(world.target, world.clock);
    expect(Object.getOwnPropertyDescriptor(world.target, 'ng')?.get).toBeTypeOf('function');
    buffer.stop!();
    expect('ng' in world.target).toBe(false);
    expect(world.timers).toEqual([]);
  });
});

describe('slowestProviders', () => {
  it('groups instances by name, strips bundler prefixes and sorts by own time', () => {
    expect(
      slowestProviders([
        { name: '_Logger', at: 5, ms: 1, selfMs: 1 },
        { name: 'TripService', at: 3, ms: 9, selfMs: 2 },
        { name: 'Logger', at: 1, ms: 2, selfMs: 2 },
      ]),
    ).toEqual([
      { name: 'Logger', count: 2, ms: 3, selfMs: 3, firstAt: 1 },
      { name: 'TripService', count: 1, ms: 9, selfMs: 2, firstAt: 3 },
    ]);
  });
});

describe('readStartupTiming', () => {
  const perf = (entries: Record<string, PerformanceEntry[]>) => ({
    getEntriesByType: (type: string) => entries[type] ?? [],
    getEntriesByName: (name: string) => entries[name] ?? [],
  });

  it('reads navigation, paint and the first Angular feature mark without the hook', () => {
    root('22.1.7');
    const timing = readStartupTiming(
      900,
      { at: 700, exact: false },
      {
        doc: document,
        performance: perf({
          navigation: [{ domContentLoadedEventEnd: 120.44, loadEventEnd: 0 } as never],
          paint: [{ name: 'first-contentful-paint', startTime: 300 } as never],
          mark_feature_usage: [{ startTime: 150 } as never],
        }),
      },
    );
    expect(timing).toEqual({
      angularVersion: '22.1.7',
      navigation: { domContentLoaded: 120.4, firstContentfulPaint: 300 },
      angularStart: { at: 150, source: 'feature-mark' },
      firstStable: { at: 700, exact: false },
      overlayStart: 900,
      hook: false,
      providers: expect.objectContaining({ status: 'needs-hook', count: 0 }),
    });
    expect(timing.providers.note).toMatch(/startup-hook/);
  });

  it('prefers what the hook recorded', () => {
    root('22.1.7');
    const buffer: StartupBuffer = {
      version: 1,
      hookAt: 1,
      ngAt: 40,
      bootstrapComponent: { start: 50, end: 80 },
      stable: { at: 400, exact: true },
      providers: [{ name: 'TripService', at: 60, ms: 3, selfMs: 3 }],
      providerRecording: 'done',
    };
    const timing = readStartupTiming(900, undefined, {
      doc: document,
      performance: perf({}),
      buffer,
    });
    expect(timing).toMatchObject({
      angularStart: { at: 40, source: 'hook' },
      bootstrapComponent: { start: 50, end: 80 },
      firstStable: { at: 400, exact: true },
      hook: true,
      providers: { status: 'measured', count: 1, totalSelfMs: 3 },
    });
  });

  it('reuses the provider summary until the spans or the recording status change', () => {
    root('22.1.7');
    const buffer: StartupBuffer = {
      version: 1,
      hookAt: 1,
      providers: [{ name: 'TripService', at: 60, ms: 3, selfMs: 3 }],
      providerRecording: 'recording',
    };
    const read = () =>
      readStartupTiming(0, undefined, { doc: document, performance: perf({}), buffer }).providers;
    const first = read();
    expect(read()).toBe(first);
    buffer.providers.push({ name: 'Logger', at: 70, ms: 1, selfMs: 1 });
    const second = read();
    expect(second).not.toBe(first);
    expect(second.count).toBe(2);
    buffer.providerRecording = 'done';
    const done = read();
    expect(done.status).toBe('measured');
    expect(read()).toBe(done);
  });

  it('says provider timing needs Angular 20 when an older Angular started under the hook', () => {
    root('19.2.0');
    const buffer: StartupBuffer = {
      version: 1,
      hookAt: 1,
      providers: [],
      providerRecording: 'pending',
    };
    const timing = readStartupTiming(0, undefined, {
      doc: document,
      performance: perf({}),
      buffer,
    });
    expect(timing.providers).toMatchObject({ status: 'unavailable' });
    expect(timing.providers.note).toMatch(/Angular 20/);
  });
});

describe('attachStartup', () => {
  function fakeRpc() {
    const calls: { name: string; args: unknown[] }[] = [];
    return {
      calls,
      pushes: () =>
        calls
          .filter((call) => call.name === 'push-startup')
          .map((call) => call.args[0] as StartupReport),
      my: {
        rpc: {
          call: async (name: string, ...args: unknown[]) => {
            calls.push({ name, args });
          },
        },
      },
    };
  }

  it('pushes the timing with the page id, skips unchanged reports and keeps the page alive', async () => {
    root();
    const rpc = fakeRpc();
    let now = 1000;
    const collector = attachStartup(rpc.my, 'tab1', () => undefined, {
      now: () => now,
      tickMs: () => 1000,
      env: { doc: document },
    });
    await collector.push();
    await collector.push();
    expect(rpc.pushes()).toHaveLength(1);
    expect(rpc.pushes()[0]).toMatchObject({ pageId: 'tab1', hook: false });
    now += 7500;
    await collector.push();
    expect(rpc.pushes()).toHaveLength(2);
    collector.leave();
    expect(rpc.calls.at(-1)).toEqual({ name: 'forget-startup-page', args: ['tab1'] });
    collector.stop();
  });

  it('watches the app become stable when the overlay starts first', async () => {
    root();
    const isStable = stream(false);
    const rpc = fakeRpc();
    const collector = attachStartup(rpc.my, 'tab1', () => fakeNg(new _ApplicationRef(isStable)), {
      env: { doc: document },
    });
    await collector.push();
    expect(rpc.pushes()[0].firstStable).toBeUndefined();
    isStable.set(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rpc.pushes().at(-1)?.firstStable).toMatchObject({ exact: true });
    collector.stop();
  });

  it('labels the report with the URL the app started on, not the one it navigated to', async () => {
    root();
    history.replaceState(null, '', '/trips?token=abc');
    const rpc = fakeRpc();
    const collector = attachStartup(rpc.my, 'tab1', () => undefined, { env: { doc: document } });
    history.pushState(null, '', '/settings');
    await collector.push();
    expect(rpc.pushes()[0].url).toMatch(/\/trips\?token=/);
    expect(rpc.pushes()[0].url).not.toContain('abc');
    expect(rpc.pushes()[0].url).not.toContain('/settings');
    collector.stop();
  });

  it('gives an upper bound when the app was stable before the overlay looked', async () => {
    root();
    const rpc = fakeRpc();
    const collector = attachStartup(
      rpc.my,
      'tab1',
      () => fakeNg(new _ApplicationRef(stream(true))),
      { env: { doc: document } },
    );
    await collector.push();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rpc.pushes().at(-1)?.firstStable).toMatchObject({ exact: false });
    collector.stop();
  });
});
