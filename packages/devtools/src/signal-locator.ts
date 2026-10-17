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
 * `ɵgetSignalGraph` keeps one id per reactive node (a `WeakMap` in Angular's
 * debug code) but does not hand out the node, and a service signal the
 * template reads can look exactly like a field the template never reads. So a
 * field is bound to a graph node only when its own reactive node (the
 * getter's `SIGNAL` node) provably is that node: from the field's node the
 * locator follows Angular's live `consumers` links up to the roots (the
 * template and effects), then walks each root's `producers` links alongside
 * the graph's edges, the way `getSignalGraph` built them, and every node on
 * the way must agree in kind, version, name and value. A root that fits more
 * than one place in the graph proves nothing. The proof runs on every
 * collect; a binding it no longer proves is dropped.
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

/** The reactive nodes some instance's field is bound to right now. */
const locatedNodes = new WeakSet<object>();

/** Whether `node` is a field's reactive node that the last collect bound to a graph node. */
export function isLocatedNode(node: object): boolean {
  return locatedNodes.has(node);
}

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

/**
 * The link fields of Angular's reactive nodes (`@angular/core/primitives/signals`):
 * linked lists from 20.0, arrays (`producerNode`, `liveConsumerNode`) before.
 */
interface ReactiveLink {
  producer?: ReactiveNode;
  consumer?: ReactiveNode;
  nextProducer?: ReactiveLink;
  nextConsumer?: ReactiveLink;
}

interface ReactiveNode extends RawNode {
  producers?: ReactiveLink;
  consumers?: ReactiveLink;
  producerNode?: ReactiveNode[];
  liveConsumerNode?: ReactiveNode[];
}

interface GraphEdgeLike {
  consumer: number;
  producer: number;
}

/** Upper bound on the nodes one proof visits, so a huge graph costs a bounded walk. */
const MAX_STEPS = 5000;

/** The nodes `node` reads, in the order Angular lists them. */
function producersOf(node: ReactiveNode): ReactiveNode[] | null {
  const array = read(() => node.producerNode, undefined);
  if (Array.isArray(array)) return array.length > MAX_STEPS ? null : array.slice();
  const out: ReactiveNode[] = [];
  let link = read(() => node.producers, undefined);
  while (link) {
    const producer = read(() => link!.producer, undefined);
    if (!producer || typeof producer !== 'object') return null;
    out.push(producer);
    if (out.length > MAX_STEPS) return null;
    link = read(() => link!.nextProducer, undefined);
  }
  return out;
}

/** The live nodes that read `node`. */
function consumersOf(node: ReactiveNode): ReactiveNode[] {
  const array = read(() => node.liveConsumerNode, undefined);
  if (Array.isArray(array)) return array.slice(0, MAX_STEPS);
  const out: ReactiveNode[] = [];
  let link = read(() => node.consumers, undefined);
  while (link && out.length < MAX_STEPS) {
    const consumer = read(() => link!.consumer, undefined);
    if (consumer && typeof consumer === 'object') out.push(consumer);
    link = read(() => link!.nextConsumer, undefined);
  }
  return out;
}

/** The live roots (nodes nothing reads) above `node`, by its consumer links. */
function rootsAbove(node: ReactiveNode, budget: { steps: number }): ReactiveNode[] {
  const roots: ReactiveNode[] = [];
  const seen = new Set<ReactiveNode>([node]);
  const queue: ReactiveNode[] = [node];
  for (let next = 0; next < queue.length; next++) {
    const current = queue[next];
    const consumers = consumersOf(current);
    if (!consumers.length) {
      if (current !== node) roots.push(current);
      continue;
    }
    for (const consumer of consumers) {
      if (--budget.steps < 0) return [];
      if (seen.has(consumer)) continue;
      seen.add(consumer);
      queue.push(consumer);
    }
  }
  return roots;
}

/** Whether a raw node and a graph node agree on everything the graph reports. */
function sameNode(raw: ReactiveNode, n: GraphNodeLike): boolean {
  if (raw.kind !== n.kind) return false;
  if ((raw.version ?? 0) !== (n.epoch ?? 0)) return false;
  // A template node's label falls back to the host tag name.
  if (n.kind !== 'template' && (raw.debugName || undefined) !== (n.label || undefined)) {
    return false;
  }
  return !('value' in n) || Object.is(raw.value, n.value);
}

/**
 * Raw node to graph index, for the nodes provably behind the graph: each root
 * above a field is walked down alongside the one graph root it fits.
 */
function proveNodes(
  nodes: readonly GraphNodeLike[],
  edges: readonly GraphEdgeLike[],
  fields: readonly WritableField[],
): Map<ReactiveNode, number> {
  const proven = new Map<ReactiveNode, number>();
  const taken = new Set<number>();
  const graphProducers = new Map<number, number[]>();
  const isProducer = new Set<number>();
  for (const e of edges) {
    if (!Number.isInteger(e?.consumer) || !Number.isInteger(e?.producer)) continue;
    let list = graphProducers.get(e.consumer);
    if (!list) graphProducers.set(e.consumer, (list = []));
    list.push(e.producer);
    isProducer.add(e.producer);
  }
  const graphRoots = nodes.map((_, index) => index).filter((index) => !isProducer.has(index));
  const budget = { steps: MAX_STEPS };

  /** Walks `raw` alongside graph node `index`; adds the pairs to `trial` when they all agree. */
  function walk(
    raw: ReactiveNode,
    index: number,
    trial: Map<ReactiveNode, number>,
    used: Set<number>,
  ): boolean {
    const known = proven.get(raw) ?? trial.get(raw);
    if (known !== undefined) return known === index;
    if (taken.has(index) || used.has(index)) return false;
    if (--budget.steps < 0) return false;
    const n = nodes[index];
    if (!n || !sameNode(raw, n)) return false;
    trial.set(raw, index);
    used.add(index);
    const rawProducers = producersOf(raw);
    const expected = graphProducers.get(index) ?? [];
    if (!rawProducers || rawProducers.length !== expected.length) return false;
    return rawProducers.every((producer, i) => walk(producer, expected[i], trial, used));
  }

  const tried = new Set<ReactiveNode>();
  for (const field of fields) {
    const node = field.node as ReactiveNode;
    if (proven.has(node)) continue;
    for (const root of rootsAbove(node, budget)) {
      if (tried.has(root)) continue;
      tried.add(root);
      let fit: Map<ReactiveNode, number> | null = null;
      let fits = 0;
      for (const index of graphRoots) {
        if (taken.has(index) || nodes[index]?.kind !== root.kind) continue;
        const trial = new Map<ReactiveNode, number>();
        if (!walk(root, index, trial, new Set())) continue;
        fits++;
        fit = trial;
        if (fits > 1) break;
      }
      if (fits !== 1 || !fit) continue;
      for (const [raw, index] of fit) {
        proven.set(raw, index);
        taken.add(index);
      }
    }
  }
  return proven;
}

/**
 * The writable own field behind each graph node of `instance`'s graph, by the
 * node's index in `nodes`. `edges` are the graph's edges as Angular sent them.
 */
export function locateWritable(
  ng: LocatorNg,
  instance: object,
  nodes: readonly GraphNodeLike[],
  edges: readonly GraphEdgeLike[] = [],
): Map<number, WritableField> {
  const found = new Map<number, WritableField>();
  const cache = new Map<string, RawNode>();
  // Drop what the last collect bound; only what this one proves is kept.
  for (const node of bound.get(instance)?.values() ?? []) locatedNodes.delete(node);
  bound.delete(instance);
  if (!nodes.some((n) => WRITABLE_KINDS.has(n.kind ?? ''))) return found;
  const fields = writableFields(ng, instance);
  if (!fields.length) return found;
  const proven = proveNodes(nodes, edges, fields);
  for (const field of fields) {
    const index = proven.get(field.node as ReactiveNode);
    if (index === undefined || found.has(index)) continue;
    const n = nodes[index];
    if (!WRITABLE_KINDS.has(n.kind ?? '')) continue;
    found.set(index, field);
    cache.set(String(n.id), field.node);
    locatedNodes.add(field.node);
  }
  if (cache.size) bound.set(instance, cache);
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
