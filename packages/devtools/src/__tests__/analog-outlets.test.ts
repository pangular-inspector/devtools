// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ANALOG_META_DESCRIPTION, chainOf, collectAnalog } from '../analog-runtime.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import {
  analogCurrentPageText,
  analogExplainUrlText,
  isAnalogReport,
  type AnalogState,
} from '../rpc/analog-tools.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const META = Symbol(ANALOG_META_DESCRIPTION);

function analogRoute(path: string, endpointKey: string) {
  return { path, component: class {}, [META]: { endpoint: `/pages/${path}`, endpointKey } };
}

type Node = Record<string, unknown>;

/** An ActivatedRouteSnapshot as Angular builds it: primary child first, then named outlets. */
function snapshot(
  routeConfig: unknown,
  children: Node[] = [],
  outlet = 'primary',
  data = {},
): Node {
  return { routeConfig, data, outlet, children, firstChild: children[0] ?? null };
}

function tree() {
  const message = snapshot(analogRoute('', '/src/app/pages/inbox/[id].server.ts'), [], 'primary', {
    load: { id: '7' },
  });
  const param = snapshot({ path: ':id' }, [message]);
  const preview = snapshot(analogRoute('preview', '/src/app/pages/preview.page.ts'), [], 'detail');
  const inbox = snapshot(analogRoute('inbox', '/src/app/pages/inbox.page.ts'), [param, preview]);
  const chat = snapshot(analogRoute('chat', '/src/app/pages/chat.page.ts'), [], 'sidebar');
  return snapshot(null, [inbox, chat]);
}

describe('Analog page chain with named outlets', () => {
  it('walks every outlet, keeps the primary chain first and labels outlet pages', () => {
    const { chain, data, loadFrom } = chainOf(tree());
    expect(chain).toEqual([
      { path: '/inbox', file: '/src/app/pages/inbox.page.ts' },
      {
        path: '/inbox/:id',
        file: '/src/app/pages/inbox/[id].page.ts',
        serverFile: '/src/app/pages/inbox/[id].server.ts',
      },
      // Named outlets follow in the order the walk meets them: outer outlets first.
      { path: '/chat', file: '/src/app/pages/chat.page.ts', outlet: 'sidebar' },
      { path: '/inbox/preview', file: '/src/app/pages/preview.page.ts', outlet: 'detail' },
    ]);
    expect(loadFrom).toBe(1);
    expect(data).toEqual({ id: '7' });
  });

  it('takes load() data from the primary chain only', () => {
    const chat = snapshot(analogRoute('chat', '/src/app/pages/chat.server.ts'), [], 'sidebar', {
      load: { from: 'sidebar' },
    });
    const home = snapshot(analogRoute('', '/src/app/pages/index.page.ts'));
    const { chain, data, loadFrom } = chainOf(snapshot(null, [home, chat]));
    expect(chain.map((c) => c.outlet)).toEqual([undefined, 'sidebar']);
    expect(data).toBeUndefined();
    expect(loadFrom).toBeUndefined();
  });

  it('stops on a cyclic tree', () => {
    const loop: Node = snapshot(analogRoute('a', '/src/app/pages/a.page.ts'));
    loop['children'] = [loop, { ...loop, outlet: 'side' }];
    expect(chainOf(loop).chain.length).toBeLessThanOrEqual(40);
  });

  it('reports a chain the server accepts', () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const router = {
      url: '/inbox/7(sidebar:chat)',
      config: [],
      routerState: { snapshot: { root: tree() } },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const report = collectAnalog(ng, 'p1', [])!;
    expect(report.chain.map((c) => c.outlet ?? 'primary')).toEqual([
      'primary',
      'primary',
      'sidebar',
      'detail',
    ]);
    expect(isAnalogReport(report)).toBe(true);
    expect(isAnalogReport({ ...report, chain: [{ path: '/x', outlet: 3 }] })).toBe(false);
  });
});

describe('Analog tools with named outlets', () => {
  const report: AnalogRuntimeReport = {
    pageId: 'p',
    url: '/about',
    analog: true,
    chain: [
      { path: '/about', file: '/src/app/pages/about.page.ts' },
      { path: '/pricing', file: '/src/app/pages/pricing.page.ts', outlet: 'sidebar' },
    ],
    hydrated: 0,
    transferState: false,
    hydrationErrors: [],
    configPaths: [],
  };
  const state: AnalogState = { pages: [report], calls: [], duplicates: [], reportedAt: 1 };
  const project = scanAnalog(makeProject(BASE_FILES));

  it('labels outlet pages in analog-inspect-page', () => {
    const text = analogCurrentPageText(project, state);
    const lines = text.split('\n');
    const about = lines.findIndex((l) => l.includes('about.page.ts'));
    const pricing = lines.findIndex((l) => l.includes('pricing.page.ts'));
    expect(about).toBeGreaterThan(-1);
    expect(pricing).toBeGreaterThan(about);
    expect(lines[pricing]).toContain('(outlet `sidebar`)');
    expect(lines[about]).not.toContain('outlet');
  });

  it('keeps outlet pages out of the primary chain in analog-explain-url', () => {
    const text = analogExplainUrlText(project, '/about', state);
    expect(text).toContain(
      'Live page: `/src/app/pages/about.page.ts`, plus `/src/app/pages/pricing.page.ts` in the `sidebar` outlet.',
    );
  });
});
