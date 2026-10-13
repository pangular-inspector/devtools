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
    description:
      "Leak hints for the running page, in three parts. **Still retained**: component instances that left the page (destroyed) but are still in memory after at least 2 navigations and 10 seconds, with class, instance id, the route when destroyed, age and navigations since; the overlay holds them only through WeakRef and drops them once a FinalizationRegistry sees them collected. Garbage collection timing is up to the browser, so this is a hint to check retainers in the Chrome Memory panel, not proof of a leak. When the page's Angular keeps DI debug data (a development build of 16.2 or later, which has `ng.ɵgetInjectorProviders`), that data holds every destroyed component, so no instance is listed and the answer says retention is unavailable there and points to the Chrome Memory panel; older Angular lists them as above. Detached views (kept on purpose, such as by a RouteReuseStrategy) are listed apart. **Open subscriptions after destroy**: RxJS subscriptions a component made that are still open after it went away, grouped by class, instance and call site, only while subscription tracking is on (pangular:track-subscriptions). **Live effects and subscriptions** per component, from the signal graph Angular keeps (20.1+). Names and routes are masked like other live values. Empty when no page is connected.",
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
    description:
      'Start or stop tracking RxJS subscriptions on the running page, the same switch as Track subscriptions in the Components panel. While on, the overlay wraps `Observable.prototype.subscribe` to record which component made each subscription (from the call stack, and the instance through the Angular profiler on 20.0+), so pangular:find-leaks can count open subscriptions per component and flag those still open after their component is destroyed. Turning it off restores `subscribe`. Subscriptions made before tracking started are not seen; the choice survives a reload of the tab. `start` tracks the page `page` names, or the most recent page; `stop` stops that page, or every page without `page`.',
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
        return { markdown: 'Pass `action`: `start` or `stop`.' };
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
    expire: (now = Date.now()) => drop(staleLeakPages(state(), now, host.ttl)),
  };
}
