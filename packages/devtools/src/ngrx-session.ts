import { diff, TYPE_KEY, type NgrxDiffEntry } from './ngrx-shared.ts';

/**
 * Recorded NgRx sessions: one store's state and the entries that changed it,
 * as JSON that can be exported, imported back and turned into a test. A
 * session holds the serialized (redacted) state before its first entry and,
 * for each entry, the patches from the previous state to the next, so it
 * stays small: an entry costs what it changed, not a copy of the state.
 * Shared by the overlay (export) and the server (import, entry detail, test).
 */

export const SESSION_FORMAT = 'pangular-ngrx-session';
export const SESSION_VERSION = 1;
/** Most entries a session holds. */
export const MAX_SESSION_ENTRIES = 1000;
/** Most characters of session JSON an export writes or an import reads. */
export const MAX_SESSION_CHARS = 4_000_000;
/** Most patches one entry holds; past it the entry sets the whole state. */
export const MAX_ENTRY_PATCHES = 2000;
const MAX_PATH = 64;
const MAX_TYPE = 500;
/** How each recorded state is serialized: wider than the log's diff values, still bounded. */
export const SESSION_STATE = { depth: 12, maxKeys: 500, maxString: 5000, budget: 50_000 };
/** Most rows the Diff of one entry lists. */
export const MAX_DETAIL_DIFF = 500;

export type PatchKey = string | number;

export type NgrxPatch =
  { op: 'set'; path: PatchKey[]; value: unknown } | { op: 'delete'; path: PatchKey[] };

export type NgrxSessionStoreKind = 'store' | 'signal-store' | 'signal-state';

export interface NgrxSessionEntry {
  seq: number;
  type: string;
  timestamp: number;
  source: 'store' | 'signal-store';
  action?: unknown;
  args?: unknown[];
  origin?: string;
  causedByEvent?: { type: string; payload?: unknown };
  /** From the state after the previous entry (or `initialState`) to the state after this one. */
  changes: NgrxPatch[];
}

export interface NgrxSession {
  format: typeof SESSION_FORMAT;
  version: typeof SESSION_VERSION;
  exportedAt: number;
  page?: { url?: string; title?: string };
  store: { id: string; kind: NgrxSessionStoreKind; name?: string };
  initialState: unknown;
  entries: NgrxSessionEntry[];
}

/** The state before and after one entry, and the changes between them. */
export interface NgrxEntryDetail {
  seq: number;
  storeId: string;
  before: unknown;
  after: unknown;
  diff: NgrxDiffEntry[];
  /** Changes past {@link MAX_DETAIL_DIFF}. */
  diffTruncated?: number;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlain(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !Object.prototype.hasOwnProperty.call(value, TYPE_KEY)
  );
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    return a.length === y.length && a.every((item, i) => same(item, y[i]));
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return (
    keys.length === Object.keys(y).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(y, key) && same(x[key], y[key]))
  );
}

/**
 * The patches that turn the serialized state `before` into `after`. Objects
 * are compared key by key, arrays of the same length index by index; any
 * other change sets the value whole. Past `limit` patches it sets the root.
 */
export function patchesBetween(
  before: unknown,
  after: unknown,
  limit = MAX_ENTRY_PATCHES,
): NgrxPatch[] {
  const out: NgrxPatch[] = [];
  let overflow = false;
  const walk = (a: unknown, b: unknown, path: PatchKey[]) => {
    if (overflow || same(a, b)) return;
    if (out.length >= limit || path.length >= MAX_PATH) {
      overflow = out.length >= limit;
      if (!overflow) out.push({ op: 'set', path, value: b });
      return;
    }
    if (isPlain(a) && isPlain(b)) {
      for (const key of Object.keys(a)) {
        if (!Object.prototype.hasOwnProperty.call(b, key))
          out.push({ op: 'delete', path: [...path, key] });
      }
      for (const key of Object.keys(b)) {
        if (!Object.prototype.hasOwnProperty.call(a, key)) {
          out.push({ op: 'set', path: [...path, key], value: b[key] });
        } else walk(a[key], b[key], [...path, key]);
      }
      return;
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      for (let i = 0; i < a.length; i++) walk(a[i], b[i], [...path, i]);
      return;
    }
    out.push({ op: 'set', path, value: b });
  };
  walk(before, after, []);
  return overflow ? [{ op: 'set', path: [], value: after }] : out;
}

function copyOf(value: unknown): Record<PatchKey, unknown> | unknown[] {
  if (Array.isArray(value)) return [...value];
  if (isPlain(value)) return { ...value };
  return {};
}

/**
 * Why `patch` can't be applied to `state`, or null when it can. A list only
 * takes whole-number indexes up to its length: a string key (`length`) or an
 * index far past the end would make the copies below grow without bound.
 */
export function patchProblem(state: unknown, patch: NgrxPatch): string | null {
  let node = state;
  for (const key of patch.path) {
    if (Array.isArray(node)) {
      if (typeof key !== 'number') {
        return `a change uses the key \`${String(key).slice(0, 50)}\` on a list, which only takes indexes`;
      }
      if (key > node.length) {
        return `a change uses the index ${key} on a list of ${node.length} items`;
      }
      node = node[key];
    } else {
      node = isPlain(node) ? node[key] : undefined;
    }
  }
  return null;
}

/**
 * `state` with the patches applied, without changing it: each patch copies
 * only the containers on its path, so states share everything they did not change.
 * A patch {@link patchProblem} refuses is skipped.
 */
export function applyPatches(state: unknown, patches: readonly NgrxPatch[]): unknown {
  let root = state;
  for (const patch of patches) {
    if (patchProblem(root, patch)) continue;
    if (!patch.path.length) {
      root = patch.op === 'set' ? patch.value : undefined;
      continue;
    }
    const top = copyOf(root);
    let node = top as Record<PatchKey, unknown>;
    for (let i = 0; i < patch.path.length - 1; i++) {
      const key = patch.path[i];
      const next = copyOf(node[key]);
      node[key] = next;
      node = next as Record<PatchKey, unknown>;
    }
    const last = patch.path[patch.path.length - 1];
    if (patch.op === 'set') node[last] = patch.value;
    else if (Array.isArray(node) && typeof last === 'number') node.splice(last, 1);
    else delete node[last];
    root = top;
  }
  return root;
}

/** The state after each entry of a session, in order; shares structure between states. */
export function sessionStates(session: NgrxSession): unknown[] {
  const out: unknown[] = [];
  let state = session.initialState;
  for (const entry of session.entries) {
    state = applyPatches(state, entry.changes);
    out.push(state);
  }
  return out;
}

/** The detail of the entry `seq` in a session, rebuilt from its patches. */
export function sessionEntryDetail(session: NgrxSession, seq: number): NgrxEntryDetail | null {
  const states = sessionStates(session);
  const index = session.entries.findIndex((entry) => entry.seq === seq);
  if (index < 0) return null;
  const before = index ? states[index - 1] : session.initialState;
  return entryDetail(session.store.id, seq, before, states[index]);
}

/** Before, after and their diff, the State and Diff tabs of one entry. */
export function entryDetail(
  storeId: string,
  seq: number,
  before: unknown,
  after: unknown,
): NgrxEntryDetail {
  const overflow = { more: 0 };
  const changes = diff(before, after, MAX_DETAIL_DIFF, 12, overflow);
  return {
    seq,
    storeId,
    before,
    after,
    diff: changes,
    ...(overflow.more ? { diffTruncated: overflow.more } : {}),
  };
}

function isPatchKey(key: unknown): key is PatchKey {
  if (typeof key === 'number') return Number.isInteger(key) && key >= 0 && key < 1_000_000;
  return typeof key === 'string' && key.length <= 500 && !FORBIDDEN_KEYS.has(key);
}

function checkPatch(raw: unknown): NgrxPatch | string {
  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return 'a change is not an object';
  if (p['op'] !== 'set' && p['op'] !== 'delete') return 'a change has no `op` of set or delete';
  const path = p['path'];
  if (!Array.isArray(path) || path.length > MAX_PATH || !path.every(isPatchKey)) {
    return `a change has a \`path\` that is not a list of up to ${MAX_PATH} keys (\`__proto__\`, \`constructor\` and \`prototype\` are refused)`;
  }
  if (p['op'] === 'delete') return { op: 'delete', path: [...path] };
  if (!Object.prototype.hasOwnProperty.call(p, 'value')) return 'a `set` change has no `value`';
  return { op: 'set', path: [...path], value: p['value'] };
}

/** Whether a parsed JSON value holds a key that could reach a prototype once copied. */
function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 64) return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, depth + 1));
  return Object.keys(value).some(
    (key) =>
      key === '__proto__' || hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1),
  );
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

/**
 * A session from untrusted JSON (a file the user picked, an agent's
 * argument), checked field by field: the format and version, at most
 * {@link MAX_SESSION_ENTRIES} entries with increasing `seq`, and patches whose
 * paths cannot reach a prototype. Returns the problem as text when it is not one.
 */
export function parseSession(input: unknown): NgrxSession | string {
  let raw = input;
  if (typeof input === 'string') {
    if (input.length > MAX_SESSION_CHARS) {
      return `The session is larger than ${MAX_SESSION_CHARS.toLocaleString('en-US')} characters.`;
    }
    try {
      raw = JSON.parse(input);
    } catch {
      return 'The session is not valid JSON.';
    }
  } else {
    let size = 0;
    try {
      size = JSON.stringify(input ?? null).length;
    } catch {
      return 'The session must be plain JSON.';
    }
    if (size > MAX_SESSION_CHARS) {
      return `The session is larger than ${MAX_SESSION_CHARS.toLocaleString('en-US')} characters.`;
    }
  }
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'The session must be a JSON object.';
  if (s['format'] !== SESSION_FORMAT) {
    return `This is not a Pangular Inspector NgRx session (\`format\` must be "${SESSION_FORMAT}").`;
  }
  if (s['version'] !== SESSION_VERSION) {
    return `Only version ${SESSION_VERSION} sessions can be imported.`;
  }
  if (hasForbiddenKey(s)) return 'The session has a `__proto__` key, so it is refused.';
  const store = s['store'] as Record<string, unknown> | null;
  const kinds: NgrxSessionStoreKind[] = ['store', 'signal-store', 'signal-state'];
  if (
    !store ||
    typeof store !== 'object' ||
    typeof store['id'] !== 'string' ||
    !kinds.includes(store['kind'] as NgrxSessionStoreKind)
  ) {
    return 'The session needs `store` with an `id` and a `kind` (store, signal-store or signal-state).';
  }
  const list = s['entries'];
  if (!Array.isArray(list)) return 'The session needs an `entries` list.';
  if (list.length > MAX_SESSION_ENTRIES) {
    return `The session has more than ${MAX_SESSION_ENTRIES} entries.`;
  }
  const entries: NgrxSessionEntry[] = [];
  let last = -Infinity;
  let state = s['initialState'];
  for (const [i, item] of list.entries()) {
    const e = item as Record<string, unknown> | null;
    const where = `Entry ${i + 1}`;
    if (!e || typeof e !== 'object') return `${where} is not an object.`;
    const seq = e['seq'];
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq <= last) {
      return `${where} needs a whole \`seq\` larger than the one before.`;
    }
    last = seq;
    if (typeof e['type'] !== 'string' || !e['type']) return `${where} needs a \`type\`.`;
    if (!Array.isArray(e['changes']) || e['changes'].length > MAX_ENTRY_PATCHES) {
      return `${where} needs a \`changes\` list of at most ${MAX_ENTRY_PATCHES} changes.`;
    }
    const changes: NgrxPatch[] = [];
    for (const change of e['changes']) {
      const patch = checkPatch(change);
      if (typeof patch === 'string') return `${where}: ${patch}.`;
      // Checked against the state it applies to, so it can't grow a list without bound.
      const problem = patchProblem(state, patch);
      if (problem) return `${where}: ${problem}.`;
      state = applyPatches(state, [patch]);
      changes.push(patch);
    }
    const entry: NgrxSessionEntry = {
      seq,
      type: e['type'].slice(0, MAX_TYPE),
      timestamp: typeof e['timestamp'] === 'number' ? e['timestamp'] : 0,
      source: e['source'] === 'store' ? 'store' : 'signal-store',
      changes,
    };
    if (e['action'] !== undefined) entry.action = e['action'];
    if (Array.isArray(e['args'])) entry.args = e['args'].slice(0, 50);
    const origin = text(e['origin'], 20);
    if (origin) entry.origin = origin;
    const caused = e['causedByEvent'] as Record<string, unknown> | undefined;
    if (caused && typeof caused === 'object' && typeof caused['type'] === 'string') {
      entry.causedByEvent = {
        type: caused['type'].slice(0, MAX_TYPE),
        ...(caused['payload'] !== undefined ? { payload: caused['payload'] } : {}),
      };
    }
    entries.push(entry);
  }
  const page = s['page'] as Record<string, unknown> | undefined;
  return {
    format: SESSION_FORMAT,
    version: SESSION_VERSION,
    exportedAt: typeof s['exportedAt'] === 'number' ? s['exportedAt'] : 0,
    ...(page && typeof page === 'object'
      ? { page: { url: text(page['url'], 2000), title: text(page['title'], 200) } }
      : {}),
    store: {
      id: store['id'].slice(0, 100),
      kind: store['kind'] as NgrxSessionStoreKind,
      ...(typeof store['name'] === 'string' ? { name: store['name'].slice(0, 200) } : {}),
    },
    initialState: s['initialState'],
    entries,
  };
}

/** The part of a session from `from` to `to` (entry seqs, both included), rebased on the state before `from`. */
export function sliceSession(session: NgrxSession, from?: number, to?: number): NgrxSession {
  const states = sessionStates(session);
  const start = session.entries.findIndex((entry) => from === undefined || entry.seq >= from);
  if (start < 0) return { ...session, entries: [] };
  let end = session.entries.length;
  if (to !== undefined) {
    const after = session.entries.findIndex((entry) => entry.seq > to);
    if (after >= 0) end = after;
  }
  return {
    ...session,
    initialState: start ? states[start - 1] : session.initialState,
    entries: session.entries.slice(start, Math.max(start, end)),
  };
}

/** The JSON of a session, dropping the oldest entries until it fits {@link MAX_SESSION_CHARS}. */
export function sessionJson(session: NgrxSession): { json: string; dropped: number } {
  let current = session;
  let dropped = 0;
  for (;;) {
    const json = JSON.stringify(current);
    if (json.length <= MAX_SESSION_CHARS || !current.entries.length) return { json, dropped };
    const cut = Math.max(1, Math.ceil(current.entries.length / 4));
    current = sliceSession(current, current.entries[cut]?.seq ?? Infinity);
    dropped += cut;
  }
}

// --- Generated tests -------------------------------------------------------

/** The test runner the generated specs are written for. */
export const TEST_FRAMEWORK = 'Vitest';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MARKERS =
  /^\[(Truncated|Circular|Object|Array\(\d+\)|Map\(\d+\)|Set\(\d+\)|Unreadable|redacted)\]$|^\d+ more keys$|^\[\d+ more\]$/;

/** Whether a serialized value lost something (cut, redacted or unreadable) that a test would assert on. */
export function hasLossyMarkers(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (typeof value === 'string') return MARKERS.test(value) || value.endsWith('…');
  if (Array.isArray(value)) return value.some((item) => hasLossyMarkers(item, depth + 1));
  if (value && typeof value === 'object') {
    const typed = (value as Record<string, unknown>)[TYPE_KEY];
    if (typed === 'function' || typed === 'symbol' || typed === 'Element') return true;
    return Object.values(value).some((item) => hasLossyMarkers(item, depth + 1));
  }
  return false;
}

/** A string literal; U+2028 and U+2029 are escaped too, for tools older than ES2019. */
function literal(text: string): string {
  return JSON.stringify(text)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function keyCode(key: string): string {
  return IDENTIFIER.test(key) ? key : literal(key);
}

const REGEXP_SOURCE = /^\/([\s\S]+)\/([dgimsuvy]*)$/;

/**
 * A recorded RegExp as `new RegExp("source", "flags")`. The recorded text comes
 * from the page or an imported file, so it is never pasted into the code as is:
 * anything that isn't `/source/flags` with known, unrepeated flags becomes `undefined`.
 */
function regExpCode(value: unknown): string {
  const match = typeof value === 'string' ? REGEXP_SOURCE.exec(value) : null;
  const flags = match?.[2] ?? '';
  if (!match || new Set(flags).size !== flags.length) {
    return 'undefined /* a RegExp that could not be read */';
  }
  return `new RegExp(${literal(match[1])}, ${literal(flags)})`;
}

/** Source code for a serialized value, turning the serializer's markers back into values. */
export function toCode(value: unknown, indent = ''): string {
  const inner = `${indent}  `;
  if (value === null) return 'null';
  if (typeof value === 'string') return literal(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((item) => `${inner}${toCode(item, inner)},`).join('\n')}\n${indent}]`;
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    switch (v[TYPE_KEY]) {
      case 'undefined':
        return 'undefined';
      case 'number':
        return `Number(${JSON.stringify(String(v['value']))})`;
      case 'bigint':
        return `BigInt(${JSON.stringify(String(v['value']))})`;
      case 'Date':
        return `new Date(${JSON.stringify(String(v['value']))})`;
      case 'RegExp':
        return regExpCode(v['value']);
      case 'Map': {
        const entries = Array.isArray(v['entries']) ? v['entries'] : [];
        return `new Map(${toCode(entries, indent)})`;
      }
      case 'Set': {
        const values = Array.isArray(v['values']) ? v['values'] : [];
        return `new Set(${toCode(values, indent)})`;
      }
      case undefined:
        break;
      default:
        return `undefined /* ${JSON.stringify(v).slice(0, 80).replace(/\*\//g, '* /')} */`;
    }
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    return `{\n${keys.map((key) => `${inner}${keyCode(key)}: ${toCode(v[key], inner)},`).join('\n')}\n${indent}}`;
  }
  return 'undefined';
}

function camel(text: string): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const out = words
    .map((word, i) =>
      i ? word[0].toUpperCase() + word.slice(1) : word[0].toLowerCase() + word.slice(1),
    )
    .join('');
  return /^[A-Za-z_$]/.test(out) ? out : `store${out}`;
}

function kebab(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** The top-level state keys a range of entries changed, or `null` when one changed the root. */
function changedFeatures(entries: NgrxSessionEntry[]): Set<string> | null {
  const keys = new Set<string>();
  for (const entry of entries) {
    for (const change of entry.changes) {
      if (!change.path.length || typeof change.path[0] !== 'string') return null;
      keys.add(change.path[0]);
    }
  }
  return keys;
}

/** Text for a `//` comment: every line terminator (CR, LF, U+2028, U+2029) would end it. */
function comment(text: string): string {
  return text.replace(/\*\//g, '* /').replace(/[\r\n\u2028\u2029]+/g, ' ');
}

export interface GeneratedTest {
  framework: typeof TEST_FRAMEWORK;
  /** A suggested file name for the spec. */
  file: string;
  code: string;
  /** What the test leaves to the reader: imports to point, values that were cut. */
  notes: string[];
}

function header(session: NgrxSession, range: string, notes: string[]): string {
  const lines = [
    `// Generated by Pangular Inspector from a recorded NgRx session (${range}).`,
    `// Written for ${TEST_FRAMEWORK}; Jest runs it too once you drop the vitest import.`,
    ...notes.map((note) => `// ${comment(note)}`),
  ];
  if (session.page?.url) lines.splice(1, 0, `// Recorded on ${comment(session.page.url)}.`);
  return lines.join('\n');
}

/**
 * A spec that replays a range of recorded entries: the state before the
 * first one, the actions or method calls in order, and the state after the
 * last one as the expectation. An @ngrx/store session becomes a reducer spec
 * (for one feature when only one top-level key changed), a signal store
 * session a store spec through `TestBed`, `unprotected()` and `getState()`.
 */
export function generateTest(session: NgrxSession): GeneratedTest | string {
  const entries = session.entries;
  if (!entries.length) return 'The range holds no entries, so there is nothing to replay.';
  const states = sessionStates(session);
  const finalState = states[states.length - 1];
  const range =
    entries.length === 1
      ? `entry #${entries[0].seq}`
      : `entries #${entries[0].seq} to #${entries[entries.length - 1].seq}`;
  const notes: string[] = [];
  if (hasLossyMarkers(session.initialState) || hasLossyMarkers(finalState)) {
    notes.push(
      'Some recorded values were cut, redacted or unreadable (such as "[redacted]" or "[Truncated]"). Replace them before you trust this test.',
    );
  }
  return session.store.kind === 'store'
    ? reducerTest(session, range, notes, finalState)
    : signalStoreTest(session, range, notes, finalState, states);
}

function reducerTest(
  session: NgrxSession,
  range: string,
  notes: string[],
  finalState: unknown,
): GeneratedTest {
  const entries = session.entries;
  const features = changedFeatures(entries);
  const feature =
    features?.size === 1 && isPlain(session.initialState) && isPlain(finalState)
      ? [...features][0]
      : null;
  const skipped = entries.filter(
    (entry) => entry.action === undefined || /^Restore #|^Back to latest/.test(entry.type),
  );
  const replayed = entries.filter((entry) => !skipped.includes(entry));
  if (skipped.length) {
    notes.push(
      `Left out ${skipped.length} ${skipped.length === 1 ? 'entry' : 'entries'} that dispatched no action (a restore or back to latest): ${skipped.map((entry) => `#${entry.seq}`).join(', ')}. The expected state may need adjusting.`,
    );
  }
  const name = feature ? `${camel(feature)}Reducer` : 'reducers';
  const from = feature ? `./${kebab(feature)}.reducer` : './reducers';
  notes.push(
    feature
      ? `Only the \`${feature}\` slice changed, so this tests its reducer. Point the import at it.`
      : 'Point the import at the ActionReducerMap of your root state.',
  );
  const initial = feature
    ? (session.initialState as Record<string, unknown>)[feature]
    : session.initialState;
  const expected = feature ? (finalState as Record<string, unknown>)[feature] : finalState;
  const actions = replayed.map(
    (entry) => `    // #${entry.seq} ${comment(entry.type)}\n    ${toCode(entry.action, '    ')},`,
  );
  const imports = feature
    ? [`import { ${name} } from '${from}';`]
    : [`import { combineReducers } from '@ngrx/store';`, `import { ${name} } from '${from}';`];
  const reducer = feature ? name : `combineReducers(${name})`;
  const code = `${header(session, range, notes)}
import { describe, expect, it } from 'vitest';
${imports.join('\n')}

describe(${literal(`${feature ?? 'root state'} (${range})`)}, () => {
  it('reduces the recorded actions to the recorded state', () => {
    const initialState = ${toCode(initial, '    ')};
    const actions = [
${actions.join('\n')}
    ];

    const state = actions.reduce((current, action) => ${reducer}(current as never, action), initialState as never);

    expect(state).toEqual(${toCode(expected, '    ')});
  });
});
`;
  return {
    framework: TEST_FRAMEWORK,
    file: `${feature ? kebab(feature) : 'root'}.reducer.session.spec.ts`,
    code,
    notes,
  };
}

function signalStoreTest(
  session: NgrxSession,
  range: string,
  notes: string[],
  finalState: unknown,
  states: unknown[],
): GeneratedTest {
  const storeName =
    session.store.name && IDENTIFIER.test(session.store.name) ? session.store.name : 'Store';
  const isState = session.store.kind === 'signal-state';
  const steps: string[] = [];
  session.entries.forEach((entry, i) => {
    const label = `    // #${entry.seq} ${comment(entry.type)}`;
    const restore = /^Restore #/.test(entry.type);
    const call =
      !isState && !restore && entry.type !== 'patchState' && IDENTIFIER.test(entry.type)
        ? `store.${entry.type}(${(entry.args ?? []).map((arg) => toCode(arg, '    ')).join(', ')});`
        : null;
    if (call) {
      steps.push(`${label}\n    ${call}`);
      return;
    }
    // A write outside a method (or a restore) has no call to repeat: set what it changed.
    const before = i ? states[i - 1] : session.initialState;
    const after = states[i];
    const changed: Record<string, unknown> = {};
    if (isPlain(after)) {
      for (const key of Object.keys(after)) {
        if (!isPlain(before) || !same(before[key], after[key])) changed[key] = after[key];
      }
    }
    steps.push(
      `${label}\n    patchState(${isState ? 'state' : 'unprotected(store)'}, ${toCode(changed, '    ')});`,
    );
  });
  if (!isState) {
    notes.push(
      `Point the import at ${storeName}. A method that works asynchronously (an rxMethod with HTTP) needs its work flushed before the expectation.`,
    );
  }
  const code = isState
    ? `${header(session, range, notes)}
import { describe, expect, it } from 'vitest';
import { getState, patchState, signalState } from '@ngrx/signals';

describe('signalState (${range})', () => {
  it('reaches the recorded state', () => {
    const state = signalState(${toCode(session.initialState, '    ')});

${steps.join('\n')}

    expect(getState(state)).toEqual(${toCode(finalState, '    ')});
  });
});
`
    : `${header(session, range, notes)}
import { TestBed } from '@angular/core/testing';
import { getState, patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { describe, expect, it } from 'vitest';
import { ${storeName} } from './${kebab(storeName.replace(/Store$/, '')) || 'app'}.store';

describe('${storeName} (${range})', () => {
  it('reaches the recorded state', () => {
    TestBed.configureTestingModule({ providers: [${storeName}] });
    const store = TestBed.inject(${storeName});
    patchState(unprotected(store), ${toCode(session.initialState, '    ')});

${steps.join('\n')}

    expect(getState(store)).toEqual(${toCode(finalState, '    ')});
  });
});
`;
  return {
    framework: TEST_FRAMEWORK,
    file: `${kebab(storeName.replace(/Store$/, '')) || 'app'}.store.session.spec.ts`,
    code,
    notes,
  };
}
