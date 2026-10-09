import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import type {
  NgrxLogEntry,
  NgrxPage,
  NgrxSignalStoreInfo,
  NgrxStoreEntry,
} from '../pages/store-types';

type Call = (name: string, arg?: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call, page: NgrxPage): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => ({ pages: [page] }), on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function entry(seq: number, extra: Partial<NgrxLogEntry> = {}): NgrxLogEntry {
  return {
    seq,
    source: 'store',
    storeId: 'store',
    type: '[Cart] Add Item',
    action: { type: '[Cart] Add Item', id: seq },
    origin: 'dispatch',
    timestamp: 0,
    diff: [],
    restorable: true,
    ...extra,
  };
}

function pageWith(log: NgrxLogEntry[]): NgrxPage {
  return {
    pageId: 'p1',
    url: '/',
    title: 'App',
    stores: [],
    classic: { state: { items: [] }, devtools: true, scope: 'root' },
    log,
    reportedAt: 0,
  };
}

const source: NgrxStoreEntry[] = [
  {
    name: 'CartActions',
    kind: 'action',
    file: 'src/cart.actions.ts',
    line: 3,
    types: ['[Cart] Remove Item', '[Cart] Add Item'],
  },
];

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function root(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement | undefined {
  return Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => (b.textContent ?? '').trim() === name,
  );
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

async function mount(log: NgrxLogEntry[], answer: Call = () => Promise.resolve({ ok: true })) {
  const calls: { name: string; arg?: Record<string, unknown> }[] = [];
  const fixture = TestBed.createComponent(StoreInspector);
  fixture.componentRef.setInput(
    'rpc',
    fakeClient((name, arg) => {
      if (name === 'get-ngrx-store') return Promise.resolve(source);
      calls.push({ name, arg });
      return answer(name, arg);
    }, pageWith(log)),
  );
  await settle(fixture);
  return { fixture, calls };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('StoreInspector dispatch', () => {
  it('suggests action types from source and the log, and dispatches the typed action', async () => {
    const { fixture, calls } = await mount([entry(1)], () =>
      Promise.resolve({
        ok: true,
        message: 'Dispatched [Cart] Remove Item as #2.',
        entry: entry(2, { type: '[Cart] Remove Item' }),
      }),
    );
    const options = Array.from(root(fixture).querySelectorAll('#ngrx-action-types option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toEqual(['[Cart] Add Item', '[Cart] Remove Item']);

    const dispatch = button(fixture, 'Dispatch')!;
    expect(dispatch.disabled).toBe(true);
    type(
      root(fixture).querySelector<HTMLInputElement>('.dispatch-form input')!,
      '[Cart] Remove Item',
    );
    const payload = root(fixture).querySelector<HTMLTextAreaElement>('.dispatch-form textarea')!;
    type(payload, '[1]');
    await settle(fixture);
    expect(root(fixture).querySelector('#ngrx-payload-error')?.textContent).toContain(
      'JSON object',
    );
    expect(payload.getAttribute('aria-invalid')).toBe('true');
    expect(dispatch.disabled).toBe(true);

    type(payload, '{"id": 7}');
    await settle(fixture);
    expect(dispatch.disabled).toBe(false);
    dispatch.click();
    await settle(fixture);
    expect(calls).toEqual([
      {
        name: 'request-ngrx-action',
        arg: {
          pageId: 'p1',
          request: { type: 'dispatch', action: '[Cart] Remove Item', payload: { id: 7 } },
        },
      },
    ]);
    expect(root(fixture).querySelector('.message')?.textContent).toContain('as #2');
  });

  it('dispatches a logged action again', async () => {
    const { fixture, calls } = await mount([entry(1)]);
    (
      Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('.log-item')).find((b) =>
        b.textContent?.includes('#1'),
      ) as HTMLButtonElement
    ).click();
    await settle(fixture);
    button(fixture, 'Dispatch again')!.click();
    await settle(fixture);
    expect(calls.at(-1)).toEqual({
      name: 'request-ngrx-action',
      arg: { pageId: 'p1', request: { type: 'dispatch-again', seq: 1 } },
    });
  });
});

describe('StoreInspector restore', () => {
  async function select(log: NgrxLogEntry[], seq: number) {
    const { fixture } = await mount(log);
    Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('.log-item'))
      .find((b) => b.textContent?.includes(`#${seq}`))!
      .click();
    await settle(fixture);
    return fixture;
  }

  it('offers Restore only for an entry Store DevTools still holds', async () => {
    const fixture = await select([entry(1)], 1);
    expect(button(fixture, 'Restore this state')).toBeDefined();
  });

  it('explains an entry Store DevTools no longer holds', async () => {
    const fixture = await select([entry(1, { restorable: false, unrestorable: 'dropped' })], 1);
    expect(button(fixture, 'Restore this state')).toBeUndefined();
    expect(root(fixture).textContent).toMatch(/no longer holds this action/);
    expect(root(fixture).textContent).toMatch(/dropped past\s+maxAge/);
    expect(root(fixture).textContent).toMatch(/committed, reset or imported/);
    expect(button(fixture, 'Dispatch again')).toBeDefined();
  });

  it('explains an entry Store DevTools never recorded', async () => {
    const fixture = await select(
      [entry(1, { restorable: false, unrestorable: 'not-recorded' })],
      1,
    );
    expect(button(fixture, 'Restore this state')).toBeUndefined();
    expect(root(fixture).textContent).toMatch(/never recorded this action/);
    expect(root(fixture).textContent).toContain('actionsBlocklist');
  });
});

describe('StoreInspector signal store', () => {
  function signalStore(overrides: Partial<NgrxSignalStoreInfo> = {}): NgrxSignalStoreInfo {
    return {
      id: 'ngrx-1',
      kind: 'signal-store',
      className: 'ProductStore',
      scope: 'root',
      stateKeys: ['count'],
      state: { count: 0 },
      computed: {},
      methods: [],
      references: [],
      writable: true,
      ...overrides,
    };
  }

  function signalPage(stores: NgrxSignalStoreInfo[], log: NgrxLogEntry[] = []): NgrxPage {
    return { pageId: 'p1', url: '/', title: 'App', stores, classic: null, log, reportedAt: 0 };
  }

  async function mountSignal(stores: NgrxSignalStoreInfo[], log: NgrxLogEntry[] = []) {
    const fixture = TestBed.createComponent(StoreInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(
        (name) => (name === 'get-ngrx-store' ? Promise.resolve([]) : Promise.resolve({})),
        signalPage(stores, log),
      ),
    );
    await settle(fixture);
    return fixture;
  }

  it('shows entity count and ids for a withEntities() store', async () => {
    const fixture = await mountSignal([
      signalStore({
        stateKeys: ['entityMap', 'ids'],
        state: { entityMap: {}, ids: [] },
        entities: [{ idsKey: 'ids', entityMapKey: 'entityMap', ids: ['a', 'b', 'c'], count: 3 }],
      }),
    ]);
    const host = root(fixture);
    expect(host.textContent).toMatch(/3\s+entities/);
    expect(host.querySelector('.entity-ids')).not.toBeNull();
    const chips = Array.from(host.querySelectorAll<HTMLElement>('.entity-ids .chip'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['a', 'b', 'c']);
  });

  it('truncates ids past 30 and shows a +N more chip', async () => {
    const ids = Array.from({ length: 32 }, (_, i) => String(i));
    const fixture = await mountSignal([
      signalStore({
        stateKeys: ['entityMap', 'ids'],
        state: { entityMap: {}, ids: [] },
        entities: [{ idsKey: 'ids', entityMapKey: 'entityMap', ids, count: ids.length }],
      }),
    ]);
    const host = root(fixture);
    const more = host.querySelector<HTMLElement>('.chip.more');
    expect(more).not.toBeNull();
    expect(more?.textContent?.trim()).toBe('+2 more');
  });

  it('shows avg and last duration for timed methods and omits them for untimed ones', async () => {
    const fixture = await mountSignal([
      signalStore({
        methods: [
          { name: 'load', calls: 4, avgDurationMs: 10, lastDurationMs: 8 },
          { name: 'reset', calls: 1 },
        ],
      }),
    ]);
    const host = root(fixture);
    const methods = host.querySelector('.methods');
    expect(methods?.textContent).toContain('avg 10ms');
    expect(methods?.textContent).toContain('last 8ms');
    // reset has no duration numbers
    const resetChip = Array.from(host.querySelectorAll<HTMLElement>('.chip.mono')).find((c) =>
      c.textContent?.includes('reset'),
    );
    expect(resetChip?.textContent).not.toContain('ms');
  });
});

describe('StoreInspector source declarations', () => {
  it('keeps only list items inside the declaration list when a filter matches nothing', async () => {
    const { fixture } = await mount([entry(1)]);
    const list = () => root(fixture).querySelector('#ngrx-source-heading')!.closest('section')!;
    type(root(fixture).querySelector<HTMLInputElement>('input[type="search"], input')!, 'zzz');
    await settle(fixture);
    const nodes = list().querySelector('ul.nodes')!;
    expect(nodes.textContent).toContain('No declarations match.');
    for (const child of Array.from(nodes.children)) {
      expect(child.tagName).toBe('LI');
      expect(child.getAttribute('role')).toBeNull();
    }
    expect(nodes.querySelector('[role="status"]')).not.toBeNull();
  });
});
