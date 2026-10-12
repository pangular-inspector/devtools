// The hydration overlay: an outline over each hydrated, skipped and
// mismatched component and each dehydrated `@defer` block, with a legend. It
// draws in a shadow root this package owns, never in the app's own DOM.

import { elementById } from './element-id.ts';
import { highlightBox } from './page-highlight.ts';
import {
  hydrationRegions,
  withDeferHydration,
  type HydrationRegion,
  type HydrationRegionKind,
} from './hydration.ts';
import { outsideAngular } from './change-detection.ts';
import type { DeferBlockInfo, HydrationReport, LiveComponentNode } from './types.ts';

const HOST_ID = 'pangular-hydration-overlay';

/** Color, line and legend text of each region kind; the line style tells them apart without color. */
export const HYDRATION_LEGEND: Record<
  HydrationRegionKind,
  { label: string; color: string; border: string }
> = {
  hydrated: { label: 'Hydrated', color: '34, 197, 94', border: 'solid' },
  skipped: { label: 'Skipped (ngSkipHydration)', color: '56, 189, 248', border: 'dashed' },
  mismatched: { label: 'Mismatched', color: '239, 68, 68', border: 'double' },
  dehydrated: { label: 'Dehydrated @defer', color: '168, 85, 247', border: 'dotted' },
};

const KINDS = Object.keys(HYDRATION_LEGEND) as HydrationRegionKind[];

const STYLE = `
:host { all: initial; }
.box {
  position: fixed;
  box-sizing: border-box;
  pointer-events: none;
  border-radius: 3px;
}
.tag {
  position: absolute;
  left: -2px;
  max-width: 260px;
  padding: 1px 5px;
  overflow: hidden;
  border-radius: 3px;
  color: #0b0b0f;
  font: 600 11px/14px system-ui, sans-serif;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.legend {
  position: fixed;
  right: 12px;
  bottom: 12px;
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(11, 11, 15, 0.88);
  color: #f4f4f5;
  font: 12px/16px system-ui, sans-serif;
  pointer-events: none;
}
.legend strong { font-weight: 600; }
.item { display: flex; align-items: center; gap: 8px; }
.swatch { width: 18px; height: 10px; box-sizing: border-box; border-width: 3px; }
`;

export interface HydrationOverlayOptions {
  doc?: Document;
  win?: Window;
  /** Finds the element of an id from the component tree. */
  resolve?: (id: string) => Element | null;
}

/**
 * Outlines hydration regions on the page while it is on. Off, it has no
 * element and no listener. Boxes are positioned on scroll and resize, once
 * per animation frame, and on each `update`.
 */
export function createHydrationOverlay(options: HydrationOverlayOptions = {}) {
  const doc = options.doc ?? document;
  const win = options.win ?? window;
  const resolve =
    options.resolve ??
    ((id: string) => {
      const el = elementById(id);
      return el instanceof Element ? el : null;
    });
  let on = false;
  let regions: HydrationRegion[] = [];
  let host: HTMLElement | null = null;
  let layer: HTMLElement | null = null;
  let legend: HTMLElement | null = null;
  let frame = 0;

  const mount = () => {
    if (host) return;
    const el = doc.createElement('div');
    el.id = HOST_ID;
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      padding: '0',
      border: '0',
      background: 'transparent',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '2147483643',
    } satisfies Partial<CSSStyleDeclaration>);
    const shadow = el.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    layer = doc.createElement('div');
    legend = doc.createElement('div');
    legend.className = 'legend';
    shadow.append(style, layer, legend);
    // Dialogs and popovers paint above any z-index; a popover shown after them paints above them.
    const topLayer = typeof el.showPopover === 'function';
    if (topLayer) el.setAttribute('popover', 'manual');
    (doc.body ?? doc.documentElement).appendChild(el);
    if (topLayer) {
      try {
        el.showPopover();
      } catch {
        // keeps the z-index
      }
    }
    host = el;
  };

  const unmount = () => {
    host?.remove();
    host = null;
    layer = null;
    legend = null;
  };

  const box = (kind: HydrationRegionKind, label: string, rect: DOMRectLike) => {
    const { color, border } = HYDRATION_LEGEND[kind];
    const el = doc.createElement('div');
    el.className = `box ${kind}`;
    Object.assign(el.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: `${kind === 'mismatched' ? 4 : 2}px ${border} rgb(${color})`,
      background: `rgba(${color}, ${kind === 'hydrated' ? 0.04 : 0.1})`,
    });
    const tag = doc.createElement('span');
    tag.className = 'tag';
    tag.textContent = `${HYDRATION_LEGEND[kind].label.split(' ')[0]}: ${label}`;
    Object.assign(tag.style, {
      top: rect.top >= 16 ? '-16px' : '0',
      background: `rgb(${color})`,
    });
    el.appendChild(tag);
    return el;
  };

  const draw = () => {
    frame = 0;
    if (!on) return;
    mount();
    if (!layer || !legend) return;
    const boxes: HTMLElement[] = [];
    const counts = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<
      HydrationRegionKind,
      number
    >;
    for (const region of regions) {
      counts[region.kind]++;
      const rect = unionBox(region.ids.map(resolve));
      if (!rect) continue;
      boxes.push(box(region.kind, region.label, rect));
    }
    layer.replaceChildren(...boxes);
    const title = doc.createElement('strong');
    title.textContent = 'Hydration';
    const items = KINDS.map((kind) => {
      const { label, color, border } = HYDRATION_LEGEND[kind];
      const item = doc.createElement('span');
      item.className = 'item';
      const swatch = doc.createElement('span');
      swatch.className = 'swatch';
      swatch.style.borderStyle = border;
      swatch.style.borderColor = `rgb(${color})`;
      item.append(swatch, `${label}: ${counts[kind]}`);
      return item;
    });
    legend.replaceChildren(title, ...items);
  };

  const schedule = () => {
    if (frame || !on) return;
    // Outside the Angular zone, so the frame does not start a change detection.
    frame = outsideAngular(() => win.requestAnimationFrame(draw));
  };

  return {
    get on() {
      return on;
    },
    /** Turns the overlay on or off. */
    set(next: boolean) {
      if (next === on) return;
      on = next;
      if (on) {
        win.addEventListener('scroll', schedule, { capture: true, passive: true });
        win.addEventListener('resize', schedule, { passive: true });
        schedule();
        return;
      }
      win.removeEventListener('scroll', schedule, { capture: true });
      win.removeEventListener('resize', schedule);
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      regions = [];
      unmount();
    },
    /** Takes the regions of the latest component tree; redraws only while on. */
    update(roots: LiveComponentNode[], deferBlocks: DeferBlockInfo[] | undefined) {
      if (!on) return;
      regions = hydrationRegions(roots, deferBlocks);
      schedule();
    },
    /** Draws now instead of on the next animation frame; for tests. */
    flush() {
      if (frame) win.cancelAnimationFrame(frame);
      draw();
    },
  };
}

export type HydrationOverlay = ReturnType<typeof createHydrationOverlay>;

interface DOMRectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The box around every element of a region that is on the page, or null. */
function unionBox(elements: (Element | null)[]): DOMRectLike | null {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of elements) {
    const rect = el ? highlightBox(el) : null;
    if (!rect) continue;
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.left + rect.width);
    bottom = Math.max(bottom, rect.top + rect.height);
  }
  return top === Infinity ? null : { top, left, width: right - left, height: bottom - top };
}

interface RpcScope {
  rpc: {
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      handler: (message: { pageId?: unknown; on?: unknown } | null) => unknown;
    }): void;
  };
}

/**
 * The page side of the hydration overlay: the `hydration-overlay` event the
 * server broadcasts turns it on or off for this page, then `changed` pushes
 * the tree again so the report says it is on. `report` adds the dehydrated
 * `@defer` count and the overlay flag to a tree's hydration report, and
 * hands the tree to the overlay while it is on.
 */
export function attachHydrationOverlay(
  my: RpcScope,
  pageId: string,
  changed: () => void,
  overlay: HydrationOverlay = createHydrationOverlay(),
) {
  my.rpc.register({
    name: 'hydration-overlay',
    type: 'event',
    jsonSerializable: true,
    handler: (message) => {
      if (typeof message?.pageId === 'string' && message.pageId !== pageId) return;
      if (typeof message?.on !== 'boolean') return;
      overlay.set(message.on);
      changed();
    },
  });
  return {
    report(
      tree: { roots: LiveComponentNode[]; hydration?: HydrationReport },
      deferBlocks: DeferBlockInfo[] | undefined,
    ): { hydration?: HydrationReport } {
      const hydration = withDeferHydration(tree.hydration, deferBlocks, overlay.on);
      overlay.update(tree.roots, deferBlocks);
      return hydration ? { hydration } : {};
    },
    stop: () => overlay.set(false),
  };
}
