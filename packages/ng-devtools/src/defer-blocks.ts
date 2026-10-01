import { angularRoots, componentHostOf, type ComponentDebugNg } from './component-tree.ts';
import { elementId } from './element-id.ts';
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

const MAX_BLOCKS = 500;
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

function timeOf(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Reads `@defer` blocks through `ng.ɵgetControlFlowBlocks` (Angular 22+) or
 * `ng.ɵgetDeferBlocks` (earlier). Ids stay stable between collections, and
 * the tracker remembers when each block changed state or hydrated.
 */
export function createDeferTracker(now: () => number = Date.now) {
  const ids = new WeakMap<object, string>();
  const seen = new WeakMap<object, { key: string; since: number; hydratedAt?: number }>();
  let nextId = 0;

  const idOf = (host: object) => {
    let id = ids.get(host);
    if (!id) {
      id = `d${++nextId}`;
      ids.set(host, id);
    }
    return id;
  };

  const ownerOf = (ng: DeferDebugNg, host: Node): DeferBlockInfo['owner'] => {
    const parent = host instanceof Element ? host : host.parentElement;
    const owner = parent ? componentHostOf(ng, parent) : null;
    const instance = owner ? read(() => ng.getComponent?.(owner), null) : null;
    const ctor = (instance as { constructor?: unknown } | null)?.constructor;
    if (!owner || typeof ctor !== 'function') return undefined;
    return { id: elementId(owner), name: className(ctor), tag: owner.tagName.toLowerCase() };
  };

  return {
    /** Every defer block on the page, or `undefined` when Angular exposes no util for them. */
    collect(ng: DeferDebugNg | undefined, doc: Document = document): DeferBlockInfo[] | undefined {
      const util = ng?.ɵgetControlFlowBlocks ?? ng?.ɵgetDeferBlocks;
      if (!ng || typeof util !== 'function') return undefined;
      const hosts = new Set<object>();
      const out: DeferBlockInfo[] = [];
      for (const root of angularRoots(doc)) {
        const blocks = read(() => util.call(ng, root) ?? [], [] as unknown[]);
        for (const raw of blocks as RawDeferBlock[]) {
          if (out.length >= MAX_BLOCKS) return out;
          if (!raw || typeof raw !== 'object' || typeof raw.state !== 'string') continue;
          if (typeof raw.type === 'number' && raw.type !== DEFER_TYPE) continue;
          const host = raw.hostNode;
          if (!(host instanceof Node) || hosts.has(host)) continue;
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

          const roots = Array.isArray(raw.rootNodes) ? raw.rootNodes : [];
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
          const owner = ownerOf(ng, host);
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
      }
      return out;
    },
  };
}
