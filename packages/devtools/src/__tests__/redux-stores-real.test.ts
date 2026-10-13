// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Injectable } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installReduxDevtoolsHook,
  uninstallReduxDevtoolsHook,
  type ReduxDevtoolsHook,
} from '../redux-devtools-hook.ts';
import { createReduxStoresCollector } from '../redux-stores-collector.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

// NGXS 22 needs Angular 22; the compat runs on older Angular skip it. Elf and
// MiniRx are plain RxJS and run everywhere.
const realNgxs = angularAtLeast('22.0');
const HOOK_KEY = Symbol.for('pangular.redux-devtools-hook');

let hook: ReduxDevtoolsHook;

beforeEach(() => {
  hook = installReduxDevtoolsHook(window as never)!;
});

afterEach(() => {
  uninstallReduxDevtoolsHook(window as never);
  delete (window as never as Record<symbol, unknown>)[HOOK_KEY];
  document.body.innerHTML = '';
});

describe('stores that report through their Redux DevTools integration', () => {
  it('reads an Elf store through devTools() from @ngneat/elf-devtools', async () => {
    const { createStore, withProps } = await import('@ngneat/elf');
    const { devTools } = await import('@ngneat/elf-devtools');
    const trips = createStore(
      { name: 'trips' },
      withProps<{ booked: number[]; apiToken: string }>({ booked: [], apiToken: 'abc' }),
    );
    const devtools = devTools({ name: 'Travel' });
    trips.update((state) => ({ ...state, booked: [7] }));

    const collector = createReduxStoresCollector(hook, 200);
    collector.read();
    const [store] = collector.stores();
    expect(store).toMatchObject({ name: 'Travel', library: 'Elf' });
    expect(store.state).toEqual({ trips: { booked: [7], apiToken: '[redacted]' } });
    const log = collector.logSince(0);
    expect(log.map((entry) => entry.type)).toEqual(['[Trips] - @Init', '[Trips] - Update']);
    expect(log[1].diff).toEqual([{ path: 'trips.booked[0]', op: 'add', after: 7 }]);
    devtools?.unsubscribe();
    expect(collector.stores()).toEqual([]);
  });

  it('reads a MiniRx store through its ReduxDevtoolsExtension', async () => {
    const { configureStore, ReduxDevtoolsExtension } = await import('mini-rx-store');
    const counter = (state = { count: 0 }, action: { type: string }) =>
      action.type === 'increment' ? { count: state.count + 1 } : state;
    const store = configureStore({
      reducers: { counter },
      extensions: [new ReduxDevtoolsExtension({ name: 'MiniRx Travel' })],
    });
    store.dispatch({ type: 'increment' });

    const collector = createReduxStoresCollector(hook, 200);
    collector.read();
    const [info] = collector.stores();
    expect(info).toMatchObject({ name: 'MiniRx Travel', library: 'MiniRx' });
    expect(info.state).toEqual({ counter: { count: 1 } });
    const log = collector.logSince(0);
    const increment = log.find((entry) => entry.type === 'increment');
    expect(increment?.action).toEqual({ type: 'increment' });
    expect(increment?.diff).toEqual([{ path: 'counter.count', op: 'change', before: 0, after: 1 }]);
  });

  it.runIf(realNgxs)('reads NGXS through withNgxsReduxDevtoolsPlugin()', async () => {
    const { provideStore, State, Action, Store } = await import('@ngxs/store');
    const { withNgxsReduxDevtoolsPlugin } = await import('@ngxs/devtools-plugin');

    class BookTrip {
      static readonly type = '[Trips] Book';
      constructor(
        readonly id: number,
        readonly password: string,
      ) {}
    }
    class TripsState {
      book(
        ctx: { getState(): { booked: number[] }; setState(value: unknown): void },
        action: BookTrip,
      ) {
        ctx.setState({ booked: [...ctx.getState().booked, action.id] });
      }
    }
    State({ name: 'trips', defaults: { booked: [] } })(TripsState);
    Injectable()(TripsState);
    Action(BookTrip)(TripsState.prototype, 'book', {} as never);

    class TripsPage {}
    Component({ ...STANDALONE, selector: 'app-root', template: 'trips' })(TripsPage);
    document.body.innerHTML = '<app-root></app-root>';
    let app: BootedApp | null = null;
    try {
      app = await bootstrapRoot(TripsPage, {
        providers: [provideStore([TripsState], withNgxsReduxDevtoolsPlugin())],
      });
      app.injector.get(Store).dispatch(new BookTrip(7, 'hunter2'));

      const collector = createReduxStoresCollector(hook, 200);
      collector.read();
      const [store] = collector.stores();
      expect(store).toMatchObject({ name: 'NGXS', library: 'NGXS' });
      expect(store.state).toEqual({ trips: { booked: [7] } });
      const log = collector.logSince(0);
      expect(log[0]).toMatchObject({ type: '@@INIT', diff: [] });
      const book = log.find((entry) => entry.type === '[Trips] Book');
      expect(book?.action).toMatchObject({ type: '[Trips] Book', id: 7, password: '[redacted]' });
      expect(book?.diff).toEqual([{ path: 'trips.booked[0]', op: 'add', after: 7 }]);
    } finally {
      app?.destroy();
    }
  });
});
