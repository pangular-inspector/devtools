// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { angularRoots, domTree, type HostTree } from '../host-tree.ts';

function walk<H extends object>(tree: HostTree<H>): H[] {
  const out: H[] = [];
  const visit = (host: H) => {
    out.push(host);
    tree.children(host).forEach(visit);
  };
  tree.roots().forEach(visit);
  return out;
}

describe('domTree', () => {
  it('walks elements in document order, into open shadow roots', () => {
    document.body.innerHTML =
      '<a-root><b-shell><i-light></i-light></b-shell><e-tail></e-tail></a-root>';
    const shell = document.querySelector('b-shell')!;
    shell.attachShadow({ mode: 'open' }).innerHTML = '<c-child><d-leaf></d-leaf></c-child>';
    const tree = domTree();
    expect(walk(tree).map((el) => tree.tag(el))).toEqual([
      'body',
      'a-root',
      'b-shell',
      'i-light',
      'c-child',
      'd-leaf',
      'e-tail',
    ]);
    const leaf = shell.shadowRoot!.querySelector('d-leaf')!;
    expect(tree.parent(tree.parent(leaf)!)).toBe(shell);
    expect(tree.parent(document.documentElement)).toBeNull();
  });

  it('lists ng-container anchors only when asked', () => {
    document.body.innerHTML = '<div><!--container--><span></span></div>';
    expect(walk(domTree()).some((n) => n.nodeType === 8)).toBe(false);
    const tree = domTree(document, { anchors: true });
    const all = walk(tree);
    expect(all.map((n) => n.nodeName)).toEqual(['BODY', 'DIV', '#comment', 'SPAN']);
    const anchor = all[2];
    expect(tree.tag(anchor)).toBe('ng-container');
    expect(tree.isAnchor?.(anchor)).toBe(true);
    expect(tree.isAnchor?.(all[1])).toBe(false);
    expect(tree.selector?.(anchor)).toBeNull();
    expect(tree.parent(anchor)).toBe(all[1]);
  });

  it('starts at the Angular roots and the elements outside them', () => {
    document.body.innerHTML =
      '<div class="shell"><app-root ng-version="22"><app-inner ng-version="22"></app-inner></app-root></div><div class="overlay"></div>';
    const roots = domTree().roots();
    expect(roots.map((el) => el.tagName.toLowerCase())).toEqual(['app-root', 'div']);
    expect(roots[1].className).toBe('overlay');
    expect(angularRoots()).toEqual(roots);
  });

  it('builds selectors that find the element again, none inside a shadow root', () => {
    document.body.innerHTML = '<main><p></p><p><b></b></p></main><x-host></x-host>';
    const host = document.querySelector('x-host')!;
    host.attachShadow({ mode: 'open' }).innerHTML = '<i></i>';
    const tree = domTree();
    const bold = document.querySelector('b')!;
    const selector = tree.selector!(bold)!;
    expect(selector).toBe(
      'body:nth-child(2) > main:nth-child(1) > p:nth-child(2) > b:nth-child(1)',
    );
    expect(document.querySelector(selector)).toBe(bold);
    expect(tree.selector!(host.shadowRoot!.querySelector('i')!)).toBeNull();
  });

  it('tells hosts from other values and tracks whether they are connected', () => {
    document.body.innerHTML = '<p><!--a--></p>';
    const p = document.querySelector('p')!;
    const comment = p.firstChild!;
    expect(domTree().isHost(p)).toBe(true);
    expect(domTree().isHost(comment)).toBe(false);
    expect(domTree(document, { anchors: true }).isHost(comment)).toBe(true);
    expect(domTree().isHost({})).toBe(false);
    const tree = domTree();
    expect(tree.connected(p)).toBe(true);
    p.remove();
    expect(tree.connected(p)).toBe(false);
  });
});
