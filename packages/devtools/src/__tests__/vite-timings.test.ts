import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRegistry, readViteGraph } from '../build-graph.ts';
import pangularVite from '../vite.ts';
import {
  ModuleTimings,
  timePluginContainer,
  timeViteModules,
  type PluginContainerLike,
} from '../vite-timings.ts';

/** A plugin container whose hooks take `ms` of fake time each. */
function container(clock: { now: number }, ms = 5): PluginContainerLike {
  const tick = async <T>(value: T) => {
    clock.now += ms;
    return value;
  };
  return {
    resolveId: (raw) => tick(raw === 'missing' ? null : { id: `/root${raw}` }),
    load: (id) => tick(`// ${id}`),
    transform: (code) => tick({ code }),
  };
}

function fakeClock() {
  const clock = { now: 0 };
  const original = performance.now;
  performance.now = () => clock.now;
  return { clock, restore: () => (performance.now = original) };
}

const servers: ViteDevServer[] = [];
let restoreClock: (() => void) | undefined;

afterEach(async () => {
  restoreClock?.();
  restoreClock = undefined;
  for (const server of servers.splice(0)) await server.close();
  delete (globalThis as { __PANGULAR_BUILD__?: unknown }).__PANGULAR_BUILD__;
});

describe('ModuleTimings', () => {
  it('adds up resolves and keeps the last load and transform', () => {
    const timings = new ModuleTimings();
    timings.add('/a.ts', 'resolve', 1);
    timings.add('/a.ts', 'resolve', 2);
    timings.add('/a.ts', 'load', 4);
    timings.add('/a.ts', 'transform', 8);
    timings.add('/a.ts', 'transform', 3);
    expect(timings.get('/a.ts')).toEqual({ resolve: 3, load: 4, transform: 3 });
  });

  it('drops the oldest module past the cap and says so', () => {
    const timings = new ModuleTimings(2);
    timings.add('/a.ts', 'load', 1);
    timings.add('/b.ts', 'load', 1);
    expect(timings.capped).toBe(false);
    timings.add('/c.ts', 'load', 1);
    expect(timings.size).toBe(2);
    expect(timings.get('/a.ts')).toBeUndefined();
    expect(timings.get('/c.ts')).toBeDefined();
    expect(timings.capped).toBe(true);
  });
});

describe('timePluginContainer', () => {
  it('times resolve, load and transform under the resolved id', async () => {
    const { clock, restore } = fakeClock();
    restoreClock = restore;
    const timings = new ModuleTimings();
    const target = container(clock);
    timePluginContainer(target, timings);
    expect(await target.resolveId('/main.ts', undefined)).toEqual({ id: '/root/main.ts' });
    await target.resolveId('/main.ts', '/root/index.html');
    expect(await target.resolveId('missing')).toBeNull();
    await target.load('/root/main.ts');
    await target.transform('code', '/root/main.ts');
    expect(timings.get('/root/main.ts')).toEqual({ resolve: 10, load: 5, transform: 5 });
    expect(timings.size).toBe(1);
  });

  it('wraps a container once, skips SSR calls on a shared one, and undoes its wrap', async () => {
    const { clock, restore } = fakeClock();
    restoreClock = restore;
    const timings = new ModuleTimings();
    const target = container(clock);
    const original = target.transform;
    const stop = timePluginContainer(target, timings, true);
    const wrapped = target.transform;
    timePluginContainer(target, timings, true);
    expect(target.transform).toBe(wrapped);
    await target.transform('code', '/root/server.ts', { ssr: true });
    await target.load('/root/server.ts', { ssr: true });
    expect(timings.get('/root/server.ts')).toBeUndefined();
    await target.transform('code', '/root/main.ts');
    expect(timings.get('/root/main.ts')?.transform).toBe(5);
    stop();
    expect(target.transform).toBe(original);
  });

  it('passes errors through without a timing', async () => {
    const timings = new ModuleTimings();
    const target: PluginContainerLike = {
      resolveId: async () => null,
      load: async () => null,
      transform: async () => {
        throw new Error('Unexpected token');
      },
    };
    timePluginContainer(target, timings);
    await expect(target.transform('x', '/root/bad.ts')).rejects.toThrow('Unexpected token');
    expect(timings.get('/root/bad.ts')).toBeUndefined();
  });
});

describe('timeViteModules', () => {
  it('needs a plugin container, and tolerates one Vite has not set up yet', () => {
    expect(timeViteModules({})).toBeUndefined();
    const early = {
      environments: {
        get client(): never {
          throw new Error('client environment.pluginContainer called before initialized');
        },
      },
    };
    expect(timeViteModules(early as never)).toBeUndefined();
  });

  it('times the modules a real Vite dev server serves, for the module graph', async () => {
    // The real path: on Windows tmpdir() can be an 8.3 short name (RUNNER~1) that Vite resolves differently.
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'pangular-timings-')));
    writeFileSync(join(root, 'main.ts'), "import { hello } from './hello.ts';\nhello();\n");
    writeFileSync(join(root, 'hello.ts'), 'export const hello = (): string => "hi";\n');
    const server = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      plugins: [pangularVite()],
      server: { host: '127.0.0.1', port: 0 },
    });
    servers.push(server);
    await server.listen();
    await server.transformRequest('/main.ts');
    await server.transformRequest('/hello.ts');
    const source = buildRegistry().vite;
    expect(source?.timings).toBeDefined();
    const graph = readViteGraph(source!);
    const main = graph.modules.find((mod) => mod.url === '/main.ts');
    const hello = graph.modules.find((mod) => mod.url === '/hello.ts');
    expect(main?.time?.transform).toBeGreaterThan(0);
    expect(main?.time?.total).toBeGreaterThanOrEqual(main!.time!.transform);
    // `hello.ts` is resolved as an import of `main.ts` before it is loaded.
    expect(hello?.time?.resolve).toBeGreaterThan(0);
    expect(graph.timings).toEqual({ modules: 2, capped: false });
    const container = server.environments.client.pluginContainer;
    const wrapped = container.transform;
    await server.close();
    servers.splice(0);
    expect(container.transform).not.toBe(wrapped);
    expect(buildRegistry().vite).toBeUndefined();
  });
});
