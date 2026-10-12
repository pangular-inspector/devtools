// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachHydrationOverlay, createHydrationOverlay } from '../hydration-overlay.ts';
import type { LiveComponentNode } from '../types.ts';

function fakeWindow() {
  let frames: FrameRequestCallback[] = [];
  const listeners = new Map<string, EventListener>();
  const win = {
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }),
    cancelAnimationFrame: vi.fn(),
    addEventListener: vi.fn((type: string, listener: EventListener) =>
      listeners.set(type, listener),
    ),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  };
  const runFrames = () => {
    const pending = frames;
    frames = [];
    for (const cb of pending) cb(0);
  };
  return { win: win as unknown as Window, listeners, runFrames, frames: () => frames };
}

const box = (el: Element, rect: { top: number; left: number; width: number; height: number }) => {
  el.getBoundingClientRect = () =>
    ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect;
};

function appPage() {
  document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card><app-map></app-map></app-root>`;
  const root = document.querySelector('app-root')!;
  const card = document.querySelector('app-card')!;
  const map = document.querySelector('app-map')!;
  box(root, { top: 0, left: 0, width: 400, height: 300 });
  box(card, { top: 20, left: 10, width: 100, height: 50 });
  box(map, { top: 100, left: 10, width: 200, height: 80 });
  const byId: Record<string, Element> = { c1: root, c2: card, c3: map };
  const roots: LiveComponentNode[] = [
    {
      id: 'c1',
      name: 'App',
      tag: 'app-root',
      hydration: 'hydrated',
      children: [
        { id: 'c2', name: 'Card', tag: 'app-card', hydration: 'hydrated', children: [] },
        { id: 'c3', name: 'Map', tag: 'app-map', hydration: 'skipped', children: [] },
      ],
    },
  ];
  return { root, roots, resolve: (id: string) => byId[id] ?? null };
}

/** Records every change to the app's own elements. */
function watchApp(root: Element) {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  return () => {
    records.push(...observer.takeRecords());
    observer.disconnect();
    return records;
  };
}

describe('hydration overlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates nothing and listens to nothing while off', () => {
    const { roots, resolve } = appPage();
    const { win, frames } = fakeWindow();
    const overlay = createHydrationOverlay({ win, resolve });
    const before = document.body.innerHTML;
    overlay.update(roots, []);
    expect(overlay.on).toBe(false);
    expect(document.body.innerHTML).toBe(before);
    expect(win.addEventListener).not.toHaveBeenCalled();
    expect(frames()).toEqual([]);
  });

  it('outlines regions with labels and a legend in its own shadow root, never in the app', () => {
    const { root, roots, resolve } = appPage();
    const { win, runFrames } = fakeWindow();
    const overlay = createHydrationOverlay({ win, resolve });
    const changes = watchApp(root);
    overlay.set(true);
    overlay.update(roots, []);
    runFrames();

    const host = document.getElementById('pangular-hydration-overlay')!;
    expect(host.parentElement).toBe(document.body);
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.pointerEvents).toBe('none');
    const shadow = host.shadowRoot!;
    const boxes = Array.from(shadow.querySelectorAll<HTMLElement>('.box'));
    // The card sits inside the hydrated root, so only the root and the skipped map get a box.
    expect(boxes.map((el) => el.querySelector('.tag')!.textContent)).toEqual([
      'Hydrated: App',
      'Skipped: Map',
    ]);
    expect(boxes[1].style.top).toBe('100px');
    expect(boxes[1].style.borderStyle || boxes[1].style.border).toContain('dashed');
    expect(shadow.querySelector('.legend')!.textContent).toContain('Skipped (ngSkipHydration): 1');
    expect(shadow.querySelector('.legend')!.textContent).toContain('Dehydrated @defer: 0');
    expect(changes()).toEqual([]);
    expect(root.getAttributeNames()).toEqual(['ng-version']);
  });

  it('redraws on scroll and removes everything when turned off', () => {
    const { roots, resolve } = appPage();
    const { win, listeners, runFrames } = fakeWindow();
    const overlay = createHydrationOverlay({ win, resolve });
    overlay.set(true);
    overlay.update(roots, []);
    runFrames();
    expect(listeners.has('scroll')).toBe(true);
    listeners.get('scroll')!(new Event('scroll'));
    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(2);

    overlay.set(false);
    expect(document.getElementById('pangular-hydration-overlay')).toBeNull();
    expect(listeners.size).toBe(0);
    overlay.update(roots, []);
    runFrames();
    expect(document.getElementById('pangular-hydration-overlay')).toBeNull();
  });

  it('turns on only for its own page and reports the flag with the tree', () => {
    const { roots, resolve } = appPage();
    const { win, runFrames } = fakeWindow();
    const handlers: ((message: { pageId?: unknown; on?: unknown } | null) => unknown)[] = [];
    const my = {
      rpc: {
        register: (definition: { handler: (typeof handlers)[number] }) =>
          void handlers.push(definition.handler),
      },
    };
    const changed = vi.fn();
    const attached = attachHydrationOverlay(
      my,
      'p1',
      changed,
      createHydrationOverlay({ win, resolve }),
    );
    const hydration = {
      hydrated: true,
      counts: { hydrated: 1, skipped: 1, mismatched: 0, client: 0, dehydratedBlocks: 0 },
      mismatches: [],
    };
    handlers[0]({ pageId: 'p2', on: true });
    expect(changed).not.toHaveBeenCalled();
    expect(attached.report({ roots, hydration }, []).hydration).not.toHaveProperty('overlay');

    handlers[0]({ pageId: 'p1', on: true });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(attached.report({ roots, hydration }, []).hydration).toMatchObject({ overlay: true });
    runFrames();
    expect(document.getElementById('pangular-hydration-overlay')).not.toBeNull();
    expect(attached.report({ roots }, [])).toEqual({});

    attached.stop();
    expect(document.getElementById('pangular-hydration-overlay')).toBeNull();
  });
});
