import type { SignalChange, SignalGraph, SignalWatchReport } from './types.ts';

/**
 * Watching signals on the page. A watched signal logs each change to the page
 * console, and the panel lists it with its recent changes. Write stacks are one
 * switch for the page: while on, every exact write of a named signal records
 * the first app frames of the code that wrote it. Both start off, live only in
 * this page's memory and reset on reload.
 */

/** Page event the server broadcasts with a watch request. */
export const WATCH_EVENT = 'signal-watch';
/** Signals one page watches at most; watching another drops the oldest. */
export const MAX_WATCHED = 20;

export interface SignalWatchRequest {
  pageId?: string;
  /** Graph node id to watch or unwatch. */
  id?: string;
  watch?: boolean;
  /** Turns write stacks on or off for the page. */
  stacks?: boolean;
  /** Stops watching every signal. */
  clear?: boolean;
}

/** The request when it is well formed and meant for this page, otherwise undefined. */
export function toWatchRequest(message: unknown, pageId: string): SignalWatchRequest | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const { pageId: forPage, id, watch, stacks, clear } = message as Record<string, unknown>;
  if (typeof forPage === 'string' && forPage && forPage !== pageId) return undefined;
  const request: SignalWatchRequest = {};
  if (typeof id === 'string' && id && id.length <= 50 && typeof watch === 'boolean') {
    request.id = id;
    request.watch = watch;
  }
  if (typeof stacks === 'boolean') request.stacks = stacks;
  if (clear === true) request.clear = true;
  return Object.keys(request).length ? request : undefined;
}

type Log = (...args: unknown[]) => void;

export function createSignalWatch(log: Log = (...args) => console.log(...args)) {
  // Insertion order, so the oldest watch is the one dropped past the cap.
  const watched = new Set<string>();
  let stacks = false;

  /** Applies a request; true when it changed what the page watches. */
  function apply(request: SignalWatchRequest): boolean {
    const before = JSON.stringify(report());
    if (request.clear) watched.clear();
    if (request.id && request.watch) {
      watched.delete(request.id);
      watched.add(request.id);
      if (watched.size > MAX_WATCHED) watched.delete(watched.values().next().value!);
    } else if (request.id) {
      watched.delete(request.id);
    }
    if (request.stacks !== undefined) stacks = request.stacks;
    return JSON.stringify(report()) !== before;
  }

  /** What the page reports with its graph; undefined while nothing is on. */
  function report(): SignalWatchReport | undefined {
    return watched.size || stacks ? { ids: [...watched], stacks } : undefined;
  }

  /** The graph with the watch report, so a watch change also changes the pushed graph. */
  function attach<G extends SignalGraph | null>(graph: G): G {
    const watch = report();
    return graph && watch && !graph.unsupported ? { ...graph, watch } : graph;
  }

  /** History listener: logs the changes of watched signals to the page console. */
  function onChange(id: string | undefined, label: string, change: SignalChange) {
    if (id === undefined || !watched.has(id)) return;
    const how = change.source === 'write' ? 'set to' : 'changed to (sampled)';
    const from = change.stack?.length ? [`\n  at ${change.stack.join('\n  at ')}`] : [];
    log(`[pangular] Signal ${label} ${how}`, change.value, ...from);
  }

  return {
    apply,
    report,
    attach,
    onChange,
    /** Read on every write by the history hook, so it stays a plain flag check. */
    stacks: () => stacks,
  };
}

export type SignalWatch = ReturnType<typeof createSignalWatch>;

interface WatchRpc {
  register(fn: {
    name: string;
    type: 'event';
    jsonSerializable: true;
    handler: (request: unknown) => void;
  }): unknown;
}

/** Answers `signal-watch` requests from the server, then lets the page push again. */
export function registerSignalWatch(
  rpc: WatchRpc,
  pageId: string,
  watch: SignalWatch,
  changed: () => void,
): void {
  rpc.register({
    name: WATCH_EVENT,
    type: 'event',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const request = toWatchRequest(message, pageId);
      if (request && watch.apply(request)) changed();
    },
  });
}
