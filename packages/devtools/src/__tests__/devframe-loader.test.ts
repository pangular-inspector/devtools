import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevframeServer } from '../devframe-entry.ts';
import type { PackageLoaderHost } from '../package-loader.ts';

const work = mkdtempSync(join(tmpdir(), 'pangular-devframe-entry-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/**
 * An app with the package installed and its server bundle in `dist/server`,
 * as `ng build` leaves it. The installed `devframe-server.mjs` is a stand-in.
 */
function installedApp(name: string): string {
  const app = join(work, name);
  const pkg = join(app, 'node_modules/@pangular-inspector/devtools');
  mkdirSync(join(pkg, 'dist'), { recursive: true });
  mkdirSync(join(app, 'dist/server'), { recursive: true });
  writeFileSync(
    join(pkg, 'package.json'),
    JSON.stringify({
      name: '@pangular-inspector/devtools',
      type: 'module',
      exports: { './package.json': './package.json' },
    }),
  );
  writeFileSync(
    join(pkg, 'dist/devframe-server.mjs'),
    "export const createPangular = (options) => ({ from: 'installed', options });\nexport default { id: 'pangular' };\n",
  );
  return app;
}

describe('loadDevframeServer', () => {
  it('loads the installed devframe definition from inside an app server bundle', () => {
    const app = installedApp('bundled');
    const host: PackageLoaderHost = {
      createRequire,
      from: pathToFileURL(join(app, 'dist/server/chunk-ABC.mjs')).href,
    };
    const server = loadDevframeServer(host) as unknown as {
      createPangular: (options: unknown) => unknown;
      default: { id: string };
    };
    expect(server.createPangular({ inspectors: {} })).toEqual({
      from: 'installed',
      options: { inspectors: {} },
    });
    expect(server.default.id).toBe('pangular');
  });

  it('requires dist/devframe-server.mjs next to the resolved package.json', () => {
    const required: string[] = [];
    const requireStub = Object.assign(
      (id: string) => {
        required.push(id);
        return {};
      },
      { resolve: () => '/store/@pangular-inspector/devtools/package.json' },
    );
    loadDevframeServer({ createRequire: () => requireStub, from: 'file:///app/server.mjs' });
    expect(required).toEqual(['/store/@pangular-inspector/devtools/dist/devframe-server.mjs']);
  });

  it('names the Node.js versions it needs when require() cannot load ES modules', () => {
    const requireStub = Object.assign(
      () => {
        throw Object.assign(new Error('require() of ES Module'), { code: 'ERR_REQUIRE_ESM' });
      },
      { resolve: () => '/app/node_modules/@pangular-inspector/devtools/package.json' },
    );
    expect(() =>
      loadDevframeServer({ createRequire: () => requireStub, from: 'file:///app/server.mjs' }),
    ).toThrow(/The devframe entry needs Node\.js 20\.19, 22\.12 or later/);
  });

  it('refuses to run off Node', () => {
    expect(() => loadDevframeServer({ from: 'file:///app/server.mjs' })).toThrow(/Node\.js only/);
  });
});
