/**
 * Reading the value levels the page sends for the component detail. A level
 * is `serialize()` output with `lazy` on: a nested container the page did not
 * read is `{ $collapsed: type, size }`, a cut array ends with `{ $more: n }`,
 * a cut object has a `$more` count, a Map is `{ $type: 'Map', size, entries }`
 * and a Set `{ $type: 'Set', size, values }`.
 */

export type ContainerKind = 'array' | 'object' | 'map' | 'set';

export interface ValueContainer {
  kind: ContainerKind;
  /** Class name, or Object, Array, Map, Set. */
  type: string;
  /** Entries in the app, listed or not. */
  size: number;
  /** The page did not read inside it yet. */
  collapsed: boolean;
}

export interface ValueChild {
  /** Path segment: key, array index, or entry index of a Map or Set. */
  key: string;
  /** What the row shows: the key, the index, or a Map entry's key. */
  label: string;
  value: unknown;
}

/** Entries the panel asks for at a time when the user loads more. */
export const LOAD_STEP = 100;
/** Most entries one level can list. */
export const MAX_LIMIT = 1000;
/** Entries the page lists per level unless asked for more. */
export const FIRST_LIMIT = 30;
/** How deep and wide the panel reads a value to edit it whole (`EDIT_LEVEL` on the page). */
export const EDIT_READ = { depth: 5, limit: 100 } as const;

const REDACTED = '[redacted]';

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isMore(value: unknown): value is { $more: number } {
  return isObj(value) && typeof value['$more'] === 'number' && Object.keys(value).length === 1;
}

function isCollapsed(value: unknown): value is { $collapsed: string; size: number } {
  return (
    isObj(value) &&
    typeof value['$collapsed'] === 'string' &&
    typeof value['size'] === 'number' &&
    Object.keys(value).length === 2
  );
}

function kindOf(type: string): ContainerKind {
  if (type === 'Array') return 'array';
  if (type === 'Map') return 'map';
  if (type === 'Set') return 'set';
  return 'object';
}

function isMap(value: Obj): boolean {
  return value['$type'] === 'Map' && Array.isArray(value['entries']);
}

function isSet(value: Obj): boolean {
  return value['$type'] === 'Set' && Array.isArray(value['values']);
}

function objectKeys(value: Obj): string[] {
  return Object.keys(value).filter((key) => key !== '$type' && key !== '$more');
}

/** The container a value is, or `null` for a leaf (text, numbers, empty containers, markers). */
export function containerOf(value: unknown): ValueContainer | null {
  if (!value || typeof value !== 'object') return null;
  if (isCollapsed(value)) {
    if (value.size <= 0) return null;
    return {
      kind: kindOf(value.$collapsed),
      type: value.$collapsed,
      size: value.size,
      collapsed: true,
    };
  }
  if (isMore(value)) return null;
  if (Array.isArray(value)) {
    const last = value.at(-1);
    const more = isMore(last) ? last.$more : 0;
    const size = value.length - (more ? 1 : 0) + more;
    return size ? { kind: 'array', type: 'Array', size, collapsed: false } : null;
  }
  const obj = value as Obj;
  if (isMap(obj) || isSet(obj)) {
    const size = typeof obj['size'] === 'number' ? obj['size'] : 0;
    const kind = isMap(obj) ? 'map' : 'set';
    return size ? { kind, type: kind === 'map' ? 'Map' : 'Set', size, collapsed: false } : null;
  }
  const more = typeof obj['$more'] === 'number' ? obj['$more'] : 0;
  const size = objectKeys(obj).length + more;
  const type = typeof obj['$type'] === 'string' ? obj['$type'] : 'Object';
  return size ? { kind: 'object', type, size, collapsed: false } : null;
}

function keyText(key: unknown): string {
  if (typeof key === 'string') return JSON.stringify(key);
  const inner = containerOf(key);
  if (inner) return summary(inner);
  try {
    return JSON.stringify(key) ?? String(key);
  } catch {
    return String(key);
  }
}

/** The listed entries of a level that the page read, and how many it left out. */
export function childrenOf(value: unknown): { children: ValueChild[]; more: number } {
  const container = containerOf(value);
  if (!container || container.collapsed) return { children: [], more: 0 };
  if (Array.isArray(value)) {
    const items = isMore(value.at(-1)) ? value.slice(0, -1) : value;
    const children = items.map((item, i) => ({ key: String(i), label: String(i), value: item }));
    return { children, more: container.size - children.length };
  }
  const obj = value as Obj;
  if (container.kind === 'map') {
    const entries = obj['entries'] as unknown[];
    const children = entries.map((entry, i) => {
      const [key, item] = Array.isArray(entry) ? entry : [undefined, entry];
      return { key: String(i), label: keyText(key), value: item };
    });
    return { children, more: Math.max(0, container.size - children.length) };
  }
  if (container.kind === 'set') {
    const values = obj['values'] as unknown[];
    const children = values.map((item, i) => ({ key: String(i), label: String(i), value: item }));
    return { children, more: Math.max(0, container.size - children.length) };
  }
  const children = objectKeys(obj).map((key) => ({ key, label: key, value: obj[key] }));
  return { children, more: typeof obj['$more'] === 'number' ? obj['$more'] : 0 };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** `Array (4 items)`, `Address (2 keys)`, `Map (1 entry)`. */
export function summary(container: ValueContainer): string {
  const count = {
    array: plural(container.size, 'item', 'items'),
    object: plural(container.size, 'key', 'keys'),
    map: plural(container.size, 'entry', 'entries'),
    set: plural(container.size, 'value', 'values'),
  }[container.kind];
  return `${container.type} (${count})`;
}

/** The key of a level, the same as `valuePathKey()` on the page. */
export function pathKey(path: readonly string[], directive?: number): string {
  return JSON.stringify(directive === undefined ? path : [directive, ...path]);
}

/** `user.name`, `items[0].title`, for labels. */
export function shownPath(path: readonly string[], kinds?: readonly ContainerKind[]): string {
  return path
    .map((key, i) => {
      if (i === 0) return key;
      const indexed = kinds ? kinds[i - 1] !== 'object' : /^\d+$/.test(key);
      return indexed ? `[${key}]` : `.${key}`;
    })
    .join('');
}

/**
 * The path a write takes (`user.name`, `items.0.title`), or `null` when a key
 * cannot be written as one (it has a dot, a bracket or edge spaces).
 */
export function editPath(path: readonly string[]): string | null {
  const ok = path.every((key) => key && key === key.trim() && !/[.[\]]/.test(key));
  return ok ? path.join('.') : null;
}

const MARKER_TEXT = /^\[(Getter|Unreadable|Circular|Truncated|Function\b.*|Promise)\]$/;

/** Whether a leaf holds a JSON value the panel can offer to replace. */
export function editableLeaf(value: unknown): boolean {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  // Text the page clipped ends with an ellipsis; editing it would drop the tail.
  return value !== REDACTED && !MARKER_TEXT.test(value) && !value.endsWith('…');
}

/**
 * The write that can reach inside `container`, given the one that reached
 * it: a signal is set to a copy, which needs plain objects and arrays; a
 * property is written in place, which a Map or Set entry cannot be.
 */
export function editInto(
  kind: 'property' | 'signal' | null,
  container: ValueContainer,
): 'property' | 'signal' | null {
  if (!kind || container.kind === 'map' || container.kind === 'set') return null;
  if (kind === 'signal' && container.kind === 'object' && container.type !== 'Object') return null;
  return kind;
}

/**
 * Paths below `root` whose key contains `query`, among the levels already
 * loaded: the first level the detail carries and the ones `levelAt` returns.
 */
export function nestedMatches(
  root: readonly string[],
  value: unknown,
  levelAt: (path: readonly string[]) => unknown,
  query: string,
  limit = 500,
): string[][] {
  const out: string[][] = [];
  const needle = query.trim().toLowerCase();
  if (!needle) return out;
  const seen = new Set<string>();
  const walk = (path: readonly string[], level: unknown) => {
    const key = pathKey(path);
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    for (const child of childrenOf(level).children) {
      const at = [...path, child.key];
      if (child.label.toLowerCase().includes(needle)) out.push(at);
      if (!containerOf(child.value)) continue;
      const loaded = levelAt(at) ?? (containerOf(child.value)?.collapsed ? undefined : child.value);
      if (loaded !== undefined) walk(at, loaded);
    }
  };
  walk(root, levelAt(root) ?? value);
  return out;
}
