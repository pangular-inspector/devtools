/**
 * The tree Angular rendered into, as the collectors walk it. In the browser it
 * is the DOM (`domTree()`); a platform without one, such as NativeScript or
 * Angular Native, describes its own views instead.
 */
export interface HostTree<H extends object> {
  /** Where a walk of the app starts, in render order. */
  roots(): H[];
  /** The direct children of a host, in render order. */
  children(host: H): H[];
  /** The host this one renders in, or null at the top. */
  parent(host: H): H | null;
  /** What a host is called in a component path: a tag name or a view type. */
  tag(host: H): string;
  /** Whether the host is still part of the rendered tree. */
  connected(host: H): boolean;
  /** Whether a value, such as the source of an element injector, is a host of this tree. */
  isHost(value: unknown): value is H;
  /** A query that finds the host again, or null when it has none. */
  selector?(host: H): string | null;
  /**
   * Whether the host renders nothing itself, such as the comment Angular
   * anchors an `<ng-container>` on. It can carry directives but no component.
   */
  isAnchor?(host: H): boolean;
}

export function childElements(el: Element): Element[] {
  const children = Array.from(el.children);
  const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (shadow) children.push(...Array.from(shadow.children));
  return children;
}

export function parentOf(node: Node): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.parentNode;
  return root && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
}

export function isComment(value: unknown): value is Comment {
  return !!value && typeof value === 'object' && (value as Node).nodeType === 8;
}

function childNodes(el: Element): (Element | Comment)[] {
  const out: (Element | Comment)[] = [];
  const add = (parent: ParentNode) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 1 || isComment(child)) out.push(child as Element | Comment);
    }
  };
  add(el);
  const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (shadow) add(shadow);
  return out;
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

function selectorCache(doc: Document) {
  const selectors = new Map<Element, string | null>();
  const positions = new Map<Element, number>();
  const top = doc.documentElement;
  const selectorOf = (el: Element): string | null => {
    if (el === top) return '';
    const known = selectors.get(el);
    if (known !== undefined) return known;
    const parent = el.parentElement;
    const tag = el.tagName.toLowerCase();
    let out: string | null = el.parentNode === doc ? tag : null;
    if (parent) {
      if (!positions.has(el)) {
        let index = 0;
        for (const child of Array.from(parent.children)) positions.set(child, ++index);
      }
      const prefix = selectorOf(parent);
      const part = `${tag}:nth-child(${positions.get(el)})`;
      out = prefix === null ? null : prefix ? `${prefix} > ${part}` : part;
    }
    selectors.set(el, out);
    return out;
  };
  return selectorOf;
}

/**
 * The DOM of `doc`, going into open shadow roots. With `anchors`, the comments
 * Angular anchors an `<ng-container>` on are hosts too, named `ng-container`.
 * Selectors are cached, so take a fresh tree for each collection.
 */
export function domTree(doc?: Document): HostTree<Element>;
export function domTree(doc: Document, options: { anchors: true }): HostTree<Element | Comment>;
export function domTree(
  doc: Document = document,
  options: { anchors?: boolean } = {},
): HostTree<Element | Comment> {
  const selectorOf = selectorCache(doc);
  return {
    roots: () => angularRoots(doc),
    children: (host) =>
      isComment(host) ? [] : options.anchors ? childNodes(host) : childElements(host),
    parent: parentOf,
    tag: (host) => (isComment(host) ? 'ng-container' : host.tagName.toLowerCase()),
    connected: (host) => host.isConnected,
    isHost: (value): value is Element | Comment =>
      (typeof Element !== 'undefined' && value instanceof Element) ||
      (!!options.anchors && isComment(value)),
    selector: (host) => (isComment(host) ? null : selectorOf(host)),
    isAnchor: isComment,
  };
}

/** The DOM tree, for a collector whose host type is a parameter that defaults to Element. */
export function documentTree<H extends object>(): HostTree<H> {
  return domTree() as unknown as HostTree<H>;
}

export function hostBySelector<H extends object>(tree: HostTree<H>, selector: string): H | null {
  if (!tree.selector) return null;
  const stack = [...tree.roots()].reverse();
  while (stack.length) {
    const host = stack.pop()!;
    if (tree.selector(host) === selector) return host;
    stack.push(...[...tree.children(host)].reverse());
  }
  return null;
}
