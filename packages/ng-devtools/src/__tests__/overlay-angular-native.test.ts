import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectComponentTree, hostPath } from '../component-tree.ts';
import { elementId } from '../element-id.ts';
import { hostBySelector } from '../host-tree.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';
import {
  angularNativeTree,
  componentSelector,
  clearOutline,
  showOutline,
  isAngularNativeNode,
  type AngularNativeNode,
} from '../overlay-angular-native-views.ts';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';

const connectDevframe = vi.hoisted(() => vi.fn());
vi.mock('devframe/client', () => ({ connectDevframe }));

interface FakeNode {
  kind: string;
  name: string;
  children: FakeNode[];
  parent: FakeNode | null;
  props: Record<string, unknown>;
  ownStyle?: object;
  host?: { setProp(node: FakeNode, key: string, value: unknown): void };
}

const engine = {
  setProp: vi.fn((node: FakeNode, key: string, value: unknown) => {
    node.props[key] = value;
  }),
};

function el(name: string, children: FakeNode[] = [], kind = 'element'): FakeNode {
  const node: FakeNode = { kind, name, children, parent: null, props: {}, host: engine };
  for (const child of children) child.parent = node;
  return node;
}
const text = (value: string) => el(`#text:${value}`, [], 'text');
const anchor = () => el('#anchor', [], 'anchor');

function component(selector: string, name: string, fields: Record<string, unknown> = {}) {
  const Cmp = { [name]: class {} }[name] as new () => object;
  Object.assign(Cmp, { ɵcmp: { selectors: [[selector]] } });
  return Object.assign(new Cmp(), fields);
}

type Ng = SignalDebugNg<AngularNativeNode>;

// root(app-root) > view > [text, app-row, app-row, @if anchor, ng-container anchor]
function fixture() {
  const first = el('app-row', [el('text', [text('One')])]);
  const second = el('app-row', [el('text', [text('Two')])]);
  const ifAnchor = anchor();
  const container = anchor();
  const list = el('view', [text(' '), first, second, ifAnchor, container]);
  const root = el('root', [list]);
  const app = component('app-root', 'App');
  const rows = [component('app-row', 'Row', { label: 'one' }), component('app-row', 'Row')];
  const components = new Map<AngularNativeNode, object>([
    [root, app],
    [first, rows[0]!],
    [second, rows[1]!],
  ]);
  const node = (host: AngularNativeNode) => ({ kind: 'node', host });
  const rootEnv = { scopes: new Set(['root']) };
  const ng: Ng = {
    getComponent: (host) => components.get(host) ?? null,
    getDirectives: (host) => (host === container ? [{ tooltip: true }] : []),
    getInjector: (host) => node(host),
    ɵgetInjectorMetadata: (injector) => {
      const inj = injector as { kind?: string; host?: AngularNativeNode };
      return inj.kind === 'node'
        ? { type: 'element', source: inj.host }
        : { type: 'environment', source: 'Environment Injector' };
    },
    ɵgetInjectorResolutionPath: (injector) => [injector, rootEnv],
    ɵgetInjectorProviders: (injector) => {
      const host = (injector as { host?: AngularNativeNode }).host;
      return host === second || host === container
        ? [{ token: class RowState {}, provider: class {} }]
        : [];
    },
    ɵgetSignalGraph: (injector) => {
      const host = (injector as { host?: AngularNativeNode }).host;
      if (host === root) return { nodes: [] };
      return {
        nodes: [{ id: `${host === first ? 1 : 2}`, kind: 'signal', label: 'label', value: 'v' }],
        edges: [],
      };
    },
  };
  const tree = angularNativeTree(
    () => root as unknown as AngularNativeNode,
    () => ng,
  );
  return { root, list, first, second, ifAnchor, container, ng, tree };
}

const asNode = (node: FakeNode) => node as unknown as AngularNativeNode;

describe('Angular Native host tree', () => {
  it('walks elements and anchors, leaving text runs out', () => {
    const { root, list, first, second, ifAnchor, container, tree } = fixture();
    expect(tree.roots()).toEqual([root]);
    expect(tree.children(asNode(list))).toEqual([first, second, ifAnchor, container]);
    expect(tree.children(asNode(ifAnchor))).toEqual([]);
    expect(tree.parent(asNode(first))).toBe(list);
    expect(tree.parent(asNode(root))).toBeNull();
    expect(tree.isAnchor?.(asNode(container))).toBe(true);
    expect(tree.isHost(first)).toBe(true);
    expect(tree.isHost(text('x'))).toBe(false);
    expect(isAngularNativeNode({ kind: 'element', name: 'view' })).toBe(false);
  });

  it('names the root by its component selector and anchors as ng-container', () => {
    const { root, first, container, tree } = fixture();
    expect(tree.tag(asNode(root))).toBe('app-root');
    expect(tree.tag(asNode(first))).toBe('app-row');
    expect(tree.tag(asNode(container))).toBe('ng-container');
    expect(componentSelector({ constructor: { ɵcmp: { selectors: [['', 'attr', '']] } } })).toBe(
      null,
    );
  });

  it('gives each element a selector that finds it again', () => {
    const { root, second, container, tree } = fixture();
    expect(tree.selector?.(asNode(root))).toBe('app-root');
    expect(tree.selector?.(asNode(second))).toBe(
      'app-root > view:nth-child(1) > app-row:nth-child(2)',
    );
    expect(tree.selector?.(asNode(container))).toBeNull();
    expect(hostBySelector(tree, 'app-root > view:nth-child(1) > app-row:nth-child(2)')).toBe(
      second,
    );
    expect(hostBySelector(tree, 'app-root > nope')).toBeNull();
  });

  it('treats a node removed from the root as disconnected', () => {
    const { list, second, tree } = fixture();
    expect(tree.connected(asNode(second))).toBe(true);
    list.children.splice(list.children.indexOf(second), 1);
    second.parent = null;
    expect(tree.connected(asNode(second))).toBe(false);
    expect(tree.selector?.(asNode(second))).toBeNull();
  });
});

describe('collectors over an Angular Native tree', () => {
  it('builds the component tree with paths and detail', () => {
    const { second, ng, tree } = fixture();
    const report = collectComponentTree(ng, { tree, selectedId: elementId(second) });
    expect(report.count).toBe(3);
    expect(report.roots[0]).toMatchObject({ name: 'App', tag: 'app-root' });
    expect(report.roots[0]!.children.map((n) => n.tag)).toEqual(['app-row', 'app-row']);
    expect(hostPath(ng, asNode(second), tree)).toBe('app-root > app-row[2]');
    expect(report.detail?.path).toBe('app-root > app-row[2]');
  });

  it('builds the injector tree, with an anchor as <ng-container>', () => {
    const { ng, tree } = fixture();
    const report = collectInjectorTree(ng, tree);
    const names = (nodes: typeof report.roots): string[] =>
      nodes.flatMap((n) => [n.injector.name, ...names(n.children)]);
    expect(names(report.roots)).toContain('ng-container');
    expect(report.roots[0]!.injector.name).toBe('app-root');
    expect(report.environment.map((n) => n.injector.name)).toEqual(['Root']);
  });

  it('collects the signal graph of a target found by id or selector', () => {
    const { first, second, ng, tree } = fixture();
    const byId = collectSignalGraph(ng, { id: elementId(second) }, tree)!;
    expect(byId.source).toBe('selected');
    expect(byId.component).toMatchObject({
      name: 'Row',
      tag: 'app-row',
      path: 'app-root > app-row[2]',
    });
    expect(byId.nodes.map((n) => n.id)).toEqual(['2']);
    const bySelector = collectSignalGraph(
      ng,
      { selector: 'app-root > view:nth-child(1) > app-row:nth-child(1)' },
      tree,
    )!;
    expect(bySelector.component?.id).toBe(elementId(first));
    const fallback = collectSignalGraph(ng, null, tree)!;
    expect(fallback.source).toBe('root');
    expect(fallback.component?.id).toBe(elementId(first));
  });

  it('walks component hosts for the NgRx collector', () => {
    const { ng, tree } = fixture();
    const seen: string[] = [];
    const collector = createNgrxCollector<AngularNativeNode>(
      () => ({
        getComponent: (host) => {
          seen.push(tree.tag(host));
          return ng.getComponent?.(host) ?? null;
        },
        getInjector: (host) => ng.getInjector?.(host),
      }),
      () => {},
      tree,
    );
    collector.collect();
    expect(seen.slice(0, 4)).toEqual(['app-root', 'view', 'app-row', 'text']);
    collector.stop();
  });
});

describe('showOutline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    clearOutline();
    vi.useRealTimers();
  });

  it('outlines through the inline style and puts the old values back', () => {
    const node = el('app-row');
    node.props['style'] = { flex: 1, outlineWidth: 1 };
    expect(showOutline(asNode(node))).toBe(true);
    expect(node.props['style']).toMatchObject({
      flex: 1,
      outlineWidth: 2,
      outlineColor: '#68b6ff',
    });
    expect(node.ownStyle).toBe(node.props['style']);
    (node.props['style'] as Record<string, unknown>)['opacity'] = 0.5;
    clearOutline();
    expect(node.props['style']).toEqual({ flex: 1, outlineWidth: 1, opacity: 0.5 });
  });

  it('keeps one outline at a time and ends it after durationMs', () => {
    const first = el('view');
    const second = el('view');
    showOutline(asNode(first));
    showOutline(asNode(second), 1000);
    expect(first.props['style']).toEqual({});
    expect(second.props['style']).toMatchObject({ outlineWidth: 2 });
    vi.advanceTimersByTime(1000);
    expect(second.props['style']).toEqual({});
  });

  it('skips anchors and nodes without an engine', () => {
    expect(showOutline(asNode(anchor()))).toBe(false);
    const bare = el('view');
    delete bare.host;
    expect(showOutline(asNode(bare))).toBe(false);
  });
});

describe('initAngularNativeOverlay', () => {
  type Handler = (...args: unknown[]) => unknown;
  function fakeRpc(trusted = true) {
    const calls: [string, unknown][] = [];
    const handlers = new Map<string, Handler>();
    const rpc = {
      status: 'connected',
      connectionMeta: {},
      ensureTrusted: vi.fn(async () => trusted),
      close: vi.fn(),
      scope: () => ({
        rpc: {
          call: vi.fn(async (name: string, arg: unknown) => {
            calls.push([name, arg]);
            return { known: true };
          }),
          register: (definition: { name: string; handler: Handler }) =>
            handlers.set(definition.name, definition.handler),
        },
      }),
    };
    return { rpc, calls, handlers };
  }

  const g = globalThis as Record<string, unknown>;
  const meta = { backend: 'websocket' };
  const fetchMeta = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    connectDevframe.mockReset();
    fetchMeta.mockReset().mockResolvedValue({ ok: true, json: async () => meta });
    vi.stubGlobal('fetch', fetchMeta);
    g['WebSocket'] = class {};
    delete g['location'];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete g['WebSocket'];
    delete g['ng'];
    delete g['location'];
  });

  it('reports the tree over a WebSocket and stands in a location only while connecting', async () => {
    const { root, ng } = fixture();
    g['ng'] = ng;
    const session = fakeRpc();
    let originWhileConnecting: string | undefined;
    connectDevframe.mockImplementation(async () => {
      originWhileConnecting = (g['location'] as { origin: string }).origin;
      return session.rpc;
    });
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({
      root: asNode(root),
      baseURL: 'http://192.168.1.20:9999/',
      intervalMs: 1000,
    });
    await vi.waitFor(() =>
      expect(session.calls.some(([name]) => name === 'push-component-tree')).toBe(true),
    );

    expect(fetchMeta).toHaveBeenCalledWith('http://192.168.1.20:9999/__connection.json');
    expect(connectDevframe).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://192.168.1.20:9999/',
        connectionMeta: meta,
        transport: 'websocket',
      }),
    );
    expect(originWhileConnecting).toBe('http://192.168.1.20:9999');
    expect(typeof g['location']).toBe('undefined');
    const tree = session.calls.find(([name]) => name === 'push-component-tree')?.[1] as {
      pageId: string;
      count: number;
      title: string;
    };
    expect(tree).toMatchObject({ count: 3, title: 'Angular Native', platform: 'angular-native' });
    expect(tree.pageId).toMatch(/^[a-z0-9]+$/);
    expect(session.calls.some(([name]) => name === 'push-injector-tree')).toBe(true);
    expect(session.calls.some(([name]) => name === 'push-signal-graph')).toBe(true);

    dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.calls.map(([name]) => name)).toContain('forget-component-page');
    expect(session.rpc.close).toHaveBeenCalled();
  });

  it('retries an unreachable server and reconnects after a drop', async () => {
    const { root, ng } = fixture();
    g['ng'] = ng;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const first = fakeRpc();
    const second = fakeRpc();
    let dropped: (() => void) | undefined;
    fetchMeta.mockRejectedValueOnce(new TypeError('Network request failed'));
    connectDevframe
      .mockImplementationOnce(async (options: { wsOptions: { onDisconnected(): void } }) => {
        dropped = options.wsOptions.onDisconnected;
        return first.rpc;
      })
      .mockResolvedValueOnce(second.rpc);
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({
      root: () => asNode(root),
      intervalMs: 1000,
      retryMs: 3000,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(connectDevframe).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Could not reach');

    await vi.advanceTimersByTimeAsync(3000);
    expect(connectDevframe).toHaveBeenCalledTimes(1);
    expect(first.calls.some(([name]) => name === 'push-component-tree')).toBe(true);

    dropped?.();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMeta).toHaveBeenCalledTimes(3);
    expect(connectDevframe).toHaveBeenCalledTimes(2);
    expect(first.rpc.close).toHaveBeenCalled();
    expect(second.calls.some(([name]) => name === 'push-component-tree')).toBe(true);
    const pageOf = (calls: unknown[][]) =>
      (calls.find(([name]) => name === 'push-component-tree')?.[1] as { pageId: string }).pageId;
    expect(pageOf(second.calls)).toBe(pageOf(first.calls));
    expect(typeof g['location']).toBe('undefined');

    dispose();
    warn.mockRestore();
    log.mockRestore();
  });

  it('keeps the stand-in location while another connection is still pending', async () => {
    const { withWebShims } = await import('../overlay-angular-native.ts');
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = withWebShims(
      'http://localhost:9999/',
      () => new Promise<void>((r) => (finishFirst = r)),
    );
    const second = withWebShims(
      'http://localhost:9999/',
      () => new Promise<void>((r) => (finishSecond = r)),
    );
    expect((g['location'] as { origin: string }).origin).toBe('http://localhost:9999');

    finishFirst();
    await first;
    expect((g['location'] as { origin: string }).origin).toBe('http://localhost:9999');
    expect(typeof g['navigator']).not.toBe('undefined');

    finishSecond();
    await second;
    expect(typeof g['location']).toBe('undefined');
  });

  it('leaves a location the app already has untouched', async () => {
    const { root, ng } = fixture();
    g['ng'] = ng;
    const own = { origin: 'http://localhost:8081', href: 'http://localhost:8081/' };
    g['location'] = own;
    const session = fakeRpc();
    connectDevframe.mockResolvedValue(session.rpc);
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({ root: asNode(root), intervalMs: 1000 });
    await vi.waitFor(() => expect(connectDevframe).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(0);

    expect(g['location']).toBe(own);
    dispose();
  });

  it('closes a session the server does not trust and says how to fix it', async () => {
    const { root, ng } = fixture();
    g['ng'] = ng;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = fakeRpc(false);
    connectDevframe.mockResolvedValue(session.rpc);
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({ root: asNode(root), intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(session.rpc.close).toHaveBeenCalled();
    expect(session.calls).toEqual([]);
    expect(String(warn.mock.calls[0]?.[0])).toContain('--no-auth');
    dispose();
    warn.mockRestore();
  });

  it('outlines the node a highlight request names', async () => {
    const { root, second, ng } = fixture();
    g['ng'] = ng;
    const session = fakeRpc();
    connectDevframe.mockResolvedValue(session.rpc);
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({ root: asNode(root), intervalMs: 1000 });
    await vi.waitFor(() => expect(session.handlers.has('highlight-in-page')).toBe(true));
    session.handlers.get('highlight-in-page')?.({ id: elementId(second) });
    expect(second.props['style']).toMatchObject({ outlineWidth: 2 });
    session.handlers.get('highlight-in-page')?.(null);
    expect(second.props['style']).toEqual({});
    dispose();
  });

  it('does nothing without a WebSocket global', async () => {
    delete g['WebSocket'];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    initAngularNativeOverlay({ root: () => null });
    expect(connectDevframe).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
