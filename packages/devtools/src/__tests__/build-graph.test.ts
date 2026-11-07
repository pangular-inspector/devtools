import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';
import {
  buildRegistry,
  findBuildOutput,
  initialFiles,
  readBuildGraph,
  readBuildOutput,
  readViteGraph,
  viteGraphSource,
  type ViteModuleLike,
} from '../build-graph.ts';
import { chunkSizesText, formatBytes, moduleGraphText } from '../rpc/build-register.ts';
import { answerText } from './tool-answer.ts';

/** A Vite-like module graph: `links` are `[from, to, dynamic?]`. */
function graph(
  root: string,
  sizes: Record<string, number>,
  links: [string, string, boolean?][],
): ViteModuleLike[] {
  const mods = new Map<string, ViteModuleLike>();
  for (const [url, size] of Object.entries(sizes)) {
    mods.set(url, {
      url,
      file: join(root, url),
      type: url.endsWith('.css') ? 'css' : 'js',
      importers: new Set(),
      importedModules: new Set(),
      transformResult: size ? { code: 'x'.repeat(size) } : null,
      staticImportedUrls: new Set(),
    });
  }
  for (const [from, to, dynamic] of links) {
    const a = mods.get(from)!;
    const b = mods.get(to)!;
    a.importedModules.add(b);
    b.importers.add(a);
    if (!dynamic) a.staticImportedUrls!.add(to);
  }
  return [...mods.values()];
}

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pangular-build-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

afterEach(() => {
  delete (globalThis as { __PANGULAR_BUILD__?: unknown }).__PANGULAR_BUILD__;
});

describe('readViteGraph', () => {
  const root = '/app';
  const modules = graph(
    root,
    {
      '/src/main.ts': 100,
      '/src/app.routes.ts': 50,
      '/src/shared.ts': 30,
      '/src/trips.page.ts': 400,
      '/src/trip-map.ts': 600,
      '/src/admin.page.ts': 80,
    },
    [
      ['/src/main.ts', '/src/app.routes.ts'],
      ['/src/app.routes.ts', '/src/shared.ts'],
      ['/src/app.routes.ts', '/src/trips.page.ts', true],
      ['/src/app.routes.ts', '/src/admin.page.ts', true],
      ['/src/trips.page.ts', '/src/trip-map.ts'],
      ['/src/trips.page.ts', '/src/shared.ts'],
    ],
  );

  it('splits what loads up front from each lazy boundary', () => {
    const result = readViteGraph({ root, modules: () => modules });
    expect(result.entries).toEqual(['/src/main.ts']);
    expect(result.initialSize).toBe(180);
    expect(result.totalSize).toBe(1260);
    expect(result.lazy.map((b) => [b.file, b.modules, b.size, b.importers])).toEqual([
      // shared.ts already loads up front, so it doesn't count for the trips page.
      ['src/trips.page.ts', 2, 1000, ['src/app.routes.ts']],
      ['src/admin.page.ts', 1, 80, ['src/app.routes.ts']],
    ]);
    const routes = result.modules.find((m) => m.url === '/src/app.routes.ts')!;
    expect(routes.dynamicImports.sort()).toEqual(['/src/admin.page.ts', '/src/trips.page.ts']);
    expect(result.modules[0]!.url).toBe('/src/trip-map.ts');
  });

  it('reads the client environment of a Vite 6+ server, and moduleGraph before it', () => {
    const map = new Map(modules.map((m) => [m.url, m]));
    const v6 = viteGraphSource({
      config: { root },
      environments: { client: { moduleGraph: { idToModuleMap: map } } },
    })!;
    expect([...v6.modules()]).toHaveLength(6);
    expect(viteGraphSource({ moduleGraph: { idToModuleMap: map } })).toBeDefined();
    expect(viteGraphSource({})).toBeUndefined();
  });

  it('answers module-graph with lazy boundaries and a search', () => {
    buildRegistry().vite = { root, modules: () => modules };
    const read = readBuildGraph('/nowhere');
    const text = moduleGraphText(read);
    expect(text).toContain('| `src/trips.page.ts` | `src/app.routes.ts` | 2 | 1.0 kB |');
    const found = moduleGraphText(read, { search: 'routes' });
    expect(found).toContain('Modules matching `routes`: 1.');
    expect(found).toContain('`/src/admin.page.ts`');
    delete buildRegistry().vite;
    expect(moduleGraphText(readBuildGraph('/nowhere'))).toMatch(/No Vite dev server/);
  });
});

describe('build output', () => {
  const html =
    '<html><head><link rel="stylesheet" href="styles-ABC.css"><link rel="modulepreload" href="chunk-SHARED.js"><link rel="icon" href="favicon.ico"></head><body><script src="main-XYZ.js" type="module"></script><script src="https://cdn.example.com/x.js"></script></body></html>';

  it('takes scripts, module preloads and stylesheets as initial', () => {
    expect([...initialFiles(html)].sort()).toEqual([
      'chunk-SHARED.js',
      'main-XYZ.js',
      'styles-ABC.css',
    ]);
  });

  it('lists chunks with sizes and links them to their source with stats.json', () => {
    const root = project({
      'angular.json': JSON.stringify({
        projects: {
          app: {
            projectType: 'application',
            architect: { build: { options: { outputPath: 'dist/app' } } },
          },
        },
      }),
      'dist/app/browser/index.html': html,
      'dist/app/browser/main-XYZ.js': 'console.log("main");'.repeat(50),
      'dist/app/browser/chunk-SHARED.js': 'export const a = 1;',
      'dist/app/browser/chunk-LAZY.js': 'export const trips = [];'.repeat(20),
      'dist/app/browser/styles-ABC.css': 'body{margin:0}',
      'dist/app/stats.json': JSON.stringify({
        outputs: {
          'chunk-LAZY.js': {
            entryPoint: 'src/app/trips/trips.page.ts',
            inputs: { 'src/app/trips/trips.page.ts': { bytesInOutput: 300 } },
          },
        },
      }),
    });
    const dir = findBuildOutput(root)!;
    expect(dir).toBe(join(root, 'dist/app/browser'));
    const output = readBuildOutput(root, dir);
    expect(output.dir).toBe('dist/app/browser');
    expect(output.stats).toBe(true);
    expect(output.chunks.map((c) => [c.file, c.initial])).toEqual([
      ['main-XYZ.js', true],
      ['chunk-SHARED.js', true],
      ['styles-ABC.css', true],
      ['chunk-LAZY.js', false],
    ]);
    const lazy = output.chunks.find((c) => c.file === 'chunk-LAZY.js')!;
    expect(lazy.entryPoint).toBe('src/app/trips/trips.page.ts');
    expect(lazy.gzip).toBeLessThan(lazy.bytes);
    expect(output.lazyBytes).toBe(lazy.bytes);
    const text = chunkSizesText(readBuildGraph(root));
    expect(text).toContain('| `chunk-LAZY.js` | lazy |');
    expect(text).toContain('`src/app/trips/trips.page.ts`');
  });

  it('says how to build when there is no output', () => {
    const root = project({ 'package.json': '{}' });
    const read = readBuildGraph(root);
    expect(read.output).toBeUndefined();
    expect(chunkSizesText(read)).toMatch(/No production build found/);
  });

  it('formats bytes', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1234)).toBe('1.2 kB');
    expect(formatBytes(2_500_000)).toBe('2.50 MB');
  });
});

describe('build on the devframe server', () => {
  async function boot(options = {}) {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const root = project({ 'package.json': '{}' });
    const ctx = await createHostContext({ cwd: root, mode: 'dev', host: host as never });
    await createPangular(options).setup(ctx as never);
    return ctx;
  }

  it('serves get-build-graph and the two tools, and masks secrets in URLs', async () => {
    const modules = graph('/app', { '/src/main.ts?token=supersecretvalue123': 10 }, []);
    buildRegistry().vite = { root: '/app', modules: () => modules };
    const ctx = await boot();
    const read = (await (ctx.rpc.invokeLocal as (name: string) => Promise<unknown>)(
      'pangular:get-build-graph',
    )) as { vite: { modules: { url: string }[] }; outputNote: string };
    expect(read.vite.modules[0]!.url).not.toContain('supersecretvalue123');
    expect(read.outputNote).toMatch(/No production build found/);
    expect(await answerText(ctx.agent.invoke('pangular:chunk-sizes', {}))).toMatch(
      /No production build found/,
    );
    const ids = ctx.agent.list().tools.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['pangular:module-graph', 'pangular:chunk-sizes']));
  });

  it('drops the tools with the build inspector off', async () => {
    const ctx = await boot({ inspectors: { build: false } });
    const ids = ctx.agent.list().tools.map((t) => t.id);
    expect(ids).not.toContain('pangular:module-graph');
    expect(ids).not.toContain('pangular:chunk-sizes');
  });
});
