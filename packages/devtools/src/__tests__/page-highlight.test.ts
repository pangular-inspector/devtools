// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHighlight,
  HIGHLIGHT_SAFETY_MS,
  highlightBox,
  showHighlight,
} from '../page-highlight.ts';

const handlers = new Map<string, (arg: unknown) => void>();

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    scope: () => ({
      rpc: {
        call: async () => undefined,
        register: (definition: { name: string; handler: (arg: unknown) => void }) =>
          handlers.set(definition.name, definition.handler),
      },
    }),
  }),
}));

function place(el: Element, rect: { x: number; y: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      top: rect.y,
      left: rect.x,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      toJSON: () => rect,
    }) as DOMRect;
}

const box = () =>
  [...document.body.children].find(
    (el) => el instanceof HTMLElement && el.style.pointerEvents === 'none',
  ) as HTMLElement | undefined;

describe('page highlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    clearHighlight();
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
  });

  it('draws over an SVG host', () => {
    document.body.innerHTML = '<svg><g app-bar></g></svg>';
    const bar = document.querySelector('g')!;
    place(bar, { x: 10, y: 20, width: 30, height: 40 });
    expect(showHighlight(bar)).toBe(true);
    expect(box()?.style).toMatchObject({ left: '10px', top: '20px', width: '30px' });
  });

  it('draws around the children of a display: contents host', () => {
    document.body.innerHTML =
      '<app-row style="display: contents"><div id="a"></div><div id="b"></div></app-row>';
    const row = document.querySelector('app-row')!;
    place(row, { x: 0, y: 0, width: 0, height: 0 });
    place(document.getElementById('a')!, { x: 10, y: 100, width: 200, height: 50 });
    place(document.getElementById('b')!, { x: 10, y: 150, width: 300, height: 50 });
    expect(highlightBox(row)).toEqual({ top: 100, left: 10, width: 300, height: 100 });
    expect(showHighlight(row)).toBe(true);
    expect(box()?.style).toMatchObject({ top: '100px', height: '100px' });
  });

  it('draws nothing for a hidden host and says so', () => {
    document.body.innerHTML = '<app-tab hidden><div></div></app-tab>';
    const tab = document.querySelector('app-tab')!;
    expect(showHighlight(tab)).toBe(false);
    expect(box()).toBeUndefined();
  });

  it('scrolls the host into view only when asked', () => {
    document.body.innerHTML = '<app-card></app-card>';
    const card = document.querySelector('app-card')!;
    place(card, { x: 0, y: 3000, width: 100, height: 100 });
    card.scrollIntoView = vi.fn();
    showHighlight(card);
    expect(card.scrollIntoView).not.toHaveBeenCalled();
    showHighlight(card, { reveal: true });
    expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('shows the box as a popover, above an open dialog or overlay', () => {
    const shown: Element[] = [];
    HTMLElement.prototype.showPopover = function (this: HTMLElement) {
      shown.push(this);
    };
    document.body.innerHTML = '<div popover="manual" id="menu"><app-item></app-item></div>';
    const item = document.querySelector('app-item')!;
    place(item, { x: 5, y: 5, width: 50, height: 20 });
    showHighlight(item);
    expect(box()?.getAttribute('popover')).toBe('manual');
    expect(shown).toEqual([box()]);
  });

  it('keeps the z-index when the Popover API is missing', () => {
    document.body.innerHTML = '<app-item></app-item>';
    const item = document.querySelector('app-item')!;
    place(item, { x: 5, y: 5, width: 50, height: 20 });
    showHighlight(item);
    expect(box()?.hasAttribute('popover')).toBe(false);
    expect(box()?.style.zIndex).toBe('2147483645');
  });

  it('keeps a panel highlight until a clear arrives, and an agent highlight clears itself', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { initOverlay } = await import('../overlay.ts');
    const stop = await initOverlay();
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<app-card class="card"></app-card>';
      place(document.querySelector('app-card')!, { x: 1, y: 2, width: 3, height: 4 });
      handlers.get('highlight-in-page')!('app-card');
      vi.advanceTimersByTime(10_000);
      expect(box()).toBeDefined();
      handlers.get('highlight-in-page')!(null);
      expect(box()).toBeUndefined();

      handlers.get('highlight-in-page')!('app-card');
      vi.advanceTimersByTime(HIGHLIGHT_SAFETY_MS);
      expect(box()).toBeUndefined();

      handlers.get('highlight-in-page')!({ selector: '.card', reveal: true, durationMs: 2000 });
      vi.advanceTimersByTime(1900);
      expect(box()).toBeDefined();
      vi.advanceTimersByTime(200);
      expect(box()).toBeUndefined();
    } finally {
      vi.useRealTimers();
      stop();
      vi.unstubAllGlobals();
    }
  });

  it('accepts an SVG element from the highlight-in-page request', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { initOverlay } = await import('../overlay.ts');
    const stop = await initOverlay();
    try {
      document.body.innerHTML = '<svg><g class="bar"></g></svg>';
      place(document.querySelector('g')!, { x: 1, y: 2, width: 3, height: 4 });
      handlers.get('highlight-in-page')!('g.bar');
      expect(box()?.style.width).toBe('3px');
      handlers.get('highlight-in-page')!(null);
      expect(box()).toBeUndefined();
    } finally {
      stop();
      vi.unstubAllGlobals();
    }
  });
});
