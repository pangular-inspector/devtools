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
