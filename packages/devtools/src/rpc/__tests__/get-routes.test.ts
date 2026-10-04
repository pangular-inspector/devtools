import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getRoutes } from '../get-routes.ts';

async function routesFor(source: string) {
  const dir = fixtureDir('pangular-routes-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.routes.ts'), source);
  return scan(getRoutes, dir);
}

describe('get-routes', () => {
  it('reads an eager component', async () => {
    const routes = await routesFor(`[{ path: 'about', component: AboutComponent }]`);
    expect(routes).toEqual([
      {
        path: 'about',
        fullPath: '/about',
        kind: 'page',
        component: 'AboutComponent',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 1,
      },
    ]);
  });

  it('reads redirectTo on redirection routes', async () => {
    const routes = await routesFor(`[
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'home', redirectTo: '/dashboard' },
      { path: 'login', redirectTo: \`auth/login\` },
    ]`);
    expect(routes.map((r) => [r.path, r.redirectTo])).toEqual([
      ['', 'dashboard'],
      ['home', '/dashboard'],
      ['login', 'auth/login'],
    ]);
  });

  it('reads title on route definitions', async () => {
    const routes = await routesFor(`[
      { path: 'home', component: HomeComponent, title: 'Home Page' },
      { path: 'settings', component: SettingsComponent, title: "Settings | App" },
      { path: 'about', title: 'About {us}', component: AboutComponent },
    ]`);
    expect(routes.map((r) => [r.path, r.title])).toEqual([
      ['home', 'Home Page'],
      ['settings', 'Settings | App'],
      ['about', 'About {us}'],
    ]);
  });

  it('reads full route configuration with redirectTo and title', async () => {
    const routes = await routesFor(`[
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent, title: 'Home' },
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard',
        children: [{ path: 'stats', component: StatsComponent }],
      },
    ]`);
    expect(routes).toEqual([
      {
        path: '',
        fullPath: '/',
        kind: 'redirect',
        redirectTo: 'home',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 2,
      },
      {
        path: 'home',
        fullPath: '/home',
        kind: 'page',
        component: 'HomeComponent',
        title: 'Home',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 3,
      },
      {
        path: 'dashboard',
        fullPath: '/dashboard',
        kind: 'page',
        component: 'DashboardComponent',
        title: 'Dashboard',
        hasChildren: true,
        file: 'src/app.routes.ts',
        line: 4,
      },
      {
        path: 'stats',
        fullPath: '/dashboard/stats',
        kind: 'page',
        component: 'StatsComponent',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 8,
      },
    ]);
  });

  it('marks function or expression title / redirectTo as (dynamic)', async () => {
    const routes = await routesFor(`[
      { path: 'custom-title', component: HomeComponent, title: customTitleResolver },
      { path: 'custom-redirect', redirectTo: () => '/fallback' },
      { path: 'template-title', component: HomeComponent, title: \`Home \${id}\` },
    ]`);
    expect(routes.map((r) => [r.path, r.title, r.redirectTo])).toEqual([
      ['custom-title', '(dynamic)', undefined],
      ['custom-redirect', undefined, '(dynamic)'],
      ['template-title', '(dynamic)', undefined],
    ]);
  });

  it('handles string literal escapes, unescapes, and concatenated non-literals', async () => {
    const routes = await routesFor(`[
      { path: 'about', title: 'It\\'s "special"', redirectTo: "my/\\"path\\"" },
      { path: '\\u0068ome', title: 'Line1\\nLine2', redirectTo: \`Price \\\${amount}\` },
      { path: 'a' + 'b', component: Nope },
    ]`);
    expect(routes).toEqual([
      {
        path: 'about',
        fullPath: '/about',
        kind: 'redirect',
        title: 'It\'s "special"',
        redirectTo: 'my/"path"',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 2,
      },
      {
        path: 'home',
        fullPath: '/home',
        kind: 'redirect',
        title: 'Line1\nLine2',
        redirectTo: 'Price ${amount}',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 3,
      },
    ]);
  });

  it('reads redirectTo and title on nested child routes and wildcard routes', async () => {
    const routes = await routesFor(`[
      {
        path: 'admin',
        title: 'Admin Panel',
        children: [
          { path: '', redirectTo: 'overview', pathMatch: 'full' },
          { path: 'overview', component: AdminOverview, title: 'Overview' },
        ],
      },
      { path: '**', redirectTo: '' },
    ]`);
    expect(routes).toEqual([
      {
        path: 'admin',
        fullPath: '/admin',
        kind: 'group',
        title: 'Admin Panel',
        hasChildren: true,
        file: 'src/app.routes.ts',
        line: 2,
      },
      {
        path: '',
        fullPath: '/admin',
        kind: 'redirect',
        redirectTo: 'overview',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 6,
      },
      {
        path: 'overview',
        fullPath: '/admin/overview',
        kind: 'page',
        component: 'AdminOverview',
        title: 'Overview',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 7,
      },
      {
        path: '**',
        fullPath: '/**',
        kind: 'wildcard',
        redirectTo: '',
        hasChildren: false,
        file: 'src/app.routes.ts',
        line: 10,
      },
    ]);
  });

  it('reads the export name of a lazy component', async () => {
    const routes = await routesFor(`[
      { path: '', loadComponent: () => import('./home').then(m => m.Home) },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings').then((mod) => mod.Settings),
      },
    ]`);
    expect(routes.map((r) => r.component)).toEqual(['Home', 'Settings']);
  });

  it('reports no component for a lazy default export', async () => {
    const routes = await routesFor(`[{ path: '', loadComponent: () => import('./home') }]`);
    expect(routes[0].component).toBeUndefined();
  });

  it('does not take the component of the next route', async () => {
    const routes = await routesFor(`[
      { path: 'old', redirectTo: 'about', pathMatch: 'full' },
      { path: 'about', component: AboutComponent },
    ]`);
    expect(routes.map((r) => r.component)).toEqual([undefined, 'AboutComponent']);
  });

  it('reads the component whatever the property order', async () => {
    const routes = await routesFor(`[
      { component: HomeComponent, path: 'home' },
      { path: 'admin', children: [{ component: UsersComponent, path: 'users' }] },
    ]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([
      ['home', 'HomeComponent'],
      ['admin', undefined],
      ['users', 'UsersComponent'],
    ]);
  });

  it('only reads the lazy component from loadComponent', async () => {
    const routes = await routesFor(`[{
      path: 'lazy',
      loadComponent: () => import('./lazy'),
      resolve: { data: () => import('./data').then(m => m.Data) },
    }]`);
    expect(routes.map((r) => r.component)).toEqual([undefined]);
  });

  it('ignores braces and paths inside strings and comments', async () => {
    const routes = await routesFor(`[
      // { path: 'commented', component: Nope },
      { path: 'about', title: 'About {us}', component: AboutComponent },
    ]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([['about', 'AboutComponent']]);
  });

  it('reads routes that contain comments', async () => {
    const routes = await routesFor(`[
      {
        // landing page
        path: 'home',
        component: HomeComponent,
      },
      {
        path: 'shop',
        /* lazy (see [docs]) */ loadComponent: () => import('./shop').then(m => m.Shop),
      },
    ]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([
      ['home', 'HomeComponent'],
      ['shop', 'Shop'],
    ]);
  });

  it('does not treat nested route metadata as a route', async () => {
    const routes = await routesFor(`[
      { path: 'home', component: HomeComponent, data: { path: 'label', breadcrumb: 'Home' } },
    ]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([['home', 'HomeComponent']]);
  });

  it('does not treat objects in metadata arrays as routes', async () => {
    const routes = await routesFor(`[
      {
        path: 'home',
        component: HomeComponent,
        data: { breadcrumbs: [{ path: 'label', component: Nope }] },
      },
    ]`);
    expect(routes.map((r) => [r.path, r.component])).toEqual([['home', 'HomeComponent']]);
  });

  it('does not treat objects in a providers array as routes', async () => {
    const routes = await routesFor(`[
      {
        path: 'home',
        component: HomeComponent,
        providers: [{ provide: CONFIG, useValue: { path: 'nope' } }],
      },
    ]`);
    expect(routes.map((r) => r.path)).toEqual(['home']);
  });

  it('reads routes nested in metadata below a children array', async () => {
    const routes = await routesFor(`[
      {
        path: 'admin',
        children: [
          { path: 'users', component: Users, data: { tabs: [{ path: 'nope' }] } },
        ],
      },
    ]`);
    expect(routes.map((r) => r.path)).toEqual(['admin', 'users']);
  });

  it('reads routes passed straight to provideRouter', async () => {
    const routes = await routesFor(
      `bootstrapApplication(App, { providers: [provideRouter([{ path: 'home', component: HomeComponent }])] })`,
    );
    expect(routes.map((r) => [r.path, r.component])).toEqual([['home', 'HomeComponent']]);
  });

  it('reads routes passed straight to RouterModule.forRoot', async () => {
    const routes = await routesFor(
      `@NgModule({ imports: [RouterModule.forRoot([{ path: 'home', component: HomeComponent }])] })
      export class AppRoutingModule {}`,
    );
    expect(routes.map((r) => [r.path, r.component])).toEqual([['home', 'HomeComponent']]);
  });

  it('flags a lazily loaded child route configuration', async () => {
    const routes = await routesFor(`[
      { path: 'admin', loadChildren: () => import('./admin/routes').then((m) => m.adminRoutes) },
      { path: 'about', component: AboutComponent },
    ]`);
    expect(routes.map((r) => [r.path, r.hasChildren])).toEqual([
      ['admin', true],
      ['about', false],
    ]);
  });

  it('only flags children on the route that has them', async () => {
    const routes = await routesFor(`[
      { path: 'admin', component: Admin, children: [{ path: 'users', component: Users }] },
      { path: 'about', component: About },
    ]`);
    expect(routes.map((r) => [r.path, r.hasChildren])).toEqual([
      ['admin', true],
      ['users', false],
      ['about', false],
    ]);
  });

  it('carries the parent path into children and lazily loaded route files', async () => {
    const dir = fixtureDir('pangular-routes-');
    mkdirSync(join(dir, 'src', 'examples'), { recursive: true });
    mkdirSync(join(dir, 'src', 'admin'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'app.routes.ts'),
      `export const routes: Routes = [
        { path: '', component: Home },
        {
          path: 'examples',
          loadChildren: () => import('./examples/examples.routes').then((m) => m.examplesRoutes),
        },
        { path: 'admin', loadChildren: () => import('./admin/routes') },
        { path: '**', redirectTo: '' },
      ];`,
    );
    writeFileSync(
      join(dir, 'src', 'examples', 'examples.routes.ts'),
      `export const examplesRoutes: Routes = [
        { path: '', component: Overview },
        { path: 'signals', component: Signals, children: [{ path: 'detail', component: Detail }] },
      ];`,
    );
    writeFileSync(
      join(dir, 'src', 'admin', 'routes.ts'),
      `export default [{ path: 'users', component: Users }];`,
    );
    const routes = await scan(getRoutes, dir);
    expect(routes.map((r) => [r.fullPath, r.kind, r.file])).toEqual([
      ['/', 'page', 'src/app.routes.ts'],
      ['/examples', 'group', 'src/app.routes.ts'],
      ['/admin', 'group', 'src/app.routes.ts'],
      ['/**', 'wildcard', 'src/app.routes.ts'],
      ['/examples', 'page', 'src/examples/examples.routes.ts'],
      ['/examples/signals', 'page', 'src/examples/examples.routes.ts'],
      ['/examples/signals/detail', 'page', 'src/examples/examples.routes.ts'],
      ['/admin/users', 'page', 'src/admin/routes.ts'],
    ]);
  });

  it('prefixes a forChild routing module with the path that loads its NgModule', async () => {
    const dir = fixtureDir('pangular-routes-');
    mkdirSync(join(dir, 'src', 'app', 'admin'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'app', 'app-routing.module.ts'),
      `@NgModule({ imports: [RouterModule.forRoot([
        { path: 'admin', loadChildren: () => import('./admin/admin.module').then((m) => m.AdminModule) },
      ])] })
      export class AppRoutingModule {}`,
    );
    writeFileSync(
      join(dir, 'src', 'app', 'admin', 'admin.module.ts'),
      `@NgModule({ imports: [AdminRoutingModule] }) export class AdminModule {}`,
    );
    writeFileSync(
      join(dir, 'src', 'app', 'admin', 'admin-routing.module.ts'),
      `@NgModule({ imports: [RouterModule.forChild([{ path: 'users', component: Users }])] })
      export class AdminRoutingModule {}`,
    );
    const routes = await scan(getRoutes, dir);
    expect(routes.map((r) => r.fullPath)).toEqual(['/admin/users', '/admin']);
  });

  it('reads guards and resolvers by name', async () => {
    const routes = await routesFor(`[
      {
        path: 'trips',
        component: Trips,
        canMatch: [featureOn],
        canActivate: [signedInGuard, roleGuard('admin'), () => inject(Auth).ok()],
        resolve: { trip: tripResolver, user: () => inject(User).current() },
      },
    ]`);
    expect(routes[0].guards).toEqual({
      canMatch: ['featureOn'],
      canActivate: ['signedInGuard', 'roleGuard', 'inline'],
    });
    expect(routes[0].resolvers).toEqual(['trip: tripResolver', 'user: inline']);
  });

  it('tells navigable pages from redirects, wildcards and groups', async () => {
    const routes = await routesFor(`[
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: () => import('./home') },
      { path: 'settings', children: [{ path: 'profile', component: Profile }] },
      { path: '**', component: NotFound },
    ]`);
    expect(routes.map((r) => [r.fullPath, r.kind])).toEqual([
      ['/', 'redirect'],
      ['/home', 'page'],
      ['/settings', 'group'],
      ['/settings/profile', 'page'],
      ['/**', 'wildcard'],
    ]);
  });
});
