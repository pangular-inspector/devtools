// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setRedaction } from '../forms-privacy.ts';
import { domTree } from '../host-tree.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { attachNgrx } from '../ngrx-overlay.ts';
import type { NgrxPageReport } from '../ngrx-shared.ts';

const SIGNAL = Symbol('SIGNAL');
const STATE_SOURCE = Symbol('STATE_SOURCE');

function writable<T>(initial: T) {
  const node = { value: initial };
  const getter = (() => node.value) as (() => T) & { set(v: T): void };
  (getter as unknown as Record<symbol, unknown>)[SIGNAL] = node;
  getter.set = (v: T) => {
    node.value = v;
  };
  return getter;
}

function computedOf<T>(fn: () => T) {
  const getter = () => fn();
  (getter as unknown as Record<symbol, unknown>)[SIGNAL] = { computation: fn };
  return getter;
}

/** Counts how often serialization reads the item, which only serializing it does. */
let reads = 0;
function item(label: string) {
  return {
    get label() {
      reads++;
      return label;
    },
  };
}

class Store {
  [STATE_SOURCE] = { query: writable(''), items: writable([item('a')]) };
  query = computedOf(() => this[STATE_SOURCE].query());
  items = computedOf(() => this[STATE_SOURCE].items());
  count = computedOf(() => this[STATE_SOURCE].items().length);
  setQuery = (query: string) => this[STATE_SOURCE].query.set(query);
}

/** A page with a signal store on its root component and a classic Store in the root injector. */
function setup() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const store = new Store();
  let state: Record<string, unknown> = { todos: [item('t')] };
  class _Store {
    source = { getValue: () => state };
    dispatch() {}
    select() {}
  }
  class ScannedActionsSubject {
    subscribe() {
      return { unsubscribe: () => {} };
    }
  }
  const values = new Map<unknown, unknown>([
    [_Store, new _Store()],
    [ScannedActionsSubject, new ScannedActionsSubject()],
    [Store, store],
  ]);
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map([...values.keys()].map((k) => [k, { value: values.get(k) }])),
    get: (token: unknown) => values.get(token) ?? null,
  };
  const node = { get: (token: unknown) => values.get(token) ?? null };
  const app = { store };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? app : null),
    ɵgetInjectorMetadata: (inj: unknown) =>
      inj === rootEnv ? { type: 'environment', source: 'R3Injector' } : { type: 'element' },
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  return {
    ng,
    store,
    setState: (next: Record<string, unknown>) => (state = next),
  };
}

afterEach(() => setRedaction());

describe('NgRx report change tracking', () => {
  it('reuses an unchanged signal store and classic store without serializing them', () => {
    const { ng } = setup();
    const collector = createNgrxCollector(
      () => ng as never,
      () => {},
      domTree(),
    );
    const first = collector.collect();
    expect(first.stores).toHaveLength(1);
    expect(first.stores[0]!.state).toEqual({ query: '', items: [{ label: 'a' }] });
    expect(first.stores[0]!.computed).toEqual({ count: 1 });
    expect(first.classic).toEqual({
      state: { todos: [{ label: 't' }] },
      devtools: false,
      scope: 'root',
    });
    const readsAfterFirst = reads;
    expect(readsAfterFirst).toBeGreaterThan(0);

    const second = collector.collect();
    expect(reads).toBe(readsAfterFirst);
    expect(second.version).toBe(first.version);
    expect(second.stores[0]).toBe(first.stores[0]);
    expect(second.classic).toBe(first.classic);
  });

  it('rebuilds only the store that changed, and moves the version', () => {
    const { ng, store, setState } = setup();
    const collector = createNgrxCollector(
      () => ng as never,
      () => {},
      domTree(),
    );
    const first = collector.collect();

    store.setQuery('b');
    const second = collector.collect();
    expect(second.version).toBeGreaterThan(first.version);
    expect(second.stores[0]!.state).toMatchObject({ query: 'b' });
    expect(second.classic).toBe(first.classic);

    setState({ todos: [] });
    const third = collector.collect();
    expect(third.version).toBeGreaterThan(second.version);
    expect(third.classic!.state).toEqual({ todos: [] });
    expect(third.stores[0]).toBe(second.stores[0]);
  });

  it('rebuilds when the redaction config changes what the report shows', () => {
    const { ng } = setup();
    const collector = createNgrxCollector(
      () => ng as never,
      () => {},
      domTree(),
    );
    const first = collector.collect();
    expect(first.stores[0]!.state['query']).toBe('');
    setRedaction({ secretNames: ['query'] });
    const second = collector.collect();
    expect(second.version).toBeGreaterThan(first.version);
    expect(second.stores[0]).not.toBe(first.stores[0]);
    expect(second.stores[0]!.state['query']).not.toBe('');
  });

  it('skips the push of an unchanged page without serializing it, and pushes a change', async () => {
    const { ng, store } = setup();
    const reports: NgrxPageReport[] = [];
    const my = {
      rpc: {
        call: async (name: string, report: unknown) => {
          if (name !== 'push-ngrx-state') return undefined;
          reports.push(report as NgrxPageReport);
          return { seq: 0 };
        },
        register: () => {},
      },
    };
    const overlay = attachNgrx(my, 'p1', () => ng as never, undefined, {
      describe: () => ({ url: '/', title: 'Test' }),
    });
    try {
      await overlay.push();
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ pageId: 'p1', url: '/', title: 'Test' });
      const readsAfterFirst = reads;

      await overlay.push();
      await overlay.push();
      expect(reports).toHaveLength(1);
      expect(reads).toBe(readsAfterFirst);

      store.setQuery('changed');
      await overlay.push();
      expect(reports).toHaveLength(2);
      expect(reports[1]!.stores[0]!.state).toMatchObject({ query: 'changed' });
      expect(reports[1]!.classic).toEqual(reports[0]!.classic);
    } finally {
      overlay.stop();
    }
  });
});
