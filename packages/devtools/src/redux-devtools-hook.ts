/**
 * A stand-in for the Redux DevTools extension's page API
 * (`window.__REDUX_DEVTOOLS_EXTENSION__`), so stores that already talk to that
 * extension (NGXS, Elf, MiniRx) report to the store inspector too. It records
 * what each connection sends: `init(state)` and `send(action, state)`.
 *
 * When the real extension is on the page, every call goes on to it unchanged,
 * so it keeps working. Nothing is sent back to the app: the stand-in never
 * calls a store's `subscribe` listener, so it cannot jump, skip or import.
 *
 * `@ngrx/store-devtools` connects through the same API. The NgRx collector
 * already reads that Store, so its connection is passed on and not recorded.
 */

export const REDUX_EXTENSION_KEY = '__REDUX_DEVTOOLS_EXTENSION__';
const HOOK_KEY = Symbol.for('pangular.redux-devtools-hook');

/** What a store sent, kept as it was until the collector reads it. */
export interface ReduxRawEntry {
  type: string;
  action: unknown;
  state: unknown;
  timestamp: number;
}

/** One `connect()` call: usually one store library instance. */
export interface ReduxConnection {
  /** Stable for the page's life: `r1`, `r2`, ... */
  readonly id: string;
  /** The `name` option the store passed to `connect`, or the library name. */
  name: string;
  /** NGXS, Elf, MiniRx, or `Redux DevTools` for another library. */
  library: string;
  /** The last state the store sent. */
  state: unknown;
  hasState: boolean;
  /** How many times the store sent an action or its initial state. */
  count: number;
  /** Raw entries the collector has not read yet, oldest first, at most `maxPending`. */
  pending: ReduxRawEntry[];
  /** Entries dropped from `pending` before the collector read them. */
  dropped: number;
  /** The store disconnected (`unsubscribe()` or the extension's `disconnect()`). */
  closed: boolean;
}

export interface ReduxDevtoolsHook {
  readonly connections: ReduxConnection[];
  /** The most raw entries kept per connection until the collector reads them. */
  maxPending: number;
  /** Called after every recorded entry. */
  readonly listeners: Set<() => void>;
  /** Whether the stand-in still sits on the page. Recorded connections keep working after it leaves. */
  installed: boolean;
  /** Puts back what was on the page before (the real extension, or nothing). */
  uninstall(): void;
}

type AnyRecord = Record<string, any>;
type Target = Record<PropertyKey, unknown>;

const DEFAULT_MAX_PENDING = 200;
const MAX_TYPE = 200;
const MAX_NAME = 100;

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Whether `connect` options come from `@ngrx/store-devtools`. Its
 * `getExtensionConfig()` always sets these four keys, which no other library's
 * integration sends together.
 */
export function isNgrxDevtoolsOptions(options: unknown): boolean {
  if (!options || typeof options !== 'object') return false;
  return ['features', 'serialize', 'autoPause', 'traceLimit'].every((key) => key in options);
}

function typeOf(action: unknown): string {
  const raw =
    typeof action === 'string'
      ? action
      : attempt(() => (action as AnyRecord | null)?.['type'], undefined);
  const text = typeof raw === 'string' ? raw : raw === undefined ? 'action' : String(raw);
  return text.slice(0, MAX_TYPE) || 'action';
}

/**
 * The library behind a connection, from its `name` option and the shape of
 * its first action. NGXS names itself `NGXS` and sends `{...action, action: null}`,
 * MiniRx names itself `MiniRx - Redux DevTools`, and Elf has no default name
 * but types its actions `[Store] - @Init` and `[Store] - Update`.
 */
export function libraryOf(name: string | undefined, action?: unknown): string | undefined {
  if (name && /ngxs/i.test(name)) return 'NGXS';
  if (name && /mini-?rx/i.test(name)) return 'MiniRx';
  if (name && /\belf\b/i.test(name)) return 'Elf';
  if (action && typeof action === 'object' && attempt(() => 'action' in action, false)) {
    if ((action as AnyRecord)['action'] === null) return 'NGXS';
  }
  const type = action === undefined ? '' : typeOf(action);
  if (/^\[.+\] - (@Init|Update)$/.test(type) || /^Remove \S/.test(type)) return 'Elf';
  return undefined;
}

const noop = () => {};

/** A connection that records nothing and goes nowhere, for NgRx without the real extension. */
function silentConnection(): AnyRecord {
  return { init: noop, send: noop, subscribe: () => noop, unsubscribe: noop, error: noop };
}

/**
 * Installs the stand-in on `target` (the page's `window`). Calling it again
 * returns the hook already there. Returns null when the property can't be
 * replaced, such as a non-configurable extension object.
 */
export function installReduxDevtoolsHook(
  target: Target = globalThis as unknown as Target,
  options: { maxPending?: number } = {},
): ReduxDevtoolsHook | null {
  const existing = target[HOOK_KEY] as ReduxDevtoolsHook | undefined;
  if (existing?.installed) {
    if (options.maxPending) existing.maxPending = options.maxPending;
    return existing;
  }
  const descriptor = Object.getOwnPropertyDescriptor(target, REDUX_EXTENSION_KEY);
  if (descriptor && !descriptor.configurable) return null;
  let real: unknown = descriptor
    ? 'value' in descriptor
      ? descriptor.value
      : attempt(() => descriptor.get?.call(target), undefined)
    : undefined;
  // The real extension is a function (the store enhancer) with `connect`, `send` and the rest on it.
  const realOf = () =>
    real && (typeof real === 'object' || typeof real === 'function') ? (real as AnyRecord) : null;

  // Connections live on across installs, so a store keeps its id after the overlay restarts.
  const connections: ReduxConnection[] = existing?.connections ?? [];
  const listeners: Set<() => void> = existing?.listeners ?? new Set();
  let next = connections.length;

  const notify = () => {
    for (const listener of [...listeners]) attempt(listener, undefined);
  };

  const record = (connection: ReduxConnection, action: unknown, state: unknown, init: boolean) => {
    if (connection.closed) return;
    const type = init ? '@@INIT' : typeOf(action);
    if (!connection.count) {
      connection.library =
        libraryOf(connection.name, init ? undefined : action) ?? 'Redux DevTools';
      if (!connection.name) connection.name = connection.library;
    }
    connection.count++;
    connection.state = state;
    connection.hasState = true;
    connection.pending.push({
      type,
      action: init ? undefined : action,
      state,
      timestamp: Date.now(),
    });
    const over = connection.pending.length - hook.maxPending;
    if (over > 0) {
      connection.pending.splice(0, over);
      connection.dropped += over;
    }
    notify();
  };

  const connect = (connectOptions?: unknown) => {
    const upstream = attempt(() => realOf()?.['connect']?.(connectOptions), undefined) as
      AnyRecord | undefined;
    if (isNgrxDevtoolsOptions(connectOptions)) return upstream ?? silentConnection();
    const named = attempt(() => (connectOptions as AnyRecord | undefined)?.['name'], undefined);
    const name = typeof named === 'string' ? named.slice(0, MAX_NAME) : '';
    const connection: ReduxConnection = {
      id: `r${++next}`,
      name,
      library: libraryOf(name) ?? 'Redux DevTools',
      state: undefined,
      hasState: false,
      count: 0,
      pending: [],
      dropped: 0,
      closed: false,
    };
    connections.push(connection);
    const forward = (method: string, ...args: unknown[]) =>
      attempt(() => upstream?.[method]?.(...args), undefined);
    return {
      init(state?: unknown, ...rest: unknown[]) {
        attempt(() => record(connection, undefined, state, true), undefined);
        return forward('init', state, ...rest);
      },
      send(action: unknown, state?: unknown, ...rest: unknown[]) {
        attempt(() => record(connection, action, state, false), undefined);
        return forward('send', action, state, ...rest);
      },
      subscribe(listener: unknown) {
        const unsubscribe = forward('subscribe', listener);
        return typeof unsubscribe === 'function' ? unsubscribe : noop;
      },
      unsubscribe() {
        connection.closed = true;
        notify();
        return forward('unsubscribe');
      },
      error(message: unknown) {
        return forward('error', message);
      },
    };
  };

  const disconnect = (...args: unknown[]) => {
    for (const connection of connections) connection.closed = true;
    notify();
    return attempt(() => realOf()?.['disconnect']?.(...args), undefined);
  };

  const overrides: AnyRecord = {
    connect,
    disconnect,
    // The extension's top-level send (used by @ngrx/store-devtools for full updates).
    send: (...args: unknown[]) => attempt(() => realOf()?.['send']?.(...args), undefined),
  };
  // A function target keeps the stand-in callable (`ext && ext()` in `createStore`)
  // and `typeof` 'function', like the real extension. An arrow function has no
  // non-configurable `prototype`, so the traps below are free to answer.
  const callable = (() => undefined) as unknown as AnyRecord;
  const stand = new Proxy(callable, {
    apply(_fn, thisArg, args: unknown[]) {
      const upstream = realOf();
      if (typeof upstream === 'function') return Reflect.apply(upstream, thisArg, args);
      // No extension: an enhancer that leaves the store as it is.
      return (nextCreator: unknown) => nextCreator;
    },
    get(_fn, key) {
      if (Object.hasOwn(overrides, key)) return overrides[key as string];
      const upstream = realOf();
      if (!upstream) return undefined;
      const value = attempt(() => Reflect.get(upstream, key), undefined);
      return typeof value === 'function' ? value.bind(upstream) : value;
    },
    has(_fn, key) {
      const upstream = realOf();
      return Object.hasOwn(overrides, key) || (!!upstream && attempt(() => key in upstream, false));
    },
  });

  const hook: ReduxDevtoolsHook = {
    connections,
    maxPending: options.maxPending ?? existing?.maxPending ?? DEFAULT_MAX_PENDING,
    listeners,
    installed: true,
    uninstall() {
      if (!hook.installed) return;
      hook.installed = false;
      const now = Object.getOwnPropertyDescriptor(target, REDUX_EXTENSION_KEY);
      if (now?.get !== read) return;
      delete target[REDUX_EXTENSION_KEY];
      if (real !== undefined) {
        Object.defineProperty(target, REDUX_EXTENSION_KEY, {
          value: real,
          writable: true,
          configurable: true,
          enumerable: descriptor?.enumerable ?? true,
        });
      }
    },
  };
  function read() {
    return stand;
  }
  // A setter keeps an extension that arrives later as the one calls go on to.
  Object.defineProperty(target, REDUX_EXTENSION_KEY, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? false,
    get: read,
    set(value: unknown) {
      real = value;
    },
  });
  Object.defineProperty(target, HOOK_KEY, { value: hook, configurable: true, writable: true });
  return hook;
}

/** The installed hook, if any. */
export function reduxDevtoolsHook(
  target: Target = globalThis as unknown as Target,
): ReduxDevtoolsHook | null {
  const hook = target[HOOK_KEY] as ReduxDevtoolsHook | undefined;
  return hook?.installed ? hook : null;
}

/** Removes the stand-in and drops what it recorded. */
export function uninstallReduxDevtoolsHook(target: Target = globalThis as unknown as Target) {
  const hook = target[HOOK_KEY] as ReduxDevtoolsHook | undefined;
  if (!hook) return;
  hook.uninstall();
  for (const connection of hook.connections) connection.pending.length = 0;
  hook.listeners.clear();
}
