// The NativeScript side of the overlay that needs no NativeScript import:
// Angular renders into `@nativescript/core` views instead of DOM elements, and
// the host tree here lets the shared collectors walk those views.

import type { HostTree } from './host-tree.ts';

/**
 * The part of a `@nativescript/core` View the overlay touches. Structural, so
 * this file compiles and tests without the framework installed.
 */
export interface NativeView {
  readonly typeName: string;
  parent?: NativeView | null;
  eachChildView?(callback: (child: NativeView) => boolean): void;
  /** The element name a template used when it is not a registered view. */
  customCSSName?: string;
  isLoaded?: boolean;
  borderWidth?: unknown;
  borderColor?: unknown;
}

/** The subset of the `ng` global the NativeScript tree reads. */
export interface NativeScriptDebugNg {
  getComponent?(host: NativeView): unknown;
  getRootComponents?(hostOrDirective: unknown): unknown[];
  getHostElement?(componentOrDirective: unknown): NativeView | null;
}

export function viewChildren(view: NativeView): NativeView[] {
  const out: NativeView[] = [];
  view.eachChildView?.((child) => {
    out.push(child);
    return true;
  });
  return out;
}

/** The view at the top of the parent chain. */
export function topmostView(view: NativeView): NativeView {
  let current = view;
  while (current.parent) current = current.parent;
  return current;
}

/**
 * The host of the root component of the application that rendered `view`.
 * NativeScript makes the root component's template content the app's root
 * view and leaves the host above it without a parent link, so the host is
 * asked for through Angular rather than found by climbing.
 */
export function angularRootHost(ng: NativeScriptDebugNg, view: NativeView): NativeView | null {
  try {
    for (const component of ng.getRootComponents?.(view) ?? []) {
      const host = ng.getHostElement?.(component);
      if (host) return host;
    }
  } catch {
    // the view was not rendered by Angular
  }
  return null;
}

/** Where a walk of the app should start, given the view NativeScript reports as root. */
export function nativeScriptRoot(ng: NativeScriptDebugNg, view: NativeView): NativeView {
  return angularRootHost(ng, view) ?? topmostView(view);
}

/**
 * The selector of a component from its definition, so a host reports
 * `ns-person` whether the renderer gave it a proxy container or a real view.
 */
export function selectorOf(view: NativeView, component: unknown): string {
  const definition = (component as { constructor?: { ɵcmp?: { selectors?: unknown[][] } } } | null)
    ?.constructor?.ɵcmp;
  const first = definition?.selectors?.[0]?.[0];
  if (typeof first === 'string' && first) return first;
  return view.customCSSName ?? view.typeName.toLowerCase();
}

export function isNativeView(value: unknown): value is NativeView {
  const view = value as Partial<NativeView> | null;
  return (
    !!view &&
    typeof view === 'object' &&
    typeof view.typeName === 'string' &&
    typeof view.eachChildView === 'function'
  );
}

/**
 * The views under the root component of the app. The root is looked up again
 * on every walk, since NativeScript replaces the root view on some navigations.
 * A host is named by its component's selector, which is also what `find()`
 * matches.
 */
export function nativeScriptTree(
  getNg: () => NativeScriptDebugNg | undefined,
  getRootView: () => NativeView | undefined,
): HostTree<NativeView> {
  let root: NativeView | null = null;
  let rootChildren: NativeView[] = [];
  const refresh = () => {
    const ng = getNg();
    const view = getRootView();
    root = ng && view ? nativeScriptRoot(ng, view) : null;
    rootChildren = root ? viewChildren(root) : [];
    return root;
  };
  const tag = (view: NativeView) => {
    let component: unknown = null;
    try {
      component = getNg()?.getComponent?.(view) ?? null;
    } catch {
      // not Angular's
    }
    return selectorOf(view, component);
  };
  return {
    roots: () => {
      const top = refresh();
      return top ? [top] : [];
    },
    children: viewChildren,
    parent: (view) => view.parent ?? (view !== root && rootChildren.includes(view) ? root : null),
    tag,
    connected: (view) => view.isLoaded !== false,
    isHost: isNativeView,
    selector: tag,
  };
}

/**
 * The first view under `view` that draws something. A component host is
 * usually a ProxyViewContainer, which has no native view of its own.
 */
export function renderedView(view: NativeView): NativeView {
  let current = view;
  while (current.typeName === 'ProxyViewContainer') {
    const [first] = viewChildren(current);
    if (!first) break;
    current = first;
  }
  return current;
}
