import { CD_SPAN_KIND, MAX_SPANS } from './cd-data.ts';
import type { CdSpan, CdSpanKind } from './config.ts';
import { className } from './injector-tree.ts';

/**
 * Lifecycle hooks, as Angular registers them from a directive's prototype
 * (`registerPreOrderHooks` and `registerPostOrderHooks` in
 * `@angular/core/fesm2022/_debug_node-chunk.mjs`).
 */
const LIFECYCLE_HOOKS = [
  'ngOnChanges',
  'ngOnInit',
  'ngDoCheck',
  'ngAfterContentInit',
  'ngAfterContentChecked',
  'ngAfterViewInit',
  'ngAfterViewChecked',
  'ngOnDestroy',
] as const;

/** Classes and hook or listener names the recorder keeps totals for. */
export const MAX_TRACKED_TIMINGS = 1000;
/** Rows a snapshot lists, by time. */
export const MAX_LISTED_TIMINGS = 100;
/** Spans held for the cycle that is running; the longest `MAX_SPANS` are kept when it ends. */
export const MAX_RAW_SPANS = 5000;

type Ctor = object;

const hookNames = new WeakMap<object, string>();

/**
 * The name of the lifecycle hook `hook` that Angular called on `instance`.
 * Angular passes the prototype method, except for `ngOnChanges`, which it
 * wraps (`rememberChangeHistoryAndInvokeOnChangesHook`) to build the
 * `SimpleChanges`. Names are matched against the instance's methods, so they
 * survive minified function names.
 */
export function hookName(instance: unknown, hook: unknown): string {
  if (typeof hook !== 'function') return 'hook';
  const known = hookNames.get(hook);
  if (known) return known;
  let name: string | undefined;
  if (instance && typeof instance === 'object') {
    const target = instance as Record<string, unknown>;
    name = LIFECYCLE_HOOKS.find((each) => target[each] === hook);
    // The ngOnChanges wrapper is shared by every class, so it is only named, never cached.
    if (!name && typeof target['ngOnChanges'] === 'function') return 'ngOnChanges';
  }
  name ??= (hook as { name?: string }).name || 'hook';
  hookNames.set(hook, name);
  return name;
}

/** A listener's function name, unless it is one of Angular's wrappers or an anonymous one. */
export function listenerName(listener: unknown): string {
  const name = typeof listener === 'function' ? (listener as { name?: string }).name : '';
  return name && !/^(wrapListener|anonymous|bound )/.test(name) ? name : '';
}

interface Stat {
  calls: number;
  ms: number;
  maxMs: number;
}

/**
 * Time per class and key (a hook or listener name), with at most
 * `MAX_TRACKED_TIMINGS` rows. Rows past that are counted once each.
 */
export function createTimingTable() {
  let rows = new Map<Ctor, Map<string, Stat>>();
  let size = 0;
  let untracked = new WeakMap<Ctor, Set<string>>();
  let untrackedCount = 0;
  return {
    add(ctor: Ctor, key: string, ms: number) {
      let byKey = rows.get(ctor);
      const stat = byKey?.get(key);
      if (stat) {
        stat.calls++;
        stat.ms += ms;
        stat.maxMs = Math.max(stat.maxMs, ms);
        return;
      }
      if (size < MAX_TRACKED_TIMINGS) {
        if (!byKey) rows.set(ctor, (byKey = new Map()));
        byKey.set(key, { calls: 1, ms, maxMs: ms });
        size++;
        return;
      }
      let keys = untracked.get(ctor);
      if (!keys) untracked.set(ctor, (keys = new Set()));
      if (!keys.has(key)) {
        keys.add(key);
        untrackedCount++;
      }
    },
    /** Rows by time, at most `MAX_LISTED_TIMINGS`, and how many were left out. */
    list(round: (ms: number) => number) {
      const all = [...rows].flatMap(([ctor, byKey]) =>
        [...byKey].map(([key, stat]) => ({
          name: className(ctor as { name?: string }),
          key,
          calls: stat.calls,
          ms: round(stat.ms),
          maxMs: round(stat.maxMs),
        })),
      );
      all.sort((a, b) => b.ms - a.ms || b.calls - a.calls);
      return {
        rows: all.slice(0, MAX_LISTED_TIMINGS),
        dropped: untrackedCount + Math.max(0, all.length - MAX_LISTED_TIMINGS),
      };
    },
    reset() {
      rows = new Map();
      size = 0;
      untracked = new WeakMap();
      untrackedCount = 0;
    },
  };
}

/** A span while its cycle runs: the class (or null) and a label build its name in a snapshot. */
export interface RawSpan {
  ctor: Ctor | null;
  label: string;
  start: number;
  ms: number;
  depth: number;
  kind: CdSpanKind;
}

/**
 * The longest `MAX_SPANS` spans in start order, a parent before the children
 * that start with it, and how many were left out.
 */
export function keepLongest(spans: RawSpan[], extra: number): { kept: RawSpan[]; dropped: number } {
  const kept =
    spans.length <= MAX_SPANS
      ? [...spans]
      : [...spans].sort((a, b) => b.ms - a.ms).slice(0, MAX_SPANS);
  kept.sort((a, b) => a.start - b.start || b.ms - a.ms);
  return { kept, dropped: extra + Math.max(0, spans.length - MAX_SPANS) };
}

export function spanName(span: RawSpan): string {
  if (!span.ctor) return span.label;
  const name = className(span.ctor as { name?: string });
  return span.label ? `${name}.${span.label}` : name;
}

/** Builds `spanNames` and the `CdSpan` tuples that point into it. */
export function createSpanNames() {
  const names: string[] = [];
  const index = new Map<string, number>();
  const micro = (ms: number) => Math.round(ms * 1000) / 1000;
  return {
    names,
    tuple(span: RawSpan): CdSpan {
      const name = spanName(span);
      let at = index.get(name);
      if (at === undefined) {
        at = names.push(name) - 1;
        index.set(name, at);
      }
      return [at, micro(span.start), micro(span.ms), span.depth, span.kind];
    },
  };
}

export { CD_SPAN_KIND };
