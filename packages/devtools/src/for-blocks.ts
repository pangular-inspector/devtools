import { blockOwnerOf, type BlockOwnerDebugNg } from './block-owner.ts';
import { elementId } from './element-id.ts';
import { angularRoots } from './host-tree.ts';
import type { ForBlockInfo } from './types.ts';

export interface ControlFlowDebugNg extends BlockOwnerDebugNg {
  ɵgetControlFlowBlocks?(node: Node): unknown[];
}

/**
 * One `@for` entry of `ng.ɵgetControlFlowBlocks` (Angular 22+), checked
 * against `forLoopFinder` in `@angular/core/fesm2022/_debug_node-chunk.mjs`:
 * `type` is `ControlFlowBlockType.For` (1), `items` the live collection,
 * `hasEmptyBlock`, `rootNodes` of every rendered item view, `hostNode` the
 * container's comment anchor, and `trackExpression` (`$index`, `item` or
 * `function`).
 */
interface RawForBlock {
  type: number;
  items?: unknown;
  hasEmptyBlock?: unknown;
  rootNodes?: unknown;
  hostNode?: unknown;
  trackExpression?: unknown;
}

/** Cap on the `@for` blocks one page reports; `forBlocksTruncated` says when it was hit. */
export const MAX_FOR_BLOCKS = 500;
const MAX_ROOT_IDS = 5;
const FOR_TYPE = 1;
const TRACK = new Set(['$index', 'item', 'function']);

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isForBlock(raw: unknown): raw is RawForBlock {
  return (
    !!raw &&
    typeof raw === 'object' &&
    (raw as RawForBlock).type === FOR_TYPE &&
    'hasEmptyBlock' in raw
  );
}

/**
 * Reads `ng.ɵgetControlFlowBlocks` once per Angular root for one collection,
 * so the `@defer` and `@for` trackers share a single walk of the views.
 * `undefined` when the page's Angular has no such util (before 22.0, or a
 * production build).
 */
export function controlFlowReader(
  ng: ControlFlowDebugNg | undefined,
): ((root: Element) => unknown[]) | undefined {
  const util = ng?.ɵgetControlFlowBlocks;
  if (!ng || typeof util !== 'function') return undefined;
  const cache = new Map<Element, unknown[]>();
  return (root) => {
    let blocks = cache.get(root);
    if (!blocks) {
      const answer = read(() => util.call(ng, root), [] as unknown[]);
      blocks = Array.isArray(answer) ? answer : [];
      cache.set(root, blocks);
    }
    return blocks;
  };
}

export interface ForBlocksReport {
  forBlocks: ForBlockInfo[];
  forBlocksTruncated?: true;
}

/**
 * Collects `@for` blocks: the owning component, the item count, the `track`
 * kind Angular reports and whether `@empty` exists and shows. A block keeps
 * its id between collections through a `WeakMap` keyed by its container
 * anchor, which stays in place while items come and go.
 */
export function createForTracker() {
  const ids = new WeakMap<object, string>();
  const byPosition = new WeakMap<Element, object[]>();
  let nextId = 0;

  const idOf = (key: object) => {
    let id = ids.get(key);
    if (!id) {
      id = `f${++nextId}`;
      ids.set(key, id);
    }
    return id;
  };

  const positionKey = (root: Element, index: number) => {
    let keys = byPosition.get(root);
    if (!keys) {
      keys = [];
      byPosition.set(root, keys);
    }
    return (keys[index] ??= {});
  };

  return {
    /**
     * Every `@for` block on the page, or `undefined` when Angular exposes no
     * `ɵgetControlFlowBlocks` (Angular before 22.0, or a production build).
     */
    collect(
      ng: ControlFlowDebugNg | undefined,
      doc: Document = document,
      blocksOf = controlFlowReader(ng),
    ): ForBlocksReport | undefined {
      if (!ng || !blocksOf) return undefined;
      const out: ForBlockInfo[] = [];
      const seen = new Set<object>();
      for (const root of angularRoots(doc)) {
        let position = 0;
        for (const raw of blocksOf(root)) {
          if (!isForBlock(raw)) continue;
          const anchor = raw.hostNode instanceof Node ? raw.hostNode : null;
          const key = anchor ?? positionKey(root, position++);
          if (seen.has(key)) continue;
          seen.add(key);
          if (out.length >= MAX_FOR_BLOCKS) return { forBlocks: out, forBlocksTruncated: true };
          const count = Array.isArray(raw.items) ? raw.items.length : 0;
          const hasEmptyBlock = raw.hasEmptyBlock === true;
          const roots: unknown[] = Array.isArray(raw.rootNodes) ? raw.rootNodes : [];
          const block: ForBlockInfo = {
            id: idOf(key),
            count,
            track:
              typeof raw.trackExpression === 'string' && TRACK.has(raw.trackExpression)
                ? (raw.trackExpression as ForBlockInfo['track'])
                : null,
            hasEmptyBlock,
            showingEmpty: hasEmptyBlock && count === 0,
            rootIds: roots
              .filter((node): node is Element => node instanceof Element)
              .slice(0, MAX_ROOT_IDS)
              .map((el) => elementId(el)),
          };
          const owner = blockOwnerOf(
            ng,
            anchor ?? (roots.find((n) => n instanceof Node) as Node) ?? null,
          );
          if (owner) block.owner = owner;
          out.push(block);
        }
      }
      return { forBlocks: out };
    },
  };
}
