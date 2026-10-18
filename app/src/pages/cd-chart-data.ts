import type {
  CdComponentStat,
  CdCycle,
  CdSpanKind,
} from '@pangular-inspector/devtools/internal/config';

/** One frame at 60 frames per second. A cycle longer than this can drop a frame. */
export const FRAME_BUDGET_MS = 16.6;

/** A range of recorded cycles by cycle id, both ends included. */
export interface CdRange {
  from: number;
  to: number;
}

export function overBudget(cycle: Pick<CdCycle, 'ms'>): boolean {
  return cycle.ms > FRAME_BUDGET_MS;
}

/** Formats a duration the way the recording view does. */
export function formatMs(value: number): string {
  return `${value < 10 ? value.toFixed(2) : Math.round(value)} ms`;
}

/**
 * The cycles a range covers. No range, or one whose ends are no longer
 * recorded, covers every cycle.
 */
export function cyclesInRange(cycles: readonly CdCycle[], range: CdRange | null): CdCycle[] {
  if (!range) return [...cycles];
  const from = Math.min(range.from, range.to);
  const to = Math.max(range.from, range.to);
  const picked = cycles.filter((cycle) => cycle.id >= from && cycle.id <= to);
  return picked.length ? picked : [...cycles];
}

/**
 * Totals per component class over some cycles, slowest self time first.
 * Each cycle lists only its slowest components, so these totals leave out
 * the components a cycle did not list.
 */
export function aggregateComponents(cycles: readonly CdCycle[]): CdComponentStat[] {
  const totals = new Map<string, CdComponentStat>();
  for (const cycle of cycles) {
    for (const check of cycle.components) {
      const stat = totals.get(check.name);
      if (stat) {
        stat.checks += check.checks;
        stat.ms += check.ms;
        stat.maxMs = Math.max(stat.maxMs, check.ms);
        stat.cycles += 1;
      } else {
        totals.set(check.name, {
          name: check.name,
          checks: check.checks,
          ms: check.ms,
          maxMs: check.ms,
          cycles: 1,
        });
      }
    }
  }
  return [...totals.values()].sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name));
}

/** The top of the bar chart's scale: the slowest cycle, with room above the budget line. */
export function chartMax(cycles: readonly CdCycle[]): number {
  const slowest = cycles.reduce((max, cycle) => Math.max(max, cycle.ms), 0);
  return Math.max(slowest, FRAME_BUDGET_MS * 1.25);
}

/** A treemap cell in percent of the map's width and height. */
export interface TreemapCell<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lays out items as a squarified treemap, each cell's area proportional to its
 * value. `aspect` is the map's width over its height, so cells come out close
 * to square at that shape. Items without a positive value are left out.
 */
export function squarify<T>(
  items: readonly T[],
  value: (item: T) => number,
  aspect = 3,
): TreemapCell<T>[] {
  const entries = items
    .map((item) => ({ item, value: value(item) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (!total) return [];
  // Work in a box `aspect` wide and 1 tall, then convert to percent.
  const scale = aspect / total;
  const cells: TreemapCell<T>[] = [];
  let x = 0;
  let y = 0;
  let w = aspect;
  let h = 1;
  let row: { item: T; area: number }[] = [];

  const worst = (areas: number[], side: number) => {
    const sum = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const place = () => {
    const sum = row.reduce((a, b) => a + b.area, 0);
    if (w >= h) {
      // A column on the left, as wide as the row's area over the height.
      const colW = sum / h;
      let cy = y;
      for (const entry of row) {
        const ch = entry.area / colW;
        cells.push({ item: entry.item, x, y: cy, w: colW, h: ch });
        cy += ch;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = sum / w;
      let cx = x;
      for (const entry of row) {
        const cw = entry.area / rowH;
        cells.push({ item: entry.item, x: cx, y, w: cw, h: rowH });
        cx += cw;
      }
      y += rowH;
      h -= rowH;
    }
    row = [];
  };

  for (const entry of entries) {
    const area = entry.value * scale;
    const side = Math.min(w, h);
    const current = row.map((r) => r.area);
    if (row.length && worst([...current, area], side) > worst(current, side)) place();
    row.push({ item: entry.item, area });
  }
  if (row.length) place();

  return cells.map((cell) => ({
    item: cell.item,
    x: (cell.x / aspect) * 100,
    y: cell.y * 100,
    w: (cell.w / aspect) * 100,
    h: cell.h * 100,
  }));
}

export const SPAN_KIND: Record<CdSpanKind, string> = {
  c: 'component',
  h: 'hook',
  r: 'afterRender',
  o: 'output',
};

/** At most this many picked cycles are drawn as a flame graph. */
export const FLAME_MAX_CYCLES = 30;

/**
 * The component class a span belongs to: the class for a component check, the
 * part before the hook for a hook (`Cart.ngDoCheck`), the owner for an output
 * listener (`Cart (onAdd)`), and none for afterRender.
 */
export function spanComponent(name: string, kind: CdSpanKind): string | null {
  if (kind === 'c') return name || null;
  if (kind === 'h') {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : null;
  }
  if (kind === 'o') {
    const paren = name.indexOf(' (');
    const owner = paren > 0 ? name.slice(0, paren) : name;
    return owner && owner !== '?' ? owner : null;
  }
  return null;
}

/** A flame graph block in percent of the graph's width, with its row. */
export interface FlameBlock {
  /** Position in the flat list, which is in cycle, then start order. */
  index: number;
  cycleId: number;
  name: string;
  kind: CdSpanKind;
  start: number;
  ms: number;
  /** `ms` less the time of the spans nested directly in it. */
  selfMs: number;
  depth: number;
  parent: number | null;
  /** The component class to show in the tree, when the span has one. */
  component: string | null;
  x: number;
  w: number;
}

export interface FlameCycle {
  id: number;
  x: number;
  w: number;
  droppedSpans: number;
}

export interface FlameGraph {
  blocks: FlameBlock[];
  cycles: FlameCycle[];
  depth: number;
  totalMs: number;
}

/**
 * Lays out the spans of some cycles side by side on one time axis. Each cycle
 * takes the width of its own duration, from its earliest span (a triggering
 * output can start before the cycle) to its end. Returns null when no cycle
 * has spans.
 */
export function buildFlame(
  cycles: readonly CdCycle[],
  names: readonly string[],
): FlameGraph | null {
  const withSpans = cycles.filter((cycle) => cycle.spans?.length);
  if (!withSpans.length) return null;
  const extents = withSpans.map((cycle) => {
    const spans = cycle.spans!;
    const from = Math.min(0, ...spans.map((s) => s[1]));
    const to = Math.max(cycle.ms, ...spans.map((s) => s[1] + s[2]));
    return { cycle, spans, from, width: Math.max(to - from, 0.001) };
  });
  const totalMs = extents.reduce((sum, e) => sum + e.width, 0);
  const blocks: FlameBlock[] = [];
  const flameCycles: FlameCycle[] = [];
  let offset = 0;
  let depth = 0;
  for (const { cycle, spans, from, width } of extents) {
    flameCycles.push({
      id: cycle.id,
      x: (offset / totalMs) * 100,
      w: (width / totalMs) * 100,
      droppedSpans: cycle.droppedSpans ?? 0,
    });
    const ordered = [...spans].sort((a, b) => a[1] - b[1] || a[3] - b[3]);
    // The latest block seen at each depth in this cycle, to find parents.
    const open: number[] = [];
    for (const [nameIdx, start, ms, d, kind] of ordered) {
      const name = names[nameIdx] ?? 'unknown';
      const parentAt = open[d - 1];
      const parent =
        d > 0 &&
        parentAt !== undefined &&
        start < blocks[parentAt].start + blocks[parentAt].ms + 1e-6
          ? parentAt
          : null;
      const block: FlameBlock = {
        index: blocks.length,
        cycleId: cycle.id,
        name,
        kind,
        start,
        ms,
        selfMs: ms,
        depth: d,
        parent,
        component: spanComponent(name, kind),
        x: ((offset + start - from) / totalMs) * 100,
        w: (ms / totalMs) * 100,
      };
      if (parent !== null) blocks[parent].selfMs = Math.max(blocks[parent].selfMs - ms, 0);
      blocks.push(block);
      open[d] = block.index;
      open.length = d + 1;
      depth = Math.max(depth, d + 1);
    }
    offset += width;
  }
  return { blocks, cycles: flameCycles, depth, totalMs };
}
