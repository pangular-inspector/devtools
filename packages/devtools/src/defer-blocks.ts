import { componentHostOf, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
import { angularRoots } from './host-tree.ts';
import { className } from './injector-tree.ts';
import type { DeferBlockInfo } from './types.ts';

export interface DeferDebugNg extends ComponentDebugNg {
  ɵgetControlFlowBlocks?(node: Node): unknown[];
  ɵgetDeferBlocks?(node: Node): unknown[];
}

interface RawDeferBlock {
  type?: number;
  state?: unknown;
  incrementalHydrationState?: unknown;
  hasErrorBlock?: unknown;
  loadingBlock?: { exists?: unknown; minimumTime?: unknown; afterTime?: unknown };
  placeholderBlock?: { exists?: unknown; minimumTime?: unknown };
  triggers?: unknown;
  hostNode?: unknown;
  rootNodes?: unknown;
}

/** The most defer blocks one collection reports. */
export const MAX_DEFER_BLOCKS = 500;
const MAX_ROOT_IDS = 5;
const DEFER_TYPE = 0;
const HYDRATION = new Set(['not-configured', 'dehydrated', 'hydrated']);

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The container comment after a block's root nodes, or failing that its first root node. */
function anchorOf(roots: unknown[]): Node | null {
  const nodes = roots.filter((node): node is Node => node instanceof Node);
  const after = nodes.at(-1)?.nextSibling;
  return after instanceof Comment ? after : (nodes[0] ?? null);
}

function isDeferBlock(raw: unknown): raw is RawDeferBlock & { state: string } {
  if (!raw || typeof raw !== 'object') return false;
  const block = raw as RawDeferBlock;
  return (
    typeof block.state === 'string' && (typeof block.type !== 'number' || block.type === DEFER_TYPE)
  );
}

function timeOf(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Reads `@defer` blocks through `ng.ɵgetControlFlowBlocks` (Angular 22+) or
 * `ng.ɵgetDeferBlocks` (earlier). Ids stay stable between collections, and
 * the tracker remembers when each block changed state or hydrated. When
 * Angular gives no `hostNode` (Angular 20), a block is known by the comment
 * Angular places right after its root nodes, which stays put while the block
 * moves from placeholder to content. Only a block with no root nodes falls
 * back to its position among such blocks under its Angular root. When such a
 * block renders and gains an anchor, the anchor takes over its id and timing
 * as long as the block list under that root kept its length.
 */
export function createDeferTracker(now: () => number = Date.now) {
  const ids = new WeakMap<object, string>();
  const seen = new WeakMap<object, { key: string; since: number; hydratedAt?: number }>();
  const byPosition = new WeakMap<Element, object[]>();
  const lastHosts = new WeakMap<Element, object[]>();
  let nextId = 0;
  let truncated = false;

  const positionKey = (root: Element, index: number) => {
    let keys = byPosition.get(root);
    if (!keys) {
      keys = [];
      byPosition.set(root, keys);
    }
    return (keys[index] ??= {});
  };

  /** Moves a positional block's id and timing onto the anchor it now has. */
  const adopt = (root: Element, anchor: Node, index: number, count: number) => {
    if (ids.has(anchor)) return;
    const last = lastHosts.get(root);
    const keys = byPosition.get(root);
    const previous = last?.length === count ? last[index] : undefined;
    const slot = previous && keys ? keys.indexOf(previous) : -1;
    if (!previous || !keys || slot === -1) return;
    keys.splice(slot, 1);
    const id = ids.get(previous);
    const record = seen.get(previous);
    if (id) ids.set(anchor, id);
    if (record) seen.set(anchor, record);
  };

  const idOf = (host: object) => {
    let id = ids.get(host);
    if (!id) {
      id = `d${++nextId}`;
      ids.set(host, id);
    }
    return id;
  };

  const ownerOf = (ng: DeferDebugNg, host: Node | null): DeferBlockInfo['owner'] => {
    const parent = !host ? null : host instanceof Element ? host : host.parentElement;
    const owner = parent ? componentHostOf(ng, parent) : null;
    const instance = owner ? read(() => ng.getComponent?.(owner), null) : null;
    const ctor = (instance as { constructor?: unknown } | null)?.constructor;
    if (!owner || typeof ctor !== 'function') return undefined;
    return { id: elementId(owner), name: className(ctor), tag: owner.tagName.toLowerCase() };
  };

  return {
    /** True when the last `collect` stopped at {@link MAX_DEFER_BLOCKS} with blocks left. */
    get truncated() {
      return truncated;
    },
    /** Every defer block on the page, or `undefined` when Angular exposes no util for them. */
    collect(ng: DeferDebugNg | undefined, doc: Document = document): DeferBlockInfo[] | undefined {
      truncated = false;
      const util = ng?.ɵgetControlFlowBlocks ?? ng?.ɵgetDeferBlocks;
      if (!ng || typeof util !== 'function') return undefined;
      const hosts = new Set<object>();
      const out: DeferBlockInfo[] = [];
      for (const root of angularRoots(doc)) {
        const blocks = read(() => util.call(ng, root) ?? [], [] as unknown[]);
        const valid = Array.isArray(blocks) ? blocks.filter(isDeferBlock) : [];
        const order: object[] = [];
        let position = 0;
        for (const [index, raw] of valid.entries()) {
          const roots: unknown[] = Array.isArray(raw.rootNodes) ? raw.rootNodes : [];
          const hostNode = raw.hostNode instanceof Node ? raw.hostNode : anchorOf(roots);
          if (hostNode && !(raw.hostNode instanceof Node)) {
            adopt(root, hostNode, index, valid.length);
          }
          const host = hostNode ?? positionKey(root, position++);
          order.push(host);
          if (hosts.has(host)) continue;
          // Only a new block past the cap means some were left out.
          if (out.length >= MAX_DEFER_BLOCKS) {
            truncated = true;
            return out;
          }
          hosts.add(host);
          const hydration = HYDRATION.has(raw.incrementalHydrationState as string)
            ? (raw.incrementalHydrationState as DeferBlockInfo['hydration'])
            : 'not-configured';
          const triggers = Array.isArray(raw.triggers)
            ? raw.triggers.filter((t): t is string => typeof t === 'string')
            : [];
          const key = `${raw.state}|${hydration}`;
          const previous = seen.get(host);
          const record = {
            key,
            since: previous && previous.key === key ? previous.since : now(),
            hydratedAt: previous?.hydratedAt,
          };
          if (previous?.key.endsWith('|dehydrated') && hydration === 'hydrated') {
            record.hydratedAt = now();
          }
          seen.set(host, record);

          const block: DeferBlockInfo = {
            id: idOf(host),
            state: raw.state,
            hydration,
            triggers,
            hasErrorBlock: raw.hasErrorBlock === true,
            since: record.since,
            rootIds: roots
              .filter((node): node is Element => node instanceof Element)
              .slice(0, MAX_ROOT_IDS)
              .map((el) => elementId(el)),
          };
          const owner = ownerOf(
            ng,
            raw.hostNode instanceof Node ? raw.hostNode : (hostNode?.parentNode ?? null),
          );
          if (owner) block.owner = owner;
          if (triggers.includes('hydrate never')) block.hydrateNever = true;
          if (raw.loadingBlock?.exists) {
            block.loading = {
              minimumTime: timeOf(raw.loadingBlock.minimumTime),
              afterTime: timeOf(raw.loadingBlock.afterTime),
            };
          }
          if (raw.placeholderBlock?.exists) {
            block.placeholder = { minimumTime: timeOf(raw.placeholderBlock.minimumTime) };
          }
          if (record.hydratedAt !== undefined) block.hydratedAt = record.hydratedAt;
          out.push(block);
        }
        lastHosts.set(root, order);
      }
      return out;
    },
  };
}
