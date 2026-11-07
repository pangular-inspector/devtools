import { addProfilerListener, type Profiler, type ProfilerGate } from './change-detection.ts';
import type { SignalGraphNode } from './types.ts';

/**
 * Run counts and durations of `effect()`s, from Angular's profiler, where it
 * reports effect runs. No Angular version up to 22.1 does: its
 * `ProfilerEvent` enum has no effect event. So the tracker turns itself on
 * only once it sees one, told apart by what the event carries: the effect's
 * reactive node (`kind: 'effect'`), or an effect ref that holds one under its
 * `SIGNAL` symbol. Angular numbers its profiler events in Start/End pairs, a
 * Start even and its End the odd number after it, so the event number says
 * which of the two it is. Until such an event arrives, nothing is attached
 * to the graph and the panel shows nothing.
 */

export interface EffectRunStats {
  runs: number;
  /** Total time of the runs that ended, in ms. */
  totalMs: number;
  /** Time of the last run that ended, in ms. */
  lastMs: number;
}

interface EffectNodeLike {
  kind?: unknown;
  debugName?: unknown;
}

function effectNodeOf(instance: unknown): EffectNodeLike | null {
  if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) return null;
  try {
    if ((instance as EffectNodeLike).kind === 'effect') return instance as EffectNodeLike;
    for (const symbol of Object.getOwnPropertySymbols(instance)) {
      if (symbol.description !== 'SIGNAL') continue;
      const node = (instance as Record<symbol, unknown>)[symbol] as EffectNodeLike | undefined;
      return node && typeof node === 'object' && node.kind === 'effect' ? node : null;
    }
  } catch {
    return null;
  }
  return null;
}

export interface EffectRunTracker {
  /** Whether the page's Angular reported an effect run at least once. */
  readonly active: boolean;
  /** The stats of the effect with this name, when exactly one tracked effect has it. */
  statsFor(label: string): EffectRunStats | undefined;
  /** Adds `runs`, `runMs` and `lastRunMs` to the effect nodes of a graph that have stats. */
  attach(nodes: SignalGraphNode[]): void;
  stop(): void;
}

/** Handles one profiler event; exported for tests that drive it without Angular. */
export function createEffectRunListener(now: () => number = () => performance.now()) {
  const stats = new Map<EffectNodeLike, EffectRunStats>();
  const started = new Map<EffectNodeLike, number>();
  let active = false;
  const listener: Profiler = (event, instance) => {
    const node = effectNodeOf(instance);
    if (!node || !Number.isInteger(event)) return;
    active = true;
    if (event % 2 === 0) {
      started.set(node, now());
      let entry = stats.get(node);
      if (!entry) stats.set(node, (entry = { runs: 0, totalMs: 0, lastMs: 0 }));
      entry.runs++;
      return;
    }
    const start = started.get(node);
    const entry = stats.get(node);
    if (start === undefined || !entry) return;
    started.delete(node);
    entry.lastMs = Math.max(0, now() - start);
    entry.totalMs += entry.lastMs;
  };
  const statsFor = (label: string): EffectRunStats | undefined => {
    let found: EffectRunStats | undefined;
    for (const [node, entry] of stats) {
      if (node.debugName !== label) continue;
      if (found) return undefined;
      found = entry;
    }
    return found;
  };
  return {
    listener,
    get active() {
      return active;
    },
    statsFor,
    /** Drops stats of effects that no longer run, past a bound. */
    trim(max = 500) {
      while (stats.size > max) {
        const first = stats.keys().next().value as EffectNodeLike;
        stats.delete(first);
        started.delete(first);
      }
    },
  };
}

const round = (ms: number) => Math.round(ms * 100) / 100;

/**
 * Listens to the page's Angular profiler for effect runs. Returns a tracker
 * that stays inactive, and attaches nothing, where Angular reports none, or
 * where the profiler is off limits (before Angular 20, see
 * `addProfilerListener`).
 */
export function trackEffectRuns(
  getNg: () => unknown,
  where?: Document | ProfilerGate,
  now?: () => number,
): EffectRunTracker {
  const runs = createEffectRunListener(now);
  let remove: (() => void) | null = null;
  const ensure = () => {
    if (remove) return;
    remove = addProfilerListener(getNg(), runs.listener, where);
  };
  ensure();
  return {
    get active() {
      return runs.active;
    },
    statsFor: runs.statsFor,
    attach(nodes) {
      ensure();
      if (!runs.active) return;
      runs.trim();
      for (const node of nodes) {
        if (node.kind !== 'effect' || !node.label) continue;
        const entry = runs.statsFor(node.label);
        if (!entry) continue;
        node.runs = entry.runs;
        node.runMs = round(entry.totalMs);
        node.lastRunMs = round(entry.lastMs);
      }
    },
    stop() {
      remove?.();
      remove = null;
    },
  };
}
