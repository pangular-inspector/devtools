import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonDiff, MAX_DIFF_ENTRIES } from '../pages/json-diff';
import { SignalInspector } from '../pages/signal-inspector';

const at = (s: number) => new Date(2026, 0, 1, 10, 0, s).getTime();

const componentGraph = {
  pageId: 'p1',
  nodes: [
    { id: '1', kind: 'signal', label: 'cart', epoch: 2, value: { items: ['a', 'b'], total: 2 } },
    { id: '2', kind: 'computed', label: 'total', epoch: 2, value: 2 },
    { id: '3', kind: 'effect', label: 'persist', epoch: 1, runs: 4, runMs: 2.5, lastRunMs: 0.5 },
  ],
  edges: [],
  component: { id: 'c1', name: 'Cart', tag: 'app-cart', path: 'app-cart' },
  history: {
    '1': [
      { epoch: 0, value: { items: ['a'], total: 1, coupon: 'X' }, at: at(1), source: 'initial' },
      { epoch: 2, value: { items: ['a', 'b'], total: 2 }, at: at(2), source: 'write' },
    ],
  },
};

const serviceGraph = {
  pageId: 'p1',
  nodes: [
    {
      id: '11',
      kind: 'signal',
      label: 'trips',
      epoch: 2,
      value: 2,
      locator: { id: 'inj-2', key: 'trips', owner: 'service', service: 'TripStore' },
    },
  ],
  edges: [],
  injector: { id: 'inj-2', name: 'Root' },
  history: {
    '11': [
      { epoch: 0, value: 1, at: at(1), source: 'initial' },
      { epoch: 2, value: 2, at: at(2), source: 'write' },
    ],
  },
};

const source = [
  { name: 'cart', kind: 'signal', file: 'src/cart.ts', line: 4, component: 'app-cart' },
  { name: 'cart', kind: 'signal', file: 'src/other.ts', line: 9, component: 'app-other' },
  { name: 'total', kind: 'computed', file: 'src/a.ts', line: 1, component: 'app-a' },
  { name: 'total', kind: 'computed', file: 'src/b.ts', line: 2, component: 'app-b' },
];

async function render(
  graph: unknown,
  call: (name: string, args?: unknown) => Promise<unknown> = async (name) =>
    name === 'get-signals' ? source : [],
) {
  const state = (value: unknown) => Promise.resolve({ value: () => value, on: () => () => {} });
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      state(
        name === 'signal-graph'
          ? { graph, pages: { p1: graph } }
          : name === 'component-tree'
            ? { pages: { p1: { pageId: 'p1', roots: [] } } }
            : { pages: {} },
      ),
  };
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', {
    connectionMeta: {},
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient);
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

async function select(fixture: ComponentFixture<SignalInspector>, id: string) {
  fixture.componentInstance.selectedId.set(id);
  await fixture.whenStable();
  fixture.detectChanges();
}

const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

describe('jsonDiff', () => {
  it('lists added, removed and changed paths', () => {
    expect(
      jsonDiff(
        { a: 1, list: [1, 2], gone: true, deep: { x: 1 } },
        { a: 2, list: [1], deep: { x: 1 }, 'new key': 0 },
      ),
    ).toEqual([
      { path: 'a', kind: 'changed', before: 1, after: 2 },
      { path: 'list[1]', kind: 'removed', before: 2 },
      { path: 'gone', kind: 'removed', before: true },
      { path: '["new key"]', kind: 'added', after: 0 },
    ]);
  });

  it('caps the list and counts the rest', () => {
    const before = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    const after = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i + 1]));
    const diff = jsonDiff(before, after);
    expect(diff).toHaveLength(MAX_DIFF_ENTRIES + 1);
    expect(diff.at(-1)).toEqual({ path: '…', kind: 'changed', after: '30 more changes' });
  });
});

describe('Signals: source links, history diffs, effect runs and service restore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('links a live node to the one declaration in the shown component', async () => {
    const fixture = await render(componentGraph);
    await select(fixture, '1');
    const links = el(fixture).querySelectorAll('.source-matches app-source-link');
    expect(links).toHaveLength(1);
    expect(el(fixture).querySelector('.source-matches')?.textContent).toContain('src/cart.ts');
  });

  it('lists the candidates when the name matches several declarations', async () => {
    const fixture = await render(componentGraph);
    await select(fixture, '2');
    const text = el(fixture).querySelector('.source-matches')?.textContent ?? '';
    expect(text).toContain('2 declarations match this name');
    expect(text).toContain('src/a.ts');
    expect(text).toContain('src/b.ts');
  });

  it('shows what changed between consecutive history entries', async () => {
    const fixture = await render(componentGraph);
    await select(fixture, '1');
    const diff = el(fixture).querySelector('details.diff')!;
    expect(diff.querySelector('summary')?.textContent).toContain(
      'Changes from the entry before (3)',
    );
    const rows = [...diff.querySelectorAll('li')].map((li) => [
      li.querySelector('.diff-kind')?.textContent?.trim(),
      li.querySelector('.diff-path')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['added', 'items[1]'],
      ['changed', 'total'],
      ['removed', 'coupon'],
    ]);
  });

  it('shows effect run counts where the page reports them', async () => {
    const fixture = await render(componentGraph);
    await select(fixture, '3');
    expect(
      el(fixture).querySelector('.detail-panel dl')?.textContent?.replace(/\s+/g, ' '),
    ).toContain('Runs 4, 2.5 ms in all, last 0.5 ms');
  });

  it('restores a service signal through its injector', async () => {
    const call = vi.fn(async (name: string) =>
      name === 'request-signal-restore' ? { ok: true, key: 'trips' } : [],
    );
    const fixture = await render(serviceGraph, call);
    await select(fixture, '11');
    const button = el(fixture).querySelector<HTMLButtonElement>('button.restore')!;
    button.click();
    await fixture.whenStable();
    expect(call).toHaveBeenCalledWith('request-signal-restore', {
      pageId: 'p1',
      request: { component: 'inj-2', owner: 'service', node: '11', epoch: 0 },
    });
  });
});
