import { markEditable } from './component-edit.ts';
import { componentSource } from './component-source.ts';
import { elementById, elementId, pruneElementIds } from './element-id.ts';
import { MAX_DIRECTIVE_HOSTS, selectorAttributes } from './directive-hosts.ts';
import { documentTree, type HostTree } from './host-tree.ts';
import { createHydrationTally, type HydrationDebugNg } from './hydration.ts';
import { className, dependenciesOf, type DebugNg } from './injector-tree.ts';
import { maskedFormValues } from './component-form-masks.ts';
import { isSecretName, serializeNamed, VALUE_LEVEL } from './serialize.ts';
import type {
  ComponentDetail,
  ComponentProp,
  ComponentTreeReport,
  LiveComponentNode,
} from './types.ts';

export interface ComponentDebugNg<H extends object = Element> extends DebugNg<H>, HydrationDebugNg {
  getComponent?(el: H): unknown;
  getDirectives?(el: H): unknown[];
  getDirectiveMetadata?(instance: unknown): {
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    changeDetection?: number;
    encapsulation?: number;
  } | null;
  getListeners?(el: H): { name: string; type?: string }[];
  isSignal?(value: unknown): boolean;
}

const MAX_COMPONENTS = 2000;
const MAX_DEPTH = 256;
const MAX_PROPS = 60;

const CHANGE_DETECTION: Record<number, string> = { 0: 'OnPush', 1: 'Eager' };
const ENCAPSULATION: Record<number, string> = {
  0: 'Emulated',
  2: 'None',
  3: 'ShadowDom',
  4: 'IsolatedShadowDom',
};

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function nameOf(instance: unknown): string {
  const ctor = (instance as { constructor?: unknown } | null)?.constructor;
  return typeof ctor === 'function' ? className(ctor) : 'Anonymous';
}

function componentAt<H extends object>(ng: ComponentDebugNg<H>, el: H): object | null {
  const found = read(() => ng.getComponent?.(el) ?? null, null);
  return found && typeof found === 'object' ? found : null;
}

function directivesAt<H extends object>(ng: ComponentDebugNg<H>, el: H): object[] {
  const found = read(() => ng.getDirectives?.(el) ?? [], [] as unknown[]);
  return found.filter((d): d is object => !!d && typeof d === 'object');
}

export function componentHosts<H extends object = Element>(
  ng: ComponentDebugNg<H>,
  tree: HostTree<H> = documentTree(),
  limit = MAX_COMPONENTS,
): H[] {
  const out: H[] = [];
  const visit = (el: H, depth: number) => {
    if (out.length >= limit || depth > MAX_DEPTH) return;
    if (componentAt(ng, el)) out.push(el);
    for (const child of tree.children(el)) visit(child, depth + 1);
  };
  for (const root of tree.roots()) visit(root, 0);
  return out;
}

function hostsUnder<H extends object>(
  ng: ComponentDebugNg<H>,
  tree: HostTree<H>,
  scope: H,
  tag: string,
): H[] {
  const out: H[] = [];
  const visit = (el: H, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const child of tree.children(el)) {
      if (componentAt(ng, child)) {
        if (tree.tag(child) === tag) out.push(child);
      } else {
        visit(child, depth + 1);
      }
    }
  };
  visit(scope, 0);
  return out;
}

export function hostPath<H extends object = Element>(
  ng: ComponentDebugNg<H>,
  el: H,
  tree: HostTree<H> = documentTree(),
): string {
  const chain: H[] = [];
  let top: H = el;
  for (let node: H | null = el; node; node = tree.parent(node)) {
    top = node;
    if (componentAt(ng, node)) chain.unshift(node);
  }
  return chain
    .map((node, i) => {
      const tag = tree.tag(node);
      const scope = i > 0 ? chain[i - 1] : top === node ? null : top;
      const twins = scope ? hostsUnder(ng, tree, scope, tag) : [node];
      return twins.length > 1 ? `${tag}[${twins.indexOf(node) + 1}]` : tag;
    })
    .join(' > ');
}

export function componentHostOf<H extends object = Element>(
  ng: ComponentDebugNg<H> | undefined,
  el: H,
  tree: HostTree<H> = documentTree(),
): H | null {
  if (!ng?.getComponent) return null;
  for (let node: H | null = el; node; node = tree.parent(node)) {
    if (componentAt(ng, node)) return node;
  }
  return null;
}

export function unwrap<H extends object>(ng: ComponentDebugNg<H>, value: unknown): unknown {
  if (typeof value !== 'function') return value;
  const signal = read(() => !!ng.isSignal?.(value), false);
  return signal ? read(() => (value as () => unknown)(), undefined) : value;
}

/** The first level of a value, with the instance itself shown as `[Circular]` inside it. */
function levelOf(instance: object, secrets?: ReadonlySet<string>) {
  return { ...VALUE_LEVEL, ancestors: [instance], secrets };
}

function propName(entry: unknown, fallback: string): string {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return fallback;
}

function readInputs<H extends object>(
  ng: ComponentDebugNg<H>,
  instance: object,
  inputs: Record<string, unknown> | undefined,
  secrets?: ReadonlySet<string>,
): ComponentProp[] {
  return Object.entries(inputs ?? {})
    .slice(0, MAX_PROPS)
    .map(([name, entry]) => {
      const prop = propName(entry, name);
      const raw = read(() => (instance as Record<string, unknown>)[prop], undefined);
      const key = isSecretName(prop) ? prop : name;
      return {
        name,
        prop,
        value: serializeNamed(key, unwrap(ng, raw), levelOf(instance, secrets)),
      };
    });
}

/**
 * A data property of `target` or its prototypes, read from its descriptor so
 * no getter runs; undefined for an accessor or a missing name.
 */
function dataField(target: object, name: string): unknown {
  for (
    let at: object | null = target;
    at && at !== Object.prototype;
    at = read<object | null>(() => Object.getPrototypeOf(at), null)
  ) {
    const found = read(() => Object.getOwnPropertyDescriptor(at, name), undefined);
    if (found) return 'value' in found ? found.value : undefined;
  }
  return undefined;
}

/**
 * A snapshot of an Angular resource (`resource()`, `rxResource()`,
 * `httpResource()`), or null for any other value. Angular keeps `value`,
 * `status` and `error` as own signal fields and `hasValue` on the prototype;
 * they are read through descriptors, so a getter on a look-alike never runs.
 */
export function resourceOf<H extends object>(
  ng: ComponentDebugNg<H>,
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const ref = {
    value: dataField(value, 'value'),
    status: dataField(value, 'status'),
    error: dataField(value, 'error'),
    hasValue: dataField(value, 'hasValue'),
  };
  const isSignal = (field: unknown) => read(() => !!ng.isSignal?.(field), false);
  if (
    !isSignal(ref['value']) ||
    !isSignal(ref['status']) ||
    typeof ref['hasValue'] !== 'function'
  ) {
    return null;
  }
  const call = (field: unknown) => read(() => (field as () => unknown)(), undefined);
  const snapshot: Record<string, unknown> = {
    status: call(ref['status']),
    value: call(ref['value']),
  };
  if (isSignal(ref['error'])) {
    const error = call(ref['error']);
    if (error !== undefined) snapshot['error'] = error;
  }
  return snapshot;
}

export function injectedValues<H extends object>(
  ng: ComponentDebugNg<H>,
  injector: unknown,
  owner: unknown,
): Set<unknown> {
  const values = new Set<unknown>();
  const result = read(() => ng.ɵgetDependenciesFromInjectable?.(injector, owner) ?? null, null);
  for (const dep of result?.dependencies ?? []) {
    if (dep.value !== null && typeof dep.value === 'object') values.add(dep.value);
  }
  return values;
}

function readProperties<H extends object>(
  ng: ComponentDebugNg<H>,
  instance: object,
  skip: Set<string>,
  injected: Set<unknown>,
  secrets?: ReadonlySet<string>,
): ComponentProp[] {
  const out: ComponentProp[] = [];
  const keys = read(() => Object.keys(instance), [] as string[]);
  for (const name of keys) {
    if (out.length >= MAX_PROPS) break;
    if (skip.has(name) || name.startsWith('__ng') || name.startsWith('ɵ')) continue;
    const raw = read(() => (instance as Record<string, unknown>)[name], undefined);
    if (injected.has(raw)) continue;
    const resource = resourceOf(ng, raw);
    if (resource) {
      out.push({
        name,
        prop: name,
        kind: 'resource',
        value: serializeNamed(name, resource, levelOf(instance, secrets)),
      });
      continue;
    }
    const isSignal = typeof raw === 'function' && read(() => !!ng.isSignal?.(raw), false);
    if (typeof raw === 'function' && !isSignal) continue;
    const prop: ComponentProp = {
      name,
      prop: name,
      value: serializeNamed(name, unwrap(ng, raw), levelOf(instance, secrets)),
    };
    if (isSignal) prop.kind = 'signal';
    out.push(prop);
  }
  return out;
}

function readOutputs(
  outputs: Record<string, unknown> | undefined,
  listened: Set<string>,
): ComponentProp[] {
  return Object.entries(outputs ?? {})
    .slice(0, MAX_PROPS)
    .map(([name, entry]) => ({ name, prop: propName(entry, name), listened: listened.has(name) }));
}

export function componentDetail<H extends object = Element>(
  ng: ComponentDebugNg<H>,
  el: H,
  tree?: HostTree<H>,
): ComponentDetail | null {
  const hosts = tree ?? documentTree<H>();
  const instance = componentAt(ng, el);
  if (!instance) return null;
  const meta = read(() => ng.getDirectiveMetadata?.(instance) ?? null, null);
  const listeners = read(
    () => ng.getListeners?.(el) ?? [],
    [] as { name: string; type?: string }[],
  );
  const listened = new Set(listeners.filter((l) => l.type === 'output').map((l) => l.name));
  const dom = [...new Set(listeners.filter((l) => l.type !== 'output').map((l) => l.name))];
  const directives = directivesAt(ng, el).filter((d) => d !== instance);
  const injector = read(() => ng.getInjector?.(el) ?? null, null);
  const bound = new Set(
    [...Object.entries(meta?.inputs ?? {}), ...Object.entries(meta?.outputs ?? {})].map(
      ([name, entry]) => propName(entry, name),
    ),
  );
  const injected = injector ? injectedValues(ng, injector, instance.constructor) : new Set();
  const masked = maskedFormValues(ng, el);

  const detail: ComponentDetail = {
    id: elementId(el),
    name: nameOf(instance),
    tag: hosts.tag(el),
    path: hostPath(ng, el, hosts),
    inputs: readInputs(ng, instance, meta?.inputs, masked),
    outputs: readOutputs(meta?.outputs, listened),
    properties: readProperties(ng, instance, bound, injected, masked),
    listeners: dom.slice(0, MAX_PROPS),
    directives: directives.map((directive) => {
      const dirMeta = read(() => ng.getDirectiveMetadata?.(directive) ?? null, null);
      return {
        name: nameOf(directive),
        inputs: readInputs(ng, directive, dirMeta?.inputs, masked),
        outputs: readOutputs(dirMeta?.outputs, listened),
      };
    }),
    dependencies: [],
  };
  markEditable(ng, instance, detail);
  const source = componentSource(instance);
  if (source) detail.source = source;
  const cd = meta?.changeDetection;
  if (typeof cd === 'number' && CHANGE_DETECTION[cd]) detail.changeDetection = CHANGE_DETECTION[cd];
  const enc = meta?.encapsulation;
  if (typeof enc === 'number' && ENCAPSULATION[enc]) detail.encapsulation = ENCAPSULATION[enc];

  if (injector) {
    detail.dependencies = dependenciesOf(
      ng,
      injector,
      [instance.constructor],
      true,
      undefined,
      tree,
    );
  }
  return detail;
}

export interface CollectOptions<H extends object> {
  tree?: HostTree<H>;
  selectedId?: string | null;
  /**
   * List elements that host directives but no component as `kind: 'directive'`
   * nodes, up to {@link MAX_DIRECTIVE_HOSTS}. The browser overlay turns it on;
   * the native overlays describe views, not elements, and leave it off.
   */
  directiveHosts?: boolean;
  /** Read each component host's hydration status, for a DOM page that may come from the server. */
  hydration?: boolean;
  /** Adds to the selected instance's detail, such as the value levels the panel opened. */
  withDetail?: (detail: ComponentDetail, host: H) => void;
}

export function collectComponentTree<H extends object = Element>(
  ng: ComponentDebugNg<H> | undefined,
  options: CollectOptions<H> = {},
): Omit<ComponentTreeReport, 'pageId'> {
  const tree = options.tree ?? documentTree<H>();
  const report: Omit<ComponentTreeReport, 'pageId'> = { roots: [], count: 0, detail: null };
  if (!ng?.getComponent) return report;
  const hydration = options.hydration ? createHydrationTally(ng) : null;
  let directiveHosts = 0;

  const visit = (el: H, out: LiveComponentNode[], depth: number) => {
    if (depth > MAX_DEPTH) {
      report.truncated = true;
      report.truncatedBy = { ...report.truncatedBy, depth: MAX_DEPTH };
      return;
    }
    const instance = componentAt(ng, el);
    let target = out;
    if (instance) {
      if (report.count >= MAX_COMPONENTS) {
        report.truncated = true;
        report.truncatedBy = { ...report.truncatedBy, components: MAX_COMPONENTS };
        return;
      }
      report.count++;
      const node: LiveComponentNode = {
        id: elementId(el),
        name: nameOf(instance),
        tag: tree.tag(el),
        children: [],
      };
      const others = directivesAt(ng, el).filter((d) => d !== instance);
      if (others.length) {
        node.directives = others.map(nameOf);
        if (options.directiveHosts) {
          const attributes = selectorAttributes(others);
          if (attributes.length) node.attributes = attributes;
        }
      }
      hydration?.add(node, el);
      out.push(node);
      target = node.children;
    } else if (options.directiveHosts) {
      const directives = directivesAt(ng, el);
      if (directives.length) {
        if (directiveHosts >= MAX_DIRECTIVE_HOSTS) {
          report.truncated = true;
          report.truncatedBy = { ...report.truncatedBy, directiveHosts: MAX_DIRECTIVE_HOSTS };
        } else {
          directiveHosts++;
          const names = directives.map(nameOf);
          const node: LiveComponentNode = {
            id: elementId(el),
            name: names[0],
            tag: tree.tag(el),
            kind: 'directive',
            directives: names,
            children: [],
          };
          const attributes = selectorAttributes(directives);
          if (attributes.length) node.attributes = attributes;
          out.push(node);
          target = node.children;
        }
      }
    }
    for (const child of tree.children(el)) visit(child, target, depth + 1);
  };
  for (const root of tree.roots()) visit(root, report.roots, 0);
  if (directiveHosts) report.directiveHostCount = directiveHosts;
  const summary = hydration?.finish(typeof document === 'undefined' ? undefined : document);
  if (summary) report.hydration = summary;

  pruneElementIds((host: object) => tree.isHost(host) && tree.connected(host));
  report.detail = selectedComponentDetail(ng, options);
  return report;
}

/**
 * The detail of the instance `options.selectedId` names, or null. A tree
 * reused while the page's elements stay the same still gets a fresh detail.
 */
export function selectedComponentDetail<H extends object = Element>(
  ng: ComponentDebugNg<H>,
  options: CollectOptions<H>,
): ComponentDetail | null {
  const tree = options.tree ?? documentTree<H>();
  const connected = (host: object) => tree.isHost(host) && tree.connected(host);
  const selected = options.selectedId ? elementById<H>(options.selectedId, connected) : null;
  const detail = selected ? componentDetail(ng, selected, options.tree) : null;
  if (selected && detail) options.withDetail?.(detail, selected);
  return detail;
}
