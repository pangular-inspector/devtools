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
  ref: WeakRef<RawSignalNode>;
  label: string;
  kind: string;
  changes: SignalChange[];
}

function append(list: SignalChange[], change: SignalChange) {
  list.push(change);
  if (list.length > MAX_CHANGES) list.splice(0, list.length - MAX_CHANGES);
}

export function createSignalHistory(
  serialize: (value: unknown, name?: string) => unknown,
  now = Date.now,
  snapshot = serialize,
) {
  const tracks = new Map<string, Track>();
  const trackIds = new WeakMap<RawSignalNode, string>();
  const bound = new Map<string, string>();
  const history = new Map<string, SignalChange[]>();
  const totals = new Map<string, number>();
  const sent = new Map<string, number>();
  let trackSeq = 0;

  function onWrite(node: RawSignalNode) {
    // Unnamed writes can't be matched to a graph node; snapshots still cover them.
    if (!node.debugName) return;
    const id = trackIds.get(node);
    let track = id ? tracks.get(id) : undefined;
    if (!track) {
      const newId = `w${++trackSeq}`;
      track = {
        ref: new WeakRef(node),
        label: node.debugName,
        kind: node.kind ?? 'signal',
        changes: [],
      };
      trackIds.set(node, newId);
      tracks.set(newId, track);
      if (tracks.size > MAX_TRACKS) tracks.delete(tracks.keys().next().value!);
    }
    append(track.changes, {
      epoch: node.version ?? 0,
      value: serialize(node.value, node.debugName),
      at: now(),
      source: 'write',
    });
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
      bound.delete(node.id);
      taken.delete(boundId);
    }
    if (!node.label) return undefined;
    const matches: string[] = [];
    for (const [id, track] of tracks) {
      const raw = track.ref.deref();
      if (!raw) {
        tracks.delete(id);
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
    taken.add(matches[0]);
    return tracks.get(matches[0]);
  }

  function collect(nodes: SignalGraphNode[]): Record<string, SignalChange[]> {
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
        append(list, {
          epoch: node.epoch,
          value: node.value,
          at: now(),
          source: lastEpoch < 0 ? 'initial' : 'sample',
          ...(missed > 0 ? { missed } : {}),
        });
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
      bound.delete(id);
    }
    return out;
  }

  /** Changes counted for a node since it was first collected, past the list cap. */
  function changesOf(id: string): number {
    return totals.get(id) ?? 0;
  }

  function collectDelta(nodes: SignalGraphNode[], full = false): Record<string, SignalChange[]> {
    const out: Record<string, SignalChange[]> = {};
    for (const [id, list] of Object.entries(collect(nodes))) {
      const last = full ? -Infinity : (sent.get(id) ?? -Infinity);
      const fresh = list.filter((change) => change.epoch > last);
      if (list.length) {
        sent.delete(id);
        sent.set(id, list.at(-1)!.epoch);
      }
      if (fresh.length) out[id] = fresh;
    }
    for (const id of sent.keys()) {
      if (sent.size <= MAX_NODES) break;
      sent.delete(id);
    }
    return out;
  }

  return { onWrite, collect, collectDelta, changesOf };
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
