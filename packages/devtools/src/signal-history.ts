import { isLocatedNode, rawValueOf } from './signal-locator.ts';
import { appFrames, captureStack } from './signal-stack.ts';
import type { SignalChange, SignalGraphNode } from './types.ts';

export const MAX_CHANGES = 50;
const MAX_TRACKS = 500;
export const MAX_NODES = 500;
const VALUE_KINDS = new Set(['signal', 'computed', 'linkedSignal', 'resource']);

/** A history entry's value as the app held it, kept on the page only, for restores. */
interface RawEntry {
  value: unknown;
  label: string | undefined;
}

/** What `rawEntry` finds for a node's history entry. */
export type RawEntryLookup =
  | { found: true; value: unknown; change: SignalChange; intact: boolean }
  | { found: false; reason: 'gone' | 'unkept' };

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
  /**
   * Whether the page may restore a past value (`actions.components`). Raw
   * values are kept for restores only when this is on, and only for nodes the
   * snapshot gave a `locator`; everything else keeps just the serialized copy.
   */
  restorable?: boolean;
  /**
   * Whether a written node is a field the locator bound to a graph node, so
   * its writes keep raw values. Defaults to the locator's own bindings.
   */
  located?: (node: RawSignalNode) => boolean;
  /** Whether to record the stack of each write. Checked on every write, so keep it cheap. */
  stacks?: () => boolean;
  /**
   * Called with each exact write once it is serialized, and each sampled change
   * as it is collected. `id` is the graph node id, unknown until a snapshot
   * matched the written signal to a node. `raw` holds the written value as
   * the app set it (exact writes only), before serialization.
   */
  onChange?: (
    id: string | undefined,
    label: string,
    change: SignalChange,
    raw?: { value: unknown },
  ) => void;
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
  // Lives as long as the entry is kept, so it shares the history caps.
  const raws = new WeakMap<SignalChange, RawEntry>();
  const located = options.located ?? isLocatedNode;
  /** Nodes the last snapshot gave a locator, whose entries keep raw values. */
  const restorable = new Set<string>();
  let trackSeq = 0;

  const dirty = new Set<Track>();
  let flushQueued = false;

  function flush() {
    flushQueued = false;
    for (const track of dirty) {
      const node = options.restorable ? track.ref.deref() : undefined;
      const keepWrites = !!node && located(node);
      for (const { stack, ...write } of track.pending) {
        let change: SignalChange;
        try {
          change = { ...write, value: serialize(write.value, track.label), source: 'write' };
        } catch {
          continue;
        }
        const frames = stack ? appFrames(stack) : [];
        if (frames.length) change.stack = frames;
        if (keepWrites) raws.set(change, { value: write.value, label: track.label });
        append(track.changes, change);
        notify(nodeOfTrack.get(track.id), track.label, change, { value: write.value });
      }
      track.pending = [];
    }
    dirty.clear();
  }

  function notify(
    id: string | undefined,
    label: string,
    change: SignalChange,
    raw?: { value: unknown },
  ) {
    if (!options.onChange) return;
    try {
      options.onChange(id, label, change, raw);
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
      const keepRaw = !!options.restorable && !!node.locator;
      if (keepRaw) restorable.add(node.id);
      else if (restorable.delete(node.id)) for (const change of list) raws.delete(change);
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
        const raw = keepRaw ? rawValueOf(node) : undefined;
        if (raw) raws.set(change, { value: raw.value, label: node.label });
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
      restorable.delete(id);
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

  /**
   * The value of a node's history entry as the app held it. `intact` is false
   * when the value was changed in place after it was recorded, so it no
   * longer serializes to what the history shows.
   */
  function rawEntry(id: string, epoch: number): RawEntryLookup {
    const change = history.get(id)?.find((entry) => entry.epoch === epoch);
    if (!change) return { found: false, reason: 'gone' };
    const raw = raws.get(change);
    if (!raw) return { found: false, reason: 'unkept' };
    let intact: boolean;
    try {
      const again = (change.source === 'write' ? serialize : snapshot)(raw.value, raw.label);
      intact = JSON.stringify(again) === JSON.stringify(change.value);
    } catch {
      intact = false;
    }
    return { found: true, value: raw.value, change, intact };
  }

  return { onWrite, collect, collectDelta, collectDeltaWithRollback, changesOf, rawEntry };
}

type SignalSetHook = ((node: RawSignalNode) => void) | null;

/**
 * Loads Angular's signal primitives, a package entry from 17.0. webpack is
 * told to leave the import alone, so an Angular 12 to 16 app (which has no
 * such entry) still builds; in a webpack bundle the import then fails at run
 * time and history falls back to samples. Vite and esbuild resolve it as
 * usual, and the Vite plugin stubs it out before 17.0 (`signals-stub.ts`).
 */
function loadSignalPrimitives(): Promise<SignalPrimitives> {
  return import(/* webpackIgnore: true */ '@angular/core/primitives/signals') as never;
}

/** The parts of `@angular/core/primitives/signals` the write hook uses. */
interface SignalPrimitives {
  setPostSignalSetFn: (fn: SignalSetHook) => SignalSetHook;
  SIGNAL_NODE?: object;
  signalSetFn?: (node: object, value: unknown) => void;
}

/**
 * Whether the write hook hands over the node that was written: from 20.0.
 * Angular 17.0 to 19.x call it with no arguments, so it can't tell which
 * signal changed. Writes a signal node made only for this, with no consumers,
 * while a probe holds the hook, so no other hook sees it. Undefined when the
 * probe can't run, such as inside a reactive context.
 */
function hookPassesNode(primitives: SignalPrimitives): boolean | undefined {
  const { setPostSignalSetFn: setHook, SIGNAL_NODE: base, signalSetFn } = primitives;
  if (!base || typeof signalSetFn !== 'function') return undefined;
  let called = false;
  let passed = false;
  const prev = setHook((node) => {
    called = true;
    passed = !!node && typeof node === 'object';
  });
  try {
    const node = Object.create(base) as { value?: unknown };
    node.value = 0;
    signalSetFn(node, 1);
  } catch {
    return undefined;
  } finally {
    setHook(prev);
  }
  return called ? passed : undefined;
}

export async function installSignalWriteHook(
  onWrite: (node: RawSignalNode) => void,
  load: () => Promise<SignalPrimitives> = loadSignalPrimitives,
): Promise<(() => void) | null> {
  let primitives: SignalPrimitives;
  try {
    primitives = await load();
  } catch {
    // Without the hook, history falls back to poll samples only.
    return null;
  }
  const setHook = primitives?.setPostSignalSetFn;
  if (typeof setHook !== 'function') return null;
  // A hook that can't say which signal was written is as good as none.
  if (hookPassesNode(primitives) === false) return null;
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
