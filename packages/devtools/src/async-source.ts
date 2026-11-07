type AnyRecord = Record<string, unknown>;

/** How far `sharedSource` follows `source` links before it gives up. */
const MAX_CHAIN = 50;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const isFunction = (value: unknown) => typeof value === 'function';

/** An RxJS `Subject` (and so `BehaviorSubject`, `ReplaySubject`, `AsyncSubject` and Angular's
 * `EventEmitter`): one execution that every subscriber shares. Checked by shape, so it works
 * with the app's own copy of RxJS. */
function isSubject(value: AnyRecord): boolean {
  return (
    isFunction(value['subscribe']) &&
    isFunction(value['next']) &&
    isFunction(value['complete']) &&
    Array.isArray(value['observers'])
  );
}

/** An NgRx `Store`. `Store.lift` returns a `Store`, so `store.select(...)` is one too, and
 * every select runs on the store's single `State` (a `BehaviorSubject`). */
function isNgrxStore(value: AnyRecord): boolean {
  return (
    isFunction(value['dispatch']) && isFunction(value['select']) && isFunction(value['subscribe'])
  );
}

/**
 * Whether `| async` subscribers of `source` share one execution, so that two of them on the
 * same source do no extra work: a Promise, a Subject, an operator-free view of a Subject
 * (`asObservable()`, `toObservable()`) or an NgRx store select. Reads `source` and `operator`,
 * the fields RxJS 6 and 7 keep on an `Observable` made by `lift` or `asObservable`.
 * `share()` and `shareReplay()` keep their state in a closure, so a source piped through
 * them is not recognised and stays a possible duplicate.
 */
export function sharedSource(source: unknown): boolean {
  if (!source || (typeof source !== 'object' && typeof source !== 'function')) return false;
  const value = source as AnyRecord;
  if (read(() => isFunction(value['then']) && !isFunction(value['subscribe']), false)) return true;
  let node: AnyRecord | undefined = value;
  const seen = new Set<unknown>();
  for (let i = 0; node && i < MAX_CHAIN && !seen.has(node); i++) {
    seen.add(node);
    const current: AnyRecord = node;
    if (read(() => isNgrxStore(current), false)) return true;
    // An operator runs once per subscriber, so the work above it is no longer shared. This
    // covers `subject.pipe(...)` too, which RxJS returns as a Subject with an operator.
    if (read(() => current['operator'], undefined)) return false;
    if (read(() => isSubject(current), false)) return true;
    const next: unknown = read(() => current['source'], undefined);
    node = next && typeof next === 'object' ? (next as AnyRecord) : undefined;
  }
  return false;
}
