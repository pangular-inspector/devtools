import { injectorMatches, type SignalTarget } from './signal-graph.ts';
import type { SignalChange, SignalGraph, SignalGraphNode } from './types.ts';

/**
 * One-shot reads of one injector's signal graph for the inspect-signals agent
 * tool: an environment injector (`env`), or a component's (`id` from the
 * component tree, or a CSS `selector` matching its host). Unlike `select-signal-component`, a peek leaves
 * the page's selected target alone, so the Signals page keeps showing what the
 * user picked.
 */

/** Page event the server broadcasts to ask for one graph. */
export const PEEK_EVENT = 'peek-signal-graph';
/** Server action the page calls with the answer. */
export const PEEK_RESULT = 'signal-graph-peek-result';

/** The injector a peek reads: exactly one of these. */
export type SignalPeekTarget = { env: string } | { id: string } | { selector: string };

export type SignalPeekRequest = SignalPeekTarget & { requestId: string; pageId?: string };

export interface SignalPeekAnswer {
  requestId: string;
  pageId: string;
  graph: (SignalGraph & { pageId: string }) | null;
}

interface PeekHistory {
  collect(nodes: SignalGraphNode[]): Record<string, SignalChange[]>;
  changesOf(id: string): number;
}

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && !!value && value.length <= max;

/** The request when it is well formed and meant for this page, otherwise undefined. */
export function toPeekRequest(request: unknown, pageId: string): SignalPeekRequest | undefined {
  if (!request || typeof request !== 'object') return undefined;
  const { requestId, env, id, selector, pageId: forPage } = request as Record<string, unknown>;
  if (!text(requestId, 50)) return undefined;
  if (typeof forPage === 'string' && forPage && forPage !== pageId) return undefined;
  const given = [env, id, selector].filter((value) => value !== undefined);
  if (given.length !== 1) return undefined;
  if (text(env, 500)) return { requestId, env };
  if (text(id, 100)) return { requestId, id };
  if (text(selector, 500)) return { requestId, selector };
  return undefined;
}

/** Whether the collected graph is the one the request asked for, not a fallback. */
function answers(graph: SignalGraph, request: SignalPeekRequest): boolean {
  if ('env' in request) return !!graph.injector && injectorMatches(graph.injector, request.env);
  // `selected` means the target resolved to a component host; anything else is a fallback.
  if (graph.source !== 'selected' || !graph.component) return false;
  return 'id' in request ? graph.component.id === request.id : true;
}

function targetOf(request: SignalPeekRequest): SignalTarget {
  if ('env' in request) return { env: request.env };
  if ('id' in request) return { id: request.id };
  return { selector: request.selector };
}

/**
 * Collects the graph of the injector the request names. Answers with
 * `graph: null` when the page has no such injector, or no component host
 * matches the id or selector, rather than the graph the collector falls back to.
 */
export function answerPeek(
  request: SignalPeekRequest,
  pageId: string,
  collect: (target: SignalTarget) => SignalGraph | null,
  history?: PeekHistory,
): SignalPeekAnswer {
  const graph = collect(targetOf(request));
  if (!graph || !answers(graph, request)) {
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
