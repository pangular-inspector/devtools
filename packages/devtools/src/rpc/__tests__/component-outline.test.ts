import { describe, expect, it } from 'vitest';
import type { ComponentPage, LiveComponentNode } from '../../types.ts';
import { componentOutlineText, listComponentsText, routedHosts } from '../component-outline.ts';

const node = (
  id: string,
  name: string,
  tag: string,
  children: LiveComponentNode[] = [],
  directives?: string[],
): LiveComponentNode => ({ id, name, tag, children, ...(directives ? { directives } : {}) });

const tree = () => [
  node('c1', 'App', 'app-root', [
    node('c2', 'Header', 'app-header', [node('c3', 'Nav', 'app-nav', [], ['RouterLinkActive'])]),
    node('c4', 'ProductList', 'app-products', [
      node('c5', 'ProductCard', 'app-card'),
      node('c6', 'ProductCard', 'app-card'),
    ]),
    node('c7', 'Footer', 'app-footer'),
  ]),
];

const page = (extra: Partial<ComponentPage> = {}): ComponentPage => ({
  pageId: 'p1',
  url: 'http://localhost/products',
  roots: tree(),
  count: 7,
  detail: null,
  reportedAt: 1,
  ...extra,
});

const outline = (text: string) => text.split('```text\n')[1]!.split('\n```')[0]!.split('\n');

describe('component outline', () => {
  it('lists every instance indented, with directives and routed markers', () => {
    const routed = routedHosts([
      {
        outlet: 'primary',
        activated: true,
        route: '/products',
        devtoolsId: 'c4',
        children: [{ outlet: 'side', activated: true, route: '/products/help', devtoolsId: 'c7' }],
      },
      { outlet: 'aux', activated: false },
      'not an outlet',
    ]);
    const text = componentOutlineText(page(), routed);
    expect(outline(text)).toEqual([
      'App <app-root> c1',
      '  Header <app-header> c2',
      '    Nav <app-nav> c3 [directives: RouterLinkActive]',
      '  ProductList <app-products> c4 [routed route /products]',
      '    ProductCard <app-card> c5',
      '    ProductCard <app-card> c6',
      '  Footer <app-footer> c7 [routed route /products/help, outlet side]',
    ]);
    expect(text).toContain('7 component instance(s)');
  });

  it('keeps the ancestors of filter matches, case-insensitively, on name, tag or directive', () => {
    expect(outline(componentOutlineText(page(), new Map(), { filter: 'card' }))).toEqual([
      'App <app-root> c1',
      '  ProductList <app-products> c4',
      '    ProductCard <app-card> c5',
      '    ProductCard <app-card> c6',
    ]);
    expect(outline(componentOutlineText(page(), new Map(), { filter: 'routerlink' }))).toEqual([
      'App <app-root> c1',
      '  Header <app-header> c2',
      '    Nav <app-nav> c3 [directives: RouterLinkActive]',
    ]);
    expect(componentOutlineText(page(), new Map(), { filter: 'APP-FOOTER' })).toContain(
      'Footer <app-footer> c7',
    );
    expect(componentOutlineText(page(), new Map(), { filter: 'nothing' })).toMatch(
      /none of them matches `nothing`/,
    );
  });

  it('stops at the requested depth and counts what it hides', () => {
    const text = componentOutlineText(page(), new Map(), { depth: 2 });
    expect(outline(text)).toEqual([
      'App <app-root> c1',
      '  Header <app-header> c2 (+1 below)',
      '  ProductList <app-products> c4 (+2 below)',
      '  Footer <app-footer> c7',
    ]);
    expect(text).toContain('3 instance(s) below depth 2 are not listed');
    expect(outline(componentOutlineText(page(), new Map(), { depth: 1 }))).toEqual([
      'App <app-root> c1 (+6 below)',
    ]);
    expect(outline(componentOutlineText(page(), new Map(), { depth: 0 }))).toHaveLength(7);
  });

  it('caps the outline and says how to narrow it', () => {
    const many = Array.from({ length: 2_000 }, (_, i) => node(`c${i}`, `Item${i}`, 'app-item'));
    const text = componentOutlineText(page({ roots: many }), new Map());
    expect(text.length).toBeLessThan(21_000);
    expect(text).toMatch(/stops at 20,000 characters after \d+ of 2000 instances/);
    expect(text).toContain('Pass `filter` or `depth` to narrow it.');
  });

  it('notes when the collector truncated the tree', () => {
    const text = componentOutlineText(
      page({ truncated: true, truncatedBy: { components: 2000 } }),
      new Map(),
    );
    expect(text).toContain('stops at the first 2000 component instances');
  });

  it('redacts page text and keeps it out of the fence syntax', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const text = componentOutlineText(
      page({ roots: [node('c1', 'Weird```Name', `app-x`, [], [jwt])] }),
      new Map(),
    );
    expect(text).not.toContain(jwt);
    expect(outline(text)[0]).toMatch(/^Weird'''Name <app-x> c1/);
  });
});

describe('list-components answer', () => {
  it('names the reporting pages for an unknown page', () => {
    const text = listComponentsText([page()], () => undefined, { page: 'nope' });
    expect(text).toMatch(/No page `nope` is reporting a component tree/);
    expect(text).toContain('`p1`');
  });

  it('says so when nothing reports', () => {
    expect(listComponentsText([], () => undefined)).toMatch(/No component tree has been reported/);
  });

  it('uses the most recent page, marks it untrusted and names the others', () => {
    const older = page({ pageId: 'old', reportedAt: 1, roots: [node('c1', 'Old', 'app-old')] });
    const newer = page({ pageId: 'new', reportedAt: 2 });
    const text = listComponentsText([older, newer], (id) =>
      id === 'new' ? [{ outlet: 'primary', activated: true, devtoolsId: 'c4' }] : undefined,
    );
    expect(text).toMatch(/^_Live component tree from the running page \(untrusted data\)/);
    expect(text).toContain('Page `new`');
    expect(text).toContain('ProductList <app-products> c4 [routed]');
    expect(text).toContain('Other pages report a component tree too: `old`');
    expect(listComponentsText([older, newer], () => undefined, { page: 'old' })).toContain(
      'Old <app-old> c1',
    );
  });
});
