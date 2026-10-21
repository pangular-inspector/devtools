import { isEnvironmentRequest } from '../signal-graph.ts';
import type { SignalPeekTarget } from '../signal-peek.ts';
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
    send: (message: SignalPeekTarget & { requestId: string; pageId?: string }) => void,
    target: SignalPeekTarget,
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
      send(pageId ? { requestId, ...target, pageId } : { requestId, ...target });
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

/** A component tree match, as `findComponents` returns it. */
interface ComponentHit {
  pageId: string;
  node: { id: string; kind?: string };
}

/**
 * What inspect-signals asks the page for when no pushed graph matches: the
 * CSS `selector` as given, an environment injector for `root`, a route path
 * or an injector id, or the first component instance `hits` found for a tag,
 * class name or instance id. `pageId` is the page that instance is on. Null
 * when nothing can be asked: the component tree has no such component.
 */
export function signalPeekFor(
  args: { component?: string; selector?: string },
  hits: readonly ComponentHit[],
): { target: SignalPeekTarget; pageId?: string } | null {
  if (args.selector !== undefined) return { target: { selector: args.selector } };
  const wanted = args.component ?? '';
  if (isEnvironmentRequest(wanted)) return { target: { env: wanted } };
  const hit = hits.find((entry) => entry.node.kind !== 'directive');
  return hit ? { target: { id: hit.node.id }, pageId: hit.pageId } : null;
}

/** The inspect-signals refusal for a CSS selector that matched no component host. */
export function noSelectorMatchText(selector: string, pageId: string | undefined): string {
  return `No component host matches the CSS selector \`${selector}\`${pageId ? ` on page \`${pageId}\`` : ''}, so there is no signal graph to read. The selector must match the host element of a component. Pass a class name or instance id from pangular:list-components as \`component\` instead.`;
}
