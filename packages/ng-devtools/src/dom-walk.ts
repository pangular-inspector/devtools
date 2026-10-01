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

/**
 * Every element below `root` in document order, `root` included, going into
 * open shadow roots. With `comments`, the comment nodes Angular anchors an
 * `<ng-container>` on come along too.
 */
export function* walkElements(root: Element, comments = false): Generator<Element | Comment> {
  const stack: (Element | Comment)[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    yield node;
    if (isComment(node)) continue;
    const children: (Element | Comment)[] = [];
    const add = (parent: ParentNode) => {
      for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType === 1 || (comments && isComment(child))) {
          children.push(child as Element | Comment);
        }
      }
    };
    add(node);
    const shadow = (node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (shadow) add(shadow);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}
