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

export function childElements(el: Element): Element[] {
  const children = Array.from(el.children);
  const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (shadow) children.push(...Array.from(shadow.children));
  return children;
}

function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.parentNode;
  return root && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
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

export function hostPath(ng: ComponentDebugNg, el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node; node = parentOf(node)) {
    if (!componentAt(ng, node)) continue;
    const tag = node.tagName.toLowerCase();
    const parent = node.parentNode;
    const twins = parent
      ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName)
      : [];
    parts.unshift(twins.length > 1 ? `${tag}[${twins.indexOf(node) + 1}]` : tag);
  }
  return parts.join(' > ');
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

  const detail: ComponentDetail = {
    id: elementId(el),
    name: nameOf(instance),
    tag: el.tagName.toLowerCase(),
    path: hostPath(ng, el),
    inputs: readInputs(ng, instance, meta?.inputs),
    outputs: readOutputs(meta?.outputs, listened),
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

  const injector = read(() => ng.getInjector?.(el) ?? null, null);
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
      return;
    }
    const instance = componentAt(ng, el);
    let target = out;
    if (instance) {
      if (report.count >= MAX_COMPONENTS) {
        report.truncated = true;
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
