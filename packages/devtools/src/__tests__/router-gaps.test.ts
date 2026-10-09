import { describe, expect, it } from 'vitest';
import { walkConfig } from '../router-config.ts';
import { detectSetup } from '../router-setup.ts';
import { redirectCycles } from '../rpc/router-loops.ts';
import type { RouteNode } from '../router-config.ts';

describe('redirectCycles', () => {
  const node = (path: string, extra: Partial<RouteNode>): RouteNode => ({
    id: path,
    path,
    fullPath: `/${path}`,
    kind: 'redirect',
    ...extra,
  });

  it('ignores redirects in a named outlet', () => {
    const config = [
      node('a', { outlet: 'popup', redirectTo: 'b' }),
      node('b', { redirectTo: 'a' }),
    ];
    expect(redirectCycles(config)).toEqual([]);
  });

  it('still finds a cycle in the primary outlet', () => {
    const config = [node('a', { redirectTo: 'b' }), node('b', { redirectTo: 'a' })];
    expect(redirectCycles(config)).toEqual([['/a', '/b', '/a']]);
  });
});

describe('walkConfig depth limit', () => {
  it('counts the routes it leaves out below the depth limit', () => {
    let route: Record<string, unknown> = { path: 'leaf' };
    for (let i = 0; i < 14; i++) route = { path: `p${i}`, children: [route] };
    const cut = { routes: 0 };
    const nodes = walkConfig({ config: [route] }, cut);
    let shown = 0;
    const count = (list: RouteNode[]) =>
      list.forEach((n) => {
        shown++;
        count(n.children ?? []);
      });
    count(nodes);
    expect(cut.routes).toBeGreaterThan(0);
    expect(shown + cut.routes).toBe(15);
  });
});

describe('router strategies', () => {
  it('reports a missing strategy as unknown', () => {
    const ng = { getInjector: () => undefined };
    const setup = detectSetup(ng as never, {} as never, 1, null);
    expect(setup.strategies['locationStrategy']).toBe('unknown');
    expect(setup.strategies['titleStrategy']).toBe('unknown');
  });
});
