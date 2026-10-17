import { createSharedState } from 'devframe/utils/shared-state';
import {
  QUERY_WRITE_REQUESTS,
  toQueryRequest,
  type QueryRequestResult,
  type QueryState,
} from '../query-shared.ts';
import { code, untrusted } from './forms-tools.ts';
import { PAGE_ARGUMENT, choosePageText, pageArgument } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';
import {
  findQueryItem,
  inspectQueryText,
  listQueriesText,
  queryPageOf,
  staleQueryPages,
  toQueryReport,
} from './query-tools.ts';
import { MARKDOWN_OUTPUT_SCHEMA } from './agent-output.ts';
import { refusal } from './refusal.ts';

type AnyRecord = Record<string, any>;

export interface QueryHost {
  my: {
    rpc: {
      sharedState(name: string, options: AnyRecord): Promise<AnyRecord>;
      broadcast(message: { method: string; args: unknown[]; optional?: boolean }): unknown;
    };
  };
  /** devframe's RPC host, to drop a page the moment its connection closes. */
  rpcHost: unknown;
  /** Registers an RPC function, skipped when the TanStack Query inspector is off. */
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  /** Whether the result of a request for `target` comes from that page's owner. */
  answersFor(target: string | undefined, pageId: unknown): boolean;
  ttl: PageTtl;
  /** `actions.tanstackQuery`. */
  writes: boolean;
  /** The message for a blocked write. */
  blocked: string;
  /** How long a request waits for the page. */
  timeoutMs?: number;
}

export interface QueryRegistration {
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  expire(now?: number): void;
  /** What every page reported, for `snapshot`. */
  state(): QueryState;
}

/**
 * The TanStack Query inspector on the server: the `tanstack-query` shared
 * state, the push, forget and request RPC functions, and the `list-queries`,
 * `inspect-query` and `query-action` agent tools.
 */
export async function registerTanstackQuery(host: QueryHost): Promise<QueryRegistration> {
  const shared = await host.my.rpc.sharedState('tanstack-query', {
    sharedState: createSharedState<QueryState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as QueryState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared['mutate']((draft: QueryState) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-tanstack-query',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const report = toQueryReport(message);
      if (!report || !host.owns(report.pageId)) return;
      sessions.bind(report.pageId);
      shared['mutate']((draft: QueryState) => {
        draft.pages[report.pageId] = { ...report, reportedAt: Date.now() };
      });
    },
  });

  host.register({
    name: 'forget-tanstack-query-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  host.register({
    name: 'tanstack-query-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
      if (typeof message?.requestId !== 'string') return;
      const entry = pending.get(message.requestId);
      if (entry && host.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
    },
  });

  /** Sends a request to one page and waits for its answer. */
  const request = (page: unknown, value: unknown) =>
    new Promise<QueryRequestResult>((resolve) => {
      const parsed = toQueryRequest(value);
      if (!parsed) return resolve({ error: 'Unknown request.' });
      if (QUERY_WRITE_REQUESTS.includes(parsed.type) && !host.writes) {
        return resolve({ error: host.blocked });
      }
      const pages = Object.values(state().pages);
      if (typeof page !== 'string' && pages.length !== 1) {
        return resolve({
          error: pages.length
            ? choosePageText(pages, 'TanStack Query')
            : 'No page reports TanStack Query. Open the app in a browser, or pass the page id.',
        });
      }
      const pageId = typeof page === 'string' ? page : pages[0].pageId;
      if (!state().pages[pageId]) {
        return resolve({ error: `No page ${pageId} reports TanStack Query.` });
      }
      const requestId = `t${++seq}`;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({ error: 'No page answered within 10s. Is the app open in a browser?' });
      }, host.timeoutMs ?? 10_000);
      (timer as { unref?: () => void }).unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve((result ?? {}) as QueryRequestResult);
        },
      });
      void host.my.rpc.broadcast({
        method: 'tanstack-query-request',
        args: [{ requestId, pageId, request: parsed }],
        optional: true,
      });
    });

  host.register({
    name: 'request-tanstack-query',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown } | null) =>
      request(message?.pageId, message?.request),
  });

  host.agent.registerTool({
    id: 'pangular:list-queries',
    title: 'List TanStack queries',
    outputSchema: MARKDOWN_OUTPUT_SCHEMA,
    description:
      'TanStack Query on the running page: the `QueryClient`s the app provides (found once something injected them; the overlay never creates one), then cached queries and mutations with id, key, status, fetch status, freshness, last update, observer count and error. Filter with `status` and `search`; `limit` caps rows (default 50). The page reports up to 300 queries and 100 mutations, the most recently updated. Keys and errors are masked. Pass an id to pangular:inspect-query for the data. Uses `page` or the most recent page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        status: {
          type: 'string',
          enum: ['pending', 'error', 'success', 'idle', 'fetching', 'paused'],
          description: 'Only queries and mutations with this status or fetch status.',
        },
        search: { type: 'string', description: 'Only keys that contain this text, any case.' },
        limit: { type: 'integer', description: 'Rows per table (1-300, default 50).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: listQueriesText(state(), {
        page: pageArgument(args),
        status: args?.['status'],
        search: args?.['search'],
        limit: args?.['limit'],
      }),
    }),
  });

  const target = (args: AnyRecord) => {
    const page = queryPageOf(state(), pageArgument(args));
    if (typeof page === 'string') return page;
    const item = findQueryItem(page, { id: args?.['id'], key: args?.['key'] });
    return typeof item === 'string' ? item : { page, item };
  };

  host.agent.registerTool({
    id: 'pangular:inspect-query',
    title: 'Inspect a TanStack query',
    outputSchema: MARKDOWN_OUTPUT_SCHEMA,
    description:
      "One TanStack Query query or mutation from pangular:list-queries, with its data read from the page now: status, fetch status, freshness and staleTime, when the data was last updated, observers, gcTime, failures and error, then the data (and a mutation's variables) serialized up to about 20,000 values. Secret-looking keys, JWTs and bearer tokens are masked. Pass `id`, or `key` to find a query whose key contains that text. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        id: { type: 'string', description: 'A query (q3) or mutation (m1) id.' },
        key: { type: 'string', description: 'Text the query key contains, when there is no id.' },
      },
    },
    handler: async (args: AnyRecord) => {
      const found = target(args);
      if (typeof found === 'string') return { markdown: found };
      const result = await request(found.page.pageId, { type: 'detail', id: found.item.id });
      return { markdown: inspectQueryText(found.page, found.item, result) };
    },
  });

  host.agent.registerTool({
    id: 'pangular:query-action',
    title: 'Invalidate or refetch a query',
    description:
      "Invalidate or refetch one TanStack Query query on the running page, through the app's own `QueryClient`. `invalidate` marks it stale (`invalidateQueries`), and a query with an active observer refetches at once; `refetch` fetches it again now (`refetchQueries`). Both call the query function, so they send the app's requests again. Needs `actions.tanstackQuery`. Pass `id` from pangular:list-queries, or `key`, and `page` when more than one tab reports.",
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['invalidate', 'refetch'] },
        page: PAGE_ARGUMENT,
        id: { type: 'string', description: 'A query id, such as q3.' },
        key: { type: 'string', description: 'Text the query key contains, when there is no id.' },
      },
    },
    handler: async (args: AnyRecord) => {
      const action = args?.['action'];
      if (action !== 'invalidate' && action !== 'refetch') {
        return { markdown: refusal('Pass `action`: `invalidate` or `refetch`.') };
      }
      if (!host.writes) return { markdown: host.blocked };
      const pages = Object.values(state().pages);
      const chosen = pageArgument(args);
      if (!chosen && pages.length > 1) return { markdown: choosePageText(pages, 'TanStack Query') };
      const found = target(args);
      if (typeof found === 'string') return { markdown: found };
      if (!found.item.id.startsWith('q')) {
        return {
          markdown: `${code(found.item.id)} is a mutation. Only queries can be invalidated or refetched.`,
        };
      }
      const result = await request(found.page.pageId, { type: action, id: found.item.id });
      return {
        markdown: result.error
          ? untrusted(`Not done: ${result.error}`)
          : untrusted(result.message ?? 'Done.'),
      };
    },
  });

  return {
    pages: () =>
      Object.values(state().pages).map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.url,
        title: page.title,
      })),
    expire: (now = Date.now()) => drop(staleQueryPages(state(), now, host.ttl)),
    state,
  };
}
