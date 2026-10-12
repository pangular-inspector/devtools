import type { InjectorTreeNode } from '../types.ts';

/** One injector without its providers and dependencies, for answers that have to fit a budget. */
export interface InjectorOutline {
  id: string;
  name: string;
  type: InjectorTreeNode['injector']['type'];
  component?: string;
  /** The component's id in the component tree. */
  componentId?: string;
  providers: number;
  dependencies: number;
  children: InjectorOutline[];
  /** Direct children left out of this outline to keep it within the budget. */
  moreChildren?: number;
}

/** Number of injectors in `nodes` and below. */
export function countInjectors(nodes: InjectorTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countInjectors(node.children), 0);
}

/**
 * The outline of `nodes`, keeping the first `limit` injectors in breadth-first
 * order (all of them when `limit` is left out), so the top of the tree stays
 * and whole subtrees drop from the bottom. Never cuts a node in half.
 */
export function outlineInjectors(
  nodes: InjectorTreeNode[],
  limit = Number.POSITIVE_INFINITY,
): InjectorOutline[] {
  const kept = new Set<InjectorTreeNode>();
  const queue = [...nodes];
  for (let i = 0; i < queue.length && kept.size < limit; i++) {
    const node = queue[i]!;
    kept.add(node);
    queue.push(...node.children);
  }
  const build = (list: InjectorTreeNode[]): InjectorOutline[] =>
    list
      .filter((node) => kept.has(node))
      .map((node) => {
        const { id, name, type, component, componentId } = node.injector;
        const children = build(node.children);
        const more = node.children.length - children.length;
        return {
          id,
          name,
          type,
          ...(component ? { component } : {}),
          ...(componentId ? { componentId } : {}),
          providers: node.providers.length,
          dependencies: node.dependencies?.length ?? 0,
          children,
          ...(more ? { moreChildren: more } : {}),
        };
      });
  return build(nodes);
}

/**
 * The largest `count` in `0..total` for which `fits(count)` holds, assuming
 * fewer always fits when more does. Returns 0 when nothing fits.
 */
export function largestFitting(total: number, fits: (count: number) => boolean): number {
  let low = 0;
  let high = total;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}
