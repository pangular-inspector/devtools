/**
 * One shared patch of `console.*` for every part of the devtools that listens
 * to the page's console: the forms setup errors, the Analog and HTTP hydration
 * warnings, and the console log of the Errors inspector. Each level is
 * patched once, however many listeners there are, and put back when the last
 * listener of that level leaves. The state lives on `globalThis`, so the
 * overlay and the `http` entry point share it even when the app bundles them
 * apart.
 */

export const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

export type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

/** Gets the level and the arguments of each call, before the console prints them. */
export type ConsoleListener = (level: ConsoleLevel, args: readonly unknown[]) => void;

type ConsoleMethod = (...args: unknown[]) => unknown;

interface Patch {
  original: ConsoleMethod;
  patched: ConsoleMethod;
}

interface Subscription {
  levels: ReadonlySet<ConsoleLevel>;
  listener: ConsoleListener;
}

interface TapState {
  subscriptions: Set<Subscription>;
  patches: Partial<Record<ConsoleLevel, Patch>>;
  /** True while listeners run, so a listener that logs, or a patch under ours, isn't heard twice. */
  inside: boolean;
}

const KEY = Symbol.for('pangular.consoleTap');

function tapState(): TapState {
  const holder = globalThis as unknown as Record<symbol, TapState | undefined>;
  return (holder[KEY] ??= { subscriptions: new Set(), patches: {}, inside: false });
}

function consoleOf(): Record<ConsoleLevel, ConsoleMethod> | undefined {
  return typeof console === 'undefined'
    ? undefined
    : (console as unknown as Record<ConsoleLevel, ConsoleMethod>);
}

function dispatch(state: TapState, level: ConsoleLevel, args: unknown[]) {
  for (const { levels, listener } of [...state.subscriptions]) {
    if (!levels.has(level)) continue;
    try {
      listener(level, args);
    } catch {
      // A listener never breaks the app's own logging.
      continue;
    }
  }
}

function install(state: TapState, level: ConsoleLevel) {
  const target = consoleOf();
  if (!target || typeof target[level] !== 'function') return;
  const current = state.patches[level];
  // Someone replaced the method since (a test spy, another tool): wrap theirs.
  if (current && target[level] === current.patched) return;
  const original = target[level];
  const patched = function (this: unknown, ...args: unknown[]) {
    if (state.inside) return original.apply(this, args);
    state.inside = true;
    try {
      dispatch(state, level, args);
      return original.apply(this, args);
    } finally {
      state.inside = false;
    }
  };
  target[level] = patched;
  state.patches[level] = { original, patched };
}

function uninstall(state: TapState, level: ConsoleLevel) {
  const patch = state.patches[level];
  if (!patch) return;
  delete state.patches[level];
  const target = consoleOf();
  // A method wrapped again on top of ours stays; ours then only passes calls through.
  if (target && target[level] === patch.patched) target[level] = patch.original;
}

function listened(state: TapState, level: ConsoleLevel): boolean {
  for (const subscription of state.subscriptions) {
    if (subscription.levels.has(level)) return true;
  }
  return false;
}

/**
 * Calls `listener` with every call to the given console levels, and returns
 * the function that stops it. The app's own console method still runs, with
 * the same `this` and arguments, and its return value is passed back.
 */
export function tapConsole(levels: readonly ConsoleLevel[], listener: ConsoleListener): () => void {
  const state = tapState();
  const subscription: Subscription = { levels: new Set(levels), listener };
  state.subscriptions.add(subscription);
  for (const level of subscription.levels) install(state, level);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    state.subscriptions.delete(subscription);
    for (const level of subscription.levels) {
      if (!listened(state, level)) uninstall(state, level);
    }
  };
}

/** How many listeners the tap has and which levels it patched, for tests. */
export function consoleTapInfo(): { listeners: number; patched: ConsoleLevel[] } {
  const state = tapState();
  return {
    listeners: state.subscriptions.size,
    patched: CONSOLE_LEVELS.filter((level) => state.patches[level]),
  };
}
