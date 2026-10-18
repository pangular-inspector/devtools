// The flash overlay: a box over each component Angular checks, drawn on a
// canvas in a shadow root this package owns, never in the app's own DOM.

import { PROFILER_EVENT } from './cd-recorder.ts';
import { createRefreshTracker } from './cd-refresh.ts';
import { addProfilerListener, outsideAngular, type Profiler } from './change-detection.ts';
import { className } from './injector-tree.ts';
import { highlightBox } from './page-highlight.ts';

/** How long a box takes to fade out after its component's last check. */
export const FLASH_FADE_MS = 1000;
/** How long a box stays, without fading, when the user prefers reduced motion. */
export const FLASH_STILL_MS = 400;
/** Boxes on screen at once; checks of other components wait until some fade. */
export const MAX_FLASH_BOXES = 150;
/** Component instances collected between two frames. */
const MAX_PENDING = 1000;

const HOST_ID = 'pangular-cd-flash';

interface FlashBox {
  /** Page coordinates, so a box stays on its element when the window scrolls. */
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  /** Checks since the box appeared. */
  count: number;
  /** When the component was last checked. */
  at: number;
}

/** The part of `CanvasRenderingContext2D` the overlay draws with. */
export type FlashContext = Pick<
  CanvasRenderingContext2D,
  | 'setTransform'
  | 'clearRect'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'measureText'
  | 'globalAlpha'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textBaseline'
>;

export interface CdFlashOptions {
  getNg: () => unknown;
  doc?: Document;
  win?: Window;
  now?: () => number;
}

/** Box colors by how often the component was checked: once, a few times, often. */
function colorFor(count: number): string {
  if (count >= 10) return '239, 68, 68';
  if (count >= 3) return '245, 165, 36';
  return '56, 189, 248';
}

/**
 * Flashes a box over the host of each component Angular checks while it is on.
 * The profiler callback only collects instances; hosts are measured once per
 * animation frame. Off, it has no profiler listener and no element.
 */
export function createCdFlash(options: CdFlashOptions) {
  const doc = options.doc ?? document;
  const win = options.win ?? window;
  const now = options.now ?? (() => performance.now());
  const hosts = new WeakMap<object, Element>();
  const pending = new Map<object, number>();
  const boxes = new Map<Element, FlashBox>();
  let removeListener: (() => void) | null = null;
  let frame = 0;
  let host: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let context: FlashContext | null = null;
  let reduced: MediaQueryList | null = null;
  let size = { w: 0, h: 0, dpr: 0 };
  let drawn = false;

  const hostOf = (instance: object): Element | null => {
    const known = hosts.get(instance);
    if (known) return known;
    try {
      const ng = options.getNg() as { getHostElement?: (instance: object) => unknown } | undefined;
      const el = ng?.getHostElement?.(instance);
      if (!(el instanceof Element)) return null;
      hosts.set(instance, el);
      return el;
    } catch {
      return null;
    }
  };

  const schedule = () => {
    if (frame) return;
    // Outside the Angular zone, so the frame does not start another check.
    frame = outsideAngular(() => win.requestAnimationFrame(tick));
  };

  // Only checks whose template ran, as the recorder counts them (`cd-refresh.ts`).
  const refresh = createRefreshTracker();
  const listener: Profiler = (event, instance) => {
    const refreshed = refresh.onEvent(event, instance);
    if (
      event !== PROFILER_EVENT.ComponentEnd ||
      !refreshed ||
      !instance ||
      typeof instance !== 'object'
    ) {
      return;
    }
    const seen = pending.get(instance);
    if (seen !== undefined) pending.set(instance, seen + 1);
    else if (pending.size < MAX_PENDING) pending.set(instance, 1);
    schedule();
  };

  const mount = (): FlashContext | null => {
    if (context) return context;
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
      zIndex: '2147483644',
    } satisfies Partial<CSSStyleDeclaration>);
    const shadow = el.attachShadow({ mode: 'open' });
    const paper = doc.createElement('canvas');
    Object.assign(paper.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    shadow.appendChild(paper);
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
    let ctx: FlashContext | null = null;
    try {
      ctx = paper.getContext('2d');
    } catch {
      ctx = null;
    }
    host = el;
    canvas = paper;
    context = ctx;
    size = { w: 0, h: 0, dpr: 0 };
    return ctx;
  };

  const unmount = () => {
    host?.remove();
    host = null;
    canvas = null;
    context = null;
    drawn = false;
  };

  const resize = (ctx: FlashContext) => {
    const w = win.innerWidth;
    const h = win.innerHeight;
    const dpr = win.devicePixelRatio || 1;
    if (canvas && (w !== size.w || h !== size.h || dpr !== size.dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      size = { w, h, dpr };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (t: number, still: boolean) => {
    const ctx = mount();
    if (!ctx) return;
    resize(ctx);
    ctx.clearRect(0, 0, size.w, size.h);
    drawn = boxes.size > 0;
    const sx = win.scrollX;
    const sy = win.scrollY;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (const box of boxes.values()) {
      const x = box.x - sx;
      const y = box.y - sy;
      if (x > size.w || y > size.h || x + box.w < 0 || y + box.h < 0) continue;
      const alpha = still ? 1 : Math.max(0, 1 - (t - box.at) / FLASH_FADE_MS);
      const rgb = colorFor(box.count);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(${rgb}, 0.12)`;
      ctx.fillRect(x, y, box.w, box.h);
      ctx.strokeStyle = `rgb(${rgb})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, Math.max(0, box.w - 2), Math.max(0, box.h - 2));
      const label = `${box.name} ×${box.count}`;
      const width = ctx.measureText(label).width + 8;
      const ly = y >= 16 ? y - 16 : y;
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillRect(x, ly, width, 16);
      ctx.fillStyle = '#0b0b0f';
      ctx.fillText(label, x + 4, ly + 2);
    }
    ctx.globalAlpha = 1;
  };

  /** Measures the hosts checked since the last frame, fades the boxes and draws them. */
  function tick() {
    frame = 0;
    const t = now();
    const still = reduced?.matches === true;
    const life = still ? FLASH_STILL_MS : FLASH_FADE_MS;
    let changed = false;
    if (pending.size) {
      const sx = win.scrollX;
      const sy = win.scrollY;
      for (const [instance, count] of pending) {
        const el = hostOf(instance);
        if (!el) continue;
        const box = boxes.get(el);
        const alive = box && t - box.at < life;
        if (!alive && boxes.size >= MAX_FLASH_BOXES) continue;
        const rect = highlightBox(el);
        if (!rect || (rect.width === 0 && rect.height === 0)) continue;
        boxes.set(el, {
          x: rect.left + sx,
          y: rect.top + sy,
          w: rect.width,
          h: rect.height,
          name: className(instance.constructor as { name?: string }),
          count: alive ? box.count + count : count,
          at: t,
        });
        changed = true;
      }
      pending.clear();
    }
    for (const [el, box] of boxes) {
      if (t - box.at >= life) {
        boxes.delete(el);
        changed = true;
      }
    }
    // With reduced motion a box does not change while it shows, so only changes redraw.
    const redraw = changed || (!still && boxes.size > 0);
    if (redraw && (boxes.size || drawn)) draw(t, still);
    if (boxes.size) schedule();
  }

  return {
    get on() {
      return removeListener !== null;
    },
    /** Turns the overlay on or off; false when the page has no profiler to listen to. */
    set(on: boolean): boolean {
      if (!on) {
        removeListener?.();
        removeListener = null;
        refresh.reset();
        if (frame) win.cancelAnimationFrame(frame);
        frame = 0;
        pending.clear();
        boxes.clear();
        unmount();
        return true;
      }
      if (removeListener) return true;
      removeListener = addProfilerListener(options.getNg(), listener, doc);
      if (!removeListener) return false;
      try {
        reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
      } catch {
        reduced = null;
      }
      return true;
    },
  };
}

export type CdFlash = ReturnType<typeof createCdFlash>;
