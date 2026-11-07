// The NativeScript side of tap-to-pick and the highlight box (`native-pick.ts`).
// The box and the tap catcher are native views of their own, added to the
// app's window above everything and removed afterwards, so no view of the app
// changes. The platform classes are read from the runtime's globals (UIKit on
// iOS, the Android SDK on Android) and passed in, so this file compiles and
// tests without NativeScript or a device.

import {
  HIGHLIGHT_BORDER,
  HIGHLIGHT_COLOR,
  viewAt,
  type NativeFrame,
  type NativeSurface,
} from './native-pick.ts';
import type { HostTree } from './host-tree.ts';
import { renderedView, type NativeView } from './overlay-nativescript-views.ts';

/** A tap, in the same units and window as `NativeView.getLocationInWindow()`. */
export interface TapPoint {
  x: number;
  y: number;
}

/** What one platform does: draw a box over a window frame, and catch taps over the window. */
export interface NativeScriptPlatform {
  drawBox(frame: NativeFrame): boolean;
  removeBox(): void;
  catchTaps(onTap: (point: TapPoint) => void): (() => void) | null;
}

/** Where a view is in the window, in device-independent pixels; null before it is laid out. */
export function nativeScriptFrame(view: NativeView): NativeFrame | null {
  try {
    const at = view.getLocationInWindow?.();
    const size = view.getActualSize?.();
    if (!at || !size || !(size.width > 0) || !(size.height > 0)) return null;
    return { x: at.x, y: at.y, width: size.width, height: size.height };
  } catch {
    // a view whose native view is gone
    return null;
  }
}

/** The pick and highlight surface over the NativeScript view tree. */
export function nativeScriptSurface(
  tree: HostTree<NativeView>,
  platform: NativeScriptPlatform | null,
): NativeSurface<NativeView> {
  return {
    captureTaps: (onTap) =>
      platform?.catchTaps((point) => onTap(viewAt(tree, nativeScriptFrame, point))) ?? null,
    showBox: (view) => {
      const frame = nativeScriptFrame(renderedView(view)) ?? nativeScriptFrame(view);
      return !!frame && !!platform?.drawBox(frame);
    },
    hideBox: () => platform?.removeBox(),
  };
}

type Native = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const [RED, GREEN, BLUE] = [1, 3, 5].map(
  (at) => parseInt(HIGHLIGHT_COLOR.slice(at, at + 2), 16) / 255,
) as [number, number, number];

/**
 * UIKit: the box is a `UIView` with a border that ignores touches, and the
 * catcher a clear `UIView` over the whole window whose `touchesEnded` reports
 * the point. Points are the units NativeScript's layout uses on iOS.
 */
export function iosPlatform(
  g: Native,
  window: () => Native | null | undefined,
): NativeScriptPlatform {
  let box: Native | null = null;
  let Catcher: Native | null = null;
  return {
    drawBox: (frame) => {
      const win = window();
      if (!win) return false;
      box?.removeFromSuperview();
      box = g['UIView']
        .alloc()
        .initWithFrame(g['CGRectMake'](frame.x, frame.y, frame.width, frame.height));
      box!['userInteractionEnabled'] = false;
      box!['backgroundColor'] = g['UIColor'].clearColor;
      box!['layer'].borderWidth = HIGHLIGHT_BORDER;
      box!['layer'].borderColor = g['UIColor'].colorWithRedGreenBlueAlpha(
        RED,
        GREEN,
        BLUE,
        1,
      ).CGColor;
      win['addSubview'](box);
      return true;
    },
    removeBox: () => {
      box?.removeFromSuperview();
      box = null;
    },
    catchTaps: (onTap) => {
      const win = window();
      if (!win) return null;
      let report: (point: TapPoint) => void = onTap;
      Catcher ??= g['UIView'].extend({
        touchesEndedWithEvent(this: Native, touches: Native) {
          const point = touches['anyObject']()?.locationInView(this);
          if (point) (this['pangularTap'] as ((p: TapPoint) => void) | undefined)?.(point);
        },
      });
      const catcher = Catcher!['alloc']().initWithFrame(win['bounds']);
      catcher['backgroundColor'] = g['UIColor'].colorWithWhiteAlpha(0, 0.01);
      catcher['pangularTap'] = (point: TapPoint) => report({ x: point.x, y: point.y });
      win['addSubview'](catcher);
      return () => {
        report = () => {};
        catcher['removeFromSuperview']();
      };
    },
  };
}

/**
 * Android: the box is a `View` with a stroked `GradientDrawable` that takes no
 * clicks, and the catcher a `View` over the whole decor view whose touch
 * listener reports where a touch ended. Both are placed in pixels, and the
 * tap is turned back into device-independent pixels.
 */
export function androidPlatform(
  g: Native,
  activity: () => Native | null | undefined,
  density: () => number,
): NativeScriptPlatform {
  const android = g['android'];
  let box: Native | null = null;
  let boxParent: Native | null = null;
  const decorOf = (current: Native) => current['getWindow']().getDecorView();
  const remove = () => {
    if (box && boxParent) boxParent['removeView'](box);
    box = null;
    boxParent = null;
  };
  return {
    drawBox: (frame) => {
      const current = activity();
      if (!current) return false;
      remove();
      const scale = density();
      const shape = new android.graphics.drawable.GradientDrawable();
      shape.setColor(0);
      shape.setStroke(
        Math.round(HIGHLIGHT_BORDER * scale),
        android.graphics.Color.parseColor(HIGHLIGHT_COLOR),
      );
      const view = new android.view.View(current);
      view.setBackground(shape);
      view.setClickable(false);
      view.setFocusable(false);
      view.setLayoutParams(
        new android.widget.FrameLayout.LayoutParams(
          Math.round(frame.width * scale),
          Math.round(frame.height * scale),
        ),
      );
      view.setX(frame.x * scale);
      view.setY(frame.y * scale);
      boxParent = decorOf(current);
      boxParent!['addView'](view);
      box = view;
      return true;
    },
    removeBox: remove,
    catchTaps: (onTap) => {
      const current = activity();
      if (!current) return null;
      const scale = density();
      const decor = decorOf(current);
      const catcher = new android.view.View(current);
      const match = android.view.ViewGroup.LayoutParams.MATCH_PARENT;
      catcher.setLayoutParams(new android.widget.FrameLayout.LayoutParams(match, match));
      let report: (point: TapPoint) => void = onTap;
      catcher.setOnTouchListener(
        new android.view.View.OnTouchListener({
          onTouch: (_view: Native, event: Native) => {
            if (event['getAction']() === android.view.MotionEvent.ACTION_UP) {
              report({ x: event['getX']() / scale, y: event['getY']() / scale });
            }
            // Every touch is kept from the app while the pick runs.
            return true;
          },
        }),
      );
      decor['addView'](catcher);
      return () => {
        report = () => {};
        decor['removeView'](catcher);
      };
    },
  };
}
