// @vitest-environment jsdom
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { attachNgrx } from '../ngrx-overlay.ts';
import { diff, serialize, type NgrxPageReport } from '../ngrx-shared.ts';
import { mergeNgrxReport, nameStore, ngrxStateOf, type NgrxPages } from '../rpc/ngrx-tools.ts';

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

function computedOf<T>(fn: () => T) {
  const getter = () => fn();
  (getter as any)[SIGNAL] = { computation: fn };
  return getter;
}

function patchState(store: any, patch: Record<string, unknown>) {
  for (const [key, value] of Object.entries(patch)) store[STATE_SOURCE][key].set(value);
}

class SignalStore {
  [STATE_SOURCE] = { query: writable(''), saved: writable<string[]>([]) };
  query = computedOf(() => (this as any)[STATE_SOURCE].query());
  saved = computedOf(() => (this as any)[STATE_SOURCE].saved());
  savedCount = computedOf(() => (this as any)[STATE_SOURCE].saved().length);
  setQuery = (query: string) => patchState(this, { query });
  isSaved = (id: string) => (this as any)[STATE_SOURCE].saved().includes(id);
  toggle = (id: string) => {
    const saved = (this as any)[STATE_SOURCE].saved();
    patchState(this, { saved: saved.includes(id) ? [] : [...saved, id] });
  };
}

class App {
  store: SignalStore;
  constructor(store: SignalStore) {
    this.store = store;
  }
}

function setup(maxLog?: number) {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const store = new SignalStore();
  const app = new App(store);
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map<unknown, { value: unknown }>([
      [class Router {}, { value: {} }],
      [SignalStore, { value: store }],
    ]),
    get: () => null,
  };
  const node = { el: root, get: () => null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? app : null),
    ɵgetInjectorMetadata: (inj: unknown) =>
      inj === rootEnv ? { type: 'environment', source: 'R3Injector' } : { type: 'element' },
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const onChange = vi.fn();
  const collector = createNgrxCollector(() => ng as any, onChange, document, maxLog);
  return { store, app, rootEnv, collector, onChange, ng };
}

describe('ngrx collector', () => {
  it('finds a root signal store and splits state, computed and methods', () => {
    const { collector } = setup();
    const { stores, classic } = collector.collect();
    expect(classic).toBeNull();
    expect(stores).toHaveLength(1);
    const [info] = stores;
    expect(info.kind).toBe('signal-store');
    expect(info.className).toBe('SignalStore');
    expect(info.scope).toBe('root');
    expect(info.stateKeys).toEqual(['query', 'saved']);
    expect(info.state).toEqual({ query: '', saved: [] });
    expect(info.computed).toEqual({ savedCount: 0 });
    expect(info.methods.map((m) => m.name)).toEqual(['setQuery', 'isSaved', 'toggle']);
    expect(info.references).toEqual(['App.store']);
    expect(info.writable).toBe(true);
  });

  it('unwraps a store that is no longer found and wraps it once when it comes back', () => {
    const { store, app, rootEnv, collector } = setup();
    const original = store.setQuery;
    collector.collect();
    expect(store.setQuery).not.toBe(original);

    rootEnv.records.delete(SignalStore);
    (app as any).store = null;
    expect(collector.collect().stores).toHaveLength(0);
    expect(store.setQuery).toBe(original);

    rootEnv.records.set(SignalStore, { value: store });
    collector.collect();
    store.setQuery('rome');
    expect(collector.logSince(0).filter((entry) => entry.type === 'setQuery')).toHaveLength(1);
  });

  it('keeps at most the configured number of change log entries', () => {
    const { store, collector } = setup(10);
    collector.collect();
    for (let i = 0; i < 25; i++) store.setQuery(`q${i}`);
    const log = collector.logSince(0);
    expect(log).toHaveLength(10);
    expect(log.at(-1)!.seq).toBe(25);
  });

  it('keeps a stable id across collections', () => {
    const { collector } = setup();
    const first = collector.collect().stores[0].id;
    expect(collector.collect().stores[0].id).toBe(first);
  });

  it('logs method calls with args and a diff, and calls that change nothing at most once a second', () => {
    const { store, collector, onChange } = setup();
    collector.collect();
    store.setQuery('rome');
    store.isSaved('a');
    store.isSaved('b');
    const log = collector.logSince(0);
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ type: 'isSaved', args: ['a'], diff: [] });
    expect(log[0]).toMatchObject({
      seq: 1,
      type: 'setQuery',
      args: ['rome'],
      restorable: true,
      diff: [{ path: 'query', op: 'change', before: '', after: 'rome' }],
    });
    expect(onChange).toHaveBeenCalled();
    expect(collector.collect().stores[0].methods.find((m) => m.name === 'isSaved')?.calls).toBe(2);
  });

  it('logs writes made outside a method as patchState', async () => {
    const { store, collector } = setup();
    collector.collect();
    patchState(store, { saved: ['x'] });
    await Promise.resolve();
    const [entry] = collector.logSince(0);
    expect(entry.type).toBe('patchState');
    expect(entry.diff).toEqual([{ path: 'saved[0]', op: 'add', after: 'x' }]);
  });

  it('restores a snapshot from the log', () => {
    const { store, collector } = setup();
    collector.collect();
    store.setQuery('a');
    store.setQuery('b');
    const result = collector.run({ type: 'restore', seq: 1 });
    expect(result.ok).toBe(true);
    expect((store as any)[STATE_SOURCE].query()).toBe('a');
    const last = collector.logSince(2)[0];
    expect(last.type).toBe('Restore #1 (watchState listeners not notified)');
    expect(collector.run({ type: 'restore', seq: 99 }).error).toBeTruthy();
  });

  it('logs a change past the serialize limits by reference and restores the raw value', () => {
    const { store, collector } = setup();
    const many = Array.from({ length: 150 }, (_, i) => `id${i}`);
    (store as any).replace = (next: string[]) => patchState(store, { saved: next });
    patchState(store, { saved: many });
    collector.collect();
    const changed = many.map((id, i) => (i === 140 ? 'changed' : id));
    (store as any).replace(changed);
    const [entry] = collector.logSince(0);
    expect(entry).toMatchObject({
      type: 'replace',
      diff: [{ path: 'saved[140]', op: 'change', before: 'id140', after: 'changed' }],
    });
    (store as any).replace([...changed]);
    expect(collector.run({ type: 'restore', seq: entry.seq }).ok).toBe(true);
    expect((store as any)[STATE_SOURCE].saved()).toBe(changed);
  });

  it('finds a changed entity past the first hundred map keys', () => {
    const { store, collector } = setup();
    const entityMap = Object.fromEntries(
      Array.from({ length: 150 }, (_, i) => [`e${i}`, { id: i, done: false }]),
    );
    patchState(store, { saved: entityMap });
    collector.collect();
    (store as any)[STATE_SOURCE].saved.set({ ...entityMap, e149: { id: 149, done: true } });
    return Promise.resolve().then(() => {
      const [entry] = collector.logSince(0);
      expect(entry.type).toBe('patchState');
      expect(entry.diff).toEqual([
        { path: 'saved.e149.done', op: 'change', before: false, after: true },
      ]);
    });
  });

  it('redacts secret-looking state keys and nested fields', () => {
    const { store, collector } = setup();
    patchState(store, { saved: [{ user: 'ann', password: 'hunter2' }] });
    collector.collect();
    expect(collector.collect().stores[0].state).toEqual({
      query: '',
      saved: [{ user: 'ann', password: '[redacted]' }],
    });
    patchState(store, { saved: [{ user: 'ann', password: 'swordfish' }] });
    return Promise.resolve().then(() => {
      expect(JSON.stringify(collector.logSince(0))).not.toMatch(/hunter2|swordfish/);
    });
  });

  it('only rescans the page when asked to rediscover stores', () => {
    const { store, collector, ng } = setup();
    const spy = vi.spyOn(ng, 'getComponent');
    collector.collect();
    const scan = spy.mock.calls.length;
    expect(scan).toBeGreaterThan(0);
    store.setQuery('a');
    expect(collector.collect(false).stores[0].state).toMatchObject({ query: 'a' });
    expect(spy).toHaveBeenCalledTimes(scan);
    collector.collect();
    expect(spy).toHaveBeenCalledTimes(scan * 2);
  });

  it('only returns entries after a sequence number', () => {
    const { store, collector } = setup();
    collector.collect();
    store.setQuery('a');
    store.toggle('x');
    expect(collector.logSince(1).map((e) => e.seq)).toEqual([2]);
  });

  it('reads classic store state and logs actions through ScannedActionsSubject', () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    let state = { count: 0 };
    const listeners: ((a: unknown) => void)[] = [];
    class _Store {
      source = { getValue: () => state };
      dispatch(action: { type: string }) {
        if (action.type === 'inc') state = { count: state.count + 1 };
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
    const scanned = new ScannedActionsSubject();
    const values = new Map<unknown, unknown>([
      [_Store, store],
      [ScannedActionsSubject, scanned],
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
    );
    expect(collector.collect().classic).toEqual({
      state: { count: 0 },
      devtools: false,
      scope: 'root',
    });
    store.dispatch({ type: 'inc' });
    const [entry] = collector.logSince(0);
    expect(entry).toMatchObject({
      source: 'store',
      type: 'inc',
      action: { type: 'inc' },
      restorable: false,
      diff: [{ path: 'count', op: 'change', before: 0, after: 1 }],
    });
    expect(collector.run({ type: 'restore', seq: entry.seq }).error).toMatch(
      /provideStoreDevtools/,
    );
  });
});

function fakeClassic<S>(initial: S, reducer: (state: S, action: { type: string }) => S) {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  let state = initial;
  const listeners: ((a: unknown) => void)[] = [];
  class _Store {
    source = { getValue: () => state };
    dispatch(action: { type: string } | (() => { type: string })) {
      if (typeof action === 'function') {
        this.dispatch(action());
        return;
      }
      this.run(action);
    }
    next(action: { type: string }) {
      this.run(action);
    }
    run(action: { type: string }) {
      state = reducer(state, action);
      for (const l of listeners) l(action);
    }
    select() {}
  }
  class ScannedActionsSubject {
    subscribe(fn: (a: unknown) => void) {
      listeners.push(fn);
      return { unsubscribe: () => listeners.splice(listeners.indexOf(fn), 1) };
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
  );
  collector.collect();
  return { store, collector, Store: _Store };
}

describe('ngrx collector with a classic store', () => {
  it('finds a change past the first hundred array items', () => {
    type Todo = { id: number; done: boolean };
    const todos: Todo[] = Array.from({ length: 150 }, (_, id) => ({ id, done: false }));
    const { store, collector } = fakeClassic({ todos }, (state, action) => {
      const id = Number(action.type.split(' ')[1]);
      return {
        todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      };
    });
    store.dispatch({ type: 'toggle 5' });
    store.dispatch({ type: 'toggle 120' });
    expect(collector.logSince(0).map((e) => e.diff)).toEqual([
      [{ path: 'todos[5].done', op: 'change', before: false, after: true }],
      [{ path: 'todos[120].done', op: 'change', before: false, after: true }],
    ]);
  });

  it('finds a changed entity past the first hundred keys and keeps an unchanged state empty', () => {
    const entities = Object.fromEntries(
      Array.from({ length: 150 }, (_, i) => [`e${i}`, { id: i, done: false }]),
    );
    const { store, collector } = fakeClassic({ entities }, (state, action) =>
      action.type === 'toggle'
        ? { entities: { ...state.entities, e140: { id: 140, done: true } } }
        : state,
    );
    store.dispatch({ type: 'toggle' });
    store.dispatch({ type: 'noop' });
    expect(collector.logSince(0).map((e) => e.diff)).toEqual([
      [{ path: 'entities.e140.done', op: 'change', before: false, after: true }],
      [],
    ]);
  });

  it('tags each action with where it came from', () => {
    const { store, collector } = fakeClassic({ n: 0 }, (s) => ({ n: s.n + 1 }));
    store.dispatch({ type: 'from component' });
    store.next({ type: 'from effect' });
    store.dispatch(() => ({ type: 'from signal' }));
    store.dispatch({ type: 'plain again' });
    expect(collector.logSince(0).map((e) => [e.type, e.origin])).toEqual([
      ['from component', 'dispatch'],
      ['from effect', 'effect'],
      ['from signal', 'reactive'],
      ['plain again', 'dispatch'],
    ]);
  });

  it('puts back the original dispatch and next when it stops', () => {
    const { store, collector, Store } = fakeClassic({ n: 0 }, (s) => s);
    expect(Object.hasOwn(store, 'dispatch')).toBe(true);
    expect(Object.hasOwn(store, 'next')).toBe(true);
    collector.stop();
    expect(Object.hasOwn(store, 'dispatch')).toBe(false);
    expect(Object.hasOwn(store, 'next')).toBe(false);
    expect(store.dispatch).toBe(Store.prototype.dispatch);
    store.dispatch({ type: 'after stop' });
    expect(collector.logSince(0)).toEqual([]);
  });
});

describe('ngrx collector with Store DevTools', () => {
  function setupDevtools() {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    const reducer = (s: { n: number }, a: { type: string }) =>
      a.type === 'inc' ? { n: s.n + 1 } : s;
    const listeners: ((a: unknown) => void)[] = [];
    const lifted = {
      actionsById: { 0: { action: { type: '@ngrx/store/init' } } } as Record<
        number,
        { action: { type: string } }
      >,
      stagedActionIds: [0],
      computedStates: [{ state: { n: 0 } }],
      currentStateIndex: 0,
      nextActionId: 1,
    };
    const current = () => lifted.computedStates[lifted.currentStateIndex].state;
    class _Store {
      source = { getValue: current };
      dispatch(action: { type: string }) {
        const id = lifted.nextActionId++;
        const atEnd = lifted.currentStateIndex === lifted.stagedActionIds.length - 1;
        lifted.actionsById[id] = { action };
        lifted.stagedActionIds.push(id);
        lifted.computedStates.push({ state: reducer(lifted.computedStates.at(-1)!.state, action) });
        if (atEnd) lifted.currentStateIndex = lifted.stagedActionIds.length - 1;
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
    class StoreDevtools {
      liftedState = { getValue: () => lifted };
      jumpToAction(id: number) {
        lifted.currentStateIndex = lifted.stagedActionIds.indexOf(id);
      }
      jumpToState(index: number) {
        lifted.currentStateIndex = index;
      }
    }
    const store = new _Store();
    const values = new Map<unknown, unknown>([
      [_Store, store],
      [ScannedActionsSubject, new ScannedActionsSubject()],
      [StoreDevtools, new StoreDevtools()],
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
    );
    collector.collect();
    return { store, collector, current, ng, lifted };
  }

  it('logs a restore with its diff so the next action is not blamed for it', () => {
    const { store, collector } = setupDevtools();
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    const first = collector.logSince(0)[0];
    const result = collector.run({ type: 'restore', seq: first.seq });
    expect(result).toMatchObject({ ok: true, paused: true });
    expect(result.message).toMatch(/paused/);
    const after = collector.lastSeq();
    expect(collector.logSince(after - 1)[0]).toMatchObject({
      type: `Restore #${first.seq}`,
      diff: [{ path: 'n', op: 'change', before: 3, after: 1 }],
    });
    store.dispatch({ type: 'noop' });
    store.dispatch({ type: 'inc' });
    expect(collector.logSince(after).map((e) => [e.type, e.diff])).toEqual([
      ['noop', []],
      ['inc', []],
    ]);
  });

  it('reports a paused store and goes back to the latest state', () => {
    const { store, collector, current } = setupDevtools();
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    expect(collector.collect().classic?.paused).toBeUndefined();
    collector.run({ type: 'restore', seq: collector.logSince(0)[0].seq });
    store.dispatch({ type: 'inc' });
    expect(current()).toEqual({ n: 1 });
    expect(collector.collect().classic).toMatchObject({ state: { n: 1 }, paused: true });
    const result = collector.run({ type: 'latest' });
    expect(result).toMatchObject({ ok: true });
    expect(current()).toEqual({ n: 3 });
    expect(collector.collect().classic?.paused).toBeUndefined();
    expect(collector.logSince(collector.lastSeq() - 1)[0]).toMatchObject({
      type: 'Back to latest',
      diff: [{ path: 'n', op: 'change', before: 1, after: 3 }],
      restorable: true,
    });
    expect(collector.run({ type: 'latest' }).message).toMatch(/already/);
  });

  it('tells the server about entries Store DevTools dropped after they were sent', async () => {
    const { store, ng, lifted } = setupDevtools();
    const pages: NgrxPages = new Map();
    const reports: NgrxPageReport[] = [];
    const my = {
      rpc: {
        call: async (name: string, report: unknown) => {
          if (name !== 'push-ngrx-state') return undefined;
          reports.push(report as NgrxPageReport);
          return { seq: mergeNgrxReport(pages, report as NgrxPageReport, []) };
        },
        register: () => {},
      },
    };
    const overlay = attachNgrx(my, 'p1', () => ng as any);
    try {
      await overlay.push();
      store.dispatch({ type: 'inc' });
      store.dispatch({ type: 'inc' });
      await overlay.push();
      const log = () => ngrxStateOf(pages).pages[0].log;
      expect(log().map((e) => e.restorable)).toEqual([true, true]);
      delete lifted.actionsById[1];
      await overlay.push();
      expect(reports.at(-1)).toMatchObject({
        log: [],
        unrestorable: [{ seq: 1, reason: 'dropped' }],
      });
      expect(log().map((e) => [e.restorable, e.unrestorable])).toEqual([
        [false, 'dropped'],
        [true, undefined],
      ]);
      store.dispatch({ type: 'inc' });
      await overlay.push();
      expect(reports.at(-1)?.unrestorable).toBeUndefined();
      expect(log().map((e) => e.restorable)).toEqual([false, true, true]);
    } finally {
      overlay.stop();
    }
  });

  it('does not call a restore to the newest action paused', () => {
    const { store, collector } = setupDevtools();
    store.dispatch({ type: 'inc' });
    const result = collector.run({ type: 'restore', seq: collector.lastSeq() });
    expect(result).toMatchObject({ ok: true, paused: false });
    expect(result.message).not.toMatch(/paused/);
  });
});

describe('serialize', () => {
  it('handles Map, Set, Date, circular and depth limits', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular['self'] = circular;
    expect(
      serialize(
        {
          map: new Map([['k', 1]]),
          set: new Set([1]),
          date: new Date(0),
          circular,
          deep: { a: { b: { c: 1 } } },
          none: undefined,
        },
        { depth: 3 },
      ),
    ).toEqual({
      map: { '@type': 'Map', size: 1, entries: [['k', 1]] },
      set: { '@type': 'Set', size: 1, values: [1] },
      date: { '@type': 'Date', value: '1970-01-01T00:00:00.000Z' },
      circular: { a: 1, self: '[Circular]' },
      deep: { a: { b: '[Object]' } },
      none: { '@type': 'undefined' },
    });
  });

  it('diffs nested objects and arrays by path', () => {
    expect(diff({ a: { b: 1 }, list: [1] }, { a: { b: 2 }, list: [1, 2], c: true })).toEqual([
      { path: 'a.b', op: 'change', before: 1, after: 2 },
      { path: 'list[1]', op: 'add', after: 2 },
      { path: 'c', op: 'add', after: true },
    ]);
  });
});

describe('ngrx tools', () => {
  const store = {
    id: 'ngrx-1',
    kind: 'signal-store' as const,
    className: 'SignalStore',
    scope: 'root',
    stateKeys: ['query', 'saved'],
    state: {},
    computed: {},
    methods: [{ name: 'setQuery', calls: 0 }],
    references: [],
    writable: true,
  };

  it('names a store from the matching withState keys', () => {
    expect(
      nameStore(store, [
        { name: 'OtherStore', kind: 'signal-store', file: 'a.ts', members: { state: ['x'] } },
        {
          name: 'TravelStore',
          kind: 'signal-store',
          file: 'travel.store.ts',
          members: { state: ['query', 'saved'] },
        },
      ]),
    ).toEqual({ name: 'TravelStore', declaredIn: 'travel.store.ts' });
  });

  it('appends only new log entries and restarts on a new session', () => {
    const pages: NgrxPages = new Map();
    const entry = (seq: number) => ({
      seq,
      source: 'signal-store' as const,
      storeId: 'ngrx-1',
      type: 't',
      timestamp: 0,
      diff: [],
      restorable: true,
    });
    const report = (session: string, log: ReturnType<typeof entry>[]) => ({
      pageId: 'p1',
      session,
      url: '/',
      title: '',
      stores: [store],
      classic: null,
      log,
    });
    expect(mergeNgrxReport(pages, report('s1', [entry(1), entry(2)]), [])).toBe(2);
    expect(mergeNgrxReport(pages, report('s1', [entry(2), entry(3)]), [])).toBe(3);
    expect(ngrxStateOf(pages).pages[0].log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(ngrxStateOf(pages).pages[0].dropped).toBe(0);
    expect(mergeNgrxReport(pages, report('s2', [entry(1)]), [])).toBe(1);
    mergeNgrxReport(pages, report('s3', [1, 2, 3, 4, 5].map(entry)), [], 0, 2);
    expect(ngrxStateOf(pages).pages[0].log.map((e) => e.seq)).toEqual([4, 5]);
    expect(ngrxStateOf(pages).pages[0].dropped).toBe(3);
    expect(ngrxStateOf(pages).pages[0]).not.toHaveProperty('session');
  });

  it('marks earlier entries the page can no longer restore', () => {
    const pages: NgrxPages = new Map();
    const entry = (seq: number) => ({
      seq,
      source: 'store' as const,
      storeId: 'store',
      type: 'inc',
      timestamp: 0,
      diff: [],
      restorable: true,
    });
    const report = (log: ReturnType<typeof entry>[], unrestorable?: unknown) => ({
      pageId: 'p1',
      session: 's1',
      url: '/',
      title: '',
      stores: [],
      classic: { state: {}, devtools: true, scope: 'root' },
      log,
      ...(unrestorable ? { unrestorable: unrestorable as NgrxPageReport['unrestorable'] } : {}),
    });
    mergeNgrxReport(pages, report([entry(1), entry(2)]), []);
    mergeNgrxReport(
      pages,
      report(
        [entry(3)],
        [
          { seq: 1, reason: 'dropped' },
          { seq: 2, reason: 'bogus' },
          { seq: 9, reason: 'not-recorded' },
        ],
      ) as NgrxPageReport,
      [],
    );
    expect(
      ngrxStateOf(pages).pages[0].log.map((e) => [e.seq, e.restorable, e.unrestorable]),
    ).toEqual([
      [1, false, 'dropped'],
      [2, true, undefined],
      [3, true, undefined],
    ]);
  });
});

describe('ngrx collector with @ngrx/signals', () => {
  it('reads, logs and restores a real signal store from an injector', async () => {
    await import('@angular/compiler');
    const { Injector, computed } = await import('@angular/core');
    const {
      signalStore,
      withState,
      withComputed,
      withMethods,
      patchState: patch,
    } = await import('@ngrx/signals');
    const TravelStore = signalStore(
      { providedIn: 'root' },
      withState({ query: '', saved: [] as string[] }),
      withComputed(({ saved }) => ({ savedCount: computed(() => saved().length) })),
      withMethods((store) => ({
        setQuery(query: string) {
          patch(store, { query });
        },
      })),
    );
    const injector = Injector.create({ providers: [TravelStore] });
    const store = injector.get(TravelStore);
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    const node = { get: () => null };
    const ng = {
      getInjector: () => node,
      getComponent: (el: Element) => (el === root ? { store } : null),
      ɵgetInjectorResolutionPath: () => [node, injector],
      ɵgetInjectorProviders: () => [],
    };
    const collector = createNgrxCollector(
      () => ng as any,
      () => {},
    );
    const [info] = collector.collect().stores;
    expect(info).toMatchObject({
      className: 'SignalStore',
      stateKeys: ['query', 'saved'],
      state: { query: '', saved: [] },
      computed: { savedCount: 0 },
      methods: [{ name: 'setQuery', calls: 0 }],
      references: ['Object.store'],
    });
    store.setQuery('rome');
    store.setQuery('oslo');
    expect(collector.logSince(0).map((e) => e.type)).toEqual(['setQuery', 'setQuery']);
    expect(collector.run({ type: 'restore', seq: 1 }).ok).toBe(true);
    expect(store.query()).toBe('rome');
  });

  it('restores without notifying watchState listeners and says so', async () => {
    await import('@angular/compiler');
    const { Injector } = await import('@angular/core');
    const {
      signalStore,
      withState,
      withMethods,
      watchState,
      patchState: patch,
    } = await import('@ngrx/signals');
    const Store = signalStore(
      withState({ query: '' }),
      withMethods((store) => ({
        setQuery(query: string) {
          patch(store, { query });
        },
      })),
    );
    const injector = Injector.create({ providers: [Store] });
    const store = injector.get(Store);
    const seen: string[] = [];
    watchState(store, (state) => seen.push(state.query), { injector });
    const collector = realCollector(store);
    collector.collect();
    store.setQuery('rome');
    store.setQuery('oslo');
    const original = WeakMap.prototype.get;
    const result = collector.run({ type: 'restore', seq: 1 });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/watchState listeners were not notified/);
    expect(store.query()).toBe('rome');
    expect(seen).toEqual(['', 'rome', 'oslo']);
    expect(collector.logSince(2)[0].type).toMatch(/watchState listeners not notified/);
    expect(WeakMap.prototype.get).toBe(original);
  });

  it('notifies watchState listeners on restore once the app registers patchState', async () => {
    await import('@angular/compiler');
    const { Injector } = await import('@angular/core');
    const { signalStore, withState, withMethods, watchState, patchState } =
      await import('@ngrx/signals');
    const { registerNgrxSignals } = await import('../ngrx-register.ts');
    const Store = signalStore(
      withState({ query: '' }),
      withMethods((store) => ({
        setQuery(query: string) {
          patchState(store, { query });
        },
      })),
    );
    const injector = Injector.create({ providers: [Store] });
    const store = injector.get(Store);
    const seen: string[] = [];
    watchState(store, (state) => seen.push(state.query), { injector });
    const collector = realCollector(store);
    collector.collect();
    store.setQuery('rome');
    store.setQuery('oslo');
    registerNgrxSignals({ patchState });
    try {
      const result = collector.run({ type: 'restore', seq: 1 });
      expect(result.ok).toBe(true);
      expect(result.message).not.toMatch(/not notified/);
      expect(store.query()).toBe('rome');
      expect(seen).toEqual(['', 'rome', 'oslo', 'rome']);
      expect(collector.logSince(2)[0].type).toBe('Restore #1');
    } finally {
      delete (globalThis as Record<string, unknown>)['__NG_DEVTOOLS_NGRX_SIGNALS__'];
    }
  });

  it('finds a component-scoped store and a signalState field through the debug API', async () => {
    const TestBed = await testBed();
    const { Component, inject } = await import('@angular/core');
    const { signalStore, signalState, withState, withMethods, patchState } =
      await import('@ngrx/signals');
    const PackingStore = signalStore(
      withState({ items: ['passport'] }),
      withMethods((store) => ({
        add(item: string) {
          patchState(store, (state) => ({ items: [...state.items, item] }));
        },
      })),
    );
    class Packing {
      store = inject(PackingStore);
      view = signalState({ hidePacked: false });
    }
    Component({ selector: 'app-packing', template: '', providers: [PackingStore] })(Packing);
    const fixture = TestBed.createComponent(Packing);
    document.body.replaceChildren(fixture.nativeElement);
    const collector = createNgrxCollector(
      () => (globalThis as { ng?: any }).ng,
      () => {},
    );
    expect(
      collector.collect().stores.map((s) => [s.className, s.kind, s.scope, s.references]),
    ).toEqual([
      ['SignalStore', 'signal-store', 'Packing (component)', ['Packing.store']],
      ['signalState', 'signal-state', 'Packing (field)', ['Packing.view']],
    ]);
    fixture.componentInstance.store.add('charger');
    patchState(fixture.componentInstance.view, { hidePacked: true });
    await Promise.resolve();
    expect(collector.logSince(0).map((e) => [e.type, e.diff])).toEqual([
      ['add', [{ path: 'items[1]', op: 'add', after: 'charger' }]],
      ['patchState', [{ path: 'hidePacked', op: 'change', before: false, after: true }]],
    ]);
    fixture.destroy();
    fixture.nativeElement.remove();
    expect(collector.collect().stores).toEqual([]);
  });

  it('does not add reactive dependencies when a method runs inside a computed', async () => {
    await import('@angular/compiler');
    const { Injector, computed } = await import('@angular/core');
    const {
      signalStore,
      withState,
      withLinkedState,
      withMethods,
      patchState: patch,
    } = await import('@ngrx/signals');
    const Store = signalStore(
      withState({ base: 1 }),
      withLinkedState(({ base }) => ({ doubled: () => base() * 2 })),
      withMethods((store) => ({
        ping() {},
        bump() {
          patch(store, { base: store.base() + 1 });
        },
      })),
    );
    const store = Injector.create({ providers: [Store] }).get(Store);
    const collector = realCollector(store);
    collector.collect();
    let runs = 0;
    const outer = computed(() => {
      runs++;
      store.ping();
      return runs;
    });
    outer();
    store.bump();
    outer();
    expect(store.doubled()).toBe(4);
    expect(runs).toBe(1);
  });
});

function realCollector(store: object) {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const node = { get: () => null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? { store } : null),
    ɵgetInjectorResolutionPath: () => [node],
    ɵgetInjectorProviders: () => [],
  };
  return createNgrxCollector(
    () => ng as any,
    () => {},
  );
}

let testBedReady = false;

async function testBed() {
  await import('@angular/compiler');
  const { TestBed } = await import('@angular/core/testing');
  if (!testBedReady) {
    const { BrowserTestingModule, platformBrowserTesting } =
      await import('@angular/platform-browser/testing');
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    testBedReady = true;
  }
  TestBed.resetTestingModule();
  return TestBed;
}

describe('ngrx collector with @ngrx/store', () => {
  async function realStore(
    options: {
      devtools?: { maxAge?: number; actionsBlocklist?: string[] };
      hide?: string[];
      store?: boolean;
    } = {},
  ) {
    const TestBed = await testBed();
    const { EnvironmentInjector } = await import('@angular/core');
    const { Store, createAction, createReducer, on, props, provideStore } =
      await import('@ngrx/store');
    const { provideStoreDevtools } = await import('@ngrx/store-devtools');
    const add = createAction('[Counter] Add', props<{ by: number }>());
    const reducer = createReducer(
      0,
      on(add, (n, { by }) => n + by),
    );
    TestBed.configureTestingModule({
      providers: [
        ...(options.store === false ? [] : [provideStore({ count: reducer })]),
        ...(options.devtools ? [provideStoreDevtools(options.devtools)] : []),
      ],
    });
    const env = TestBed.inject(EnvironmentInjector) as unknown as {
      records: Map<unknown, unknown>;
      scopes: Set<string>;
      get(token: unknown, fallback?: unknown): unknown;
    };
    const hide = new Set(options.hide ?? []);
    const view = hide.size
      ? {
          scopes: env.scopes,
          records: new Map(
            [...env.records].filter(
              ([token]) => !hide.has((token as { name?: string })?.name ?? ''),
            ),
          ),
        }
      : env;
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    const node = { get: (token: unknown, fallback?: unknown) => env.get(token, fallback) };
    const ng = {
      getInjector: () => node,
      getComponent: (el: Element) => (el === root ? {} : null),
      ɵgetInjectorResolutionPath: () => [node, view],
      ɵgetInjectorProviders: vi.fn((_injector: unknown) => [] as { token: unknown }[]),
    };
    const collector = createNgrxCollector(
      () => ng as any,
      () => {},
    );
    const store = options.store === false ? null : TestBed.inject(Store);
    return { TestBed, Store, store: store!, collector, add, ng, view };
  }

  it('finds the Store by class name and logs actions with a diff and their origin', async () => {
    const { TestBed, Store, store, collector, add } = await realStore();
    expect(collector.collect().classic).toEqual({
      state: { count: 0 },
      devtools: false,
      scope: 'root',
    });
    store.dispatch(add({ by: 2 }));
    store.next(add({ by: 3 }));
    const by = signal(4);
    store.dispatch(() => add({ by: by() }));
    TestBed.tick();
    expect(collector.logSince(0).map((e) => [e.type, e.origin, e.diff])).toEqual([
      ['[Counter] Add', 'dispatch', [{ path: 'count', op: 'change', before: 0, after: 2 }]],
      ['[Counter] Add', 'effect', [{ path: 'count', op: 'change', before: 2, after: 5 }]],
      ['[Counter] Add', 'reactive', [{ path: 'count', op: 'change', before: 5, after: 9 }]],
    ]);
    expect(collector.logSince(0)[0]).toMatchObject({
      source: 'store',
      action: { type: '[Counter] Add', by: 2 },
      restorable: false,
    });
    expect(collector.run({ type: 'restore', seq: 1 }).error).toMatch(/provideStoreDevtools/);
    collector.stop();
    expect(Object.hasOwn(store, 'dispatch')).toBe(false);
    expect(store.dispatch).toBe(Store.prototype.dispatch);
  });

  it('restores through Store DevTools and keeps logging actions while paused', async () => {
    const { store, collector, add } = await realStore({ devtools: {} });
    expect(collector.collect().classic).toMatchObject({ devtools: true });
    store.dispatch(add({ by: 1 }));
    store.dispatch(add({ by: 10 }));
    store.dispatch(add({ by: 100 }));
    const result = collector.run({ type: 'restore', seq: 1 });
    expect(result).toMatchObject({ ok: true });
    expect(result.message).toMatch(/paused/);
    expect(collector.collect().classic).toMatchObject({ state: { count: 1 }, paused: true });
    expect(collector.logSince(3)[0]).toMatchObject({
      type: 'Restore #1',
      diff: [{ path: 'count', op: 'change', before: 111, after: 1 }],
    });
    store.dispatch(add({ by: 1000 }));
    expect(collector.logSince(4)).toMatchObject([{ type: '[Counter] Add', diff: [] }]);
    expect(collector.collect().classic).toMatchObject({ state: { count: 1 } });
    expect(collector.run({ type: 'latest' })).toMatchObject({ ok: true });
    expect(collector.collect().classic).toEqual({
      state: { count: 1111 },
      devtools: true,
      scope: 'root',
    });
    expect(collector.run({ type: 'restore', seq: 3 })).toMatchObject({ ok: true });
    expect(collector.collect().classic).toMatchObject({ state: { count: 111 }, paused: true });
  });

  it('says so when Store DevTools dropped the action past maxAge', async () => {
    const { store, collector, add } = await realStore({ devtools: { maxAge: 3 } });
    collector.collect();
    for (let i = 0; i < 5; i++) store.dispatch(add({ by: 1 }));
    expect(collector.run({ type: 'restore', seq: 1 }).error).toMatch(
      /no longer holds this action.*maxAge/,
    );
    expect(collector.logSince(0)[0]).toMatchObject({ restorable: false, unrestorable: 'dropped' });
    expect(collector.run({ type: 'restore', seq: 5 })).toMatchObject({ ok: true });
  });

  it('does not blame maxAge when the Store DevTools history was committed', async () => {
    const { TestBed, store, collector, add } = await realStore({ devtools: { maxAge: 25 } });
    const { StoreDevtools } = await import('@ngrx/store-devtools');
    collector.collect();
    store.dispatch(add({ by: 1 }));
    TestBed.inject(StoreDevtools).commit();
    collector.collect();
    expect(collector.logSince(0)[0]).toMatchObject({ restorable: false, unrestorable: 'dropped' });
    const error = collector.run({ type: 'restore', seq: 1 }).error;
    expect(error).toMatch(/no longer holds this action/);
    expect(error).toMatch(/committed, reset or imported/);
  });

  it('marks the actions Store DevTools dropped past maxAge as not restorable', async () => {
    const { store, collector, add } = await realStore({ devtools: { maxAge: 3 } });
    collector.collect();
    for (let i = 0; i < 5; i++) store.dispatch(add({ by: 1 }));
    expect(collector.logSince(0).every((e) => e.restorable)).toBe(true);
    collector.collect();
    expect(collector.logSince(0).map((e) => [e.seq, e.restorable, e.unrestorable])).toEqual([
      [1, false, 'dropped'],
      [2, false, 'dropped'],
      [3, false, 'dropped'],
      [4, true, undefined],
      [5, true, undefined],
    ]);
    const first = collector.unrestorableSince(0);
    expect(first.updates).toEqual([1, 2, 3].map((seq) => ({ seq, reason: 'dropped' })));
    store.dispatch(add({ by: 1 }));
    collector.collect();
    expect(collector.unrestorableSince(first.last).updates).toEqual([
      { seq: 4, reason: 'dropped' },
    ]);
    expect(collector.run({ type: 'restore', seq: 2 }).error).toMatch(/no longer holds this action/);
  });

  it('marks an action Store DevTools never recorded as not restorable', async () => {
    const { store, collector, add } = await realStore({
      devtools: { actionsBlocklist: ['Skip'] },
    });
    collector.collect();
    store.dispatch(add({ by: 1 }));
    store.dispatch({ type: '[Counter] Skip' });
    collector.collect();
    expect(collector.logSince(0).map((e) => [e.type, e.restorable, e.unrestorable])).toEqual([
      ['[Counter] Add', true, undefined],
      ['[Counter] Skip', false, 'not-recorded'],
    ]);
    expect(collector.unrestorableSince(0).updates).toEqual([]);
    expect(collector.run({ type: 'restore', seq: 2 }).error).toMatch(
      /never recorded this action.*actionsBlocklist/,
    );
  });

  it('dispatches an action with a payload and returns its log entry', async () => {
    const { store, collector } = await realStore();
    collector.collect();
    const result = collector.run({
      type: 'dispatch',
      action: '[Counter] Add',
      payload: { by: 5 },
    });
    expect(result).toMatchObject({
      ok: true,
      message: 'Dispatched [Counter] Add as #1.',
      entry: {
        seq: 1,
        type: '[Counter] Add',
        action: { type: '[Counter] Add', by: 5 },
        origin: 'dispatch',
        diff: [{ path: 'count', op: 'change', before: 0, after: 5 }],
      },
    });
    let count: unknown;
    store.select('count').subscribe((value) => (count = value));
    expect(count).toBe(5);
    const again = collector.run({ type: 'dispatch-again', seq: 1 });
    expect(again).toMatchObject({ ok: true, entry: { seq: 2, action: { by: 5 } } });
    expect(count).toBe(10);
    expect(collector.run({ type: 'dispatch-again', seq: 9 }).error).toMatch(/no longer/);
  });

  it('refuses a dispatch with a bad type or payload, or without a Store', async () => {
    const { collector } = await realStore();
    collector.collect();
    const bad = (action: unknown, payload?: unknown) =>
      collector.run({ type: 'dispatch', action, payload } as never).error;
    expect(bad('')).toMatch(/non-empty string/);
    expect(bad(7)).toMatch(/non-empty string/);
    expect(bad('x'.repeat(201))).toMatch(/longer than 200/);
    expect(bad('[A]\nB')).toMatch(/control characters/);
    expect(bad('[A] B', [1])).toMatch(/JSON object/);
    expect(bad('[A] B', { type: 'other' })).toMatch(/"type" key/);
    expect(bad('[A] B', { big: 'x'.repeat(20_001) })).toMatch(/larger than/);
    expect(collector.logSince(0)).toEqual([]);
    const none = await realStore({ store: false });
    none.collector.collect();
    expect(none.collector.run({ type: 'dispatch', action: '[A] B' }).error).toMatch(
      /No @ngrx\/store Store/,
    );
  });

  it('does not dispatch a restore entry again and notes a paused store', async () => {
    const { store, collector, add } = await realStore({ devtools: {} });
    collector.collect();
    store.dispatch(add({ by: 1 }));
    store.dispatch(add({ by: 2 }));
    collector.run({ type: 'restore', seq: 1 });
    expect(collector.run({ type: 'dispatch-again', seq: 3 }).error).toMatch(
      /Only an @ngrx\/store action/,
    );
    const result = collector.run({ type: 'dispatch', action: '[Counter] Add', payload: { by: 5 } });
    expect(result.message).toMatch(/as #4\. The store is paused/);
  });

  it('falls back to ActionsSubject when ScannedActionsSubject is not found', async () => {
    const { store, collector, add } = await realStore({ hide: ['ScannedActionsSubject'] });
    expect(collector.collect().classic).toMatchObject({ state: { count: 0 } });
    store.dispatch(add({ by: 2 }));
    expect(collector.logSince(0)).toEqual([]);
    await Promise.resolve();
    expect(collector.logSince(0)).toMatchObject([
      {
        type: '[Counter] Add',
        origin: 'dispatch',
        diff: [{ path: 'count', op: 'change', before: 0, after: 2 }],
      },
    ]);
  });

  it('stops looking for the Store after five misses', async () => {
    const { collector, ng, view } = await realStore({ store: false });
    for (let i = 0; i < 8; i++) expect(collector.collect().classic).toBeNull();
    const lookups = ng.ɵgetInjectorProviders.mock.calls.filter(([injector]) => injector === view);
    expect(lookups).toHaveLength(5);
  });
});
