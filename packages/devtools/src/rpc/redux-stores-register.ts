import { createSharedState } from 'devframe/utils/shared-state';
import type { ReduxStoresState } from '../redux-stores-shared.ts';
import { PAGE_ARGUMENT, pageArgument } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';
import {
  inspectReduxStoresText,
  mergeReduxStoresReport,
  staleReduxStoresPages,
  toReduxStoresReport,
} from './redux-stores-tools.ts';

type AnyRecord = Record<string, any>;

export interface ReduxStoresHost {
  my: { rpc: { sharedState(name: string, options: AnyRecord): Promise<AnyRecord> } };
  /** devframe's RPC host, to drop a page the moment its connection closes. */
  rpcHost: unknown;
  /** Registers an RPC function, skipped when the NgRx inspector is off. */
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  /** Whether the connection of the current call owns the page (`rpc/page-owners.ts`). */
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
  /** `limits.changeLog`: entries kept per page. */
  maxLog: number;
}

export interface ReduxStoresRegistration {
  /** The pages that report stores, for `list-pages`. */
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  /** Drops pages that stopped reporting; call it from the shared expiry interval. */
  expire(now?: number): void;
  /** What every page reported, for `snapshot`. */
  state(): ReduxStoresState;
}

/**
 * Stores that report through the Redux DevTools API (NGXS, Elf, MiniRx), part
 * of the store inspector: the `redux-stores` shared state, the
 * `push-redux-stores` and `forget-redux-stores-page` RPC functions and the
 * `redux-inspect-stores` agent tool.
 */
export async function registerReduxStores(host: ReduxStoresHost): Promise<ReduxStoresRegistration> {
  const shared = await host.my.rpc.sharedState('redux-stores', {
    sharedState: createSharedState<ReduxStoresState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as ReduxStoresState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared['mutate']((draft: ReduxStoresState) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-redux-stores',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const report = toReduxStoresReport(message);
      if (!report || !host.owns(report.pageId)) return { seq: 0 };
      sessions.bind(report.pageId);
      let seq = 0;
      shared['mutate']((draft: ReduxStoresState) => {
        seq = mergeReduxStoresReport(draft, report, host.maxLog);
      });
      return { seq };
    },
  });

  host.register({
    name: 'forget-redux-stores-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  host.agent.registerTool({
    id: 'pangular:redux-inspect-stores',
    title: 'Inspect Redux DevTools stores',
    description:
      'Stores that report through the Redux DevTools API (NGXS, Elf, MiniRx). Without `store`: a table of stores. With `store`: its state and latest actions with diffs. For @ngrx use ngrx-inspect-store. Masked; only reads.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        store: { type: 'string', description: 'A store id (such as r1) or name.' },
        limit: { type: 'integer', description: 'Actions to list (1-200, default 20).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: inspectReduxStoresText(state(), {
        page: pageArgument(args),
        store: typeof args?.['store'] === 'string' ? args['store'] : undefined,
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
    expire: (now = Date.now()) => drop(staleReduxStoresPages(state(), now, host.ttl)),
    state,
  };
}
