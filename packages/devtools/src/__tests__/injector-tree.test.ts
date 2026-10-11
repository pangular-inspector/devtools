// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  MAX_INJECTOR_NODES,
  collectInjectorTree,
  providerKind,
  tokenName,
} from '../injector-tree.ts';
import { zoneModeOf } from '../zone-mode.ts';

class ElementRef {
  static __NG_ELEMENT_ID__ = 1;
}
class Store {}
class Logger {}
class App {}
class Card {}
class Tooltip {}
const API_URL = { _desc: 'API_URL', toString: () => 'InjectionToken API_URL' };
const THEME = { _desc: 'THEME', toString: () => 'InjectionToken THEME' };

function fakeNg() {
  document.body.innerHTML = `
    <app-root>
      <header><a href="/">Home</a></header>
      <main><div><app-card tooltip></app-card></div></main>
    </app-root>`;
  const root = document.querySelector('app-root')!;
  const card = document.querySelector('app-card')!;

  const nullInjector = { kind: 'null' };
  const platform = { kind: 'env', scopes: new Set(['platform']), source: 'Platform: core' };
  const rootEnv = { kind: 'env', scopes: new Set(['root']), source: 'Environment Injector' };
  const routeEnv = { kind: 'env', scopes: new Set(), source: 'Route: cards' };
  const node = (el: Element) => ({ kind: 'node', el });

  const meta = (inj: any) =>
    inj.kind === 'node'
      ? { type: 'element', source: inj.el }
      : inj.kind === 'null'
        ? { type: 'null', source: null }
        : { type: 'environment', source: inj.source };

  return {
    root,
    card,
    ng: {
      getInjector: (el: Element) => node(el),
      getComponent: (el: Element) => (el === root ? new App() : el === card ? new Card() : null),
      getDirectives: (el: Element) =>
        el === root ? [new App()] : el === card ? [new Card(), new Tooltip()] : [],
      ɵgetInjectorMetadata: meta,
      ɵgetInjectorResolutionPath: (inj: any) =>
        inj.el === card
          ? [inj, node(root), routeEnv, rootEnv, platform, nullInjector]
          : [inj, rootEnv, platform, nullInjector],
      ɵgetInjectorProviders: (inj: any) => {
        if (inj === rootEnv)
          return [
            { token: Store, provider: Store, importPath: [App] },
            { token: API_URL, provider: { provide: API_URL, useValue: '/api' } },
          ];
        if (inj.el === card)
          return [
            { token: ElementRef, provider: ElementRef },
            {
              token: Logger,
              provider: { provide: Logger, useFactory: () => 0 },
              isViewProvider: true,
            },
          ];
        return [{ token: ElementRef, provider: ElementRef }];
      },
      ɵgetDependenciesFromInjectable: (_inj: any, ctor: unknown) =>
        ctor === Card
          ? {
              dependencies: [
                { token: Store, flags: { optional: false }, providedIn: rootEnv },
                { token: Logger, flags: { self: true }, providedIn: node(card) },
                { token: THEME, flags: { optional: true } },
              ],
            }
          : { dependencies: [] },
    } as any,
  };
}

describe('collectInjectorTree', () => {
  it('only lists elements that carry a component or directive', () => {
    const { ng } = fakeNg();
    const { roots } = collectInjectorTree(ng);
    expect(roots).toHaveLength(1);
    expect(roots[0].injector).toMatchObject({ name: 'app-root', component: 'App' });
    expect(roots[0].children.map((c) => c.injector.name)).toEqual(['app-card']);
    expect(roots[0].children[0].injector.directives).toEqual(['Card', 'Tooltip']);
  });

  it('drops built-in element tokens and names provider kinds', () => {
    const { ng } = fakeNg();
    const card = collectInjectorTree(ng).roots[0].children[0];
    expect(card.providers).toEqual([{ token: 'Logger', type: 'factory', isViewProvider: true }]);
    expect(card.injector.providerCount).toBe(1);
  });

  it('builds the environment chain from the platform down', () => {
    const { ng } = fakeNg();
    const { environment } = collectInjectorTree(ng);
    expect(environment.map((e) => e.injector.name)).toEqual(['Platform']);
    const root = environment[0].children[0];
    expect(root.injector.name).toBe('Root');
    expect(root.children.map((c) => c.injector.name)).toEqual(['Route: cards']);
    expect(root.providers).toEqual([
      { token: 'Store', type: 'class', isViewProvider: false, importPath: ['App'] },
      { token: 'API_URL', type: 'value', isViewProvider: false },
    ]);
  });

  it('reports what each component injected and which injector supplied it', () => {
    const { ng } = fakeNg();
    const { roots, environment } = collectInjectorTree(ng);
    const card = roots[0].children[0];
    const rootId = environment[0].children[0].injector.id;
    expect(card.dependencies).toEqual([
      { from: 'Card', token: 'Store', flags: [], providedBy: rootId },
      { from: 'Card', token: 'Logger', flags: ['self'], providedBy: card.injector.id },
      { from: 'Card', token: 'THEME', flags: ['optional'], providedBy: null },
    ]);
    expect(card.injector.path).toEqual([
      card.injector.id,
      roots[0].injector.id,
      environment[0].children[0].children[0].injector.id,
      rootId,
      environment[0].injector.id,
      'inj-null',
    ]);
  });

  it('keeps ids stable between collections and gives each element a selector', () => {
    const { ng, card } = fakeNg();
    const first = collectInjectorTree(ng).roots[0].children[0].injector;
    const again = collectInjectorTree(ng).roots[0].children[0].injector;
    expect(again.id).toBe(first.id);
    expect(document.querySelector(first.selector!)).toBe(card);
  });

  it('reads element providers and dependencies once per element', () => {
    const { ng } = fakeNg();
    let calls = 0;
    const providers = ng.ɵgetInjectorProviders;
    ng.ɵgetInjectorProviders = (inj: any) => {
      if (inj.kind === 'node') calls++;
      return providers(inj);
    };
    const first = collectInjectorTree(ng);
    const afterFirst = calls;
    const again = collectInjectorTree(ng);
    expect(afterFirst).toBe(3);
    expect(calls).toBe(afterFirst);
    expect(again).toEqual(first);
  });

  it('caps the number of element nodes and says so', () => {
    document.body.innerHTML = `<ul>${'<li></li>'.repeat(MAX_INJECTOR_NODES + 5)}</ul>`;
    const env = { kind: 'env' };
    const ng = {
      getInjector: (el: Element) => ({ kind: 'node', el }),
      getComponent: () => null,
      getDirectives: (el: Element) => (el.tagName === 'LI' ? [new Tooltip()] : []),
      ɵgetInjectorMetadata: (inj: any) =>
        inj.kind === 'node'
          ? { type: 'element', source: inj.el }
          : { type: 'environment', source: 'R' },
      ɵgetInjectorResolutionPath: (inj: any) => [inj, env],
      ɵgetInjectorProviders: () => [],
    } as any;
    const report = collectInjectorTree(ng);
    expect(report.roots).toHaveLength(MAX_INJECTOR_NODES);
    expect(report.truncated).toBe(true);
    expect(document.querySelector(report.roots[1].injector.selector!)).toBe(
      document.querySelectorAll('li')[1],
    );
  });

  it('walks into shadow roots and nests their injectors under the host', () => {
    document.body.innerHTML = '<app-root><app-shell></app-shell></app-root>';
    const root = document.querySelector('app-root')!;
    const shell = document.querySelector('app-shell')!;
    const shadow = shell.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<section><app-child></app-child></section>';
    const child = shadow.querySelector('app-child')!;
    const components = new Map<Element, object>([
      [root, new App()],
      [shell, new Card()],
      [child, new Tooltip()],
    ]);
    const env = { kind: 'env' };
    const ng = {
      getInjector: (el: Element) => ({ kind: 'node', el }),
      getComponent: (el: Element) => components.get(el) ?? null,
      getDirectives: (el: Element) => (components.has(el) ? [components.get(el)] : []),
      ɵgetInjectorMetadata: (inj: any) =>
        inj.kind === 'node'
          ? { type: 'element', source: inj.el }
          : { type: 'environment', source: 'R' },
      ɵgetInjectorResolutionPath: (inj: any) => [inj, env],
      ɵgetInjectorProviders: () => [],
    } as any;
    const { roots } = collectInjectorTree(ng);
    expect(roots.map((r) => r.injector.name)).toEqual(['app-root']);
    const shellNode = roots[0].children[0];
    expect(shellNode.injector.name).toBe('app-shell');
    expect(document.querySelector(shellNode.injector.selector!)).toBe(shell);
    expect(shellNode.children.map((c) => c.injector)).toEqual([
      expect.objectContaining({ name: 'app-child', component: 'Tooltip' }),
    ]);
    expect(shellNode.children[0].injector).not.toHaveProperty('selector');
  });

  it('lists ng-container injectors and keeps them on the lookup path', () => {
    document.body.innerHTML = '<app-root><app-card></app-card></app-root>';
    const root = document.querySelector('app-root')!;
    const card = document.querySelector('app-card')!;
    const container = document.createComment('ng-container');
    root.insertBefore(container, card);
    const env = { kind: 'env' };
    const node = (el: Node) => ({ kind: 'node', el });
    const containerInjector = node(container);
    const ng = {
      getInjector: (el: Node) => (el === container ? containerInjector : node(el)),
      getComponent: (el: Element) => (el === root ? new App() : el === card ? new Card() : null),
      getDirectives: (el: Node) =>
        el === root
          ? [new App()]
          : el === card
            ? [new Card()]
            : el === container
              ? [new Tooltip()]
              : [],
      ɵgetInjectorMetadata: (inj: any) =>
        inj.kind === 'node'
          ? { type: 'element', source: inj.el }
          : { type: 'environment', source: 'R' },
      ɵgetInjectorResolutionPath: (inj: any) =>
        inj.el === card ? [inj, containerInjector, node(root), env] : [inj, env],
      ɵgetInjectorProviders: (inj: any) =>
        inj === containerInjector ? [{ token: Logger, provider: Logger }] : [],
      ɵgetDependenciesFromInjectable: (_inj: any, ctor: unknown) =>
        ctor === Card
          ? { dependencies: [{ token: Logger, flags: {}, providedIn: containerInjector }] }
          : { dependencies: [] },
    } as any;
    const { roots } = collectInjectorTree(ng);
    const [containerNode, cardNode] = roots[0].children;
    expect(containerNode.injector).toMatchObject({ name: 'ng-container', directives: ['Tooltip'] });
    expect(containerNode.injector).not.toHaveProperty('selector');
    expect(containerNode.providers.map((p) => p.token)).toEqual(['Logger']);
    expect(cardNode.injector.path).toContain(containerNode.injector.id);
    expect(cardNode.dependencies).toEqual([
      { from: 'Card', token: 'Logger', flags: [], providedBy: containerNode.injector.id },
    ]);
  });

  it('finds a provider whose value is null on the lookup path', () => {
    const { ng } = fakeNg();
    const lookup = ng.ɵgetDependenciesFromInjectable;
    ng.ɵgetDependenciesFromInjectable = (inj: any, ctor: unknown) =>
      ctor === Card
        ? {
            dependencies: [
              { token: API_URL, flags: {} },
              { token: Logger, flags: { skipSelf: true } },
            ],
          }
        : lookup(inj, ctor);
    const { roots, environment } = collectInjectorTree(ng);
    const rootId = environment[0].children[0].injector.id;
    expect(roots[0].children[0].dependencies).toEqual([
      { from: 'Card', token: 'API_URL', flags: [], providedBy: rootId },
      { from: 'Card', token: 'Logger', flags: ['skipSelf'], providedBy: null },
    ]);
  });

  it('lists what the services an environment injector created inject, and never creates one', () => {
    const { ng } = fakeNg();
    class Http {}
    class Api {}
    class Pending {}
    const NOT_YET = {};
    const rootEnv = ng.ɵgetInjectorResolutionPath({ kind: 'node' })[1];
    rootEnv.records = new Map<unknown, unknown>([
      [Api, { factory: () => new Api(), value: new Api() }],
      [Pending, { factory: () => new Pending(), value: NOT_YET }],
      [Http, { factory: () => new Http(), value: new Http() }],
      [API_URL, { factory: undefined, value: '/api' }],
    ]);
    const asked: unknown[] = [];
    const lookup = ng.ɵgetDependenciesFromInjectable;
    ng.ɵgetDependenciesFromInjectable = (inj: any, token: unknown) => {
      if (inj.kind === 'node') return lookup(inj, token);
      asked.push(token);
      return token === Api
        ? {
            dependencies: [
              { token: Http, flags: {}, providedIn: rootEnv },
              { token: API_URL, flags: { optional: true } },
            ],
          }
        : { dependencies: [] };
    };
    const { environment } = collectInjectorTree(ng);
    const root = environment[0].children[0];
    expect(root.dependencies).toEqual([
      { from: 'Api', token: 'Http', flags: [], providedBy: root.injector.id },
      { from: 'Api', token: 'API_URL', flags: ['optional'], providedBy: root.injector.id },
    ]);
    expect(environment[0].dependencies).toEqual([]);
    expect(asked).toEqual([Api, Http]);
    collectInjectorTree(ng);
    expect(asked).toEqual([Api, Http]);
  });

  it('lists a service dependency once when the service injects it several times', () => {
    const { ng } = fakeNg();
    class Zone {}
    class Destroy {}
    const rootEnv = ng.ɵgetInjectorResolutionPath({ kind: 'node' })[1];
    rootEnv.records = new Map<unknown, unknown>([
      [Zone, { factory: () => new Zone(), value: new Zone() }],
    ]);
    const lookup = ng.ɵgetDependenciesFromInjectable;
    ng.ɵgetDependenciesFromInjectable = (inj: any, token: unknown) => {
      if (inj.kind === 'node') return lookup(inj, token);
      const dep = { token: Destroy, flags: { optional: true }, providedIn: rootEnv };
      return token === Zone
        ? { dependencies: [dep, dep, dep, { ...dep, flags: {} }, dep] }
        : { dependencies: [] };
    };
    const root = collectInjectorTree(ng).environment[0].children[0];
    expect(root.dependencies).toEqual([
      { from: 'Zone', token: 'Destroy', flags: ['optional'], providedBy: root.injector.id },
      { from: 'Zone', token: 'Destroy', flags: [], providedBy: root.injector.id },
    ]);
  });

  it('reports the change detection mode from the NgZone the root injector created', () => {
    class NgZone {
      _inner = {};
      run() {}
    }
    class NoopNgZone {
      run() {}
    }
    const root = (zone: object | undefined) => ({
      records: new Map<unknown, unknown>([[NgZone, { factory: () => zone, value: zone }]]),
    });
    expect(zoneModeOf(root(new NgZone()), { Zone: {} })).toBe('zone');
    expect(zoneModeOf(root(new NoopNgZone()), {})).toBe('zoneless');
    expect(zoneModeOf(root(new NoopNgZone()), { Zone: {} })).toBe('zone-unused');
    expect(zoneModeOf(root({}), {})).toBeNull();
    expect(zoneModeOf({ records: new Map() }, {})).toBeNull();
    expect(zoneModeOf(null)).toBeNull();

    const { ng } = fakeNg();
    const rootEnv = ng.ɵgetInjectorResolutionPath({ kind: 'node' })[1];
    expect(collectInjectorTree(ng)).not.toHaveProperty('zone');
    Object.assign(rootEnv, root(new NoopNgZone()));
    expect(collectInjectorTree(ng).zone).toBe(
      typeof (globalThis as { Zone?: unknown }).Zone === 'undefined' ? 'zoneless' : 'zone-unused',
    );
  });

  it('returns nothing without the Angular debug APIs', () => {
    expect(collectInjectorTree(undefined)).toEqual({ roots: [], environment: [] });
  });
});

describe('token and provider naming', () => {
  it('reads class names and injection token descriptions', () => {
    expect(tokenName(Store)).toBe('Store');
    expect(tokenName(API_URL)).toBe('API_URL');
    expect(tokenName({ toString: () => 'InjectionToken X' })).toBe('X');
  });

  it('tells provider kinds apart', () => {
    expect(providerKind(Store)).toBe('class');
    expect(providerKind({ useValue: 0 })).toBe('value');
    expect(providerKind({ useFactory: () => 0 })).toBe('factory');
    expect(providerKind({ useExisting: Store })).toBe('existing');
    expect(providerKind({ useClass: Store })).toBe('class');
  });
});
