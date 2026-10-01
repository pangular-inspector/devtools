import { childElements, parentOf } from './dom-walk.ts';
import { elementById, elementId, pruneElementIds } from './element-id.ts';
import { className, dependenciesOf, type DebugNg } from './injector-tree.ts';
import { isSecretName, serializeNamed } from './serialize.ts';
import type {
  ComponentDetail,
  ComponentProp,
  ComponentTreeReport,
  LiveComponentNode,
} from './types.ts';

export interface ComponentDebugNg extends DebugNg {
  getComponent?(el: Element): unknown;
  getDirectives?(el: Element): unknown[];
  getDirectiveMetadata?(instance: unknown): {
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    changeDetection?: number;
    encapsulation?: number;
  } | null;
  getListeners?(el: Element): { name: string; type?: string }[];
  isSignal?(value: unknown): boolean;
}

const MAX_COMPONENTS = 2000;
const MAX_DEPTH = 256;
const MAX_PROPS = 60;
const VALUE_LIMITS = { depth: 3, keys: 30, items: 30, text: 300 };

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

function componentAt(ng: ComponentDebugNg, el: Element): object | null {
  const found = read(() => ng.getComponent?.(el) ?? null, null);
  return found && typeof found === 'object' ? found : null;
}

function directivesAt(ng: ComponentDebugNg, el: Element): object[] {
  const found = read(() => ng.getDirectives?.(el) ?? [], [] as unknown[]);
  return found.filter((d): d is object => !!d && typeof d === 'object');
}

export function angularRoots(doc: Document = document): Element[] {
  const tagged = Array.from(doc.querySelectorAll('[ng-version]'));
  const roots = tagged.filter((root) => !tagged.some((o) => o !== root && o.contains(root)));
  if (!doc.body) return roots;
  if (!roots.length) return [doc.body];
  const outside: Element[] = [];
  const collect = (el: Element) => {
    for (const child of childElements(el)) {
      if (roots.includes(child)) continue;
      if (roots.some((root) => child.contains(root))) collect(child);
      else outside.push(child);
    }
  };
  collect(doc.body);
  return [...roots, ...outside];
}

export function componentHosts(
  ng: ComponentDebugNg,
  doc: Document = document,
  limit = MAX_COMPONENTS,
): Element[] {
  const out: Element[] = [];
  const visit = (el: Element, depth: number) => {
    if (out.length >= limit || depth > MAX_DEPTH) return;
    if (componentAt(ng, el)) out.push(el);
    for (const child of childElements(el)) visit(child, depth + 1);
  };
  for (const root of angularRoots(doc)) visit(root, 0);
  return out;
}

function hostsUnder(ng: ComponentDebugNg, scope: Element, tagName: string): Element[] {
  const out: Element[] = [];
  const visit = (el: Element, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const child of childElements(el)) {
      if (componentAt(ng, child)) {
        if (child.tagName === tagName) out.push(child);
      } else {
        visit(child, depth + 1);
      }
    }
  };
  visit(scope, 0);
  return out;
}

export function hostPath(ng: ComponentDebugNg, el: Element): string {
  const chain: Element[] = [];
  let top: Element = el;
  for (let node: Element | null = el; node; node = parentOf(node)) {
    top = node;
    if (componentAt(ng, node)) chain.unshift(node);
  }
  return chain
    .map((node, i) => {
      const tag = node.tagName.toLowerCase();
      const scope = i > 0 ? chain[i - 1] : top === node ? null : top;
      const twins = scope ? hostsUnder(ng, scope, node.tagName) : [node];
      return twins.length > 1 ? `${tag}[${twins.indexOf(node) + 1}]` : tag;
    })
    .join(' > ');
}

export function componentHostOf(ng: ComponentDebugNg | undefined, el: Element): Element | null {
  if (!ng?.getComponent) return null;
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (componentAt(ng, node)) return node;
  }
  return null;
}

function unwrap(ng: ComponentDebugNg, value: unknown): unknown {
  if (typeof value !== 'function') return value;
  const signal = read(() => !!ng.isSignal?.(value), false);
  return signal ? read(() => (value as () => unknown)(), undefined) : value;
}

function propName(entry: unknown, fallback: string): string {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return fallback;
}

function readInputs(
  ng: ComponentDebugNg,
  instance: object,
  inputs: Record<string, unknown> | undefined,
): ComponentProp[] {
  return Object.entries(inputs ?? {})
    .slice(0, MAX_PROPS)
    .map(([name, entry]) => {
      const prop = propName(entry, name);
      const raw = read(() => (instance as Record<string, unknown>)[prop], undefined);
      const key = isSecretName(prop) ? prop : name;
      return { name, prop, value: serializeNamed(key, unwrap(ng, raw), VALUE_LIMITS) };
    });
}

function resourceOf(ng: ComponentDebugNg, value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const ref = value as Record<string, unknown>;
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

function injectedValues(ng: ComponentDebugNg, injector: unknown, owner: unknown): Set<unknown> {
  const values = new Set<unknown>();
  const result = read(() => ng.ɵgetDependenciesFromInjectable?.(injector, owner) ?? null, null);
  for (const dep of result?.dependencies ?? []) {
    if (dep.value !== null && typeof dep.value === 'object') values.add(dep.value);
  }
  return values;
}

function readProperties(
  ng: ComponentDebugNg,
  instance: object,
  skip: Set<string>,
  injected: Set<unknown>,
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
        value: serializeNamed(name, resource, VALUE_LIMITS),
      });
      continue;
    }
    const isSignal = typeof raw === 'function' && read(() => !!ng.isSignal?.(raw), false);
    if (typeof raw === 'function' && !isSignal) continue;
    const prop: ComponentProp = {
      name,
      prop: name,
      value: serializeNamed(name, unwrap(ng, raw), VALUE_LIMITS),
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

export function componentDetail(ng: ComponentDebugNg, el: Element): ComponentDetail | null {
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

  const detail: ComponentDetail = {
    id: elementId(el),
    name: nameOf(instance),
    tag: el.tagName.toLowerCase(),
    path: hostPath(ng, el),
    inputs: readInputs(ng, instance, meta?.inputs),
    outputs: readOutputs(meta?.outputs, listened),
    properties: readProperties(ng, instance, bound, injected),
    listeners: dom.slice(0, MAX_PROPS),
    directives: directives.map((directive) => {
      const dirMeta = read(() => ng.getDirectiveMetadata?.(directive) ?? null, null);
      return {
        name: nameOf(directive),
        inputs: readInputs(ng, directive, dirMeta?.inputs),
        outputs: readOutputs(dirMeta?.outputs, listened),
      };
    }),
    dependencies: [],
  };
  const cd = meta?.changeDetection;
  if (typeof cd === 'number' && CHANGE_DETECTION[cd]) detail.changeDetection = CHANGE_DETECTION[cd];
  const enc = meta?.encapsulation;
  if (typeof enc === 'number' && ENCAPSULATION[enc]) detail.encapsulation = ENCAPSULATION[enc];

  if (injector) {
    detail.dependencies = dependenciesOf(ng, injector, [instance.constructor], true);
  }
  return detail;
}

export function collectComponentTree(
  ng: ComponentDebugNg | undefined,
  options: { doc?: Document; selectedId?: string | null } = {},
): Omit<ComponentTreeReport, 'pageId'> {
  const doc = options.doc ?? document;
  const report: Omit<ComponentTreeReport, 'pageId'> = { roots: [], count: 0, detail: null };
  if (!ng?.getComponent) return report;

  const visit = (el: Element, out: LiveComponentNode[], depth: number) => {
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
        tag: el.tagName.toLowerCase(),
        children: [],
      };
      const directives = directivesAt(ng, el)
        .filter((d) => d !== instance)
        .map(nameOf);
      if (directives.length) node.directives = directives;
      out.push(node);
      target = node.children;
    }
    for (const child of childElements(el)) visit(child, target, depth + 1);
  };
  for (const root of angularRoots(doc)) visit(root, report.roots, 0);

  pruneElementIds();
  const selected = options.selectedId ? elementById(options.selectedId) : null;
  if (selected) report.detail = componentDetail(ng, selected);
  return report;
}
