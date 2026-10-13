import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryInspector } from '../pages/query-inspector';
import {
  ageText,
  durationText,
  matchesQueryFilter,
  queryPagesOf,
  type QueryInfo,
  type QueryPage,
} from '../pages/query-types';

type Call = (name: string, arg?: Record<string, unknown>) => Promise<unknown>;

function client(state: unknown, call: Call, actions = true): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => state, on: () => () => {} }),
  };
  const connectionMeta = actions
    ? {}
    : { configs: { pangular: { actions: { tanstackQuery: false } } } };
  return { connectionMeta, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function query(id: string, extra: Partial<QueryInfo> = {}): QueryInfo {
  return {
    id,
    clientId: 'c1',
    key: ['trips'],
    keyText: '["trips"]',
    status: 'success',
    fetchStatus: 'idle',
    stale: false,
    invalidated: false,
    observers: 1,
    active: true,
    disabled: false,
    dataUpdatedAt: Date.now() - 12_000,
    errorUpdatedAt: 0,
    dataUpdateCount: 2,
    failureCount: 0,
    staleTime: 60_000,
    gcTime: 300_000,
    hasData: true,
    preview: [{ id: 7 }],
    ...extra,
  };
}

const page: QueryPage = {
  pageId: 'p1',
  url: '/trips',
  title: 'Trips',
  at: Date.now(),
  reportedAt: Date.now(),
  clients: [{ id: 'c1', scope: 'root', queries: 2, mutations: 1 }],
  queries: [
    query('q1'),
    query('q2', {
      key: ['profile'],
      keyText: '["profile"]',
      status: 'error',
      error: 'Error: 500',
      observers: 0,
      stale: true,
      hasData: false,
      preview: undefined,
    }),
  ],
  mutations: [
    {
      id: 'm1',
      clientId: 'c1',
      keyText: '["book"]',
      status: 'success',
      isPaused: false,
      submittedAt: Date.now() - 2000,
      failureCount: 0,
      variables: { id: 7 },
    },
  ],
};

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function root(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<unknown>, name: string) {
  return Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    (b.textContent ?? '').trim().startsWith(name),
  );
}

async function mount(
  state: unknown,
  call: Call = () => Promise.resolve({ ok: true }),
  actions = true,
) {
  const calls: { name: string; arg?: Record<string, unknown> }[] = [];
  const fixture = TestBed.createComponent(QueryInspector);
  fixture.componentRef.setInput(
    'rpc',
    client(
      state,
      (name, arg) => {
        calls.push({ name, arg });
        return call(name, arg);
      },
      actions,
    ),
  );
  await settle(fixture);
  return { fixture, calls };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('QueryInspector', () => {
  it('says how to get data when no page reports a QueryClient', async () => {
    const { fixture } = await mount({ pages: {} });
    expect(root(fixture).textContent).toContain('No page reports a QueryClient yet.');
    expect(root(fixture).textContent).toContain('Open the app with the overlay loaded');
  });

  it('says the connected page has no QueryClient, and how to add one', async () => {
    const rpc = {
      call: () => Promise.resolve({ ok: true }),
      callEvent: () => Promise.resolve(),
      sharedState: (name: string) =>
        Promise.resolve({
          value: () =>
            name === 'page-angular'
              ? { pages: { p1: { pageId: 'p1', reportedAt: 1, version: '22.0.0' } } }
              : { pages: {} },
          on: () => () => {},
        }),
    };
    const fixture = TestBed.createComponent(QueryInspector);
    fixture.componentRef.setInput('rpc', {
      connectionMeta: {},
      scope: () => ({ rpc }),
    } as unknown as DevframeRpcClient);
    await settle(fixture);
    const text = root(fixture).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('The connected page has no QueryClient.');
    expect(text).toContain('provideTanStackQuery(new QueryClient())');
    expect(text).not.toContain('Open the app with the overlay loaded');
  });

  it('lists queries with status and freshness, and filters them', async () => {
    const { fixture } = await mount({ pages: { p1: page } });
    const rows = Array.from(root(fixture).querySelectorAll('button.row'));
    expect(rows.map((r) => r.querySelector('.key')?.textContent)).toEqual([
      '["trips"]',
      '["profile"]',
    ]);
    expect(rows[0].textContent).toMatch(/fresh · 1 observer · 1\d s ago/);
    expect(root(fixture).querySelector('.count')?.textContent).toBe('2 of 2 queries');

    const search = root(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(root(fixture).textContent).toContain('Nothing matches the filters.');
    button(fixture, 'Clear filters')!.click();
    await settle(fixture);
    expect(root(fixture).querySelectorAll('button.row')).toHaveLength(2);
  });

  it('shows a query, loads all its data on request and invalidates it', async () => {
    const { fixture, calls } = await mount({ pages: { p1: page } }, (name, arg) => {
      const request = arg?.['request'] as { type: string; id: string };
      if (request.type === 'detail') {
        return Promise.resolve({
          ok: true,
          detail: { id: request.id, kind: 'query', data: { all: true } },
        });
      }
      return Promise.resolve({ ok: true, message: 'Invalidated ["trips"].' });
    });
    (root(fixture).querySelector('button.row') as HTMLButtonElement).click();
    await settle(fixture);
    const detail = root(fixture).querySelector('.detail')!;
    expect(detail.querySelector('h2')?.textContent?.trim()).toBe('["trips"]');
    expect(detail.textContent).toContain('1 min');
    expect(detail.querySelector('pre')?.textContent).toContain('id: 7');

    button(fixture, 'Show all data')!.click();
    await settle(fixture);
    expect(calls.at(-1)).toEqual({
      name: 'request-tanstack-query',
      arg: { pageId: 'p1', request: { type: 'detail', id: 'q1' } },
    });
    expect(detail.textContent).toContain('all: true');

    button(fixture, 'Invalidate')!.click();
    await settle(fixture);
    expect(calls.at(-1)?.arg).toEqual({ pageId: 'p1', request: { type: 'invalidate', id: 'q1' } });
    expect(detail.querySelector('.message')?.textContent).toBe('Invalidated ["trips"].');
  });

  it('disables the actions when actions.tanstackQuery is off and says why', async () => {
    const { fixture } = await mount({ pages: { p1: page } }, undefined, false);
    (root(fixture).querySelector('button.row') as HTMLButtonElement).click();
    await settle(fixture);
    const invalidate = button(fixture, 'Invalidate')!;
    expect(invalidate.disabled).toBe(true);
    expect(invalidate.getAttribute('aria-describedby')).toBe('query-writes-off');
    expect(root(fixture).querySelector('#query-writes-off')?.textContent).toMatch(
      /actions\.tanstackQuery/,
    );
  });

  it('switches to mutations', async () => {
    const { fixture } = await mount({ pages: { p1: page } });
    button(fixture, 'Mutations')!.click();
    await settle(fixture);
    const rows = root(fixture).querySelectorAll('button.row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toMatch(/\["book"\]\s*success/);
    (rows[0] as HTMLButtonElement).click();
    await settle(fixture);
    expect(root(fixture).querySelector('.detail')?.textContent).toContain('Submitted');
  });
});

describe('query-types', () => {
  it('reads only the tanstack-query shape', () => {
    expect(queryPagesOf({ pages: [page] })).toEqual([]);
    expect(queryPagesOf({ pages: { p1: page } })).toEqual([page]);
  });

  it('formats ages and durations', () => {
    expect(ageText(12_000, 1)).toBe('12 s ago');
    expect(ageText(0, 0)).toBe('never');
    expect(durationText(null)).toBe('Infinity');
    expect(durationText(60_000)).toBe('1 min');
    expect(durationText(undefined)).toBe('not set');
  });

  it('filters by status, fetching, staleness and observers', () => {
    expect(matchesQueryFilter(query('q1'), 'success')).toBe(true);
    expect(matchesQueryFilter(query('q1', { stale: true }), 'stale')).toBe(true);
    expect(matchesQueryFilter(query('q1', { observers: 0 }), 'inactive')).toBe(true);
    expect(matchesQueryFilter(query('q1', { fetchStatus: 'fetching' }), 'fetching')).toBe(true);
    expect(matchesQueryFilter(query('q1'), 'error')).toBe(false);
  });
});
