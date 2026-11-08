import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreStateTree, childPath, stateRows } from '../pages/store-state-tree';

const state = {
  cart: { items: [{ id: 1, name: 'rome' }], total: 3 },
  user: { name: 'ada', 'first name': 'Ada' },
  when: { '@type': 'Date', value: '2026-01-01T00:00:00.000Z' },
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('stateRows', () => {
  it('writes paths the way the change log does', () => {
    expect(childPath('', 'cart')).toBe('cart');
    expect(childPath('cart', 'items')).toBe('cart.items');
    expect(childPath('cart.items', 0)).toBe('cart.items[0]');
    expect(childPath('user', 'first name')).toBe('user["first name"]');
    // The collector writes a top-level key that needs quotes the same way.
    expect(childPath('', 'display name')).toBe('"display name"');
  });

  it('marks a changed key that needs quotes', () => {
    const rows = stateRows(state, { changed: ['user["first name"]'] }).rows;
    expect(rows.find((r) => r.path === 'user["first name"]')!.changed).toBe(true);
    expect(rows.find((r) => r.path === 'user')!.holdsChange).toBe(true);
  });

  it('opens the first level, nodes holding a change, and what the user opened', () => {
    const plain = stateRows(state).rows.map((r) => r.path);
    expect(plain).toEqual([
      'cart',
      'cart.items',
      'cart.total',
      'user',
      'user.name',
      'user["first name"]',
      'when',
    ]);
    const changed = stateRows(state, { changed: ['cart.items[0].name'] }).rows;
    expect(changed.map((r) => r.path)).toContain('cart.items[0].name');
    expect(changed.find((r) => r.path === 'cart.items[0].name')!.changed).toBe(true);
    expect(changed.find((r) => r.path === 'cart')!.holdsChange).toBe(true);
    const closed = stateRows(state, { closed: new Set(['cart']) }).rows.map((r) => r.path);
    expect(closed).not.toContain('cart.items');
    // A tagged value is one leaf.
    expect(stateRows(state).rows.find((r) => r.path === 'when')).toMatchObject({ node: false });
  });

  it('narrows to matching keys and values and their parents', () => {
    const { rows, matches } = stateRows(state, { query: 'rome' });
    expect(rows.map((r) => r.path)).toEqual([
      'cart',
      'cart.items',
      'cart.items[0]',
      'cart.items[0].name',
    ]);
    expect(matches).toBe(1);
    expect(stateRows(state, { query: 'nothing here' }).rows).toEqual([]);
  });
});

describe('StoreStateTree', () => {
  it('opens a node, searches and emits the path to copy', async () => {
    const fixture = TestBed.createComponent(StoreStateTree);
    fixture.componentRef.setInput('value', state);
    const copied: string[] = [];
    fixture.componentInstance.copied.subscribe((path) => copied.push(path));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('.toggle')).find((b) =>
      b.textContent?.includes('items'),
    )!;
    expect(items.getAttribute('aria-expanded')).toBe('false');
    items.click();
    await fixture.whenStable();
    expect(items.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[aria-label="Copy path cart.items[0]"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[aria-label="Copy path cart.total"]')!.click();
    expect(copied).toEqual(['cart.total']);
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'ada';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('2 matches');
  });
});
