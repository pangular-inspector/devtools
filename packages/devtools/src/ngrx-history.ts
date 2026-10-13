import {
  entryDetail,
  patchesBetween,
  sessionJson,
  SESSION_FORMAT,
  SESSION_STATE,
  SESSION_VERSION,
  type NgrxSession,
  type NgrxSessionEntry,
  type NgrxSessionStoreKind,
} from './ngrx-session.ts';
import { serialize, type NgrxLogEntry, type NgrxRequestResult } from './ngrx-shared.ts';

/**
 * Reads the NgRx collector's history: the state before and after any entry
 * it still holds (State and Diff tabs), and a session of one store to export.
 * The collector keeps the raw states each entry produced; NgRx state is
 * immutable, so consecutive states share everything an entry did not change
 * and the history costs what changed, bounded by the change log limit.
 * Everything leaves the page serialized and redacted.
 */
export interface HistorySource {
  entries(): readonly NgrxLogEntry[];
  /** The raw state of the entry's store before and after it, or null for an event or a dropped entry. */
  states(seq: number): { storeId: string; before: unknown; after: unknown } | null;
  /** What kind of store an id names, or null when it is gone. */
  storeOf(storeId: string): { kind: NgrxSessionStoreKind; name?: string } | null;
}

export type HistoryRequest =
  { type: 'entry'; seq: number } | { type: 'export'; storeId?: string; from?: number; to?: number };

/** Serializes raw states once per object, so states an entry did not replace are not walked twice. */
function serializer() {
  const cache = new Map<unknown, unknown>();
  return (raw: unknown) => {
    if (raw && typeof raw === 'object' && cache.has(raw)) return cache.get(raw);
    const value = serialize(raw, SESSION_STATE);
    if (raw && typeof raw === 'object') cache.set(raw, value);
    return value;
  };
}

/** The store a session covers by default: the classic Store, or the one store with entries. */
function defaultStore(source: HistorySource): string | null {
  const ids = new Set(
    source
      .entries()
      .filter((entry) => entry.source !== 'event')
      .map((entry) => entry.storeId),
  );
  if (ids.has('store')) return 'store';
  return ids.size === 1 ? [...ids][0] : null;
}

/** One store's entries in `from`..`to`, as a session. */
export function exportSession(
  source: HistorySource,
  request: { storeId?: string; from?: number; to?: number },
  now = Date.now(),
): NgrxRequestResult {
  const storeId = request.storeId ?? defaultStore(source);
  if (!storeId) {
    return {
      error:
        'Several stores have entries. Pass the store id (`store` for @ngrx/store, or a signal store id such as `ngrx-1`).',
    };
  }
  const store = source.storeOf(storeId);
  const picked = source
    .entries()
    .filter(
      (entry) =>
        entry.storeId === storeId &&
        entry.source !== 'event' &&
        (request.from === undefined || entry.seq >= request.from) &&
        (request.to === undefined || entry.seq <= request.to),
    );
  const withStates = picked
    .map((entry) => ({ entry, states: source.states(entry.seq) }))
    .filter((row): row is { entry: NgrxLogEntry; states: NonNullable<typeof row.states> } =>
      Boolean(row.states),
    );
  if (!withStates.length) {
    return {
      error: store
        ? `Store \`${storeId}\` has no recorded state changes in that range. The page keeps the most recent entries only.`
        : `No store \`${storeId}\` on this page.`,
    };
  }
  const show = serializer();
  const initialState = show(withStates[0].states.before);
  let previous = initialState;
  const entries: NgrxSessionEntry[] = withStates.map(({ entry, states }) => {
    const after = show(states.after);
    const changes = patchesBetween(previous, after);
    previous = after;
    const out: NgrxSessionEntry = {
      seq: entry.seq,
      type: entry.type,
      timestamp: entry.timestamp,
      source: entry.source === 'store' ? 'store' : 'signal-store',
      changes,
    };
    if (entry.action !== undefined) out.action = entry.action;
    if (entry.args?.length) out.args = entry.args;
    if (entry.origin) out.origin = entry.origin;
    if (entry.causedByEvent) out.causedByEvent = entry.causedByEvent;
    return out;
  });
  const session: NgrxSession = {
    format: SESSION_FORMAT,
    version: SESSION_VERSION,
    exportedAt: now,
    store: {
      id: storeId,
      kind: store?.kind ?? (storeId === 'store' ? 'store' : 'signal-store'),
      ...(store?.name ? { name: store.name } : {}),
    },
    initialState,
    entries,
  };
  // Bounded like an import: the oldest entries go first when it does not fit.
  const { json, dropped } = sessionJson(session);
  const fitted = dropped ? (JSON.parse(json) as NgrxSession) : session;
  return {
    ok: true,
    message: dropped
      ? `Exported ${fitted.entries.length} entries; the ${dropped} oldest did not fit.`
      : `Exported ${fitted.entries.length} ${fitted.entries.length === 1 ? 'entry' : 'entries'}.`,
    session: fitted,
  };
}

/** Answers the read-only history requests: one entry's states, or a session export. */
export function historyRequest(source: HistorySource, request: HistoryRequest): NgrxRequestResult {
  if (request.type === 'export') return exportSession(source, request);
  if (typeof request.seq !== 'number') return { error: 'Unknown request.' };
  const entry = source.entries().find((e) => e.seq === request.seq);
  if (!entry) return { error: 'This entry is no longer in the page history.' };
  if (entry.source === 'event') {
    return { error: 'This is a dispatched event, not a state change, so it has no state.' };
  }
  const states = source.states(request.seq);
  if (!states) return { error: 'The page no longer holds the state of this entry.' };
  const show = serializer();
  return {
    ok: true,
    detail: entryDetail(states.storeId, request.seq, show(states.before), show(states.after)),
  };
}
