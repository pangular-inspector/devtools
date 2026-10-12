import { appFrames, captureStack } from './signal-stack.ts';
import type { SignalChange, SignalGraphNode } from './types.ts';

export const MAX_CHANGES = 50;
const MAX_TRACKS = 500;
export const MAX_NODES = 500;
const VALUE_KINDS = new Set(['signal', 'computed', 'linkedSignal', 'resource']);

/** The fields Angular's `setPostSignalSetFn` hook exposes on a signal node. */
export interface RawSignalNode {
  debugName?: string;
  kind?: string;
  value?: unknown;
  version?: number;
}

interface Track {
  id: string;
  ref: WeakRef<RawSignalNode>;
  label: string;
  kind: string;
  changes: SignalChange[];
  /** Writes since the last flush, serialized off Angular's set path. */
  pending: { epoch: number; value: unknown; at: number; stack?: string }[];
}

export interface SignalHistoryOptions {
  /** Whether to record the stack of each write. Checked on every write, so keep it cheap. */
  stacks?: () => boolean;
  /**
   * Called with each exact write once it is serialized, and each sampled change
   * as it is collected. `id` is the graph node id, unknown until a snapshot
   * matched the written signal to a node.
   */
  onChange?: (id: string | undefined, label: string, change: SignalChange) => void;
}

function append(list: SignalChange[], change: SignalChange) {
  list.push(change);
  if (list.length > MAX_CHANGES) list.splice(0, list.length - MAX_CHANGES);
}

export function createSignalHistory(
  serialize: (value: unknown, name?: string) => unknown,
  now = Date.now,
  snapshot = serialize,
  options: SignalHistoryOptions = {},
) {
  const tracks = new Map<string, Track>();
  /** The graph node each bound track belongs to: `bound` read backwards. */
  const nodeOfTrack = new Map<string, string>();
  const trackIds = new WeakMap<RawSignalNode, string>();
  const bound = new Map<string, string>();
  const history = new Map<string, SignalChange[]>();
  const totals = new Map<string, number>();
  const sent = new Map<string, number>();
  let trackSeq = 0;

  const dirty = new Set<Track>();
  let flushQueued = false;

  function flush() {
    flushQueued = false;
    for (const track of dirty) {
      for (const { stack, ...write } of track.pending) {
        let change: SignalChange;
        try {
          change = { ...write, value: serialize(write.value, track.label), source: 'write' };
        } catch {
          continue;
        }
        const frames = stack ? appFrames(stack) : [];
        if (frames.length) change.stack = frames;
        append(track.changes, change);
        notify(nodeOfTrack.get(track.id), track.label, change);
      }
      track.pending = [];
    }
    dirty.clear();
  }

  function notify(id: string | undefined, label: string, change: SignalChange) {
    if (!options.onChange) return;
    try {
      options.onChange(id, label, change);
    } catch {
      // A listener never breaks history.
    }
  }

  function unbind(nodeId: string) {
    const trackId = bound.get(nodeId);
    if (trackId !== undefined && nodeOfTrack.get(trackId) === nodeId) nodeOfTrack.delete(trackId);
    bound.delete(nodeId);
  }

  function evictTrack() {
    for (const [id, track] of tracks) {
      if (!track.ref.deref()) {
        tracks.delete(id);
        nodeOfTrack.delete(id);
        return;
      }
    }
    // Writes move a track to the end, so the first one is the least recently written.
    const oldest = tracks.keys().next().value!;
    tracks.delete(oldest);
    nodeOfTrack.delete(oldest);
  }

  function onWrite(node: RawSignalNode) {
    // Unnamed writes can't be matched to a graph node; snapshots still cover them.
    if (!node.debugName) return;
    const id = trackIds.get(node);
    let track = id ? tracks.get(id) : undefined;
    if (track) {
      tracks.delete(id!);
      tracks.set(id!, track);
    } else {
      const newId = `w${++trackSeq}`;
      track = {
        id: newId,
        ref: new WeakRef(node),
        label: node.debugName,
        kind: node.kind ?? 'signal',
        changes: [],
        pending: [],
      };
      trackIds.set(node, newId);
      tracks.set(newId, track);
      if (tracks.size > MAX_TRACKS) evictTrack();
    }
    // Keep the raw value and serialize it in a microtask: hot signals don't pay for it inside
    // Angular's set path, and a burst of writes serializes only the entries the list keeps.
    // Taking a stack is the costly part, so it happens only while stacks are on.
    const stack = options.stacks?.() ? captureStack() : undefined;
    track.pending.push({
      epoch: node.version ?? 0,
      value: node.value,
      at: now(),
      ...(stack ? { stack } : {}),
    });
    if (track.pending.length > MAX_CHANGES) track.pending.shift();
    dirty.add(track);
    if (!flushQueued) {
      flushQueued = true;
      void Promise.resolve().then(flush);
    }
  }

  function sameValue(raw: RawSignalNode, node: SignalGraphNode): boolean {
    if (!('value' in node)) return true;
    return JSON.stringify(snapshot(raw.value, node.label)) === JSON.stringify(node.value);
  }

  function findTrack(node: SignalGraphNode, taken: Set<string>): Track | undefined {
    const boundId = bound.get(node.id);
    if (boundId) {
      const track = tracks.get(boundId);
      const raw = track?.ref.deref();
      if (track && raw?.version === node.epoch && sameValue(raw, node)) return track;
      unbind(node.id);
      taken.delete(boundId);
    }
    if (!node.label) return undefined;
    const matches: string[] = [];
    for (const [id, track] of tracks) {
      const raw = track.ref.deref();
      if (!raw) {
        tracks.delete(id);
        nodeOfTrack.delete(id);
        continue;
      }
      if (
        !taken.has(id) &&
        track.label === node.label &&
        track.kind === node.kind &&
        raw.version === node.epoch &&
        sameValue(raw, node)
      ) {
        matches.push(id);
      }
    }
    // Two live signals with the same name and version are ambiguous; retry next snapshot.
    if (matches.length !== 1) return undefined;
    bound.set(node.id, matches[0]);
    nodeOfTrack.set(matches[0], node.id);
    taken.add(matches[0]);
    return tracks.get(matches[0]);
  }

  function collect(nodes: SignalGraphNode[]): Record<string, SignalChange[]> {
    flush();
    const taken = new Set(bound.values());
    const out: Record<string, SignalChange[]> = {};
    for (const node of nodes) {
      if (!VALUE_KINDS.has(node.kind)) continue;
      const list = history.get(node.id) ?? [];
      let lastEpoch = list.at(-1)?.epoch ?? -1;
      let total = totals.get(node.id) ?? 0;
      for (const change of findTrack(node, taken)?.changes ?? []) {
        if (change.epoch > node.epoch) break;
        if (change.epoch <= lastEpoch) continue;
        append(list, change);
        total += lastEpoch >= 0 ? change.epoch - lastEpoch : 1;
        lastEpoch = change.epoch;
      }
      if (node.epoch > lastEpoch) {
        const missed = lastEpoch >= 0 ? node.epoch - lastEpoch - 1 : 0;
        if (lastEpoch >= 0) total += 1 + missed;
        const change: SignalChange = {
          epoch: node.epoch,
          value: node.value,
          at: now(),
          source: lastEpoch < 0 ? 'initial' : 'sample',
          ...(missed > 0 ? { missed } : {}),
        };
        append(list, change);
        if (change.source === 'sample') notify(node.id, node.label ?? node.id, change);
      }
      history.delete(node.id);
      history.set(node.id, list);
      totals.set(node.id, total);
      out[node.id] = list.slice();
    }
    for (const id of history.keys()) {
      if (history.size <= MAX_NODES) break;
      history.delete(id);
      totals.delete(id);
      unbind(id);
    }
    return out;
  }

  /** Changes counted for a node since it was first collected, past the list cap. */
  function changesOf(id: string): number {
    return totals.get(id) ?? 0;
  }

  function collectDeltaWithRollback(
    nodes: SignalGraphNode[],
    full = false,
  ): { changes: Record<string, SignalChange[]>; rollback: () => void } {
    const out: Record<string, SignalChange[]> = {};
    const advanced = new Map<string, { before: number | undefined }>();
    for (const [id, list] of Object.entries(collect(nodes))) {
      const last = full ? -Infinity : (sent.get(id) ?? -Infinity);
      const fresh = list.filter((change) => change.epoch > last);
      if (list.length) {
        const after = list.at(-1)!.epoch;
        advanced.set(id, { before: sent.get(id) });
        sent.delete(id);
        sent.set(id, after);
      }
      if (fresh.length) out[id] = fresh;
    }
    for (const id of sent.keys()) {
      if (sent.size <= MAX_NODES) break;
      sent.delete(id);
    }
    const rollback = () => {
      for (const [id, { before }] of advanced) {
        const now = sent.get(id);
        if (before === undefined) sent.delete(id);
        else if (now === undefined || before < now) sent.set(id, before);
      }
    };
    return { changes: out, rollback };
  }

  function collectDelta(nodes: SignalGraphNode[], full = false): Record<string, SignalChange[]> {
    return collectDeltaWithRollback(nodes, full).changes;
  }

  return { onWrite, collect, collectDelta, collectDeltaWithRollback, changesOf };
}

type SignalSetHook = ((node: RawSignalNode) => void) | null;

export async function installSignalWriteHook(
  onWrite: (node: RawSignalNode) => void,
  load: () => Promise<{ setPostSignalSetFn: (fn: SignalSetHook) => SignalSetHook }> = () =>
    import('@angular/core/primitives/signals') as never,
): Promise<(() => void) | null> {
  let setHook: (fn: SignalSetHook) => SignalSetHook;
  try {
    ({ setPostSignalSetFn: setHook } = await load());
  } catch {
    // Without the hook, history falls back to poll samples only.
    return null;
  }
  if (typeof setHook !== 'function') return null;
  let prev: SignalSetHook = null;
  let active = true;
  const hook = (node: RawSignalNode) => {
    prev?.(node);
    if (!active) return;
    try {
      onWrite(node);
    } catch {
      return;
    }
  };
  prev = setHook(hook);
  return () => {
    active = false;
    const current = setHook(prev);
    // Someone chained after us; keep theirs, our hook now just forwards.
    if (current !== hook) setHook(current);
  };
}
