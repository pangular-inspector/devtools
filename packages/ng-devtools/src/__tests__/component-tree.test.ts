// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectComponentTree,
  componentDetail,
  componentHostOf,
  componentHosts,
  hostPath,
  type ComponentDebugNg,
} from '../component-tree.ts';
import { elementById, elementId } from '../element-id.ts';

const SIGNAL = Symbol('SIGNAL');

function signalOf<T>(value: T) {
  const fn = () => value;
  (fn as unknown as Record<symbol, unknown>)[SIGNAL] = { value };
  return fn;
}

class _App {}
class Shell {}
class Card {
  title = signalOf('Paris');
  price = 120;
  private store = { secret: true };
  selected = { emit: () => {} };
}
class Tooltip {
  text = 'Hi';
}
class Store {}
class Widget {}

function fakeNg(instances: Map<Element, object>, extra: Partial<ComponentDebugNg> = {}) {
  const directives = new Map<Element, object[]>();
  const ng: ComponentDebugNg = {
    getComponent: (el) => instances.get(el) ?? null,
    getDirectives: (el) => directives.get(el) ?? [],
    isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
    ...extra,
  };
  return { ng, directives };
}

describe('collectComponentTree', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds one node per instance with class names, through wrappers', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0">
        <div><router-outlet></router-outlet><ng-component>
          <section><app-card></app-card><app-card></app-card></section>
        </ng-component></div>
      </app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const shell = document.querySelector('ng-component')!;
    const [first, second] = Array.from(document.querySelectorAll('app-card'));
    const { ng, directives } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [shell, new Shell()],
        [first, new Card()],
        [second, new Card()],
      ]),
    );
    directives.set(second, [new Tooltip()]);

    const tree = collectComponentTree(ng);
    expect(tree.count).toBe(4);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]).toMatchObject({ name: 'App', tag: 'app-root' });
    const routed = tree.roots[0].children[0];
    expect(routed).toMatchObject({ name: 'Shell', tag: 'ng-component' });
    expect(routed.children.map((c) => c.name)).toEqual(['Card', 'Card']);
    expect(routed.children[1].directives).toEqual(['Tooltip']);
    expect(routed.children[0].id).not.toBe(routed.children[1].id);
  });

  it('keeps ids off the DOM and resolves them back to the host', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const card = document.querySelector('app-card')!;
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [card, new Card()],
      ]),
    );
    const tree = collectComponentTree(ng);
    const id = tree.roots[0].children[0].id;
    expect(card.getAttributeNames().some((n) => n.startsWith('data-'))).toBe(false);
    expect(elementById(id)).toBe(card);
    expect(elementId(card)).toBe(id);
    expect(collectComponentTree(ng).roots[0].children[0].id).toBe(id);
  });

  it('descends into open shadow roots', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-shadow></app-shadow></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const host = document.querySelector('app-shadow')!;
    const inner = document.createElement('app-widget');
    host.attachShadow({ mode: 'open' }).appendChild(inner);
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [host, new Shell()],
        [inner, new Widget()],
      ]),
    );
    const tree = collectComponentTree(ng);
    expect(tree.roots[0].children[0].children.map((c) => c.name)).toEqual(['Widget']);
    expect(hostPath(ng, inner)).toBe('app-root > app-shadow > app-widget');
  });

  it('indexes hosts wrapped in list items under their nearest component', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0"><app-list><ul>
        <li><app-card></app-card></li><li><app-card></app-card></li>
      </ul></app-list></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const list = document.querySelector('app-list')!;
    const [first, second] = Array.from(document.querySelectorAll('app-card'));
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [list, new Shell()],
        [first, new Card()],
        [second, new Card()],
      ]),
    );
    expect(hostPath(ng, first)).toBe('app-root > app-list > app-card[1]');
    expect(hostPath(ng, second)).toBe('app-root > app-list > app-card[2]');
    expect(hostPath(ng, list)).toBe('app-root > app-list');
  });

  it('indexes hosts inside shadow roots and ignores hosts of nested components', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-shadow></app-shadow></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const host = document.querySelector('app-shadow')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<div><app-widget></app-widget></div><div><app-widget></app-widget></div>
      <app-card><app-widget></app-widget></app-card>`;
    const [first, second, nested] = Array.from(shadow.querySelectorAll('app-widget'));
    const card = shadow.querySelector('app-card')!;
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [host, new Shell()],
        [first, new Widget()],
        [second, new Widget()],
        [card, new Card()],
        [nested, new Widget()],
      ]),
    );
    expect(hostPath(ng, first)).toBe('app-root > app-shadow > app-widget[1]');
    expect(hostPath(ng, second)).toBe('app-root > app-shadow > app-widget[2]');
    expect(hostPath(ng, nested)).toBe('app-root > app-shadow > app-card > app-widget');
  });

  it('reports which cap stopped the tree', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const instances = new Map<Element, object>([[root, new _App()]]);
    for (let i = 0; i < 2000; i++) {
      const card = document.createElement('app-card');
      root.appendChild(card);
      instances.set(card, new Card());
    }
    const { ng } = fakeNg(instances);
    const wide = collectComponentTree(ng);
    expect(wide).toMatchObject({ count: 2000, truncated: true, truncatedBy: { components: 2000 } });
    expect(wide.truncatedBy?.depth).toBeUndefined();

    root.innerHTML = '';
    let parent: Element = root;
    for (let i = 0; i < 300; i++) parent = parent.appendChild(document.createElement('div'));
    const deep = collectComponentTree(fakeNg(new Map([[root, new _App()]])).ng);
    expect(deep).toMatchObject({ count: 1, truncated: true, truncatedBy: { depth: 256 } });
    expect(deep.truncatedBy?.components).toBeUndefined();
  }, 20_000);

  it('reports nothing without the debug API instead of guessing from tag names', () => {
    document.body.innerHTML = `<custom-widget><nested-item></nested-item></custom-widget>`;
    expect(collectComponentTree(undefined)).toEqual({ roots: [], count: 0, detail: null });
  });

  it('walks the body when no root is tagged with ng-version', () => {
    document.body.innerHTML = `<main><app-card></app-card></main>`;
    const card = document.querySelector('app-card')!;
    const { ng } = fakeNg(new Map<Element, object>([[card, new Card()]]));
    expect(collectComponentTree(ng).roots.map((n) => n.tag)).toEqual(['app-card']);
    expect(componentHosts(ng)).toEqual([card]);
  });

  it('includes component hosts outside the ng-version root, such as overlays', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0"><app-card></app-card></app-root>
      <div class="cdk-overlay-container"><div class="pane"><app-dialog></app-dialog></div></div>`;
    const [root] = document.getElementsByTagName('app-root');
    const card = document.querySelector('app-card')!;
    const dialog = document.querySelector('app-dialog')!;
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [card, new Card()],
        [dialog, new Widget()],
      ]),
    );
    const tree = collectComponentTree(ng);
    expect(tree.roots.map((n) => n.tag)).toEqual(['app-root', 'app-dialog']);
    expect(tree.count).toBe(3);
    expect(componentHosts(ng)).toEqual([root, card, dialog]);
    const id = tree.roots[1].id;
    expect(collectComponentTree(ng, { selectedId: id }).detail?.tag).toBe('app-dialog');
  });

  it('redacts secret inputs and tokens inside input values', () => {
    document.body.innerHTML = `<app-login></app-login>`;
    const host = document.querySelector('app-login')!;
    const login = {
      password: 'hunter2',
      apiKey: 'k-123',
      model: signalOf({ email: 'a@b.c', password: 'x', token: 'eyJhbGciOi.eyJzdWIiOi.abcdefgh' }),
      header: 'Bearer abc.def',
      remember: true,
    };
    const { ng } = fakeNg(new Map<Element, object>([[host, login]]), {
      getDirectiveMetadata: () => ({
        inputs: {
          password: 'password',
          key: 'apiKey',
          model: 'model',
          header: 'header',
          rememberPassword: 'remember',
        },
        outputs: {},
      }),
    });
    const values = Object.fromEntries(
      componentDetail(ng, host)!.inputs.map((i) => [i.name, i.value]),
    );
    expect(values).toEqual({
      password: '[redacted]',
      key: '[redacted]',
      model: { email: 'a@b.c', password: '[redacted]', token: '[redacted]' },
      header: 'Bearer [redacted]',
      rememberPassword: true,
    });
  });

  it('adds the live detail of the selected instance only', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card><app-card></app-card></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const [first, second] = Array.from(document.querySelectorAll('app-card'));
    const cardA = new Card();
    const cardB = new Card();
    cardB.title = signalOf('Rome');
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [first, cardA],
        [second, cardB],
      ]),
      {
        getDirectiveMetadata: (inst) =>
          inst instanceof Card
            ? {
                inputs: { title: 'title', cost: 'price' },
                outputs: { selected: 'selected' },
                changeDetection: 0,
                encapsulation: 0,
              }
            : null,
      },
    );
    expect(collectComponentTree(ng).detail).toBeNull();
    const secondId = elementId(second);
    const tree = collectComponentTree(ng, { selectedId: secondId });
    expect(tree.detail).toMatchObject({
      id: secondId,
      name: 'Card',
      path: 'app-root > app-card[2]',
      changeDetection: 'OnPush',
      encapsulation: 'Emulated',
      inputs: [
        { name: 'title', prop: 'title', value: 'Rome' },
        { name: 'cost', prop: 'price', value: 120 },
      ],
    });
  });

  it('labels change detection value 1 as Eager', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const card = document.querySelector('app-card')!;
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [card, new Card()],
      ]),
      { getDirectiveMetadata: () => ({ changeDetection: 1 }) },
    );
    const tree = collectComponentTree(ng, { selectedId: elementId(card) });
    expect(tree.detail?.changeDetection).toBe('Eager');
  });
});

describe('componentHostOf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves an element to the nearest component host, through shadow roots', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-shadow></app-shadow><p></p></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const host = document.querySelector('app-shadow')!;
    const paragraph = document.querySelector('p')!;
    const button = document.createElement('button');
    host.attachShadow({ mode: 'open' }).appendChild(button);
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [host, new Shell()],
      ]),
    );
    expect(componentHostOf(ng, host)).toBe(host);
    expect(componentHostOf(ng, button)).toBe(host);
    expect(componentHostOf(ng, paragraph)).toBe(root);
    expect(componentHostOf(ng, document.body)).toBeNull();
    expect(componentHostOf(undefined, host)).toBeNull();
  });
});

describe('componentDetail', () => {
  it('reads outputs, listeners, host directives and dependencies', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card tooltip></app-card></app-root>`;
    const [root] = document.getElementsByTagName('app-root');
    const card = document.querySelector('app-card')!;
    const rootEnv = { scopes: new Set(['root']) };
    const inst = new Card();
    const tooltip = new Tooltip();
    const { ng, directives } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [card, inst],
      ]),
      {
        getDirectiveMetadata: (i) =>
          i === inst
            ? { inputs: {}, outputs: { selected: 'selected', closed: 'closed' }, encapsulation: 2 }
            : { inputs: { tooltip: ['text', 0] }, outputs: {} },
        getListeners: () => [
          { name: 'selected', type: 'output' },
          { name: 'click', type: 'dom' },
          { name: 'click', type: 'dom' },
        ],
        getInjector: (el) => ({ el }),
        ɵgetInjectorMetadata: (inj) =>
          inj === rootEnv
            ? { type: 'environment', source: 'R3Injector' }
            : { type: 'element', source: (inj as { el: Element }).el },
        ɵgetDependenciesFromInjectable: (_inj, ctor) =>
          ctor === Card
            ? {
                dependencies: [
                  { token: Store, flags: { optional: false }, providedIn: rootEnv },
                  { token: Widget, flags: { optional: true } },
                ],
              }
            : { dependencies: [] },
      },
    );
    directives.set(card, [inst, tooltip]);

    const detail = componentDetail(ng, card)!;
    expect(detail.encapsulation).toBe('None');
    expect(detail.changeDetection).toBeUndefined();
    expect(detail.outputs).toEqual([
      { name: 'selected', prop: 'selected', listened: true },
      { name: 'closed', prop: 'closed', listened: false },
    ]);
    expect(detail.listeners).toEqual(['click']);
    expect(detail.directives).toEqual([
      { name: 'Tooltip', inputs: [{ name: 'tooltip', prop: 'text', value: 'Hi' }], outputs: [] },
    ]);
    expect(detail.dependencies).toEqual([
      {
        from: 'Card',
        token: 'Store',
        flags: [],
        providedBy: expect.any(String),
        providedByName: 'Root',
      },
      { from: 'Card', token: 'Widget', flags: ['optional'], providedBy: null },
    ]);
  });

  it('does not list private state as inputs', () => {
    document.body.innerHTML = `<app-card></app-card>`;
    const card = document.querySelector('app-card')!;
    const { ng } = fakeNg(new Map<Element, object>([[card, new Card()]]), {
      getDirectiveMetadata: () => ({ inputs: { title: 'title' }, outputs: {} }),
    });
    expect(componentDetail(ng, card)!.inputs.map((i) => i.name)).toEqual(['title']);
  });
});

describe('component properties', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  class TripList {
    trips = signalOf(['Rome', 'Lisbon']);
    loading = false;
    filters = { city: 'Rome', sessionToken: 'abc' };
    password = 'hunter2';
    title = signalOf('Trips');
    picked = { emit: () => {} };
    http = new Store();
    __ngContext__ = 7;
    select() {}
    reload = () => {};
  }

  function detailFor(instance: object, extra: Partial<ComponentDebugNg> = {}) {
    document.body.innerHTML = `<app-trip-list></app-trip-list>`;
    const host = document.querySelector('app-trip-list')!;
    const { ng } = fakeNg(new Map<Element, object>([[host, instance]]), {
      getDirectiveMetadata: () => ({ inputs: { heading: 'title' }, outputs: { picked: 'picked' } }),
      getInjector: () => ({}),
      ɵgetInjectorMetadata: () => ({ type: 'element', source: host }),
      ...extra,
    });
    return componentDetail(ng, host)!;
  }

  it('lists own fields that are not inputs, outputs, services or methods, with signals unwrapped', () => {
    const list = new TripList();
    const detail = detailFor(list, {
      ɵgetDependenciesFromInjectable: () => ({
        dependencies: [{ token: Store, value: list.http, flags: {} }],
      }),
    });
    expect(detail.properties).toEqual([
      { name: 'trips', prop: 'trips', value: ['Rome', 'Lisbon'], kind: 'signal' },
      { name: 'loading', prop: 'loading', value: false },
      { name: 'filters', prop: 'filters', value: { city: 'Rome', sessionToken: '[redacted]' } },
      { name: 'password', prop: 'password', value: '[redacted]' },
    ]);
  });

  it('shows the status, value and error of a resource', () => {
    const status = signalOf('error');
    const value = signalOf(undefined);
    const error = signalOf(new Error('Offline'));
    const detail = detailFor({ trips: { status, value, error, hasValue: () => false } });
    expect(detail.properties).toEqual([
      {
        name: 'trips',
        prop: 'trips',
        kind: 'resource',
        value: { status: 'error', error: 'Error: Offline' },
      },
    ]);
  });

  it('caps the number of properties and the size of each value', () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 80; i++) many[`field${i}`] = i;
    many['field0'] = { list: Array.from({ length: 100 }, (_, i) => i) };
    const detail = detailFor(many);
    expect(detail.properties).toHaveLength(60);
    const list = (detail.properties[0].value as { list: unknown[] }).list;
    expect(list.length).toBeLessThanOrEqual(31);
  });
});

describe('element ids', () => {
  it('differ between page loads, so a stale selection matches nothing', async () => {
    const el = document.createElement('app-card');
    vi.resetModules();
    const first = (await import('../element-id.ts')).elementId(el);
    vi.resetModules();
    const again = await import('../element-id.ts');
    const second = again.elementId(el);
    expect(second).not.toBe(first);
    expect(again.elementById(first)).toBeNull();
  });
});
