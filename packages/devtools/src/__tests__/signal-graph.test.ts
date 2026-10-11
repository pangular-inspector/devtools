// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { elementId } from '../element-id.ts';
import {
  MAX_NODES,
  collectSignalGraph,
  graphKey,
  injectorMatches,
  isEnvironmentRequest,
  routedComponent,
  toSignalTarget,
  type SignalDebugNg,
} from '../signal-graph.ts';

const SIGNAL = Symbol('SIGNAL');
const UNSET = Symbol('UNSET');

class Root {}
class Shell {}
class Page {}
class Card {}
class Popup {}

function fakeNg(
  components: Record<string, object>,
  graphOf: (el: Element) => ReturnType<NonNullable<SignalDebugNg['ɵgetSignalGraph']>> = (el) => ({
    nodes: [{ id: '1', kind: 'signal', label: el.tagName.toLowerCase(), epoch: 1, value: 1 }],
    edges: [],
  }),
): SignalDebugNg {
  return {
    getComponent: (el) => components[el.tagName] ?? null,
    getInjector: (el) => el,
    ɵgetSignalGraph: (injector) => graphOf(injector as Element),
    isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
  };
}

const standard = {
  'APP-ROOT': new Root(),
  'APP-SHELL': new Shell(),
  'APP-PAGE': new Page(),
  'APP-CARD': new Card(),
  'APP-POPUP': new Popup(),
};

describe('collectSignalGraph target', () => {
  it('follows the deepest component of the primary outlet chain', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0">
        <router-outlet></router-outlet><app-shell>
          <router-outlet></router-outlet><app-page><app-card></app-card></app-page>
        </app-shell>
        <router-outlet name="popup"></router-outlet><app-popup></app-popup>
      </app-root>`;
    const ng = fakeNg(standard);
    expect(routedComponent(ng)?.tagName).toBe('APP-PAGE');
    const graph = collectSignalGraph(ng)!;
    expect(graph.componentSelector).toBe('app-page');
    expect(graph.source).toBe('routed');
    expect(graph.component).toMatchObject({
      name: 'Page',
      tag: 'app-page',
      path: 'app-root > app-shell > app-page',
    });
  });

  it('ignores a primary outlet nested inside an auxiliary route', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0">
        <router-outlet></router-outlet><app-page></app-page>
        <router-outlet name="popup"></router-outlet><app-popup>
          <div><router-outlet></router-outlet><app-card></app-card></div>
        </app-popup>
      </app-root>`;
    expect(routedComponent(fakeNg(standard))?.tagName).toBe('APP-PAGE');
  });

  it('targets one instance by id, so the second of a list can be inspected', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0"><app-card></app-card><app-card></app-card></app-root>`;
    const second = document.querySelectorAll('app-card')[1];
    const ng = fakeNg(standard, (el) => ({
      nodes: [
        {
          id: '1',
          kind: 'signal',
          label: el === second ? 'second' : 'other',
          epoch: 1,
          value: 0,
        },
      ],
      edges: [],
    }));
    const graph = collectSignalGraph(ng, { id: elementId(second) })!;
    expect(graph.source).toBe('selected');
    expect(graph.nodes[0].label).toBe('second');
    expect(graph.component?.path).toBe('app-root > app-card[2]');
  });

  it('falls back when the target is not a component host, missing or invalid', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><div class="plain"></div></app-root>`;
    const ng = fakeNg(standard);
    const plain = document.querySelector('.plain')!;
    expect(collectSignalGraph(ng, { id: elementId(plain) })?.componentSelector).toBe('app-root');
    expect(collectSignalGraph(ng, { selector: 'app-gone' })?.componentSelector).toBe('app-root');
    expect(collectSignalGraph(ng, { selector: '[[bad' })?.componentSelector).toBe('app-root');
    expect(collectSignalGraph(ng, { selector: 'app-root' })?.source).toBe('selected');
  });

  it('finds a component host without relying on _nghost attributes', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card></app-root>`;
    const ng = fakeNg(standard, (el) =>
      el.tagName === 'APP-CARD'
        ? { nodes: [{ id: '9', kind: 'signal', epoch: 0 }], edges: [] }
        : { nodes: [], edges: [] },
    );
    expect(collectSignalGraph(ng)?.componentSelector).toBe('app-card');
  });

  it('keeps an empty root graph only when no host has signals', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"><app-card></app-card></app-root>`;
    const ng = fakeNg(standard, () => ({ nodes: [], edges: [] }));
    const graph = collectSignalGraph(ng)!;
    expect(graph.componentSelector).toBe('app-root');
    expect(graph.nodes).toEqual([]);
  });

  it('falls back to a dialog host outside the ng-version root', () => {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0"></app-root>
      <div class="cdk-overlay-container"><div class="pane"><app-popup></app-popup></div></div>`;
    const ng = fakeNg(standard, (el) =>
      el.tagName === 'APP-POPUP'
        ? { nodes: [{ id: '1', kind: 'signal', label: 'open', epoch: 1, value: true }], edges: [] }
        : { nodes: [], edges: [] },
    );
    expect(collectSignalGraph(ng)?.componentSelector).toBe('app-popup');
  });
});

describe('collectSignalGraph values', () => {
  it('reads linkedSignal values from the component fields and names sentinels', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    const selection = () => 'Paris';
    (selection as unknown as Record<symbol, unknown>)[SIGNAL] = {
      kind: 'linkedSignal',
      debugName: 'selection',
      version: 2,
      value: 'Paris',
    };
    const other = () => 'nope';
    (other as unknown as Record<symbol, unknown>)[SIGNAL] = { kind: 'signal', debugName: 'other' };
    const root = Object.assign(new Root(), { selection, other });
    const ng = fakeNg({ 'APP-ROOT': root }, () => ({
      nodes: [
        { id: '1', kind: 'linkedSignal', label: 'selection', epoch: 2 },
        { id: '2', kind: 'computed', label: 'total', epoch: 0, value: UNSET },
        { id: '3', kind: 'computed', label: 'map', epoch: 1, value: new Map([['a', 1]]) },
        { id: '4', kind: 'effect', label: 'log', epoch: 1 },
      ],
      edges: [{ consumer: 3, producer: 0 }],
    }));
    const graph = collectSignalGraph(ng)!;
    expect(graph.nodes[0].value).toBe('Paris');
    expect(graph.nodes[1].value).toBe('(not computed yet)');
    expect(graph.nodes[2].value).toEqual({ $type: 'Map', size: 1, entries: [['a', 1]] });
    expect('value' in graph.nodes[3]).toBe(false);
    expect(graph.nodes.some((n) => 'watched' in n)).toBe(false);
  });

  it('redacts secret-named signals and tokens inside values', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijk';
    const password = () => 'hunter2';
    (password as unknown as Record<symbol, unknown>)[SIGNAL] = {
      kind: 'linkedSignal',
      debugName: 'password',
      version: 1,
      value: 'hunter2',
    };
    const root = Object.assign(new Root(), { password });
    const ng = fakeNg({ 'APP-ROOT': root }, () => ({
      nodes: [
        {
          id: '1',
          kind: 'signal',
          label: 'model',
          epoch: 1,
          value: { email: 'a@b.c', password: 'x' },
        },
        { id: '2', kind: 'signal', label: 'accessToken', epoch: 1, value: 'abc123' },
        { id: '3', kind: 'linkedSignal', label: 'password', epoch: 1 },
        { id: '4', kind: 'computed', label: 'header', epoch: 1, value: `Bearer ${jwt}` },
      ],
      edges: [],
    }));
    const graph = collectSignalGraph(ng)!;
    expect(graph.nodes[0].value).toEqual({ email: 'a@b.c', password: '[redacted]' });
    expect(graph.nodes[1].value).toBe('[redacted]');
    expect(graph.nodes[2].value).toBe('[redacted]');
    expect(graph.nodes[3].value).not.toContain('eyJ');
  });

  it('keys a graph by component, node ids and epochs', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    let epoch = 1;
    const ng = fakeNg(standard, () => ({
      nodes: [{ id: '1', kind: 'signal', label: 'count', epoch, value: epoch }],
      edges: [],
    }));
    const first = graphKey(collectSignalGraph(ng)!);
    expect(graphKey(collectSignalGraph(ng)!)).toBe(first);
    epoch = 2;
    expect(graphKey(collectSignalGraph(ng)!)).not.toBe(first);
  });
});

function linked(debugName: string, version: number, value: unknown, extra: object = {}) {
  const getter = () => {
    throw new Error('the overlay must not call the signal');
  };
  (getter as unknown as Record<symbol, unknown>)[SIGNAL] = {
    kind: 'linkedSignal',
    debugName,
    version,
    value,
    ...extra,
  };
  return getter;
}

describe('collectSignalGraph linkedSignal values', () => {
  const graphWith = (root: object, nodes: { id: string; label: string; epoch: number }[]) => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    return collectSignalGraph(
      fakeNg({ 'APP-ROOT': root }, () => ({
        nodes: nodes.map((n) => ({ ...n, kind: 'linkedSignal' })),
        edges: [],
      })),
    )!;
  };

  it('gives a same-named store node no value instead of the component one', () => {
    const root = Object.assign(new Root(), { selectedId: linked('selectedId', 3, 'local') });
    const graph = graphWith(root, [
      { id: '1', label: 'selectedId', epoch: 3 },
      { id: '2', label: 'selectedId', epoch: 7 },
    ]);
    expect(graph.nodes[0].value).toBe('local');
    expect('value' in graph.nodes[1]).toBe(false);
  });

  it('shows nothing when two same-named nodes share the version of the field', () => {
    const root = Object.assign(new Root(), { selectedId: linked('selectedId', 1, 'local') });
    const graph = graphWith(root, [
      { id: '1', label: 'selectedId', epoch: 1 },
      { id: '2', label: 'selectedId', epoch: 1 },
    ]);
    expect(graph.nodes.some((n) => 'value' in n)).toBe(false);
  });

  it('shows nothing when two fields match the same name and version', () => {
    const root = Object.assign(new Root(), {
      a: linked('selectedId', 3, 'one'),
      b: linked('selectedId', 3, 'two'),
    });
    const graph = graphWith(root, [{ id: '1', label: 'selectedId', epoch: 3 }]);
    expect('value' in graph.nodes[0]).toBe(false);
  });

  it('skips a dirty node and never runs the computation', () => {
    const root = Object.assign(new Root(), {
      selectedId: linked('selectedId', 3, 'stale', { dirty: true }),
    });
    const graph = graphWith(root, [{ id: '1', label: 'selectedId', epoch: 3 }]);
    expect('value' in graph.nodes[0]).toBe(false);
  });
});

describe('collectSignalGraph limits and versions', () => {
  it('marks a graph whose nodes have no ids (Angular before 20.1) as unsupported', () => {
    document.body.innerHTML = `<app-root ng-version="20.0.0"></app-root>`;
    const ng = fakeNg(standard, () => ({
      nodes: [
        { kind: 'signal', label: 'count', value: 1 },
        { kind: 'template', label: 'app-root' },
      ] as never,
      edges: [{ consumer: 1, producer: 0 }],
    }));
    const graph = collectSignalGraph(ng)!;
    expect(graph).toEqual({ nodes: [], edges: [], unsupported: true });
    expect(graphKey(graph)).toBe(graphKey(collectSignalGraph(ng)!));
  });

  it('reports the full node count when it keeps only the first nodes', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    const total = MAX_NODES + 25;
    const ng = fakeNg(standard, () => ({
      nodes: Array.from({ length: total }, (_, i) => ({
        id: String(i + 1),
        kind: 'signal',
        label: `s${i}`,
        epoch: 0,
        value: i,
      })),
      edges: [{ consumer: 0, producer: total - 1 }],
    }));
    const graph = collectSignalGraph(ng)!;
    expect(graph.nodes).toHaveLength(MAX_NODES);
    expect(graph.nodeCount).toBe(total);
    expect(graph.edges).toEqual([]);
  });

  it('sets no node count when nothing was cut', () => {
    document.body.innerHTML = `<app-root ng-version="22.0.0"></app-root>`;
    expect('nodeCount' in collectSignalGraph(fakeNg(standard))!).toBe(false);
  });
});

describe('collectSignalGraph environment injectors', () => {
  const platform = { scopes: new Set(['platform']) };
  const root = { scopes: new Set(['environment', 'root']) };
  const route = { scopes: new Set(['environment']), source: 'Route: admin' };
  const environment = new Set<object>([platform, root, route]);

  function envNg(): SignalDebugNg {
    return {
      ...fakeNg(standard, (injector) => {
        if (injector === (root as unknown)) {
          return {
            nodes: [
              { id: '10', kind: 'effect', label: 'persistTrips', epoch: 2 },
              { id: '11', kind: 'signal', label: 'trips', epoch: 2, value: 3 },
            ],
            edges: [{ consumer: 0, producer: 1 }],
          };
        }
        if (injector === (route as unknown)) {
          return { nodes: [{ id: '20', kind: 'effect', label: 'audit', epoch: 1 }], edges: [] };
        }
        return fakeNg(standard).ɵgetSignalGraph!(injector);
      }),
      ɵgetInjectorResolutionPath: (injector) =>
        (injector as Element).tagName === 'APP-PAGE'
          ? [injector, route, root, platform]
          : [injector, root, platform],
      ɵgetInjectorMetadata: (injector) =>
        environment.has(injector as object)
          ? { type: 'environment', source: (injector as { source?: string }).source ?? null }
          : { type: 'element', source: injector },
    };
  }

  const page = `
    <app-root ng-version="22.0.0">
      <router-outlet></router-outlet><app-page></app-page>
    </app-root>`;

  it('lists root and route injectors next to a component graph, without the platform', () => {
    document.body.innerHTML = page;
    const graph = collectSignalGraph(envNg())!;
    expect(graph.componentSelector).toBe('app-page');
    expect(graph.environments?.map((e) => e.name)).toEqual(['Root', 'Route: admin']);
  });

  it('reports the effects of the root injector for the root target', () => {
    document.body.innerHTML = page;
    const graph = collectSignalGraph(envNg(), { env: 'root' })!;
    expect(graph.component).toBeUndefined();
    expect(graph.injector?.name).toBe('Root');
    expect(graph.source).toBe('selected');
    expect(graph.nodes.map((n) => n.label)).toEqual(['persistTrips', 'trips']);
    expect(graphKey(graph)).not.toBe(graphKey(collectSignalGraph(envNg())!));
  });

  it('targets a route injector by path or id, and falls back when none matches', () => {
    document.body.innerHTML = page;
    const byPath = collectSignalGraph(envNg(), { env: '/admin' })!;
    expect(byPath.injector?.name).toBe('Route: admin');
    const byId = collectSignalGraph(envNg(), { env: byPath.injector!.id })!;
    expect(byId.nodes[0].label).toBe('audit');
    expect(collectSignalGraph(envNg(), { env: '/nope' })?.componentSelector).toBe('app-page');
  });

  it('matches injector requests by id, root and route path', () => {
    const admin = { id: 'inj-4', name: 'Route: admin' };
    expect(injectorMatches(admin, 'inj-4')).toBe(true);
    expect(injectorMatches(admin, '/admin/')).toBe(true);
    expect(injectorMatches(admin, 'Route: admin')).toBe(true);
    expect(injectorMatches(admin, 'root')).toBe(false);
    expect(injectorMatches({ id: 'inj-1', name: 'Root' }, 'ROOT')).toBe(true);
    expect(isEnvironmentRequest('/admin')).toBe(true);
    expect(isEnvironmentRequest('app-root')).toBe(false);
  });
});

describe('toSignalTarget', () => {
  it('ignores requests for another page and accepts agent selectors', () => {
    expect(toSignalTarget({ pageId: 'b', id: 'c1' }, 'a')).toBeUndefined();
    expect(toSignalTarget({ pageId: 'a', id: 'c1' }, 'a')).toEqual({ id: 'c1' });
    expect(toSignalTarget({ id: null }, 'a')).toBeNull();
    expect(toSignalTarget('app-card', 'a')).toEqual({ selector: 'app-card' });
    expect(toSignalTarget(null, 'a')).toBeNull();
    expect(toSignalTarget({ pageId: 'a', env: 'root' }, 'a')).toEqual({ env: 'root' });
  });
});

describe('toSignalTarget with a page', () => {
  it('accepts a CSS selector sent to one page', () => {
    expect(toSignalTarget({ pageId: 'a', selector: '.promo' }, 'a')).toEqual({
      selector: '.promo',
    });
    expect(toSignalTarget({ pageId: 'b', selector: '.promo' }, 'a')).toBeUndefined();
  });
});
