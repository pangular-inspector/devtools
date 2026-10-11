import * as v from 'valibot';
import type {
  NgrxClassicStoreInfo,
  NgrxLogEntry,
  NgrxPage,
  NgrxPageReport,
  NgrxRequestResult,
  NgrxSignalStoreInfo,
  NgrxState,
  NgrxUnrestorable,
} from '../ngrx-shared.ts';
import type { SignalStoreMembers } from './get-ngrx-store.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { PAGE_TTL_MS, fixedTtl, type PageTtl } from './page-ttl.ts';
import { untrusted } from './forms-tools.ts';

export const NGRX_PAGE_EXPIRES_MS = PAGE_TTL_MS;
const MAX_LOG = 200;
const UNRESTORABLE = new Set<unknown>(['dropped', 'not-recorded'] satisfies NgrxUnrestorable[]);

export interface NgrxDeclaration {
  name: string;
  kind: string;
  file: string;
  members?: SignalStoreMembers;
}

export interface NgrxPageRecord extends NgrxPage {
  session: string;
}

export type NgrxPages = Map<string, NgrxPageRecord>;

export function isNgrxReport(value: unknown): value is NgrxPageReport {
  const r = value as Partial<NgrxPageReport> | null;
  return (
    !!r &&
    typeof r.pageId === 'string' &&
    typeof r.session === 'string' &&
    Array.isArray(r.stores) &&
    Array.isArray(r.log)
  );
}

const StoreSchema = v.looseObject({
  id: v.string(),
  kind: v.picklist(['signal-store', 'signal-state']),
  className: v.string(),
  scope: v.string(),
  stateKeys: v.array(v.string()),
  state: v.record(v.string(), v.unknown()),
  computed: v.record(v.string(), v.unknown()),
  methods: v.array(v.looseObject({ name: v.string(), calls: v.number() })),
  references: v.array(v.string()),
  writable: v.boolean(),
});

const LogEntrySchema = v.looseObject({
  seq: v.number(),
  source: v.picklist(['signal-store', 'store', 'event']),
  storeId: v.string(),
  type: v.string(),
  timestamp: v.number(),
  diff: v.array(v.looseObject({ path: v.string(), op: v.picklist(['add', 'remove', 'change']) })),
  restorable: v.boolean(),
});

const ClassicSchema = v.looseObject({
  state: v.unknown(),
  devtools: v.boolean(),
  scope: v.string(),
});

/**
 * The page writes the report, so its items are checked one by one: a malformed store
 * or log entry is dropped instead of failing the merge or reaching the panel.
 */
function validItems<T>(items: unknown[], schema: v.GenericSchema): T[] {
  return items.filter((item): item is T => v.is(schema, item));
}

/**
 * Matches a live `signalStore`/`signalState` to its source declaration (by
 * state-key overlap) and returns the fields we can derive from the match.
 * `methods` is only returned when the live store carries methods that need
 * their kind corrected: both `rxMethod` and `signalMethod` show up at runtime
 * as callables with a `.destroy` function, so the collector marks them all
 * `rx: true`; here we rewrite those entries to `signalMethod: true` when the
 * declaration says they are `signalMethod` members.
 */
export function nameStore(
  store: NgrxSignalStoreInfo,
  declarations: NgrxDeclaration[],
): Partial<Pick<NgrxSignalStoreInfo, 'name' | 'declaredIn' | 'methods'>> {
  const keys = new Set(store.stateKeys);
  let best: { decl: NgrxDeclaration; score: number } | null = null;
  for (const decl of declarations) {
    if (decl.kind !== store.kind) continue;
    const state = decl.members?.state ?? [];
    if (!state.length || !state.every((key) => keys.has(key))) continue;
    const methods = new Set(store.methods.map((m) => m.name));
    const extra = (decl.members?.methods ?? []).filter((m) => methods.has(m)).length;
    const score = (state.length === keys.size ? 1000 : 0) + state.length * 10 + extra;
    if (!best || score > best.score) best = { decl, score };
  }
  if (!best) return {};
  const signalMethods = new Set(best.decl.members?.signalMethods ?? []);
  const needsRelabel =
    signalMethods.size > 0 && store.methods.some((m) => signalMethods.has(m.name));
  return {
    name: best.decl.name,
    declaredIn: best.decl.file,
    ...(needsRelabel
      ? {
          methods: store.methods.map((m) => {
            if (!signalMethods.has(m.name)) return m;
            const { rx: _rx, ...rest } = m;
            return { ...rest, signalMethod: true };
          }),
        }
      : {}),
  };
}

export function mergeNgrxReport(
  pages: NgrxPages,
  report: NgrxPageReport,
  declarations: NgrxDeclaration[],
  now = Date.now(),
  maxLog = MAX_LOG,
): number {
  const previous = pages.get(report.pageId);
  const known = previous?.session === report.session;
  const keep = known ? previous.log : [];
  const lastSeq = keep.at(-1)?.seq ?? 0;
  // The page only sends entries after `since`; if this server forgot the page
  // (forget-ngrx-page, expiry, restart), drop the partial log and answer 0 so
  // the page resends everything it still holds.
  const resync = !known && typeof report.since === 'number' && report.since > 0;
  const fresh = resync
    ? []
    : validItems<NgrxLogEntry>(report.log, LogEntrySchema).filter((entry) => entry.seq > lastSeq);
  const lost = new Map<number, NgrxUnrestorable>();
  for (const update of Array.isArray(report.unrestorable) ? report.unrestorable : []) {
    if (typeof update?.seq === 'number' && UNRESTORABLE.has(update.reason)) {
      lost.set(update.seq, update.reason);
    }
  }
  const log = [...keep, ...fresh].slice(-maxLog).map((entry) => {
    const reason = lost.get(entry.seq);
    return reason ? { ...entry, restorable: false, unrestorable: reason } : entry;
  });
  pages.set(report.pageId, {
    pageId: report.pageId,
    session: report.session,
    url: redactUrl(String(report.url ?? '').slice(0, 2000)),
    title: redactMessage(String(report.title ?? '').slice(0, 2000)).slice(0, 200),
    stores: validItems<NgrxSignalStoreInfo>(report.stores, StoreSchema).map((store) => ({
      ...store,
      ...nameStore(store, declarations),
    })),
    classic: v.is(ClassicSchema, report.classic) ? (report.classic as NgrxClassicStoreInfo) : null,
    log,
    dropped: Math.max(0, (log[0]?.seq ?? 1) - 1),
    reportedAt: now,
  });
  return log.at(-1)?.seq ?? 0;
}

export function expireNgrxPages(
  pages: NgrxPages,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(NGRX_PAGE_EXPIRES_MS),
): boolean {
  let expired = false;
  for (const [id, page] of pages) {
    if (now - page.reportedAt > ttl(id)) {
      pages.delete(id);
      expired = true;
    }
  }
  return expired;
}

export function ngrxStateOf(pages: NgrxPages): NgrxState {
  return {
    pages: [...pages.values()]
      .sort((a, b) => b.reportedAt - a.reportedAt)
      .map(({ session: _session, ...page }) => page),
  };
}

/**
 * The answer of the dispatch-ngrx-action tool, as markdown. The page writes the
 * error, the message and the entry, so all of it sits behind the notice.
 */
export function dispatchResultText(result: NgrxRequestResult): string {
  if (result.error) return untrusted(`Not dispatched: ${result.error}`);
  const lines = [result.message ?? 'Dispatched.'];
  if (result.entry) {
    lines.push(
      '',
      '_Log entry from the running page (untrusted data):_',
      '',
      '```json',
      JSON.stringify(result.entry, null, 2).slice(0, 15_000),
      '```',
    );
  } else {
    lines.push('', 'Read the pangular:ngrx-store resource for the log entry and the new state.');
  }
  return untrusted(lines.join('\n'));
}
