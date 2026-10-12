// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLASH_FADE_MS,
  FLASH_STILL_MS,
  MAX_FLASH_BOXES,
  createCdFlash,
  type FlashContext,
} from '../cd-flash.ts';
import { PROFILER_EVENT as E } from '../cd-recorder.ts';

type Profiler = (event: number, instance?: unknown, hook?: unknown) => void;

class Cart {}
class _Price {}

/** Mirrors Angular's v20+ profiler registry and `ng.getHostElement`. */
function fakeNg() {
  const profilers: Profiler[] = [];
  const hosts = new Map<object, Element>();
  return {
    profilers,
    hosts,
    ɵsetProfiler: vi.fn((profiler: Profiler) => {
      profilers.push(profiler);
      return () => profilers.splice(profilers.indexOf(profiler), 1);
    }),
    getHostElement: (instance: object) => hosts.get(instance) ?? null,
    emit(event: number, instance?: unknown) {
      for (const profiler of [...profilers]) profiler(event, instance);
    },
  };
}

/** A context that keeps what was drawn, with the alpha each label was drawn at. */
function fakeContext() {
  const labels: { text: string; alpha: number; x: number; y: number }[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: 'alphabetic',
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText(text: string, x: number, y: number) {
      labels.push({ text, alpha: ctx.globalAlpha, x, y });
    },
  };
  return { ctx: ctx as unknown as FlashContext & typeof ctx, labels };
}

function fakeWindow(options: { reduced?: boolean } = {}) {
  let frames: FrameRequestCallback[] = [];
  const win = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 2,
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame: vi.fn((fn: FrameRequestCallback) => {
      frames.push(fn);
      return frames.length;
    }),
    cancelAnimationFrame: vi.fn(() => {
      frames = [];
    }),
    matchMedia: vi.fn((query: string) => ({
      matches: query.includes('reduced-motion') && options.reduced === true,
    })),
    /** Runs the frames queued so far. */
    frame() {
      const run = frames;
      frames = [];
      for (const fn of run) fn(0);
    },
    get queued() {
      return frames.length;
    },
  };
  return win;
}

function hostFor(ng: ReturnType<typeof fakeNg>, instance: object, rect: Partial<DOMRect> = {}) {
  const el = document.createElement('app-cart');
  document.body.appendChild(el);
  const box = { top: 10, left: 20, width: 100, height: 40, ...rect };
  el.getBoundingClientRect = vi.fn(() => box as DOMRect);
  ng.hosts.set(instance, el);
  return el;
}

function setup(options: { reduced?: boolean } = {}) {
  document.body.innerHTML = '<app-root ng-version="22.1.7"></app-root>';
  const ng = fakeNg();
  const win = fakeWindow(options);
  const { ctx, labels } = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  let t = 0;
  const flash = createCdFlash({
    getNg: () => ng,
    win: win as unknown as Window,
    now: () => t,
  });
  const check = (instance: object, times = 1) => {
    for (let i = 0; i < times; i++) {
      ng.emit(E.ComponentStart);
      ng.emit(E.ComponentEnd, instance);
    }
  };
  return {
    ng,
    win,
    ctx,
    labels,
    flash,
    check,
    advance: (ms: number) => (t += ms),
    overlay: () => document.getElementById('pangular-cd-flash'),
  };
}

describe('flash overlay', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('adds no profiler listener and no element while it is off', () => {
    const { ng, flash, check, win, overlay } = setup();
    hostFor(ng, new Cart());
    check(new Cart());
    expect(ng.ɵsetProfiler).not.toHaveBeenCalled();
    expect(ng.profilers).toHaveLength(0);
    expect(win.requestAnimationFrame).not.toHaveBeenCalled();
    expect(overlay()).toBeNull();
    expect(flash.on).toBe(false);
  });

  it('removes its listener, frame and canvas when turned off', () => {
    const { ng, flash, check, win, overlay } = setup();
    const cart = new Cart();
    hostFor(ng, cart);
    expect(flash.set(true)).toBe(true);
    expect(ng.profilers).toHaveLength(1);
    check(cart);
    win.frame();
    expect(overlay()).not.toBeNull();
    check(cart);
    flash.set(false);
    expect(ng.profilers).toHaveLength(0);
    expect(win.cancelAnimationFrame).toHaveBeenCalled();
    expect(overlay()).toBeNull();
  });

  it('measures hosts once per frame, never inside the profiler callback', () => {
    const { ng, flash, check, win } = setup();
    const cart = new Cart();
    const price = new _Price();
    const cartHost = hostFor(ng, cart);
    const priceHost = hostFor(ng, price, { top: 100 });
    flash.set(true);
    check(cart, 5);
    check(price, 2);
    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(cartHost.getBoundingClientRect).not.toHaveBeenCalled();
    win.frame();
    expect(cartHost.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(priceHost.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it('labels each box with the class name and the checks since it appeared', () => {
    const { ng, flash, check, win, labels, advance } = setup();
    const cart = new Cart();
    const price = new _Price();
    hostFor(ng, cart);
    hostFor(ng, price, { top: 200 });
    flash.set(true);
    check(cart, 2);
    check(price);
    win.frame();
    expect(labels.map((l) => l.text)).toEqual(['Cart ×2', 'Price ×1']);

    labels.length = 0;
    advance(500);
    check(cart);
    win.frame();
    expect(labels.map((l) => l.text)).toContain('Cart ×3');

    // Once a box has faded, the next check starts a new one at 1.
    advance(FLASH_FADE_MS);
    win.frame();
    labels.length = 0;
    check(cart);
    win.frame();
    expect(labels.map((l) => l.text)).toEqual(['Cart ×1']);
  });

  it('fades a box out over a second and then stops drawing', () => {
    const { ng, flash, check, win, labels, advance, ctx } = setup();
    const cart = new Cart();
    hostFor(ng, cart);
    flash.set(true);
    check(cart);
    win.frame();
    advance(250);
    win.frame();
    advance(500);
    win.frame();
    const alphas = labels.map((l) => l.alpha);
    expect(alphas[0]).toBe(1);
    expect(alphas[1]).toBeCloseTo(0.75);
    expect(alphas[2]).toBeCloseTo(0.25);
    advance(300);
    win.frame();
    expect(win.queued).toBe(0);
    expect(ctx.clearRect).toHaveBeenCalledTimes(4);
  });

  it('shows a short still outline without fading under reduced motion', () => {
    const { ng, flash, check, win, labels, advance, ctx } = setup({ reduced: true });
    const cart = new Cart();
    hostFor(ng, cart);
    flash.set(true);
    check(cart);
    win.frame();
    advance(FLASH_STILL_MS / 2);
    win.frame();
    // Nothing changed, so nothing is drawn again.
    expect(labels).toHaveLength(1);
    expect(labels[0].alpha).toBe(1);
    advance(FLASH_STILL_MS / 2);
    win.frame();
    expect(labels).toHaveLength(1);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(win.queued).toBe(0);
  });

  it(`draws at most ${MAX_FLASH_BOXES} boxes at once`, () => {
    const { ng, flash, check, win, ctx } = setup();
    flash.set(true);
    for (let i = 0; i < MAX_FLASH_BOXES + 50; i++) {
      const instance = new Cart();
      hostFor(ng, instance, { top: i });
      check(instance);
    }
    win.frame();
    expect(ctx.strokeRect).toHaveBeenCalledTimes(MAX_FLASH_BOXES);
  });

  it('sizes the canvas for the device pixel ratio and follows a resize', () => {
    const { ng, flash, check, win, overlay, ctx } = setup();
    const cart = new Cart();
    hostFor(ng, cart);
    flash.set(true);
    check(cart);
    win.frame();
    const canvas = overlay()!.shadowRoot!.querySelector('canvas')!;
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    win.innerWidth = 400;
    win.devicePixelRatio = 1;
    win.frame();
    expect([canvas.width, canvas.height]).toEqual([400, 600]);
  });

  it('keeps a box on its element when the page scrolls', () => {
    const { ng, flash, check, win, labels } = setup();
    const cart = new Cart();
    hostFor(ng, cart, { top: 300, left: 20 });
    flash.set(true);
    check(cart);
    win.frame();
    expect(labels[0].y).toBe(300 - 16 + 2);
    win.scrollY = 100;
    win.frame();
    expect(labels[1].y).toBe(200 - 16 + 2);
  });

  it("draws inside its own shadow root and leaves the app's elements alone", () => {
    const { ng, flash, check, win, overlay } = setup();
    const cart = new Cart();
    const host = hostFor(ng, cart);
    flash.set(true);
    check(cart);
    win.frame();
    const el = overlay()!;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.position).toBe('fixed');
    expect(el.shadowRoot!.querySelector('canvas')).not.toBeNull();
    expect(el.children).toHaveLength(0);
    expect(host.getAttributeNames()).toEqual([]);
    expect(host.children).toHaveLength(0);
  });

  it('schedules frames outside the Angular zone', () => {
    const run = vi.fn(<T>(fn: () => T) => fn());
    vi.stubGlobal('Zone', { root: { run } });
    try {
      const { ng, flash, check } = setup();
      const cart = new Cart();
      hostFor(ng, cart);
      flash.set(true);
      check(cart);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports false and attaches nothing before Angular 20', () => {
    const { ng, flash } = setup();
    document.body.innerHTML = '<app-root ng-version="19.2.0"></app-root>';
    expect(flash.set(true)).toBe(false);
    expect(ng.profilers).toHaveLength(0);
    expect(flash.on).toBe(false);
  });
});
