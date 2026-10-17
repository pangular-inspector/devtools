import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeHubBase } from '@devframes/hub/constants';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_HUB_BASE, loadHubServer, type HubLoaderHost } from '../hub-entry.ts';
import { PANGULAR_HUB_BASE as SERVER_HUB_BASE } from '../hub.ts';

const work = mkdtempSync(join(tmpdir(), 'pangular-hub-entry-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/**
 * An app with the package installed and its server bundle in `dist/server`,
 * as `ng build` leaves it. The installed `hub-server.mjs` is a stand-in.
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
    join(pkg, 'dist/hub-server.mjs'),
    "export const initPangularHub = (options) => ({ from: 'installed', options });\n",
  );
  return app;
}

describe('loadHubServer', () => {
  it('loads the installed hub from inside an app server bundle', () => {
    const app = installedApp('bundled');
    const host: HubLoaderHost = {
      createRequire,
      from: pathToFileURL(join(app, 'dist/server/chunk-ABC.mjs')).href,
    };
    const server = loadHubServer(host) as unknown as {
      initPangularHub: (options: unknown) => unknown;
    };
    expect(server.initPangularHub({ ws: false })).toEqual({
      from: 'installed',
      options: { ws: false },
    });
  });

  it('says to install the package when the app cannot resolve it', () => {
    const host: HubLoaderHost = {
      createRequire,
      from: pathToFileURL(join(work, 'elsewhere/server.mjs')).href,
    };
    expect(() => loadHubServer(host)).toThrow(/Install it as a dependency/);
  });

  it('names the Node.js versions it needs when require() cannot load ES modules', () => {
    const requireStub = Object.assign(
      () => {
        throw Object.assign(new Error('require() of ES Module'), { code: 'ERR_REQUIRE_ESM' });
      },
      { resolve: () => '/app/node_modules/@pangular-inspector/devtools/package.json' },
    );
    const host: HubLoaderHost = {
      createRequire: () => requireStub,
      from: 'file:///app/server.mjs',
    };
    expect(() => loadHubServer(host)).toThrow(/Node\.js 20\.19, 22\.12 or later/);
  });

  it('requires the file next to the resolved package.json', () => {
    const required: string[] = [];
    const requireStub = Object.assign(
      (id: string) => {
        required.push(id);
        return {};
      },
      { resolve: () => '/store/@pangular-inspector/devtools/package.json' },
    );
    loadHubServer({ createRequire: () => requireStub, from: 'file:///app/server.mjs' });
    expect(required).toEqual(['/store/@pangular-inspector/devtools/dist/hub-server.mjs']);
  });

  it('refuses to run off Node', () => {
    expect(() => loadHubServer({ from: 'file:///app/server.mjs' })).toThrow(/Node\.js only/);
  });

  it('names the Node.js versions it needs on a Node.js without getBuiltinModule', () => {
    const host: HubLoaderHost = { from: 'file:///app/server.mjs', nodeVersion: '22.1.0' };
    expect(() => loadHubServer(host)).toThrow(
      /needs Node\.js 20\.19, 22\.12 or later.*This is v22\.1\.0/,
    );
    expect(() => loadHubServer(host)).not.toThrow(/Node\.js only/);
    // The default host reads the running Node.js version.
    const original = process.getBuiltinModule;
    Object.defineProperty(process, 'getBuiltinModule', { value: undefined, configurable: true });
    try {
      expect(() => loadHubServer()).toThrow(/needs Node\.js 20\.19, 22\.12 or later/);
    } finally {
      Object.defineProperty(process, 'getBuiltinModule', { value: original, configurable: true });
    }
  });
});

describe('the hub entry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the base the hub uses', () => {
    expect(PANGULAR_HUB_BASE).toBe(SERVER_HUB_BASE);
  });

  it('returns the off hub without loading the server code', async () => {
    vi.resetModules();
    const load = vi.spyOn(process, 'getBuiltinModule').mockImplementation(() => {
      throw new Error('loaded the hub');
    });
    const entry = await import('../hub-entry.ts');
    for (const base of ['tools', '/tools', 'tools/', '//a//b//']) {
      const hub = entry.initPangularHub({ enabled: false, base });
      expect(hub.enabled).toBe(false);
      expect(hub.base).toBe(normalizeHubBase(base));
    }
    expect(entry.initPangularHub({ enabled: false }).base).toBe('/__devframes/');
    expect(load).not.toHaveBeenCalled();
    expect(() => entry.initPangularHub({ enabled: true })).toThrow('loaded the hub');
  });
});
