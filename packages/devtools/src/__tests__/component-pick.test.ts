// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startComponentPick } from '../component-pick.ts';
import type { ComponentDebugNg } from '../component-tree.ts';
import { elementById } from '../element-id.ts';
import { POPUP_ROOT_ID } from '../panel-frame.ts';

class _TripCard {}

function setup() {
  document.body.innerHTML = `
    <app-root ng-version="22.0.0"><app-trip-card><button>Book</button></app-trip-card></app-root>
    <p class="outside">Plain</p>
    <div id="${POPUP_ROOT_ID}"><span class="fab"></span></div>`;
  const root = document.querySelector('app-root')!;
  const card = document.querySelector('app-trip-card')!;
  const instances = new Map<Element, object>([
    [root, {}],
    [card, new _TripCard()],
  ]);
  const ng: ComponentDebugNg = { getComponent: (el) => instances.get(el) ?? null };
  const highlight = { show: vi.fn(), clear: vi.fn() };
  const pick = startComponentPick({ getNg: () => ng, highlight, timeoutMs: 1000 });
  const popup = document.getElementById(POPUP_ROOT_ID)!;
  return { pick, highlight, card, popup };
}

describe('startComponentPick', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('highlights the hovered component and resolves the clicked one', async () => {
    const { pick, highlight, card, popup } = setup();
    expect(popup.hasAttribute('data-picking')).toBe(true);
    const button = card.querySelector('button')!;
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(highlight.show).toHaveBeenCalledWith(card);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(click);
    const result = await pick.result;
    expect(click.defaultPrevented).toBe(true);
    expect(result).toMatchObject({ ok: true, name: 'TripCard', tag: 'app-trip-card' });
    expect(result.ok && elementById(result.id)).toBe(card);
    expect(popup.hasAttribute('data-picking')).toBe(false);
    expect(highlight.clear).toHaveBeenCalled();

    const later = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('keeps presses from the page and picks on pointerup, swallowing the click after it', async () => {
    const { pick, card } = setup();
    const button = card.querySelector('button')!;
    const seen: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      button.addEventListener(type, () => seen.push(type));
    const fire = (type: string, target: Element = button) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
      target.dispatchEvent(event);
      return event;
    };
    expect(fire('pointerdown').defaultPrevented).toBe(true);
    expect(fire('mousedown').defaultPrevented).toBe(true);
    expect(fire('pointerup').defaultPrevented).toBe(true);
    expect(await pick.result).toMatchObject({ ok: true, name: 'TripCard' });
    expect(fire('click').defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    expect(fire('click').defaultPrevented).toBe(false);
    expect(seen).toEqual(['click']);
  });

  it('lets presses on the popup through and needs a press before a release picks', async () => {
    const { pick, card, popup } = setup();
    const fab = popup.querySelector('.fab')!;
    const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    fab.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    card.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true }));
    pick.cancel();
    expect(await pick.result).toEqual({ ok: false, error: 'Picking cancelled.' });
  });

  it('highlights an SVG component host', async () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><svg><g app-bar><rect></rect></g></svg></app-root>`;
    const root = document.querySelector('app-root')!;
    const bar = document.querySelector('g')!;
    const instances = new Map<Element, object>([
      [root, {}],
      [bar, {}],
    ]);
    const ng: ComponentDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    const highlight = { show: vi.fn(), clear: vi.fn() };
    const pick = startComponentPick({ getNg: () => ng, highlight, timeoutMs: 1000 });
    document.querySelector('rect')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(highlight.show).toHaveBeenCalledWith(bar);
    pick.cancel();
    await pick.result;
  });

  it('keeps the hover box while the pointer stays and clears it when the pointer leaves the page', async () => {
    const { pick, highlight, card } = setup();
    const button = card.querySelector('button')!;
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: card }));
    expect(highlight.clear).not.toHaveBeenCalled();
    button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(highlight.clear).toHaveBeenCalledTimes(1);
    pick.cancel();
    await pick.result;
  });

  it('ignores the devtools popup and says when a click is outside any component', async () => {
    const { pick, highlight } = setup();
    const fab = document.querySelector('.fab')!;
    fab.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const onFab = new MouseEvent('click', { bubbles: true, cancelable: true });
    fab.dispatchEvent(onFab);
    expect(onFab.defaultPrevented).toBe(false);
    expect(highlight.show).not.toHaveBeenCalled();

    document
      .querySelector('.outside')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(await pick.result).toEqual({
      ok: false,
      error: 'That element is not inside an Angular component.',
    });
  });

  it('picks a component inside the shadow root of a ShadowDom component', async () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-shell></app-shell></app-root>`;
    const root = document.querySelector('app-root')!;
    const shell = document.querySelector('app-shell')!;
    shell.attachShadow({ mode: 'open' }).innerHTML =
      '<app-trip-card><button>Book</button></app-trip-card>';
    const card = shell.shadowRoot!.querySelector('app-trip-card')!;
    class _Shell {}
    const instances = new Map<Element, object>([
      [root, {}],
      [shell, new _Shell()],
      [card, new _TripCard()],
    ]);
    const ng: ComponentDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    const highlight = { show: vi.fn(), clear: vi.fn() };
    const pick = startComponentPick({ getNg: () => ng, highlight, timeoutMs: 1000 });
    const button = card.querySelector('button')!;

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    expect(highlight.show).toHaveBeenLastCalledWith(card);
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
    );
    const result = await pick.result;
    expect(result).toMatchObject({ ok: true, name: 'TripCard', tag: 'app-trip-card' });
    expect(result.ok && elementById(result.id)).toBe(card);
  });

  it('follows the pointer between components inside one shadow root', async () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-shell></app-shell></app-root>`;
    const root = document.querySelector('app-root')!;
    const shell = document.querySelector('app-shell')!;
    shell.attachShadow({ mode: 'open' }).innerHTML =
      '<app-trip-card><button>Book</button></app-trip-card><app-map><b>Map</b></app-map>';
    const card = shell.shadowRoot!.querySelector('app-trip-card')!;
    const map = shell.shadowRoot!.querySelector('app-map')!;
    const instances = new Map<Element, object>([
      [root, {}],
      [shell, {}],
      [card, new _TripCard()],
      [map, {}],
    ]);
    const ng: ComponentDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    const highlight = { show: vi.fn(), clear: vi.fn() };
    const pick = startComponentPick({ getNg: () => ng, highlight, timeoutMs: 1000 });
    const move = (el: Element) =>
      el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }));

    move(card.querySelector('button')!);
    expect(highlight.show).toHaveBeenLastCalledWith(card);
    move(map.querySelector('b')!);
    expect(highlight.show).toHaveBeenLastCalledWith(map);
    // Moving within the same component does not redraw the box.
    move(map.querySelector('b')!);
    expect(highlight.show).toHaveBeenCalledTimes(2);
    pick.cancel();
    await pick.result;
  });

  it('ends on Escape, on cancel and after the timeout', async () => {
    const first = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await first.pick.result).toEqual({ ok: false, error: 'Picking cancelled.' });

    const second = setup();
    second.pick.cancel();
    expect(await second.pick.result).toEqual({ ok: false, error: 'Picking cancelled.' });

    vi.useFakeTimers();
    const third = setup();
    vi.advanceTimersByTime(1000);
    expect(await third.pick.result).toEqual({ ok: false, error: 'No component was picked.' });
    expect(third.popup.hasAttribute('data-picking')).toBe(false);
  });
});
