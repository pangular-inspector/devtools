// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { generateTest, parseSession, sessionStates, type NgrxSession } from '../ngrx-session.ts';
import { angularAtLeast } from './angular-version.ts';

/** @ngrx 22 loads on Angular 19.0 and later; older versions keep the fake-ng tests. */
const realNgrx = angularAtLeast('19.0');

let testBedReady = false;

async function testBed() {
  await import('@angular/compiler');
  const { TestBed } = await import('@angular/core/testing');
  if (!testBedReady) {
    const { initAngularTestBed } = await import('./angular-version.ts');
    initAngularTestBed();
    testBedReady = true;
  }
  TestBed.resetTestingModule();
  return TestBed;
}

function exported(result: { session?: NgrxSession; error?: string }): NgrxSession {
  if (!result.session) throw new Error(result.error ?? 'no session');
  // What a file round trip does: JSON out, checked JSON in.
  const parsed = parseSession(JSON.stringify(result.session));
  if (typeof parsed === 'string') throw new Error(parsed);
  return parsed;
}

describe.runIf(realNgrx)('ngrx history with a real @ngrx/store', () => {
  async function realStore(devtools: boolean) {
    const TestBed = await testBed();
    const { EnvironmentInjector } = await import('@angular/core');
    const { Store, createAction, createReducer, on, props, provideStore, combineReducers } =
      await import('@ngrx/store');
    const { provideStoreDevtools } = await import('@ngrx/store-devtools');
    const addItem = createAction('[Cart] Add Item', props<{ item: string }>());
    const clear = createAction('[Cart] Clear');
    const login = createAction('[Auth] Login', props<{ user: string; password: string }>());
    const cartReducer = createReducer(
      { items: [] as string[] },
      on(addItem, (state, { item }) => ({ items: [...state.items, item] })),
      on(clear, () => ({ items: [] })),
    );
    const authReducer = createReducer(
      { user: null as string | null, password: '' },
      on(login, (_state, { user, password }) => ({ user, password })),
    );
    const reducers = { cart: cartReducer, auth: authReducer };
    TestBed.configureTestingModule({
      providers: [provideStore(reducers), ...(devtools ? [provideStoreDevtools({})] : [])],
    });
    const env = TestBed.inject(EnvironmentInjector) as unknown as {
      get(token: unknown, fallback?: unknown): unknown;
    };
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    const node = { get: (token: unknown, fallback?: unknown) => env.get(token, fallback) };
    const ng = {
      getInjector: () => node,
      getComponent: (el: Element) => (el === root ? {} : null),
      ɵgetInjectorResolutionPath: () => [node, env],
      ɵgetInjectorProviders: () => [],
    };
    const collector = createNgrxCollector(
      () => ng as never,
      () => {},
    );
    collector.collect();
    const store = TestBed.inject(Store);
    return { store, collector, addItem, clear, login, cartReducer, combineReducers, reducers };
  }

  it('shows the state before and after any past action, redacted', async () => {
    const { store, collector, addItem, login } = await realStore(false);
    store.dispatch(addItem({ item: 'rome' }));
    store.dispatch(login({ user: 'ada', password: 'hunter2' }));
    store.dispatch(addItem({ item: 'oslo' }));
    const first = collector.run({ type: 'entry', seq: 1 }).detail!;
    // A secret-looking key is masked whatever it holds.
    const auth = { user: null, password: '[redacted]' };
    expect(first.before).toEqual({ cart: { items: [] }, auth });
    expect(first.after).toEqual({ cart: { items: ['rome'] }, auth });
    const second = collector.run({ type: 'entry', seq: 2 }).detail!;
    expect(second.after).toEqual({
      cart: { items: ['rome'] },
      auth: { user: 'ada', password: '[redacted]' },
    });
    expect(JSON.stringify(second)).not.toContain('hunter2');
    expect(second.diff.map((d) => d.path)).toEqual(['auth.user']);
  });

  it('exports a session whose replay through the real reducer reaches the recorded state', async () => {
    const { store, collector, addItem, clear, cartReducer } = await realStore(false);
    store.dispatch(addItem({ item: 'rome' }));
    store.dispatch(addItem({ item: 'oslo' }));
    store.dispatch(clear());
    store.dispatch(addItem({ item: 'lima' }));
    const session = exported(collector.run({ type: 'export', from: 2 }));
    expect(session.store).toEqual({ id: 'store', kind: 'store', name: 'Store' });
    expect(session.entries.map((e) => e.type)).toEqual([
      '[Cart] Add Item',
      '[Cart] Clear',
      '[Cart] Add Item',
    ]);
    // Each entry keeps only what it changed, not a copy of the state.
    expect(session.entries[0].changes).toEqual([
      { op: 'set', path: ['cart', 'items'], value: ['rome', 'oslo'] },
    ]);
    const states = sessionStates(session);
    let live: { cart: unknown } | undefined;
    store.subscribe((state) => (live = state as { cart: unknown })).unsubscribe();
    expect(states.at(-1)).toEqual({ ...live, auth: { user: null, password: '[redacted]' } });

    // What the generated feature reducer spec does, run against the app's own reducer.
    const test = generateTest(session);
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).toContain("import { cartReducer } from './cart.reducer';");
    const initial = (session.initialState as { cart: { items: string[] } }).cart;
    const replayed = session.entries.reduce(
      (state, entry) => cartReducer(state, entry.action as never),
      initial,
    );
    expect(replayed).toEqual((states.at(-1) as { cart: unknown }).cart);
  });

  it('replays a root session through combineReducers when several features changed', async () => {
    const { store, collector, addItem, login, combineReducers, reducers } = await realStore(true);
    store.dispatch(addItem({ item: 'rome' }));
    store.dispatch(login({ user: 'ada', password: 'x' }));
    const session = exported(collector.run({ type: 'export' }));
    const test = generateTest(session);
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).toContain('combineReducers(reducers)');
    expect(test.notes.join(' ')).toMatch(/redacted/);
    const reducer = combineReducers(reducers);
    let replayed: unknown = session.initialState;
    for (const entry of session.entries)
      replayed = reducer(replayed as never, entry.action as never);
    // The password was redacted in the recording, so only the rest is compared.
    expect(replayed).toMatchObject({ cart: { items: ['rome'] }, auth: { user: 'ada' } });
  });
});

describe.runIf(realNgrx)('ngrx history with a real @ngrx/signals store', () => {
  it('exports method calls whose replay on a fresh store reaches the recorded state', async () => {
    await import('@angular/compiler');
    const { Injector, computed } = await import('@angular/core');
    const { signalStore, withState, withComputed, withMethods, patchState, getState } =
      await import('@ngrx/signals');
    const { unprotected } = await import('@ngrx/signals/testing');
    const TripStore = signalStore(
      { providedIn: 'root' },
      withState({ query: '', saved: [] as string[] }),
      withComputed(({ saved }) => ({ savedCount: computed(() => saved().length) })),
      withMethods((store) => ({
        setQuery(query: string) {
          patchState(store, { query });
        },
        save(id: string) {
          patchState(store, { saved: [...store.saved(), id] });
        },
      })),
    );
    const injector = Injector.create({ providers: [TripStore] });
    const store = injector.get(TripStore);
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
      () => ng as never,
      () => {},
    );
    const [info] = collector.collect().stores;
    store.setQuery('rome');
    store.save('r1');
    store.save('r2');
    const detail = collector.run({ type: 'entry', seq: 2 }).detail!;
    expect(detail.before).toEqual({ query: 'rome', saved: [] });
    expect(detail.after).toEqual({ query: 'rome', saved: ['r1'] });

    const session = exported(collector.run({ type: 'export', storeId: info.id }));
    expect(session.store.kind).toBe('signal-store');
    const test = generateTest({ ...session, store: { ...session.store, name: 'TripStore' } });
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).toContain('store.setQuery("rome");');
    expect(test.code).toContain('store.save("r2");');

    // What the generated spec does, on a fresh instance.
    const fresh = Injector.create({ providers: [TripStore] }).get(TripStore);
    patchState(unprotected(fresh), session.initialState as never);
    for (const entry of session.entries) {
      (fresh as unknown as Record<string, (...args: unknown[]) => void>)[entry.type](
        ...(entry.args ?? []),
      );
    }
    expect(getState(fresh)).toEqual(sessionStates(session).at(-1));
    expect(getState(fresh)).toEqual(getState(store));
  });
});
