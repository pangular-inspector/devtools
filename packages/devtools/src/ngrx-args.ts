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

/** The string and number leaves under secret-named keys in `value`, up to a small budget. */
function secretLeaves(value: unknown, under: boolean, out: Set<string>, budget: { n: number }) {
  if (--budget.n < 0) return;
  if (typeof value === 'string' || typeof value === 'number') {
    if (under && String(value).length >= 3) out.add(String(value));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const entries = read(
    () =>
      value instanceof Map
        ? [...value.entries()].map(([k, v]) => [String(k), v] as const)
        : Object.entries(value),
    [] as (readonly [string, unknown])[],
  );
  for (const [key, child] of entries) {
    secretLeaves(child, under || isRedactedKey(key), out, budget);
  }
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
    const now = new Set<string>();
    const was = new Set<string>();
    secretLeaves(after[key], false, now, { n: MAX_WALK });
    secretLeaves(before[key], false, was, { n: MAX_WALK });
    if (now.size !== was.size || [...now].some((value) => !was.has(value))) return true;
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
