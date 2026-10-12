/**
 * Layered layout for the signal graph: producers on the left, consumers on
 * the right. Each node sits one layer right of its furthest producer, and the
 * order inside a layer follows the average row of its producers (a few
 * barycenter sweeps), which keeps most edges short and uncrossed.
 */

export interface GraphLink {
  producer: string;
  consumer: string;
}

export interface PlacedNode {
  id: string;
  layer: number;
  row: number;
  x: number;
  y: number;
}

export interface PlacedEdge extends GraphLink {
  path: string;
}

export interface GraphLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  /** Node ids per layer, top to bottom. */
  layers: string[][];
  width: number;
  height: number;
}

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 44;
const GAP_X = 56;
const GAP_Y = 12;
const PAD = 8;
const SWEEPS = 4;

/** Most nodes the panel draws at once. */
export const MAX_DRAWN = 120;

function neighbours(ids: readonly string[], links: readonly GraphLink[]) {
  const known = new Set(ids);
  const producers = new Map(ids.map((id) => [id, [] as string[]]));
  const consumers = new Map(ids.map((id) => [id, [] as string[]]));
  for (const { producer, consumer } of links) {
    if (!known.has(producer) || !known.has(consumer) || producer === consumer) continue;
    producers.get(consumer)!.push(producer);
    consumers.get(producer)!.push(consumer);
  }
  return { producers, consumers };
}

/** Longest path from a node without producers; a cycle back-edge is ignored. */
function layersOf(ids: readonly string[], producers: Map<string, string[]>): Map<string, number> {
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return -1;
    visiting.add(id);
    let depth = 0;
    for (const producer of producers.get(id) ?? []) depth = Math.max(depth, visit(producer) + 1);
    visiting.delete(id);
    layer.set(id, depth);
    return depth;
  };
  for (const id of ids) visit(id);
  return layer;
}

export function layoutGraph(ids: readonly string[], links: readonly GraphLink[]): GraphLayout {
  const { producers, consumers } = neighbours(ids, links);
  const layerOf = layersOf(ids, producers);
  const layers: string[][] = [];
  for (const id of ids) (layers[layerOf.get(id)!] ??= []).push(id);
  for (let i = 0; i < layers.length; i++) layers[i] ??= [];

  const rowOf = new Map<string, number>();
  const number = (layer: string[]) => layer.forEach((id, row) => rowOf.set(id, row));
  layers.forEach(number);
  const order = (layer: string[], by: Map<string, string[]>) => {
    const centre = new Map<string, number>();
    for (const [row, id] of layer.entries()) {
      const rows = (by.get(id) ?? []).map((n) => rowOf.get(n)!);
      centre.set(id, rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : row);
    }
    // Array sort is stable, so ties keep their order and the layout does not jump.
    layer.sort((a, b) => centre.get(a)! - centre.get(b)!);
    number(layer);
  };
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let i = 1; i < layers.length; i++) order(layers[i]!, producers);
    for (let i = layers.length - 2; i >= 0; i--) order(layers[i]!, consumers);
  }

  const nodes: PlacedNode[] = [];
  const placed = new Map<string, PlacedNode>();
  for (const [layer, list] of layers.entries()) {
    for (const [row, id] of list.entries()) {
      const node = {
        id,
        layer,
        row,
        x: PAD + layer * (NODE_WIDTH + GAP_X),
        y: PAD + row * (NODE_HEIGHT + GAP_Y),
      };
      nodes.push(node);
      placed.set(id, node);
    }
  }
  const edges: PlacedEdge[] = [];
  for (const [consumer, list] of producers) {
    const to = placed.get(consumer)!;
    for (const producer of list) {
      const from = placed.get(producer)!;
      const x1 = from.x + NODE_WIDTH;
      const y1 = from.y + NODE_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_HEIGHT / 2;
      const bend = Math.max(24, (x2 - x1) / 2);
      edges.push({
        producer,
        consumer,
        path: `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`,
      });
    }
  }
  const tallest = Math.max(0, ...layers.map((list) => list.length));
  return {
    nodes,
    edges,
    layers,
    width: PAD * 2 + Math.max(1, layers.length) * (NODE_WIDTH + GAP_X) - GAP_X,
    height: PAD * 2 + Math.max(1, tallest) * (NODE_HEIGHT + GAP_Y) - GAP_Y,
  };
}

/** Every node `id` reads from, directly or not (upstream), and every node that reads it (downstream). */
export function chainOf(
  id: string,
  links: readonly GraphLink[],
): { upstream: Set<string>; downstream: Set<string> } {
  const walk = (from: keyof GraphLink, to: keyof GraphLink) => {
    const seen = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const current = queue.pop()!;
      for (const link of links) {
        if (link[from] !== current || seen.has(link[to]) || link[to] === id) continue;
        seen.add(link[to]);
        queue.push(link[to]);
      }
    }
    return seen;
  };
  return { upstream: walk('consumer', 'producer'), downstream: walk('producer', 'consumer') };
}

/**
 * The nodes to draw when there are more than `max`: the selected node with as
 * much of its chain as fits, otherwise the first `max`.
 */
export function drawnIds(
  ids: readonly string[],
  links: readonly GraphLink[],
  selected: string | null,
  max = MAX_DRAWN,
): string[] {
  if (ids.length <= max) return [...ids];
  if (!selected || !ids.includes(selected)) return ids.slice(0, max);
  const { upstream, downstream } = chainOf(selected, links);
  const keep = new Set([selected]);
  for (const id of [...upstream, ...downstream]) {
    if (keep.size >= max) break;
    keep.add(id);
  }
  return ids.filter((id) => keep.has(id));
}

export type GraphKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/**
 * Where focus goes from `current` for a key: up and down move inside a layer,
 * left moves to a producer and right to a consumer (the nearest by row, or
 * the nearest node of that layer when it has none), Home and End go to the
 * first and last node.
 */
export function moveFocus(
  layout: GraphLayout,
  links: readonly GraphLink[],
  current: string,
  key: GraphKey,
): string | null {
  const here = layout.nodes.find((n) => n.id === current);
  if (!here) return layout.nodes[0]?.id ?? null;
  if (key === 'Home') return layout.nodes[0]?.id ?? null;
  if (key === 'End') return layout.nodes.at(-1)?.id ?? null;
  const layer = layout.layers[here.layer] ?? [];
  if (key === 'ArrowUp') return layer[here.row - 1] ?? null;
  if (key === 'ArrowDown') return layer[here.row + 1] ?? null;
  const step = key === 'ArrowLeft' ? -1 : 1;
  const linked = new Set(
    links.flatMap((link) =>
      step < 0
        ? link.consumer === current
          ? [link.producer]
          : []
        : link.producer === current
          ? [link.consumer]
          : [],
    ),
  );
  const nearest = (candidates: PlacedNode[]) =>
    candidates.sort((a, b) => Math.abs(a.y - here.y) - Math.abs(b.y - here.y) || a.x - b.x)[0]
      ?.id ?? null;
  const direct = layout.nodes.filter((n) => linked.has(n.id));
  if (direct.length) return nearest(direct);
  return nearest(layout.nodes.filter((n) => n.layer === here.layer + step));
}
