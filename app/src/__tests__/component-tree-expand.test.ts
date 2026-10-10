import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

function node(id: string, name: string, children: unknown[] = []) {
  return { id, name, tag: `app-${name.toLowerCase()}`, children };
}

// App
//   Header
//     Nav
//   Main
//     List
//       Item
//   Footer
const roots = [
  node('app', 'App', [
    node('header', 'Header', [node('nav', 'Nav')]),
    node('main', 'Main', [node('list', 'List', [node('item', 'Item')])]),
    node('footer', 'Footer'),
  ]),
];

function client(): DevframeRpcClient {
  const state: Record<string, unknown> = {
    'component-tree': {
      pages: {
        a: { pageId: 'a', title: 'a', url: '/', roots, count: 7, detail: null, reportedAt: 1 },
      },
    },
  };
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function setup() {
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', client());
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const host = (fixture: ComponentFixture<ComponentTree>) => fixture.nativeElement as HTMLElement;

function visible(fixture: ComponentFixture<ComponentTree>) {
  return Array.from(host(fixture).querySelectorAll<HTMLElement>('.row')).map(
    (row) => row.dataset['id'],
  );
}

function button(fixture: ComponentFixture<ComponentTree>, label: string) {
  const found = Array.from(host(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`No ${label} button`);
  return found;
}

function tabbable(fixture: ComponentFixture<ComponentTree>) {
  return Array.from(host(fixture).querySelectorAll<HTMLElement>('.row[tabindex="0"]')).map(
    (row) => row.dataset['id'],
  );
}

function status(fixture: ComponentFixture<ComponentTree>) {
  return host(fixture).querySelector('p.sr-only[role="status"]')?.textContent?.trim();
}

async function key(fixture: ComponentFixture<ComponentTree>, id: string, k: string) {
  const row = host(fixture).querySelector<HTMLElement>(`.row[data-id="${id}"]`)!;
  row.focus();
  row.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  await settle(fixture);
}

describe('ComponentTree expand and collapse all', () => {
  beforeEach(() => {
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('collapses to the top level and expands every row again', async () => {
    const fixture = await setup();
    expect(visible(fixture)).toEqual(['app', 'header', 'nav', 'main', 'list', 'item', 'footer']);

    button(fixture, 'Collapse all').click();
    await settle(fixture);
    expect(visible(fixture)).toEqual(['app']);
    expect(status(fixture)).toContain('Collapsed every component');
    expect(host(fixture).querySelector('.row[data-id="app"]')?.getAttribute('aria-expanded')).toBe(
      'false',
    );

    button(fixture, 'Expand all').click();
    await settle(fixture);
    expect(visible(fixture)).toEqual(['app', 'header', 'nav', 'main', 'list', 'item', 'footer']);
    expect(status(fixture)).toContain('Expanded every component');
  });

  it('keeps the tabbable row visible by moving it to the nearest visible ancestor', async () => {
    const fixture = await setup();
    await key(fixture, 'list', 'ArrowDown');
    expect(tabbable(fixture)).toEqual(['item']);
    expect(document.activeElement?.getAttribute('data-id')).toBe('item');

    button(fixture, 'Collapse all').click();
    await settle(fixture);
    expect(visible(fixture)).not.toContain('item');
    expect(tabbable(fixture)).toEqual(['app']);
    expect(fixture.componentInstance.focusId()).toBe('app');

    button(fixture, 'Expand all').click();
    await settle(fixture);
    expect(tabbable(fixture)).toEqual(['app']);
  });

  it('expands every sibling of the focused row with the * key', async () => {
    const fixture = await setup();
    fixture.componentInstance.collapsed.set(new Set(['header', 'main', 'list']));
    await settle(fixture);
    expect(visible(fixture)).toEqual(['app', 'header', 'main', 'footer']);

    await key(fixture, 'header', '*');
    expect(visible(fixture)).toEqual(['app', 'header', 'nav', 'main', 'list', 'footer']);
    expect(tabbable(fixture)).toEqual(['header']);
    expect(document.activeElement?.getAttribute('data-id')).toBe('header');

    // Only siblings open, not their descendants.
    expect(fixture.componentInstance.collapsed().has('list')).toBe(true);
  });

  it('turns the buttons off while a text filter is active', async () => {
    const fixture = await setup();
    expect(button(fixture, 'Expand all').disabled).toBe(false);
    expect(button(fixture, 'Collapse all').disabled).toBe(false);

    fixture.componentInstance.setFilter('item');
    await settle(fixture);
    expect(button(fixture, 'Expand all').disabled).toBe(true);
    expect(button(fixture, 'Collapse all').disabled).toBe(true);

    fixture.componentInstance.collapseAll();
    fixture.componentInstance.setFilter('');
    await settle(fixture);
    expect(button(fixture, 'Collapse all').disabled).toBe(false);
    expect(visible(fixture)).toEqual(['app', 'header', 'nav', 'main', 'list', 'item', 'footer']);
  });
});
