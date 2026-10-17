import { createSharedState } from 'devframe/utils/shared-state';
import {
  findLeaksText,
  leakTrackingRequest,
  staleLeakPages,
  toLeaksReport,
  trackSubscriptionsText,
  type LeaksState,
} from './leaks-tools.ts';
import { PAGE_ARGUMENT, pageArgument } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';
import { refusal } from './refusal.ts';

type AnyRecord = Record<string, any>;

interface Scoped {
  rpc: {
    sharedState(name: string, options: AnyRecord): Promise<AnyRecord>;
    broadcast(message: { method: string; args: unknown[]; optional?: boolean }): unknown;
  };
}

export interface LeaksHost {
  my: Scoped;
  /** devframe's RPC host, to drop a page the moment its connection closes. */
  rpcHost: unknown;
  /** Registers an RPC function, skipped when the Components inspector is off. */
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  /** Whether the connection of the current call owns the page (`rpc/page-owners.ts`). */
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
}

export interface LeaksRegistration {
  /** The pages that report leak data, for `list-pages`. */
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  /** Drops pages that stopped reporting; call it from the shared expiry interval. */
  expire(now?: number): void;
  /** What every page reported, for the audit. */
  state(): LeaksState;
}

/**
 * Leak hints on the server, part of the Components inspector: the `leaks`
 * shared state, the `push-leaks`, `forget-leaks-page` and
 * `request-leak-tracking` RPC functions, and the `find-leaks` and
 * `track-subscriptions` agent tools.
 */
export async function registerLeaks(host: LeaksHost): Promise<LeaksRegistration> {
  const shared = await host.my.rpc.sharedState('leaks', {
    sharedState: createSharedState<LeaksState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as LeaksState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared['mutate']((draft: LeaksState) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-leaks',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const report = toLeaksReport(message);
      if (!report || !host.owns(report.pageId)) return { known: true };
      sessions.bind(report.pageId);
      shared['mutate']((draft: LeaksState) => {
        draft.pages[report.pageId] = { ...report, reportedAt: Date.now() };
      });
      return { known: true };
    },
  });

  host.register({
    name: 'forget-leaks-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  // Shared by the panel's Track subscriptions button and the track-subscriptions agent tool.
  const requestTracking = (message: unknown) => {
    const request = leakTrackingRequest(message, Object.values(state().pages));
    // No page reports yet: starting now would patch every connected tab.
    if (request.on && !request.pageId) return { request, pages: 0 };
    const pages = request.pageId
      ? state().pages[request.pageId]
        ? 1
        : 0
      : Object.keys(state().pages).length;
    if (request.pageId) {
      void host.my.rpc.broadcast({ method: 'leak-tracking', args: [request], optional: true });
    } else {
      // Off for every page: each page answers only to its own id.
      for (const pageId of Object.keys(state().pages)) {
        void host.my.rpc.broadcast({
          method: 'leak-tracking',
          args: [{ pageId, on: false }],
          optional: true,
        });
      }
    }
    return { request, pages };
  };

  host.register({
    name: 'request-leak-tracking',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => ({ pages: requestTracking(message).pages }),
  });

  host.agent.registerTool({
    id: 'pangular:find-leaks',
    title: 'Find memory leaks',
    description:
      'Leak hints for one page (`page`, or the most recent that reports leaks): destroyed components still in memory after 2 navigations and 10 seconds (class, instance id, route, age), detached views apart; subscriptions still open after destroy, only while pangular:track-subscriptions is on; and live effects and subscriptions per component (Angular 20.1+). GC timing is up to the browser, so retained rows are hints to check in the Chrome Memory panel. Dev builds of Angular 16.2+ keep destroyed components in DI debug data, so retention is not judged there. Names and routes are masked.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        component: {
          type: 'string',
          description: 'Only components whose class name contains this, any case.',
        },
        limit: { type: 'integer', description: 'Rows per table (1-200, default 20).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: findLeaksText(state(), {
        page: pageArgument(args),
        component: typeof args?.['component'] === 'string' ? args['component'] : undefined,
        limit: args?.['limit'],
      }),
    }),
  });

  host.agent.registerTool({
    id: 'pangular:track-subscriptions',
    title: 'Track subscriptions',
    description:
      'Start or stop tracking RxJS subscriptions on the running page (`action`: `start` or `stop`). While on, the overlay wraps `Observable.prototype.subscribe` to record which component made each subscription, so pangular:find-leaks can count open ones per component and flag those still open after destroy; stopping restores `subscribe`. Subscriptions made before tracking started are not seen, and the choice survives a reload. `start` tracks the page `page` names, or the most recent page; `stop` stops that page, or every page without `page`.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop'] },
        page: PAGE_ARGUMENT,
      },
      required: ['action'],
    },
    handler: async (args: AnyRecord) => {
      const action = args?.['action'];
      if (action !== 'start' && action !== 'stop') {
        return { markdown: refusal('Pass `action`: `start` or `stop`.') };
      }
      const page = pageArgument(args);
      if (page && !state().pages[page]) {
        return {
          markdown: findLeaksText(state(), { page }),
        };
      }
      const sent = requestTracking({ on: action === 'start', ...(page ? { pageId: page } : {}) });
      return { markdown: trackSubscriptionsText(sent.request, sent.pages) };
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
    state,
    expire: (now = Date.now()) => drop(staleLeakPages(state(), now, host.ttl)),
  };
}
