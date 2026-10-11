import { describe, expect, it } from 'vitest';
import { collectComponentTree, hostPath, type ComponentDebugNg } from '../component-tree.ts';
import { elementId } from '../element-id.ts';
import { hostBySelector, type HostTree } from '../host-tree.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';

interface View {
  type: string;
  parent: View | null;
  children: View[];
  attached: boolean;
}

function view(type: string, children: View[] = []): View {
  const out: View = { type, parent: null, children, attached: true };
  for (const child of children) child.parent = out;
  return out;
}

const viewTree = (root: View): HostTree<View> => ({
  roots: () => [root],
  children: (host) => host.children,
  parent: (host) => host.parent,
  tag: (host) => host.type,
  connected: (host) => host.attached,
  isHost: (value): value is View => !!value && typeof value === 'object' && 'children' in value,
});

class App {}
class List {}
class Row {
  label = 'first';
}

describe('collectors over a non-DOM host tree', () => {
  const first = view('Row');
  const second = view('Row');
  const list = view('List', [view('StackLayout', [first, second])]);
  const root = view('App', [list]);
  const components = new Map<View, object>([
    [root, new App()],
    [list, new List()],
    [first, new Row()],
    [second, new Row()],
  ]);
  const node = (host: View) => ({ kind: 'node', host });
  const rootEnv = { scopes: new Set(['root']), records: new Map() };
  const ng: ComponentDebugNg<View> = {
    getComponent: (host) => components.get(host) ?? null,
    getDirectives: (host) => {
      const component = components.get(host);
      return component ? [component] : [];
    },
    getInjector: (host) => node(host),
    ɵgetInjectorMetadata: (injector) => {
      const inj = injector as { kind?: string; host?: View };
      return inj.kind === 'node'
        ? { type: 'element', source: inj.host }
        : { type: 'environment', source: 'Environment Injector' };
    },
    ɵgetInjectorResolutionPath: (injector) => [injector, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const tree = viewTree(root);

  it('builds the component tree, paths and detail from the views', () => {
    const report = collectComponentTree(ng, { tree, selectedId: elementId(second) });
    expect(report.count).toBe(4);
    expect(report.roots[0].tag).toBe('App');
    expect(report.roots[0].children[0].children.map((n) => n.name)).toEqual(['Row', 'Row']);
    expect(hostPath(ng, second, tree)).toBe('App > List > Row[2]');
    expect(report.detail?.path).toBe('App > List > Row[2]');
    expect(report.detail?.properties.map((p) => p.name)).toEqual(['label']);

    second.attached = false;
    expect(collectComponentTree(ng, { tree, selectedId: elementId(second) }).detail).toBeNull();
    second.attached = true;
  });

  it('builds the injector tree without selectors', () => {
    const report = collectInjectorTree(ng, tree);
    const app = report.roots[0];
    expect(app.injector.name).toBe('App');
    expect(app.injector).not.toHaveProperty('selector');
    expect(app.children[0].children.map((n) => n.injector.name)).toEqual(['Row', 'Row']);
    expect(report.environment.map((n) => n.injector.name)).toEqual(['Root']);
  });

  it('finds component hosts for the NgRx collector', () => {
    const getComponent = (host: View) => components.get(host) ?? null;
    const seen: string[] = [];
    const collector = createNgrxCollector<View>(
      () => ({
        getComponent: (host) => {
          seen.push(host.type);
          return getComponent(host);
        },
        getInjector: (host) => node(host),
      }),
      () => {},
      tree,
    );
    collector.collect();
    expect(seen.slice(0, 5)).toEqual(['App', 'List', 'StackLayout', 'Row', 'Row']);
    collector.stop();
  });

  it('finds a host by selector without reordering the tree', () => {
    const withSelectors: HostTree<View> = {
      ...tree,
      selector: (host) => {
        const parent = host.parent;
        const own = parent
          ? `${host.type}:nth-child(${parent.children.indexOf(host) + 1})`
          : host.type;
        return parent ? `${withSelectors.selector!(parent)} > ${own}` : own;
      },
    };
    const order = () => list.children[0]!.children.map((host) => host === first);
    expect(order()).toEqual([true, false]);
    expect(
      hostBySelector(
        withSelectors,
        'App > List:nth-child(1) > StackLayout:nth-child(1) > Row:nth-child(2)',
      ),
    ).toBe(second);
    expect(hostBySelector(withSelectors, 'App > Nope')).toBeNull();
    expect(order()).toEqual([true, false]);
    expect(hostBySelector(tree, 'App')).toBeNull();
  });

  it('collects the signal graph of a host found by id', () => {
    const signals: SignalDebugNg<View> = {
      ...ng,
      ɵgetSignalGraph: (injector) =>
        (injector as { host?: View }).host === second
          ? {
              nodes: [{ id: '2', kind: 'signal', label: 'label', epoch: 1, value: 'second' }],
              edges: [],
            }
          : { nodes: [], edges: [] },
    };
    const graph = collectSignalGraph(signals, { id: elementId(second) }, tree)!;
    expect(graph.source).toBe('selected');
    expect(graph.component).toMatchObject({ name: 'Row', path: 'App > List > Row[2]' });
    expect(graph.nodes.map((n) => n.id)).toEqual(['2']);
  });
});
