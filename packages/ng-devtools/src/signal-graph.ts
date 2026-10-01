import { componentHosts, hostPath, type ComponentDebugNg } from './component-tree.ts';
import { elementById, elementId } from './element-id.ts';
import { className, injectorRef } from './injector-tree.ts';
import { serializeNamed } from './serialize.ts';
import { cleanValue, groupResources, rawNodeOf, type RawNode } from './signal-resources.ts';
import type {
  SignalGraph,
  SignalGraphEdge,
  SignalGraphInjector,
  SignalGraphNode,
  SignalNodeKind,
} from './types.ts';

export interface SignalDebugNg extends ComponentDebugNg {
  ɵgetSignalGraph?(injector: unknown): {
    nodes: { id?: string; kind?: string; label?: string; epoch?: number; value?: unknown }[];
    edges?: SignalGraphEdge[];
  } | null;
}

export type SignalTarget = { id: string } | { selector: string } | { env: string } | null;

export const MAX_NODES = 400;
const MAX_ENVIRONMENTS = 30;
const MAX_FALLBACK_HOSTS = 50;
const VALUE_LIMITS = { depth: 4, keys: 40, items: 40, text: 500 };

export function graphValue(label: string | undefined, value: unknown): unknown {
  return serializeNamed(label, value, VALUE_LIMITS);
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isComponentHost(ng: SignalDebugNg, el: Element | null): el is Element {
  return !!el && !!read(() => ng.getComponent?.(el), null);
}

export function toSignalTarget(request: unknown, pageId: string): SignalTarget | undefined {
  if (request === null || request === undefined) return null;
  if (typeof request === 'string') {
    return request && request.length < 500 ? { selector: request } : null;
  }
  if (typeof request !== 'object') return null;
  const {
    pageId: forPage,
    id,
    env,
    selector,
  } = request as { pageId?: unknown; id?: unknown; env?: unknown; selector?: unknown };
  if (typeof forPage === 'string' && forPage && forPage !== pageId) return undefined;
  if (typeof env === 'string' && env && env.length < 500) return { env };
  if (typeof id === 'string' && id) return { id };
  return typeof selector === 'string' && selector && selector.length < 500 ? { selector } : null;
}

function resolveTarget(target: SignalTarget, doc: Document): Element | null {
  if (!target || 'env' in target) return null;
  if ('id' in target) return elementById(target.id);
  try {
    return doc.querySelector(target.selector);
  } catch {
    return null;
  }
}

function isPrimaryOutlet(outlet: Element): boolean {
  const name = outlet.getAttribute('name');
  return !name || name === 'primary';
}

function outletBefore(el: Element): Element | null {
  const prev = el.previousElementSibling;
  return prev && prev.tagName === 'ROUTER-OUTLET' ? prev : null;
}

export function routedComponent(ng: SignalDebugNg, doc: Document = document): Element | null {
  let best: Element | null = null;
  let bestDepth = -1;
  for (const outlet of Array.from(doc.querySelectorAll('router-outlet'))) {
    if (!isPrimaryOutlet(outlet)) continue;
    const el = outlet.nextElementSibling;
    if (!isComponentHost(ng, el)) continue;
    let depth = 0;
    let primary = true;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const before = outletBefore(node);
      if (!before || !isComponentHost(ng, node)) continue;
      if (!isPrimaryOutlet(before)) {
        primary = false;
        break;
      }
      depth++;
    }
    if (primary && depth > bestDepth) {
      best = el;
      bestDepth = depth;
    }
  }
  return best;
}

interface LinkedReader {
  key: string;
  node: RawNode;
}

function linkedSignalReaders(ng: SignalDebugNg, instance: object): LinkedReader[] {
  const readers: LinkedReader[] = [];
  for (const key of read(() => Object.keys(instance), [] as string[])) {
    const value = read(() => (instance as Record<string, unknown>)[key], undefined);
    if (typeof value !== 'function') continue;
    if (!read(() => ng.isSignal?.(value) ?? true, false)) continue;
    const node = rawNodeOf(value);
    if (node?.kind === 'linkedSignal') readers.push({ key, node });
  }
  return readers;
}

/**
 * Angular sends no value for linkedSignal nodes. Use a field of the instance
 * only when exactly one field's node has this name and this version, and read
 * its stored value without calling it.
 */
function linkedValue(
  readers: LinkedReader[],
  label: string,
  epoch: number,
): { value: unknown } | null {
  const nodes = new Set<RawNode>();
  for (const { key, node } of readers) {
    if ((node.debugName ?? key) !== label && key !== label) continue;
    if (node.version === epoch) nodes.add(node);
  }
  if (nodes.size !== 1) return null;
  return cleanValue([...nodes][0]);
}

type RawGraph = NonNullable<ReturnType<NonNullable<SignalDebugNg['ɵgetSignalGraph']>>>;

function buildGraph(raw: RawGraph, instance: object | null, ng: SignalDebugNg) {
  let linked: LinkedReader[] | null = null;
  const kept = raw.nodes.slice(0, MAX_NODES);
  const twins = new Map<string, number>();
  for (const n of kept) {
    if (n.kind !== 'linkedSignal' || 'value' in n) continue;
    const key = `${n.label}@${n.epoch ?? 0}`;
    twins.set(key, (twins.get(key) ?? 0) + 1);
  }
  const nodes = kept.map((n) => {
    const node: SignalGraphNode = {
      id: String(n.id),
      kind: (n.kind ?? 'unknown') as SignalNodeKind,
      epoch: n.epoch ?? 0,
    };
    if (n.label) node.label = n.label;
    if ('value' in n) {
      node.value = graphValue(n.label, n.value);
    } else if (
      n.kind === 'linkedSignal' &&
      n.label &&
      instance &&
      twins.get(`${n.label}@${node.epoch}`) === 1
    ) {
      linked ??= linkedSignalReaders(ng, instance);
      const found = linkedValue(linked, n.label, node.epoch);
      if (found) node.value = graphValue(n.label, found.value);
    }
    return node;
  });
  const edges = (raw.edges ?? []).filter(
    (e) => e.consumer < kept.length && e.producer < kept.length,
  );
  const resources = groupResources(nodes, edges, instance ? [instance] : [], (label, value) =>
    graphValue(label, value),
  );
  const graph: Pick<SignalGraph, 'nodes' | 'edges' | 'resources' | 'nodeCount'> = { nodes, edges };
  if (resources.length) graph.resources = resources;
  if (raw.nodes.length > kept.length) graph.nodeCount = raw.nodes.length;
  return graph;
}

function hasIds(raw: RawGraph): boolean {
  return raw.nodes.every((n) => typeof n.id === 'string' || typeof n.id === 'number');
}

function rawGraph(ng: SignalDebugNg, injector: unknown): RawGraph | null {
  const raw = read(() => ng.ɵgetSignalGraph?.(injector) ?? null, null);
  return raw && Array.isArray(raw.nodes) ? raw : null;
}

const UNSUPPORTED: SignalGraph = { nodes: [], edges: [], unsupported: true };

function graphFor(
  ng: SignalDebugNg,
  el: Element,
  source: NonNullable<SignalGraph['source']>,
): SignalGraph | null {
  const instance = read(() => ng.getComponent?.(el), null);
  if (!instance || typeof instance !== 'object') return null;
  const injector = read(() => ng.getInjector?.(el), null);
  if (!injector) return null;
  const raw = rawGraph(ng, injector);
  if (!raw) return null;
  if (!hasIds(raw)) return UNSUPPORTED;
  const tag = el.tagName.toLowerCase();
  return {
    ...buildGraph(raw, instance, ng),
    componentSelector: tag,
    component: {
      id: elementId(el),
      name: className((instance as { constructor: new () => unknown }).constructor),
      tag,
      path: hostPath(ng, el),
    },
    source,
  };
}

interface Environment extends SignalGraphInjector {
  injector: object;
}

function environmentsFor(ng: SignalDebugNg, hosts: Element[]): Environment[] {
  const out = new Map<object, Environment>();
  for (const host of hosts) {
    const injector = read(() => ng.getInjector?.(host), null);
    if (!injector) continue;
    const path = read(() => ng.ɵgetInjectorResolutionPath?.(injector) ?? [], [] as unknown[]);
    for (const entry of path) {
      if (!entry || typeof entry !== 'object' || out.has(entry)) continue;
      const meta = read(() => ng.ɵgetInjectorMetadata?.(entry) ?? null, null);
      if (meta?.type !== 'environment') continue;
      const scopes = (entry as { scopes?: Set<string> }).scopes;
      if (read(() => scopes?.has('platform') ?? false, false)) continue;
      const ref = injectorRef(ng, entry);
      if (!ref) continue;
      out.set(entry, { ...ref, injector: entry });
    }
  }
  return [...out.values()].slice(0, MAX_ENVIRONMENTS);
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/** Matches an environment injector by id, `root`, or route path (`/admin`, `admin`, `Route: admin`). */
export function injectorMatches(injector: SignalGraphInjector, wanted: string): boolean {
  const text = wanted.trim();
  if (!text) return false;
  if (injector.id === text) return true;
  if (text.toLowerCase() === 'root') return injector.name === 'Root';
  if (!injector.name.startsWith('Route: ')) return false;
  const path = /^route:/i.test(text) ? text.slice('route:'.length) : text;
  return trimSlashes(injector.name.slice('Route: '.length).trim()) === trimSlashes(path.trim());
}

/** A request an agent can pass to target an environment injector instead of a component. */
export function isEnvironmentRequest(wanted: string): boolean {
  const text = wanted.trim();
  return (
    /^root$/i.test(text) || text.startsWith('/') || /^route:/i.test(text) || /^inj-\d+$/.test(text)
  );
}

function graphForEnvironment(ng: SignalDebugNg, env: Environment): SignalGraph | null {
  const raw = rawGraph(ng, env.injector);
  if (!raw) return null;
  if (!hasIds(raw)) return UNSUPPORTED;
  return {
    ...buildGraph(raw, null, ng),
    injector: { id: env.id, name: env.name },
    source: 'selected',
  };
}

function environmentHosts(ng: SignalDebugNg, doc: Document): Element[] {
  const hosts = componentHosts(ng, doc, 1);
  const routed = routedComponent(ng, doc);
  return routed ? [...hosts, routed] : hosts;
}

export function collectSignalGraph(
  ng: SignalDebugNg | undefined,
  target: SignalTarget = null,
  doc: Document = document,
): SignalGraph | null {
  if (!ng?.ɵgetSignalGraph || !ng.getInjector || !ng.getComponent) return null;
  const environments = ng.ɵgetInjectorResolutionPath
    ? environmentsFor(ng, environmentHosts(ng, doc))
    : [];
  const graph = pickGraph(ng, target, doc, environments);
  if (graph && !graph.unsupported && environments.length) {
    return { ...graph, environments: environments.map(({ id, name }) => ({ id, name })) };
  }
  return graph;
}

function pickGraph(
  ng: SignalDebugNg,
  target: SignalTarget,
  doc: Document,
  environments: Environment[],
): SignalGraph | null {
  if (target && 'env' in target) {
    const env = environments.find((e) => injectorMatches(e, target.env));
    const graph = env ? graphForEnvironment(ng, env) : null;
    if (graph) return graph;
  }
  const picked = resolveTarget(target, doc);
  if (isComponentHost(ng, picked)) {
    const graph = graphFor(ng, picked, 'selected');
    if (graph) return graph;
  }
  const routed = routedComponent(ng, doc);
  if (routed) {
    const graph = graphFor(ng, routed, 'routed');
    if (graph) return graph;
  }
  let empty: SignalGraph | null = null;
  for (const host of componentHosts(ng, doc, MAX_FALLBACK_HOSTS)) {
    const graph = graphFor(ng, host, 'root');
    if (graph?.nodes.length) return graph;
    empty ??= graph;
  }
  return empty;
}

export function graphKey(graph: SignalGraph): string {
  const nodes = graph.nodes.map((n) => `${n.id}:${n.epoch}`).join(',');
  const edges = graph.edges.map((e) => `${e.consumer}>${e.producer}`).join(',');
  const owner =
    graph.component?.id ?? graph.injector?.id ?? (graph.unsupported ? 'unsupported' : '');
  const envs = (graph.environments ?? []).map((e) => e.id).join(',');
  return `${owner}|${graph.source ?? ''}|${nodes}|${edges}|${envs}`;
}
