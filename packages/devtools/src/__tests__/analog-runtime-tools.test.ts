import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { analogBuildText, analyzeBuild, chunkImports } from '../rpc/analog-build.ts';
import { nitroInternals, nitroText, purgeNitroCache } from '../rpc/analog-nitro.ts';
import {
  nitroEnvName,
  parseEnv,
  runtimeConfigText,
  runtimeConfigView,
  setViteEnv,
} from '../rpc/analog-runtime-config.ts';
import {
  checkRenderMode,
  fitsInDev,
  observedMode,
  samplePath,
} from '../rpc/analog-render-check.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import { callApi, requestHeaders } from '../rpc/analog-register.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const CONFIG = `import analog from '@analogjs/platform';
const key = process.env.KEY;
export default {
  plugins: [
    analog({
      nitro: {
        routeRules: { '/blog/**': { isr: 60 }, '/news': { swr: true } },
        storage: { cache: { driver: 'fs', base: './.cache-store' }, kv: { driver: 'redis' } },
        devStorage: { db: { driver: 'memory' } },
        runtimeConfig: {
          apiSecret: 'shh-123',
          region: 'eu',
          token: key,
          public: { apiBase: '/api', siteName: 'Shop' },
        },
      },
    }),
  ],
};
`;

describe('analyzeBuild', () => {
  const files = {
    'dist/analog/public/index.html':
      '<script type="module" crossorigin src="/assets/index-Ab12Cd34.js"></script>',
    'dist/analog/public/assets/index-Ab12Cd34.js':
      'import "./vendor-Zz11Yy22.js";const r=[()=>import("./pricing.page-Qw12Er34.js")];',
    'dist/analog/public/assets/vendor-Zz11Yy22.js': 'export const v=1;'.repeat(50),
    'dist/analog/public/assets/pricing.page-Qw12Er34.js':
      'import{v}from"./vendor-Zz11Yy22.js";import{c}from"./chart-Ty56Ui78.js";const m=()=>import("./modal-Op90As12.js");',
    'dist/analog/public/assets/chart-Ty56Ui78.js': 'export const c=2;'.repeat(20),
    'dist/analog/public/assets/modal-Op90As12.js': 'export default 3;',
    'dist/analog/public/assets/style-Gh34Jk56.css': 'body{color:red}',
  };

  it('reads chunk imports from the built code', () => {
    expect(chunkImports('assets/a.js', 'import{x}from"./b.js";import("../c.js")')).toEqual({
      imports: ['assets/b.js'],
      lazy: ['c.js'],
    });
  });

  it('finds each page chunk, what it loads beyond the entry and its lazy chunks', () => {
    const project = scanAnalog(makeProject(BASE_FILES, files));
    const build = analyzeBuild(project);
    expect(build.found).toBe(true);
    expect(build.entry?.chunk).toBe('assets/index-Ab12Cd34.js');
    const pricing = build.routes.find((r) => r.path === '/pricing')!;
    expect(pricing).toMatchObject({
      chunk: 'assets/pricing.page-Qw12Er34.js',
      shared: ['assets/chart-Ty56Ui78.js'],
      lazy: ['assets/modal-Op90As12.js'],
      matchedBy: 'name',
    });
    // Several index.page.ts files share a name, so none is guessed.
    expect(build.routes.find((r) => r.path === '/')?.chunk).toBeUndefined();
    expect(build.notes[0]).toMatch(/build\.manifest/);
    expect(build.totals.css).toBe(15);
    expect(analogBuildText(build)).toContain('| /pricing | assets/pricing.page-Qw12Er34.js |');
  });

  it('maps pages through the Vite manifest when there is one', () => {
    const project = scanAnalog(
      makeProject(BASE_FILES, files, {
        'dist/analog/public/.vite/manifest.json': JSON.stringify({
          'src/app/pages/index.page.ts': { file: 'assets/modal-Op90As12.js' },
          'src/main.ts': { file: 'assets/index-Ab12Cd34.js', isEntry: true },
        }),
      }),
    );
    const build = analyzeBuild(project);
    expect(build.manifest).toBe(true);
    expect(build.routes.find((r) => r.path === '/')).toMatchObject({
      chunk: 'assets/modal-Op90As12.js',
      matchedBy: 'manifest',
    });
  });

  it('says to build first when there is no build', () => {
    const build = analyzeBuild(scanAnalog(makeProject(BASE_FILES)));
    expect(build.found).toBe(false);
    expect(analogBuildText(build)).toMatch(/Run `analog build`/);
  });
});

describe('nitroInternals', () => {
  const root = makeProject(BASE_FILES, {
    'vite.config.ts': CONFIG,
    'src/server/plugins/log.ts': 'export default () => {};\n',
    'src/server/tasks/db/migrate.ts': 'export default {};\n',
    '.cache-store/nitro/routes/_/blog/hello.abc.json': '{"value":1}',
    '.cache-store/nitro/handlers/x.json': '{}',
    '.cache-store/other/keep.json': '{}',
  });

  it('lists plugins, tasks, storage mounts, cached rules and cache entries', () => {
    const internals = nitroInternals(scanAnalog(root));
    expect(internals.plugins).toEqual(['/src/server/plugins/log.ts']);
    expect(internals.tasks).toEqual([
      { name: 'db:migrate', file: '/src/server/tasks/db/migrate.ts' },
    ]);
    expect(internals.storage).toEqual([
      { name: 'cache', from: 'storage', driver: 'fs', base: './.cache-store' },
      { name: 'kv', from: 'storage', driver: 'redis' },
      { name: 'db', from: 'devStorage', driver: 'memory' },
    ]);
    expect(internals.cachedRules).toEqual([
      { path: '/blog/**', rule: 'isr: 60' },
      { path: '/news', rule: 'swr: true' },
    ]);
    expect(internals.entries.map((e) => `${e.group}/${e.key}`).sort()).toEqual([
      'handlers/x',
      'routes/_/blog/hello.abc',
    ]);
    expect(nitroText(internals)).toContain('db:migrate');
  });

  it('purges only listed entries and refuses other files', () => {
    const project = scanAnalog(root);
    expect(purgeNitroCache(project, ['/package.json'])).toMatchObject({ ok: false, removed: 0 });
    expect(purgeNitroCache(project, ['/.cache-store/nitro/handlers/x.json'])).toEqual({
      ok: true,
      removed: 1,
    });
    expect(existsSync(join(root, '.cache-store/nitro/routes/_/blog/hello.abc.json'))).toBe(true);
    expect(purgeNitroCache(project)).toEqual({ ok: true, removed: 1 });
    expect(existsSync(join(root, '.cache-store/other/keep.json'))).toBe(true);
    expect(existsSync(join(root, 'package.json'))).toBe(true);
  });
});

describe('runtimeConfigView', () => {
  afterEach(() => setViteEnv(undefined));
  const root = makeProject(BASE_FILES, {
    'vite.config.ts': CONFIG,
    '.env': 'VITE_API_URL=https://api.example.com\nVITE_STRIPE_SECRET=sk_live_123\nDB_PASSWORD=x\n',
    '.env.local': 'NITRO_PUBLIC_SITE_NAME="Local shop"\n',
  });

  it('masks secret names and shows NITRO_ overrides', () => {
    const view = runtimeConfigView(scanAnalog(root), {});
    expect(view.env).toEqual([
      { key: 'VITE_API_URL', value: 'https://api.example.com', from: '.env' },
      { key: 'VITE_STRIPE_SECRET', value: '[redacted]', from: '.env', masked: true },
    ]);
    const byKey = Object.fromEntries(view.runtimeConfig.map((v) => [v.key, v]));
    expect(byKey['apiSecret']).toMatchObject({ value: '[redacted]', masked: true });
    expect(byKey['region']).toMatchObject({ value: 'eu', from: 'vite.config' });
    expect(byKey['token']).toMatchObject({ value: '[redacted]' });
    expect(byKey['public.apiBase']).toMatchObject({ value: '/api' });
    expect(byKey['public.siteName']).toMatchObject({
      value: 'Local shop',
      from: 'NITRO_PUBLIC_SITE_NAME',
    });
    expect(runtimeConfigText(view)).not.toContain('shh-123');
    expect(JSON.stringify(view)).not.toContain('sk_live_123');
  });

  it("prefers Vite's resolved env when the dev server set it", () => {
    setViteEnv({ MODE: 'development', VITE_X: '1' });
    expect(runtimeConfigView(scanAnalog(root), {}).env.map((v) => v.key)).toEqual([
      'MODE',
      'VITE_X',
    ]);
  });

  it('parses .env files and names NITRO_ overrides like Nitro', () => {
    expect(parseEnv('# c\nexport A=1\nB="two words"\nC=3 # note\n')).toEqual({
      A: '1',
      B: 'two words',
      C: '3',
    });
    expect(nitroEnvName('public.apiBase')).toBe('NITRO_PUBLIC_API_BASE');
  });
});

describe('render mode check', () => {
  let server: Server;
  let origin = '';
  const seen: { url?: string; accept?: string }[] = [];
  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push({ url: req.url, accept: req.headers.accept });
      if (req.url === '/dashboard') {
        res.setHeader('x-analog-no-ssr', 'true');
        res.end('<app-root></app-root>');
        return;
      }
      res.setHeader('cache-control', 'no-cache');
      res.end('<app-root ng-server-context="ssr"></app-root>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  afterAll(() => server.close());

  it('classifies responses and fits prerendered routes to SSR in dev', () => {
    expect(observedMode(302, { location: '/x' }, '')).toBe('redirect');
    expect(observedMode(200, { 'x-nitro-prerender': '1' }, '')).toBe('ssg');
    expect(observedMode(200, {}, '<app-root ng-server-context="ssr">')).toBe('ssr');
    expect(observedMode(200, { 'cache-control': 's-maxage=60' }, 'ng-server-context')).toBe(
      'cached',
    );
    expect(fitsInDev('ssg', 'ssr')).toBe(true);
    expect(fitsInDev('client', 'ssr')).toBe(false);
    expect(samplePath('/products/:id')).toBe('/products/1');
  });

  it('requests the page as HTML and compares it with the config', async () => {
    const project = scanAnalog(makeProject(BASE_FILES));
    const dashboard = await checkRenderMode(project, '/dashboard', origin);
    expect(dashboard).toMatchObject({ configured: 'client', observed: 'client', matches: true });
    const pricing = await checkRenderMode(project, '/pricing', origin);
    expect(pricing).toMatchObject({ configured: 'ssg', observed: 'ssr', matches: true });
    expect(pricing.note).toMatch(/per request/);
    expect(seen.every((s) => s.accept === 'text/html')).toBe(true);
  });
});

describe('playground headers', () => {
  let server: Server;
  let origin = '';
  let got: Record<string, string | string[] | undefined> = {};
  beforeAll(async () => {
    server = createServer((req, res) => {
      got = req.headers;
      res.setHeader('set-cookie', 'session=abc');
      res.setHeader('x-request-id', 'r-1');
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  afterAll(() => server.close());

  it('sends headers and cookies and returns masked response headers and timing', async () => {
    const result = await callApi(
      {
        path: '/api/v1/hello?q=1',
        headers: { 'Accept-Language': 'de' },
        cookies: { theme: 'dark', id: '7' },
      },
      origin,
    );
    expect(got['accept-language']).toBe('de');
    expect(got['cookie']).toBe('theme=dark; id=7');
    expect(got['x-pangular']).toBe('1');
    expect(result['headers']).toMatchObject({
      'set-cookie': '[redacted]',
      'x-request-id': 'r-1',
    });
    expect(result['size']).toBe(11);
    expect(typeof result['headersMs']).toBe('number');
  });

  it('refuses headers fetch owns and values that break a line', () => {
    expect(requestHeaders({ headers: { Host: 'evil' } })).toMatchObject({
      error: expect.stringContaining('host'),
    });
    expect(requestHeaders({ headers: { 'x-pangular': '0' } })).toHaveProperty('error');
    expect(requestHeaders({ headers: { a: 'x\r\nb: y' } })).toHaveProperty('error');
    expect(requestHeaders({ cookies: { a: 'x; b=y' } })).toHaveProperty('error');
    expect(requestHeaders({ headers: { 'x-a': '1' }, cookies: { b: '2' } })).toEqual({
      headers: { 'x-a': '1', cookie: 'b=2' },
    });
  });
});

describe('Analog runtime agent tools', () => {
  async function boot(config: Record<string, unknown> = {}) {
    const { createHostContext } = await import('devframe/node');
    const { createPangular } = await import('../devframe.ts');
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const root = makeProject(BASE_FILES, {
      'vite.config.ts': CONFIG,
      '.cache-store/nitro/routes/a.json': '{}',
      'content.schema.json': JSON.stringify({ required: ['date'] }),
    });
    const ctx = await createHostContext({ cwd: root, mode: 'dev', host: host as never });
    await createPangular({ inspectors: { analog: true }, ...config }).setup(ctx as never);
    return { ctx, root };
  }

  it('purges the Nitro cache only with confirm: true', async () => {
    const { toolAnswer } = await import('./tool-answer.ts');
    const { ctx, root } = await boot();
    const refused = await toolAnswer(ctx.agent.invoke('pangular:analog-purge-nitro-cache', {}));
    expect(refused.isError).toBe(true);
    expect(existsSync(join(root, '.cache-store/nitro/routes/a.json'))).toBe(true);
    const done = await toolAnswer(
      ctx.agent.invoke('pangular:analog-purge-nitro-cache', { confirm: true }),
    );
    expect(done.markdown).toContain('Deleted 1 Nitro cache entry');
    expect(existsSync(join(root, '.cache-store/nitro/routes/a.json'))).toBe(false);
  });

  it('refuses the purge RPC when actions.analog is off, and checks content with the configured schema', async () => {
    const { ctx, root } = await boot({
      actions: { analog: false },
      analog: { contentSchema: 'content.schema.json' },
    });
    const purge = (await ctx.rpc.invokeLocal(
      'pangular:analog-nitro-purge' as never,
      ...([{ confirm: true }] as never),
    )) as { ok: boolean; error: string };
    expect(purge).toMatchObject({ ok: false });
    expect(purge.error).toContain('actions.analog');
    expect(existsSync(join(root, '.cache-store/nitro/routes/a.json'))).toBe(true);
    const preview = (await ctx.rpc.invokeLocal(
      'pangular:analog-content-preview' as never,
      ...(['/src/content/hello.md'] as never),
    )) as { schemaErrors?: string[] };
    expect(preview.schemaErrors).toEqual(['date is required.']);
    const trace = (await ctx.rpc.invokeLocal(
      'pangular:analog-transform' as never,
      ...([{ file: '/package.json' }] as never),
    )) as { error?: string };
    expect(trace.error).toMatch(/page, layout or \.server\.ts/);
  });
});

describe('runNitroTask', () => {
  let server: Server;
  let origin = '';
  const got: { url?: string; method?: string; body: string; devtools?: string }[] = [];
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        got.push({
          url: req.url,
          method: req.method,
          body,
          devtools: String(req.headers['x-pangular'] ?? ''),
        });
        if (req.url?.includes('slow')) return; // never answers
        if (req.url?.includes('missing')) {
          res.statusCode = 404;
          return res.end('not found');
        }
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            result: { migrated: 3, token: 'Bearer abcdefghijklmnopqrstuvwxyz0123' },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  afterAll(() => server.close());
  const project = () =>
    scanAnalog(
      makeProject(BASE_FILES, {
        'src/server/tasks/db/migrate.ts': 'export default {};\n',
        'src/server/tasks/slow.ts': 'export default {};\n',
        'src/server/tasks/missing.ts': 'export default {};\n',
      }),
    );

  it('posts the payload to the task route and masks the answer', async () => {
    const { runNitroTask } = await import('../rpc/analog-nitro.ts');
    const result = await runNitroTask(project(), 'db:migrate', { dry: true }, origin);
    expect(result).toMatchObject({ ok: true, name: 'db:migrate', status: 200 });
    expect(result.output).toContain('"migrated":3');
    expect(result.output).not.toContain('abcdefghijklmnopqrstuvwxyz0123');
    expect(got.at(-1)).toMatchObject({
      url: '/_nitro/tasks/db%3Amigrate',
      method: 'POST',
      body: '{"payload":{"dry":true}}',
      devtools: '1',
    });
  });

  it('refuses unknown tasks, explains a missing task route and stops at the timeout', async () => {
    const { runNitroTask } = await import('../rpc/analog-nitro.ts');
    const p = project();
    const before = got.length;
    expect((await runNitroTask(p, '../etc', undefined, origin)).error).toMatch(/not a task/);
    expect(got.length).toBe(before);
    expect((await runNitroTask(p, 'db:migrate', [1], origin)).error).toMatch(/object/);
    expect((await runNitroTask(p, 'missing', undefined, origin)).error).toMatch(
      /experimental\.tasks/,
    );
    const slow = await runNitroTask(p, 'slow', undefined, origin, 200);
    expect(slow).toMatchObject({ ok: false });
    expect(slow.error).toMatch(/did not finish/);
  });
});
