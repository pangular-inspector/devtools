import { describe, expect, it } from 'vitest';
import type { InjectorPage, InjectorTreeNode } from '../../types.ts';
import { MAX_ARG_CHARS, MAX_TOOL_CHARS, inspectProvidersText } from '../injector-tools.ts';

const providers = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => ({
    token: `${prefix}Service${i}`,
    type: 'class' as const,
    isViewProvider: false,
  }));

const element = (
  id: string,
  extra: Partial<InjectorTreeNode> = {},
  providerCount = 0,
): InjectorTreeNode => ({
  injector: {
    id,
    type: 'element',
    name: `app-${id}`,
    providerCount,
    component: `C${id}`,
    path: [id, 'root'],
  },
  providers: providers(providerCount, id),
  children: [],
  dependencies: [{ from: `C${id}`, token: 'Store', flags: [], providedBy: 'root' }],
  ...extra,
});

const environment = (): InjectorTreeNode[] => [
  {
    injector: { id: 'platform', type: 'environment', name: 'Platform', providerCount: 1 },
    providers: providers(1, 'Platform'),
    children: [
      {
        injector: { id: 'root', type: 'environment', name: 'Root', providerCount: 2 },
        providers: [
          ...providers(1, 'Root'),
          { token: 'Store', type: 'class', isViewProvider: false },
        ],
        children: [],
      },
    ],
  },
];

const page = (roots: InjectorTreeNode[]): InjectorPage => ({
  pageId: 'p1',
  reportedAt: 0,
  roots,
  environment: environment(),
});

/** The JSON after `label`, up to the next blank-line label or the end. */
function section(text: string, label: string, next?: string): unknown {
  const after = text.split(label)[1]!;
  return JSON.parse(next ? after.split(next)[0]! : after);
}

function countAll(nodes: { children: unknown[] }[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + countAll(node.children as { children: unknown[] }[]),
    0,
  );
}

describe('inspectProvidersText', () => {
  it('returns the whole tree unchanged when it fits', () => {
    const text = inspectProvidersText(page([element('a')]), {});
    const roots = section(text, 'Element injectors:', 'Environment injectors:');
    expect(roots).toEqual([element('a')]);
    expect(text).not.toMatch(/outline/);
  });

  it('outlines a large tree as valid JSON and keeps the environment injectors', () => {
    const roots = Array.from({ length: 100 }, (_, i) => element(`n${i}`, {}, 10));
    const text = inspectProvidersText(page(roots), {});
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).toMatch(/shown as an outline/);
    const outline = section(text, 'Element injectors:', 'Environment injectors:') as {
      providers: number;
    }[];
    expect(outline).toHaveLength(100);
    expect(outline[0]).toMatchObject({ id: 'n0', name: 'app-n0', providers: 10, dependencies: 1 });
    expect(section(text, 'Environment injectors:')).toEqual(environment());
  });

  it('drops whole subtrees from a tree too large to outline and says how many', () => {
    const wide = (prefix: string, depth: number): InjectorTreeNode =>
      element(prefix, {
        children: depth
          ? Array.from({ length: 6 }, (_, i) => wide(`${prefix}-${i}`, depth - 1))
          : [],
      });
    const roots = [wide('r', 4)];
    const total = countAll(roots);
    const text = inspectProvidersText(page(roots), {});
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    const outline = section(text, 'Element injectors:', 'Environment injectors:') as {
      id: string;
      children: { children: unknown[] }[];
      moreChildren?: number;
    }[];
    const kept = countAll(outline);
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(total);
    expect(text).toContain(`${total - kept} of ${total} element injectors are left out`);
    expect(text).toMatch(/pass `selector` or `token`/);
    expect(outline[0]!.id).toBe('r');
    expect(outline[0]!.children).toHaveLength(6);
    expect(section(text, 'Environment injectors:')).toEqual(environment());
  });

  it('outlines environment injectors too when they take more than half the budget', () => {
    const env = environment();
    env[0]!.providers = providers(400, 'Big');
    const text = inspectProvidersText({ ...page([element('a')]), environment: env }, {});
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(section(text, 'Environment injectors:')).toMatchObject([
      {
        id: 'platform',
        name: 'Platform',
        type: 'environment',
        providers: 400,
        children: [{ id: 'root' }],
      },
    ]);
    expect(text).toMatch(/Environment injectors are outlined too/);
  });

  it('leaves out the deepest environment injectors when even their outline is too long', () => {
    const env: InjectorTreeNode[] = [
      {
        injector: { id: 'platform', type: 'environment', name: 'Platform', providerCount: 0 },
        providers: providers(400, 'Big'),
        children: Array.from({ length: 2500 }, (_, i) => ({
          injector: {
            id: `route-${i}`,
            type: 'environment' as const,
            name: `Route: feature-${i}`,
            providerCount: 0,
          },
          providers: [],
          children: [],
        })),
      },
    ];
    const roots = Array.from({ length: 50 }, (_, i) => element(`n${i}`, {}, 10));
    const text = inspectProvidersText({ ...page(roots), environment: env }, {});
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    const outline = section(text, 'Environment injectors:') as {
      id: string;
      children: unknown[];
      moreChildren?: number;
    }[];
    expect(outline[0]!.id).toBe('platform');
    const kept = outline[0]!.children.length;
    expect(kept).toBeLessThan(2500);
    expect(outline[0]!.moreChildren).toBe(2500 - kept);
    expect(text).toContain(`${2500 - kept} of 2501 environment injectors are left out`);
    expect(() => section(text, 'Element injectors:', 'Environment injectors:')).not.toThrow();
  });

  it('asks for a shorter selector or token instead of echoing a very long one', () => {
    const long = 'x'.repeat(MAX_TOOL_CHARS);
    for (const args of [{ selector: long }, { token: long }, { selector: 'app-a', token: long }]) {
      const text = inspectProvidersText(page([element('a')]), args);
      expect(text.length).toBeLessThan(500);
      expect(text).toContain(`at most ${MAX_ARG_CHARS} characters`);
    }
    const text = inspectProvidersText(page([element('a')]), {
      selector: 'app-a',
      token: 'y'.repeat(MAX_ARG_CHARS),
    });
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
  });

  it('drops whole matches from a narrowed answer instead of cutting its JSON', () => {
    const roots = Array.from({ length: 200 }, (_, i) =>
      element(
        `n${i}`,
        { injector: { ...element('x').injector, id: `n${i}`, name: 'app-item' } },
        5,
      ),
    );
    const text = inspectProvidersText(page(roots), { selector: 'app-item', token: 'Store' });
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).toMatch(/Showing \d+ of 200/);
    const json = text.split('\n\n').filter((part) => /^[[{]/.test(part));
    expect(json.length).toBe(2);
    for (const part of json) expect(() => JSON.parse(part)).not.toThrow();
  });
});
