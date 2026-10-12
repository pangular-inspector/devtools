import { componentHostOf, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
import { className } from './injector-tree.ts';

export interface BlockOwnerDebugNg extends ComponentDebugNg {
  getOwningComponent?(node: Node): unknown;
  getHostElement?(instance: object): unknown;
}

export interface BlockOwner {
  id: string;
  name: string;
  tag: string;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * The component whose template holds a control flow block, read from the
 * block's anchor comment or, failing that, one of its root nodes. Angular
 * patches each container anchor with the view that declares it.
 *
 * `ng.getOwningComponent` reads the node's own view and climbs embedded views
 * up to the component view that declared it (`_debug_node-chunk.mjs`), so a
 * block that component A content-projects into component B still names A.
 * `ng.getHostElement` then gives A's host. When either util is missing or
 * answers nothing, the nearest component host above the node stands in,
 * which is right for every block that is not projected. It starts at the
 * node's parent, so a root node that is a component host itself still names
 * the template it sits in.
 */
export function blockOwnerOf(ng: BlockOwnerDebugNg, node: Node | null): BlockOwner | undefined {
  if (!node) return undefined;
  let owner: Element | null = null;
  let instance: unknown = null;
  const owning = read(() => ng.getOwningComponent?.(node) ?? null, null);
  if (owning && typeof owning === 'object') {
    const host = read(() => ng.getHostElement?.(owning) ?? null, null);
    if (host instanceof Element) {
      owner = host;
      instance = owning;
    }
  }
  if (!owner) {
    const parent = node.parentElement;
    owner = parent ? componentHostOf(ng, parent) : null;
    instance = owner ? read(() => ng.getComponent?.(owner!), null) : null;
  }
  const ctor = (instance as { constructor?: unknown } | null)?.constructor;
  if (!owner || typeof ctor !== 'function') return undefined;
  return { id: elementId(owner), name: className(ctor), tag: owner.tagName.toLowerCase() };
}
