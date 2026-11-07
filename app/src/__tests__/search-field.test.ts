import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SAVED_FILTERS,
  SearchField,
  readSavedFilters,
  writeSavedFilters,
} from '../ui/search-field';

@Component({
  imports: [SearchField],
  template: `
    <div (keydown.escape)="escaped.set(escaped() + 1)">
      <app-search-field placeholder="Filter by name" [saveKey]="saveKey()" [(value)]="query" />
    </div>
  `,
})
class Host {
  readonly query = signal('');
  readonly saveKey = signal<string | null>('demo');
  readonly escaped = signal(0);
}

async function setup(saveKey: string | null = 'demo') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.saveKey.set(saveKey);
  document.body.append(fixture.nativeElement);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const input = () => root.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const button = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
    );
  const click = async (name: string) => {
    const target = button(name);
    if (!target) throw new Error(`No button ${name}`);
    target.click();
    await fixture.whenStable();
  };
  const chips = () =>
    [...root.querySelectorAll<HTMLButtonElement>('.chips .apply')].map((b) =>
      b.textContent!.trim(),
    );
  const status = () => root.querySelector('app-search-field [role="status"]')?.textContent?.trim();
  return { fixture, root, input, type, button, click, chips, status };
}

describe('SearchField', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('is a search input named Filter with an icon, no autocomplete and no spellcheck', async () => {
    const { root, input } = await setup();
    expect(input().getAttribute('aria-label')).toBe('Filter');
    expect(input().placeholder).toBe('Filter by name');
    expect(input().getAttribute('autocomplete')).toBe('off');
    expect(input().getAttribute('spellcheck')).toBe('false');
    expect(root.querySelector('svg.icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('binds the value both ways', async () => {
    const { fixture, input, type } = await setup();
    await type('user');
    expect(fixture.componentInstance.query()).toBe('user');
    fixture.componentInstance.query.set('cart');
    await fixture.whenStable();
    expect(input().value).toBe('cart');
  });

  it('clears on Escape and keeps that Escape to itself, but lets an Escape on an empty field through', async () => {
    const { fixture, input, type } = await setup();
    await type('user');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.query()).toBe('');
    expect(fixture.componentInstance.escaped()).toBe(0);
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.escaped()).toBe(1);
  });

  it('saves the current text as a chip for its view and moves focus to it', async () => {
    const { type, click, chips, button, status, root } = await setup();
    expect(button('Save filter user')).toBeUndefined();
    await type('  user ');
    await click('Save filter user');
    expect(chips()).toEqual(['user']);
    expect(readSavedFilters('demo')).toEqual(['user']);
    expect(status()).toBe('Filter user saved.');
    // Already saved, so there is nothing to save.
    expect(button('Save filter user')).toBeUndefined();
    expect(document.activeElement).toBe(root.querySelector('.chips .apply'));
    expect(root.querySelector('.chips')?.getAttribute('aria-label')).toBe('Saved filters');
  });

  it('applies a chip, shows it pressed, and clears it on a second click', async () => {
    writeSavedFilters('demo', ['user', 'cart']);
    const { fixture, click, root } = await setup();
    await click('cart');
    expect(fixture.componentInstance.query()).toBe('cart');
    const pressed = [...root.querySelectorAll('.chips .apply')].map((b) =>
      b.getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'true']);
    await click('cart');
    expect(fixture.componentInstance.query()).toBe('');
  });

  it('removes a chip, forgets it and keeps focus in the list', async () => {
    writeSavedFilters('demo', ['user', 'cart', 'admin']);
    const { click, chips, status, root, input } = await setup();
    await click('Remove saved filter cart');
    expect(chips()).toEqual(['user', 'admin']);
    expect(readSavedFilters('demo')).toEqual(['user', 'admin']);
    expect(status()).toBe('Saved filter cart removed.');
    expect(document.activeElement?.textContent?.trim()).toBe('admin');
    await click('Remove saved filter user');
    await click('Remove saved filter admin');
    expect(root.querySelector('.chips')).toBeNull();
    expect(document.activeElement).toBe(input());
    expect(localStorage.getItem('pangular-pref:filters:demo')).toBeNull();
  });

  it('keeps the chips of each view apart and reads them again when the view changes', async () => {
    writeSavedFilters('demo', ['user']);
    writeSavedFilters('other', ['cart']);
    const { fixture, chips } = await setup();
    expect(chips()).toEqual(['user']);
    fixture.componentInstance.saveKey.set('other');
    await fixture.whenStable();
    expect(chips()).toEqual(['cart']);
  });

  it('offers no chips without a view', async () => {
    writeSavedFilters('demo', ['user']);
    const { type, button, chips, root } = await setup(null);
    await type('user');
    expect(button('Save filter user')).toBeUndefined();
    expect(chips()).toEqual([]);
    expect(root.querySelector('app-search-field [role="status"]')).toBeNull();
  });

  it(`stops offering Save at ${MAX_SAVED_FILTERS} chips`, async () => {
    writeSavedFilters(
      'demo',
      Array.from({ length: MAX_SAVED_FILTERS }, (_, i) => `f${i}`),
    );
    const { type, button } = await setup();
    await type('one more');
    expect(button('Save filter one more')).toBeUndefined();
  });

  it('ignores bad storage and survives blocked storage', async () => {
    localStorage.setItem('pangular-pref:filters:demo', '{"not":"a list"}');
    expect(readSavedFilters('demo')).toEqual([]);
    localStorage.setItem('pangular-pref:filters:demo', JSON.stringify(['ok', 3, '', 'ok']));
    expect(readSavedFilters('demo')).toEqual(['ok']);
    localStorage.setItem('pangular-pref:filters:demo', 'not json');
    expect(readSavedFilters('demo')).toEqual([]);

    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const { type, click, chips } = await setup();
      await type('user');
      await click('Save filter user');
      // Kept for this session even though it could not be stored.
      expect(chips()).toEqual(['user']);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

describe('every page uses the shared search field', () => {
  const pages = join(import.meta.dirname, '../pages');
  const files = readdirSync(pages).filter((file) => file.endsWith('.ts'));

  it('has no hand-written search input left in a page', () => {
    const raw = files.filter((file) =>
      /type="search"/.test(readFileSync(join(pages, file), 'utf8')),
    );
    expect(raw).toEqual([]);
  });

  it('names no field anything other than Filter, except a second field on the same page', () => {
    const labels = files.flatMap((file) =>
      [
        ...readFileSync(join(pages, file), 'utf8').matchAll(
          /<app-search-field[^>]*?\blabel="([^"]+)"/gs,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );
    // The values filter sits under the component filter in the Components detail panel.
    expect(labels).toEqual(['component-tree.ts: Filter values']);
  });

  it('uses Filter, not Find, in every placeholder', () => {
    const placeholders = files.flatMap((file) =>
      [
        ...readFileSync(join(pages, file), 'utf8').matchAll(
          /<app-search-field[^>]*?\bplaceholder="([^"]+)"/gs,
        ),
      ].map((match) => match[1]),
    );
    expect(placeholders.length).toBeGreaterThan(15);
    for (const placeholder of placeholders) {
      expect(placeholder).toMatch(/^Filter\b/);
      expect(placeholder).not.toMatch(/…$/);
    }
  });
});
