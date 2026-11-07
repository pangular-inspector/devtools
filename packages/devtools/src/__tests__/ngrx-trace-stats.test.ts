// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { domTree } from '../host-tree.ts';
import { createNgrxCollector, usesWithDevtools } from '../ngrx-collector.ts';
import { registerNgrxSignals } from '../ngrx-register.ts';
import { NGRX_LOOP_BURST } from '../ngrx-shared.ts';
import { mergeNgrxReport, type NgrxPages } from '../rpc/ngrx-tools.ts';

const SIGNAL = Symbol('SIGNAL');
const STATE_SOURCE = Symbol('STATE_SOURCE');

function writable<T>(initial: T) {
  const node = { value: initial };
  const getter = (() => node.value) as (() => T) & {
    set(v: T): void;
    update(fn: (v: T) => T): void;
  };
  (getter as any)[SIGNAL] = node;
  getter.set = (v: T) => {
    node.value = v;
  };
  getter.update = (fn: (v: T) => T) => {
    node.value = fn(node.value);
  };
  return getter;
}

function patchState(store: any, patch: Record<string, unknown>) {
  for (const [key, value] of Object.entries(patch)) store[STATE_SOURCE][key].set(value);
}

class TodoStore {
  [STATE_SOURCE] = { filter: writable('all'), token: writable('') };
  setFilter = (filter: string) => patchState(this, { filter });
}

/** What `withDevtools()` from ngrx-toolkit adds to a store. */
class ToolkitStore extends TodoStore {
  ___uniqueDevtoolsId = 'todos';
  ___renameDevtoolsName = () => {};
}

function pageWith(store: object, options: { trace?: boolean } = {}) {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map<unknown, { value: unknown }>([[store.constructor, { value: store }]]),
    get: () => null,
  };
  const node = { get: () => null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? {} : null),
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const collector = createNgrxCollector(() => ng as any, vi.fn(), domTree(), 200, options);
  collector.collect();
  return collector;
}

function fakeClassic(options: { trace?: boolean } = {}) {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  let state = { n: 0 };
  const listeners: ((a: unknown) => void)[] = [];
  class _Store {
    source = { getValue: () => state };
    dispatch(action: { type: string }) {
      this.run(action);
    }
    next(action: { type: string }) {
      this.run(action);
    }
    run(action: { type: string }) {
      state = { n: state.n + 1 };
      for (const l of listeners) l(action);
    }
    select() {}
  }
  class ScannedActionsSubject {
    subscribe(fn: (a: unknown) => void) {
      listeners.push(fn);
      return { unsubscribe: () => {} };
    }
  }
  const store = new _Store();
  const values = new Map<unknown, unknown>([
    [_Store, store],
    [ScannedActionsSubject, new ScannedActionsSubject()],
  ]);
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map([...values.keys()].map((k) => [k, { value: undefined }])),
  };
  const node = { get: (token: unknown) => values.get(token) ?? null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? {} : null),
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const collector = createNgrxCollector(
    () => ng as any,
    () => {},
    domTree(),
    200,
    options,
  );
  collector.collect();
  return { store, collector };
}

describe('ngrx.trace', () => {
  it('records no call site while tracing is off', () => {
    const store = new TodoStore();
    const collector = pageWith(store);
    store.setFilter('done');
    expect(collector.logSince(0)[0].trace).toBeUndefined();
  });

  it('records the app frames of a method call and of a dispatch', () => {
    const store = new TodoStore();
    const collector = pageWith(store, { trace: true });
    function fromTheTest() {
      store.setFilter('done');
    }
    fromTheTest();
    const [entry] = collector.logSince(0);
    expect(entry.trace?.length).toBeGreaterThan(0);
    expect(entry.trace!.join('\n')).toContain('ngrx-trace-stats.test.ts');
    // The collector's own frames are cut by count, never the caller's.
    expect(entry.trace![0]).toMatch(/^fromTheTest /);
    expect(entry.trace!.join('\n')).not.toMatch(/ngrx-collector\.ts|https?:\/\//);

    const classic = fakeClassic({ trace: true });
    function dispatchFromTest() {
      classic.store.dispatch({ type: 'inc' });
    }
    dispatchFromTest();
    const [action] = classic.collector.logSince(0);
    expect(action.trace![0]).toMatch(/^dispatchFromTest /);
  });

  it('masks a token in a frame', () => {
    const store = new TodoStore();
    const collector = pageWith(store, { trace: true });
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const named = { [jwt]: () => store.setFilter('x') };
    named[jwt]();
    const frames = collector.logSince(0)[0].trace!.join('\n');
    expect(frames).toContain('[redacted]');
    expect(frames).not.toContain(jwt);
  });
});

describe('ngrx action stats', () => {
  it('counts entries per type since load and flags an effect that dispatches in a burst', () => {
    const { store, collector } = fakeClassic();
    store.dispatch({ type: 'load' });
    for (let i = 0; i < NGRX_LOOP_BURST; i++) store.next({ type: 'poll' });
    const { stats, version } = collector.stats();
    const poll = stats.find((s) => s.type === 'poll')!;
    expect(poll).toMatchObject({ source: 'store', storeId: 'store', count: NGRX_LOOP_BURST });
    expect(poll.effects).toBe(NGRX_LOOP_BURST);
    expect(poll.burst).toBe(NGRX_LOOP_BURST);
    expect(poll.loop).toBe(true);
    const load = stats.find((s) => s.type === 'load')!;
    expect(load.count).toBe(1);
    expect(load.loop).toBeUndefined();
    // Most frequent first.
    expect(stats[0].type).toBe('poll');
    store.dispatch({ type: 'load' });
    expect(collector.stats().version).toBeGreaterThan(version);
  });

  it('averages method durations and leaves restores out', () => {
    const store = new TodoStore();
    const collector = pageWith(store);
    store.setFilter('a');
    store.setFilter('b');
    collector.run({ type: 'restore', seq: 1 });
    const { stats } = collector.stats();
    expect(stats.map((s) => s.type)).toEqual(['setFilter']);
    expect(stats[0]).toMatchObject({ count: 2, timed: 2 });
    expect(typeof stats[0].avgMs).toBe('number');
  });

  it('keeps the last stats on the server until the page sends new ones', () => {
    const pages: NgrxPages = new Map();
    const base = {
      pageId: 'p1',
      session: 's',
      url: '/',
      title: '',
      stores: [],
      classic: null,
      log: [],
    };
    const stat = {
      source: 'store',
      storeId: 'store',
      type: 'a',
      count: 2,
      lastAt: 1,
      burst: 1,
    } as const;
    mergeNgrxReport(pages, { ...base, stats: [stat, { bad: true } as never] }, []);
    expect(pages.get('p1')!.stats).toEqual([stat]);
    mergeNgrxReport(pages, base, []);
    expect(pages.get('p1')!.stats).toEqual([stat]);
  });
});

describe('withDevtools() stores', () => {
  it('detects the members withDevtools() adds', () => {
    expect(usesWithDevtools(new ToolkitStore())).toBe(true);
    expect(usesWithDevtools(new TodoStore())).toBe(false);
  });

  it('leaves the store unpatched and logs changes from a compare on collect', () => {
    const store = new ToolkitStore();
    const method = store.setFilter;
    const set = store[STATE_SOURCE].filter.set;
    const collector = pageWith(store);
    expect(store.setFilter).toBe(method);
    expect(store[STATE_SOURCE].filter.set).toBe(set);
    const [info] = collector.collect().stores;
    expect(info.watchOnly).toBe(true);
    expect(info.methods).toEqual([{ name: 'setFilter', calls: 0 }]);
    store.setFilter('done');
    expect(collector.logSince(0)).toEqual([]);
    collector.collect(false);
    const log = collector.logSince(0);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ type: 'patchState', diff: [{ path: 'filter', after: 'done' }] });
    collector.collect(false);
    expect(collector.logSince(0)).toHaveLength(1);
  });

  it('records each write through watchState when the app registers it', () => {
    const watchers: (() => void)[] = [];
    registerNgrxSignals({
      watchState: ((_store: object, fn: () => void) => {
        watchers.push(fn);
        fn();
        return { destroy: () => {} };
      }) as never,
    });
    try {
      document.body.innerHTML = '<app-root ng-version="22"></app-root>';
      const store = new ToolkitStore();
      const root = document.querySelector('app-root')!;
      const env = {
        scopes: new Set(['root']),
        records: new Map<unknown, { value: unknown }>([[ToolkitStore, { value: store }]]),
        get: () => null,
      };
      const ng = {
        getInjector: () => ({ get: () => null }),
        getComponent: (el: Element) => (el === root ? {} : null),
        ɵgetInjectorResolutionPath: () => [env],
        ɵgetInjectorProviders: () => [],
      };
      const collector = createNgrxCollector(
        () => ng as any,
        () => {},
      );
      collector.collect();
      store.setFilter('a');
      watchers.forEach((fn) => fn());
      store.setFilter('b');
      watchers.forEach((fn) => fn());
      expect(collector.logSince(0).map((e) => e.diff[0]?.after)).toEqual(['a', 'b']);
      collector.collect(false);
      expect(collector.logSince(0)).toHaveLength(2);
    } finally {
      registerNgrxSignals({ watchState: (() => undefined) as never });
      (globalThis as Record<string, unknown>)['__PANGULAR_NGRX_SIGNALS__'] = undefined;
    }
  });
});
