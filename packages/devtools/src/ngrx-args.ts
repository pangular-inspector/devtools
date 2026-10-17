import { isRedactedKey, REDACTED, redactMessage } from './forms-privacy.ts';

/**
 * Masking for the arguments of a signal store method call in the change log,
 * so `rotate(token)` or `login(email, password)` can't show what the state
 * hides. Safe by default:
 *
 * - a call whose write touches a secret-named state key (`accessToken`, or a
 *   nested `auth.refreshToken`) masks every argument;
 * - otherwise an argument whose parameter name is secret (`password` in
 *   `login(email, password)`, or a destructured `{ token }`) is masked;
 * - any other argument has the values the store holds under secret keys cut
 *   out, on top of the text rules `serialize` applies (JWTs, bearer tokens,
 *   credentials, secret `key=value` pairs);
 * - once a method wrote a secret, its arguments stay masked on every later call,
 *   and the entries of the call that wrote it are masked after the fact.
 */

type Snapshot = Record<PropertyKey, unknown>;

const MAX_PARAMS = 20;
const MAX_SOURCE = 2000;
const MAX_WALK = 200;
const IDENT = /[A-Za-z_$][\w$]*/g;

const params = new WeakMap<object, (string | null)[]>();

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Splits a parameter list on its top-level commas. */
function splitTopLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((part) => part.trim()).filter(Boolean);
}

/** The text between a function's parameter parentheses, or its single arrow parameter. */
function parameterList(source: string): string | null {
  const arrow = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(source);
  if (arrow) return arrow[1];
  const open = source.indexOf('(');
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  return null;
}

/**
 * Per position, the name of each parameter of `fn` that is secret (a plain
 * `password`, or a destructured or defaulted one holding a secret name), or
 * null. Read once per function from its source; an unreadable one gives [].
 */
export function secretParams(fn: unknown): (string | null)[] {
  if (typeof fn !== 'function') return [];
  const cached = params.get(fn);
  if (cached) return cached;
  const source = read(() => Function.prototype.toString.call(fn).slice(0, MAX_SOURCE), '');
  const list = parameterList(source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''));
  const found = (list === null ? [] : splitTopLevel(list).slice(0, MAX_PARAMS)).map((param) => {
    // Only the binding side: `token = DEFAULT_TOKEN` or `{ a: password }` count, string defaults don't.
    const binding = param.replace(/^\.\.\./, '').split('=')[0];
    const names = binding.match(IDENT) ?? [];
    return names.find((name) => isRedactedKey(name)) ?? null;
  });
  params.set(fn, found);
  return found;
}

/** The entries `secretLeaves` walks: a Map's with string keys, or an object's own. */
function entriesOf(value: object): (readonly [string, unknown])[] {
  return read(
    () =>
      value instanceof Map
        ? [...value.entries()].map(([k, v]) => [String(k), v] as const)
        : Object.entries(value),
    [] as (readonly [string, unknown])[],
  );
}

/** The string and number leaves under secret-named keys in `value`, up to a small budget. */
function secretLeaves(value: unknown, under: boolean, out: Set<string>, budget: { n: number }) {
  if (--budget.n < 0) return;
  if (typeof value === 'string' || typeof value === 'number') {
    if (under && String(value).length >= 3) out.add(String(value));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of entriesOf(value)) {
    secretLeaves(child, under || isRedactedKey(key), out, budget);
  }
}

/** An array whose own enumerable keys are exactly its indexes: no holes, no extra fields. */
function dense(list: unknown[]): boolean {
  return read(() => Object.keys(list).length === list.length, false);
}

function differ(a: Set<string>, b: Set<string>): boolean {
  return a.size !== b.size || [...a].some((value) => !b.has(value));
}

/**
 * Whether the secret leaves of `before` and `after` differ at any path,
 * walking both side by side and skipping what is the same value on both
 * sides (an untouched item of a store's list): its leaves are the same. A
 * secret moved from one path to another counts as a change, so this answers
 * yes at least whenever the full walk would. Null when the walk would pass
 * `budget` nodes; the caller then falls back to the bounded full walk.
 */
function secretsDiffer(
  before: unknown,
  after: unknown,
  under: boolean,
  budget: { n: number },
): boolean | null {
  if (Object.is(before, after)) return false;
  if (--budget.n < 0) return null;
  const containers = !!before && typeof before === 'object' && !!after && typeof after === 'object';
  if (!containers) {
    const now = new Set<string>();
    const was = new Set<string>();
    secretLeaves(after, under, now, budget);
    secretLeaves(before, under, was, budget);
    return budget.n < 0 ? null : differ(now, was);
  }
  if (Array.isArray(before) && Array.isArray(after) && dense(before) && dense(after)) {
    // The same entries as below, by index, without building them.
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      const changed = secretsDiffer(before[i], after[i], under || isRedactedKey(String(i)), budget);
      if (changed !== false) return changed;
    }
    return false;
  }
  const old = entriesOf(before);
  const was = new Map(old);
  const now = entriesOf(after);
  // Two Map keys with the same text (`1` and `'1'`) can't be paired by path.
  if (was.size !== old.length || new Map(now).size !== now.length) return null;
  for (const [key, child] of now) {
    const secret = under || isRedactedKey(key);
    const changed = secretsDiffer(was.has(key) ? was.get(key) : undefined, child, secret, budget);
    if (changed !== false) return changed;
    was.delete(key);
  }
  for (const [key, child] of was) {
    const changed = secretsDiffer(child, undefined, under || isRedactedKey(key), budget);
    if (changed !== false) return changed;
  }
  return false;
}

/**
 * Whether a call wrote under a secret-named state key, top level
 * (`accessToken`) or nested (`auth.refreshToken`), between `before` and `after`.
 */
export function touchesSecret(
  before: Snapshot,
  after: Snapshot,
  keys: readonly PropertyKey[],
): boolean {
  for (const key of keys) {
    if (before[key] === after[key]) continue;
    if (typeof key === 'string' && isRedactedKey(key)) return true;
    const quick = read(
      () => secretsDiffer(before[key], after[key], false, { n: MAX_WALK * 2 }),
      null,
    );
    if (quick === true) return true;
    if (quick === false) continue;
    const now = new Set<string>();
    const was = new Set<string>();
    secretLeaves(after[key], false, now, { n: MAX_WALK });
    secretLeaves(before[key], false, was, { n: MAX_WALK });
    if (differ(now, was)) return true;
  }
  return false;
}

/** The values the store holds under secret-named keys, in either snapshot. */
export function stateSecrets(snapshots: readonly Snapshot[], keys: readonly PropertyKey[]) {
  const out = new Set<string>();
  const budget = { n: MAX_WALK * 2 };
  for (const snapshot of snapshots) {
    for (const key of keys) {
      secretLeaves(snapshot[key], typeof key === 'string' && isRedactedKey(key), out, budget);
    }
  }
  return out;
}

function redactLeaves(value: unknown, secrets: Set<string>, depth = 0): unknown {
  if (typeof value === 'string') {
    return secrets.has(value) ? REDACTED : redactMessage(value, secrets);
  }
  if (typeof value === 'number') return secrets.has(String(value)) ? REDACTED : value;
  if (!value || typeof value !== 'object' || depth > 10) return value;
  if (Array.isArray(value)) return value.map((item) => redactLeaves(item, secrets, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactLeaves(item, secrets, depth + 1)]),
  );
}

/** Methods seen writing a secret; their arguments are masked on every later call too. */
const secretWriters = new WeakSet<object>();

/**
 * The logged form of a method call's arguments: each one serialized by
 * `serialize`, then masked by the rules above. Pass the snapshots around the
 * write the entry shows; a call that touched a secret marks `method`, so its
 * later calls are masked before they write anything.
 */
export function safeArgs(
  args: readonly unknown[],
  serialize: (value: unknown) => unknown,
  options: {
    method?: unknown;
    before?: Snapshot;
    after?: Snapshot;
    keys?: readonly PropertyKey[];
  } = {},
): unknown[] {
  const { method, before, after, keys = [] } = options;
  const writer = typeof method === 'function' || (typeof method === 'object' && !!method);
  if (before && after && touchesSecret(before, after, keys)) {
    if (writer) secretWriters.add(method as object);
    return args.map(() => REDACTED);
  }
  if (writer && secretWriters.has(method as object)) return args.map(() => REDACTED);
  const secret = secretParams(method);
  const known = stateSecrets(
    [before, after].filter((s): s is Snapshot => !!s),
    keys,
  );
  return args.map((arg, i) => {
    if (secret[i]) return REDACTED;
    const safe = serialize(arg);
    return known.size ? redactLeaves(safe, known) : safe;
  });
}

/** Whether `method` was seen writing a secret, so its logged arguments are all masked. */
export function writesSecret(method: unknown): boolean {
  return (
    (typeof method === 'function' || (typeof method === 'object' && !!method)) &&
    secretWriters.has(method as object)
  );
}

/** Records that `method` wrote a secret. */
export function markSecretWriter(method: unknown) {
  if (typeof method === 'function' || (typeof method === 'object' && !!method)) {
    secretWriters.add(method as object);
  }
}
