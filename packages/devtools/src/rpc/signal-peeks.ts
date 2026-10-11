import type { SignalGraph } from '../types.ts';

type PageGraph = SignalGraph & { pageId?: string };

/**
 * Pending one-shot graph reads for inspect-signals. The server broadcasts
 * `peek-signal-graph` with a `requestId`, and each page that is asked answers
 * through `signal-graph-peek-result`. Nothing here touches the shared
 * `signal-graph` state, so the Signals page keeps its selection.
 */
export function createSignalPeeks() {
  const pending = new Map<
    string,
    { pageId?: string; waiting: Set<string>; done: (graph: PageGraph | null) => void }
  >();
  let seq = 0;

  /**
   * Sends one request and resolves with the first graph a page returns, or
   * null when every page in `pages` answered without one or none answered
   * within `timeoutMs`. Empty answers from pages outside `pages` (an overlay
   * that never reported a graph) do not count toward that early null.
   */
  function request(
    send: (message: { requestId: string; env: string; pageId?: string }) => void,
    env: string,
    pageId: string | undefined,
    pages: readonly string[],
    timeoutMs: number,
  ): Promise<PageGraph | null> {
    if (!pages.length) return Promise.resolve(null);
    return new Promise((resolve) => {
      const requestId = `peek${++seq}`;
      const timer = setTimeout(() => done(null), timeoutMs);
      (timer as { unref?: () => void }).unref?.();
      const done = (graph: PageGraph | null) => {
        clearTimeout(timer);
        pending.delete(requestId);
        resolve(graph);
      };
      pending.set(requestId, { pageId, waiting: new Set(pages), done });
      send(pageId ? { requestId, env, pageId } : { requestId, env });
    });
  }

  /** Takes a page's answer; ignores unknown requests and answers from pages not asked. */
  function answer(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const { requestId, pageId, graph } = message as Record<string, unknown>;
    if (typeof requestId !== 'string' || typeof pageId !== 'string') return;
    const entry = pending.get(requestId);
    if (!entry || (entry.pageId && entry.pageId !== pageId)) return;
    if (graph && typeof graph === 'object' && Array.isArray((graph as PageGraph).nodes)) {
      entry.done({ ...(graph as PageGraph), pageId });
      return;
    }
    entry.waiting.delete(pageId);
    if (!entry.waiting.size) entry.done(null);
  }

  return { request, answer };
}
