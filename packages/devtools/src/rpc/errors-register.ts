import { createSharedState } from 'devframe/utils/shared-state';
import {
  explainErrorText,
  listConsoleText,
  listErrorsText,
  mergeErrorsReport,
  staleErrorPages,
  toErrorsReport,
  type ErrorsState,
} from './errors-tools.ts';
import { PAGE_ARGUMENT, pageArgument } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';

type AnyRecord = Record<string, any>;

interface Scoped {
  rpc: {
    sharedState(name: string, options: AnyRecord): Promise<AnyRecord>;
  };
}

export interface ErrorsHost {
  my: Scoped;
  /** devframe's RPC host, to drop a page the moment its connection closes. */
  rpcHost: unknown;
  /** Registers an RPC function, skipped when the Errors inspector is off. */
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  /** Whether the connection of the current call owns the page (`rpc/page-owners.ts`). */
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
}

export interface ErrorsRegistration {
  /** The pages that report errors, for `list-pages`. */
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  /** Drops pages that stopped reporting; call it from the shared expiry interval. */
  expire(now?: number): void;
  /** What every page reported, for the audit. */
  state(): ErrorsState;
}

/**
 * The Errors inspector on the server: the `errors` shared state, the
 * `push-errors` and `forget-errors-page` RPC functions and the
 * `list-errors`, `explain-error` and `list-console` agent tools.
 */
export async function registerErrors(host: ErrorsHost): Promise<ErrorsRegistration> {
  // With patches on, a push sends the panel what changed, not every page.
  const shared = await host.my.rpc.sharedState('errors', {
    sharedState: createSharedState<ErrorsState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as ErrorsState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared['mutate']((draft: ErrorsState) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-errors',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const report = toErrorsReport(message);
      if (!report || !host.owns(report.pageId)) return { known: true };
      sessions.bind(report.pageId);
      let answer = { known: true };
      shared['mutate']((draft: ErrorsState) => {
        answer = mergeErrorsReport(draft, report);
      });
      return answer;
    },
  });

  host.register({
    name: 'forget-errors-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  host.agent.registerTool({
    id: 'pangular:list-errors',
    title: 'List errors',
    description:
      'Errors the page hit, grouped by message, newest first: id, count, last seen, Angular code with reference link, owning component and source (ErrorHandler, window or promise). Masked; 100 groups per page. Empty when there were none.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        code: {
          type: 'string',
          description: 'Only errors with this Angular code, such as NG0100.',
        },
        limit: { type: 'integer', description: 'How many groups to list (1-100, default 30).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: listErrorsText(state(), {
        page: pageArgument(args),
        code: typeof args?.['code'] === 'string' ? args['code'] : undefined,
        limit: args?.['limit'],
      }),
    }),
  });

  host.agent.registerTool({
    id: 'pangular:explain-error',
    title: 'Explain an error',
    description:
      "Explain an error from list-errors (`id`) or an Angular code (`code`, e.g. NG0100): message, stack, owning component and Angular's reference entry, with explainers for NG0100, NG0201 and NG0500-NG0503.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Error id from pangular:list-errors, such as e3.' },
        code: { type: 'string', description: 'An Angular error code, such as NG0100 or NG01203.' },
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: explainErrorText(state(), {
        id: typeof args?.['id'] === 'string' ? args['id'] : undefined,
        code: typeof args?.['code'] === 'string' ? args['code'] : undefined,
        page: pageArgument(args),
      }),
    }),
  });

  host.agent.registerTool({
    id: 'pangular:list-console',
    title: 'List console messages',
    description:
      'Console calls on the page, newest first: level, text and Angular code. Filter by `level`, `search` and `since` (e.g. 5m). Repeats collapse; the page keeps its last 200 calls. Masked. Empty when no page is connected.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        level: {
          type: 'string',
          enum: ['log', 'info', 'warn', 'error', 'debug'],
          description: 'Only calls at this level.',
        },
        search: { type: 'string', description: 'Only calls whose text contains this, any case.' },
        since: {
          type: 'string',
          description:
            'Only calls made since then: a duration back from now (30s, 5m, 1h), an ISO date, or epoch milliseconds. A call repeated in a row counts from its last repeat.',
        },
        limit: { type: 'integer', description: 'How many calls to list (1-200, default 50).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: listConsoleText(state(), {
        page: pageArgument(args),
        level: typeof args?.['level'] === 'string' ? args['level'] : undefined,
        search: typeof args?.['search'] === 'string' ? args['search'] : undefined,
        since: args?.['since'],
        limit: args?.['limit'],
      }),
    }),
  });

  return {
    pages: () =>
      Object.values(state().pages).map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.url,
        title: page.title,
      })),
    state,
    expire: (now = Date.now()) => drop(staleErrorPages(state(), now, host.ttl)),
  };
}
