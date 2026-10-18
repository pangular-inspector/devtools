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
import { refusal, refusedAnswer } from './refusal.ts';
import { defaultPage } from './default-page.ts';
import { code } from './forms-tools.ts';
import { createPushAcks } from './push-acks.ts';

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
  // A page confirms a tracking request by pushing its report with tracking on or off.
  const acks = createPushAcks<{ support: { subscriptions?: string } }>();

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
      acks.notify(report.pageId, report);
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
      'Leak hints for one page: destroyed components still in memory, subscriptions open after destroy (while track-subscriptions is on), and live effects and subscriptions per component. GC-dependent, so treat rows as hints.',
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
      'Start or stop tracking RxJS subscriptions (`action`), so find-leaks can count them per component. Wraps `Observable.prototype.subscribe` until stopped; survives a reload. `start` uses the default page; `stop` without `page` stops every page that tracks.',
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
      const on = action === 'start';
      const pages = Object.values(state().pages);
      const targets = page
        ? [page]
        : on
          ? [defaultPage(pages)?.pageId].filter((id): id is string => !!id)
          : pages.filter((entry) => entry.support.subscriptions === 'on').map((e) => e.pageId);
      if (!targets.length) {
        return refusedAnswer(
          on
            ? trackSubscriptionsText({ on }, 0)
            : 'No page is tracking subscriptions, so there is nothing to stop.',
        );
      }
      const wanted = on ? 'on' : 'off';
      const already = targets.filter((id) => state().pages[id]?.support.subscriptions === wanted);
      const pending = targets.filter((id) => !already.includes(id));
      const confirmed = acks.wait(pending, (report) =>
        on ? report.support.subscriptions !== 'off' : report.support.subscriptions === 'off',
      );
      if (pending.length) {
        requestTracking(targets.length === 1 ? { on, pageId: targets[0] } : { on });
      }
      const done = [...already, ...(await confirmed)];
      const working = done.filter((id) => !on || state().pages[id]?.support.subscriptions === 'on');
      if (!working.length) {
        const failed = done.length
          ? `RxJS could not be loaded on page ${code(done[0]!)}, so subscriptions are not tracked.`
          : `Page ${targets.map(code).join(', ')} did not confirm within 3s. The tab may be in the background or closed.`;
        return refusedAnswer(`Tracking was not ${on ? 'started' : 'stopped'}: ${failed}`);
      }
      return {
        markdown: working.map((id) => trackSubscriptionsText({ on, pageId: id }, 1)).join('\n\n'),
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
    state,
    expire: (now = Date.now()) => drop(staleLeakPages(state(), now, host.ttl)),
  };
}
