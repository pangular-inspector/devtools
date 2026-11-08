// The Signals inspector on the devframe server (`devframe.ts`): the
// `signal-graph` shared state, its push, ping and peek, watches, value
// restores and the `watch-signal` agent tool.

import type { ResolvedPangularConfig } from './config.ts';
import { unsupportedToolText, type AngularPages } from './rpc/angular-pages.ts';
import { rankPages } from './rpc/default-page.ts';
import type { PageOwners } from './rpc/page-owners.ts';
import { PAGE_ARGUMENT, pageArgument } from './rpc/pages.ts';
import { createSignalPeeks } from './rpc/signal-peeks.ts';
import { createSignalRestores } from './rpc/signal-restores.ts';
import {
  signalWatchRequest,
  watchSignalRequests,
  watchSignalText,
  type WatchSignalArgs,
} from './rpc/signal-watch-tools.ts';
import { signalOwner } from './signal-graph.ts';
import type { SignalChange } from './types.ts';
import type {
  AgentRegistrar,
  AnswersFor,
  Owns,
  PageGraph,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** The signal graph of each page, before any RPC function reads it. */
export async function createSignalState({ my }: { my: PangularScope }) {
  const signalGraphState = await my.rpc.sharedState('signal-graph', {
    initialValue: {
      graph: null as PageGraph | null,
      pages: {} as Record<string, PageGraph>,
      selectedNodeId: null as string | null,
    },
  });
  const signalPages = new Map<string, { graph: PageGraph; reportedAt: number }>();
  const signalPeeks = createSignalPeeks();

  const forgetSignalPages = (ids: string[]) => {
    for (const id of ids) signalPages.delete(id);
    signalGraphState.mutate((draft) => {
      for (const id of ids) delete draft.pages[id];
      const ownerId = draft.graph?.pageId;
      if (ownerId && ids.includes(ownerId)) {
        const latest = rankPages(
          [...signalPages].map(([pageId, entry]) => ({ ...entry, pageId })),
        )[0];
        draft.graph = latest?.graph ?? null;
      }
    });
  };

  return { signalGraphState, signalPages, signalPeeks, forgetSignalPages };
}

export type SignalState = Awaited<ReturnType<typeof createSignalState>>;

/** What `registerSignalRpc` reads from the devframe server's setup (`devframe.ts`). */
export interface SignalRpcEnv {
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  agent: AgentRegistrar;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  owners: PageOwners;
  angularPages: AngularPages;
  state: SignalState;
}

export function registerSignalRpc(env: SignalRpcEnv): void {
  const { my, config, register, agent, owns, mayForget, answersFor, owners, angularPages } = env;
  const { signalGraphState, signalPages, signalPeeks, forgetSignalPages } = env.state;
  register({
    name: 'select-signal-target',
    type: 'action',
    jsonSerializable: true,
    handler: (target: { pageId?: unknown; id?: unknown; env?: unknown } | null) => {
      const id = typeof target?.id === 'string' ? target.id.slice(0, 50) : null;
      const env = typeof target?.env === 'string' ? target.env.slice(0, 200) : undefined;
      const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
      void my.rpc.broadcast({
        method: 'select-signal-component',
        args: [env ? { pageId, env } : { pageId, id }],
        optional: true,
      });
    },
  });

  // Shared by the panel's Watch and Record write stacks buttons and the watch-signal agent tool.
  const sendSignalWatch = (message: unknown) => {
    const request = signalWatchRequest(message, signalPages);
    if (!request) return { pages: 0 };
    void my.rpc.broadcast({ method: 'signal-watch', args: [request], optional: true });
    return { pages: signalPages.has(request.pageId) ? 1 : 0, pageId: request.pageId };
  };

  register({
    name: 'set-signal-watch',
    type: 'action',
    jsonSerializable: true,
    handler: sendSignalWatch,
  });

  agent.registerTool({
    id: 'pangular:watch-signal',
    title: 'Watch a signal',
    description:
      'Watch a signal (`node`, id or label) so its changes log to the console and show in inspect-signals, or unwatch with `watch: false`; `stacks` toggles write stacks. Resets on reload.',
    inputSchema: {
      type: 'object',
      properties: {
        node: {
          type: 'string',
          description:
            'Node id or label from pangular:inspect-signals. A label watches every node with it.',
        },
        watch: {
          type: 'boolean',
          description: 'False stops watching `node`. Defaults to true.',
        },
        stacks: {
          type: 'boolean',
          description: 'True records write stacks on the page, false stops.',
        },
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (args: WatchSignalArgs) => {
      const unsupported = signalPages.size
        ? null
        : unsupportedToolText(angularPages.pick(pageArgument(args)), 'signalGraph');
      if (unsupported) return { markdown: unsupported };
      const asked = watchSignalRequests(args ?? {}, signalPages, pageArgument(args));
      if ('markdown' in asked) return asked;
      for (const request of asked.requests) sendSignalWatch({ ...request, pageId: asked.pageId });
      return { markdown: watchSignalText(args ?? {}, asked.pageId, asked.labels) };
    },
  });

  register({
    name: 'push-signal-graph',
    type: 'action',
    jsonSerializable: true,
    handler: (incoming: PageGraph & { historyDelta?: Record<string, SignalChange[]> }) => {
      const pageId = incoming?.pageId;
      const known = typeof pageId === 'string' && pageId.length < 50;
      if (known && !owners.write(pageId)) return { delta: true };
      const prev = known ? signalPages.get(pageId)?.graph : undefined;
      let graph: PageGraph = incoming;
      let delta = true;
      if (incoming?.historyDelta) {
        const { historyDelta, ...rest } = incoming;
        // Node ids are only unique per component or injector, so a delta for a new owner can't
        // build on the previous history.
        const base = prev && signalOwner(prev) === signalOwner(rest) ? prev : undefined;
        if (!base) delta = false;
        const history: Record<string, SignalChange[]> = {};
        for (const { id } of [...(rest.nodes ?? []), ...(rest.resources ?? [])]) {
          const list = [...(base?.history?.[id] ?? []), ...(historyDelta[id] ?? [])];
          if (list.length) history[id] = list.slice(-50);
        }
        graph = { ...rest, history };
      }
      if (known) signalPages.set(pageId, { graph, reportedAt: Date.now() });
      signalGraphState.mutate((draft) => {
        draft.graph = graph;
        // Every open page pushes, so one shared graph would flip between them.
        draft.pages = Object.fromEntries([...signalPages].map(([id, page]) => [id, page.graph]));
      });
      return { delta };
    },
  });

  register({
    name: 'ping-signal-graph',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      const page = owns(pageId) ? signalPages.get(pageId) : undefined;
      if (!page) return { known: false };
      signalPages.set(pageId as string, { ...page, reportedAt: Date.now() });
      return { known: true };
    },
  });

  register({
    name: 'signal-graph-peek-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const pageId = (message as { pageId?: unknown } | null)?.pageId;
      if (answersFor(undefined, pageId)) signalPeeks.answer(message);
    },
  });

  // The panel's Restore button on a signal's value history; the value stays on the page.
  const signalRestores = createSignalRestores({
    config,
    graphOf: (pageId) => signalPages.get(pageId)?.graph,
    broadcast: (method, message) =>
      void my.rpc.broadcast({ method, args: [message], optional: true }),
    answersFor,
  });
  register({
    name: 'signal-restore-result',
    type: 'action',
    jsonSerializable: true,
    handler: signalRestores.answer,
  });
  register({
    name: 'request-signal-restore',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown } | null) =>
      signalRestores.request(message?.pageId, message?.request),
  });

  register({
    name: 'forget-signal-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (mayForget(pageId) && signalPages.has(pageId)) forgetSignalPages([pageId]);
    },
  });
}
