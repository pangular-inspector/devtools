// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { collectComponentTree } from '../component-tree.ts';
import { elementId } from '../element-id.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import type { InjectorTreeNode } from '../types.ts';

class App {}
class Card {}
class Tooltip {}

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

function fakeNg() {
  document.body.innerHTML = `<app-root><app-card></app-card><span tooltip></span></app-root>`;
  const root = document.querySelector('app-root')!;
  const card = document.querySelector('app-card')!;
  const tip = document.querySelector('span')!;
  const env = { kind: 'env', scopes: new Set(['root']) };
  const instances = new Map<Element, object>([
    [root, new App()],
    [card, new Card()],
  ]);
  const tooltip = new Tooltip();
  const ng = {
    getInjector: (el: Element) => ({ el }),
    getComponent: (el: Element) => instances.get(el) ?? null,
    getDirectives: (el: Element) =>
      el === tip ? [tooltip] : [...(instances.has(el) ? [instances.get(el)] : [])],
    ɵgetInjectorMetadata: (inj: { el?: Element }) =>
      inj.el ? { type: 'element', source: inj.el } : { type: 'environment', source: null },
    ɵgetInjectorResolutionPath: (inj: object) => [inj, env],
    ɵgetInjectorProviders: () => [],
    ɵgetDependenciesFromInjectable: () => ({ dependencies: [] }),
  };
  return { ng, root, card, tip };
}

describe('linking element injectors to the component tree', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('gives each component element injector the id the component tree uses', () => {
    const { ng, card, root } = fakeNg();
    const injectors = flatten(collectInjectorTree(ng as never).roots);
    const components = collectComponentTree(ng as never);
    const cardInjector = injectors.find((node) => node.injector.component === 'Card')!;
    const cardNode = components.roots[0]!.children.find((node) => node.name === 'Card')!;
    expect(cardInjector.injector.componentId).toBe(elementId(card));
    expect(cardInjector.injector.componentId).toBe(cardNode.id);
    expect(injectors.find((node) => node.injector.component === 'App')?.injector.componentId).toBe(
      elementId(root),
    );
  });

  it('keeps the id stable between collections', () => {
    const { ng } = fakeNg();
    const first = flatten(collectInjectorTree(ng as never).roots).map(
      (n) => n.injector.componentId,
    );
    const second = flatten(collectInjectorTree(ng as never).roots).map(
      (n) => n.injector.componentId,
    );
    expect(second).toEqual(first);
  });

  it('leaves the id off a directive-only element injector', () => {
    const { ng } = fakeNg();
    const tooltip = flatten(collectInjectorTree(ng as never).roots).find((n) =>
      n.injector.directives?.includes('Tooltip'),
    );
    expect(tooltip?.injector.component).toBeUndefined();
    expect(tooltip?.injector).not.toHaveProperty('componentId');
  });

  it('never writes to the page while reading the ids', () => {
    const { ng } = fakeNg();
    const before = document.body.innerHTML;
    collectInjectorTree(ng as never);
    expect(document.body.innerHTML).toBe(before);
  });
});
