import { describe, expect, it } from 'vitest';
import type { RouteNode } from '../router-config.ts';
import { explainRenderModeText, lintRoutes } from '../rpc/router-config-tools.ts';
import type { RouterPage } from '../rpc/router-tools.ts';

function node(fullPath: string, extra: Partial<RouteNode> = {}): RouteNode {
  const path = extra.path ?? fullPath.split('/').pop() ?? '';
  return { id: fullPath, path, fullPath, kind: 'component', component: 'C', ...extra };
}

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return { pageId: 'p', snapshot: null, navigations: [], reportedAt: 1, changedAt: 1, ...extra };
}

describe('duplicate-path lint', () => {
  it('does not flag same-path siblings that have different children', () => {
    const config = [
      node('/', { path: '', children: [node('/a', { path: 'a' })] }),
      node('/', { path: '', children: [node('/b', { path: 'b' })] }),
    ];
    expect(lintRoutes(page({ config })).map((f) => f.rule)).not.toContain('duplicate-path');
  });

  it('keeps comparing against an earlier leaf when a middle sibling has children', () => {
    const config = [
      node('/home'),
      node('/home', { children: [node('/home/x', { path: 'x' })] }),
      node('/home'),
    ];
    expect(lintRoutes(page({ config })).filter((f) => f.rule === 'duplicate-path')).toHaveLength(1);
  });

  it('still flags identical leaf routes', () => {
    const config = [node('/home'), node('/home')];
    expect(lintRoutes(page({ config })).filter((f) => f.rule === 'duplicate-path')).toHaveLength(1);
  });
});

describe('explain-render-mode', () => {
  const entries = [{ path: 'admin/dashboard', renderMode: 'Server', file: 'x' }];

  it('does not claim a build failure for entries under an unloaded lazy route', () => {
    const config = [
      node('/admin', { kind: 'lazy', lazy: 'unloaded', component: undefined, path: 'admin' }),
    ];
    const text = explainRenderModeText({ pages: [page({ config })] }, entries, {});
    expect(text).not.toContain('no matching client route');
  });

  it('still reports an entry under a route that only loads a component lazily', () => {
    const config = [
      node('/admin', { kind: 'component', lazy: 'unloaded', component: undefined, path: 'admin' }),
    ];
    const text = explainRenderModeText({ pages: [page({ config })] }, entries, {});
    expect(text).toContain('no matching client route');
  });

  it('does not claim a build failure when the config was truncated', () => {
    const text = explainRenderModeText(
      { pages: [page({ config: [node('/other')], configTruncated: 3 })] },
      entries,
      {},
    );
    expect(text).not.toContain('no matching client route');
  });

  it('still reports an entry with no client route', () => {
    const text = explainRenderModeText(
      { pages: [page({ config: [node('/other')] })] },
      entries,
      {},
    );
    expect(text).toContain('no matching client route');
  });
});
