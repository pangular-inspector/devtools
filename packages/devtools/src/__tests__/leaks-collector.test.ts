// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { elementId } from '../element-id.ts';
import {
  MAX_TRACKED_DESTROYED,
  TRACKING_KEY,
  attachLeaks,
  holdsDestroyedInstances,
  stackClasses,
  type LeaksDebugNg,
  type LeaksOptions,
} from '../leaks-collector.ts';
import type { Profiler } from '../change-detection.ts';
import type { DomDirty } from '../dom-dirty.ts';
import type { LeaksReport } from '../rpc/leaks-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

/** A `WeakRef` a test can clear, standing in for the garbage collector. */
class FakeWeakRef<T extends object> {
  static all: FakeWeakRef<object>[] = [];
  private target: T | undefined;
  constructor(target: T) {
    this.target = target;
    FakeWeakRef.all.push(this as FakeWeakRef<object>);
  }
  deref() {
    return this.target;
  }
  /** Collects `target` everywhere a fake ref points at it. */
  static collect(target: object) {
    for (const ref of FakeWeakRef.all) if (ref.target === target) ref.target = undefined;
  }
}

class FakeRegistry<T> {
  static last: FakeRegistry<unknown> | null = null;
  readonly entries: { target: object; held: T; token?: object }[] = [];
  constructor(readonly callback: (held: T) => void) {
    FakeRegistry.last = this as FakeRegistry<unknown>;
  }
  register(target: object, held: T, token?: object) {
    this.entries.push({ target, held, token });
  }
  unregister(token: object) {
    const at = this.entries.findIndex((entry) => entry.token === token);
    if (at >= 0) this.entries.splice(at, 1);
    return at >= 0;
  }
  /** Runs the cleanup of every collected target, as the engine would after a GC. */
  finalize() {
    for (const entry of this.entries.splice(0)) {
      FakeWeakRef.collect(entry.target);
      this.callback(entry.held);
    }
  }
}

class TripList {}
interface Subscribable {
  subscribe(): { closed: boolean; unsubscribe(): void };
}

class TripCard {
  sub?: { closed: boolean; unsubscribe(): void };
  constructor(
    readonly trip: number,
    source?: Subscribable,
  ) {
    // A subscription made in the constructor, with no teardown.
    if (source) this.sub = source.subscribe();
  }
  listen(source: Subscribable) {
    return source.subscribe();
  }
}

/** Fake `ng`: components by host element, a null injector for unknown elements. */
function fakeNg(components: Map<Element, object>, extra: Partial<LeaksDebugNg> = {}) {
  const NULL = { name: 'NullInjector' };
  const alive = new Set<Element>();
  const ng: LeaksDebugNg & { NULL: object; alive: Set<Element> } = {
    NULL,
    alive,
    getComponent: (el: Element) => components.get(el) ?? null,
    getInjector: (el: Element) => (el.isConnected || alive.has(el) ? { el } : NULL),
    ...extra,
  };
  return ng;
}

interface Harness {
  reports: LeaksReport[];
  calls: { name: string; args: unknown[] }[];
  collector: ReturnType<typeof attachLeaks>;
  route: { value: string };
  registry: () => FakeRegistry<unknown>;
  handlers: Map<string, (...args: unknown[]) => unknown>;
}

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.innerHTML = '';
  FakeWeakRef.all = [];
});

function harness(ng: () => LeaksDebugNg | undefined, options: Partial<LeaksOptions> = {}): Harness {
  const reports: LeaksReport[] = [];
  const calls: { name: string; args: unknown[] }[] = [];
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const route = { value: '/trips' };
  const my = {
    rpc: {
      call: async (name: string, ...args: unknown[]) => {
        calls.push({ name, args });
        if (name === 'push-leaks') reports.push(structuredClone(args[0]) as LeaksReport);
        return { known: true };
      },
      register: (definition: { name: string; handler: (...args: unknown[]) => unknown }) => {
        handlers.set(definition.name, definition.handler);
      },
    },
  };
  const collector = attachLeaks(my, 'page-1', ng, {
    route: () => route.value,
    weak: { WeakRef: FakeWeakRef as never, FinalizationRegistry: FakeRegistry as never },
    dirty: null,
    storage: null,
    target: null,
    angularMajor: () => 22,
    addProfiler: () => null,
    ...options,
  });
  stops.push(collector.stop);
  return {
    reports,
    calls,
    collector,
    route,
    registry: () => FakeRegistry.last!,
    handlers,
  };
}

function page(cards: number) {
  document.body.innerHTML = `<app-root ng-version="22.1.0"><main>${'<app-trip-card></app-trip-card>'.repeat(cards)}</main></app-root>`;
  const root = document.querySelector('app-root')!;
  const components = new Map<Element, object>([[root, new TripList()]]);
  document
    .querySelectorAll('app-trip-card')
    .forEach((el, i) => components.set(el, new TripCard(i)));
  return { root, components, cards: [...document.querySelectorAll('app-trip-card')] };
}

describe('attachLeaks: destroyed but alive', () => {
  it('moves a component that left the page to the destroyed list, keyed by its stable id', async () => {
    const { components, cards } = page(2);
    const ng = fakeNg(components);
    const h = harness(() => ng);
    await h.collector.push();
    expect(h.reports.at(-1)!.totals.components).toBe(3);
    expect(h.reports.at(-1)!.destroyed).toEqual([]);

    const id = elementId(cards[1]!);
    cards[1]!.remove();
    await h.collector.push();
    const gone = h.reports.at(-1)!.destroyed;
    expect(gone).toEqual([
      expect.objectContaining({ id, name: 'TripCard', route: '/trips', navigations: 0 }),
    ]);
    expect(gone[0]!.detached).toBeUndefined();
    expect(h.reports.at(-1)!.totals.components).toBe(2);
    expect(h.reports.at(-1)!.pageId).toBe('page-1');
  });

  it('walks the page through the dirty tracker, so changes in open shadow roots are seen', async () => {
    const { components } = page(1);
    const ng = fakeNg(components);
    let watched = 0;
    const dirty: DomDirty = {
      watch: (tree) => {
        watched++;
        return tree;
      },
      cached: (read) => () => read(),
      stop: () => {},
    };
    const h = harness(() => ng, { dirty });
    await h.collector.push();
    expect(watched).toBeGreaterThan(0);
    expect(h.reports.at(-1)!.totals.components).toBe(2);
  });

  it('counts navigations since the destroy, and forgets an instance once it is collected', async () => {
    const { components, cards } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng);
    await h.collector.push();
    cards[0]!.remove();
    await h.collector.push();
    h.route.value = '/trips/2';
    await h.collector.push();
    h.route.value = '/about';
    await h.collector.push();
    const report = h.reports.at(-1)!;
    expect(report.navigations).toBe(2);
    expect(report.destroyed[0]).toMatchObject({
      name: 'TripCard',
      route: '/trips',
      navigations: 2,
    });

    h.registry().finalize();
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed).toEqual([]);
    expect(h.reports.at(-1)!.totals).toMatchObject({ destroyed: 0, collected: 1 });
  });

  it('reports a host that left while Angular still holds its view as detached, not destroyed', async () => {
    const { components, cards } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng);
    await h.collector.push();
    ng.alive.add(cards[0]!);
    cards[0]!.remove();
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed[0]).toMatchObject({ name: 'TripCard', detached: true });
    expect(h.reports.at(-1)!.support.detached).toBe(true);

    // Angular drops the view later: now it is destroyed.
    ng.alive.delete(cards[0]!);
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed[0]!.detached).toBeUndefined();
  });

  it('takes a detached view back when it returns to the page (route reuse)', async () => {
    const { components, cards } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng);
    await h.collector.push();
    const card = cards[0]!;
    const parent = card.parentElement!;
    ng.alive.add(card);
    card.remove();
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed).toHaveLength(1);
    parent.append(card);
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed).toEqual([]);
    expect(h.registry().entries).toEqual([]);
  });

  it('cannot tell detached from destroyed before Angular 14, so it calls both destroyed', async () => {
    const { components, cards } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng, { angularMajor: () => 13 });
    await h.collector.push();
    ng.alive.add(cards[0]!);
    cards[0]!.remove();
    await h.collector.push();
    expect(h.reports.at(-1)!.destroyed[0]!.detached).toBeUndefined();
    expect(h.reports.at(-1)!.support.detached).toBeUndefined();
  });

  it('keeps no more than its cap of destroyed instances, oldest first out', async () => {
    const { components } = page(0);
    const main = document.querySelector('main')!;
    const ng = fakeNg(components);
    const h = harness(() => ng);
    for (let round = 0; round < 3; round++) {
      const batch: Element[] = [];
      for (let i = 0; i < 250; i++) {
        const el = document.createElement('app-trip-card');
        components.set(el, new TripCard(i));
        main.append(el);
        batch.push(el);
      }
      h.collector.scan();
      for (const el of batch) el.remove();
      h.collector.scan();
    }
    const report = h.collector.report();
    expect(report.totals.destroyed).toBe(MAX_TRACKED_DESTROYED);
    expect(report.totals.dropped).toBe(750 - MAX_TRACKED_DESTROYED);
    expect(report.destroyed.length).toBeLessThanOrEqual(100);
  });

  it('says retention is unavailable without WeakRef or the debug API', async () => {
    page(1);
    const h = harness(() => undefined, { weak: {} });
    await h.collector.push();
    expect(h.reports.at(-1)!.support.retention).toBe(false);
    expect(h.reports.at(-1)!.totals.components).toBe(0);
  });

  it('masks secrets in routes and titles', async () => {
    const { components, cards } = page(1);
    document.title = `Trip ${JWT}`;
    const ng = fakeNg(components);
    const h = harness(() => ng);
    h.route.value = `/trips?token=${JWT}`;
    await h.collector.push();
    cards[0]!.remove();
    await h.collector.push();
    const text = JSON.stringify(h.reports.at(-1));
    expect(text).not.toContain(JWT);
    document.title = '';
  });

  it('never changes the app DOM', async () => {
    const { components, cards } = page(2);
    const ng = fakeNg(components);
    const h = harness(() => ng);
    const before = document.documentElement.outerHTML;
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    await h.collector.push();
    await h.collector.push(true);
    observer.disconnect();
    expect(changes.concat(observer.takeRecords())).toEqual([]);
    expect(document.documentElement.outerHTML).toBe(before);
    expect(cards).toHaveLength(2);
  });
});

describe('attachLeaks: effects', () => {
  it('counts the effects of each component from the signal graph, and shares those siblings both list', async () => {
    const { root, components, cards } = page(2);
    const graphs = new Map<Element, { id: string; kind: string }[]>([
      [
        root,
        [
          { id: 'r1', kind: 'effect' },
          { id: 't0', kind: 'template' },
        ],
      ],
      [
        cards[0]!,
        [
          { id: 's1', kind: 'effect' },
          { id: 's2', kind: 'effect' },
          { id: 'x', kind: 'signal' },
        ],
      ],
      [
        cards[1]!,
        [
          { id: 's1', kind: 'effect' },
          { id: 's2', kind: 'effect' },
          { id: 'c3', kind: 'effect' },
        ],
      ],
    ]);
    const ng = fakeNg(components, {
      ɵgetSignalGraph: (injector) => ({
        nodes: graphs.get((injector as { el: Element }).el) ?? [],
      }),
    });
    const h = harness(() => ng);
    await h.collector.push();
    const report = h.reports.at(-1)!;
    expect(report.support.effects).toBe(true);
    expect(report.totals.effects).toBe(4);
    const byId = new Map(report.components.map((c) => [c.id, c]));
    expect(byId.get(elementId(root))).toMatchObject({ effects: 1 });
    expect(byId.get(elementId(cards[0]!))).toMatchObject({ effects: 0, sharedEffects: 2 });
    expect(byId.get(elementId(cards[1]!))).toMatchObject({ effects: 1, sharedEffects: 2 });
  });

  it('says effects are unavailable without ɵgetSignalGraph, or when its nodes carry no ids (before 20.1)', async () => {
    const { components } = page(1);
    const h = harness(() => fakeNg(components));
    await h.collector.push();
    expect(h.reports.at(-1)!.support.effects).toBe(false);

    const old = fakeNg(components, { ɵgetSignalGraph: () => ({ nodes: [{ kind: 'effect' }] }) });
    const h2 = harness(() => old);
    await h2.collector.push();
    expect(h2.reports.at(-1)!.support.effects).toBe(false);
    expect(h2.reports.at(-1)!.totals.effects).toBe(0);
  });
});

/** A small stand-in for RxJS: `subscribe` returns a subscription that can close. */
function fakeRxjs() {
  class Subscription {
    closed = false;
    unsubscribe() {
      this.closed = true;
    }
  }
  class Observable {
    constructor(private readonly onSubscribe?: () => void) {}
    subscribe(): Subscription {
      this.onSubscribe?.();
      return new Subscription();
    }
  }
  const original = Observable.prototype.subscribe;
  return { module: { Observable }, Observable, original };
}

describe('attachLeaks: subscriptions', () => {
  it('stays off until asked, then wraps subscribe and restores it when turned off', async () => {
    const rx = fakeRxjs();
    const { components } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng, { loadRxjs: async () => rx.module as never });
    await h.collector.push();
    expect(h.reports.at(-1)!.support.subscriptions).toBe('off');
    expect(rx.Observable.prototype.subscribe).toBe(rx.original);

    expect(await h.collector.setTracking(true)).toMatchObject({ ok: true });
    expect(rx.Observable.prototype.subscribe).not.toBe(rx.original);
    await h.collector.push();
    expect(h.reports.at(-1)!.support.subscriptions).toBe('on');

    await h.collector.setTracking(false);
    expect(rx.Observable.prototype.subscribe).toBe(rx.original);
    expect(Object.prototype.hasOwnProperty.call(rx.Observable.prototype, 'subscribe')).toBe(true);
  });

  it('wraps subscribe once when tracking goes on, off and on again while RxJS loads', async () => {
    const rx = fakeRxjs();
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => (release = resolve));
    const h = harness(() => fakeNg(new Map()), {
      loadRxjs: async () => {
        await loaded;
        return rx.module as never;
      },
    });
    const first = h.collector.setTracking(true);
    await h.collector.setTracking(false);
    const second = h.collector.setTracking(true);
    release();
    expect(await first).toMatchObject({ ok: false });
    expect(await second).toMatchObject({ ok: true });
    expect(rx.Observable.prototype.subscribe).not.toBe(rx.original);

    await h.collector.setTracking(false);
    expect(rx.Observable.prototype.subscribe).toBe(rx.original);
    h.collector.stop();
    expect(rx.Observable.prototype.subscribe).toBe(rx.original);
  });

  it('leaves a wrapper someone added after it in place, and goes quiet', async () => {
    const rx = fakeRxjs();
    page(0);
    const h = harness(() => fakeNg(new Map()), { loadRxjs: async () => rx.module as never });
    await h.collector.setTracking(true);
    const ours = rx.Observable.prototype.subscribe;
    const theirs = function (this: unknown) {
      return ours.call(this);
    };
    rx.Observable.prototype.subscribe = theirs;
    await h.collector.setTracking(false);
    expect(rx.Observable.prototype.subscribe).toBe(theirs);
  });

  it('flags a subscription still open after the instance that made it was destroyed', async () => {
    const rx = fakeRxjs();
    let listener: Profiler | null = null;
    const { components, cards } = page(1);
    const card = components.get(cards[0]!) as TripCard;
    const ng = fakeNg(components);
    const h = harness(() => ng, {
      loadRxjs: async () => rx.module as never,
      addProfiler: (fn) => {
        listener = fn;
        return () => (listener = null);
      },
    });
    await h.collector.push();
    await h.collector.setTracking(true);

    const source = new rx.Observable();
    // Subscriptions made inside a lifecycle hook, between Angular's profiler events.
    listener!(4, card, 'ngOnInit');
    const subs = { open: card.listen(source), closed: card.listen(source) };
    listener!(5, card, 'ngOnInit');
    subs.closed.unsubscribe();

    await h.collector.push();
    let report = h.reports.at(-1)!;
    expect(report.support.instances).toBe(true);
    expect(report.components.find((c) => c.name === 'TripCard')).toMatchObject({
      subscriptions: 1,
    });
    expect(report.subscriptions).toEqual([]);

    cards[0]!.remove();
    await h.collector.push();
    report = h.reports.at(-1)!;
    expect(report.subscriptions).toEqual([
      expect.objectContaining({
        name: 'TripCard',
        instanceId: elementId(cards[0]!),
        count: 1,
        reason: 'instance-destroyed',
        route: '/trips',
      }),
    ]);
    expect(report.subscriptions[0]!.source).toMatch(/TripCard/);
    expect(report.destroyed[0]).toMatchObject({ subscriptions: 1 });

    subs.open.unsubscribe();
    await h.collector.push();
    expect(h.reports.at(-1)!.subscriptions).toEqual([]);
  });

  it('without the profiler, flags subscriptions of a class that has no instance left', async () => {
    const rx = fakeRxjs();
    const { components, cards } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng, { loadRxjs: async () => rx.module as never });
    await h.collector.push();
    await h.collector.setTracking(true);
    const source = new rx.Observable();
    const made = new TripCard(9, source);
    await h.collector.push();
    expect(h.reports.at(-1)!.subscriptions).toEqual([]);
    expect(h.reports.at(-1)!.support.instances).toBeUndefined();

    cards[0]!.remove();
    await h.collector.push();
    expect(h.reports.at(-1)!.subscriptions).toEqual([
      expect.objectContaining({ name: 'TripCard', count: 1, reason: 'no-live-instance' }),
    ]);
    expect(h.reports.at(-1)!.subscriptions[0]!.instanceId).toBeUndefined();
    made.sub!.unsubscribe();
  });

  it("does not give a child's constructor subscription to the parent whose template builds it", async () => {
    const rx = fakeRxjs();
    let listener: Profiler | null = null;
    const { root, components } = page(1);
    const list = components.get(root)!;
    const h = harness(() => fakeNg(components), {
      loadRxjs: async () => rx.module as never,
      addProfiler: (fn) => {
        listener = fn;
        return () => (listener = null);
      },
    });
    await h.collector.push();
    await h.collector.setTracking(true);
    listener!(0, list);
    const made = new TripCard(7, new rx.Observable());
    listener!(1, list);
    await h.collector.push();
    const report = h.reports.at(-1)!;
    expect(report.components.find((c) => c.name === 'TripList')?.subscriptions ?? 0).toBe(0);
    expect(report.totals.subscriptions).toBe(1);
    made.sub!.unsubscribe();
  });

  it('counts one subscription for an operator chain, not one per inner subscribe', async () => {
    const rx = fakeRxjs();
    const { components, cards } = page(1);
    const card = components.get(cards[0]!) as TripCard;
    const h = harness(() => fakeNg(components), { loadRxjs: async () => rx.module as never });
    await h.collector.push();
    await h.collector.setTracking(true);
    const inner = new rx.Observable();
    // An operator subscribes to its source inside the outer subscribe.
    const outer = new rx.Observable(() => inner.subscribe());
    card.listen(outer);
    await h.collector.push();
    expect(h.reports.at(-1)!.totals.subscriptions).toBe(1);
  });

  it('reports tracking as unavailable when RxJS cannot be loaded', async () => {
    page(0);
    const h = harness(() => fakeNg(new Map()), {
      loadRxjs: () => Promise.reject(new Error('no rxjs')),
    });
    expect(await h.collector.setTracking(true)).toMatchObject({ ok: false });
    await h.collector.push();
    expect(h.reports.at(-1)!.support.subscriptions).toBe('unavailable');
  });

  it('starts tracking again after a reload when it was on, and forgets the choice when off', async () => {
    const rx = fakeRxjs();
    page(0);
    const store = new Map<string, string>([[TRACKING_KEY, '1']]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const h = harness(() => fakeNg(new Map()), {
      loadRxjs: async () => rx.module as never,
      storage,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.collector.push();
    expect(h.reports.at(-1)!.support.subscriptions).toBe('on');
    await h.collector.setTracking(false);
    expect(store.has(TRACKING_KEY)).toBe(false);
  });

  it('answers the leak-tracking event only for its own page', async () => {
    const rx = fakeRxjs();
    page(0);
    const h = harness(() => fakeNg(new Map()), { loadRxjs: async () => rx.module as never });
    const handler = h.handlers.get('leak-tracking')!;
    handler({ pageId: 'other', on: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rx.Observable.prototype.subscribe).toBe(rx.original);
    handler({ pageId: 'page-1', on: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rx.Observable.prototype.subscribe).not.toBe(rx.original);
  });
});

describe('attachLeaks: pushes', () => {
  it('skips an unchanged report, sends a keepalive when one is due, and forgets the page on leave', async () => {
    let now = 1000;
    const { components } = page(1);
    const ng = fakeNg(components);
    const h = harness(() => ng, { now: () => now, tickMs: () => 3000 });
    await h.collector.push();
    await h.collector.push();
    expect(h.reports).toHaveLength(1);
    now += 6000;
    await h.collector.push();
    expect(h.reports).toHaveLength(2);

    h.collector.leave();
    await h.collector.push(true);
    expect(h.reports).toHaveLength(2);
    expect(h.calls.at(-1)).toEqual({ name: 'forget-leaks-page', args: ['page-1'] });
    h.collector.resume();
    await h.collector.push();
    expect(h.reports).toHaveLength(3);
  });
});

describe('attachLeaks: development builds', () => {
  it('detects the DI debug data that holds destroyed instances by ng.ɵgetInjectorProviders', () => {
    expect(holdsDestroyedInstances(undefined)).toBe(false);
    expect(holdsDestroyedInstances(fakeNg(new Map()))).toBe(false);
    expect(holdsDestroyedInstances(fakeNg(new Map(), { ɵgetInjectorProviders: () => [] }))).toBe(
      true,
    );
    const throwing = fakeNg(new Map());
    Object.defineProperty(throwing, 'ɵgetInjectorProviders', {
      get() {
        throw new Error('no');
      },
    });
    expect(holdsDestroyedInstances(throwing)).toBe(false);
  });

  it('reports retention as unavailable with that data, lists only detached views, and still flags subscriptions', async () => {
    const { components, cards } = page(2);
    let withDebugData = true;
    const base = fakeNg(components);
    const ng = () => (withDebugData ? { ...base, ɵgetInjectorProviders: () => [] } : base);
    const rx = fakeRxjs();
    const source = new rx.Observable();
    let now = 1000;
    const h = harness(ng, { now: () => now, loadRxjs: async () => rx.module as never });
    await h.collector.setTracking(true);
    await h.collector.push();
    // A card subscribes and goes; another goes while Angular still holds its view.
    (components.get(cards[0]!) as TripCard).listen(source as never);
    base.alive.add(cards[1]!);
    cards[0]!.remove();
    cards[1]!.remove();
    h.route.value = '/a';
    now += 60_000;
    await h.collector.push(true);
    h.route.value = '/b';
    await h.collector.push(true);

    const dev = h.reports.at(-1)!;
    expect(dev.support.retention).toBe('dev-di-debug');
    expect(dev.destroyed).toEqual([
      expect.objectContaining({ id: elementId(cards[1]!), detached: true }),
    ]);
    expect(dev.destroyed.some((d) => 'devHeld' in d)).toBe(false);
    expect(dev.subscriptions).toEqual([
      expect.objectContaining({ name: 'TripCard', reason: 'no-live-instance' }),
    ]);
    expect(dev.navigations).toBe(2);

    // Without the debug data (older Angular) the same instances are listed as before.
    withDebugData = false;
    await h.collector.push(true);
    const plain = h.reports.at(-1)!;
    expect(plain.support.retention).toBe(true);
    expect(plain.destroyed.map((d) => d.id).sort()).toEqual(
      [elementId(cards[0]!), elementId(cards[1]!)].sort(),
    );
  });
});

describe('attachLeaks: idle pages', () => {
  it('keeps its bookkeeping but reads no signal graph and sends no new report while nobody looks', async () => {
    let now = 1000;
    let active = false;
    const { components, cards } = page(2);
    let graphReads = 0;
    const ng = fakeNg(components, {
      ɵgetSignalGraph: () => {
        graphReads++;
        return { nodes: [{ id: 'e1', kind: 'effect' }] };
      },
    });
    const h = harness(() => ng, { now: () => now, tickMs: () => 3000, active: () => active });

    // The first report still goes out, so the page is listed, but without the graph.
    await h.collector.push();
    expect(h.reports).toHaveLength(1);
    expect(graphReads).toBe(0);

    // A component that comes and goes while idle is still seen once someone looks.
    cards[1]!.remove();
    h.collector.track();
    await h.collector.push();
    expect(h.reports).toHaveLength(1);
    expect(graphReads).toBe(0);

    // A keepalive re-sends the last report as it was.
    now += 6000;
    await h.collector.push();
    expect(h.reports).toHaveLength(2);
    expect(h.reports[1]).toEqual(h.reports[0]);
    expect(graphReads).toBe(0);

    active = true;
    await h.collector.push();
    expect(graphReads).toBeGreaterThan(0);
    const report = h.reports.at(-1)!;
    expect(report.support.effects).toBe(true);
    expect(report.destroyed.map((d) => d.id)).toContain(elementId(cards[1]!));
  });
});

describe('stackClasses', () => {
  it('reads constructors, methods and compiled template functions, innermost first', () => {
    const stack = [
      'Error',
      '    at Observable.subscribe (http://localhost:4200/node_modules/rxjs/index.js:10:5)',
      '    at new _TripCard (http://localhost:4200/src/app/trip-card.ts?t=1:12:7)',
      '    at TripList_Conditional_2_Template (http://localhost:4200/src/app/trip-list.ts:30:1)',
      '    at executeTemplate (http://localhost:4200/node_modules/core.js:1:1)',
    ].join('\n');
    const { names, frames } = stackClasses(stack);
    expect(names.slice(0, 2)).toEqual(['Observable', 'TripCard']);
    expect(names).toContain('TripList');
    expect(frames[1]).toContain('new _TripCard');
  });

  it('reads Firefox and Safari frames', () => {
    const { names } = stackClasses(
      'Error\nngOnInit@http://x/a.js:1:1\nTripCard.prototype.ngOnInit@x',
    );
    expect(names).toEqual(['TripCard']);
    expect(stackClasses('Error\nTripCard.ngOnInit@http://x/a.js:1:1').names).toEqual(['TripCard']);
  });
});
