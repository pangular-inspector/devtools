import type { HostTree } from './host-tree.ts';
import { HIGHLIGHT_SAFETY_MS } from './page-highlight.ts';

/**
 * The part of an `@ng-native/fabric` engine node the overlay reads. Structural,
 * so this file compiles and tests without Angular Native installed.
 */
export interface AngularNativeNode {
  /** `element`, `text` or `anchor`. */
  readonly kind: string;
  /** The template spelling, such as `view` or `app-row`. */
  readonly name: string;
  readonly children: readonly AngularNativeNode[];
  readonly parent: AngularNativeNode | null;
  props?: Record<string, unknown>;
  ownStyle?: object;
  readonly host?: { setProp(node: never, key: string, value: unknown): void };
}

export interface AngularNativeDebugNg {
  getComponent?(host: AngularNativeNode): unknown;
}

export function isAngularNativeNode(value: unknown): value is AngularNativeNode {
  const node = value as Partial<AngularNativeNode> | null;
  return (
    !!node &&
    typeof node === 'object' &&
    (node.kind === 'element' || node.kind === 'anchor') &&
    typeof node.name === 'string' &&
    Array.isArray(node.children)
  );
}

export function componentSelector(component: unknown): string | null {
  const definition = (component as { constructor?: { ɵcmp?: { selectors?: unknown[][] } } } | null)
    ?.constructor?.ɵcmp;
  const first = definition?.selectors?.[0]?.[0];
  return typeof first === 'string' && first ? first : null;
}

function elementSiblings(node: AngularNativeNode): readonly AngularNativeNode[] {
  return node.parent ? node.parent.children.filter((child) => child.kind === 'element') : [node];
}

/**
 * The engine's tree under the root node `mount()` created. Text runs are left
 * out, and `@if`, `@for` and `<ng-container>` anchors are hosts named
 * `ng-container`, as comments are in the DOM. The root node is named by the
 * selector of the component it hosts, and a selector is a path of
 * `name:nth-child(n)` steps from it.
 */
export function angularNativeTree(
  getRoot: () => AngularNativeNode | null | undefined,
  getNg: () => AngularNativeDebugNg | undefined,
): HostTree<AngularNativeNode> {
  const rootTag = (root: AngularNativeNode) => {
    let component: unknown = null;
    try {
      component = getNg()?.getComponent?.(root) ?? null;
    } catch {
      component = null;
    }
    return componentSelector(component) ?? root.name;
  };
  const tag = (node: AngularNativeNode) => {
    if (node.kind === 'anchor') return 'ng-container';
    return node === getRoot() ? rootTag(node) : node.name;
  };
  const connected = (node: AngularNativeNode) => {
    const root = getRoot();
    for (let at: AngularNativeNode | null = node; at; at = at.parent) if (at === root) return true;
    return false;
  };
  const selector = (node: AngularNativeNode): string | null => {
    if (node.kind !== 'element' || !connected(node)) return null;
    const steps: string[] = [];
    let at: AngularNativeNode = node;
    while (at.parent && at !== getRoot()) {
      steps.unshift(`${at.name}:nth-child(${elementSiblings(at).indexOf(at) + 1})`);
      at = at.parent;
    }
    steps.unshift(tag(at));
    return steps.join(' > ');
  };
  return {
    roots: () => {
      const root = getRoot();
      return root ? [root] : [];
    },
    children: (node) =>
      node.kind === 'element' ? node.children.filter((child) => child.kind !== 'text') : [],
    parent: (node) => (node === getRoot() ? null : node.parent),
    tag,
    connected,
    isHost: isAngularNativeNode,
    selector,
    isAnchor: (node) => node.kind === 'anchor',
  };
}

const OUTLINE = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '#68b6ff' };

let outlined: {
  restore: () => void;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

function writeStyle(node: AngularNativeNode, changes: Record<string, unknown>): boolean {
  const current = node.props?.['style'];
  if (!node.host || (current != null && (typeof current !== 'object' || Array.isArray(current)))) {
    return false;
  }
  const next: Record<string, unknown> = { ...(current as Record<string, unknown> | undefined) };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  node.ownStyle = next;
  node.host.setProp(node as never, 'style', next);
  return true;
}

/**
 * Merge a React Native style array the way `StyleSheet.flatten` does: later
 * entries win and falsy ones are skipped. Null when an entry is not an object,
 * such as an old numeric style id.
 */
function flattenStyle(style: unknown): Record<string, unknown> | null {
  if (!Array.isArray(style)) {
    return style && typeof style === 'object' ? { ...(style as Record<string, unknown>) } : null;
  }
  const out: Record<string, unknown> = {};
  for (const entry of style) {
    if (!entry) continue;
    const flat = flattenStyle(entry);
    if (!flat) return null;
    Object.assign(out, flat);
  }
  return out;
}

/**
 * Outline a style array through one merged object, and put the array back on
 * clear unless the app has set another style since.
 */
function outlineStyleArray(node: AngularNativeNode, style: unknown[]): (() => void) | null {
  const host = node.host;
  const flat = flattenStyle(style);
  if (!host || !flat) return null;
  const ownStyle = node.ownStyle;
  const next = { ...flat, ...OUTLINE };
  node.ownStyle = next;
  host.setProp(node as never, 'style', next);
  return () => {
    if (node.props?.['style'] !== next) return;
    node.ownStyle = ownStyle;
    host.setProp(node as never, 'style', style);
  };
}

/**
 * Outline one element through its inline style, which the engine applies
 * after the cascade, until `clearOutline()` or `durationMs`. Returns false when
 * the node cannot be outlined.
 */
export function showOutline(node: AngularNativeNode, durationMs?: number): boolean {
  clearOutline();
  if (node.kind !== 'element') return false;
  const current = node.props?.['style'];
  let restore: (() => void) | null;
  if (Array.isArray(current)) {
    restore = outlineStyleArray(node, current);
  } else {
    const style = (current ?? {}) as Record<string, unknown>;
    const before = Object.fromEntries(Object.keys(OUTLINE).map((key) => [key, style[key]]));
    restore = writeStyle(node, OUTLINE) ? () => void writeStyle(node, before) : null;
  }
  if (!restore) return false;
  const timer = setTimeout(
    clearOutline,
    typeof durationMs === 'number' && durationMs > 0
      ? Math.min(durationMs, HIGHLIGHT_SAFETY_MS)
      : HIGHLIGHT_SAFETY_MS,
  );
  outlined = { restore, timer };
  return true;
}

/** Put back the style values the outlined element had. */
export function clearOutline() {
  if (!outlined) return;
  const { restore, timer } = outlined;
  outlined = null;
  clearTimeout(timer);
  restore();
}
