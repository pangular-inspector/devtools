export type NgrxKind =
  | 'action'
  | 'reducer'
  | 'effect'
  | 'selector'
  | 'feature'
  | 'store-setup'
  | 'signal-store'
  | 'signal-state'
  | 'signal-method';

export interface NgrxStoreEntry {
  name: string;
  kind: NgrxKind;
  file: string;
  line: number;
  detail?: string;
  types?: string[];
}

/**
 * `selectedId` is set once the app's `selectedId` state field holds a non-null value.
 * `selected` is only set when that id resolves to an entity in the collection, so a
 * stale/dangling id shows `selectedId` without `selected`.
 */
export interface NgrxEntitiesInfo {
  collection?: string;
  idsKey: string;
  entityMapKey: string;
  entitiesKey?: string;
  ids: (string | number)[];
  count: number;
  selectedIdKey?: string;
  selectedId?: unknown;
  selected?: unknown;
}

export interface NgrxSignalStoreInfo {
  id: string;
  kind: 'signal-store' | 'signal-state';
  className: string;
  name?: string;
  declaredIn?: string;
  scope: string;
  stateKeys: string[];
  state: Record<string, unknown>;
  computed: Record<string, unknown>;
  /** `withEntities()` collections found in `state`/`computed`. See the collector for details. */
  entities?: NgrxEntitiesInfo[];
  /**
   * `lastDurationMs`/`avgDurationMs` are the wall-clock time of the synchronous method call
   * only (see {@link NgrxLogEntry.durationMs}), present only once the method has been called
   * at least once with measurable timing.
   */
  methods: {
    name: string;
    calls: number;
    rx?: boolean;
    signalMethod?: boolean;
    lastDurationMs?: number;
    avgDurationMs?: number;
  }[];
  references: string[];
  writable: boolean;
}

export interface NgrxClassicStoreInfo {
  state: unknown;
  devtools: boolean;
  scope: string;
  paused?: boolean;
}

export interface NgrxDiffEntry {
  path: string;
  op: 'add' | 'remove' | 'change';
  before?: unknown;
  after?: unknown;
}

export type NgrxActionOrigin = 'dispatch' | 'effect' | 'reactive';

export interface NgrxLogEntry {
  seq: number;
  source: 'signal-store' | 'store' | 'event';
  storeId: string;
  type: string;
  args?: unknown[];
  action?: unknown;
  origin?: NgrxActionOrigin;
  timestamp: number;
  diff: NgrxDiffEntry[];
  restorable: boolean;
  /**
   * Set only for an entry produced by a wrapped `signalStore`/`signalState` method call
   * (never a plain `patchState`/signal-write entry, a classic-store action entry or an
   * event entry). How long the synchronous call took to return.
   */
  durationMs?: number;
  /** `source: 'event'` only: the dispatched `@ngrx/signals/events` event's type and payload. */
  eventType?: string;
  payload?: unknown;
  /** `source: 'signal-store'` only: the event that this state change was correlated with. */
  causedByEvent?: { type: string; payload?: unknown };
  unrestorable?: 'dropped' | 'not-recorded';
}

export interface NgrxPage {
  pageId: string;
  url: string;
  title: string;
  stores: NgrxSignalStoreInfo[];
  classic: NgrxClassicStoreInfo | null;
  log: NgrxLogEntry[];
  dropped?: number;
  reportedAt: number;
}

export interface NgrxState {
  pages: NgrxPage[];
}

export interface LiveStore {
  id: string;
  label: string;
  kind: 'signal-store' | 'signal-state' | 'store';
  scope: string;
  signal?: NgrxSignalStoreInfo;
  classic?: NgrxClassicStoreInfo;
}

const TYPE = '@type';

const TAGS = new Set([
  'undefined',
  'number',
  'bigint',
  'symbol',
  'function',
  'Date',
  'RegExp',
  'Error',
  'Element',
  'Map',
  'Set',
]);

function tagged(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    TYPE in value &&
    TAGS.has((value as Record<string, unknown>)[TYPE] as string)
  );
}

function key(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

export function pretty(value: unknown, indent = ''): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value !== 'object') return String(value);
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((v) => inner + pretty(v, inner)).join(',\n')}\n${indent}]`;
  }
  if (tagged(value)) {
    const v = value as Record<string, any>;
    switch (v[TYPE]) {
      case 'undefined':
        return 'undefined';
      case 'Date':
        return `Date(${v['value']})`;
      case 'bigint':
        return `${v['value']}n`;
      case 'symbol':
        return `Symbol(${v['value']})`;
      case 'function':
        return `ƒ ${v['name']}()`;
      case 'Error':
        return `${v['name'] ?? 'Error'}: ${v['message']}`;
      case 'Element':
        return `<${v['value']}>`;
      case 'Map': {
        const entries = (v['entries'] ?? []) as [unknown, unknown][];
        if (!entries.length) return `Map(${v['size']}) {}`;
        const lines = entries.map(
          ([k, val]) => `${inner}${pretty(k, inner)} => ${pretty(val, inner)}`,
        );
        return `Map(${v['size']}) {\n${lines.join(',\n')}\n${indent}}`;
      }
      case 'Set': {
        const values = (v['values'] ?? []) as unknown[];
        if (!values.length) return `Set(${v['size']}) {}`;
        return `Set(${v['size']}) {\n${values.map((x) => inner + pretty(x, inner)).join(',\n')}\n${indent}}`;
      }
      default:
        return String(v['value'] ?? v[TYPE]);
    }
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${inner}${key(k)}: ${pretty(v, inner)}`).join(',\n')}\n${indent}}`;
}

export function short(value: unknown, max = 120): string {
  const text = pretty(value).replace(/\s*\n\s*/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
