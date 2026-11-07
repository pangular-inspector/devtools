// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { devtoolsProblem } from '../ngrx-shared.ts';
import { angularAtLeast } from './angular-version.ts';

/** @ngrx 22 loads on Angular 19.0 and later. */
const realNgrx = angularAtLeast('19.0');

let testBedReady = false;

async function realStore(devtools = true) {
  await import('@angular/compiler');
  const { TestBed } = await import('@angular/core/testing');
  if (!testBedReady) {
    const { initAngularTestBed } = await import('./angular-version.ts');
    initAngularTestBed();
    testBedReady = true;
  }
  TestBed.resetTestingModule();
  const { EnvironmentInjector } = await import('@angular/core');
  const { Store, createAction, createReducer, on, props, provideStore } =
    await import('@ngrx/store');
  const { provideStoreDevtools } = await import('@ngrx/store-devtools');
  const add = createAction('[Cart] Add', props<{ item: string }>());
  const cart = createReducer(
    { items: [] as string[] },
    on(add, (state, { item }) => ({ items: [...state.items, item] })),
  );
  TestBed.configureTestingModule({
    providers: [provideStore({ cart }), ...(devtools ? [provideStoreDevtools({})] : [])],
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
  const items = () =>
    (collector.collect().classic!.state as { cart: { items: string[] } }).cart.items;
  return { store, collector, add, items };
}

describe('devtoolsProblem', () => {
  it('checks the operation and its fields', () => {
    expect(devtoolsProblem({ op: 'commit' })).toBeNull();
    expect(devtoolsProblem({ op: 'nope' as never })).toMatch(/one of/);
    expect(devtoolsProblem({ op: 'toggle' })).toMatch(/seq/);
    expect(devtoolsProblem({ op: 'jump' })).toMatch(/either/);
    expect(devtoolsProblem({ op: 'jump', seq: 1, index: 0 })).toMatch(/either/);
    expect(devtoolsProblem({ op: 'jump', index: -1 })).toMatch(/whole/);
    expect(devtoolsProblem({ op: 'pause', paused: 'yes' as never })).toMatch(/true or false/);
  });
});

describe.runIf(realNgrx)('Store DevTools history operations', () => {
  it('needs provideStoreDevtools()', async () => {
    const { collector } = await realStore(false);
    expect(collector.run({ type: 'devtools', op: 'commit' }).error).toMatch(/provideStoreDevtools/);
  });

  it('skips and includes an action again', async () => {
    const { store, collector, add, items } = await realStore();
    store.dispatch(add({ item: 'rome' }));
    store.dispatch(add({ item: 'oslo' }));
    const skip = collector.run({ type: 'devtools', op: 'toggle', seq: 1 });
    expect(skip).toMatchObject({ ok: true });
    expect(skip.message).toMatch(/Skipped action #1/);
    expect(items()).toEqual(['oslo']);
    expect(collector.collect().classic!.skipped).toEqual([1]);
    expect(collector.logSince(0).at(-1)!.type).toBe('Store DevTools: skip #1');
    const include = collector.run({ type: 'devtools', op: 'toggle', seq: 1 });
    expect(include.message).toMatch(/Included/);
    expect(items()).toEqual(['rome', 'oslo']);
    expect(collector.collect().classic!.skipped).toBeUndefined();
    // Only the app's own actions count in the stats.
    expect(collector.stats().stats.map((s) => s.type)).toEqual(['[Cart] Add']);
  });

  it('jumps to a Store DevTools state by index and by log entry', async () => {
    const { store, collector, add, items } = await realStore();
    store.dispatch(add({ item: 'rome' }));
    store.dispatch(add({ item: 'oslo' }));
    expect(collector.run({ type: 'devtools', op: 'jump', index: 0 })).toMatchObject({
      ok: true,
      paused: true,
    });
    expect(items()).toEqual([]);
    expect(collector.run({ type: 'devtools', op: 'jump', seq: 1 }).ok).toBe(true);
    expect(items()).toEqual(['rome']);
    expect(collector.run({ type: 'devtools', op: 'jump', index: 9 }).error).toMatch(/holds 3/);
  });

  it('commits and resets, and the earlier entries can no longer be restored', async () => {
    const { store, collector, add, items } = await realStore();
    store.dispatch(add({ item: 'rome' }));
    expect(collector.run({ type: 'devtools', op: 'commit' }).ok).toBe(true);
    expect(items()).toEqual(['rome']);
    expect(collector.logSince(0)[0]).toMatchObject({ restorable: false, unrestorable: 'dropped' });
    store.dispatch(add({ item: 'oslo' }));
    expect(collector.run({ type: 'devtools', op: 'reset' }).ok).toBe(true);
    expect(items()).toEqual([]);
    const restore = collector.run({ type: 'restore', seq: 3 });
    expect(restore.error).toMatch(/no longer holds/);
  });

  it('pauses and resumes recording', async () => {
    const { store, collector, add } = await realStore();
    const paused = collector.run({ type: 'devtools', op: 'pause' });
    expect(paused.message).toMatch(/Recording paused/);
    expect(collector.collect().classic!.recordingPaused).toBe(true);
    store.dispatch(add({ item: 'rome' }));
    expect(collector.logSince(0).at(-1)).toMatchObject({ type: '[Cart] Add', restorable: false });
    expect(collector.run({ type: 'devtools', op: 'pause', paused: false }).message).toMatch(
      /Recording again/,
    );
    expect(collector.collect().classic!.recordingPaused).toBeUndefined();
  });
});
