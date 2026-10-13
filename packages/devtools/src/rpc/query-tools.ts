import * as v from 'valibot';
import type {
  MutationInfo,
  QueryDetail,
  QueryInfo,
  QueryPage,
  QueryPageReport,
  QueryRequestResult,
  QueryState,
} from '../query-shared.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { code, untrusted } from './forms-tools.ts';
import { unknownPageText } from './pages.ts';
import type { PageTtl } from './page-ttl.ts';

const MAX_QUERIES = 300;
const MAX_MUTATIONS = 100;
const TEXT_MAX = 15_000;

const ClientSchema = v.looseObject({
  id: v.pipe(v.string(), v.maxLength(20)),
  scope: v.string(),
  queries: v.number(),
  mutations: v.number(),
});

const QuerySchema = v.looseObject({
  id: v.pipe(v.string(), v.regex(/^q\d{1,9}$/)),
  clientId: v.string(),
  keyText: v.string(),
  status: v.picklist(['pending', 'error', 'success']),
  fetchStatus: v.picklist(['fetching', 'paused', 'idle']),
  stale: v.boolean(),
  invalidated: v.boolean(),
  observers: v.number(),
  active: v.boolean(),
  disabled: v.boolean(),
  dataUpdatedAt: v.number(),
  errorUpdatedAt: v.number(),
  dataUpdateCount: v.number(),
  failureCount: v.number(),
  hasData: v.boolean(),
});

const MutationSchema = v.looseObject({
  id: v.pipe(v.string(), v.regex(/^m\d{1,9}$/)),
  clientId: v.string(),
  status: v.picklist(['idle', 'pending', 'success', 'error']),
  isPaused: v.boolean(),
  submittedAt: v.number(),
  failureCount: v.number(),
});

/** The report a page pushed, or null. Malformed queries and mutations are dropped one by one. */
export function toQueryReport(message: unknown): QueryPageReport | null {
  const r = message as Partial<QueryPageReport> | null;
  if (!r || typeof r.pageId !== 'string' || !r.pageId || r.pageId.length >= 50) return null;
  if (!Array.isArray(r.clients) || !Array.isArray(r.queries) || !Array.isArray(r.mutations)) {
    return null;
  }
  const more = r.more as { queries?: unknown; mutations?: unknown } | undefined;
  return {
    pageId: r.pageId,
    url: redactUrl(String(r.url ?? '').slice(0, 2000)),
    title: redactMessage(String(r.title ?? '').slice(0, 2000)).slice(0, 200),
    at: typeof r.at === 'number' ? r.at : Date.now(),
    clients: r.clients
      .filter((c) => v.is(ClientSchema, c))
      .slice(0, 20)
      .map((c) => ({ ...c, scope: redactMessage(String(c.scope).slice(0, 100)) })),
    queries: r.queries
      .filter((q): q is QueryInfo => v.is(QuerySchema, q))
      .slice(0, MAX_QUERIES)
      .map((q) => ({
        ...q,
        keyText: redactMessage(q.keyText.slice(0, 200)),
        ...(typeof q.error === 'string' ? { error: redactMessage(q.error.slice(0, 300)) } : {}),
      })),
    mutations: r.mutations
      .filter((m): m is MutationInfo => v.is(MutationSchema, m))
      .slice(0, MAX_MUTATIONS)
      .map((m) => ({
        ...m,
        ...(typeof m.keyText === 'string'
          ? { keyText: redactMessage(m.keyText.slice(0, 200)) }
          : {}),
        ...(typeof m.error === 'string' ? { error: redactMessage(m.error.slice(0, 300)) } : {}),
      })),
    ...(more && typeof more.queries === 'number' && typeof more.mutations === 'number'
      ? { more: { queries: more.queries, mutations: more.mutations } }
      : {}),
  };
}

/** Pages that stopped reporting. */
export function staleQueryPages(state: QueryState, now: number, ttl: PageTtl): string[] {
  return Object.values(state.pages)
    .filter((page) => now - page.reportedAt > ttl(page.pageId))
    .map((page) => page.pageId);
}

const NO_DATA =
  'No page reports a TanStack Query `QueryClient`. The overlay finds the client the app provides with `provideTanStackQuery()` once something has injected it. Open the app in a browser with the overlay loaded. The stdio server has no page attached.';

function byRecency(state: QueryState): QueryPage[] {
  return Object.values(state.pages).sort((a, b) => b.reportedAt - a.reportedAt);
}

/** The page `page` names, or the most recent; a string is the answer when there is none. */
export function queryPageOf(state: QueryState, page?: string): QueryPage | string {
  const pages = byRecency(state);
  if (!pages.length) return NO_DATA;
  if (!page) return pages[0];
  return state.pages[page] ?? unknownPageText(page, pages, 'TanStack Query');
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function cap(text: string): string {
  return text.length > TEXT_MAX
    ? `${text.slice(0, TEXT_MAX)}\n…\n\nCut at ${TEXT_MAX} characters. Narrow it with \`search\`, \`status\` or \`limit\`.`
    : text;
}

/** "12 s", "4 min", "2 h", from the page's clock at `at`. */
export function ageText(at: number, when: number): string {
  if (!when) return 'never';
  const seconds = Math.max(0, Math.round((at - when) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

function staleText(query: QueryInfo): string {
  if (query.invalidated) return 'invalidated';
  return query.stale ? 'stale' : 'fresh';
}

export interface ListQueriesArgs {
  page?: string;
  status?: unknown;
  search?: unknown;
  limit?: unknown;
}

/** The `list-queries` answer: queries and mutations of one page, as tables. */
export function listQueriesText(state: QueryState, args: ListQueriesArgs = {}): string {
  const page = queryPageOf(state, args.page);
  if (typeof page === 'string') return page;
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(300, Math.floor(args.limit)))
      : 50;
  const status = typeof args.status === 'string' ? args.status : undefined;
  const search = typeof args.search === 'string' ? args.search.toLowerCase() : undefined;
  const matches = (keyText: string | undefined, s: string, fetch?: string) =>
    (!status || s === status || fetch === status) &&
    (!search || (keyText ?? '').toLowerCase().includes(search));
  const queries = page.queries.filter((q) => matches(q.keyText, q.status, q.fetchStatus));
  const mutations = page.mutations.filter((m) => matches(m.keyText, m.status));
  const lines = [
    `# TanStack Query on ${code(page.pageId)} (${code(page.url)})`,
    '',
    `${page.clients.length} QueryClient(s): ${page.clients
      .map((c) => `${code(c.id)} in ${c.scope} (${c.queries} queries, ${c.mutations} mutations)`)
      .join(', ')}.`,
    '',
    `## Queries (${Math.min(limit, queries.length)} of ${queries.length})`,
  ];
  if (page.more?.queries) {
    lines.push(
      `The page left out ${page.more.queries} older queries past its cap of ${MAX_QUERIES}.`,
    );
  }
  if (queries.length) {
    lines.push(
      '',
      '| Id | Key | Status | Fetch | Freshness | Updated | Observers | Error |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const q of queries.slice(0, limit)) {
      lines.push(
        `| ${code(q.id)} | ${code(cell(q.keyText))} | ${q.status} | ${q.fetchStatus} | ${staleText(q)} | ${ageText(page.at, q.dataUpdatedAt)} | ${q.observers}${q.disabled ? ' (disabled)' : ''} | ${q.error ? cell(q.error) : ''} |`,
      );
    }
  } else {
    lines.push('', 'No query matches.');
  }
  lines.push('', `## Mutations (${Math.min(limit, mutations.length)} of ${mutations.length})`);
  if (mutations.length) {
    lines.push('', '| Id | Key | Status | Submitted | Error |', '| --- | --- | --- | --- | --- |');
    for (const m of mutations.slice(0, limit)) {
      lines.push(
        `| ${code(m.id)} | ${m.keyText ? code(cell(m.keyText)) : '_none_'} | ${m.status}${m.isPaused ? ' (paused)' : ''} | ${ageText(page.at, m.submittedAt)} | ${m.error ? cell(m.error) : ''} |`,
      );
    }
  } else {
    lines.push('', 'No mutation matches.');
  }
  lines.push('', 'Pass an id to pangular:inspect-query for the data.');
  return untrusted(cap(lines.join('\n')));
}

/** The query or mutation `id` names, or the first query whose key contains `key`. */
export function findQueryItem(
  page: QueryPage,
  args: { id?: unknown; key?: unknown },
): QueryInfo | MutationInfo | string {
  if (typeof args.id === 'string' && args.id) {
    const found =
      page.queries.find((q) => q.id === args.id) ?? page.mutations.find((m) => m.id === args.id);
    return (
      found ??
      `No query or mutation ${code(args.id)} on ${code(page.pageId)}. List them with pangular:list-queries.`
    );
  }
  if (typeof args.key === 'string' && args.key) {
    const wanted = args.key.toLowerCase();
    const found = page.queries.filter((q) => q.keyText.toLowerCase().includes(wanted));
    if (found.length === 1) return found[0];
    if (!found.length) return `No query key on ${code(page.pageId)} contains ${code(args.key)}.`;
    return untrusted(
      `${found.length} query keys contain ${code(args.key)}: ${found
        .slice(0, 20)
        .map((q) => `${code(q.id)} ${code(q.keyText)}`)
        .join(', ')}. Pass one id as \`id\`.`,
    );
  }
  return 'Pass `id` (from pangular:list-queries) or `key`.';
}

function json(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

/** The `inspect-query` answer: the summary the page pushed and the data it sent on request. */
export function inspectQueryText(
  page: QueryPage,
  item: QueryInfo | MutationInfo,
  result: QueryRequestResult,
): string {
  const lines: string[] = [];
  if ('fetchStatus' in item) {
    lines.push(
      `# Query ${code(item.id)} ${code(item.keyText)}`,
      '',
      `- page: ${code(page.pageId)}`,
      `- status: ${item.status}, fetch status: ${item.fetchStatus}`,
      `- freshness: ${staleText(item)}${item.staleTime !== undefined ? ` (staleTime ${item.staleTime === 'static' ? 'static' : `${item.staleTime} ms`})` : ''}`,
      `- data updated: ${ageText(page.at, item.dataUpdatedAt)} (${item.dataUpdateCount} update(s))`,
      `- observers: ${item.observers}${item.active ? ', active' : ''}${item.disabled ? ', disabled' : ''}`,
      `- gcTime: ${item.gcTime === null ? 'Infinity' : item.gcTime === undefined ? 'unknown' : `${item.gcTime} ms`}`,
    );
    if (item.failureCount) lines.push(`- failures: ${item.failureCount}`);
    if (item.error) lines.push(`- error: ${item.error}`);
  } else {
    lines.push(
      `# Mutation ${code(item.id)}${item.keyText ? ` ${code(item.keyText)}` : ''}`,
      '',
      `- page: ${code(page.pageId)}`,
      `- status: ${item.status}${item.isPaused ? ' (paused)' : ''}`,
      `- submitted: ${ageText(page.at, item.submittedAt)}`,
    );
    if (item.failureCount) lines.push(`- failures: ${item.failureCount}`);
    if (item.error) lines.push(`- error: ${item.error}`);
  }
  const detail: QueryDetail | undefined = result.detail;
  if (result.error || !detail) {
    lines.push('', `The page did not send the data: ${result.error ?? 'no answer'}.`);
  } else {
    if (detail.variables !== undefined) lines.push('', '## Variables', json(detail.variables));
    lines.push('', '## Data', detail.data === undefined ? '_No data._' : json(detail.data));
    if (detail.error !== undefined) lines.push('', '## Error', json(detail.error));
  }
  return untrusted(cap(lines.join('\n')));
}
