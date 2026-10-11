// Observes Capacitor plugin calls on the page, without changing them.
//
// Native calls: a plugin proxy from `registerPlugin()` sends each native call
// through `Capacitor.nativePromise` or `Capacitor.nativeCallback`, which it
// looks up on every call (`createPluginMethod` in @capacitor/core 6 to 8, and
// `native-bridge.js`). Wrapping those two functions sees calls from plugins
// registered before the overlay loaded.
//
// Calls answered in JavaScript (a plugin's web implementation, or core's own
// "not implemented" rejection) never reach the bridge. They are seen only when
// the hook runs before @capacitor/core: core assigns `Capacitor.registerPlugin`
// on the existing `window.Capacitor` and then reads it back for its
// `registerPlugin` export, so an accessor placed there first hands plugins a
// wrapped `registerPlugin`. If core ran first, only native calls are logged.
//
// Every wrapper returns what the original returned and passes every argument
// through as it is.
import { hasSecretKey, maskedArgs, maskedResult } from './capacitor-redact.ts';
import { redactMessage, redactUrl } from './router.ts';
import { clip } from './text.ts';

export interface CapacitorPluginInfo {
  name: string;
  /** `Capacitor.isPluginAvailable(name)` on this platform. */
  available: boolean;
  /**
   * The app registered it with `registerPlugin()` (imported its package).
   * `null` when that can't be told: on iOS and Android, `Capacitor.Plugins`
   * lists every native plugin, so only the capacitor-hook entry knows.
   */
  registered: boolean | null;
  /** The native project has it (`Capacitor.PluginHeaders`). */
  native: boolean;
  /** Native methods from `Capacitor.PluginHeaders`, empty for a JS-only plugin. */
  methods: string[];
}

export interface CapacitorEnv {
  /** `Capacitor.getServerUrl()`: where the WebView loads the app from. */
  serverUrl: string;
  debug: boolean;
  logging: boolean;
  /**
   * Whether CapacitorHttp sends `fetch` through the native layer, as the
   * native bridge decides it. `null` when that can't be read.
   */
  capacitorHttp: boolean | null;
  userAgent: string;
}

export interface CapacitorInfo {
  platform: string;
  native: boolean;
  /** Whether the native bridge is there, so native calls can be logged. False on the web. */
  bridge: boolean;
  /** Whether calls answered in JavaScript are logged too (the hook ran before @capacitor/core). */
  webCalls: boolean;
  env: CapacitorEnv;
  plugins: CapacitorPluginInfo[];
}

export interface CapacitorCallError {
  message: string;
  code?: string;
}

export interface CapacitorCall {
  id: number;
  plugin: string;
  method: string;
  /** `promise` for most methods, `callback` for methods that call back more than once. */
  kind: 'promise' | 'callback';
  /** `native` went through the bridge; `web` was answered in JavaScript. */
  via: 'native' | 'web';
  args: unknown;
  status: 'pending' | 'ok' | 'error';
  result?: unknown;
  error?: CapacitorCallError;
  startedAt: number;
  durationMs?: number;
  /** How many times a `callback` method called back. */
  callbacks?: number;
}

export interface CapacitorListener {
  id: string;
  plugin: string;
  event: string;
  addedAt: number;
  events: number;
  lastEventAt?: number;
  removed?: boolean;
  /**
   * The payload of the last event, masked like a call result. Only the last
   * one is kept, and it is masked when a push reads it, not on every event.
   */
  last?: unknown;
}

/** The part of `window.Capacitor` the hook reads. */
interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  getServerUrl?: () => string;
  DEBUG?: unknown;
  isLoggingEnabled?: unknown;
  Plugins?: Record<string, unknown>;
  PluginHeaders?: readonly { name?: unknown; methods?: readonly { name?: unknown }[] }[];
  nativePromise?: unknown;
  nativeCallback?: unknown;
  registerPlugin?: unknown;
}

type HookWindow = {
  Capacitor?: unknown;
  CapacitorWebFetch?: unknown;
  CapacitorHttpAndroidInterface?: { isEnabled?: () => unknown };
  prompt?: (message: string) => unknown;
  /** The iOS native bridge, which answers the CapacitorHttp `prompt()`. */
  webkit?: { messageHandlers?: { bridge?: unknown } };
  navigator?: { userAgent?: string };
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
  __pangularCapacitorHook?: CapacitorHook;
};

type Bridge = (this: unknown, ...args: unknown[]) => unknown;
type BridgeName = 'nativePromise' | 'nativeCallback';

const DEFAULT_MAX_CALLS = 200;
const VALUE_LIMITS = { depth: 4, keys: 20, items: 20, text: 300, budget: 400 };
/** Smaller than a call's: a listener's last event is a glance at the latest state. */
export const LAST_EVENT_LIMITS = { depth: 4, keys: 30, items: 30, text: 200, budget: 300 };
const MAX_LISTENERS = 100;
const MAX_PLUGINS = 200;
const LISTENER_METHODS = new Set(['addListener', 'removeListener']);
// Read by tools that inspect any object; not plugin methods.
const NOT_METHODS = new Set(['then', 'toJSON', '$$typeof', 'constructor']);

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function capacitorOf(win: HookWindow): CapacitorGlobal | null {
  const cap = win.Capacitor;
  return cap && typeof cap === 'object' ? (cap as CapacitorGlobal) : null;
}

/** Whether a call failed because the plugin or method has no implementation here. */
export function isUnimplemented(error: CapacitorCallError | undefined): boolean {
  if (!error) return false;
  return error.code === 'UNIMPLEMENTED' || /not implemented/i.test(error.message);
}

function errorOf(error: unknown): CapacitorCallError {
  const value = error as { message?: unknown; code?: unknown } | null;
  const raw = typeof value?.message === 'string' ? value.message : String(error);
  const code = typeof value?.code === 'string' ? clip(value.code, 50) : undefined;
  return { message: clip(redactMessage(raw), 500), ...(code ? { code } : {}) };
}

function eventNameOf(options: unknown): string {
  const name = (options as { eventName?: unknown } | null)?.eventName;
  return typeof name === 'string' ? clip(name, 100) : '';
}

/** Plugins @capacitor/core registers itself, on every platform. */
export const CORE_PLUGINS: ReadonlySet<string> = new Set([
  'CapacitorCookies',
  'CapacitorHttp',
  'SystemBars',
  'WebView',
]);

const capacitorHttpState = new WeakMap<object, boolean | null>();

/**
 * Asks the native layer whether CapacitorHttp is on, the way the native bridge
 * does at startup: `CapacitorHttpAndroidInterface.isEnabled()` on Android, and
 * a `prompt()` that the iOS WebView answers itself (it shows no dialog). The
 * prompt is sent only when the iOS bridge is there: a custom platform named
 * `ios` in a desktop browser would open a real dialog. Read once per page.
 * `null` on any other platform.
 */
function capacitorHttpOn(win: HookWindow, cap: CapacitorGlobal, platform: string): boolean | null {
  if (platform === 'web') return false;
  const cached = capacitorHttpState.get(cap);
  if (cached !== undefined) return cached;
  let state: boolean | null = null;
  if (
    platform === 'android' &&
    typeof win.CapacitorHttpAndroidInterface?.isEnabled === 'function'
  ) {
    state = read(() => win.CapacitorHttpAndroidInterface!.isEnabled!() === true, null);
  } else if (
    platform === 'ios' &&
    !!win.webkit?.messageHandlers?.bridge &&
    typeof win.prompt === 'function'
  ) {
    state = read(() => win.prompt!(JSON.stringify({ type: 'CapacitorHttp' })) === 'true', null);
  }
  capacitorHttpState.set(cap, state);
  return state;
}

function nativeMethods(cap: CapacitorGlobal): Map<string, string[]> {
  const methods = new Map<string, string[]>();
  for (const header of read(() => [...(cap.PluginHeaders ?? [])], [])) {
    if (typeof header?.name !== 'string') continue;
    const names = (header.methods ?? [])
      .map((method) => method?.name)
      .filter((name): name is string => typeof name === 'string');
    methods.set(header.name, [...new Set(names)]);
  }
  return methods;
}

/** Platform, environment and plugins, read from `window.Capacitor`. Null when it is not there. */
export function readCapacitorInfo(
  win: HookWindow = globalThis as HookWindow,
): CapacitorInfo | null {
  const cap = capacitorOf(win);
  // A `window.Capacitor` the hook made before core ran is not Capacitor yet.
  if (!cap || typeof cap.getPlatform !== 'function') return null;
  const platform = read(() => String(cap.getPlatform?.() ?? 'web'), 'web');
  const methods = nativeMethods(cap);
  // Only the keys: the values are plugin proxies, and reading them creates wrappers.
  const listed = read(() => Object.keys(cap.Plugins ?? {}), []);
  const hook = win.__pangularCapacitorHook;
  const native = read(() => cap.isNativePlatform?.() === true, platform !== 'web');
  // On the web, Capacitor.Plugins holds only what registerPlugin() made. On
  // iOS and Android the bridge lists every native plugin there too.
  const registered: (name: string) => boolean | null =
    hook?.webCalls() === true
      ? (name) => hook.registered(name)
      : native
        ? () => null
        : (name) => listed.includes(name);
  const names = [...new Set([...methods.keys(), ...listed])].sort().slice(0, MAX_PLUGINS);
  return {
    platform: clip(platform, 50),
    native,
    bridge: typeof cap.nativePromise === 'function',
    webCalls: win.__pangularCapacitorHook?.webCalls() ?? false,
    env: {
      serverUrl: clip(redactUrl(read(() => String(cap.getServerUrl?.() ?? ''), '')), 200),
      debug: cap.DEBUG === true,
      logging: cap.isLoggingEnabled === true,
      capacitorHttp: capacitorHttpOn(win, cap, native ? platform : 'web'),
      userAgent: clip(
        read(() => String(win.navigator?.userAgent ?? ''), ''),
        300,
      ),
    },
    plugins: names.map((name) => ({
      name: clip(name, 100),
      available: read(() => cap.isPluginAvailable?.(name) === true, false),
      registered: registered(name),
      native: methods.has(name),
      methods: (methods.get(name) ?? []).filter((m) => !LISTENER_METHODS.has(m)).sort(),
    })),
  };
}

interface Entry {
  call: CapacitorCall;
  rev: number;
  secretKey: boolean;
}

export interface CapacitorHookOptions {
  /** Calls kept on the page. Older ones are dropped and counted. Default 200. */
  maxCalls?: number;
  /**
   * Installed before @capacitor/core on purpose, so it may create
   * `window.Capacitor` to catch `registerPlugin`. The overlay never does: some
   * libraries read a `window.Capacitor` as running in Capacitor.
   */
  early?: boolean;
}

/**
 * Logs plugin calls and listeners from the moment it starts, in a capped
 * buffer. `snapshot(revision)` returns the calls that changed after that
 * revision, so a push carries only those.
 */
export function createCapacitorHook(win: HookWindow, options: CapacitorHookOptions = {}) {
  const entries: Entry[] = [];
  const listeners = new Map<string, CapacitorListener>();
  // The raw payload of each listener's newest event, until a snapshot masks it.
  const unmaskedLast = new Map<CapacitorListener, unknown>();
  const subscribers = new Set<() => void>();
  let maxCalls = options.maxCalls ?? DEFAULT_MAX_CALLS;
  let ignore: ((plugin: string, method: string, args: unknown) => boolean) | undefined;
  let nextId = 1;
  let revision = 0;
  let dropped = 0;
  let active = true;
  // Core assigned registerPlugin through the accessor: calls answered in
  // JavaScript are logged, and the names it registered are known.
  let coreRegistered = false;
  const registeredNames = new Set<string>();
  // Rejections already logged, so the unhandledrejection fallback skips them.
  const loggedReasons = new WeakSet<object>();
  let wrapped: {
    cap: CapacitorGlobal;
    original: Partial<Record<BridgeName, Bridge>>;
    installed: Partial<Record<BridgeName, Bridge>>;
  } | null = null;
  // The revision of the last listener change; listeners go out whole when it moves.
  let listenersRev = 0;

  const changed = () => {
    for (const subscriber of subscribers) {
      try {
        subscriber();
      } catch {
        continue;
      }
    }
  };

  const touch = (entry: Entry) => {
    entry.rev = ++revision;
    changed();
  };

  const trim = () => {
    if (entries.length <= maxCalls) return;
    dropped += entries.length - maxCalls;
    entries.splice(0, entries.length - maxCalls);
  };

  const begin = (
    plugin: string,
    method: string,
    kind: CapacitorCall['kind'],
    via: CapacitorCall['via'],
    args: unknown,
  ) => {
    const entry: Entry = {
      call: {
        id: nextId++,
        plugin: clip(plugin, 100),
        method: clip(method, 100),
        kind,
        via,
        args: maskedArgs(plugin, args, VALUE_LIMITS),
        status: 'pending',
        startedAt: Date.now(),
      },
      rev: 0,
      secretKey: hasSecretKey(args),
    };
    entries.push(entry);
    trim();
    touch(entry);
    return entry;
  };

  const settle = (entry: Entry, outcome: { result: unknown } | { error: unknown }) => {
    const call = entry.call;
    if (call.kind === 'callback' && call.status !== 'pending') {
      call.callbacks = (call.callbacks ?? 1) + 1;
    } else {
      call.durationMs = Date.now() - call.startedAt;
      if (call.kind === 'callback') call.callbacks = 1;
    }
    if ('error' in outcome) {
      call.status = 'error';
      call.error = errorOf(outcome.error);
      if (outcome.error && typeof outcome.error === 'object') loggedReasons.add(outcome.error);
      delete call.result;
    } else {
      call.status = 'ok';
      call.result = maskedResult(call.plugin, entry.secretKey, outcome.result, VALUE_LIMITS);
      delete call.error;
    }
    touch(entry);
  };

  /**
   * Logs the outcome of a returned promise and hands the app a promise that
   * settles the same way. Observing `out` directly would mark its rejection as
   * handled, so an app that leaves it unhandled would no longer see an
   * `unhandledrejection`. Own properties, such as `remove` on the promise of
   * `addListener`, are copied over.
   */
  const follow = (entry: Entry | null, out: unknown): unknown => {
    if (!entry || !out || typeof (out as PromiseLike<unknown>).then !== 'function') return out;
    const derived = Promise.resolve(out as PromiseLike<unknown>).then(
      (result) => {
        read(() => settle(entry, { result }), undefined);
        return result;
      },
      (error: unknown) => {
        read(() => settle(entry, { error }), undefined);
        throw error;
      },
    );
    read(() => {
      for (const key of Object.keys(out as object)) {
        (derived as unknown as Record<string, unknown>)[key] = (out as Record<string, unknown>)[
          key
        ];
      }
    }, undefined);
    return derived;
  };

  const skip = (plugin: unknown, method: unknown, args: unknown) =>
    typeof plugin !== 'string' ||
    typeof method !== 'string' ||
    read(() => ignore?.(plugin, method, args) === true, false);

  const nativePromise = (original: Bridge): Bridge =>
    function (this: unknown, ...args: unknown[]) {
      const [plugin, method, callOptions] = args;
      if (!active || skip(plugin, method, callOptions)) return original.apply(this, args);
      const entry = read(
        () => begin(plugin as string, method as string, 'promise', 'native', callOptions),
        null,
      );
      let out: unknown;
      try {
        out = original.apply(this, args);
      } catch (error) {
        if (entry) read(() => settle(entry, { error }), undefined);
        throw error;
      }
      if (method === 'removeAllListeners' && entry) forgetListeners(plugin as string, out);
      return follow(entry, out);
    };

  /** `removeAllListeners` succeeded: the plugin's listeners are gone. */
  const forgetListeners = (plugin: string, out: unknown) => {
    if (!out || typeof (out as PromiseLike<unknown>).then !== 'function') return;
    (out as PromiseLike<unknown>).then(
      () => {
        let changedAny = false;
        for (const listener of listeners.values()) {
          if (listener.plugin === plugin && !listener.removed) {
            listener.removed = true;
            changedAny = true;
          }
        }
        if (changedAny) {
          listenersRev = ++revision;
          changed();
        }
      },
      () => undefined,
    );
  };

  /** Keeps a wrapper's `name` and `toString()`, which some code reads. */
  const lookLike = <T extends Bridge>(wrapper: T, original: Bridge): T => {
    read(() => {
      Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });
      Object.defineProperty(wrapper, 'toString', {
        value: () => String(original),
        configurable: true,
      });
    }, undefined);
    return wrapper;
  };

  const observeListener = (
    plugin: string,
    method: string,
    callOptions: unknown,
    callback: unknown,
    forward: (callback: unknown) => unknown,
  ) => {
    if (method === 'removeListener') {
      const id = (callOptions as { callbackId?: unknown } | null)?.callbackId;
      const listener = typeof id === 'string' ? listeners.get(id) : undefined;
      if (listener && !listener.removed) {
        listener.removed = true;
        listenersRev = ++revision;
        changed();
      }
      return forward(callback);
    }
    let listener: CapacitorListener | undefined;
    const counted =
      typeof callback === 'function'
        ? function (this: unknown, ...data: unknown[]) {
            if (listener && active) {
              listener.events++;
              listener.lastEventAt = Date.now();
              // The bridge passes (data, error); an error carries no event.
              if (!data[1]) unmaskedLast.set(listener, data[0]);
              listenersRev = ++revision;
              changed();
            }
            return (callback as Bridge).apply(this, data);
          }
        : callback;
    const callbackId = forward(counted);
    read(() => {
      const id = typeof callbackId === 'string' ? callbackId : `${plugin}:${nextId++}`;
      listener = {
        id: clip(id, 50),
        plugin: clip(plugin, 100),
        event: eventNameOf(callOptions),
        addedAt: Date.now(),
        events: 0,
      };
      listeners.set(listener.id, listener);
      if (listeners.size > MAX_LISTENERS) {
        const oldest =
          [...listeners.values()].find((entry) => entry.removed) ?? listeners.values().next().value;
        if (oldest) {
          listeners.delete(oldest.id);
          unmaskedLast.delete(oldest);
        }
      }
      listenersRev = ++revision;
      changed();
    }, undefined);
    return callbackId;
  };

  const nativeCallback = (original: Bridge): Bridge =>
    function (this: unknown, ...args: unknown[]) {
      const [plugin, method] = args;
      // The deprecated form passes the callback as `options`.
      const callbackAt = typeof args[2] === 'function' && args[3] === undefined ? 2 : 3;
      const callOptions = callbackAt === 2 ? undefined : args[2];
      const callback = args[callbackAt];
      if (!active || skip(plugin, method, callOptions)) return original.apply(this, args);
      const forward = (next: unknown) => {
        const passed = [...args];
        passed[callbackAt] = next;
        return original.apply(this, passed);
      };
      if (LISTENER_METHODS.has(method as string)) {
        return observeListener(plugin as string, method as string, callOptions, callback, forward);
      }
      const entry = read(
        () => begin(plugin as string, method as string, 'callback', 'native', callOptions),
        null,
      );
      if (!entry || typeof callback !== 'function') return original.apply(this, args);
      return forward(function (this: unknown, ...data: unknown[]) {
        const [result, error] = data;
        if (active) read(() => settle(entry, error ? { error } : { result }), undefined);
        return (callback as Bridge).apply(this, data);
      });
    };

  const wrappers: Record<BridgeName, (original: Bridge) => Bridge> = {
    nativePromise,
    nativeCallback,
  };

  /** Whether `plugin.method` goes to the bridge, as core decides it (`createPluginMethod`). */
  const goesNative = (plugin: string, method: string) => {
    const cap = capacitorOf(win);
    return !!cap && (nativeMethods(cap).get(plugin) ?? []).includes(method);
  };

  /** Wraps a proxy from `registerPlugin()`, for the calls core answers in JavaScript. */
  const wrapPluginProxy = (plugin: string, proxy: unknown) => {
    if (!proxy || (typeof proxy !== 'object' && typeof proxy !== 'function')) return proxy;
    return new Proxy(proxy as object, {
      get(target, prop, receiver) {
        const member = Reflect.get(target, prop, receiver);
        if (
          !active ||
          typeof prop !== 'string' ||
          typeof member !== 'function' ||
          NOT_METHODS.has(prop) ||
          LISTENER_METHODS.has(prop)
        ) {
          return member;
        }
        const wrapper = function (this: unknown, ...args: unknown[]) {
          const web = active && !goesNative(plugin, prop) && !skip(plugin, prop, args[0]);
          const entry = web
            ? read(() => begin(plugin, prop, 'promise', 'web', args[0]), null)
            : null;
          let out: unknown;
          try {
            out = (member as Bridge).apply(this === receiver ? target : this, args);
          } catch (error) {
            if (entry) read(() => settle(entry, { error }), undefined);
            throw error;
          }
          return follow(entry, out);
        };
        return lookLike(wrapper, member as Bridge);
      },
    });
  };

  const wrapRegisterPlugin = (original: Bridge): Bridge =>
    lookLike(function (this: unknown, ...args: unknown[]) {
      const proxy = original.apply(this, args);
      const plugin = args[0];
      if (typeof plugin !== 'string') return proxy;
      registeredNames.add(plugin);
      return read(() => wrapPluginProxy(plugin, proxy), proxy);
    }, original);

  /**
   * Places an accessor for `Capacitor.registerPlugin` before @capacitor/core
   * assigns it. Does nothing once core ran.
   */
  const trapRegisterPlugin = () => {
    read(() => {
      if (!options.early) return;
      let cap = capacitorOf(win);
      if (cap && 'registerPlugin' in cap) return;
      if (!cap) {
        cap = {};
        win.Capacitor = cap;
      }
      let current: unknown;
      Object.defineProperty(cap, 'registerPlugin', {
        configurable: true,
        enumerable: true,
        get: () => current,
        set: (fn: unknown) => {
          if (typeof fn === 'function') coreRegistered = true;
          current = typeof fn === 'function' ? wrapRegisterPlugin(fn as Bridge) : fn;
        },
      });
    }, undefined);
  };

  /** Wraps the bridge once it exists. Safe to call on every tick. */
  const install = () => {
    if (wrapped || !active) return;
    const cap = capacitorOf(win);
    if (!cap || typeof cap.nativePromise !== 'function') return;
    const bridge = cap as Record<BridgeName, unknown>;
    const original: Partial<Record<BridgeName, Bridge>> = {};
    const installed: Partial<Record<BridgeName, Bridge>> = {};
    for (const name of ['nativePromise', 'nativeCallback'] as const) {
      const fn = bridge[name];
      if (typeof fn !== 'function') continue;
      original[name] = fn as Bridge;
      installed[name] = lookLike(wrappers[name](fn as Bridge), fn as Bridge);
      bridge[name] = installed[name];
    }
    wrapped = { cap, original, installed };
  };

  // Without the registerPlugin accessor, core's own "not implemented"
  // rejections are seen only when the app leaves them unhandled. One the
  // accessor logged already is skipped, and so is `then`, which code that
  // checks for a promise reads off any object.
  const onUnhandled = (event: unknown) => {
    if (!active) return;
    read(() => {
      const reason = (event as { reason?: { code?: unknown; message?: unknown } }).reason;
      if (!reason || typeof reason !== 'object' || loggedReasons.has(reason)) return;
      if (reason.code !== 'UNIMPLEMENTED' || typeof reason.message !== 'string') return;
      const match = /^"([^".]+)(?:\.([^"(]+)\(\))?"/.exec(reason.message);
      if (!match || match[2] === 'then') return;
      const entry = begin(match[1], match[2] ?? '(plugin)', 'promise', 'web', undefined);
      settle(entry, { error: reason });
    }, undefined);
  };

  /** Masks the events that arrived since the last snapshot, one per listener. */
  const maskLastEvents = () => {
    for (const [listener, data] of unmaskedLast) {
      const last = read(
        () => maskedResult(listener.plugin, false, data, LAST_EVENT_LIMITS),
        undefined,
      );
      if (last === undefined) delete listener.last;
      else listener.last = last;
    }
    unmaskedLast.clear();
  };

  trapRegisterPlugin();
  install();
  read(() => win.addEventListener?.('unhandledrejection', onUnhandled), undefined);

  const hook = {
    install,
    /** Whether calls answered in JavaScript are logged too: core registered through the accessor. */
    webCalls: () => coreRegistered,
    /** Whether the app registered `name`, as seen by the accessor. */
    registered: (name: string) => registeredNames.has(name),
    setMaxCalls(next: number) {
      maxCalls = next;
      trim();
    },
    setIgnore(next: typeof ignore) {
      ignore = next;
    },
    subscribe(subscriber: () => void) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    info: () => readCapacitorInfo(win),
    /** The newest revision; pass it to `snapshot` to get only later changes. */
    revision: () => revision,
    /**
     * The calls that changed after revision `since`, and the listeners when
     * any of them changed. Without `since`, everything.
     */
    snapshot(since?: number) {
      const after = since ?? -1;
      maskLastEvents();
      return {
        calls: entries.filter((entry) => entry.rev > after).map((entry) => entry.call),
        ...(since === undefined || listenersRev > since
          ? { listeners: [...listeners.values()] }
          : {}),
        dropped,
        revision,
      };
    },
    calls: () => entries.map((entry) => entry.call),
    stop() {
      active = false;
      subscribers.clear();
      unmaskedLast.clear();
      read(() => win.removeEventListener?.('unhandledrejection', onUnhandled), undefined);
      if (win.__pangularCapacitorHook === hook) delete win.__pangularCapacitorHook;
      if (!wrapped) return;
      const bridge = wrapped.cap as Record<BridgeName, unknown>;
      // Restore only what is still ours. A wrapper added on top keeps working,
      // since ours passes everything through once `active` is false.
      for (const name of ['nativePromise', 'nativeCallback'] as const) {
        if (wrapped.installed[name] && bridge[name] === wrapped.installed[name]) {
          bridge[name] = wrapped.original[name];
        }
      }
      wrapped = null;
    },
  };
  return hook;
}

export type CapacitorHook = ReturnType<typeof createCapacitorHook>;

/**
 * The page's one Capacitor hook: the one already installed, or a new one.
 * `created` says which, so whoever made it can stop it.
 */
export function capacitorHook(
  win: HookWindow = globalThis as HookWindow,
  options: CapacitorHookOptions = {},
): { hook: CapacitorHook; created: boolean } {
  const existing = win.__pangularCapacitorHook;
  if (existing) {
    if (options.maxCalls !== undefined) existing.setMaxCalls(options.maxCalls);
    existing.install();
    return { hook: existing, created: false };
  }
  const hook = createCapacitorHook(win, options);
  win.__pangularCapacitorHook = hook;
  return { hook, created: true };
}
