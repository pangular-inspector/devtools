export type Profiler = (event: number, instance?: unknown, hook?: unknown) => void;

interface ProfilerApi {
  ɵsetProfiler?: (profiler: Profiler | null) => unknown;
}

interface ZoneLike {
  root?: { run<T>(fn: () => T): T };
}

/** Angular's `ProfilerEvent.TemplateCreateStart` and `TemplateUpdateStart`. */
const TEMPLATE_CREATE_START = 0;
const TEMPLATE_UPDATE_START = 2;

export const REFRESH_DEBOUNCE_MS = 250;
export const POLL_MS = 3000;
export const HEARTBEAT_MS = 4000;
/** An unchanged report is sent again this often, well inside the server's 15 s TTL. */
export const KEEPALIVE_MS = 8000;

/**
 * Whether an unchanged report must be sent on this tick: waiting for the next
 * one, `tickMs` away, would leave more than `KEEPALIVE_MS` since the last send.
 */
export function keepaliveDue(sentAt: number, tickMs: number, now = Date.now()): boolean {
  return now - sentAt + tickMs > KEEPALIVE_MS;
}

export interface RefreshOptions {
  getNg: () => unknown;
  refresh: () => void;
  doc?: Document;
  debounceMs?: number;
  pollMs?: number;
  heartbeatMs?: number;
}

export interface RefreshScheduler {
  readonly mode: 'change-detection' | 'poll';
  /** The longest gap between two refreshes. */
  readonly intervalMs: number;
  stop(): void;
}

/**
 * Runs `fn` in the root zone when zone.js is loaded, so timers created there do
 * not make the app run change detection, which would call the profiler again.
 */
export function outsideAngular<T>(fn: () => T): T {
  const root = (globalThis as { Zone?: ZoneLike }).Zone?.root;
  return root ? root.run(fn) : fn();
}

/** The major version from the `ng-version` attribute, or 0 when there is none. */
export function angularMajor(doc: Document = document): number {
  const version = doc.querySelector('[ng-version]')?.getAttribute('ng-version') ?? '';
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) ? major : 0;
}

interface ProfilerHub {
  listeners: Set<Profiler>;
  remove: () => void;
}

const hubs = new WeakMap<object, ProfilerHub>();

/**
 * Adds `listener` to the one profiler this package registers with Angular, and
 * returns its remover. Returns null before Angular 20: there is a single
 * profiler slot there, and taking it would evict the Angular DevTools
 * extension with no remover to give it back.
 */
export function addProfilerListener(
  ng: unknown,
  listener: Profiler,
  doc: Document = document,
): (() => void) | null {
  const setProfiler = (ng as ProfilerApi | undefined)?.ɵsetProfiler;
  if (!ng || typeof setProfiler !== 'function' || angularMajor(doc) < 20) return null;
  let hub = hubs.get(ng as object);
  if (!hub) {
    const listeners = new Set<Profiler>();
    const dispatch: Profiler = (event, instance, hook) => {
      for (const each of listeners) {
        try {
          each(event, instance, hook);
        } catch {
          continue;
        }
      }
    };
    let remove: unknown;
    try {
      remove = setProfiler(dispatch);
    } catch {
      return null;
    }
    if (typeof remove !== 'function') return null;
    hub = { listeners, remove: remove as () => void };
    hubs.set(ng as object, hub);
  }
  const owner = hub;
  owner.listeners.add(listener);
  return () => {
    if (!owner.listeners.delete(listener) || owner.listeners.size) return;
    // Never `setProfiler(null)`: that clears every registered profiler.
    owner.remove();
    if (hubs.get(ng as object) === owner) hubs.delete(ng as object);
  };
}

/**
 * Calls `refresh` shortly after Angular updates a template, with a slow
 * heartbeat on top. Where the profiler hook is missing, it polls instead.
 */
export function watchChangeDetection(options: RefreshOptions): RefreshScheduler {
  const doc = options.doc ?? document;
  const debounceMs = options.debounceMs ?? REFRESH_DEBOUNCE_MS;
  const pollMs = options.pollMs ?? POLL_MS;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;

  let pending: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let removeProfiler: (() => void) | null = null;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    try {
      options.refresh();
    } catch {
      return;
    }
  };

  const fire = () => {
    pending = undefined;
    run();
  };

  const profiler: Profiler = (event) => {
    if (pending !== undefined || stopped) return;
    if (event !== TEMPLATE_UPDATE_START && event !== TEMPLATE_CREATE_START) return;
    pending = outsideAngular(() => setTimeout(fire, debounceMs));
  };

  const attach = () => {
    removeProfiler = addProfilerListener(options.getNg(), profiler, doc);
    return removeProfiler !== null;
  };

  const every = (ms: number, fn: () => void) => {
    clearInterval(interval);
    interval = outsideAngular(() => setInterval(fn, ms));
  };

  const scheduler = {
    mode: 'poll' as RefreshScheduler['mode'],
    intervalMs: pollMs,
    stop() {
      stopped = true;
      clearTimeout(pending);
      clearInterval(interval);
      pending = undefined;
      removeProfiler?.();
      removeProfiler = null;
    },
  };

  const hooked = () => {
    scheduler.mode = 'change-detection';
    scheduler.intervalMs = heartbeatMs;
    every(heartbeatMs, run);
  };

  if (attach()) hooked();
  else
    every(pollMs, () => {
      // The page may not have bootstrapped yet, so keep trying to hook in.
      if (attach()) hooked();
      run();
    });
  return scheduler;
}
