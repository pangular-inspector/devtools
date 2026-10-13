import * as v from 'valibot';
import { moreChangesText } from '../ngrx-shared.ts';
import type {
  ReduxLogEntry,
  ReduxStoreInfo,
  ReduxStoresPage,
  ReduxStoresReport,
  ReduxStoresState,
} from '../redux-stores-shared.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { code, untrusted } from './forms-tools.ts';
import { unknownPageText } from './pages.ts';
import type { PageTtl } from './page-ttl.ts';

const MAX_STORES = 50;
const TEXT_MAX = 15_000;

const StoreSchema = v.looseObject({
  id: v.pipe(v.string(), v.maxLength(20)),
  name: v.string(),
  library: v.string(),
  state: v.unknown(),
  actions: v.number(),
});

const EntrySchema = v.looseObject({
  seq: v.number(),
  storeId: v.pipe(v.string(), v.maxLength(20)),
  type: v.string(),
  timestamp: v.number(),
  diff: v.array(v.looseObject({ path: v.string(), op: v.picklist(['add', 'remove', 'change']) })),
});

/** The report a page pushed, or null when it is not one. Bad stores and entries are dropped one by one. */
export function toReduxStoresReport(message: unknown): ReduxStoresReport | null {
  const r = message as Partial<ReduxStoresReport> | null;
  if (!r || typeof r.pageId !== 'string' || !r.pageId || r.pageId.length >= 50) return null;
  if (!Array.isArray(r.stores) || !Array.isArray(r.log)) return null;
  return {
    pageId: r.pageId,
    url: redactUrl(String(r.url ?? '').slice(0, 2000)),
    title: redactMessage(String(r.title ?? '').slice(0, 2000)).slice(0, 200),
    stores: r.stores
      .filter((store): store is ReduxStoreInfo => v.is(StoreSchema, store))
      .slice(0, MAX_STORES)
      .map((store) => ({
        ...store,
        name: redactMessage(store.name.slice(0, 100)),
        library: store.library.slice(0, 40),
      })),
    log: r.log
      .filter((entry): entry is ReduxLogEntry => v.is(EntrySchema, entry))
      .map((entry) => ({ ...entry, type: redactMessage(entry.type.slice(0, 200)) })),
    since: typeof r.since === 'number' ? r.since : 0,
  };
}

/**
 * Stores a report in `state` and returns the newest seq the server holds for
 * the page. A page the server forgot (expiry, forget, restart) that sends only
 * the entries after `since` gets 0 back, so it sends its whole log again.
 */
export function mergeReduxStoresReport(
  state: ReduxStoresState,
  report: ReduxStoresReport,
  maxLog: number,
  now = Date.now(),
): number {
  const previous = state.pages[report.pageId];
  if (!previous && report.since > 0) return 0;
  const keep = previous?.log ?? [];
  const last = keep.at(-1)?.seq ?? 0;
  // A page that reloaded starts its seq at 1 again, so its old log goes.
  const restarted = report.since === 0 && report.log.length > 0 && report.log[0].seq <= last;
  const base = restarted ? [] : keep;
  const newest = base.at(-1)?.seq ?? 0;
  const log = [...base, ...report.log.filter((entry) => entry.seq > newest)].slice(-maxLog);
  state.pages[report.pageId] = {
    pageId: report.pageId,
    url: report.url,
    title: report.title,
    stores: report.stores,
    log,
    dropped: Math.max(0, (log[0]?.seq ?? 1) - 1),
    reportedAt: now,
  };
  return log.at(-1)?.seq ?? 0;
}

/** Pages that stopped reporting. */
export function staleReduxStoresPages(state: ReduxStoresState, now: number, ttl: PageTtl) {
  return Object.values(state.pages)
    .filter((page) => now - page.reportedAt > ttl(page.pageId))
    .map((page) => page.pageId);
}

const NO_DATA =
  'No page reports a store through the Redux DevTools API. Stores such as NGXS (`withNgxsReduxDevtoolsPlugin()`), Elf (`devTools()` from `@ngneat/elf-devtools`) and MiniRx (`ReduxDevtoolsExtension`) show up once their devtools integration is on and the page loads `@pangular-inspector/devtools/store-hook` before the app starts. The stdio server has no page attached.';

function newest(state: ReduxStoresState): ReduxStoresPage[] {
  return Object.values(state.pages).sort((a, b) => b.reportedAt - a.reportedAt);
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function json(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

function cap(text: string): string {
  return text.length > TEXT_MAX
    ? `${text.slice(0, TEXT_MAX)}\n…\n\nCut at ${TEXT_MAX} characters. Pass \`store\` or a lower \`limit\`.`
    : text;
}

export interface InspectReduxStoresArgs {
  page?: string;
  store?: string;
  limit?: unknown;
}

/**
 * The `inspect-redux-stores` answer: the stores of one page, or one store with
 * its state and its latest actions, newest first, with their diffs.
 */
export function inspectReduxStoresText(
  state: ReduxStoresState,
  args: InspectReduxStoresArgs = {},
): string {
  const pages = newest(state);
  if (!pages.length) return NO_DATA;
  const page = args.page ? state.pages[args.page] : pages[0];
  if (!page) return unknownPageText(args.page!, pages, 'Redux DevTools stores');
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(200, Math.floor(args.limit)))
      : 20;
  const lines: string[] = [
    `# Redux DevTools stores on ${code(page.pageId)} (${code(page.url)})`,
    '',
  ];
  if (!page.stores.length) {
    lines.push('The page reports no open store connection.');
    return untrusted(lines.join('\n'));
  }
  const wanted = args.store?.toLowerCase();
  const stores = wanted
    ? page.stores.filter((s) => s.id.toLowerCase() === wanted || s.name.toLowerCase() === wanted)
    : page.stores;
  if (!stores.length) {
    lines.push(
      `No store ${code(args.store!)} on this page. Stores: ${page.stores
        .map((s) => `${code(s.id)} ${s.name}`)
        .join(', ')}.`,
    );
    return untrusted(lines.join('\n'));
  }
  if (!wanted && stores.length > 1) {
    lines.push('| Store | Id | Library | Actions |', '| --- | --- | --- | --- |');
    for (const store of stores) {
      lines.push(
        `| ${cell(store.name)} | ${code(store.id)} | ${cell(store.library)} | ${store.actions} |`,
      );
    }
    lines.push('', 'Pass `store` (an id or a name) for its state and its latest actions.');
  } else {
    const store = stores[0];
    lines.push(`## ${store.name} (${code(store.id)}, ${store.library})`, '', '### State');
    lines.push(json(store.state));
    const entries = page.log.filter((entry) => entry.storeId === store.id);
    lines.push('', `### Latest actions (${Math.min(limit, entries.length)} of ${entries.length})`);
    if (page.dropped) lines.push(`${page.dropped} older entries were dropped at the log limit.`);
    if (!entries.length) lines.push('No action since the page connected.');
    for (const entry of entries.slice(-limit).reverse()) {
      lines.push(
        '',
        `- #${entry.seq} ${code(entry.type)} at ${new Date(entry.timestamp).toISOString()}`,
      );
      if (entry.action !== undefined) lines.push(`  - action: ${JSON.stringify(entry.action)}`);
      for (const change of entry.diff) {
        const before = 'before' in change ? JSON.stringify(change.before) : '';
        const after = 'after' in change ? JSON.stringify(change.after) : '';
        lines.push(
          `  - ${change.op} ${code(change.path)}${before ? ` ${before}` : ''}${
            after ? ` → ${after}` : ''
          }`,
        );
      }
      if (entry.diffTruncated) lines.push(`  - ${moreChangesText(entry.diffTruncated)}`);
    }
  }
  const others = pages.filter((p) => p.pageId !== page.pageId);
  if (others.length) {
    lines.push('', `Other pages with stores: ${others.map((p) => code(p.pageId)).join(', ')}.`);
  }
  return untrusted(cap(lines.join('\n')));
}
