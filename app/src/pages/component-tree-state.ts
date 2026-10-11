export interface TreeNode {
  id: string;
  name: string;
  tag: string;
  directives?: string[];
  children: TreeNode[];
}

/** Keeps matching nodes and their ancestors; `matches` counts the matching nodes only. */
export function filterTree<T extends TreeNode>(
  roots: T[],
  query: string,
): { nodes: T[]; matches: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { nodes: roots, matches: 0 };
  let matches = 0;
  const keep = (node: T) =>
    node.name.toLowerCase().includes(q) ||
    node.tag.toLowerCase().includes(q) ||
    !!node.directives?.some((d) => d.toLowerCase().includes(q));
  const prune = (nodes: T[]): T[] =>
    nodes.flatMap((node) => {
      const hit = keep(node);
      if (hit) matches++;
      const children = prune(node.children as T[]);
      return hit || children.length ? [{ ...node, children }] : [];
    });
  return { nodes: prune(roots), matches };
}

export function countText(
  total: number,
  matches: number,
  filtering: boolean,
  truncated = false,
): string {
  const shown = truncated ? `${total}+` : `${total}`;
  if (filtering) return `${matches} of ${shown}`;
  return `${shown} ${total === 1 && !truncated ? 'instance' : 'instances'}`;
}

export function filterAnnouncement(
  total: number,
  matches: number,
  query: string,
  truncated = false,
): string {
  if (!query.trim()) return '';
  if (!matches) return 'No components match.';
  const shown = truncated ? `${total}+` : `${total}`;
  return `${matches} of ${shown} ${total === 1 && !truncated ? 'instance' : 'instances'} match.`;
}

export function truncationNotice(truncatedBy?: { components?: number; depth?: number }): string {
  const components = truncatedBy?.components;
  const depth = truncatedBy?.depth;
  if (components && depth) {
    return `Showing the first ${components} component instances, and none nested more than ${depth} elements deep. Others are not listed or searchable.`;
  }
  if (components) {
    return `Showing the first ${components} component instances. Others are not listed or searchable.`;
  }
  if (depth) {
    return `Components nested more than ${depth} elements deep are not listed or searchable.`;
  }
  return 'The page has more components than the tree shows.';
}

export interface SelectionState {
  pageId: string | null;
  selectedId: string | null;
  detailId: string | null;
}

export interface SelectionPage {
  pageId: string;
  roots: TreeNode[];
  detail: { id: string } | null;
  truncated?: boolean;
}

/**
 * Brings the panel selection in line with a new report. A page switch takes
 * that page's own selection. On the same page, a selection made elsewhere
 * (on the page or by an agent) is followed, and a selected instance that left
 * the tree is dropped and reported as `destroyed`.
 */
export function reconcileSelection(
  state: SelectionState,
  page: SelectionPage | null,
): SelectionState & { destroyed: string | null } {
  const detailId = page?.detail?.id ?? null;
  const pageId = page?.pageId ?? null;
  if (pageId !== state.pageId) {
    return { pageId, selectedId: detailId, detailId, destroyed: null };
  }
  let selectedId = state.selectedId;
  if (detailId && detailId !== state.detailId && detailId !== selectedId) selectedId = detailId;
  if (selectedId && page && !page.truncated && !hasNode(page.roots, selectedId)) {
    return { pageId, selectedId: null, detailId, destroyed: selectedId };
  }
  return { pageId, selectedId, detailId, destroyed: null };
}

function hasNode(nodes: TreeNode[], id: string): boolean {
  return nodes.some((node) => node.id === id || hasNode(node.children, id));
}

/** The row that takes the place of a removed one: the next remaining row, else the previous one. */
export function nearestRow(
  before: string[],
  after: ReadonlySet<string>,
  gone: string,
): string | null {
  const at = before.indexOf(gone);
  if (at < 0) return null;
  for (let i = at + 1; i < before.length; i++) if (after.has(before[i])) return before[i];
  for (let i = at - 1; i >= 0; i--) if (after.has(before[i])) return before[i];
  return null;
}
