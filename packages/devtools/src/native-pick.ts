// Tap-to-pick and the highlight box for the overlays that run on a device
// (NativeScript, Angular Native). They follow `component-pick.ts` and
// `page-highlight.ts`: a pick catches the next tap over the whole app, keeps
// it from the app, and answers with the component that hosts the tapped view;
// a highlight draws a box in a layer of its own over the view instead of
// changing the view. Each platform supplies the surface that catches taps and
// draws the box (`overlay-nativescript-surface.ts`,
// `overlay-angular-native-surface.ts`), so this file needs no framework.

import {
  COMPONENT_PICK_TIMEOUT_MS,
  PICK_KEYS,
  type ComponentPickResult,
  type PickKey,
  type PickMoveResult,
} from './component-pick.ts';
import { componentHostOf, componentHosts, type ComponentDebugNg } from './component-tree.ts';
import { componentSource } from './component-source.ts';
import { elementId } from './element-id.ts';
import type { HostTree } from './host-tree.ts';
import { className } from './injector-tree.ts';
import { HIGHLIGHT_SAFETY_MS } from './page-highlight.ts';

/** Where a view is on screen, in the platform's layout units, from the top left of the app. */
export interface NativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The highlight color, the same as the browser overlay's box. */
export const HIGHLIGHT_COLOR = '#68b6ff';
export const HIGHLIGHT_BORDER = 2;

/** What a platform gives the pick and the highlight. */
export interface NativeSurface<V> {
  /**
   * Starts catching taps over the whole app and calls `onTap` with the view
   * each one landed on, or null. Taps don't reach the app while it runs.
   * Returns the function that stops it, or null when the platform can't
   * catch taps.
   */
  captureTaps(onTap: (view: V | null) => void): (() => void) | null;
  /** Draws the box over `view`, replacing the last one. False when it could not. */
  showBox(view: V): boolean;
  hideBox(): void;
}

let boxTimer: ReturnType<typeof setTimeout> | undefined;
let shownOn: NativeSurface<never> | null = null;

/**
 * Draws the box over `view` until `clearNativeHighlight()` or `durationMs`
 * (default `HIGHLIGHT_SAFETY_MS`), and returns whether it was drawn.
 */
export function showNativeHighlight<V>(
  surface: NativeSurface<V>,
  view: V,
  durationMs?: number,
): boolean {
  clearNativeHighlight();
  if (!surface.showBox(view)) return false;
  shownOn = surface as NativeSurface<never>;
  boxTimer = setTimeout(
    clearNativeHighlight,
    typeof durationMs === 'number' && durationMs > 0
      ? Math.min(durationMs, HIGHLIGHT_SAFETY_MS)
      : HIGHLIGHT_SAFETY_MS,
  );
  return true;
}

export function clearNativeHighlight() {
  clearTimeout(boxTimer);
  boxTimer = undefined;
  const surface = shownOn;
  shownOn = null;
  surface?.hideBox();
}

interface NativePickOptions<V extends object> {
  getNg: () => ComponentDebugNg<V> | undefined;
  tree: HostTree<V>;
  surface: NativeSurface<V>;
  timeoutMs?: number;
}

/**
 * Lets the user tap a view on the device and resolves with the component that
 * hosts it. Taps don't reach the app while it runs. `cancel()` or the timeout
 * end it. `move` takes the keys of a keyboard pick from the panel, as on the
 * web: next and previous component in tree order, the component around the
 * shown one, the first one inside it, and picking the shown one.
 */
export function startNativePick<V extends object>(
  options: NativePickOptions<V>,
): {
  result: Promise<ComponentPickResult>;
  cancel: () => void;
  move: (key: PickKey) => PickMoveResult;
} {
  const { tree, surface } = options;
  let shown: V | null = null;
  let done = false;
  let finish: (result: ComponentPickResult) => void = () => {};

  const resultFor = (host: V | null): ComponentPickResult => {
    if (!host) return { ok: false, error: 'That view is not inside an Angular component.' };
    const instance = options.getNg()?.getComponent?.(host);
    const ctor = (instance as { constructor?: unknown } | null)?.constructor;
    const source = componentSource(instance);
    return {
      ok: true,
      id: elementId(host),
      name: typeof ctor === 'function' ? className(ctor) : 'Anonymous',
      tag: tree.tag(host),
      ...(source ? { source } : {}),
    };
  };

  const show = (host: V) => {
    shown = host;
    showNativeHighlight(surface, host);
  };

  const move = (key: PickKey): PickMoveResult => {
    if (done) return { moved: false, error: 'No pick is running.' };
    const ng = options.getNg();
    if (!ng?.getComponent) return { moved: false, error: 'This app has no Angular debug API.' };
    if (key === 'pick') {
      if (!shown) return { moved: false, error: 'Move to a component first.' };
      const picked = resultFor(shown);
      finish(picked);
      return picked.ok
        ? { moved: true, id: picked.id, name: picked.name, tag: picked.tag, picked: true }
        : { moved: false, error: picked.error };
    }
    const hosts = componentHosts(ng, tree);
    const index = shown ? hosts.indexOf(shown) : -1;
    const around = (host: V) => {
      const parent = tree.parent(host);
      return parent ? componentHostOf(ng, parent, tree) : null;
    };
    let next: V | null = null;
    if (index === -1) next = hosts[0] ?? null;
    else if (key === 'next') next = hosts[index + 1] ?? null;
    else if (key === 'previous') next = hosts[index - 1] ?? null;
    else if (key === 'parent') next = around(hosts[index]!);
    else next = hosts.slice(index + 1).find((host) => around(host) === shown) ?? null;
    if (!next) {
      const why = {
        next: 'This is the last component.',
        previous: 'This is the first component.',
        parent: 'This component has no component around it.',
        child: 'This component has no component inside it.',
      };
      return index === -1
        ? { moved: false, error: 'The app shows no component.' }
        : { moved: false, error: why[key] };
    }
    show(next);
    const picked = resultFor(next);
    return picked.ok
      ? { moved: true, id: picked.id, name: picked.name, tag: picked.tag }
      : { moved: false, error: picked.error };
  };

  const result = new Promise<ComponentPickResult>((resolve) => {
    let stop: (() => void) | null = null;
    const timer = setTimeout(
      () => finish({ ok: false, error: 'No component was picked.' }),
      options.timeoutMs ?? COMPONENT_PICK_TIMEOUT_MS,
    );
    finish = (outcome) => {
      finish = () => {};
      done = true;
      clearTimeout(timer);
      stop?.();
      clearNativeHighlight();
      resolve(outcome);
    };
    try {
      stop = surface.captureTaps((view) => {
        const host = view ? componentHostOf(options.getNg(), view, tree) : null;
        finish(resultFor(host));
      });
    } catch {
      stop = null;
    }
    if (!stop) {
      finish({ ok: false, error: 'This device cannot catch a tap for picking.' });
    }
  });
  return { result, cancel: () => finish({ ok: false, error: 'Picking cancelled.' }), move };
}

/**
 * The deepest view under `point` whose frame holds it, walking from the
 * roots. Views later in render order win over earlier siblings, as they draw
 * on top. A view without a frame (not laid out) is skipped with its children.
 */
export function viewAt<V extends object>(
  tree: Pick<HostTree<V>, 'roots' | 'children'>,
  frameOf: (view: V) => NativeFrame | null,
  point: { x: number; y: number },
  maxDepth = 256,
): V | null {
  const inside = (frame: NativeFrame | null) =>
    !!frame &&
    point.x >= frame.x &&
    point.y >= frame.y &&
    point.x < frame.x + frame.width &&
    point.y < frame.y + frame.height;
  const visit = (view: V, depth: number): V | null => {
    if (depth > maxDepth) return null;
    const children = tree.children(view);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]!;
      const frame = frameOf(child);
      // A proxy container has no frame of its own, so its children are tried.
      if (frame && !inside(frame)) continue;
      const hit = visit(child, depth + 1);
      if (hit) return hit;
      if (frame) return child;
    }
    return null;
  };
  const roots = tree.roots();
  for (let i = roots.length - 1; i >= 0; i--) {
    const root = roots[i]!;
    const frame = frameOf(root);
    if (frame && !inside(frame)) continue;
    const hit = visit(root, 0);
    if (hit) return hit;
    if (frame) return root;
  }
  return null;
}

interface PickRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => unknown;
  }): void;
}

/**
 * Answers the panel's `component-pick` requests on a device, as `overlay.ts`
 * does in a browser: a request starts a pick (and cancels a running one), a
 * `cancel` ends it, and a `move` key moves it. `picked` runs with the id of a
 * picked component. Returns the function that ends a running pick.
 */
export function registerNativePick<V extends object>(
  rpc: PickRpc,
  pageId: string,
  options: NativePickOptions<V> & { picked: (id: string) => void },
): () => void {
  let cancel: (() => void) | null = null;
  let move: ((key: PickKey) => PickMoveResult) | null = null;
  const answer = (requestId: string, result: unknown) =>
    void rpc.call('component-pick-result', { requestId, pageId, result }).catch(() => {});
  rpc.register({
    name: 'component-pick',
    type: 'event',
    jsonSerializable: true,
    handler: (
      request: { requestId?: unknown; pageId?: unknown; cancel?: unknown; move?: unknown } | null,
    ) => {
      if (!request || (request.pageId && request.pageId !== pageId)) return;
      // A key from the panel moves the running pick; it never starts or cancels one.
      if (request.move !== undefined) {
        const key = PICK_KEYS.find((k) => k === request.move);
        const result: PickMoveResult = !key
          ? { moved: false, error: 'Unknown key.' }
          : (move?.(key) ?? { moved: false, error: 'No pick is running.' });
        if (typeof request.requestId === 'string') answer(request.requestId, result);
        return;
      }
      cancel?.();
      if (request.cancel === true || typeof request.requestId !== 'string') return;
      const requestId = request.requestId;
      const pick = startNativePick(options);
      cancel = pick.cancel;
      move = pick.move;
      void pick.result.then((result) => {
        if (cancel === pick.cancel) {
          cancel = null;
          move = null;
        }
        if (result.ok) options.picked(result.id);
        answer(requestId, result);
      });
    },
  });
  return () => cancel?.();
}
