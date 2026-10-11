import { injectorMatches, type SignalTarget } from './signal-graph.ts';
import type { SignalChange, SignalGraph, SignalGraphNode } from './types.ts';

/**
 * One-shot reads of an environment injector's signal graph for the
 * inspect-signals agent tool. Unlike `select-signal-component`, a peek leaves
 * the page's selected target alone, so the Signals page keeps showing what the
 * user picked.
 */

/** Page event the server broadcasts to ask for one graph. */
export const PEEK_EVENT = 'peek-signal-graph';
/** Server action the page calls with the answer. */
export const PEEK_RESULT = 'signal-graph-peek-result';

export interface SignalPeekRequest {
  requestId: string;
  env: string;
  pageId?: string;
}

export interface SignalPeekAnswer {
  requestId: string;
  pageId: string;
  graph: (SignalGraph & { pageId: string }) | null;
}

interface PeekHistory {
  collect(nodes: SignalGraphNode[]): Record<string, SignalChange[]>;
  changesOf(id: string): number;
}

/** The request when it is well formed and meant for this page, otherwise undefined. */
export function toPeekRequest(request: unknown, pageId: string): SignalPeekRequest | undefined {
  if (!request || typeof request !== 'object') return undefined;
  const { requestId, env, pageId: forPage } = request as Record<string, unknown>;
  if (typeof requestId !== 'string' || !requestId || requestId.length > 50) return undefined;
  if (typeof env !== 'string' || !env || env.length > 500) return undefined;
  if (typeof forPage === 'string' && forPage && forPage !== pageId) return undefined;
  return { requestId, env };
}

/**
 * Collects the graph of the environment injector the request names. Answers
 * with `graph: null` when the page has no such injector, rather than the
 * component graph the collector falls back to.
 */
export function answerPeek(
  request: SignalPeekRequest,
  pageId: string,
  collect: (target: SignalTarget) => SignalGraph | null,
  history?: PeekHistory,
): SignalPeekAnswer {
  const graph = collect({ env: request.env });
  if (!graph?.injector || !injectorMatches(graph.injector, request.env)) {
    return { requestId: request.requestId, pageId, graph: null };
  }
  if (history) {
    const statuses = (graph.resources ?? [])
      .filter((r) => r.status)
      .map((r) => ({
        id: r.id,
        kind: 'resource' as const,
        label: r.name,
        epoch: r.epoch,
        value: r.status,
      }));
    graph.history = history.collect([...graph.nodes, ...statuses]);
    for (const item of [...graph.nodes, ...(graph.resources ?? [])]) {
      const changes = history.changesOf(item.id);
      if (changes) item.changes = changes;
    }
  }
  return { requestId: request.requestId, pageId, graph: { ...graph, pageId } };
}

interface PeekRpc {
  register(fn: {
    name: string;
    type: 'event';
    jsonSerializable: true;
    handler: (request: unknown) => void;
  }): unknown;
  call(name: string, ...args: unknown[]): Promise<unknown>;
}

/** Answers `peek-signal-graph` requests from the server on this page. */
export function registerSignalPeek(
  rpc: PeekRpc,
  pageId: string,
  collect: (target: SignalTarget) => SignalGraph | null,
  history?: PeekHistory,
): void {
  rpc.register({
    name: PEEK_EVENT,
    type: 'event',
    jsonSerializable: true,
    handler: (request: unknown) => {
      const wanted = toPeekRequest(request, pageId);
      if (!wanted) return;
      let answer: SignalPeekAnswer;
      try {
        answer = answerPeek(wanted, pageId, collect, history);
      } catch {
        answer = { requestId: wanted.requestId, pageId, graph: null };
      }
      void rpc.call(PEEK_RESULT, answer).catch(() => {});
    },
  });
}
