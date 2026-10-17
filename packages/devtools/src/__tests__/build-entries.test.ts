import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build, type UserConfig } from 'tsdown';
import {
  BROWSER_ENTRIES,
  NODE_ENTRIES,
  assertBrowserSafe,
  assertHubLoaderStandsAlone,
  nodeImportsFromEntries,
  type GraphChunk,
} from '../../build/entries.ts';
import { browserConfig, nodeConfig } from '../../tsdown.config.ts';

const packageDir = join(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  publishConfig: { exports: Record<string, string> };
};

const work = mkdtempSync(join(tmpdir(), 'pangular-build-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** Builds `config` into a fresh folder under `work`, without types. */
async function buildInto(config: UserConfig, name: string) {
  const outDir = join(work, name);
  const handle = await build({
    ...config,
    config: false,
    cwd: packageDir,
    outDir,
    dts: false,
    logLevel: 'silent',
  });
  return { outDir, chunks: handle.bundles.flatMap((bundle) => bundle.chunks) };
}

describe('entry point groups', () => {
  it('builds every published entry in exactly one group', () => {
    const built = [...Object.keys(BROWSER_ENTRIES), ...Object.keys(NODE_ENTRIES)];
    expect(new Set(built).size).toBe(built.length);
    const published = Object.values(manifest.publishConfig.exports)
      .filter((file) => file.startsWith('./dist/'))
      .map((file) => file.slice('./dist/'.length, -'.mjs'.length));
    for (const name of published) expect(built).toContain(name);
  });

  it('builds the documented browser entries for the browser', () => {
    expect(browserConfig.platform).toBe('browser');
    expect(nodeConfig.platform).toBe('node');
    for (const name of [
      'overlay',
      'overlay-manual',
      'overlay-angular-native',
      'overlay-nativescript',
      'popup',
      'http',
      'capacitor-hook',
      'store-hook',
      'startup-hook',
      'plugin',
      'config',
      'cd-data',
    ]) {
      expect(Object.keys(BROWSER_ENTRIES)).toContain(name);
    }
  });
});

describe('nodeImportsFromEntries', () => {
  const chunks: GraphChunk[] = [
    { fileName: 'overlay.mjs', name: 'overlay', isEntry: true, imports: ['shared-a.mjs'] },
    { fileName: 'popup.mjs', name: 'popup', isEntry: true, imports: ['devframe/client'] },
    {
      fileName: 'shared-a.mjs',
      imports: ['@angular/core'],
      dynamicImports: ['screenshot-b.mjs'],
    },
    { fileName: 'screenshot-b.mjs', imports: ['node:module'] },
  ];

  it('finds a builtin reached through shared and dynamic chunks', () => {
    expect(nodeImportsFromEntries(chunks, ['overlay', 'popup'])).toEqual([
      'overlay: overlay.mjs -> shared-a.mjs -> screenshot-b.mjs -> node:module',
    ]);
  });

  it('flags bare builtins and subpaths too', () => {
    const bare: GraphChunk[] = [
      { fileName: 'e.mjs', name: 'e', isEntry: true, imports: ['fs/promises', 'path', 'rxjs'] },
    ];
    expect(nodeImportsFromEntries(bare, ['e'])).toEqual([
      'e: e.mjs -> fs/promises',
      'e: e.mjs -> path',
    ]);
  });

  it('reports an entry that was not built', () => {
    expect(nodeImportsFromEntries(chunks, ['http'])).toEqual(['http: no entry chunk']);
  });

  it('throws from the build hook when a browser entry is unsafe', () => {
    expect(() => assertBrowserSafe(chunks, ['overlay'])).toThrow(/node:module/);
    expect(() => assertBrowserSafe(chunks, ['popup'])).not.toThrow();
  });

  it('lets the hub loader import its own chunks but no package or builtin', () => {
    const loader = { fileName: 'hub.mjs', name: 'hub', isEntry: true, imports: ['hub-off.mjs'] };
    expect(() =>
      assertHubLoaderStandsAlone([loader, { fileName: 'hub-off.mjs', imports: [] }]),
    ).not.toThrow();
    expect(() =>
      assertHubLoaderStandsAlone([
        loader,
        { fileName: 'hub-off.mjs', imports: ['@devframes/hub/initiate'] },
      ]),
    ).toThrow(/hub-off\.mjs -> @devframes\/hub\/initiate/);
    expect(() => assertHubLoaderStandsAlone([{ ...loader, imports: ['node:module'] }])).toThrow(
      /node:module/,
    );
  });
});

describe('the real build', () => {
  it('builds the browser entries with no Node builtin in their graph', async () => {
    const { chunks } = await buildInto(browserConfig, 'browser');
    expect(nodeImportsFromEntries(chunks, Object.keys(BROWSER_ENTRIES))).toEqual([]);
    // No chunk of the browser build is one the Node build writes.
    expect(chunks.some((chunk) => chunk.fileName.startsWith('devframe'))).toBe(false);
  }, 60_000);

  it('fails the browser build when an entry imports a Node builtin', async () => {
    const fixture = join(work, 'uses-node.ts');
    writeFileSync(
      fixture,
      "import { createRequire } from 'node:module';\nexport const load = () => createRequire('/');\n",
    );
    await expect(
      buildInto({ ...browserConfig, entry: { overlay: fixture } }, 'unsafe'),
    ).rejects.toThrow(/overlay: .*node:module/);
  }, 60_000);

  it('builds a hub loader that imports no package', async () => {
    const { outDir, chunks } = await buildInto(nodeConfig, 'node');
    expect(() => assertHubLoaderStandsAlone(chunks)).not.toThrow();
    const code = readFileSync(join(outDir, 'hub.mjs'), 'utf8');
    expect(code).not.toMatch(/^import[^\n]*from\s*["'](?!\.\/)/m);
    // No top-level `createRequire` binding to collide with Angular 20's banner.
    expect(code).not.toMatch(/^(?:import|const|let|var|function|class)\b[^\n]*\bcreateRequire\b/m);
  }, 60_000);
});
