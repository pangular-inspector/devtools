import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import { reduxLog, reduxPagesOf, type ReduxStoresPage } from '../pages/redux-stores';
import type { NgrxPage } from '../pages/store-types';

function client(states: Record<string, unknown>): DevframeRpcClient {
  const rpc = {
    call: (name: string) => Promise.resolve(name === 'get-ngrx-store' ? [] : { ok: true }),
    callEvent: () => Promise.resolve(),
    sharedState: (key: string) =>
      key in states
        ? Promise.resolve({ value: () => states[key], on: () => () => {} })
        : Promise.reject(new Error('unknown state')),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

const ngxs: ReduxStoresPage = {
  pageId: 'p1',
  url: '/trips',
  title: 'Trips',
  stores: [
    { id: 'r1', name: 'NGXS', library: 'NGXS', state: { trips: { booked: [7] } }, actions: 2 },
  ],
  log: [
    { seq: 1, storeId: 'r1', type: '@@INIT', timestamp: 0, diff: [] },
    {
      seq: 2,
      storeId: 'r1',
      type: '[Trips] Book',
      action: { type: '[Trips] Book', id: 7 },
      timestamp: 0,
      diff: [{ path: 'trips.booked[0]', op: 'add', after: 7 }],
    },
  ],
  reportedAt: 1,
};

const ngrxPage: NgrxPage = {
  pageId: 'p1',
  url: '/trips',
  title: 'Trips',
  stores: [],
  classic: { state: { cart: [] }, devtools: true, scope: 'root' },
  log: [],
  reportedAt: 1,
};

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function text(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function storeButton(fixture: ComponentFixture<unknown>, label: string) {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.store-item'),
  ).find((b) => b.textContent?.includes(label));
}

async function mount(states: Record<string, unknown>) {
  const fixture = TestBed.createComponent(StoreInspector);
  fixture.componentRef.setInput('rpc', client(states));
  await settle(fixture);
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('other stores in the store inspector', () => {
  it('lists an NGXS store next to the NgRx Store, with its state and action log', async () => {
    const fixture = await mount({
      'ngrx-store': { pages: [ngrxPage] },
      'redux-stores': { pages: { p1: ngxs } },
    });
    expect(storeButton(fixture, 'Store')).toBeDefined();
    const other = storeButton(fixture, 'NGXS')!;
    // Its log holds what the library sent, @@INIT included: actions, not changes.
    expect(other.textContent).toMatch(/Redux DevTools · NGXS · 2 actions/);
    other.click();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.detail-head h3')?.textContent).toBe('NGXS');
    expect(root.querySelector('pre.tree')?.textContent).toContain('booked');
    expect(text(fixture)).toContain('Action log');
    // No Store as global, Restore or Dispatch again for a store the panel only reads.
    expect(root.querySelector('app-store-global')).toBeNull();
    const entries = Array.from(root.querySelectorAll<HTMLButtonElement>('button.log-item'));
    expect(entries.map((b) => b.querySelector('.log-type')?.textContent)).toEqual([
      '[Trips] Book',
      '@@INIT',
    ]);
    entries[0].click();
    await settle(fixture);
    expect(text(fixture)).toContain('trips.booked[0]');
    // The entry shows its action and diff directly: the page keeps no past states to read.
    expect(root.querySelector('app-entry-tabs')).toBeNull();
    expect(root.querySelector('[role="tab"]')).toBeNull();
    expect(root.querySelector('.kv pre.code')?.textContent).toContain('[Trips] Book');
    // The Action row sits apart from Time, as the NgRx entry tabs do.
    expect(root.querySelector('dl.kv.redux-action dt')?.textContent).toBe('Action');
    expect(text(fixture)).toContain('reads but does not write to');
    expect(text(fixture)).not.toContain('Restore this state');
    expect(text(fixture)).not.toContain('Dispatch again');
    expect(root.querySelector('.dispatch-form')).toBeNull();
  });

  it('keeps Session and the Action, Diff and State tabs for NgRx stores only', async () => {
    const page: NgrxPage = {
      ...ngrxPage,
      log: [
        {
          seq: 3,
          source: 'store',
          storeId: 'store',
          type: '[Cart] Add',
          action: { type: '[Cart] Add' },
          timestamp: 0,
          diff: [{ path: 'cart[0]', op: 'add', after: 1 }],
          restorable: true,
        },
      ],
    };
    const fixture = await mount({
      'ngrx-store': { pages: [page] },
      'redux-stores': { pages: { p1: ngxs } },
    });
    const root = fixture.nativeElement as HTMLElement;
    storeButton(fixture, 'Store')!.click();
    await settle(fixture);
    expect(root.querySelector('app-store-session')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('button.log-item')!.click();
    await settle(fixture);
    expect(root.querySelector('app-entry-tabs')).not.toBeNull();
    expect(
      Array.from(root.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim()),
    ).toEqual(['Action', 'Diff', 'State']);

    storeButton(fixture, 'NGXS')!.click();
    await settle(fixture);
    expect(root.querySelector('.detail-head h3')?.textContent).toBe('NGXS');
    expect(root.querySelector('app-store-session')).toBeNull();
  });

  it('shows a page that reports only other stores', async () => {
    const fixture = await mount({
      'ngrx-store': { pages: [] },
      'redux-stores': { pages: { p1: ngxs } },
    });
    expect(storeButton(fixture, 'NGXS')).toBeDefined();
    expect(text(fixture)).not.toContain('No page is reporting');
  });

  it('keeps the NgRx view when the server has no other stores', async () => {
    const fixture = await mount({ 'ngrx-store': { pages: [ngrxPage] } });
    expect(storeButton(fixture, 'Store')).toBeDefined();
    expect(text(fixture)).not.toContain('Could not load');
  });
});

describe('redux-stores helpers', () => {
  it('ignores a state that is not the redux-stores shape', () => {
    expect(reduxPagesOf({ pages: [ngrxPage] })).toEqual([]);
    expect(reduxPagesOf(undefined)).toEqual([]);
    expect(reduxPagesOf({ pages: { p1: ngxs } })).toEqual([ngxs]);
  });

  it('maps a store log to entries that cannot be restored', () => {
    const log = reduxLog(ngxs, 'redux:r1');
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ source: 'redux', storeId: 'redux:r1', restorable: false });
    expect(reduxLog(ngxs, 'store')).toEqual([]);
  });
});
