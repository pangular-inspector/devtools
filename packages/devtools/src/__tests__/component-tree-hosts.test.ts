// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { collectComponentTree, type ComponentDebugNg } from '../component-tree.ts';
import { MAX_DIRECTIVE_HOSTS, selectorAttribute } from '../directive-hosts.ts';
import {
  HYDRATION_INFO_KEY,
  hydrationRegions,
  readHydration,
  withDeferHydration,
} from '../hydration.ts';
import type { DeferBlockInfo } from '../types.ts';

class _App {}
class Card {}
class Row {}
/** Mirrors a compiled directive: `ɵdir.selectors` as Angular stores `a[routerLink]`. */
class RouterLink {
  static ɵdir = { selectors: [['a', 'routerLink', '']] };
}
class RouterLinkActive {
  static ɵdir = { selectors: [['', 'routerLinkActive', '']] };
}
/** `[ngModel]:not([formControlName])`: the `:not` part is not a name for it. */
class NgModel {
  static ɵdir = { selectors: [['', 'ngModel', '', 3, 'formControlName', '']] };
}
/** `.highlight`: a class selector has no attribute to show. */
class Highlight {
  static ɵdir = { selectors: [['', 8, 'highlight']] };
}
class MatTooltip {
  static ɵdir = { selectors: [['', 'matTooltip', '']] };
}

function fakeNg(components: Map<Element, object>, extra: Partial<ComponentDebugNg> = {}) {
  const directives = new Map<Element, object[]>();
  const ng: ComponentDebugNg = {
    getComponent: (el) => components.get(el) ?? null,
    getDirectives: (el) => {
      const own = directives.get(el) ?? [];
      const component = components.get(el);
      return component ? [component, ...own] : own;
    },
    ...extra,
  };
  return { ng, directives };
}

function mark(el: Element, info: unknown) {
  (el as unknown as Record<string, unknown>)[HYDRATION_INFO_KEY] = info;
}

describe('directive hosts in the component tree', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function page() {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0">
        <nav><a class="home">Home</a><a class="trips">Trips</a></nav>
        <section><app-card><input class="search"></app-card></section>
        <p class="plain">Text</p>
      </app-root>`;
    const root = document.querySelector('app-root')!;
    const card = document.querySelector('app-card')!;
    const { ng, directives } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [card, new Card()],
      ]),
    );
    directives.set(document.querySelector('a.home')!, [new RouterLink(), new RouterLinkActive()]);
    directives.set(document.querySelector('a.trips')!, [new RouterLink()]);
    directives.set(document.querySelector('input')!, [new NgModel()]);
    directives.set(card, [new MatTooltip()]);
    return { ng, directives };
  }

  it('lists an element with directives but no component as a directive node', () => {
    const { ng } = page();
    const tree = collectComponentTree(ng, { directiveHosts: true });
    expect(tree.count).toBe(2);
    expect(tree.directiveHostCount).toBe(3);
    const [root] = tree.roots;
    expect(root.children.map((node) => [node.kind ?? 'component', node.tag, node.name])).toEqual([
      ['directive', 'a', 'RouterLink'],
      ['directive', 'a', 'RouterLink'],
      ['component', 'app-card', 'Card'],
    ]);
    expect(root.children[0]).toMatchObject({
      directives: ['RouterLink', 'RouterLinkActive'],
      attributes: ['routerLink', 'routerLinkActive'],
    });
    // A component keeps its own directives and their attributes; its children nest under it.
    expect(root.children[2]).toMatchObject({
      directives: ['MatTooltip'],
      attributes: ['matTooltip'],
    });
    expect(root.children[2].children).toEqual([
      expect.objectContaining({ kind: 'directive', tag: 'input', attributes: ['ngModel'] }),
    ]);
  });

  it('keeps directive host ids stable between collections', () => {
    const { ng } = page();
    const first = collectComponentTree(ng, { directiveHosts: true });
    const second = collectComponentTree(ng, { directiveHosts: true });
    const ids = (tree: typeof first) => tree.roots[0].children.map((node) => node.id);
    expect(ids(second)).toEqual(ids(first));
    expect(new Set(ids(first)).size).toBe(3);
  });

  it('leaves directive hosts out unless asked, as the native overlays do', () => {
    const { ng } = page();
    const tree = collectComponentTree(ng);
    expect(tree.directiveHostCount).toBeUndefined();
    expect(tree.roots[0].children.map((node) => node.name)).toEqual(['Card']);
    expect(tree.roots[0].children[0].attributes).toBeUndefined();
  });

  it('stops listing directive hosts at the cap and says so, still listing components', () => {
    const links = Array.from({ length: MAX_DIRECTIVE_HOSTS + 5 }, () => '<a></a>').join('');
    document.body.innerHTML = `<app-root ng-version="22.0.0">${links}<app-card></app-card></app-root>`;
    const root = document.querySelector('app-root')!;
    const { ng, directives } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [document.querySelector('app-card')!, new Card()],
      ]),
    );
    for (const a of Array.from(document.querySelectorAll('a')))
      directives.set(a, [new RouterLink()]);
    const tree = collectComponentTree(ng, { directiveHosts: true });
    expect(tree.directiveHostCount).toBe(MAX_DIRECTIVE_HOSTS);
    expect(tree.truncated).toBe(true);
    expect(tree.truncatedBy).toEqual({ directiveHosts: MAX_DIRECTIVE_HOSTS });
    expect(tree.count).toBe(2);
    expect(tree.roots[0].children.at(-1)).toMatchObject({ name: 'Card' });
  });

  it('reads the first attribute of a selector and skips :not() and class parts', () => {
    expect(selectorAttribute(new RouterLink())).toBe('routerLink');
    expect(selectorAttribute(new NgModel())).toBe('ngModel');
    expect(selectorAttribute(new Highlight())).toBeNull();
    expect(selectorAttribute(new Row())).toBeNull();
  });
});

describe('hydration status in the component tree', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function page() {
    document.body.innerHTML = `
      <app-root ng-version="22.0.0" ng-server-context="ssr">
        <app-card></app-card><app-card></app-card><app-row></app-row>
      </app-root>`;
    const root = document.querySelector('app-root')!;
    const [first, second] = Array.from(document.querySelectorAll('app-card'));
    const row = document.querySelector('app-row')!;
    const { ng } = fakeNg(
      new Map<Element, object>([
        [root, new _App()],
        [first, new Card()],
        [second, new Card()],
        [row, new Row()],
      ]),
    );
    return { ng, root, first, second, row };
  }

  it('gives each component host the status Angular recorded, and created hosts `client`', () => {
    const { ng, root, first, second } = page();
    mark(root, { status: 'hydrated' });
    mark(first, { status: 'skipped' });
    mark(second, {
      status: 'mismatched',
      expectedNodeDetails: '<div class="price">…</div>',
      actualNodeDetails: '<span token="Bearer abc.def.ghi">',
    });
    const tree = collectComponentTree(ng, { hydration: true });
    expect(tree.roots[0].hydration).toBe('hydrated');
    expect(tree.roots[0].children.map((node) => node.hydration)).toEqual([
      'skipped',
      'mismatched',
      'client',
    ]);
    expect(tree.hydration).toMatchObject({
      hydrated: true,
      counts: { hydrated: 1, skipped: 1, mismatched: 1, client: 1, dehydratedBlocks: 0 },
    });
    const [mismatch] = tree.hydration!.mismatches;
    expect(mismatch).toMatchObject({
      name: 'Card',
      tag: 'app-card',
      id: tree.roots[0].children[1].id,
    });
    expect(mismatch.expected).toBe('<div class="price">…</div>');
    expect(mismatch.actual).not.toContain('abc.def.ghi');
  });

  it('says server HTML was not hydrated when no host has hydration info', () => {
    const { ng } = page();
    const tree = collectComponentTree(ng, { hydration: true });
    expect(tree.hydration).toMatchObject({ hydrated: false, counts: { client: 0 } });
    expect(tree.roots[0].hydration).toBeUndefined();
  });

  it('reports nothing for a page that did not come from the server', () => {
    const { ng, root } = page();
    root.removeAttribute('ng-server-context');
    const tree = collectComponentTree(ng, { hydration: true });
    expect(tree.hydration).toBeUndefined();
    expect(tree.roots[0].hydration).toBeUndefined();
  });

  it('reads nothing when not asked to', () => {
    const { ng, root } = page();
    mark(root, { status: 'hydrated' });
    expect(collectComponentTree(ng).hydration).toBeUndefined();
  });

  it('prefers an ng hydration util when the page publishes one', () => {
    const { ng, root } = page();
    mark(root, { status: 'hydrated' });
    const util = {
      ɵgetHydrationInfo: (node: unknown) => (node === root ? { status: 'skipped' } : null),
    };
    expect(readHydration(util, root)).toEqual({ status: 'skipped' });
    expect(readHydration(ng, root)).toEqual({ status: 'hydrated' });
    expect(readHydration(ng, document.body)).toBeNull();
    mark(root, { status: 'unknown' });
    expect(readHydration(ng, root)).toBeNull();
  });
});

describe('hydration regions and report', () => {
  const block = (id: string, hydration: DeferBlockInfo['hydration'], rootIds: string[]) =>
    ({
      id,
      state: 'placeholder',
      hydration,
      triggers: ['hydrate on viewport'],
      hasErrorBlock: false,
      rootIds,
      since: 0,
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
    }) satisfies DeferBlockInfo;

  it('outlines the top of each hydrated region, every skipped or mismatched host and dehydrated blocks', () => {
    const regions = hydrationRegions(
      [
        {
          id: 'c1',
          name: 'App',
          tag: 'app-root',
          hydration: 'hydrated',
          children: [
            { id: 'c2', name: 'Card', tag: 'app-card', hydration: 'hydrated', children: [] },
            {
              id: 'c3',
              name: 'Map',
              tag: 'app-map',
              hydration: 'skipped',
              children: [
                { id: 'c4', name: 'Pin', tag: 'app-pin', hydration: 'client', children: [] },
              ],
            },
            { id: 'c5', name: 'Price', tag: 'app-price', hydration: 'mismatched', children: [] },
          ],
        },
      ],
      [block('d1', 'dehydrated', ['c9', 'c10']), block('d2', 'hydrated', ['c11'])],
    );
    expect(regions).toEqual([
      { kind: 'hydrated', ids: ['c1'], label: 'App' },
      { kind: 'skipped', ids: ['c3'], label: 'Map' },
      { kind: 'mismatched', ids: ['c5'], label: 'Price' },
      { kind: 'dehydrated', ids: ['c9', 'c10'], label: '@defer in App' },
    ]);
  });

  it('adds the dehydrated block count and the overlay flag to a report', () => {
    const report = {
      hydrated: true,
      counts: { hydrated: 1, skipped: 0, mismatched: 0, client: 0, dehydratedBlocks: 0 },
      mismatches: [],
    };
    expect(withDeferHydration(undefined, [], true)).toBeUndefined();
    const out = withDeferHydration(
      report,
      [block('d1', 'dehydrated', []), block('d2', 'hydrated', [])],
      true,
    );
    expect(out).toMatchObject({ counts: { dehydratedBlocks: 1 }, overlay: true });
    expect(withDeferHydration(report, undefined, false)).not.toHaveProperty('overlay');
  });
});
