// The NgRx inspector on the devframe server (`devframe.ts`): the `ngrx-store`
// shared state, the requests a page answers (dispatch, history, sessions) and
// the signal store and Store agent tools.

import { actionBlockedMessage, type ResolvedPangularConfig } from './config.ts';
import {
  dispatchProblem,
  type NgrxRequest,
  type NgrxRequestResult,
  type NgrxState,
} from './ngrx-shared.ts';
import { defaultPage } from './rpc/default-page.ts';
import { scanNgrxStore } from './rpc/get-ngrx-store.ts';
import { createNgrxDevtoolsTools } from './rpc/ngrx-devtools-tools.ts';
import {
  INSPECT_SIGNAL_STORE_DESCRIPTION,
  SIGNAL_STORE_HISTORY_DESCRIPTION,
  inspectSignalStoreText,
  signalStoreHistoryText,
  storeIdNamed,
  withUntrustedPreamble,
} from './rpc/ngrx-live-tools.ts';
import { createNgrxHistory } from './rpc/ngrx-session-tools.ts';
import {
  dispatchResultText,
  isNgrxReport,
  mergeNgrxReport,
  ngrxStateOf,
  type NgrxDeclaration,
  type NgrxPages,
} from './rpc/ngrx-tools.ts';
import {
  PAGE_ARGUMENT,
  byRecency,
  choosePageText,
  pageArgument,
  unknownPageText,
} from './rpc/pages.ts';
import { refusal } from './rpc/refusal.ts';
import type { PageDirectory } from './devframe-pages.ts';
import type {
  AgentRegistrar,
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** The NgRx state of each page, before any RPC function reads it. */
export async function createNgrxState({
  ctx,
  my,
}: {
  ctx: DevframeNodeContext;
  my: PangularScope;
}) {
  const ngrxStoreState = await my.rpc.sharedState('ngrx-store', {
    initialValue: { pages: [] } as NgrxState,
  });
  const ngrxPages: NgrxPages = new Map();
  /** The page an NgRx read tool reads: `page`; else, unless `store` names a store, the default page. */
  const ngrxReadPage = (args: { page?: string; store?: string } | undefined) =>
    args?.page || (args?.store ? undefined : defaultPage(ngrxPages.values())?.pageId);
  let ngrxDeclarations: { at: number; list: NgrxDeclaration[] } = { at: 0, list: [] };
  const ngrxNames = () => {
    if (Date.now() - ngrxDeclarations.at > 10_000) {
      let list: NgrxDeclaration[] = [];
      try {
        list = scanNgrxStore(ctx.cwd).filter((e) => e.kind === 'signal-store');
      } catch {
        list = [];
      }
      ngrxDeclarations = { at: Date.now(), list };
    }
    return ngrxDeclarations.list;
  };
  const applyNgrx = () =>
    ngrxStoreState.mutate((draft) => {
      draft.pages = ngrxStateOf(ngrxPages).pages as never;
    });

  return { ngrxStoreState, ngrxPages, ngrxReadPage, ngrxNames, applyNgrx };
}

export type NgrxStateHolder = Awaited<ReturnType<typeof createNgrxState>>;

/** What `registerNgrxRpc` reads from the devframe server's setup (`devframe.ts`). */
export interface NgrxRpcEnv {
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  withPageUrls: PageDirectory['withPageUrls'];
  state: NgrxStateHolder;
}

/** The pushes and the requests a page answers: actions, history, sessions. */
export function registerNgrxRpc(env: NgrxRpcEnv) {
  const { my, config, register, owns, mayForget, answersFor, withPageUrls } = env;
  const limits = config.limits;
  const { ngrxPages, ngrxNames, applyNgrx } = env.state;
  register({
    name: 'push-ngrx-state',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      if (!isNgrxReport(report) || !owns(report.pageId)) return { seq: 0 };
      const seq = mergeNgrxReport(ngrxPages, report, ngrxNames(), Date.now(), limits.changeLog);
      applyNgrx();
      return { seq };
    },
  });

  register({
    name: 'forget-ngrx-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (mayForget(pageId) && ngrxPages.delete(pageId)) applyNgrx();
    },
  });

  const pendingNgrx = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let ngrxSeq = 0;

  register({
    name: 'ngrx-action-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
      if (typeof message?.requestId !== 'string') return;
      const pending = pendingNgrx.get(message.requestId);
      if (pending && answersFor(pending.pageId, message.pageId)) pending.settle(message.result);
    },
  });

  const requestNgrxAction = (page: unknown, request: unknown) =>
    new Promise<NgrxRequestResult>((resolve) => {
      const kind = (request as { type?: unknown } | null)?.type;
      // Reading an entry's state or exporting a session changes nothing, so writes off allow it.
      const reads = kind === 'entry' || kind === 'export';
      if (!reads && !config.actions.ngrx) return resolve({ error: actionBlockedMessage('ngrx') });
      const all = ngrxStateOf(ngrxPages).pages;
      // A restore can target a signal store; every other request needs the classic Store.
      const pages = kind === 'restore' || reads ? all : all.filter((p) => p.classic);
      // Without a page, a write would reach every tab, or one the caller did not choose.
      if (typeof page !== 'string' && pages.length !== 1 && !(reads && pages.length)) {
        return resolve({
          error: pages.length
            ? choosePageText(withPageUrls(pages), 'NgRx state')
            : 'No page reports NgRx state. Open the app in a browser, or pass the page id.',
        });
      }
      if (typeof page === 'string' && !all.some((p) => p.pageId === page)) {
        return resolve({
          error: `Page \`${page.slice(0, 50)}\` reports no NgRx state. pangular:list-pages lists the pages that do.`,
        });
      }
      const pageId = typeof page === 'string' ? page : defaultPage(pages)!.pageId;
      const requestId = `n${++ngrxSeq}`;
      const timer = setTimeout(() => {
        pendingNgrx.delete(requestId);
        resolve({
          error:
            'No page answered within 10s. Is the app open in a browser, or the device app in the foreground?',
        });
      }, 10_000);
      timer.unref?.();
      pendingNgrx.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pendingNgrx.delete(requestId);
          resolve((result ?? {}) as NgrxRequestResult);
        },
      });
      void my.rpc.broadcast({
        method: 'ngrx-action',
        args: [{ requestId, pageId, request }],
        optional: true,
      });
    });

  register({
    name: 'request-ngrx-action',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown }) =>
      requestNgrxAction(message?.pageId, message?.request),
  });

  // Past entries, session export and import, and generated tests (rpc/ngrx-session-tools.ts).
  const ngrxHistory = createNgrxHistory({
    ask: (page, request) => requestNgrxAction(page, request),
    page: (pageId) => ngrxPages.get(pageId),
    pages: () => byRecency(ngrxPages.values()),
  });
  register({
    name: 'request-ngrx-history',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => ngrxHistory.history(message),
  });
  register({
    name: 'import-ngrx-session',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { session?: unknown } | null) => ngrxHistory.importSession(message?.session),
  });

  return { requestNgrxAction, ngrxHistory };
}

export type NgrxRpc = ReturnType<typeof registerNgrxRpc>;

/** The signal store read tools: `ngrx-inspect-store` and `ngrx-history`. */
export function registerNgrxReadTools(env: {
  agent: AgentRegistrar;
  state: NgrxStateHolder;
}): void {
  const { agent } = env;
  const { ngrxPages, ngrxReadPage } = env.state;
  const ngrxPageProperty = {
    type: 'string',
    description: 'Page id, when more than one tab reports. Defaults to every page.',
  } as const;

  agent.registerTool({
    id: 'pangular:ngrx-inspect-store',
    title: 'Inspect a signal store',
    description: INSPECT_SIGNAL_STORE_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        page: ngrxPageProperty,
        store: {
          type: 'string',
          description:
            'Store id or name (e.g. `ngrx-1` or `CartStore`, as shown on the NgRx Store page or returned by a previous call). Omit for a summary of every store across the matching page(s).',
        },
      },
    },
    handler: async (args: { page?: string; store?: string }) => ({
      markdown: withUntrustedPreamble(
        inspectSignalStoreText(
          ngrxPages,
          ngrxReadPage(args),
          storeIdNamed(ngrxPages, ngrxReadPage(args), args?.store),
        ),
      ),
    }),
  });

  agent.registerTool({
    id: 'pangular:ngrx-history',
    title: 'Show signal store history',
    description: SIGNAL_STORE_HISTORY_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        page: ngrxPageProperty,
        store: {
          type: 'string',
          description:
            'Store id or name to filter the log to. Omit to include every store, plus `@ngrx/signals/events` events with no store effect.',
        },
        after: {
          type: 'number',
          description:
            'Only return entries whose `seq` is strictly greater than this. Pass the last `seq` from a previous call to poll.',
        },
      },
    },
    handler: async (args: { page?: string; store?: string; after?: number }) => ({
      markdown: withUntrustedPreamble(
        signalStoreHistoryText(
          ngrxPages,
          ngrxReadPage(args),
          storeIdNamed(ngrxPages, ngrxReadPage(args), args?.store),
          args?.after,
        ),
      ),
    }),
  });
}

/** `ngrx-dispatch`, the session tools and the Store DevTools tools. */
export function registerNgrxDispatchTools(env: {
  agent: AgentRegistrar;
  state: NgrxStateHolder;
  rpc: NgrxRpc;
  withPageUrls: PageDirectory['withPageUrls'];
}): void {
  const { agent, withPageUrls } = env;
  const { ngrxPages } = env.state;
  const { requestNgrxAction, ngrxHistory } = env.rpc;
  agent.registerTool({
    id: 'pangular:ngrx-dispatch',
    title: 'Dispatch an NgRx action',
    description:
      'Dispatch an action (`type`, `payload`) or redispatch a logged one (`seq`) to the @ngrx/store Store (dev only); returns the log entry with origin and diff. Needs `page` when several tabs have a Store, and actions.ngrx.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        type: { type: 'string', description: 'Action type, for example "[Cart] Add Item".' },
        payload: {
          type: 'object',
          description: 'Action props as a JSON object, for example {"id": 7}. No "type" key.',
        },
        seq: {
          type: 'integer',
          description: 'Log entry number of an action to dispatch again, instead of type.',
        },
      },
    },
    handler: async (args: { page?: string; type?: unknown; payload?: unknown; seq?: unknown }) => {
      const pages = ngrxStateOf(ngrxPages).pages;
      const page = pageArgument(args);
      if (page && !ngrxPages.has(page)) {
        return { markdown: unknownPageText(page, pages, 'NgRx state') };
      }
      const stores = pages.filter((p) => p.classic);
      // A dispatch changes the app, so it never picks one of several tabs on its own.
      if (!page && stores.length > 1) {
        return { markdown: choosePageText(withPageUrls(stores), 'an @ngrx/store Store') };
      }
      const target = page ? ngrxPages.get(page) : defaultPage(stores);
      if (!target?.classic) {
        return {
          markdown: refusal(
            page
              ? `Page \`${page}\` has no @ngrx/store Store, so there is nothing to dispatch to.`
              : 'No connected page has an @ngrx/store Store. Open the app in a browser; the Store shows up once provideStore() or StoreModule.forRoot() runs.',
          ),
        };
      }
      let request: NgrxRequest;
      if (args.seq !== undefined) {
        if (!Number.isInteger(args.seq))
          return { markdown: refusal('seq must be a log entry number.') };
        request = { type: 'dispatch-again', seq: args.seq as number };
      } else {
        const problem = dispatchProblem(args.type, args.payload);
        if (problem) return { markdown: refusal(problem) };
        request = {
          type: 'dispatch',
          action: args.type as string,
          ...(args.payload !== undefined
            ? { payload: args.payload as Record<string, unknown> }
            : {}),
        };
      }
      return { markdown: dispatchResultText(await requestNgrxAction(target.pageId, request)) };
    },
  });

  for (const tool of ngrxHistory.tools) agent.registerTool(tool);
  // Store DevTools history operations and the explain-change read (rpc/ngrx-devtools-tools.ts).
  for (const tool of createNgrxDevtoolsTools({
    ask: (page, request) => requestNgrxAction(page, request),
    pages: () => ngrxPages,
  })) {
    agent.registerTool(tool);
  }
}
