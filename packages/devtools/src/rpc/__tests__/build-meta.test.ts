import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBuildMeta, installedVersion, versionFromRange } from '../build-meta.ts';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';

function install(dir: string, name: string, version: string) {
  const at = join(dir, 'node_modules', name);
  mkdirSync(at, { recursive: true });
  writeFileSync(join(at, 'package.json'), JSON.stringify({ name, version }));
}

describe('build-meta', () => {
  it('reports installed versions, not package.json ranges', async () => {
    const dir = fixtureDir('pangular-meta-');
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'shop',
        dependencies: { '@angular/core': '^21.0.0' },
        devDependencies: { typescript: '~5.9.0' },
      }),
    );
    install(dir, '@angular/core', '21.2.3');
    install(dir, 'typescript', '5.9.2');
    const meta = await scan(getBuildMeta, dir);
    expect(meta).toMatchObject({ angularVersion: '21.2.3', typescript: '5.9.2' });
    expect(installedVersion(dir, 'missing-package')).toBeUndefined();
  });

  it('reads SSR from an Nx project.json', async () => {
    const dir = fixtureDir('pangular-meta-');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'workspace' }));
    writeFileSync(
      join(dir, 'project.json'),
      JSON.stringify({
        name: 'store',
        projectType: 'application',
        targets: {
          build: {
            executor: '@angular/build:application',
            options: { server: 'src/main.server.ts', ssr: { entry: 'src/server.ts' } },
          },
        },
      }),
    );
    expect(await scan(getBuildMeta, dir)).toMatchObject({ projectName: 'store', ssr: true });
  });

  it('reads SSR from the app config when only the workspace root installs Analog', async () => {
    const ws = fixtureDir('pangular-meta-');
    writeFileSync(
      join(ws, 'package.json'),
      JSON.stringify({ name: 'workspace', devDependencies: { '@analogjs/platform': '2.7.5' } }),
    );
    writeFileSync(join(ws, 'nx.json'), '{}');
    const admin = join(ws, 'apps/admin');
    mkdirSync(admin, { recursive: true });
    writeFileSync(
      join(admin, 'project.json'),
      JSON.stringify({
        name: 'admin',
        projectType: 'application',
        targets: { build: { options: { browser: 'src/main.ts' } } },
      }),
    );
    const meta = await scan(getBuildMeta, admin);
    expect(meta).toMatchObject({ projectName: 'admin', ssr: false });
    expect(meta).not.toHaveProperty('analog');
  });

  it('names the served Analog app in an Nx workspace', async () => {
    const ws = fixtureDir('pangular-meta-');
    writeFileSync(
      join(ws, 'package.json'),
      JSON.stringify({ name: 'workspace', devDependencies: { '@analogjs/platform': '2.7.5' } }),
    );
    writeFileSync(join(ws, 'nx.json'), '{}');
    const shop = join(ws, 'apps/shop');
    mkdirSync(shop, { recursive: true });
    writeFileSync(join(shop, 'vite.config.ts'), 'export default { plugins: [analog()] };');
    writeFileSync(
      join(shop, 'project.json'),
      JSON.stringify({ name: 'shop', projectType: 'application', targets: {} }),
    );
    expect(await scan(getBuildMeta, ws)).toMatchObject({ projectName: 'shop', analog: '2.7.5' });
  });

  it('picks the application over a library listed first in angular.json', async () => {
    const dir = fixtureDir('pangular-meta-');
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({
        projects: {
          'ui-kit': { root: 'projects/ui-kit', projectType: 'library', architect: {} },
          shop: {
            root: 'projects/shop',
            projectType: 'application',
            architect: { build: { options: { ssr: { entry: 'server.ts' } } } },
          },
        },
      }),
    );
    expect(await scan(getBuildMeta, dir)).toMatchObject({ projectName: 'shop', ssr: true });
  });

  it('treats a legacy Universal server target as SSR', async () => {
    const dir = fixtureDir('pangular-meta-');
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({
        projects: {
          shop: {
            root: '',
            projectType: 'application',
            architect: {
              build: { options: { main: 'src/main.ts' } },
              server: { options: { main: 'server.ts' } },
            },
          },
        },
      }),
    );
    expect(await scan(getBuildMeta, dir)).toMatchObject({ projectName: 'shop', ssr: true });
  });

  it('prefers the project at the workspace root and reports no SSR without it', async () => {
    const dir = fixtureDir('pangular-meta-');
    writeFileSync(
      join(dir, 'angular.json'),
      JSON.stringify({
        projects: {
          admin: { root: 'projects/admin', projectType: 'application', architect: {} },
          shop: {
            root: '',
            projectType: 'application',
            architect: { build: { options: { browser: 'src/main.ts' } } },
          },
        },
      }),
    );
    expect(await scan(getBuildMeta, dir)).toMatchObject({ projectName: 'shop', ssr: false });
  });

  it('falls back to a cleaned range when nothing is installed', () => {
    expect(versionFromRange('^21.0.0')).toBe('21.0.0');
    expect(versionFromRange('>=5.4.0 <6')).toBe('5.4.0');
    expect(versionFromRange('~5.9.x')).toBe('5.9.x');
    expect(versionFromRange('npm:typescript@5.8.3')).toBe('5.8.3');
    expect(versionFromRange('workspace:*')).toBe('workspace:*');
    expect(versionFromRange('catalog:')).toBe('catalog:');
    expect(versionFromRange(undefined)).toBe('unknown');
  });
});
