import { isRedactedKey, REDACTED, redactMessage } from './forms-privacy.ts';
import { redactText } from './serialize.ts';
import { clip, overflowKey } from './text.ts';
import type { NgrxEntryDetail, NgrxSession } from './ngrx-session.ts';

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
  /**
   * `withEntities()` collections found in `state`/`computed`. `withEntities()` is
   * `withState({ entityMap, ids })` (or `${collection}EntityMap`/`${collection}Ids`)
   * plus a computed `entities` selector, so this is a summary of data already in
   * `state`/`computed`, not a new capability. `selectedId`/`selected` are a best-effort
   * read of a common app convention (a plain `selectedId` state field), not a real
   * @ngrx/signals API. `selectedId` is set once that state field holds a non-null value;
   * `selected` is only set when that id resolves to an entity in the collection, so a
   * stale/dangling id shows `selectedId` without `selected`.
   */
  entities?: {
    collection?: string;
    idsKey: string;
    entityMapKey: string;
    entitiesKey?: string;
    ids: (string | number)[];
    count: number;
    selectedIdKey?: string;
    selectedId?: unknown;
    selected?: unknown;
  }[];
  /**
   * `lastDurationMs`/`avgDurationMs` are the wall-clock time of the synchronous method
   * call only (see {@link NgrxLogEntry.durationMs}), not any async work the call started.
   * `avgDurationMs` is a running average across every call, not a percentile.
   *
   * `rx`/`signalMethod` label the member so the panel and agent tools can tell
   * `rxMethod` apart from `signalMethod` — both attach a `.destroy` to the
   * returned callable, so the runtime cannot distinguish them. The source
   * scan does, and `nameStore()` propagates the label once it matches a store
   * to its declaring file.
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
  /**
   * The store uses `withDevtools()` (`@angular-architects/ngrx-toolkit`), so the
   * collector leaves it as it is: no wrapped methods or signals, only
   * `watchState()` (or a compare on each collect when `watchState` is not
   * registered). Method calls are then not counted or named in the log.
   */
  watchOnly?: true;
}

export interface NgrxClassicStoreInfo {
  state: unknown;
  devtools: boolean;
  scope: string;
  /** Store DevTools shows a past state (time travel), not the latest. */
  paused?: boolean;
  /** Store DevTools recording is paused (`pauseRecording`): new actions are not recorded. */
  recordingPaused?: true;
  /** Log entries whose actions Store DevTools skips (`toggleAction`), so the state is computed without them. */
  skipped?: number[];
}

export interface NgrxDiffEntry {
  path: string;
  op: 'add' | 'remove' | 'change';
  before?: unknown;
  after?: unknown;
}

export type NgrxActionOrigin = 'dispatch' | 'effect' | 'reactive';

/** Why Store DevTools cannot restore an @ngrx/store entry: it no longer holds the action (dropped past `maxAge`, or the history was committed, reset or imported), or never recorded it. */
export type NgrxUnrestorable = 'dropped' | 'not-recorded';

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
   * Set only for an entry produced inside a wrapped `signalStore` method call, never for
   * a plain `patchState` write or a restore. Without `watchState` registered it is how
   * long the synchronous call took to return; with it, the time from the start of the
   * method to that patch. Neither covers async work the method started.
   */
  durationMs?: number;
  /** `source: 'event'` only: the dispatched `@ngrx/signals/events` event's type and payload. */
  eventType?: string;
  payload?: unknown;
  /**
   * `source: 'signal-store'` only: set when a `withReducer()` case reducer patched this
   * store's state synchronously while handling this event. There is no way to recover
   * which case reducer matched (it is a closure), so this only correlates at the store
   * level, not the specific reducer.
   */
  causedByEvent?: { type: string; payload?: unknown };
  unrestorable?: NgrxUnrestorable;
  /**
   * How many more changes the state went through than `diff` holds (it keeps at most
   * 50). Counted up to {@link NGRX_DIFF_MORE_CAP}, so at the cap it is a lower bound.
   * Absent when `diff` is complete.
   */
  diffTruncated?: number;
  /**
   * With `ngrx.trace` on: the app frames of the call that made this entry
   * (the dispatch, the method call or the `patchState`), as
   * `name (file:line:column)` with origins and query strings removed and the
   * redaction helpers applied. Absent when tracing is off or no app frame was found.
   */
  trace?: string[];
}

/** App frames kept per entry with `ngrx.trace` on. */
export const NGRX_TRACE_FRAMES = 8;

/**
 * How often one action type, method or event ran since the page loaded, not
 * only within the kept log. `burst` is the most entries seen within any
 * {@link NGRX_BURST_WINDOW_MS}; `loop` flags a type an NgRx effect dispatched
 * at least {@link NGRX_LOOP_BURST} times within that window.
 */
export interface NgrxActionStat {
  source: NgrxLogEntry['source'];
  storeId: string;
  type: string;
  count: number;
  /** Entries with a `durationMs` (signal store method calls), and their average and longest. */
  timed?: number;
  avgMs?: number;
  maxMs?: number;
  /** Entries an NgRx effect dispatched (`origin: 'effect'`). */
  effects?: number;
  lastAt: number;
  burst: number;
  loop?: true;
}

export const NGRX_BURST_WINDOW_MS = 1000;
export const NGRX_LOOP_BURST = 20;
/** Most action stats a page keeps and reports. */
export const NGRX_MAX_STATS = 100;

/** The most changes counted past a full `diff`; `diffTruncated` stops there. */
export const NGRX_DIFF_MORE_CAP = 1000;

/** "12 more changes not shown", or "1000+ more…" at the cap. */
export function moreChangesText(count: number): string {
  const n = count >= NGRX_DIFF_MORE_CAP ? `${NGRX_DIFF_MORE_CAP}+` : String(count);
  return `${n} more ${count === 1 ? 'change' : 'changes'} not shown`;
}

/**
 * Counts the changes `diff` and `referenceDiff` find past their `limit`, up to
 * {@link NGRX_DIFF_MORE_CAP}, without building or serializing them.
 */
export interface DiffOverflow {
  more: number;
}

export interface NgrxUnrestorableUpdate {
  seq: number;
  reason: NgrxUnrestorable;
}

export interface NgrxPageReport {
  pageId: string;
  session: string;
  url: string;
  title: string;
  stores: NgrxSignalStoreInfo[];
  classic: NgrxClassicStoreInfo | null;
  log: NgrxLogEntry[];
  /** The newest seq the server confirmed before this report; `log` holds only later entries. */
  since?: number;
  /** Entries sent earlier that Store DevTools can no longer restore. */
  unrestorable?: NgrxUnrestorableUpdate[];
  /**
   * Entries sent earlier whose args are now masked: the call wrote a secret
   * after it logged them (a write after an `await`).
   */
  argsRedacted?: number[];
  /** Per-type counts since the page loaded; sent when they changed, kept by the server otherwise. */
  stats?: NgrxActionStat[];
}

export interface NgrxPage extends Omit<
  NgrxPageReport,
  'session' | 'unrestorable' | 'argsRedacted'
> {
  reportedAt: number;
  /** Older change log entries removed at `limits.changeLog`. */
  dropped?: number;
}

export interface NgrxState {
  pages: NgrxPage[];
}

export type NgrxRequest =
  | { type: 'restore'; seq: number }
  | { type: 'latest' }
  | { type: 'dispatch'; action: string; payload?: Record<string, unknown> }
  | { type: 'dispatch-again'; seq: number }
  // Read-only: the State and Diff of one entry, and a session export (`ngrx-history.ts`).
  | { type: 'entry'; seq: number }
  | { type: 'export'; storeId?: string; from?: number; to?: number }
  // Store DevTools history operations (`@ngrx/store-devtools`).
  | NgrxDevtoolsRequest;

/** Store DevTools history operations the panel and the `ngrx-store-devtools` tool run. */
export const NGRX_DEVTOOLS_OPS = ['toggle', 'jump', 'commit', 'reset', 'pause'] as const;
export type NgrxDevtoolsOp = (typeof NGRX_DEVTOOLS_OPS)[number];

/**
 * `toggle` skips or includes the action of log entry `seq`; `jump` shows the
 * state after log entry `seq`, or Store DevTools state `index` (0 is the
 * committed state); `commit` makes the current state the new start and drops
 * the history; `reset` goes back to the initial state and drops the history;
 * `pause` stops (`paused: true`) or starts recording new actions.
 */
export interface NgrxDevtoolsRequest {
  type: 'devtools';
  op: NgrxDevtoolsOp;
  seq?: number;
  index?: number;
  paused?: boolean;
}

/** Checks a Store DevTools request sent from the panel or an agent. Returns the problem, or null. */
export function devtoolsProblem(
  request: Partial<NgrxDevtoolsRequest> | null | undefined,
): string | null {
  const op = request?.op;
  if (!(NGRX_DEVTOOLS_OPS as readonly unknown[]).includes(op)) {
    return `Pass \`op\`: one of ${NGRX_DEVTOOLS_OPS.map((name) => `\`${name}\``).join(', ')}.`;
  }
  const whole = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;
  if (op === 'toggle' && !whole(request?.seq))
    return 'Pass `seq`, the log entry of the action to skip or include.';
  if (op === 'jump') {
    const bySeq = request?.seq !== undefined;
    const byIndex = request?.index !== undefined;
    if (bySeq === byIndex)
      return 'Pass either `seq` (a log entry) or `index` (a Store DevTools state; 0 is the committed state).';
    if (bySeq && !whole(request?.seq)) return '`seq` must be a log entry number.';
    if (byIndex && !whole(request?.index)) return '`index` must be a whole number from 0.';
  }
  if (op === 'pause' && request?.paused !== undefined && typeof request.paused !== 'boolean') {
    return '`paused` must be true or false.';
  }
  return null;
}

export interface NgrxRequestResult {
  ok?: boolean;
  message?: string;
  error?: string;
  entry?: NgrxLogEntry;
  paused?: boolean;
  /** `entry` requests: the state before and after it, and their diff. */
  detail?: NgrxEntryDetail;
  /** `export` requests: the session. */
  session?: NgrxSession;
}

export const MAX_ACTION_TYPE = 200;
export const MAX_ACTION_PAYLOAD = 20_000;

/** Checks an action type and payload sent from the panel or an agent. Returns the problem, or null. */
export function dispatchProblem(type: unknown, payload: unknown): string | null {
  if (typeof type !== 'string' || !type.trim())
    return 'The action type must be a non-empty string.';
  if (type.length > MAX_ACTION_TYPE) {
    return `The action type is longer than ${MAX_ACTION_TYPE} characters.`;
  }
  if (/[\u0000-\u001f\u007f]/.test(type)) return 'The action type has control characters.';
  if (payload === undefined) return null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'The payload must be a JSON object, like {"id": 7}.';
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
    return 'The payload cannot have a "type" key. Put the action type in the type field.';
  }
  let json: string | undefined;
  try {
    json = JSON.stringify(payload);
  } catch {
    json = undefined;
  }
  if (json === undefined) return 'The payload must be plain JSON.';
  if (json.length > MAX_ACTION_PAYLOAD) {
    return `The payload is larger than ${MAX_ACTION_PAYLOAD} characters of JSON.`;
  }
  return null;
}

export interface SerializeOptions {
  depth?: number;
  maxKeys?: number;
  maxString?: number;
  budget?: number;
}

export const TYPE_KEY = '@type';

const REDACT_WINDOW = 65536;

export function serialize(value: unknown, options: SerializeOptions = {}): unknown {
  const maxDepth = options.depth ?? 8;
  const maxKeys = options.maxKeys ?? 100;
  const maxString = options.maxString ?? 2000;
  let budget = options.budget ?? 20_000;
  const seen = new WeakSet<object>();

  const walk = (val: unknown, depth: number): unknown => {
    if (--budget < 0) return '[Truncated]';
    if (val === null) return null;
    switch (typeof val) {
      case 'undefined':
        return { [TYPE_KEY]: 'undefined' };
      case 'string':
        return clip(
          redactText(val.length > REDACT_WINDOW ? val.slice(0, REDACT_WINDOW) : val),
          maxString,
        );
      case 'number':
        return Number.isFinite(val) ? val : { [TYPE_KEY]: 'number', value: String(val) };
      case 'boolean':
        return val;
      case 'bigint':
        return { [TYPE_KEY]: 'bigint', value: val.toString() };
      case 'symbol':
        return { [TYPE_KEY]: 'symbol', value: val.description ?? '' };
      case 'function':
        return { [TYPE_KEY]: 'function', name: val.name || 'anonymous' };
    }
    const obj = val as object;
    if (seen.has(obj)) return '[Circular]';
    if (obj instanceof Date) {
      return {
        [TYPE_KEY]: 'Date',
        value: Number.isNaN(obj.getTime()) ? 'Invalid Date' : obj.toISOString(),
      };
    }
    if (obj instanceof RegExp) return { [TYPE_KEY]: 'RegExp', value: String(obj) };
    if (obj instanceof Error) {
      return { [TYPE_KEY]: 'Error', name: obj.name, message: redactText(obj.message) };
    }
    if (depth >= maxDepth) {
      if (Array.isArray(obj)) return `[Array(${obj.length})]`;
      if (obj instanceof Map) return `[Map(${obj.size})]`;
      if (obj instanceof Set) return `[Set(${obj.size})]`;
      return '[Object]';
    }
    seen.add(obj);
    try {
      if (Array.isArray(obj)) {
        const out = obj.slice(0, maxKeys).map((item) => walk(item, depth + 1));
        if (obj.length > maxKeys) out.push(`[${obj.length - maxKeys} more]`);
        return out;
      }
      if (obj instanceof Map) {
        const entries = [...obj.entries()]
          .slice(0, maxKeys)
          .map(([k, v]) => [
            walk(k, depth + 1),
            typeof k === 'string' && isRedactedKey(k) ? REDACTED : walk(v, depth + 1),
          ]);
        return { [TYPE_KEY]: 'Map', size: obj.size, entries };
      }
      if (obj instanceof Set) {
        const values = [...obj].slice(0, maxKeys).map((v) => walk(v, depth + 1));
        return { [TYPE_KEY]: 'Set', size: obj.size, values };
      }
      if (typeof Element !== 'undefined' && obj instanceof Element) {
        return { [TYPE_KEY]: 'Element', value: obj.tagName.toLowerCase() };
      }
      const out: Record<string, unknown> = {};
      const keys = Object.keys(obj);
      for (const key of keys.slice(0, maxKeys)) {
        // A token used as a key (`{ [jwt]: … }`) is masked like a value.
        const shown = shownKey(key, out);
        if (isRedactedKey(key)) {
          out[shown] = REDACTED;
          continue;
        }
        let item: unknown;
        try {
          item = (obj as Record<string, unknown>)[key];
        } catch {
          item = '[Unreadable]';
        }
        out[shown] = walk(item, depth + 1);
      }
      if (keys.length > maxKeys) out[overflowKey(out)] = `${keys.length - maxKeys} more keys`;
      return out;
    } finally {
      seen.delete(obj);
    }
  };

  return walk(value, 0);
}

const MIN_TOKEN_KEY = 8;

/** `key` with tokens masked, and a ` (2)` suffix when another key already masked to it. */
function shownKey(key: string, taken: Record<string, unknown>): string {
  // Every shape the masks know is longer than this, so a plain state key costs no regex.
  if (key.length < MIN_TOKEN_KEY) return key;
  const safe = redactMessage(key);
  if (safe === key) return key;
  let shown = safe;
  for (let n = 2; Object.prototype.hasOwnProperty.call(taken, shown); n++) shown = `${safe} (${n})`;
  return shown;
}

export function serializeSlice(
  key: PropertyKey,
  value: unknown,
  options: SerializeOptions = {},
): unknown {
  return typeof key === 'string' && isRedactedKey(key) ? REDACTED : serialize(value, options);
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Deep equality of serialized (JSON-like) values, without building strings. */
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
  if (keys.length !== Object.keys(y).length) return false;
  return keys.every((key) => Object.hasOwn(y, key) && same(x[key], y[key]));
}

function join(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  const safe = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
  if (!path) return safe;
  return safe.startsWith('"') ? `${path}[${safe}]` : `${path}.${safe}`;
}

export function diff(
  before: unknown,
  after: unknown,
  limit = 50,
  maxDepth = 6,
  overflow?: DiffOverflow,
): NgrxDiffEntry[] {
  const out: NgrxDiffEntry[] = [];
  const full = () => out.length >= limit && (!overflow || overflow.more >= NGRX_DIFF_MORE_CAP);
  const emit = (entry: NgrxDiffEntry) => {
    if (out.length < limit) out.push(entry);
    else if (overflow) overflow.more++;
  };
  const walk = (a: unknown, b: unknown, path: string, depth: number) => {
    if (full() || same(a, b)) return;
    const bothArrays = Array.isArray(a) && Array.isArray(b);
    const bothObjects = isPlain(a) && isPlain(b) && !(TYPE_KEY in a) && !(TYPE_KEY in b);
    if (depth >= maxDepth || (!bothArrays && !bothObjects)) {
      emit({ path: path || '(root)', op: 'change', before: a, after: b });
      return;
    }
    if (bothArrays) {
      const x = a as unknown[];
      const y = b as unknown[];
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if (i >= x.length) emit({ path: join(path, i), op: 'add', after: y[i] });
        else if (i >= y.length) emit({ path: join(path, i), op: 'remove', before: x[i] });
        else walk(x[i], y[i], join(path, i), depth + 1);
        if (full()) return;
      }
      return;
    }
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (!(key in y)) emit({ path: join(path, key), op: 'remove', before: x[key] });
      else if (!(key in x)) emit({ path: join(path, key), op: 'add', after: y[key] });
      else walk(x[key], y[key], join(path, key), depth + 1);
      if (full()) return;
    }
  };
  walk(before, after, '', 0);
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function field(value: Record<string, unknown> | unknown[], key: string | number): unknown {
  try {
    return (value as Record<string | number, unknown>)[key];
  } catch {
    return undefined;
  }
}

export function referenceDiff(
  before: unknown,
  after: unknown,
  path: string,
  options: SerializeOptions,
  limit = 50,
  maxDepth = 12,
  overflow?: DiffOverflow,
): NgrxDiffEntry[] {
  const out: NgrxDiffEntry[] = [];
  let found = 0;
  const show = (value: unknown) => serialize(value, options);
  const full = () => out.length >= limit && (!overflow || overflow.more >= NGRX_DIFF_MORE_CAP);
  // Builds (and serializes) an entry only when it is kept; past `limit` it is only counted.
  const emit = (entry: () => NgrxDiffEntry) => {
    found++;
    if (out.length < limit) out.push(entry());
    else if (overflow) overflow.more++;
  };
  const walk = (a: unknown, b: unknown, at: string, depth: number) => {
    if (full() || Object.is(a, b)) return;
    const arrays = Array.isArray(a) && Array.isArray(b);
    const records = isRecord(a) && isRecord(b);
    if (depth >= maxDepth || (!arrays && !records)) {
      emit(() => ({ path: at, op: 'change', before: show(a), after: show(b) }));
      return;
    }
    const start = found;
    if (arrays) {
      const x = a as unknown[];
      const y = b as unknown[];
      for (let i = 0; i < Math.max(x.length, y.length) && !full(); i++) {
        if (i >= x.length) {
          emit(() => ({ path: join(at, i), op: 'add', after: show(field(y, i)) }));
        } else if (i >= y.length) {
          emit(() => ({ path: join(at, i), op: 'remove', before: show(field(x, i)) }));
        } else walk(field(x, i), field(y, i), join(at, i), depth + 1);
      }
    } else {
      const x = a as Record<string, unknown>;
      const y = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (full()) break;
        const secret = isRedactedKey(key);
        if (!(key in y)) {
          emit(() => ({
            path: join(at, key),
            op: 'remove',
            before: secret ? REDACTED : show(field(x, key)),
          }));
        } else if (!(key in x)) {
          emit(() => ({
            path: join(at, key),
            op: 'add',
            after: secret ? REDACTED : show(field(y, key)),
          }));
        } else if (secret) {
          if (!Object.is(field(x, key), field(y, key))) {
            emit(() => ({ path: join(at, key), op: 'change', before: REDACTED, after: REDACTED }));
          }
        } else walk(field(x, key), field(y, key), join(at, key), depth + 1);
      }
    }
    if (found === start) {
      emit(() => ({ path: at, op: 'change', before: show(a), after: show(b) }));
    }
  };
  walk(before, after, path, 0);
  return out;
}
