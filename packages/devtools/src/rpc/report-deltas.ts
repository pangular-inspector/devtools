import type { DeltaKey, DeltaShape, FlatNode, ReportDelta } from '../push-delta.ts';

// The server half of `push-delta.ts`: keeps each page's last report in the
// form deltas build on, and turns a delta back into the full report.

/** Deepest tree a delta may describe; deeper means a malformed or looping delta. */
const MAX_TREE_DEPTH = 2000;
/** Most items a list, tree or map field may hold. */
const MAX_ITEMS = 50_000;

type Field =
  | { kind: 'plain'; value: unknown }
  | { kind: 'list'; order: DeltaKey[]; items: Map<DeltaKey, unknown> }
  | { kind: 'tree'; roots: DeltaKey[]; nodes: Map<DeltaKey, FlatNode> }
  | { kind: 'map'; keys: string[]; values: Map<string, unknown> };

interface Base {
  seq: number;
  keys: string[];
  fields: Map<string, Field>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isKey = (key: unknown): key is DeltaKey =>
  (typeof key === 'string' && key.length > 0 && key.length < 200) ||
  (typeof key === 'number' && Number.isFinite(key));

const keyList = (value: unknown): DeltaKey[] | null =>
  Array.isArray(value) && value.length <= MAX_ITEMS && value.every(isKey) ? value : null;

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= MAX_ITEMS && value.every((k) => typeof k === 'string')
    ? value
    : null;

/** A field of a full report, stored the way its deltas will change it. */
function storeField(shape: DeltaShape, name: string, value: unknown): Field {
  const listKey = shape.lists?.[name];
  if (listKey && Array.isArray(value)) {
    const items = new Map<DeltaKey, unknown>();
    const order: DeltaKey[] = [];
    let ok = true;
    for (const item of value) {
      const key = isRecord(item) ? listKey(item) : undefined;
      if (!isKey(key) || items.has(key)) {
        ok = false;
        break;
      }
      items.set(key, item);
      order.push(key);
    }
    if (ok) return { kind: 'list', order, items };
  }
  const treeKey = shape.trees?.[name];
  if (treeKey && Array.isArray(value)) {
    const nodes = new Map<DeltaKey, FlatNode>();
    const visit = (list: unknown[]): DeltaKey[] | null => {
      const keys: DeltaKey[] = [];
      for (const node of list) {
        if (!isRecord(node) || !Array.isArray(node['children'])) return null;
        const key = treeKey(node);
        if (!isKey(key) || nodes.has(key)) return null;
        const flat = { ...node, children: [] as DeltaKey[] } as FlatNode;
        nodes.set(key, flat);
        const children = visit(node['children'] as unknown[]);
        if (!children) return null;
        flat.children = children;
        keys.push(key);
      }
      return keys;
    };
    const roots = visit(value);
    if (roots) return { kind: 'tree', roots, nodes };
  }
  if (shape.maps?.includes(name) && isRecord(value)) {
    return { kind: 'map', keys: Object.keys(value), values: new Map(Object.entries(value)) };
  }
  return { kind: 'plain', value };
}

/** The tree from its flat nodes, or null when a key is missing, repeated or too deep. */
function buildTree(roots: DeltaKey[], nodes: Map<DeltaKey, FlatNode>): unknown[] | null {
  const used = new Set<DeltaKey>();
  const build = (keys: DeltaKey[], depth: number): unknown[] | null => {
    if (depth > MAX_TREE_DEPTH) return null;
    const out: unknown[] = [];
    for (const key of keys) {
      const flat = nodes.get(key);
      if (!flat || used.has(key) || !Array.isArray(flat.children)) return null;
      used.add(key);
      const children = build(flat.children, depth + 1);
      if (!children) return null;
      out.push({ ...flat, children });
    }
    return out;
  };
  const tree = build(roots, 0);
  if (!tree) return null;
  // Nodes no longer reached were removed from the tree.
  for (const key of [...nodes.keys()]) if (!used.has(key)) nodes.delete(key);
  return tree;
}

function valueOf(field: Field): unknown {
  switch (field.kind) {
    case 'plain':
      return field.value;
    case 'list':
      return field.order.map((key) => field.items.get(key));
    case 'tree':
      return buildTree(field.roots, field.nodes);
    case 'map':
      return Object.fromEntries(field.keys.map((key) => [key, field.values.get(key)]));
  }
}

/** Applies `delta` to `base` in place; false when it does not fit. */
function applyDelta(
  shape: DeltaShape,
  base: Base,
  delta: ReportDelta,
): Record<string, unknown> | null {
  if (delta.keys !== undefined) {
    const keys = stringList(delta.keys);
    if (!keys) return null;
    base.keys = keys;
  }
  for (const [name, value] of Object.entries(isRecord(delta.set) ? delta.set : {})) {
    base.fields.set(name, { kind: 'plain', value });
  }
  for (const [name, part] of Object.entries(isRecord(delta.lists) ? delta.lists : {})) {
    const keyOf = shape.lists?.[name];
    if (!keyOf || !isRecord(part)) return null;
    let field = base.fields.get(name);
    if (field?.kind !== 'list') {
      if (part['order'] === undefined) return null;
      field = { kind: 'list', order: [], items: new Map() };
      base.fields.set(name, field);
    }
    if (part['order'] !== undefined) {
      const order = keyList(part['order']);
      if (!order) return null;
      field.order = order;
    }
    for (const item of Array.isArray(part['set']) ? part['set'] : []) {
      const key = isRecord(item) ? keyOf(item) : undefined;
      if (!isKey(key)) return null;
      field.items.set(key, item);
    }
    const kept = new Set(field.order);
    if (kept.size !== field.order.length) return null;
    for (const key of [...field.items.keys()]) if (!kept.has(key)) field.items.delete(key);
    if (field.order.some((key) => !field.items.has(key))) return null;
  }
  for (const [name, part] of Object.entries(isRecord(delta.trees) ? delta.trees : {})) {
    if (!shape.trees?.[name] || !isRecord(part)) return null;
    let field = base.fields.get(name);
    if (field?.kind !== 'tree') {
      if (part['roots'] === undefined) return null;
      field = { kind: 'tree', roots: [], nodes: new Map() };
      base.fields.set(name, field);
    }
    if (part['roots'] !== undefined) {
      const roots = keyList(part['roots']);
      if (!roots) return null;
      field.roots = roots;
    }
    for (const entry of Array.isArray(part['set']) ? part['set'] : []) {
      if (!Array.isArray(entry) || !isKey(entry[0]) || !isRecord(entry[1])) return null;
      const children = keyList(entry[1]['children']);
      if (!children) return null;
      field.nodes.set(entry[0], entry[1] as FlatNode);
    }
    if (field.nodes.size > MAX_ITEMS) return null;
  }
  for (const [name, part] of Object.entries(isRecord(delta.maps) ? delta.maps : {})) {
    if (!shape.maps?.includes(name) || !isRecord(part)) return null;
    let field = base.fields.get(name);
    if (field?.kind !== 'map') {
      if (part['keys'] === undefined) return null;
      field = { kind: 'map', keys: [], values: new Map() };
      base.fields.set(name, field);
    }
    if (part['keys'] !== undefined) {
      const keys = stringList(part['keys']);
      if (!keys) return null;
      field.keys = keys;
    }
    for (const [key, value] of Object.entries(isRecord(part['set']) ? part['set'] : {})) {
      field.values.set(key, value);
    }
    const kept = new Set(field.keys);
    for (const key of [...field.values.keys()]) if (!kept.has(key)) field.values.delete(key);
    if (field.keys.some((key) => !field.values.has(key))) return null;
  }
  for (const name of [...base.fields.keys()]) {
    if (!base.keys.includes(name)) base.fields.delete(name);
  }
  return reportOf(base);
}

function reportOf(base: Base): Record<string, unknown> | null {
  const entries: [string, unknown][] = [];
  for (const name of base.keys) {
    const field = base.fields.get(name);
    if (!field) return null;
    const value = valueOf(field);
    if (value === null && field.kind === 'tree') return null;
    entries.push([name, value]);
  }
  // `fromEntries` defines own properties, so a `__proto__` key stays a plain field.
  return Object.fromEntries(entries);
}

export type DeltaReceipt =
  /** A report without a delta mark, from a page that sends full reports only. */
  | { kind: 'legacy'; report: Record<string, unknown> }
  /** The full report, rebuilt or as sent; answer `{delta: true}` once it is stored. */
  | { kind: 'report'; report: Record<string, unknown> }
  /** A delta that does not fit what the server holds; answer `{known: false}`. */
  | { kind: 'unknown' };

export interface ReportDeltas {
  /** Reads a push: a full report (with or without a delta mark) or a delta. */
  receive(message: unknown): DeltaReceipt;
  /** Drops what a page's deltas build on, so its next delta asks for a full report. */
  forget(pageId: string): void;
  /** Drops the pages `alive` says are gone. */
  prune(alive: (pageId: string) => boolean): void;
  /** Pages with a stored report, for tests. */
  readonly size: number;
}

/** Turns one kind of push (component tree, injectors…) back into full reports. */
export function createReportDeltas(shape: DeltaShape): ReportDeltas {
  const bases = new Map<string, Base>();

  return {
    receive(message) {
      if (!isRecord(message)) return { kind: 'legacy', report: message as never };
      const pageId = message['pageId'];
      const mark = message['delta'];
      if (typeof pageId !== 'string' || !isRecord(mark)) {
        if (typeof pageId === 'string') bases.delete(pageId);
        return { kind: 'legacy', report: message };
      }
      if (mark['full'] === true) {
        const { delta: _delta, ...report } = message;
        const seq = typeof mark['seq'] === 'number' ? mark['seq'] : 0;
        const keys = Object.keys(report).filter((key) => report[key] !== undefined);
        const fields = new Map<string, Field>();
        for (const key of keys) fields.set(key, storeField(shape, key, report[key]));
        bases.set(pageId, { seq, keys, fields });
        return { kind: 'report', report };
      }
      const delta = mark as unknown as ReportDelta;
      const base = bases.get(pageId);
      if (!base || delta.base !== base.seq || typeof delta.seq !== 'number') {
        bases.delete(pageId);
        return { kind: 'unknown' };
      }
      let report: Record<string, unknown> | null = null;
      try {
        report = applyDelta(shape, base, delta);
      } catch {
        report = null;
      }
      if (!report) {
        bases.delete(pageId);
        return { kind: 'unknown' };
      }
      base.seq = delta.seq;
      return { kind: 'report', report };
    },
    forget(pageId) {
      bases.delete(pageId);
    },
    prune(alive) {
      for (const pageId of [...bases.keys()]) if (!alive(pageId)) bases.delete(pageId);
    },
    get size() {
      return bases.size;
    },
  };
}

/**
 * Wraps a push handler so it takes deltas. `store` gets the full report and
 * returns whether it kept it. A page that sent a delta mark is answered
 * `{delta: true}` once its report is stored, or `{known: false}` to ask for a
 * full one; a page that sends full reports only gets what `store` returns.
 */
export function deltaPush(
  deltas: ReportDeltas,
  owns: (pageId: unknown) => boolean,
  store: (report: Record<string, unknown>) => unknown,
) {
  return (message: unknown) => {
    const pageId = isRecord(message) ? message['pageId'] : undefined;
    const marked = isRecord(message) && isRecord(message['delta']);
    if (!marked) {
      const answer = store(message as Record<string, unknown>);
      if (answer === true && typeof pageId === 'string') deltas.forget(pageId);
      return typeof answer === 'boolean' ? undefined : answer;
    }
    if (typeof pageId !== 'string' || !pageId || pageId.length >= 50 || !owns(pageId)) return;
    const receipt = deltas.receive(message);
    if (receipt.kind === 'unknown') return { known: false };
    if (store(receipt.report) === false) {
      deltas.forget(pageId);
      return { known: false };
    }
    return { delta: true };
  };
}
