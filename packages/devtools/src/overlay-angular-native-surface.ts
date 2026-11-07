// The Angular Native side of tap-to-pick and the highlight box
// (`native-pick.ts`), through the `@ng-native/fabric` engine the app already
// renders with (`node.host`): the box is a `view` node of its own appended to
// the root and placed from `measure()`, and a pick claims every touch with a
// capturing responder on the root, whose handler is told the node the touch
// landed on. The box node is left out of the tree the collectors walk.

import type { NativeSurface } from './native-pick.ts';
import { HIGHLIGHT_BORDER, HIGHLIGHT_COLOR } from './native-pick.ts';
import type { AngularNativeNode } from './overlay-angular-native-views.ts';

/** A window frame, as the engine's `measure()` reports it. */
interface WindowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The engine calls the overlay makes, from `@ng-native/fabric`'s `HostEngine` and `Engine`. */
export interface AngularNativeEngine {
  setProp(node: AngularNativeNode, key: string, value: unknown): void;
  createElement?(name: string): AngularNativeNode;
  appendChild?(parent: AngularNativeNode, child: AngularNativeNode): void;
  removeChild?(parent: AngularNativeNode | null, child: AngularNativeNode): void;
  measure?(node: AngularNativeNode, into: (frame: WindowFrame) => void): void;
  setResponder?(
    node: AngularNativeNode,
    handlers: {
      onStartShouldSetResponderCapture?(event: unknown, target: AngularNativeNode): boolean;
      onResponderRelease?(event: unknown): void;
      onResponderTerminationRequest?(event: unknown): boolean;
    },
  ): () => void;
  commit?(): boolean;
}

/** Nodes the overlay added (the box), which the tree the collectors walk leaves out. */
const overlayNodes = new WeakSet<object>();

export function isOverlayNode(node: unknown): boolean {
  return typeof node === 'object' && node !== null && overlayNodes.has(node);
}

const engineOf = (node: AngularNativeNode | null | undefined) =>
  (node?.host as AngularNativeEngine | undefined) ?? null;

/**
 * The pick and highlight surface for the engine under `getRoot()`. A part
 * the engine lacks makes that call answer false or null, so the overlay falls
 * back to the outline style for the highlight, and the pick says it can't run.
 */
export function angularNativeSurface(
  getRoot: () => AngularNativeNode | null | undefined,
): NativeSurface<AngularNativeNode> {
  let box: {
    node: AngularNativeNode;
    root: AngularNativeNode;
    engine: AngularNativeEngine;
  } | null = null;
  let generation = 0;

  const hideBox = () => {
    generation++;
    if (!box) return;
    const { node, root, engine } = box;
    box = null;
    engine.removeChild?.(root, node);
    engine.commit?.();
  };

  return {
    captureTaps: (onTap) => {
      const root = getRoot();
      const engine = engineOf(root);
      if (!root || !engine?.setResponder) return null;
      let target: AngularNativeNode | null = null;
      let report: (node: AngularNativeNode | null) => void = onTap;
      const stop = engine.setResponder(root, {
        // The capture pass runs from the root down, so the root takes every touch first.
        onStartShouldSetResponderCapture: (_event, landed) => {
          target = landed ?? null;
          return true;
        },
        onResponderRelease: () => report(target),
        onResponderTerminationRequest: () => false,
      });
      return () => {
        report = () => {};
        stop();
      };
    },
    showBox: (view) => {
      hideBox();
      const root = getRoot();
      const engine = engineOf(root);
      if (
        !root ||
        !engine?.createElement ||
        !engine.appendChild ||
        !engine.removeChild ||
        !engine.measure
      ) {
        return false;
      }
      const mine = generation;
      // Window frames, so the box sits at the view's frame minus the root's. The box is added
      // only once both are known: an unmeasured node reports nothing, and then nothing is drawn.
      engine.measure(root, (rootFrame) => {
        engine.measure!(view, (frame) => {
          if (generation !== mine) return;
          const node = engine.createElement!('view');
          overlayNodes.add(node);
          engine.setProp(node, 'pointerEvents', 'none');
          engine.setProp(node, 'style', {
            position: 'absolute',
            left: frame.x - rootFrame.x,
            top: frame.y - rootFrame.y,
            width: frame.width,
            height: frame.height,
            borderWidth: HIGHLIGHT_BORDER,
            borderColor: HIGHLIGHT_COLOR,
            zIndex: 2147483647,
          });
          engine.appendChild!(root, node);
          engine.commit?.();
          box = { node, root, engine };
        });
      });
      return true;
    },
    hideBox,
  };
}
