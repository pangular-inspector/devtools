import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteTree } from '../pages/route-tree';
import type { RouteNode, RouterPage } from '../pages/router-types';

const client = {
  connectionMeta: {},
  scope: () => ({ rpc: { call: () => Promise.reject(new Error('offline')) } }),
} as unknown as DevframeRpcClient;

const config: RouteNode[] = [
  {
    id: 'users',
    path: 'users',
    fullPath: 'users',
    kind: 'component',
    component: 'Users',
    children: [
      {
        id: 'user',
        path: ':id',
        fullPath: 'users/:id',
        kind: 'component',
        component: 'User',
        children: [{ id: 'edit', path: 'edit', fullPath: 'users/:id/edit', kind: 'component' }],
      },
    ],
  },
  { id: 'about', path: 'about', fullPath: 'about', kind: 'component', component: 'About' },
];

function page(): RouterPage {
  return { pageId: 'p1', reportedAt: 1, snapshot: null, navigations: [], config };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function mount() {
  const fixture = TestBed.createComponent(RouteTree);
  fixture.componentRef.setInput('page', page());
  fixture.componentRef.setInput('rpc', client);
  document.body.append(fixture.nativeElement as HTMLElement);
  await settle(fixture);
  return fixture;
}

const root = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const rows = (fixture: ComponentFixture<unknown>) => [
  ...root(fixture).querySelectorAll<HTMLTableRowElement>('tr.tree-row'),
];
const ids = (fixture: ComponentFixture<unknown>) => rows(fixture).map((row) => row.dataset['id']);
const focusedId = () => (document.activeElement as HTMLElement | null)?.dataset['id'];

async function press(fixture: ComponentFixture<unknown>, key: string) {
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
  await settle(fixture);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTree as a treegrid', () => {
  it('names the levels, the expanded state and one tab stop', async () => {
    const fixture = await mount();
    const grid = root(fixture).querySelector('table')!;
    expect(grid.getAttribute('role')).toBe('treegrid');
    expect(grid.getAttribute('aria-label')).toBe('Routes');
    expect(rows(fixture).map((row) => row.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '3',
      '1',
    ]);
    expect(rows(fixture).map((row) => row.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
      null,
      null,
    ]);
    expect(rows(fixture).map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(rows(fixture)[0].querySelector('td')!.getAttribute('role')).toBe('gridcell');
    expect(root(fixture).querySelector('th')!.getAttribute('role')).toBe('columnheader');
  });

  it('moves with the arrow keys, Home and End, and keeps the tab stop on the focused row', async () => {
    const fixture = await mount();
    rows(fixture)[0].focus();
    await press(fixture, 'ArrowDown');
    expect(focusedId()).toBe('user');
    await press(fixture, 'End');
    expect(focusedId()).toBe('about');
    await press(fixture, 'Home');
    expect(focusedId()).toBe('users');
    await press(fixture, 'ArrowUp');
    expect(focusedId()).toBe('users');
    await press(fixture, 'ArrowDown');
    expect(rows(fixture).map((row) => row.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it('collapses with Left, walks to the parent, and expands with Right', async () => {
    const fixture = await mount();
    rows(fixture)[1].focus();
    await press(fixture, 'ArrowLeft');
    expect(ids(fixture)).toEqual(['users', 'user', 'about']);
    expect(rows(fixture)[1].getAttribute('aria-expanded')).toBe('false');
    expect(focusedId()).toBe('user');

    await press(fixture, 'ArrowLeft');
    expect(focusedId()).toBe('users');
    await press(fixture, 'ArrowLeft');
    expect(ids(fixture)).toEqual(['users', 'about']);
    expect(rows(fixture)[0].getAttribute('aria-expanded')).toBe('false');

    await press(fixture, 'ArrowRight');
    expect(ids(fixture)).toEqual(['users', 'user', 'about']);
    expect(focusedId()).toBe('users');
    await press(fixture, 'ArrowRight');
    expect(focusedId()).toBe('user');
    await press(fixture, 'ArrowRight');
    expect(ids(fixture)).toEqual(['users', 'user', 'edit', 'about']);
  });

  it('toggles a branch from its arrow and keeps the route count', async () => {
    const fixture = await mount();
    rows(fixture)[0].querySelector<HTMLElement>('.twisty')!.click();
    await settle(fixture);
    expect(ids(fixture)).toEqual(['users', 'about']);
    expect(root(fixture).querySelector('.summary')!.textContent).toContain('4 routes.');
  });

  it('flattens the tree while a filter is on', async () => {
    const fixture = await mount();
    rows(fixture)[0].querySelector<HTMLElement>('.twisty')!.click();
    await settle(fixture);
    const input = root(fixture).querySelector<HTMLInputElement>('.filter input')!;
    input.value = 'edit';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(ids(fixture)).toEqual(['edit']);
    expect(rows(fixture)[0].getAttribute('aria-expanded')).toBeNull();
    expect(rows(fixture)[0].getAttribute('aria-level')).toBe('3');
  });

  it('leaves keys typed into a row field alone', async () => {
    const fixture = await mount();
    const row = rows(fixture)[0];
    const button = row.querySelector('button')!;
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(fixture);
    expect(document.activeElement).toBe(button);
  });
});
