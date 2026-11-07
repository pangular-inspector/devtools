import { afterEach, describe, expect, it } from 'vitest';
import {
  canTraceTransforms,
  installTransformTracer,
  resetTransformTracer,
  traceTransform,
  type ViteServerLike,
} from '../analog-transform.ts';

type Hook = (code: string, id: string) => unknown;

function fakeServer() {
  const analog: { name: string; transform: Hook } = {
    name: 'analog-compile',
    transform: (code, id) => (id.includes('.page.ts') ? `compiled(${code})` : undefined),
  };
  const ids: { name: string; transform: { order: string; handler: Hook } } = {
    name: 'analog-server-fn',
    transform: {
      order: 'post',
      handler: async (code) => code.replace('serverFn(', 'serverFn("abc123", '),
    },
  };
  const noop = { name: 'noop', transform: () => null };
  const plugins: { name: string; transform?: unknown }[] = [
    analog,
    ids,
    noop,
    { name: 'no-transform' },
  ];
  const invalidated: string[] = [];
  const graph = {
    getModulesByFile: (file: string) => new Set([{ file }]),
    invalidateModule: (mod: { file?: string | null }) => void invalidated.push(String(mod.file)),
  };
  const server = {
    config: { root: '/app', base: '/', plugins },
    environments: {
      client: {
        plugins,
        moduleGraph: graph,
        transformRequest: async (url: string) => {
          let code = 'export const x = serverFn(() => 1);';
          for (const plugin of plugins) {
            const hook = plugin.transform as Hook | { handler: Hook } | undefined;
            if (!hook) continue;
            const run = typeof hook === 'function' ? hook : hook.handler;
            const out = await run(code, `/app${url}?v=1`);
            const next = typeof out === 'string' ? out : (out as { code?: string } | null)?.code;
            if (next !== undefined && next !== null) code = next;
          }
          return { code };
        },
      },
    },
  };
  return { server: server as unknown as ViteServerLike, plugins, invalidated };
}

afterEach(() => resetTransformTracer());

describe('traceTransform', () => {
  it('explains that it needs the Vite plugin', async () => {
    expect(canTraceTransforms()).toBe(false);
    expect((await traceTransform('/src/app/pages/index.page.ts')).error).toMatch(/Vite/);
  });

  it('records each plugin step for the traced file only, in order', async () => {
    const { server, plugins, invalidated } = fakeServer();
    installTransformTracer(server);
    const trace = await traceTransform('/src/app/pages/index.page.ts');
    expect(invalidated).toEqual(['/app/src/app/pages/index.page.ts']);
    expect(trace.steps.map((s) => [s.plugin, s.changed])).toEqual([
      ['analog-compile', true],
      ['analog-server-fn', true],
      ['noop', false],
    ]);
    expect(trace.steps[1].code).toContain('serverFn("abc123"');
    expect(trace.code).toBe('compiled(export const x = serverFn("abc123", () => 1);)');
    // The object hook keeps its order, and the wrapper passes calls through when no trace runs.
    expect((plugins[1].transform as { order: string }).order).toBe('post');
    expect(await (plugins[0].transform as Hook)('a', '/app/x.page.ts')).toBe('compiled(a)');
  });

  it('wraps each plugin once, even when installed again', async () => {
    const { server } = fakeServer();
    installTransformTracer(server);
    installTransformTracer(server);
    const trace = await traceTransform('/src/app/pages/index.page.ts');
    expect(trace.steps).toHaveLength(3);
  });
});

describe('dev server restarts', () => {
  it('leaves the new server tracer alone when the old server closes', async () => {
    const old = fakeServer().server;
    const next = fakeServer().server;
    installTransformTracer(old);
    installTransformTracer(next);
    resetTransformTracer(old);
    expect(canTraceTransforms()).toBe(true);
    resetTransformTracer(next);
    expect(canTraceTransforms()).toBe(false);
  });

  it('leaves the new server env alone when the old server closes', async () => {
    const { clearViteEnv, runtimeConfigView, setViteEnv } =
      await import('../rpc/analog-runtime-config.ts');
    const project = {
      root: '/nowhere',
      config: { apiPrefix: 'api', noSsrRoutes: [], routeRules: [] },
    };
    const old = {};
    const next = {};
    setViteEnv({ VITE_OLD: '1' }, old);
    setViteEnv({ VITE_NEW: '1' }, next);
    clearViteEnv(old);
    expect(runtimeConfigView(project, {}).env.map((v) => v.key)).toEqual(['VITE_NEW']);
    clearViteEnv(next);
    expect(runtimeConfigView(project, {}).env).toEqual([]);
  });
});
