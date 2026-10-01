import type {
  SignalGraphEdge,
  SignalGraphNode,
  SignalResource,
  SignalResourceStatus,
} from './types.ts';

/** The fields of a reactive node this module reads. Never calls the signal. */
export interface RawNode {
  kind?: string;
  debugName?: string;
  version?: number;
  value?: unknown;
  dirty?: boolean;
}

const RESOURCE_LABEL = /^Resource(?:#(.+))?\.([A-Za-z_$][\w$]*)$/;
const HTTP_EXTRAS = new Set(['_headers', '_progress', '_statusCode', 'headers']);
const MAX_INSTANCE_RESOURCES = 50;
const MATCHED_PARTS = ['value', 'state', 'extRequest', 'status', 'isLoading', 'error'];

export function rawNodeOf(value: unknown): RawNode | null {
  if (typeof value !== 'function') return null;
  try {
    for (const symbol of Object.getOwnPropertySymbols(value)) {
      if (symbol.description === 'SIGNAL') {
        const node = (value as unknown as Record<symbol, unknown>)[symbol];
        return node && typeof node === 'object' ? (node as RawNode) : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** A node's stored value, only when it is clean. Reading it runs no computation. */
export function cleanValue(node: RawNode): { value: unknown } | null {
  if (node.dirty) return null;
  const value = node.value;
  if (typeof value === 'symbol') return null;
  return { value };
}

export function parseResourceLabel(
  label: string | undefined,
): { name?: string; part: string } | null {
  const match = label ? RESOURCE_LABEL.exec(label) : null;
  return match ? { name: match[1], part: match[2] } : null;
}

type ResourceObject = Record<string, unknown> & { debugName?: unknown };

function isResourceObject(value: unknown): value is ResourceObject {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  try {
    return !!rawNodeOf(obj['state']) && !!rawNodeOf(obj['extRequest']) && !!rawNodeOf(obj['value']);
  } catch {
    return false;
  }
}

/** Resources held in the own fields of a component or service instance. */
export function instanceResources(instance: object): ResourceObject[] {
  const out: ResourceObject[] = [];
  let keys: string[] = [];
  try {
    keys = Object.keys(instance);
  } catch {
    return out;
  }
  for (const key of keys) {
    let value: unknown;
    try {
      value = (instance as Record<string, unknown>)[key];
    } catch {
      continue;
    }
    if (isResourceObject(value) && !out.includes(value)) out.push(value);
    if (out.length >= MAX_INSTANCE_RESOURCES) break;
  }
  return out;
}

interface Group {
  name?: string;
  indices: number[];
  parts: Map<string, SignalGraphNode>;
}

function find(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
}

function groupsOf(nodes: SignalGraphNode[], edges: SignalGraphEdge[]): Group[] {
  const parsed = nodes.map((n) => parseResourceLabel(n.label));
  const parent = nodes.map((_, i) => i);
  const inGroup = parsed.map((p) => !!p);
  const union = (a: number, b: number) => {
    parent[find(parent, a)] = find(parent, b);
  };
  const valid = (e: SignalGraphEdge) =>
    Number.isInteger(e.consumer) &&
    Number.isInteger(e.producer) &&
    !!nodes[e.consumer] &&
    !!nodes[e.producer];

  for (const e of edges) {
    if (!valid(e)) continue;
    const a = parsed[e.consumer];
    const b = parsed[e.producer];
    if (a && b && a.name === b.name) union(e.consumer, e.producer);
  }
  // httpResource signals have plain names: `_statusCode` and friends read the
  // resource's own signals, and its `stream` is read by the resource value.
  for (const e of edges) {
    if (!valid(e)) continue;
    const consumer = nodes[e.consumer].label ?? '';
    if (!inGroup[e.consumer] && parsed[e.producer] && HTTP_EXTRAS.has(consumer)) {
      union(e.consumer, e.producer);
      inGroup[e.consumer] = true;
    }
    const producer = nodes[e.producer].label ?? '';
    if (!inGroup[e.producer] && producer === 'stream' && parsed[e.consumer]?.part === 'value') {
      union(e.producer, e.consumer);
      inGroup[e.producer] = true;
    }
  }
  // Unnamed helpers such as isError and snapshot read only the resource's own signals.
  for (let changed = true; changed;) {
    changed = false;
    nodes.forEach((node, i) => {
      if (inGroup[i] || node.label || node.kind !== 'computed') return;
      const producers = edges.filter((e) => valid(e) && e.consumer === i).map((e) => e.producer);
      if (!producers.length || !producers.every((p) => inGroup[p])) return;
      const root = find(parent, producers[0]);
      if (!producers.every((p) => find(parent, p) === root)) return;
      union(i, root);
      inGroup[i] = true;
      changed = true;
    });
  }

  const byRoot = new Map<number, Group>();
  nodes.forEach((node, i) => {
    if (!inGroup[i]) return;
    const root = find(parent, i);
    let group = byRoot.get(root);
    if (!group) {
      group = { indices: [], parts: new Map() };
      byRoot.set(root, group);
    }
    group.indices.push(i);
    const label = parsed[i];
    if (label) {
      group.name ??= label.name;
      if (!group.parts.has(label.part)) group.parts.set(label.part, node);
    } else if (node.label && !group.parts.has(node.label)) {
      group.parts.set(node.label, node);
    }
  });
  return [...byRoot.values()];
}

function matchesGroup(res: ResourceObject, group: Group): boolean {
  const debugName = typeof res.debugName === 'string' && res.debugName ? res.debugName : undefined;
  if (debugName !== group.name) return false;
  let compared = 0;
  for (const part of MATCHED_PARTS) {
    const graphNode = group.parts.get(part);
    const raw = graphNode ? rawNodeOf(res[part]) : null;
    if (!graphNode || !raw) continue;
    if (raw.version !== graphNode.epoch) return false;
    compared++;
  }
  return compared > 0;
}

interface StateValue {
  status?: unknown;
  extRequest?: { request?: unknown; reload?: unknown };
  stream?: unknown;
}

function projectStatus(state: StateValue, stream: unknown): SignalResourceStatus | undefined {
  switch (state.status) {
    case 'loading':
      return state.extRequest?.reload === 0 ? 'loading' : 'reloading';
    case 'resolved':
      return stream &&
        typeof stream === 'object' &&
        (stream as { error?: unknown }).error !== undefined
        ? 'error'
        : 'resolved';
    case 'idle':
    case 'local':
      return state.status;
    default:
      return undefined;
  }
}

function fromInstance(
  res: ResourceObject,
  resource: SignalResource,
  serialize: (label: string, value: unknown) => unknown,
): void {
  const stateNode = rawNodeOf(res['state']);
  const state = stateNode ? cleanValue(stateNode) : null;
  if (!state || !state.value || typeof state.value !== 'object') return;
  const value = state.value as StateValue;
  const streamNode = rawNodeOf(value.stream);
  const stream = streamNode ? cleanValue(streamNode)?.value : undefined;
  const status = projectStatus(value, stream);
  if (!status) return;
  resource.status = status;
  resource.isLoading = status === 'loading' || status === 'reloading';
  if (value.extRequest && 'request' in value.extRequest) {
    resource.params = serialize(`${resource.name}.params`, paramsOf(value.extRequest.request));
  }
  if (status === 'error') {
    resource.error = serialize(`${resource.name}.error`, (stream as { error?: unknown }).error);
    delete resource.value;
  } else if (stream && typeof stream === 'object' && 'value' in stream) {
    resource.value = serialize(resource.name, (stream as { value?: unknown }).value);
  }
  const code = rawNodeOf(res['_statusCode']);
  const statusCode = code ? cleanValue(code)?.value : undefined;
  if (typeof statusCode === 'number') resource.statusCode = statusCode;
}

/** An httpResource request as method, URL and body instead of the whole HttpRequest. */
function paramsOf(request: unknown): unknown {
  if (!request || typeof request !== 'object') return request;
  const { method, urlWithParams, body } = request as Record<string, unknown>;
  if (typeof method !== 'string' || typeof urlWithParams !== 'string') return request;
  return body === null || body === undefined
    ? { method, url: urlWithParams }
    : { method, url: urlWithParams, body };
}

const THREW = '(threw an error)';

function fromGraph(group: Group, resource: SignalResource): void {
  const status = group.parts.get('status');
  const isLoading = group.parts.get('isLoading');
  const error = group.parts.get('error');
  const value = group.parts.get('value');
  if (typeof isLoading?.value === 'boolean') resource.isLoading = isLoading.value;
  if (error && error.value !== undefined && error.value !== THREW) resource.error = error.value;
  if (value && 'value' in value && value.value !== THREW) resource.value = value.value;
  if (typeof status?.value === 'string' && status.value !== THREW) {
    resource.status = status.value as SignalResourceStatus;
  } else if (resource.error !== undefined || value?.value === THREW) {
    resource.status = 'error';
  } else if (resource.isLoading) {
    resource.status = 'loading';
  }
  if (resource.status === 'error') delete resource.value;
}

/**
 * Folds the internal signals Angular builds a resource from (`Resource#name.part`
 * and the httpResource extras) into one entry. Values come from the graph, and
 * from the resource's own state when a matching resource is on the instance.
 */
export function groupResources(
  nodes: SignalGraphNode[],
  edges: SignalGraphEdge[],
  owners: object[],
  serialize: (label: string, value: unknown) => unknown,
): SignalResource[] {
  const groups = groupsOf(nodes, edges);
  if (!groups.length) return [];
  const candidates = owners.flatMap((owner) => instanceResources(owner));
  const sortKey = (g: Group) => Math.min(...g.indices.map((i) => Number(nodes[i].id) || 0));
  groups.sort((a, b) => sortKey(a) - sortKey(b));
  let unnamed = 0;
  return groups.map((group) => {
    const anchor = group.parts.get('value') ?? group.parts.get('state') ?? nodes[group.indices[0]];
    const state = group.parts.get('state');
    const name = group.name ?? `resource ${++unnamed}`;
    const resource: SignalResource = {
      id: `resource:${anchor.id}`,
      name,
      named: !!group.name,
      epoch: state?.epoch ?? anchor.epoch,
      nodeIds: group.indices.map((i) => nodes[i].id),
    };
    fromGraph(group, resource);
    const matches = candidates.filter((res) => matchesGroup(res, group));
    if (matches.length === 1) {
      candidates.splice(candidates.indexOf(matches[0]), 1);
      fromInstance(matches[0], resource, serialize);
    }
    return resource;
  });
}
