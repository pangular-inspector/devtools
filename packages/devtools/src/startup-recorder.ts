// Records how the app started, for the startup timing in the Injectors tab.
//
// Most of it is read after the fact (`startup-timing.ts`). What can only be
// seen while it happens is recorded here, by the `startup-hook` entry the app
// loads before Angular (from the polyfills of its development build):
//
// - when Angular published its debug API (`ng`), which it does as it creates
//   the platform at the start of `bootstrapApplication()`;
// - the root component's creation, through `ng.ɵsetProfiler` (Angular 20+);
// - how long each provider took to construct, from Angular's own profiling
//   (`ng.enableProfiling()`, 20+), which reports each injector creation as a
//   `console.timeStamp` pair. The hook reads those calls (and passes them on)
//   from just after the platform exists until the app is first stable, then
//   turns profiling off again;
// - when the app was first stable, from `ApplicationRef.isStable`.
//
// No import: the hook entry stays small and runs before anything else.

type AnyRecord = Record<string, any>;

/** Angular's `ProfilerEvent` values the hook reads. */
const BOOTSTRAP_COMPONENT_START = 10;
const BOOTSTRAP_COMPONENT_END = 11;
/** The pseudo event `enableProfiling()` stamps provider creations with. */
const PROVIDER_EVENT = 100;
const STAMP = /^Event_(\d+)_(\d+)$/;

/** Provider spans kept at most. */
export const MAX_PROVIDER_SPANS = 3000;
/** Recording stops this long after the app is first stable. */
export const STABLE_GRACE_MS = 1000;
/** And at the latest this long after it started. */
export const MAX_RECORD_MS = 30_000;
/** How often the hook looks for the root while it waits for one. */
const ROOT_POLL_MS = 25;

export interface ProviderSpan {
  name: string;
  /** Start, in ms since navigation start. */
  at: number;
  ms: number;
  /** Without the providers it created while it ran. */
  selfMs: number;
}

export type ProviderRecording = 'pending' | 'recording' | 'done' | 'unavailable';

/** What the hook recorded, on `globalThis.__PANGULAR_STARTUP__`. */
export interface StartupBuffer {
  version: 1;
  /** When the hook ran, in ms since navigation start. */
  hookAt: number;
  /** When Angular published `ng`. */
  ngAt?: number;
  bootstrapComponent?: { start?: number; end?: number };
  stable?: { at: number; exact: boolean };
  providers: ProviderSpan[];
  providerRecording: ProviderRecording;
  /** Why provider timing is unavailable. */
  providerNote?: string;
  /**
   * Stops recording now and puts back what the hook replaced. The hook calls
   * it itself, one second after the first stable state or `MAX_RECORD_MS`
   * after it started; nothing else needs to.
   */
  stop?: () => void;
}

const BUFFER_KEY = '__PANGULAR_STARTUP__';

/** The hook's buffer, when the hook ran on this page. */
export function startupBuffer(target: object = globalThis): StartupBuffer | undefined {
  const buffer = (target as { [BUFFER_KEY]?: StartupBuffer })[BUFFER_KEY];
  return buffer && buffer.version === 1 && Array.isArray(buffer.providers) ? buffer : undefined;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}

function nameOf(token: unknown): string {
  if (typeof token === 'function') return (token as { name?: string }).name ?? '';
  if (token && typeof token === 'object') {
    const desc = read(() => (token as AnyRecord)['_desc'], undefined);
    if (typeof desc === 'string') return desc;
    return read(() => String(token), '');
  }
  return String(token ?? '');
}

function isSubscribable(
  value: unknown,
): value is { subscribe: (fn: (v: unknown) => void) => unknown } {
  return !!value && typeof (value as AnyRecord)['subscribe'] === 'function';
}

function isAppRef(value: unknown): value is AnyRecord {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AnyRecord)['tick'] === 'function' &&
    isSubscribable(read(() => (value as AnyRecord)['isStable'], null))
  );
}

/**
 * The app's `ApplicationRef`, found by name through the root's injector
 * resolution path (`ng.ɵgetInjectorProviders`, 16.2+), as `providerOf()` in
 * `router.ts` finds the Router.
 */
export function applicationRefOf(ng: unknown, root: Element): AnyRecord | null {
  const api = ng as AnyRecord | undefined;
  if (!api || typeof api['getInjector'] !== 'function') return null;
  const injector = read(() => api['getInjector'](root), null);
  if (!injector) return null;
  const path = read(
    () => (api['ɵgetInjectorResolutionPath']?.(injector) as unknown[]) ?? [injector],
    [injector],
  );
  for (const candidate of path) {
    const providers = read(
      () => (api['ɵgetInjectorProviders']?.(candidate) as { token: unknown }[]) ?? [],
      [],
    );
    for (const { token } of providers) {
      if (nameOf(token).replace(/^_+/, '') !== 'ApplicationRef') continue;
      const value = read(() => (injector as AnyRecord)['get'](token, null), null);
      if (isAppRef(value)) return value;
    }
  }
  return null;
}

/**
 * Calls `onStable` once with when the app first was stable. `exact` is false
 * when it already was at the first look, so `at` is only an upper bound.
 * Returns a function that stops watching.
 */
export function watchFirstStable(
  appRef: AnyRecord,
  onStable: (stable: { at: number; exact: boolean }) => void,
  now: () => number = () => performance.now(),
): () => void {
  let first = true;
  let done = false;
  let subscription: { unsubscribe?: () => void } | null = null;
  const stable = read(() => appRef['isStable'], null);
  if (!isSubscribable(stable)) return () => {};
  subscription = read(
    () =>
      stable.subscribe((value: unknown) => {
        if (done || value !== true) {
          first = false;
          return;
        }
        done = true;
        onStable({ at: round(now()), exact: !first });
        queueMicrotask(() => subscription?.unsubscribe?.());
      }) as { unsubscribe?: () => void },
    null,
  );
  first = false;
  if (done) queueMicrotask(() => subscription?.unsubscribe?.());
  return () => {
    done = true;
    subscription?.unsubscribe?.();
  };
}

/** Reads the provider spans out of `console.timeStamp` calls. */
export function createStampReader(buffer: StartupBuffer, now: () => number) {
  const open = new Map<string, { at: number; childMs: number }>();
  const stack: string[] = [];
  return (args: unknown[]) => {
    const [label, start] = args;
    if (args.length === 1 && typeof label === 'string') {
      const match = STAMP.exec(label);
      if (match && Number(match[1]) === PROVIDER_EVENT) {
        open.set(label, { at: now(), childMs: 0 });
        stack.push(label);
      }
      return;
    }
    if (typeof start !== 'string') return;
    const match = STAMP.exec(start);
    if (!match || Number(match[1]) !== PROVIDER_EVENT) return;
    const span = open.get(start);
    if (!span) return;
    open.delete(start);
    const index = stack.lastIndexOf(start);
    if (index >= 0) stack.splice(index, 1);
    const ms = Math.max(0, now() - span.at);
    const parent = stack.length ? open.get(stack[stack.length - 1]) : undefined;
    if (parent) parent.childMs += ms;
    if (buffer.providers.length >= MAX_PROVIDER_SPANS) return;
    buffer.providers.push({
      name: typeof label === 'string' ? label.slice(0, 200) : String(label),
      at: round(span.at),
      ms: round(ms),
      selfMs: round(Math.max(0, ms - span.childMs)),
    });
  };
}

interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Starts recording on `target` (the global object). Safe to call more than
 * once. Does nothing useful when Angular already started: the buffer then
 * says provider timing is unavailable.
 */
export function installStartupRecorder(
  target: AnyRecord = globalThis as AnyRecord,
  clock: Clock = realClock,
): StartupBuffer {
  const existing = startupBuffer(target);
  if (existing) return existing;
  const buffer: StartupBuffer = {
    version: 1,
    hookAt: round(clock.now()),
    providers: [],
    providerRecording: 'pending',
  };
  target[BUFFER_KEY] = buffer;

  const doc = target['document'] as Document | undefined;
  const consoleRef = target['console'] as AnyRecord | undefined;
  let stopProfiling: (() => void) | null = null;
  let removeProfiler: (() => void) | null = null;
  let restoreStamp: (() => void) | null = null;
  let stopStable: (() => void) | null = null;
  let graceTimer: unknown;
  let maxTimer: unknown;
  let rootTimer: unknown;
  /** Puts back the `ng` and `enableProfiling` traps Angular never set off. */
  let untrapNg: (() => void) | null = null;
  let untrapProfiling: (() => void) | null = null;

  const stop = () => {
    read(() => untrapProfiling?.(), undefined);
    untrapProfiling = null;
    read(() => untrapNg?.(), undefined);
    untrapNg = null;
    clock.clearTimeout(graceTimer);
    clock.clearTimeout(maxTimer);
    clock.clearTimeout(rootTimer);
    stopStable?.();
    stopStable = null;
    restoreStamp?.();
    restoreStamp = null;
    read(() => stopProfiling?.(), undefined);
    stopProfiling = null;
    read(() => removeProfiler?.(), undefined);
    removeProfiler = null;
    if (buffer.providerRecording === 'recording') buffer.providerRecording = 'done';
    else if (buffer.providerRecording === 'pending') {
      buffer.providerRecording = 'unavailable';
      buffer.providerNote ??=
        'Angular did not publish ng.enableProfiling, which needs Angular 20 or later in a development build.';
    }
  };
  buffer.stop = stop;

  let watching = false;
  /** Starts watching `isStable` once the root's ApplicationRef can be found. */
  const watchFrom = (ng: AnyRecord, root: Element | null): boolean => {
    if (watching) return true;
    const appRef = root ? applicationRefOf(ng, root) : null;
    if (!appRef) return false;
    watching = true;
    clock.clearTimeout(rootTimer);
    stopStable = watchFirstStable(
      appRef,
      (stable) => {
        buffer.stable = stable;
        graceTimer = clock.setTimeout(stop, STABLE_GRACE_MS);
      },
      clock.now,
    );
    return true;
  };

  /** Looks for the root now and then, for when no profiler event says it is there. */
  const watchStable = (ng: AnyRecord) => {
    const look = (tries: number) => {
      const root = read(() => doc?.querySelector('[ng-version]') ?? null, null);
      if (watchFrom(ng, root) || tries > MAX_RECORD_MS / ROOT_POLL_MS) return;
      rootTimer = clock.setTimeout(() => look(tries + 1), ROOT_POLL_MS);
    };
    look(0);
  };

  const startProviders = (enable: unknown) => {
    const stamp = consoleRef?.['timeStamp'];
    // Angular's profiling calls `console.timeStamp`; without it, it would throw.
    if (typeof enable !== 'function' || typeof stamp !== 'function') {
      buffer.providerRecording = 'unavailable';
      buffer.providerNote = 'This browser has no console.timeStamp, which Angular profiling uses.';
      return;
    }
    const readStamp = createStampReader(buffer, clock.now);
    const wrapped = function (this: unknown, ...args: unknown[]) {
      try {
        readStamp(args);
      } catch {
        // Reading never breaks the app's console.
      }
      return (stamp as (...a: unknown[]) => unknown).apply(this, args);
    };
    consoleRef!['timeStamp'] = wrapped;
    restoreStamp = () => {
      if (consoleRef!['timeStamp'] === wrapped) consoleRef!['timeStamp'] = stamp;
    };
    const remover = read(() => (enable as () => unknown)(), undefined);
    stopProfiling = typeof remover === 'function' ? (remover as () => void) : null;
    buffer.providerRecording = 'recording';
  };

  // Angular published `ng`: note the time, listen to the profiler, and turn
  // provider profiling on once `bootstrapApplication()` returned, so no
  // profiler span is open when it starts.
  const published = (ng: AnyRecord, enable: unknown) => {
    buffer.ngAt = round(clock.now());
    const setProfiler = ng['ɵsetProfiler'];
    if (typeof setProfiler === 'function') {
      const remover = read(
        () =>
          setProfiler((event: number, instance?: unknown) => {
            if (event === BOOTSTRAP_COMPONENT_START) {
              buffer.bootstrapComponent = { start: round(clock.now()) };
            } else if (event === BOOTSTRAP_COMPONENT_END) {
              (buffer.bootstrapComponent ??= {}).end = round(clock.now());
              // The root exists now, before its first change detection, so the
              // first stable state is seen as it happens.
              const host = read(
                () => (instance as AnyRecord | undefined)?.['location']?.['nativeElement'],
                null,
              );
              watchFrom(
                ng,
                typeof Element !== 'undefined' && host instanceof Element ? host : null,
              );
            }
          }),
        undefined,
      );
      // Before 20.0 there is one profiler slot and no remover: don't hold it.
      if (typeof remover === 'function') removeProfiler = remover as () => void;
      else read(() => setProfiler(null), undefined);
    }
    queueMicrotask(() => startProviders(enable));
    watchStable(ng);
    clock.clearTimeout(maxTimer);
    maxTimer = clock.setTimeout(stop, MAX_RECORD_MS);
  };

  const trap = (ng: AnyRecord) => {
    let value: unknown;
    const get = () => value;
    const plain = () =>
      Object.defineProperty(ng, 'enableProfiling', {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    const trapped = read(
      () =>
        Object.defineProperty(ng, 'enableProfiling', {
          configurable: true,
          enumerable: true,
          get,
          set: (fn: unknown) => {
            value = fn;
            untrapProfiling = null;
            plain();
            published(ng, fn);
          },
        }),
      null,
    );
    if (!trapped) return;
    // Before Angular 20 nothing sets it: `stop` makes it a plain property again.
    untrapProfiling = () => {
      if (Object.getOwnPropertyDescriptor(ng, 'enableProfiling')?.get === get) plain();
    };
  };

  const current = target['ng'] as AnyRecord | undefined;
  if (current && typeof current['getComponent'] === 'function') {
    buffer.providerRecording = 'unavailable';
    buffer.providerNote =
      'The startup hook loaded after Angular started. Load it from the polyfills of the development build.';
    const ng = current;
    queueMicrotask(() => watchStable(ng));
    return buffer;
  }
  // Stops waiting when Angular never publishes `enableProfiling` (before 20,
  // or no Angular at all); `published` restarts the timer when it does.
  const waitForAngular = () => {
    maxTimer = clock.setTimeout(stop, MAX_RECORD_MS);
  };
  if (current && typeof current === 'object') {
    trap(current);
    waitForAngular();
    return buffer;
  }
  // Angular creates `ng` with `ng ??= {}`, then adds its functions to it.
  const getNg = () => undefined;
  const defined = read(
    () =>
      Object.defineProperty(target, 'ng', {
        configurable: true,
        enumerable: true,
        get: getNg,
        set: (ng: unknown) => {
          untrapNg = null;
          Object.defineProperty(target, 'ng', {
            value: ng,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          if (ng && typeof ng === 'object') trap(ng as AnyRecord);
        },
      }),
    null,
  );
  if (!defined) {
    buffer.providerRecording = 'unavailable';
    buffer.providerNote = 'The startup hook could not watch for Angular on this page.';
    return buffer;
  }
  // `ng` was not there before the hook, so `stop` removes the trap.
  untrapNg = () => {
    if (Object.getOwnPropertyDescriptor(target, 'ng')?.get === getNg) delete target['ng'];
  };
  waitForAngular();
  return buffer;
}
