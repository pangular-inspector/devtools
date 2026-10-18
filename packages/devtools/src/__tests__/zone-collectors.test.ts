// @vitest-environment jsdom
// Collectors under real zone.js and a real NgZone: an app event inside the
// Angular zone must not make the app tick again, and the zone must settle.
import 'zone.js';
import '@angular/compiler';
import { Component, NgZone, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { QueryClient } from '@tanstack/query-core';
import { afterEach, describe, expect, it } from 'vitest';
import { ANALOG_META_DESCRIPTION, attachAnalog } from '../analog-runtime.ts';
import { attachErrors } from '../errors-collector.ts';
import { attachForms } from '../forms-collector.ts';
import { attachNgrx } from '../ngrx-overlay.ts';
import {
  nextFrameOutside,
  outsideAngular,
  queueMicrotaskOutside,
  setIntervalOutside,
  setTimeoutOutside,
} from '../outside-angular.ts';
import { pangularPluginRegistry, type PangularPluginContext } from '../plugin.ts';
import { attachPlugins } from '../plugins-collector.ts';
import { attachTanstackQuery, type QueryDebugNg } from '../query-collector.ts';
import { resolvePangularConfig } from '../config.ts';
import { installReduxDevtoolsHook, REDUX_EXTENSION_KEY } from '../redux-devtools-hook.ts';
import { attachReduxStores } from '../redux-stores-collector.ts';
import type { HostTree } from '../host-tree.ts';
import { createSignalHistory, installSignalWriteHook } from '../signal-history.ts';
import { initAngularTestBed } from './angular-version.ts';

initAngularTestBed();

class Login {
  form = new FormGroup({ email: new FormControl('') });
}
Component({
  selector: 'login-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form"><input formControlName="email" /></form>`,
})(Login);

/**
 * A zone and a counter of app ticks. The tick subscription is the one
 * Angular's zone change detection scheduler makes: on `onMicrotaskEmpty` it
 * runs `appRef.tick()` inside the zone; `body` stands in for the tick.
 */
function zoneProbe(body: (tick: number) => void = () => {}) {
  const zone = new NgZone({ enableLongStackTrace: false });
  const probe = { zone, ticks: 0, running: false };
  zone.onMicrotaskEmpty.subscribe(() => {
    if (probe.running || probe.ticks >= 1000) return;
    probe.running = true;
    try {
      zone.run(() => body(++probe.ticks));
    } finally {
      probe.running = false;
    }
  });
  return probe;
}

const settle = (ms: number) =>
  outsideAngular(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

/** An RPC that answers every push as the server does when it knows the page. */
function fakeRpc() {
  const calls: string[] = [];
  return {
    calls,
    my: {
      rpc: {
        call: async (name: string) => {
          calls.push(name);
          return { known: true };
        },
        register: () => {},
      },
    },
  };
}

/** Runs `event` in the Angular zone with and without the collector, and compares ticks. */
async function compare(
  attach: () => (() => void) | void | Promise<(() => void) | void>,
  event: (tick: number) => void,
  options: { settleMs?: number; eventInTick?: boolean } = {},
) {
  const run = async (withCollector: boolean) => {
    const stop = withCollector ? await outsideAngular(attach) : undefined;
    // Let the pushes the attach started go out, so the event starts its own.
    if (withCollector) await settle(150);
    const probe = zoneProbe(options.eventInTick ? event : undefined);
    probe.zone.run(() => (options.eventInTick ? undefined : event(0)));
    await settle(options.settleMs ?? 400);
    stop?.();
    return { ticks: probe.ticks, stable: probe.zone.isStable };
  };
  const without = await run(false);
  const withCollector = await run(true);
  return { without, withCollector };
}

describe('collectors under zone.js', () => {
  it('signal history: a write during each tick does not loop', async () => {
    const value = signal(0, { debugName: 'count' });
    let writes = 0;
    const result = await compare(
      async () => {
        const history = createSignalHistory((v) => v);
        const restore = await installSignalWriteHook((node) => {
          writes++;
          history.onWrite(node);
        });
        return () => restore?.();
      },
      () => value.update((n) => n + 1),
      { eventInTick: true, settleMs: 100 },
    );
    expect(writes).toBeGreaterThan(0);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('errors: a console call in the zone adds no tick and keeps the zone stable', async () => {
    const original = console.debug;
    console.debug = () => {};
    stops.push(() => (console.debug = original));
    const my = { rpc: { call: async () => ({ known: true }) } };
    const result = await compare(
      () => attachErrors(my, 'page-1', () => undefined).stop,
      () => console.debug('hello'),
    );
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('redux-style stores: a store change adds no tick', async () => {
    const target: Record<PropertyKey, any> = {};
    installReduxDevtoolsHook(target);
    const devtools = target[REDUX_EXTENSION_KEY].connect({ name: 'Elf' });
    let n = 0;
    const { my, calls } = fakeRpc();
    const result = await compare(
      () => attachReduxStores(my, 'tab1', { maxLog: 50, target })?.stop,
      () => devtools.send({ type: `set ${++n}` }, { n }),
    );
    expect(calls).toContain('push-redux-stores');
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('TanStack Query: a cache change adds no tick', async () => {
    const queryClient = new QueryClient();
    queryClient.mount();
    stops.push(() => queryClient.unmount());
    interface Host {
      children: Host[];
      injector: object;
      component: object;
    }
    const env = {
      records: new Map([
        [class QueryClient {}, { factory: () => queryClient, value: queryClient }],
      ]),
      scopes: new Set(['root']),
      destroyed: false,
    };
    const root: Host = { children: [], injector: {}, component: {} };
    const tree: HostTree<Host> = {
      roots: () => [root],
      children: (host) => host.children,
      parent: () => null,
      tag: () => 'app-root',
      connected: () => true,
      isHost: (value): value is Host => value === root,
    };
    const ng: QueryDebugNg<Host> = {
      getComponent: (host) => host.component,
      getInjector: (host) => host.injector,
      ɵgetInjectorResolutionPath: () => [root.injector, env],
    };
    const { my, calls } = fakeRpc();
    let n = 0;
    const result = await compare(
      async () => {
        const queries = attachTanstackQuery(my, 'tab1', () => ng, { tree, allowWrites: false });
        await queries.push();
        return queries.stop;
      },
      () => queryClient.setQueryData(['trips'], ++n),
    );
    expect(calls.filter((c) => c === 'push-tanstack-query').length).toBeGreaterThan(1);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('plugins: ctx.push from app code adds no tick', async () => {
    const target = {};
    let ctx: PangularPluginContext | undefined;
    pangularPluginRegistry(target).plugins.push({
      id: 'zone',
      version: '1.0.0',
      setup: (context) => void (ctx = context),
    });
    const { my, calls } = fakeRpc();
    let n = 0;
    const result = await compare(
      async () => {
        const plugins = attachPlugins(my, 'tab1', () => undefined, {
          config: resolvePangularConfig(),
          target,
        });
        await plugins.push(true);
        return plugins.stop;
      },
      () => ctx?.push({ summary: `n ${++n}`, sections: [] }),
    );
    expect(calls.filter((c) => c === 'push-plugins').length).toBeGreaterThan(1);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('Analog: a NavigationEnd from the router adds no tick', async () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const listeners: ((event: unknown) => void)[] = [];
    const router = {
      url: '/',
      config: [
        {
          path: '',
          [Symbol(ANALOG_META_DESCRIPTION)]: { endpointKey: '/src/app/pages/index.page.ts' },
        },
      ],
      routerState: { snapshot: { root: { routeConfig: null, data: {}, firstChild: null } } },
      events: {
        subscribe: (fn: (event: unknown) => void) => {
          listeners.push(fn);
          return { unsubscribe: () => listeners.splice(listeners.indexOf(fn), 1) };
        },
      },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const { my, calls } = fakeRpc();
    let n = 0;
    const result = await compare(
      () => attachAnalog(my, 'tab1', () => ng, 60_000),
      () => {
        router.url = `/trips/${++n}`;
        for (const listener of [...listeners]) listener({ type: 1 });
      },
    );
    expect(calls.filter((c) => c === 'push-analog').length).toBeGreaterThan(1);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });

  it('NgRx: a dispatched action adds no tick', async () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const root = document.querySelector('app-root')!;
    let state = { n: 0 };
    const listeners: ((a: unknown) => void)[] = [];
    class _Store {
      source = { getValue: () => state };
      dispatch(action: { type: string }) {
        state = { n: state.n + 1 };
        for (const l of listeners) l(action);
      }
      select() {}
    }
    class ScannedActionsSubject {
      subscribe(fn: (a: unknown) => void) {
        listeners.push(fn);
        fn({ type: '@ngrx/store/init' });
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
    const { my, calls } = fakeRpc();
    const result = await compare(
      async () => {
        const ngrx = attachNgrx(my, 'tab1', () => ng as never);
        await ngrx.push();
        return ngrx.stop;
      },
      () => store.dispatch({ type: 'add' }),
    );
    expect(calls.filter((c) => c === 'push-ngrx-state').length).toBeGreaterThan(1);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });
});

describe('forms under zone.js', () => {
  it('a value change from app code adds no tick', async () => {
    const fixture = TestBed.createComponent(Login);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const { my, calls } = fakeRpc();
    const highlight = { show: () => {}, clear: () => {} };
    let n = 0;
    const result = await compare(
      () => {
        const forms = attachForms(my, 'tab1', () => (globalThis as { ng?: never }).ng, highlight);
        forms.push();
        return forms.stop;
      },
      () => fixture.componentInstance.form.controls.email.setValue(`a${++n}@x.io`),
      // Form reports go out at most once a second.
      { settleMs: 1300 },
    );
    expect(calls.filter((c) => c === 'push-forms').length).toBeGreaterThan(1);
    expect(result.withCollector).toEqual(result.without);
    expect(result.withCollector.stable).toBe(true);
  });
});

describe('outside-angular helpers', () => {
  it('schedule in the root zone, so the Angular zone stays stable', async () => {
    const probe = zoneProbe();
    const seen: string[] = [];
    probe.zone.run(() => {
      setTimeoutOutside(() => seen.push(Zone.current.name), 1);
      queueMicrotaskOutside(() => seen.push(Zone.current.name));
      nextFrameOutside(() => seen.push(Zone.current.name));
      const id = setIntervalOutside(() => {
        seen.push(Zone.current.name);
        clearInterval(id);
      }, 1);
    });
    expect(probe.zone.hasPendingMacrotasks).toBe(false);
    expect(probe.zone.hasPendingMicrotasks).toBe(false);
    await settle(60);
    expect(seen).toEqual(['<root>', '<root>', '<root>', '<root>']);
    expect(probe.ticks).toBe(1);
  });
});
