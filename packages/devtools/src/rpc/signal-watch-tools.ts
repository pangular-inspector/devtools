import { MAX_WATCHED, type SignalWatchRequest } from '../signal-watch.ts';
import type { SignalGraph } from '../types.ts';
import { code, untrusted } from './forms-tools.ts';
import { byRecency, unknownPageText } from './pages.ts';
import { refusal } from './refusal.ts';

type SignalPages = ReadonlyMap<
  string,
  { graph: SignalGraph & { pageId?: string }; reportedAt: number }
>;

const WHAT = 'a signal graph';

/**
 * Reads a `set-signal-watch` message from the panel or the agent tool. A
 * request without a page goes to the page that reported a graph most recently,
 * so one request never changes every open tab. Undefined when there is
 * nothing to send.
 */
export function signalWatchRequest(
  message: unknown,
  pages: SignalPages,
): (SignalWatchRequest & { pageId: string }) | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const { pageId, id, watch, stacks, clear } = message as Record<string, unknown>;
  const request: SignalWatchRequest = {};
  if (typeof id === 'string' && id && id.length <= 50) {
    request.id = id;
    request.watch = watch !== false;
  }
  if (typeof stacks === 'boolean') request.stacks = stacks;
  if (clear === true) request.clear = true;
  if (!Object.keys(request).length) return undefined;
  const target =
    typeof pageId === 'string' && pageId && pageId.length < 50
      ? pageId
      : byRecency([...pages].map(([page, entry]) => ({ page, reportedAt: entry.reportedAt })))[0]
          ?.page;
  return target ? { ...request, pageId: target } : undefined;
}

export type WatchSignalArgs = {
  /** Node id or label on the page's current graph. */
  node?: string;
  /** False stops watching `node`. Defaults to true when `node` is set. */
  watch?: boolean;
  /** Turns write stacks on or off for the page. */
  stacks?: boolean;
  page?: string;
};

/**
 * What `watch-signal` sends for each matching node, or the markdown answer
 * when there is nothing to send.
 */
export function watchSignalRequests(
  args: WatchSignalArgs,
  pages: SignalPages,
  page: string | undefined,
): { pageId: string; requests: SignalWatchRequest[]; labels: string[] } | { markdown: string } {
  const all = byRecency([...pages].map(([pageId, entry]) => ({ pageId, ...entry })));
  if (page && !pages.has(page)) return { markdown: unknownPageText(page, all, WHAT) };
  const entry = page ? all.find((p) => p.pageId === page) : all[0];
  if (!entry) {
    return {
      markdown:
        'No page reports a signal graph, so there is nothing to watch. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser.',
    };
  }
  if (!args.node && typeof args.stacks !== 'boolean') {
    return {
      markdown: refusal(
        'Pass `node` (a node id or label) to watch, `stacks` (true or false), or both.',
      ),
    };
  }
  const requests: SignalWatchRequest[] = [];
  const labels: string[] = [];
  if (args.node) {
    const nodes = entry.graph.nodes;
    let found = nodes.filter((n) => n.id === args.node);
    if (!found.length) found = nodes.filter((n) => n.label === args.node);
    if (!found.length) {
      const names = nodes.slice(0, 30).map((n) => code(n.label ?? n.id));
      const known = names.length ? ` The graph has ${names.join(', ')}.` : '';
      return { markdown: untrusted(`No signal node ${code(args.node)} on this page.${known}`) };
    }
    for (const node of found.slice(0, MAX_WATCHED)) {
      requests.push({ id: node.id, watch: args.watch !== false });
      labels.push(node.label ?? node.id);
    }
  }
  if (typeof args.stacks === 'boolean') requests.push({ stacks: args.stacks });
  return { pageId: entry.pageId, requests, labels };
}

/** The answer once the requests were sent. */
export function watchSignalText(
  args: WatchSignalArgs,
  pageId: string,
  labels: readonly string[],
): string {
  const parts: string[] = [];
  if (labels.length) {
    const names = labels.map((label) => code(label)).join(', ');
    parts.push(
      args.watch === false
        ? `Stopped watching ${names} on page ${code(pageId)}.`
        : `Watching ${names} on page ${code(pageId)}. Each change logs to the page console and shows under Watched on the Signals page. Call pangular:inspect-signals with \`node\` for its value history.`,
    );
  }
  if (args.stacks === true) {
    parts.push(
      `Write stacks are on for page ${code(pageId)}: each exact (\`write\`) history entry of a named signal now carries \`stack\`, the first 3 app frames of the code that set it. Taking a stack slows every signal write, so turn it off when you are done.`,
    );
  } else if (args.stacks === false) {
    parts.push(`Write stacks are off for page ${code(pageId)}.`);
  }
  const text = parts.join('\n\n');
  return labels.length ? untrusted(text) : text;
}
