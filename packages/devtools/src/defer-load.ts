import * as angularCore from '@angular/core';
import { actionBlockedMessage } from './config.ts';
import type { DeferBlockInfo } from './types.ts';

/**
 * Loads one `@defer` block on request of the `load-defer-block` agent tool
 * (dev only, behind `actions.components`). The collector never does this on
 * its own. It uses the same Angular internals as `DeferBlockFixture.render`
 * in `@angular/core/testing`: `ɵtriggerResourceLoading` fetches the block's
 * dependencies, `ɵrenderDeferBlockState` swaps in the main content (or the
 * `@error` block when the load failed), and `ng.applyChanges` runs change
 * detection so the new view renders.
 */

/** One block as `ɵgetDeferBlocks(lView, out)` lists it. */
interface DeferBlockDetails {
  lContainer: unknown[];
  lView: unknown[];
  tNode: unknown;
  tDetails: { loadingState?: number; errorTmplIndex?: number | null };
}

/** The Angular internals a force-load needs, all private exports of `@angular/core`. */
export interface DeferInternals {
  getDeferBlocks(lView: unknown[], out: DeferBlockDetails[]): void;
  triggerResourceLoading(tDetails: unknown, lView: unknown[], tNode: unknown): Promise<unknown>;
  renderDeferBlockState(
    state: number,
    tNode: unknown,
    lContainer: unknown[],
    skipTimerScheduling?: boolean,
  ): void;
}

export interface DeferLoadNg {
  getInjector?(el: Element): unknown;
  getComponent?(el: Element): unknown;
  applyChanges?(component: unknown): void;
}

export interface DeferLoadResult {
  ok?: true;
  /** The block's state after the load: `complete`, or `error` when its dependencies failed. */
  state?: string;
  /** The block already showed its main content, so nothing was loaded. */
  already?: true;
  error?: string;
}

/** Where a block sits in the tracker's last collection. */
export interface DeferBlockRef {
  /** The anchor comment of the block, or a plain key for a block without one. */
  host: object;
  block: DeferBlockInfo;
}

// `DeferBlockState` and `DeferDependenciesLoadingState` in `@angular/core`.
const COMPLETE = 2;
const ERROR = 3;
const LOAD_FAILED = 3;
// Slots of an LContainer: the host node and the anchor comment, and where its views start.
const HOST = 0;
const NATIVE = 7;
const CONTAINER_HEADER_OFFSET = 10;
/** Stops a walk over a broken view tree. */
const MAX_BLOCKS = 5000;

/** The internals from the app's own `@angular/core`, or null when this build has none. */
export function angularDeferInternals(core: object = angularCore): DeferInternals | null {
  const pick = (name: string) => {
    const fn = Reflect.get(core, name) as unknown;
    return typeof fn === 'function' ? fn : null;
  };
  const getDeferBlocks = pick('ɵgetDeferBlocks');
  const triggerResourceLoading = pick('ɵtriggerResourceLoading');
  const renderDeferBlockState = pick('ɵrenderDeferBlockState');
  if (!getDeferBlocks || !triggerResourceLoading || !renderDeferBlockState) return null;
  return {
    getDeferBlocks: getDeferBlocks as DeferInternals['getDeferBlocks'],
    triggerResourceLoading: triggerResourceLoading as DeferInternals['triggerResourceLoading'],
    renderDeferBlockState: renderDeferBlockState as DeferInternals['renderDeferBlockState'],
  };
}

/** The view an Angular root element was created in, from its node injector. */
function rootView(ng: DeferLoadNg, root: Element): unknown[] | null {
  try {
    const injector = ng.getInjector?.(root) as { _lView?: unknown } | null | undefined;
    return Array.isArray(injector?._lView) ? injector._lView : null;
  } catch {
    return null;
  }
}

/**
 * Finds the block whose container is anchored on `host`. `ɵgetDeferBlocks`
 * stops at each defer block it lists, so the walk goes on into the views a
 * block rendered, as `DeferBlockFixture.getDeferBlocks` does.
 */
function findBlock(
  internals: DeferInternals,
  views: unknown[][],
  host: object,
): DeferBlockDetails | null {
  const queue = [...views];
  let seen = 0;
  while (queue.length && seen < MAX_BLOCKS) {
    const found: DeferBlockDetails[] = [];
    internals.getDeferBlocks(queue.shift()!, found);
    for (const block of found) {
      seen++;
      const container = block.lContainer;
      if (container?.[HOST] === host || container?.[NATIVE] === host) return block;
      const inner = container?.[CONTAINER_HEADER_OFFSET];
      if (Array.isArray(inner)) queue.push(inner);
    }
  }
  return null;
}

/** Loads the block `ref` names; see the module comment. */
export async function loadDeferBlock(
  ng: DeferLoadNg | undefined,
  internals: DeferInternals | null,
  ref: DeferBlockRef | undefined,
  roots: Element[],
): Promise<DeferLoadResult> {
  if (!ref) {
    return {
      error: 'No defer block has that id on this page. List them with pangular:defer-blocks.',
    };
  }
  const { block, host } = ref;
  if (block.state === 'complete') return { ok: true, state: 'complete', already: true };
  if (block.hydrateNever || block.hydration === 'dehydrated') {
    return {
      error:
        'The block is server HTML waiting for incremental hydration. Loading it here would skip its hydrate trigger, so it was left alone. Trigger its hydrate condition in the app instead.',
    };
  }
  if (!ng?.getInjector) {
    return {
      error: 'This page has no Angular debug API (`ng.getInjector`). It needs a development build.',
    };
  }
  if (!internals) {
    return {
      error:
        "This page's Angular does not export the defer internals a load needs (`ɵgetDeferBlocks`, `ɵtriggerResourceLoading`, `ɵrenderDeferBlockState`).",
    };
  }
  if (typeof Node === 'undefined' || !(host instanceof Node)) {
    return {
      error:
        'Angular gives this block no anchor node yet, so its view cannot be found. Try again once the page renders it.',
    };
  }
  const views = roots.map((root) => rootView(ng, root)).filter((view) => view !== null);
  const found = findBlock(internals, views, host);
  if (!found) return { error: "The block's view could not be found from the app's roots." };
  await internals.triggerResourceLoading(found.tDetails, found.lView, found.tNode);
  const failed = found.tDetails.loadingState === LOAD_FAILED;
  if (failed && (found.tDetails.errorTmplIndex ?? null) === null) {
    return {
      error: "The block's dependencies failed to load, and it has no @error block to show.",
    };
  }
  internals.renderDeferBlockState(failed ? ERROR : COMPLETE, found.tNode, found.lContainer, true);
  for (const root of roots) {
    try {
      const component = ng.getComponent?.(root);
      if (component) ng.applyChanges?.(component);
    } catch {
      // A root that is gone; the next tick of the app renders the block all the same.
    }
  }
  return { ok: true, state: failed ? 'error' : 'complete' };
}

interface LoadRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

export interface DeferLoadOptions {
  /** `actions.components` from the config the server published. */
  allowed: boolean;
  /** Loads the block with this id, after a fresh read of the page's blocks. */
  load: (id: string) => Promise<DeferLoadResult>;
  /** Runs after a load, so the next push carries the new state. */
  loaded?: () => void;
}

/**
 * Answers the server's `defer-load` events for this page with
 * `defer-load-result`. The server checks the action gate first; the page
 * checks it again, so a server started with writes off never gets one through.
 */
export function registerDeferLoad(rpc: LoadRpc, pageId: string, options: DeferLoadOptions): void {
  rpc.register({
    name: 'defer-load',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; id?: unknown } | null) => {
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      const requestId = message.requestId;
      const id = message.id;
      const run = async (): Promise<DeferLoadResult> => {
        if (!options.allowed) return { error: actionBlockedMessage('components') };
        if (typeof id !== 'string' || !id) return { error: 'Pass the id of a defer block.' };
        try {
          return await options.load(id);
        } catch (error) {
          return { error: String((error as Error)?.message ?? error).slice(0, 500) };
        }
      };
      void run().then((result) => {
        void rpc.call('defer-load-result', { requestId, pageId, result }).catch(() => {});
        if (result.ok && !result.already) options.loaded?.();
      });
    },
  });
}
