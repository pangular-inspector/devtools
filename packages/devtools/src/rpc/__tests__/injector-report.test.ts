import { describe, expect, it } from 'vitest';
import { MAX_INJECTOR_NODES } from '../../injector-tree.ts';
import { MAX_REPORTED_INJECTORS, sanitizeInjectorTree } from '../injector-report.ts';

const node = (name: string, extra: Record<string, unknown> = {}) => ({
  injector: { id: `inj-${name}`, type: 'element', name, providerCount: 0 },
  providers: [],
  children: [],
  ...extra,
});

describe('sanitizeInjectorTree', () => {
  it('keeps a well-formed tree as it is', () => {
    const roots = [
      {
        injector: {
          id: 'inj-1',
          type: 'element',
          name: 'app-root',
          providerCount: 1,
          component: 'App',
          directives: ['App'],
          selector: 'app-root',
          path: ['inj-1', 'inj-2'],
        },
        providers: [{ token: 'Store', type: 'class', isViewProvider: false, multi: true }],
        children: [node('app-card')],
        dependencies: [
          { from: 'App', token: 'Store', flags: ['optional'], providedBy: null },
          { from: 'App', token: 'Http', flags: [], providedBy: 'inj-2', providedByName: 'Root' },
        ],
      },
    ];
    const environment = [
      node('Root', {
        injector: { id: 'inj-2', type: 'environment', name: 'Root', providerCount: 0 },
      }),
    ];
    expect(sanitizeInjectorTree(roots, environment)).toEqual({
      roots,
      environment,
      truncated: false,
    });
  });

  it('drops malformed nodes, providers and dependencies, and unknown fields', () => {
    const { roots, environment } = sanitizeInjectorTree(
      [
        null,
        'app-root',
        { injector: { id: 1, type: 'element', name: 'x', providerCount: 0 }, children: [] },
        { injector: { id: 'a', type: 'weird', name: 'x', providerCount: 0 } },
        node('app-ok', {
          extra: 'ignored',
          providers: [{ token: 'A', type: 'class', isViewProvider: false }, { token: 3 }],
          dependencies: [{ from: 'A', token: 'B', flags: [], providedBy: 7 }],
          children: 'nope',
        }),
      ],
      'not a list',
    );
    expect(environment).toEqual([]);
    expect(roots).toEqual([
      {
        injector: { id: 'inj-app-ok', type: 'element', name: 'app-ok', providerCount: 0 },
        providers: [{ token: 'A', type: 'class', isViewProvider: false }],
        children: [],
        dependencies: [],
      },
    ]);
  });

  it('clips long strings', () => {
    const long = 'x'.repeat(10_000);
    const [root] = sanitizeInjectorTree(
      [node(long, { providers: [{ token: long, type: 'value', isViewProvider: false }] })],
      [],
    ).roots;
    expect(root.injector.name.length).toBe(500);
    expect(root.providers[0].token.length).toBe(500);
  });

  it('caps element injectors, then gives environment injectors what is left', () => {
    const many = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => node(`${prefix}${i}`));
    const tree = sanitizeInjectorTree(many(MAX_INJECTOR_NODES + 10, 'n'), [node('Root')]);
    expect(tree.roots).toHaveLength(MAX_INJECTOR_NODES);
    expect(tree.environment).toHaveLength(1);
    expect(tree.truncated).toBe(true);

    const crowded = sanitizeInjectorTree(many(10, 'n'), many(MAX_REPORTED_INJECTORS, 'e'));
    expect(crowded.roots).toHaveLength(10);
    expect(crowded.environment).toHaveLength(MAX_REPORTED_INJECTORS - 10);
    expect(crowded.truncated).toBe(true);

    const full = sanitizeInjectorTree(
      many(MAX_INJECTOR_NODES, 'n'),
      many(MAX_REPORTED_INJECTORS - MAX_INJECTOR_NODES, 'e'),
    );
    expect(full.truncated).toBe(false);
  });
});
