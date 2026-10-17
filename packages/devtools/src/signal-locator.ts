import { rawNodeOf, type RawNode } from './signal-resources.ts';
import type { SignalGraphNode } from './types.ts';

/**
 * Finds the own field of a component instance that holds a signal graph node,
 * so a past value can be written back to it (`signal-restore.ts`). Only
 * writable signals count: `signal()`, `linkedSignal()` and `model()` (Angular
 * reports a model as kind `signal`; its getter has `set`, an input's has not).
 * `computed()`, signal inputs,
 * service signals and a child's signals have no locator.
 *
 * `ɵgetSignalGraph` keeps one id per reactive node for the life of the page
 * (a `WeakMap` in Angular's debug code), but does not hand out the node. A
 * field is matched to a graph node by kind, version, `debugName` and, when
 * Angular sends one, the value by identity; a match is used only when it is
 * the only one both ways, so unnamed signals work once they differ. A match
 * is then kept per instance, so the id stays bound to its field.
 */

const WRITABLE_KINDS = new Set(['signal', 'linkedSignal']);

export interface WritableField {
  key: string;
  node: RawNode;
  signal: { set(value: unknown): void };
}

interface GraphNodeLike {
  id?: unknown;
  kind?: string;
  label?: string;
  epoch?: number;
  value?: unknown;
}

interface LocatorNg {
  isSignal?(value: unknown): boolean;
}

/** Graph node id to the reactive node it was matched to, per component instance. */
const bound = new WeakMap<object, Map<string, RawNode>>();

/** The raw value behind a reported node's serialized `value`. Never leaves the page. */
const rawValues = new WeakMap<SignalGraphNode, { value: unknown }>();

export function setRawValue(node: SignalGraphNode, value: unknown): void {
  rawValues.set(node, { value });
}

export function rawValueOf(node: SignalGraphNode): { value: unknown } | undefined {
  return rawValues.get(node);
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The own fields of `instance` that hold a writable signal, read without calling them. */
export function writableFields(ng: LocatorNg, instance: object): WritableField[] {
  const out: WritableField[] = [];
  for (const key of read(() => Object.keys(instance), [] as string[])) {
    if (key.startsWith('__ng') || key.startsWith('ɵ')) continue;
    const value = read(() => (instance as Record<string, unknown>)[key], undefined);
    if (typeof value !== 'function') continue;
    if (!read(() => ng.isSignal?.(value) ?? true, false)) continue;
    if (typeof read(() => (value as { set?: unknown }).set, undefined) !== 'function') continue;
    const node = rawNodeOf(value);
    if (!node || !WRITABLE_KINDS.has(node.kind ?? '')) continue;
    out.push({ key, node, signal: value as unknown as WritableField['signal'] });
  }
  return out;
}

function matches(n: GraphNodeLike, field: WritableField): boolean {
  const node = field.node;
  if (node.kind !== n.kind) return false;
  if ((node.version ?? 0) !== (n.epoch ?? 0)) return false;
  if ((node.debugName || undefined) !== (n.label || undefined)) return false;
  return !('value' in n) || Object.is(node.value, n.value);
}

/**
 * The writable own field behind each graph node of `instance`'s graph, by the
 * node's index in `nodes`.
 */
export function locateWritable(
  ng: LocatorNg,
  instance: object,
  nodes: readonly GraphNodeLike[],
): Map<number, WritableField> {
  const found = new Map<number, WritableField>();
  if (!nodes.some((n) => WRITABLE_KINDS.has(n.kind ?? ''))) return found;
  const fields = writableFields(ng, instance);
  if (!fields.length) return found;
  let cache = bound.get(instance);
  if (!cache) {
    cache = new Map();
    bound.set(instance, cache);
  }
  const claimed = new Set<RawNode>();
  const open: number[] = [];
  nodes.forEach((n, index) => {
    if (!WRITABLE_KINDS.has(n.kind ?? '')) return;
    const id = String(n.id);
    const known = cache.get(id);
    const field = known ? fields.find((f) => f.node === known) : undefined;
    if (field) {
      found.set(index, field);
      claimed.add(field.node);
      return;
    }
    if (known) cache.delete(id);
    open.push(index);
  });
  const candidates = new Map<number, WritableField[]>();
  const claims = new Map<RawNode, number>();
  for (const index of open) {
    const list = fields.filter((f) => !claimed.has(f.node) && matches(nodes[index], f));
    candidates.set(index, list);
    for (const f of list) claims.set(f.node, (claims.get(f.node) ?? 0) + 1);
  }
  for (const [index, list] of candidates) {
    if (list.length !== 1 || claims.get(list[0].node) !== 1) continue;
    found.set(index, list[0]);
    cache.set(String(nodes[index].id), list[0].node);
  }
  return found;
}

/** The field a graph node was matched to on this instance, if it still holds it. */
export function boundField(
  ng: LocatorNg,
  instance: object,
  nodeId: string,
): WritableField | undefined {
  const node = bound.get(instance)?.get(nodeId);
  return node ? writableFields(ng, instance).find((f) => f.node === node) : undefined;
}
