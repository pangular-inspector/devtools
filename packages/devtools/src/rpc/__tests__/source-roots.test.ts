import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getComponents } from '../get-components.ts';
import { getNgrxStore } from '../get-ngrx-store.ts';
import { getProviders } from '../get-providers.ts';
import { getRoutes } from '../get-routes.ts';
import { getSignals } from '../get-signals.ts';

function component(dir: string, at: string, selector: string) {
  mkdirSync(join(dir, at), { recursive: true });
  writeFileSync(
    join(dir, at, 'widget.ts'),
    `@Component({ selector: '${selector}', template: '' })\nexport class Widget {}`,
  );
}

async function componentsIn(workspace: unknown, layout: Record<string, string>) {
  const dir = fixtureDir('pangular-roots-');
  if (workspace) writeFileSync(join(dir, 'angular.json'), JSON.stringify(workspace));
  for (const [at, selector] of Object.entries(layout)) component(dir, at, selector);
  return (await scan(getComponents, dir)).map((c) => c.selector).sort();
}

describe('source roots', () => {
  it('scans every project in the workspace', async () => {
    const selectors = await componentsIn(
      {
        projects: {
          shop: { sourceRoot: 'apps/shop/src' },
          admin: { sourceRoot: 'apps/admin/src' },
          ui: { root: 'libs/ui' },
        },
      },
      {
        'apps/shop/src': 'app-shop',
        'apps/admin/src': 'app-admin',
        'libs/ui/src': 'app-ui',
      },
    );
    expect(selectors).toEqual(['app-admin', 'app-shop', 'app-ui']);
  });

  it('falls back to src without a workspace file', async () => {
    expect(await componentsIn(null, { src: 'app-plain' })).toEqual(['app-plain']);
  });

  it('honours a declared source root that happens to be named like an output dir', async () => {
    const selectors = await componentsIn(
      { projects: { app: { sourceRoot: 'src/build' } } },
      { 'src/build': 'app-declared' },
    );
    expect(selectors).toEqual(['app-declared']);
  });

  it('refuses a declared source root inside dependencies', async () => {
    const selectors = await componentsIn(
      { projects: { app: { sourceRoot: 'node_modules/pkg/src' } } },
      { 'node_modules/pkg/src': 'app-dependency', src: 'app-real' },
    );
    expect(selectors).toEqual(['app-real']);
  });

  it('skips generated directories', async () => {
    const selectors = await componentsIn(null, {
      src: 'app-real',
      'src/node_modules/pkg': 'app-dependency',
      'src/dist': 'app-built',
    });
    expect(selectors).toEqual(['app-real']);
  });
});

// The wiring was added to all five scanners, so all five are checked.
describe('every scanner reads the workspace source roots', () => {
  const workspaceJson = { projects: { shop: { sourceRoot: 'apps/shop/src' } } };

  function multiProject(file: string, contents: string) {
    const dir = fixtureDir('pangular-roots-all-');
    writeFileSync(join(dir, 'angular.json'), JSON.stringify(workspaceJson));
    mkdirSync(join(dir, 'apps', 'shop', 'src'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'shop', 'src', file), contents);
    return dir;
  }

  it('finds components outside src', async () => {
    const dir = multiProject(
      'a.ts',
      "@Component({ selector: 'app-shop', template: '' }) class S {}",
    );
    const found = await scan(getComponents, dir);
    expect(found.map((c) => c.selector)).toEqual(['app-shop']);
  });

  it('finds signals outside src', async () => {
    const dir = multiProject('a.ts', 'class S { count = signal(0); }');
    const found = await scan(getSignals, dir);
    expect(found.map((s) => s.name)).toEqual(['count']);
  });

  it('finds providers outside src', async () => {
    const dir = multiProject('a.ts', "@Injectable({ providedIn: 'root' }) class Api {}");
    const found = await scan(getProviders, dir);
    expect(found.map((p) => p.token)).toContain('Api');
  });

  it('finds routes outside src', async () => {
    const dir = multiProject(
      'app.routes.ts',
      "export const routes = [{ path: 'home', component: Home }];",
    );
    const found = await scan(getRoutes, dir);
    expect(found.map((r) => r.path)).toEqual(['home']);
  });

  it('finds ngrx stores outside src', async () => {
    const dir = multiProject('store.ts', 'export const S = signalStore(withState({}));');
    const found = await scan(getNgrxStore, dir);
    expect(found.map((e) => e.name)).toContain('S');
  });
});
