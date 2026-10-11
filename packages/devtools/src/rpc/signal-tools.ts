import type { SignalChange, SignalGraph, SignalGraphEdge, SignalGraphNode } from '../types.ts';

/** Longest inspect-signals answer, in characters, before the graph is cut to fit. */
export const SIGNAL_TOOL_MAX = 20_000;

/** History entries kept per node, tried in order until the graph fits. */
const HISTORY_STEPS = [20, 10, 5, 2, 1, 0];

export type InspectSignalsArgs = {
  /** Node id or label: keep that node and its direct producers and consumers. */
  node?: string;
  /** False drops the `history` arrays. Defaults to true. */
  history?: boolean;
};

type Graph = SignalGraph & { pageId?: string };

const NARROW =
  'Pass `node` with a node id or label to see one node with its producers and consumers, or `history: false` to leave out value history.';

/** Keeps the nodes at `keep` (indices into `graph.nodes`) and remaps edges, resources and history to them. */
function pick(graph: Graph, keep: number[]): Graph {
  const index = new Map(keep.map((from, to) => [from, to]));
  const nodes = keep.map((i) => graph.nodes[i]!);
  const ids = new Set(nodes.map((n) => n.id));
  const edges: SignalGraphEdge[] = [];
  for (const e of graph.edges) {
    const consumer = index.get(e.consumer);
    const producer = index.get(e.producer);
    if (consumer !== undefined && producer !== undefined) edges.push({ consumer, producer });
  }
  const out: Graph = { ...graph, nodes, edges };
  if (graph.resources) {
    const resources = graph.resources
      .filter((r) => r.nodeIds.some((id) => ids.has(id)))
      .map((r) => ({ ...r, nodeIds: r.nodeIds.filter((id) => ids.has(id)) }));
    if (resources.length) out.resources = resources;
    else delete out.resources;
  }
  if (graph.history) {
    const kept = new Set([...ids, ...(out.resources ?? []).map((r) => r.id)]);
    out.history = Object.fromEntries(Object.entries(graph.history).filter(([id]) => kept.has(id)));
  }
  return out;
}

/** The node matching `wanted` by id, else every node with that label, plus their direct neighbours. */
function neighbourhood(graph: Graph, wanted: string): Graph | null {
  let focus = graph.nodes.flatMap((n, i) => (n.id === wanted ? [i] : []));
  if (!focus.length) focus = graph.nodes.flatMap((n, i) => (n.label === wanted ? [i] : []));
  if (!focus.length) return null;
  const set = new Set(focus);
  const keep = new Set(focus);
  for (const e of graph.edges) {
    if (set.has(e.consumer)) keep.add(e.producer);
    if (set.has(e.producer)) keep.add(e.consumer);
  }
  const picked = pick(
    graph,
    [...keep].sort((a, b) => a - b),
  );
  // Only the edges that touch a focus node: neighbours may depend on each other too.
  const focusIds = new Set(focus.map((i) => graph.nodes[i]!.id));
  picked.edges = picked.edges.filter(
    (e) => focusIds.has(picked.nodes[e.consumer]!.id) || focusIds.has(picked.nodes[e.producer]!.id),
  );
  return picked;
}

function trimHistory(
  history: Record<string, SignalChange[]>,
  keep: number,
): Record<string, SignalChange[]> {
  return Object.fromEntries(
    Object.entries(history).map(([id, list]) => [id, keep ? list.slice(-keep) : []]),
  );
}

function entries(history: Record<string, SignalChange[]> | undefined): number {
  return Object.values(history ?? {}).reduce((sum, list) => sum + list.length, 0);
}

function knownNodes(nodes: SignalGraphNode[]): string {
  const names = nodes.slice(0, 30).map((n) => `\`${n.label ?? n.id}\``);
  const more = nodes.length > 30 ? ` and ${nodes.length - 30} more` : '';
  return names.length ? ` The graph has ${names.join(', ')}${more}.` : ' The graph has no nodes.';
}

/**
 * The inspect-signals answer for one graph: the graph as JSON, narrowed by
 * `node` and `history`, and cut to `budget` characters. A graph that fits is
 * returned as plain JSON. A cut one keeps fewer history entries per node,
 * then fewer nodes, and ends with a note on what was left out.
 */
export function signalGraphText(
  graph: Graph,
  args: InspectSignalsArgs = {},
  budget = SIGNAL_TOOL_MAX,
): string {
  let view: Graph = graph;
  if (args.node) {
    const narrowed = neighbourhood(graph, args.node);
    if (!narrowed)
      return `No signal node \`${args.node}\`.${knownNodes(graph.nodes)}`.slice(0, budget);
    view = narrowed;
  }
  if (args.history === false) {
    view = { ...view };
    delete view.history;
  }
  const full = JSON.stringify(view, null, 2);
  if (full.length <= budget) return full;

  // Leave room for the note that explains the cut.
  const room = budget - 600;
  const totalEntries = entries(view.history);
  let historyKept: number | null = null;
  let fitted: Graph = view;
  let text = full;
  if (view.history) {
    for (const keep of HISTORY_STEPS) {
      fitted = { ...view, history: trimHistory(view.history, keep) };
      text = JSON.stringify(fitted, null, 2);
      historyKept = keep;
      if (text.length <= room) break;
    }
  }

  let nodesKept = fitted.nodes.length;
  if (text.length > room) {
    // Largest prefix of nodes that fits, found by bisection.
    const all = fitted.nodes.map((_, i) => i);
    let low = 0;
    let high = all.length;
    let best = JSON.stringify(pick(fitted, []), null, 2);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const attempt = JSON.stringify(pick(fitted, all.slice(0, mid)), null, 2);
      if (attempt.length <= room) {
        low = mid;
        best = attempt;
      } else {
        high = mid - 1;
      }
    }
    nodesKept = low;
    text = best;
  }

  const cuts: string[] = [];
  if (historyKept !== null) {
    const omitted = totalEntries - entries(trimHistory(view.history ?? {}, historyKept));
    if (omitted > 0) {
      cuts.push(
        historyKept
          ? `kept the last ${historyKept} history entries per node and left out ${omitted} older ones`
          : `left out all ${omitted} history entries`,
      );
    }
  }
  if (nodesKept < view.nodes.length) {
    cuts.push(
      `kept the first ${nodesKept} of ${view.nodes.length} nodes and left out the other ${view.nodes.length - nodesKept}, with their edges, resources and history`,
    );
  }
  let sliced = false;
  if (text.length > room) {
    text = text.slice(0, room);
    sliced = true;
  }
  const what = cuts.length ? `: ${cuts.join('; ')}` : '';
  const broken = sliced ? ' The JSON above is cut short and does not parse.' : '';
  return `${text}\n\n_Cut to fit ${budget.toLocaleString('en-US')} characters (the full graph is ${full.length.toLocaleString('en-US')})${what}.${broken} ${NARROW}_`;
}
