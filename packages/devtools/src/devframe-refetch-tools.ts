// The TransferState refetch: the page renders its URL again on the server and
// pushes the payload it gets. The panel asks through an RPC function and
// agents through `refetch-transfer-state`.

import type { PayloadSummary } from './http-payload.ts';
import { actionBlockedMessage, type ResolvedPangularConfig } from './config.ts';
import { defaultPage } from './rpc/default-page.ts';
import { PAGE_ARGUMENT, pageArgument } from './rpc/pages.ts';
import { refusal } from './rpc/refusal.ts';
import { refetchAnswerText, sanitizeRefetchResult } from './rpc/ssr-override-tools.ts';
import type { HttpPage, HttpPayloadState } from './types.ts';
import type { AgentRegistrar, PangularScope, SharedState } from './devframe-env.ts';

/** What `registerRefetchTools` reads from the devframe server's setup (`devframe.ts`). */
export interface RegisterRefetchToolsEnv {
  agent: AgentRegistrar;
  /** Whether a message from `pageId` may answer for `target`. */
  answersFor: (target: string | undefined, pageId: unknown) => boolean;
  config: ResolvedPangularConfig;
  httpPages: Map<string, HttpPage>;
  httpPayloadState: SharedState<HttpPayloadState>;
  httpPayloads: Map<string, PayloadSummary>;
  my: PangularScope;
  register: PangularScope['rpc']['register'];
}

export function registerRefetchTools(env: RegisterRefetchToolsEnv): void {
  const { agent, answersFor, config, httpPages, httpPayloadState, httpPayloads, my, register } =
    env;
  // Refetch: the page renders its URL again on the server and pushes the payload it gets.
  const pendingRefetches = new Map<
    string,
    { pageId: string; settle: (result: Record<string, unknown>) => void }
  >();
  let refetchSeq = 0;
  const refetchPayloadOf = (page: string | undefined) =>
    new Promise<Record<string, unknown>>((resolve) => {
      if (!config.actions.http) return resolve({ error: actionBlockedMessage('http') });
      const target = page ? httpPages.get(page) : defaultPage(httpPages.values());
      if (!target) {
        return resolve({
          error: page
            ? `Page \`${page.slice(0, 50)}\` reports no HTTP data. pangular:list-pages lists the pages that are connected.`
            : 'No page reports HTTP data. Open the app in a browser with `withPangular()` in its HttpClient setup.',
        });
      }
      const requestId = `p${++refetchSeq}`;
      const timer = setTimeout(() => {
        pendingRefetches.delete(requestId);
        resolve({ error: 'The page did not answer within 15s. Is the tab still open?' });
      }, 15_000);
      timer.unref?.();
      pendingRefetches.set(requestId, {
        pageId: target.pageId,
        settle: (result) => {
          clearTimeout(timer);
          pendingRefetches.delete(requestId);
          resolve({ ...result, pageId: target.pageId });
        },
      });
      void my.rpc.broadcast({
        method: 'http-payload-refetch',
        args: [{ requestId, pageId: target.pageId }],
        optional: true,
      });
    });

  register({
    name: 'http-payload-refetch-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
      if (typeof message?.requestId !== 'string') return;
      const pending = pendingRefetches.get(message.requestId);
      if (!pending || !answersFor(pending.pageId, message.pageId)) return;
      const result = sanitizeRefetchResult(message.result);
      const stored = httpPayloads.get(pending.pageId);
      if (result['ok'] && stored) {
        const refetched = { ...stored, refetchedAt: Date.now() };
        httpPayloads.set(pending.pageId, refetched);
        httpPayloadState.mutate((draft) => {
          draft.pages[pending.pageId] = refetched;
        });
      }
      pending.settle(result);
    },
  });

  register({
    name: 'request-http-payload-refetch',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown } | undefined) =>
      refetchPayloadOf(typeof message?.pageId === 'string' ? message.pageId : undefined),
  });

  agent.registerTool({
    id: 'pangular:refetch-transfer-state',
    title: 'Refetch TransferState',
    description:
      "Renders the page's URL again on the server, with the tab's cookies, and replaces the TransferState payload the panel and `inspect-transfer-state` show with the one the server sends now. The tab itself does not reload. Needs actions.http.",
    inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
    handler: async (args: Record<string, unknown>) => {
      const result = await refetchPayloadOf(pageArgument(args));
      if (typeof result['error'] === 'string') return { markdown: refusal(result['error']) };
      return {
        markdown: refetchAnswerText(result, httpPayloads, httpPages.values()),
      };
    },
  });
}
