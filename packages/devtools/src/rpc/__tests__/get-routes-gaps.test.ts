import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { getRoutes } from '../get-routes.ts';

async function routesFor(source: string) {
  const dir = fixtureDir('pangular-routes-gaps-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.routes.ts'), source);
  return scan(getRoutes, dir);
}

describe('get-routes extraction gaps', () => {
  it('nests a child array referenced by name under the route that uses it', async () => {
    const routes = await routesFor(`
      const adminChildren: Routes = [{ path: 'users', component: Users }];
      export const routes: Routes = [{ path: 'admin', component: Admin, children: adminChildren }];
    `);
    expect(routes.map((r) => r.fullPath).sort()).toEqual(['/admin', '/admin/users']);
  });

  it('keeps shorthand resolve entries', async () => {
    const routes = await routesFor(
      `[{ path: 'a', component: A, resolve: { user, org: orgResolver } }]`,
    );
    expect(routes[0].resolvers).toEqual(['user: user', 'org: orgResolver']);
  });

  it('reads routes whose keys are quoted', async () => {
    const routes = await routesFor(`[{ 'path': 'q', "component": Q }]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([['q', 'Q']]);
  });
});
