// Delta pushes: after one full report, the page sends only what changed.
//
// A report is a plain object. Each top-level field is sent as one of four kinds:
// - `plain`: the whole value, when its JSON changed.
// - `list`: an array of objects with a unique key (form ids, event seqs, cycle
//   ids). Changed items are sent, and the key order when it changed.
// - `tree`: an array of nodes with `children`, keyed per node (component and
//   injector trees). Each node is sent flat, its `children` replaced by their
//   keys, when that flat node changed; the root keys when they changed.
// - `map`: a record of values (checks per host). Changed entries, and the key
//   order when it changed.
// The server keeps the last report per page in the same form, applies the
// delta and gets back the report the page would have sent in full, field
// order included. A delta names the sequence number it builds on; when the
// server's differs (a lost push, a restart), it answers `known: false` and the
// page sends the whole report again.

export type DeltaKey = string | number;

export interface DeltaShape {
  /** Array fields of objects, with the key of each item. */
  lists?: Record<string, (item: any) => unknown>;
  /** Tree fields, with the key of each node. Children are in `children`. */
  trees?: Record<string, (node: any) => unknown>;
  /** Record fields whose entries change one by one. */
  maps?: readonly string[];
}

/** A tree node as a delta carries it: `children` holds the keys of its children. */
export type FlatNode = Record<string, unknown> & { children: DeltaKey[] };

export interface ListDelta {
  /** Every key in order, when the order or the set of keys changed. */
  order?: DeltaKey[];
  set?: unknown[];
}

export interface TreeDelta {
  roots?: DeltaKey[];
  /** Changed nodes, flat. */
  set?: [DeltaKey, FlatNode][];
}

export interface MapDelta {
  /** Every key in order, when the order or the set of keys changed. */
  keys?: string[];
  set?: Record<string, unknown>;
}

export interface ReportDelta {
  /** The sequence number of the report this delta builds on. */
  base: number;
  seq: number;
  /** Every top-level field in order, when that changed. */
  keys?: string[];
  set?: Record<string, unknown>;
  lists?: Record<string, ListDelta>;
  trees?: Record<string, TreeDelta>;
  maps?: Record<string, MapDelta>;
}

/** The `delta` field of a full report sent by a page that can send deltas next. */
export interface FullMark {
  full: true;
  seq: number;
}

export interface DeltaMessage {
  pageId: string;
  delta: ReportDelta;
}

const validKey = (key: unknown): key is DeltaKey =>
  (typeof key === 'string' && key.length > 0 && key.length < 200) ||
  (typeof key === 'number' && Number.isFinite(key));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

type FieldState =
  | { kind: 'plain'; json: string }
  | { kind: 'list'; order: string; items: Map<DeltaKey, string> }
  | { kind: 'tree'; roots: string; nodes: Map<DeltaKey, string> }
  | { kind: 'map'; keys: string; values: Map<string, string> };

/** Keys of a list, or null when one is missing or repeated. */
function listKeys(items: unknown[], keyOf: (item: any) => unknown): DeltaKey[] | null {
  const keys: DeltaKey[] = [];
  const seen = new Set<DeltaKey>();
  for (const item of items) {
    if (!isRecord(item)) return null;
    const key = keyOf(item);
    if (!validKey(key) || seen.has(key)) return null;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** A tree as flat nodes in visit order, or null when a key is missing or repeated. */
export function flattenTree(
  roots: unknown[],
  keyOf: (node: any) => unknown,
): { roots: DeltaKey[]; nodes: [DeltaKey, FlatNode][] } | null {
  const nodes: [DeltaKey, FlatNode][] = [];
  const seen = new Set<DeltaKey>();
  const visit = (list: unknown[]): DeltaKey[] | null => {
    const keys: DeltaKey[] = [];
    for (const node of list) {
      if (!isRecord(node) || !Array.isArray(node['children'])) return null;
      const key = keyOf(node);
      if (!validKey(key) || seen.has(key)) return null;
      seen.add(key);
      const flat = { ...node, children: [] as DeltaKey[] } as FlatNode;
      nodes.push([key, flat]);
      const children = visit(node['children'] as unknown[]);
      if (!children) return null;
      flat.children = children;
      keys.push(key);
    }
    return keys;
  };
  const rootKeys = visit(roots);
  return rootKeys ? { roots: rootKeys, nodes } : null;
}

export interface DeltaSender {
  /**
   * The message for `report`: the report itself with a `delta` mark when
   * `full` or until the server confirmed a message, else what changed since
   * the last message. `changed` is false when nothing did.
   */
  next(
    report: Record<string, unknown>,
    full: boolean,
  ): { message: Record<string, unknown>; changed: boolean; full: boolean; seq: number };
  /** The server stored message `seq`; deltas may build on it when it is the latest. */
  confirm(seq: number): void;
  /** The server did not take the last message: the next one is full and counts as changed. */
  reset(): void;
  /** The server takes full reports only: keep sending them, still skipping unchanged ones. */
  fullOnly(): void;
  /** Whether the next message can be a delta. */
  readonly ready: boolean;
}

/** Builds the messages a page sends for one kind of report. */
export function createDeltaSender(shape: DeltaShape): DeltaSender {
  let fields = new Map<string, FieldState>();
  let keysJson = '';
  let seq = 0;
  let ready = false;

  const stateOf = (field: string, value: unknown): { state: FieldState; flat?: unknown } => {
    const listKey = shape.lists?.[field];
    if (listKey && Array.isArray(value)) {
      const keys = listKeys(value, listKey);
      if (keys) {
        const items = new Map<DeltaKey, string>();
        keys.forEach((key, i) => items.set(key, JSON.stringify(value[i])));
        return { state: { kind: 'list', order: JSON.stringify(keys), items }, flat: keys };
      }
    }
    const treeKey = shape.trees?.[field];
    if (treeKey && Array.isArray(value)) {
      const flat = flattenTree(value, treeKey);
      if (flat) {
        const nodes = new Map<DeltaKey, string>();
        for (const [key, node] of flat.nodes) nodes.set(key, JSON.stringify(node));
        return { state: { kind: 'tree', roots: JSON.stringify(flat.roots), nodes }, flat };
      }
    }
    if (shape.maps?.includes(field) && isRecord(value)) {
      const values = new Map<string, string>();
      const keys = Object.keys(value);
      for (const key of keys) values.set(key, JSON.stringify(value[key]));
      return { state: { kind: 'map', keys: JSON.stringify(keys), values } };
    }
    return { state: { kind: 'plain', json: JSON.stringify(value) ?? 'undefined' } };
  };

  return {
    get ready() {
      return ready;
    },
    confirm(confirmed) {
      if (confirmed === seq) ready = true;
    },
    reset() {
      ready = false;
      fields = new Map();
      keysJson = '';
    },
    fullOnly() {
      ready = false;
    },
    next(report, wantFull) {
      const keys = Object.keys(report).filter((key) => report[key] !== undefined);
      const nextFields = new Map<string, FieldState>();
      const delta: ReportDelta = { base: seq, seq: seq + 1 };
      let changed = false;
      const nextKeysJson = JSON.stringify(keys);
      if (nextKeysJson !== keysJson) {
        delta.keys = keys;
        changed = true;
      }
      for (const field of keys) {
        const value = report[field];
        const { state, flat } = stateOf(field, value);
        nextFields.set(field, state);
        const before = fields.get(field);
        const fresh = !before || before.kind !== state.kind;
        if (state.kind === 'plain') {
          if (fresh || (before as { json: string }).json !== state.json) {
            (delta.set ??= {})[field] = value;
            changed = true;
          }
        } else if (state.kind === 'list') {
          const old = fresh ? undefined : (before as Extract<FieldState, { kind: 'list' }>);
          const items = value as unknown[];
          const part: ListDelta = {};
          if (!old || old.order !== state.order) part.order = flat as DeltaKey[];
          const set: unknown[] = [];
          (flat as DeltaKey[]).forEach((key, i) => {
            if (old?.items.get(key) !== state.items.get(key)) set.push(items[i]);
          });
          if (set.length) part.set = set;
          if (part.order || part.set) {
            (delta.lists ??= {})[field] = part;
            changed = true;
          }
        } else if (state.kind === 'tree') {
          const old = fresh ? undefined : (before as Extract<FieldState, { kind: 'tree' }>);
          const tree = flat as { roots: DeltaKey[]; nodes: [DeltaKey, FlatNode][] };
          const part: TreeDelta = {};
          if (!old || old.roots !== state.roots) part.roots = tree.roots;
          const set = tree.nodes.filter(([key]) => old?.nodes.get(key) !== state.nodes.get(key));
          if (set.length) part.set = set;
          // A tree that lost nodes changes a parent or the roots, so pruning follows.
          if (part.roots || part.set) {
            (delta.trees ??= {})[field] = part;
            changed = true;
          }
        } else {
          const old = fresh ? undefined : (before as Extract<FieldState, { kind: 'map' }>);
          const record = value as Record<string, unknown>;
          const part: MapDelta = {};
          if (!old || old.keys !== state.keys) part.keys = Object.keys(record);
          for (const [key, json] of state.values) {
            if (old?.values.get(key) !== json) (part.set ??= {})[key] = record[key];
          }
          if (part.keys || part.set) {
            (delta.maps ??= {})[field] = part;
            changed = true;
          }
        }
      }
      fields = nextFields;
      keysJson = nextKeysJson;
      const full = wantFull || !ready;
      if (full) {
        seq += 1;
        ready = false;
        return {
          message: { ...report, delta: { full: true, seq } satisfies FullMark },
          changed,
          full: true,
          seq,
        };
      }
      if (!changed) {
        // An empty delta keeps the page alive on the server without moving the sequence.
        delta.seq = seq;
        return { message: { pageId: report['pageId'], delta }, changed, full, seq };
      }
      seq += 1;
      return { message: { pageId: report['pageId'], delta }, changed, full, seq };
    },
  };
}

/** The shapes of the reports pages send as deltas. */
export const COMPONENT_TREE_SHAPE: DeltaShape = {
  trees: { roots: (node) => node.id },
  lists: { deferBlocks: (block) => block.id, forBlocks: (block) => block.id },
};

export const INJECTOR_TREE_SHAPE: DeltaShape = {
  trees: {
    roots: (node) => node.injector?.id,
    environment: (node) => node.injector?.id,
  },
};

export const CHANGE_DETECTION_SHAPE: DeltaShape = {
  lists: { cycles: (cycle) => cycle.id },
  maps: ['hosts'],
};

export const FORMS_SHAPE: DeltaShape = {
  lists: { forms: (form) => form.id, events: (event) => event.seq },
};
