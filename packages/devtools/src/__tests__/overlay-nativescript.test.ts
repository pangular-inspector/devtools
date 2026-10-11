import { describe, expect, it } from 'vitest';
import { collectComponentTree, componentHosts } from '../component-tree.ts';
import { hostBySelector } from '../host-tree.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import {
  angularRootHost,
  nativeScriptRoot,
  nativeScriptTree,
  renderedView,
  selectorOf,
  topmostView,
  type NativeView,
} from '../overlay-nativescript-views.ts';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';

/** A stand-in for a `@nativescript/core` view: children come from `eachChildView`. */
function view(typeName: string, children: NativeView[] = [], extra: Partial<NativeView> = {}) {
  const v: NativeView = {
    typeName,
    parent: null,
    isLoaded: true,
    eachChildView: (callback) => {
      for (const child of children) if (callback(child) === false) break;
    },
    ...extra,
  };
  for (const child of children) child.parent = v;
  return v;
}

function component(selector: string, name: string, fields: Record<string, unknown> = {}) {
  const Cmp = { [name]: class {} }[name] as new () => object;
  Object.assign(Cmp, { ɵcmp: { selectors: [[selector]] } });
  return Object.assign(new Cmp(), fields);
}

type Ng = SignalDebugNg<NativeView> & {
  getRootComponents?(host: unknown): unknown[];
  getHostElement?(component: unknown): NativeView | null;
};

describe('NativeScript host tree', () => {
  // AppHostView(ns-app) > GridLayout > ProxyViewContainer(page-router-outlet) > Frame > Page
  //   > ProxyViewContainer(ns-person) > StackLayout > Label
  const label = view('Label');
  const personHost = view('ProxyViewContainer', [view('StackLayout', [label])], {
    customCSSName: 'ns-person',
  });
  const page = view('Page', [personHost]);
  const frame = view('Frame', [page]);
  const outlet = view('ProxyViewContainer', [frame], { customCSSName: 'page-router-outlet' });
  const grid = view('GridLayout', [outlet]);
  const appHost = view('AppHostView', [grid]);
  // NativeScript hands out the root component's content as the root view, with
  // no parent link back up to the host.
  grid.parent = null;

  const app = component('ns-app', 'AppComponent');
  const person = component('ns-person', 'PersonComponent', { name: 'Ada' });
  const components = new Map<NativeView, unknown>([
    [appHost, app],
    [personHost, person],
  ]);
  const ng: Ng = {
    getComponent: (host) => components.get(host) ?? null,
    getRootComponents: () => [app],
    getHostElement: (c) => (c === app ? appHost : null),
  };
  const tree = nativeScriptTree(
    () => ng,
    () => grid,
  );

  it('nests components through layouts, frames and pages', () => {
    const report = collectComponentTree(ng, { tree });
    expect(report.count).toBe(2);
    expect(report.roots).toHaveLength(1);
    expect(report.roots[0]).toMatchObject({ name: 'AppComponent', tag: 'ns-app' });
    expect(report.roots[0].children).toHaveLength(1);
    expect(report.roots[0].children[0]).toMatchObject({
      name: 'PersonComponent',
      tag: 'ns-person',
    });
  });

  it('keeps ids stable across collections and resolves a selected id', () => {
    const first = collectComponentTree(ng, { tree });
    const id = first.roots[0].children[0].id;
    const second = collectComponentTree(ng, { tree, selectedId: id });
    expect(second.roots[0].children[0].id).toBe(id);
    expect(second.detail).toMatchObject({ name: 'PersonComponent', path: 'ns-app > ns-person' });
  });

  it('lists component hosts parents first and finds a host by selector', () => {
    expect(componentHosts(ng, tree)).toEqual([appHost, personHost]);
    expect(hostBySelector(tree, 'ns-person')).toBe(personHost);
    expect(hostBySelector(tree, 'ns-missing')).toBeNull();
  });

  it('links the root content back to the root component host', () => {
    tree.roots();
    expect(tree.parent(grid)).toBe(appHost);
    expect(tree.parent(appHost)).toBeNull();
  });

  it('climbs to the top of the parent chain when Angular names no root', () => {
    expect(topmostView(label)).toBe(grid);
    const detached = view('GridLayout', [view('Label')]);
    expect(angularRootHost(ng, detached)).toBe(appHost);
    expect(nativeScriptRoot({ getComponent: () => null }, detached)).toBe(detached);
  });

  it('draws highlights on the first view below a proxy container', () => {
    expect(renderedView(personHost).typeName).toBe('StackLayout');
    expect(renderedView(label)).toBe(label);
  });

  it('names a host by its component selector, then by the template element name', () => {
    expect(selectorOf(personHost, component('ns-x', 'X'))).toBe('ns-x');
    expect(selectorOf(personHost, {})).toBe('ns-person');
    expect(selectorOf(label, null)).toBe('label');
    // An attribute selector has no element name to report.
    const attr = { constructor: { ɵcmp: { selectors: [['', 'nsHighlight', '']] } } };
    expect(selectorOf(label, attr)).toBe('label');
  });

  it('reports element injectors under their environment injectors', () => {
    const root = { scopes: new Set(['root']) };
    const platform = { scopes: new Set(['platform']) };
    const injectors = new Map<NativeView, object>([
      [appHost, { host: appHost }],
      [personHost, { host: personHost }],
    ]);
    const withInjectors: Ng = {
      ...ng,
      getInjector: (host) => injectors.get(host) ?? null,
      ɵgetInjectorMetadata: (injector) =>
        injector === root || injector === platform
          ? { type: 'environment', source: null }
          : { type: 'element', source: (injector as { host: NativeView }).host },
      ɵgetInjectorProviders: (injector) =>
        injector === root ? [{ token: class PersonService {}, provider: class {} }] : [],
      ɵgetInjectorResolutionPath: (injector) => [injector, root, platform],
    };
    const first = collectInjectorTree(withInjectors, tree);
    const again = collectInjectorTree(withInjectors, tree);
    expect(first.roots[0].injector).toMatchObject({ name: 'ns-app', component: 'AppComponent' });
    expect(first.roots[0].children[0].injector).toMatchObject({ name: 'ns-person' });
    expect(again.roots[0].children[0].injector.id).toBe(first.roots[0].children[0].injector.id);
    expect(first.environment[0].injector.name).toBe('Platform');
    expect(first.environment[0].children[0].injector).toMatchObject({
      name: 'Root',
      providerCount: 1,
    });
  });

  it('reports the signal graph of a selected host', () => {
    const withSignals: Ng = {
      ...ng,
      getInjector: (host) => host,
      ɵgetSignalGraph: (injector) =>
        injector === personHost
          ? { nodes: [{ id: '1', kind: 'signal', label: 'name', epoch: 1, value: 'Ada' }] }
          : { nodes: [] },
    };
    const graph = collectSignalGraph(withSignals, { selector: 'ns-person' }, tree);
    expect(graph).toMatchObject({
      source: 'selected',
      componentSelector: 'ns-person',
      component: { name: 'PersonComponent', path: 'ns-app > ns-person' },
    });
    expect(graph!.nodes[0]).toMatchObject({ label: 'name', value: 'Ada' });
    expect(collectSignalGraph(withSignals, null, tree)?.component?.name).toBe('PersonComponent');
  });
});
