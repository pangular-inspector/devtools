// @vitest-environment jsdom
// The collectors on pages shaped like Angular 12 to 21: each one must not
// throw, and must report what that version's debug API gives.
import { afterEach, describe, expect, it } from 'vitest';
import { addProfilerListener } from '../change-detection.ts';
import { collectComponentTree, selectedComponentDetail } from '../component-tree.ts';
import { createDeferTracker } from '../defer-blocks.ts';
import { elementId } from '../element-id.ts';
import { controlFlowReader, createForTracker } from '../for-blocks.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import { scanPipeViews } from '../pipes-runtime.ts';
import { findRouters, type RouterDebugApi } from '../router.ts';
import { collectSignalGraph } from '../signal-graph.ts';
import { angularRoot, fakeNg } from './ng-shapes.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

class App {
  title = 'Trips';
}
class TripCard {
  tripId = 'lisbon';
}
class Tooltip {}

/** A page with `<app-root ng-version><app-trip-card tooltip>` and the public utils of every Ivy version. */
function page(version: string, extra: Record<string, (...args: never[]) => unknown> = {}) {
  const root = angularRoot(`${version}.0`);
  root.innerHTML = '<main><app-trip-card tooltip></app-trip-card></main>';
  const card = root.querySelector('app-trip-card')!;
  const app = new App();
  const trip = new TripCard();
  const tooltip = new Tooltip();
  const injectors = new Map<Element, object>([
    [root, { kind: 'node', el: root }],
    [card, { kind: 'node', el: card }],
  ]);
  const ng = fakeNg(version, {
    getComponent: ((el: Element) => (el === root ? app : el === card ? trip : null)) as never,
    getDirectives: ((el: Element) =>
      el === root ? [app] : el === card ? [trip, tooltip] : []) as never,
    getInjector: ((el: Element) => injectors.get(el) ?? null) as never,
    getHostElement: ((instance: unknown) =>
      instance === app ? root : instance === trip ? card : null) as never,
    getOwningComponent: ((el: Element) => (el === card ? app : null)) as never,
    getListeners: (() => []) as never,
    getRootComponents: (() => [app]) as never,
    // Angular 12 to 17.0 key inputs by public name with the property name as a string.
    getDirectiveMetadata: ((instance: unknown) =>
      instance === trip
        ? { inputs: { trip: 'tripId' }, outputs: {}, changeDetection: 1, encapsulation: 0 }
        : { inputs: {}, outputs: {}, changeDetection: 1, encapsulation: 0 }) as never,
    ...extra,
  });
  return { ng, root, card, app, trip, tooltip, injectors };
}

describe('component tree on Angular 12', () => {
  it('lists components and reads a selected component without isSignal', () => {
    const { ng, card } = page('12.2');
    const tree = collectComponentTree(ng as never, { tree: undefined });
    expect(tree.roots.map((node) => node.name)).toEqual(['App']);
    expect(tree.roots[0]!.children.map((node) => node.name)).toEqual(['TripCard']);
    const detail = selectedComponentDetail(ng as never, { selectedId: elementId(card) });
    expect(detail?.name).toBe('TripCard');
    expect(detail?.inputs.map((input) => [input.name, input.prop])).toEqual([['trip', 'tripId']]);
  });
});

describe('injector tree before Angular 17', () => {
  it('reports element injectors without providers on Angular 15', () => {
    const { ng } = page('15.2');
    const report = collectInjectorTree(ng as never);
    expect(report.environment).toEqual([]);
    const [root] = report.roots;
    expect(root!.injector).toMatchObject({ type: 'element', name: 'app-root', component: 'App' });
    expect(root!.providers).toEqual([]);
    expect(root!.injector.path).toEqual([]);
    expect(root!.children[0]!.injector.directives).toEqual(['TripCard', 'Tooltip']);
  });

  it('finds environment injectors through their records on Angular 16.2', () => {
    class Store {}
    const platform = {
      records: new Map(),
      scopes: new Set(['platform']),
      source: 'Platform: core',
    };
    const rootEnv = {
      records: new Map<unknown, unknown>([[Store, { value: new Store(), factory: () => 0 }]]),
      scopes: new Set(['root']),
      source: null,
    };
    class NullInjector {}
    const nullInjector = new NullInjector();
    const { ng } = page('16.2', {
      ɵgetInjectorResolutionPath: ((injector: unknown) => [
        injector,
        rootEnv,
        platform,
        nullInjector,
      ]) as never,
      ɵgetInjectorProviders: ((injector: unknown) =>
        injector === rootEnv ? [{ token: Store, provider: Store }] : []) as never,
      ɵgetDependenciesFromInjectable: (() => ({ dependencies: [] })) as never,
    });
    const report = collectInjectorTree(ng as never);
    expect(report.environment.map((node) => node.injector.name)).toEqual(['Platform']);
    const rootNode = report.environment[0]!.children[0]!;
    expect(rootNode.injector.name).toBe('Root');
    expect(rootNode.providers.map((provider) => provider.token)).toEqual(['Store']);
    // Element injectors on the path can't be named without metadata, so only the
    // environment injectors and the null injector are kept.
    const path = report.roots[0]!.injector.path;
    expect(path).toEqual([rootNode.injector.id, report.environment[0]!.injector.id, 'inj-null']);
  });
});

describe('collectors whose Angular API is newer than the page', () => {
  it('report no signal graph before 19.1', () => {
    const { ng } = page('18.2');
    expect(collectSignalGraph(ng as never, null, document)).toBeNull();
  });

  it('report no defer blocks before 19.1 and no @for blocks before 22.0', () => {
    expect(createDeferTracker().collect(page('18.2').ng as never, document)).toBeUndefined();
    document.body.innerHTML = '';
    const { ng } = page('21.0', { ɵgetDeferBlocks: (() => []) as never });
    expect(controlFlowReader(ng as never)).toBeUndefined();
    expect(createForTracker().collect(ng as never, document)).toBeUndefined();
    expect(createDeferTracker().collect(ng as never, document)).toEqual([]);
  });

  it('do not take the single profiler slot before 20.0', () => {
    let taken = false;
    const { ng } = page('19.2', {
      ɵsetProfiler: (() => {
        taken = true;
      }) as never,
    });
    expect(addProfilerListener(ng, () => {}, document)).toBeNull();
    expect(taken).toBe(false);
  });
});

/** A Router as the collectors recognise it. */
class FakeRouter {
  navigateByUrl = () => Promise.resolve(true);
  events = { subscribe: () => ({ unsubscribe() {} }) };
  routerState = { snapshot: { root: { children: [] } } };
  config = [{ path: '' }];
  navigated = true;
}

describe('router before Angular 16.2', () => {
  it('finds the Router a RouterLink holds, then asks the root injector for it', () => {
    const router = new FakeRouter();
    const { ng, root, injectors } = page('15.2');
    root.insertAdjacentHTML('beforeend', '<a routerlink="/trips">Trips</a>');
    const link = root.querySelector('a')!;
    const routerLink = { router, route: {}, href: '/trips' };
    const asked: unknown[] = [];
    injectors.set(root, {
      get: (token: unknown) => {
        asked.push(token);
        return token === FakeRouter ? router : null;
      },
    });
    const api = {
      ...ng,
      getDirectives: (el: Element) => (el === link ? [routerLink] : []),
      getComponent: () => null,
    } as RouterDebugApi;
    expect(findRouters(api, [root])).toEqual([router]);
    expect(asked).toEqual([FakeRouter]);
  });

  it('finds the Router the app component injected', () => {
    const router = new FakeRouter();
    const { ng, root, app } = page('12.2');
    Object.assign(app, { router });
    expect(findRouters(ng as RouterDebugApi, [root])).toEqual([router]);
  });

  it('finds nothing, without throwing, on a page where nothing holds the Router', () => {
    const { ng, root } = page('13.4');
    expect(findRouters(ng as RouterDebugApi, [root])).toEqual([]);
  });

  it('keeps the provider lookup from 16.2, without the fallback', () => {
    const router = new FakeRouter();
    const { ng, root, app } = page('16.2', {
      ɵgetInjectorProviders: (() => []) as never,
      ɵgetInjectorResolutionPath: ((injector: unknown) => [injector]) as never,
    });
    Object.assign(app, { router });
    expect(findRouters(ng as RouterDebugApi, [root])).toEqual([]);
  });
});

describe('pipes on Angular 12 to 15', () => {
  const COMPONENT = 1;
  const EMBEDDED = 2;
  class DatePipe {}
  const pipeDef = { name: 'date', type: DatePipe, pure: true };

  /** An LView in the 12 to 15 layout: the declaring component view sits in slot 16. */
  function lView(type: number, context: unknown, data: unknown[] = []): unknown[] {
    const view: unknown[] = new Array(30).fill(null);
    view[1] = { type, data, blueprint: [] };
    view[8] = context;
    return view;
  }

  it('reads an LView patched onto the node and attributes pipes through slot 16', () => {
    const owner = new App();
    const other = new TripCard();
    const data = new Array(30).fill(null);
    data[25] = pipeDef;
    const component = lView(COMPONENT, owner);
    component[16] = component;
    const embedded = lView(EMBEDDED, null, data);
    embedded[25] = new DatePipe();
    embedded[16] = component;
    // Slot 15 is the declaration view before 16.0; reading it would name the wrong owner.
    const unrelated = lView(COMPONENT, other);
    embedded[15] = unrelated;
    const container: unknown[] = new Array(12).fill(null);
    container[1] = true;
    container[3] = component;
    container[10] = embedded;
    embedded[3] = container;
    component[24] = container;

    const host = document.createElement('app-root');
    (host as unknown as { __ngContext__: unknown }).__ngContext__ = component;
    const ng = {
      getComponent: (el: Element) => (el === host ? owner : null),
      getOwningComponent: () => null,
    };
    const { usages } = scanPipeViews(ng, [host]);
    expect(usages.map((usage) => usage.name)).toEqual(['date']);
    expect(usages[0]!.component).toBe(owner);
  });
});
