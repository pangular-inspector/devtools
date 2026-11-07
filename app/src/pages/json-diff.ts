/** One difference between two JSON values, at a path such as `items[2].name`. */
export interface JsonDiffEntry {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
}

/** Most entries one diff lists; the rest are counted in a last `…` entry. */
export const MAX_DIFF_ENTRIES = 50;
const MAX_DEPTH = 8;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function key(path: string, name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name)
    ? path
      ? `${path}.${name}`
      : name
    : `${path}[${JSON.stringify(name)}]`;
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * The differences between two JSON values (the serialized history entries
 * of a signal), deepest first by path order: keys and items added, removed or
 * changed. Objects and arrays are compared member by member; anything else
 * as a whole. Past {@link MAX_DIFF_ENTRIES} entries the rest are summed up in
 * one last entry with the path `…`.
 */
export function jsonDiff(before: unknown, after: unknown): JsonDiffEntry[] {
  const out: JsonDiffEntry[] = [];
  let more = 0;
  const push = (entry: JsonDiffEntry) => {
    if (out.length < MAX_DIFF_ENTRIES) out.push(entry);
    else more++;
  };
  const walk = (a: unknown, b: unknown, path: string, depth: number) => {
    if (same(a, b)) return;
    if (depth < MAX_DEPTH && Array.isArray(a) && Array.isArray(b)) {
      const length = Math.max(a.length, b.length);
      for (let i = 0; i < length; i++) {
        const at = `${path}[${i}]`;
        if (i >= a.length) push({ path: at, kind: 'added', after: b[i] });
        else if (i >= b.length) push({ path: at, kind: 'removed', before: a[i] });
        else walk(a[i], b[i], at, depth + 1);
      }
      return;
    }
    if (depth < MAX_DEPTH && isObject(a) && isObject(b)) {
      for (const name of Object.keys(a)) {
        const at = key(path, name);
        if (!(name in b)) push({ path: at, kind: 'removed', before: a[name] });
        else walk(a[name], b[name], at, depth + 1);
      }
      for (const name of Object.keys(b)) {
        if (!(name in a)) push({ path: key(path, name), kind: 'added', after: b[name] });
      }
      return;
    }
    push({ path: path || '(value)', kind: 'changed', before: a, after: b });
  };
  walk(before, after, '', 0);
  if (more) out.push({ path: '…', kind: 'changed', after: `${more} more changes` });
  return out;
}
