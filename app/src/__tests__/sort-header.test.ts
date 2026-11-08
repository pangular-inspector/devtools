import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteInspector } from '../pages/route-inspector';
import type { SourceRoute } from '../pages/router-types';
import { SortHeader, nextSort, sortRows, type SortState } from '../ui/sort-header';

describe('nextSort and sortRows', () => {
  it('cycles ascending, descending and the original order', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({ column: 'name', direction: 'ascending' });
    const second = nextSort(first, 'name');
    expect(second).toEqual({ column: 'name', direction: 'descending' });
    expect(nextSort(second, 'name')).toBeNull();
    expect(nextSort(second, 'size')).toEqual({ column: 'size', direction: 'ascending' });
  });

  it('sorts numbers as numbers and text naturally, keeps ties stable and missing keys last', () => {
    const rows = [
      { id: 'a', name: 'item 10', size: 3 },
      { id: 'b', name: 'item 2', size: undefined },
      { id: 'c', name: 'Item 1', size: 3 },
      { id: 'd', name: '', size: 1 },
    ];
    const keys = {
      name: (r: (typeof rows)[number]) => r.name,
      size: (r: (typeof rows)[number]) => r.size,
    };
    const ids = (sort: SortState | null) => sortRows(rows, sort, keys).map((r) => r.id);
    expect(ids(null)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids({ column: 'name', direction: 'ascending' })).toEqual(['c', 'b', 'a', 'd']);
    expect(ids({ column: 'name', direction: 'descending' })).toEqual(['a', 'b', 'c', 'd']);
    expect(ids({ column: 'size', direction: 'ascending' })).toEqual(['d', 'a', 'c', 'b']);
    expect(ids({ column: 'size', direction: 'descending' })).toEqual(['a', 'c', 'd', 'b']);
  });
});

@Component({
  imports: [SortHeader],
  template: `
    <table>
      <thead>
        <tr>
          <th scope="col" appSortHeader="name" [(sort)]="sort">Name</th>
          <th scope="col" appSortHeader="size" [(sort)]="sort">Size</th>
        </tr>
      </thead>
    </table>
  `,
})
class Host {
  readonly sort = signal<SortState | null>(null);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SortHeader', () => {
  it('is a button inside the header, and sets aria-sort only on the sorted column', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [name, size] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('th')];
    const button = name.querySelector('button')!;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent!.trim()).toBe('Name');
    expect(name.hasAttribute('aria-sort')).toBe(false);

    button.click();
    await fixture.whenStable();
    expect(name.getAttribute('aria-sort')).toBe('ascending');
    expect(size.hasAttribute('aria-sort')).toBe(false);
    expect(fixture.componentInstance.sort()).toEqual({ column: 'name', direction: 'ascending' });

    size.querySelector('button')!.click();
    await fixture.whenStable();
    expect(name.hasAttribute('aria-sort')).toBe(false);
    expect(size.getAttribute('aria-sort')).toBe('ascending');
  });
});

describe('the source route config table', () => {
  const routes: SourceRoute[] = [
    {
      path: 'b',
      fullPath: '/b',
      kind: 'page',
      component: 'B',
      file: 'b.routes.ts',
      line: 9,
      hasChildren: false,
    },
    {
      path: 'a',
      fullPath: '/a',
      kind: 'page',
      title: 'Alpha',
      file: 'a.routes.ts',
      line: 30,
      hasChildren: false,
    },
    {
      path: 'c',
      fullPath: '/c',
      kind: 'page',
      component: 'A',
      file: 'a.routes.ts',
      line: 4,
      hasChildren: false,
    },
  ];

  async function mount() {
    const client = {
      connectionMeta: {},
      scope: () => ({
        rpc: {
          call: (name: string) =>
            name === 'get-routes' ? Promise.resolve(routes) : new Promise(() => {}),
          sharedState: () => new Promise(() => {}),
        },
      }),
    } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(RouteInspector);
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement as HTMLElement);
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    return fixture;
  }

  const table = (fixture: ComponentFixture<unknown>) =>
    (fixture.nativeElement as HTMLElement).querySelector('.config table')!;
  const paths = (fixture: ComponentFixture<unknown>) =>
    [...table(fixture).querySelectorAll('tbody td.path')].map(
      (td) => td.textContent!.trim().split(/\s/)[0],
    );
  const header = (fixture: ComponentFixture<unknown>, name: string) =>
    [...table(fixture).querySelectorAll('th')].find((th) => th.textContent!.trim() === name)!;

  it('sorts by path, target and file from the headers', async () => {
    const fixture = await mount();
    expect(paths(fixture)).toEqual(['/b', '/a', '/c']);
    expect(header(fixture, 'Guards and resolvers').querySelector('button')).toBeNull();

    header(fixture, 'Path').querySelector('button')!.click();
    await fixture.whenStable();
    expect(paths(fixture)).toEqual(['/a', '/b', '/c']);
    expect(header(fixture, 'Path').getAttribute('aria-sort')).toBe('ascending');

    header(fixture, 'Component / Target').querySelector('button')!.click();
    await fixture.whenStable();
    expect(paths(fixture)).toEqual(['/c', '/b', '/a']);

    header(fixture, 'Declared in').querySelector('button')!.click();
    await fixture.whenStable();
    expect(paths(fixture)).toEqual(['/c', '/a', '/b']);
  });
});
