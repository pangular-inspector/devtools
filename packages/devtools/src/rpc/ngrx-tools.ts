import type {
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
  const keep = previous && previous.session === report.session ? previous.log : [];
  const lastSeq = keep.at(-1)?.seq ?? 0;
  const fresh = report.log.filter((entry: NgrxLogEntry) => entry.seq > lastSeq);
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
    stores: report.stores.map((store) => ({ ...store, ...nameStore(store, declarations) })),
    classic: report.classic ?? null,
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

/** The answer of the dispatch-ngrx-action tool, as markdown. */
export function dispatchResultText(result: NgrxRequestResult): string {
  if (result.error) return `Not dispatched: ${result.error}`;
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
  return lines.join('\n');
}
