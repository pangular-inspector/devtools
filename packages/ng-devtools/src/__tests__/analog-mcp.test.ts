import { createServer, type Server } from 'node:http';
import { createHostContext } from 'devframe/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import ngDevtools from '../devframe.ts';
import { clearCalls, recordCall, setDevOrigin } from '../analog-server-log.ts';
import {
  analogEndpoint,
  loadEndpointUrl,
  prerenderPlan,
  renderRows,
  resolveAnalogReport,
  ruleMatches,
  type AnalogState,
} from '../rpc/analog-tools.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import { BASE_FILES, BROKEN_FILES, makeProject } from './analog-fixture.ts';

function local(ctx: { rpc: unknown }, name: string): Promise<unknown> {
  return (ctx.rpc as { invokeLocal: (name: string) => Promise<unknown> }).invokeLocal(name);
}

async function boot(cwd: string) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd, mode: 'dev', host: host as never });
  await ngDevtools.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`ng-devtools:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`ng-devtools:${tool}`, args)) as { markdown: string }).markdown;
  return { ctx, push, call };
}

const report: AnalogRuntimeReport = {
  pageId: 'pg1',
  url: '/products/1',
  analog: true,
  chain: [
    { path: '/products', file: '/src/app/pages/products.page.ts' },
    {
      path: '/products/:id',
      file: '/src/app/pages/products/[id].page.ts',
      serverFile: '/src/app/pages/products/[id].server.ts',
    },
  ],
  load: { preview: '{"id":"1"}', bytes: 10, keys: ['id'] },
  serverContext: 'ssr-analog',
  hydrated: 4,
  transferState: true,
  hydrationErrors: ['NG0500: During hydration Angular expected <p>'],
  configPaths: ['/', '/products', '/login', '/pricing', '/docs', '/shop', '/about', '/hello'],
};

let server: Server;
let origin = '';
const received: { method?: string; url?: string; body: string; devtools?: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        body,
        devtools: req.headers['x-ng-devtools'] as string,
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, method: req.method }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => server.close());

beforeEach(() => {
  clearCalls();
  setDevOrigin(undefined);
});

describe('Analog MCP tools', () => {
  it('say when the workspace is not an Analog app', async () => {
    const { call } = await boot(makeProject({ 'package.json': '{}' }));
    expect(await call('analog-current-page')).toContain('not an Analog app');
    for (const tool of [
      'analog-routes',
      'analog-api-routes',
      'analog-server-functions',
      'analog-render-modes',
      'analog-prerender-plan',
      'analog-content',
      'analog-lint',
    ]) {
      expect(await call(tool), tool).toContain('not an Analog app');
    }
    expect(await call('analog-explain-url', { url: '/' })).toContain('not an Analog app');
  });

  it('analog-routes and analog-explain-url describe the file routes', async () => {
    const { call, push } = await boot(makeProject(BASE_FILES));
    const routes = await call('analog-routes');
    expect(routes).toContain(
      '`/products/:id` `/src/app/pages/products/[id].page.ts`: page, .server.ts (load)',
    );
    expect(routes).toContain('routeMeta: title, meta, canActivate');
    expect(await call('analog-routes', { filter: 'docs' })).not.toContain('products');
    await push('push-analog', report);
    const explained = await call('analog-explain-url', { url: '/products/1' });
    expect(explained).toContain('`/src/app/pages/products.page.ts`');
    expect(explained).toContain('Params: {"id":"1"}');
    expect(explained).toContain('`/api/_analog/pages/products/1`');
    expect(explained).toContain('Live page:');
    expect(await call('analog-explain-url', { url: '/nope' })).toContain('matches no file route');
  });

  it('analog-current-page reports files, load data, hydration and restart hints', async () => {
    const { call, push } = await boot(makeProject(BASE_FILES));
    expect(await call('analog-current-page')).toContain('No Analog page has reported yet');
    await push('push-analog', report);
    const text = await call('analog-current-page');
    expect(text).toContain(
      '`/src/app/pages/products/[id].page.ts` + `/src/app/pages/products/[id].server.ts`',
    );
    expect(text).toContain('load() data (10 bytes, keys: id)');
    expect(text).toContain('server rendered (ssr-analog), 4 hydrated node(s)');
    expect(text).toContain('NG0500');
    expect(text).toContain('`/dashboard`');
    expect(text).toContain('restart the dev server');
  });

  it('analog-server-calls lists calls and flags loads fetched twice', async () => {
    const { call } = await boot(makeProject(BASE_FILES));
    expect(await call('analog-server-calls')).toContain('No server calls recorded yet');
    const base = { method: 'GET', status: 200, ms: 3, bytes: 20 };
    recordCall({
      ...base,
      at: 1000,
      kind: 'load',
      url: '/api/_analog/pages/products/1',
      route: '/products/1',
      from: 'ssr',
      preview: '{"id":"1"}',
    });
    recordCall({
      ...base,
      at: 1100,
      kind: 'page',
      url: '/products/1',
      route: '/products/1',
      from: 'browser',
      render: 'ssr',
    });
    recordCall({
      ...base,
      at: 1200,
      kind: 'load',
      url: '/api/_analog/pages/products/1',
      route: '/products/1',
      from: 'browser',
    });
    recordCall({
      ...base,
      at: 1300,
      kind: 'api',
      url: '/api/v1/nope',
      route: '/api/v1/nope',
      from: 'browser',
      status: 404,
    });
    const text = await call('analog-server-calls');
    expect(text).toContain('load GET `/api/_analog/pages/products/1` 200 in 3ms (ssr, 20 B)');
    expect(text).toContain('render ssr');
    expect(text).toContain('Fetched twice');
    expect(await call('analog-server-calls', { kind: 'api' })).not.toContain('_analog');
    const lint = await call('analog-lint');
    expect(lint).toContain('load-fetched-twice');
    expect(lint).toContain('api-not-found');
  });

  it('analog-server-calls lists form actions with their outcome and filters them', async () => {
    const { call } = await boot(makeProject(BASE_FILES));
    const base = {
      method: 'POST',
      ms: 4,
      kind: 'action' as const,
      url: '/api/_analog/pages/login',
      route: '/login',
      from: 'browser' as const,
    };
    recordCall({ ...base, at: 1, status: 200, outcome: 'success' });
    recordCall({
      ...base,
      at: 2,
      status: 422,
      outcome: 'invalid',
      preview: '{"email":"Email is required"}',
    });
    recordCall({ ...base, at: 3, status: 302, outcome: 'redirect', location: '/dashboard' });
    recordCall({ ...base, at: 4, kind: 'load', method: 'GET', status: 200 });
    const actions = await call('analog-server-calls', { kind: 'action' });
    expect(actions).toContain(
      'action POST `/api/_analog/pages/login` 200 in 4ms (browser, action succeeded)',
    );
    expect(actions).toContain('422 in 4ms (browser, validation errors (fail()))');
    expect(actions).toContain('{"email":"Email is required"}');
    expect(actions).toContain('302 in 4ms (browser, action redirected, to `/dashboard`)');
    expect(actions).not.toContain('load GET');
    expect(await call('analog-server-calls', { kind: 'load' })).not.toContain('action POST');
  });

  it('analog-api-routes and analog-call-api reach the dev server with a confirm gate', async () => {
    const { call } = await boot(makeProject(BASE_FILES));
    const api = await call('analog-api-routes');
    expect(api).toContain(
      'DELETE `/api/v1/products/:id` `/src/server/routes/api/v1/products/[id].delete.ts`',
    );
    expect(api).toContain('Middleware');
    expect(await call('analog-call-api', { path: '/api/v1/hello' })).toContain(
      'dev server address is unknown',
    );
    setDevOrigin(`${origin}/`);
    const get = await call('analog-call-api', { path: '/api/v1/hello' });
    expect(get).toContain('GET /api/v1/hello: 200');
    expect(get).toContain('"method":"GET"');
    expect(
      await call('analog-call-api', { path: '/api/v1/products', method: 'POST', body: { a: 1 } }),
    ).toContain('confirm: true');
    const post = await call('analog-call-api', {
      path: '/api/v1/products',
      method: 'POST',
      body: { a: 1 },
      confirm: true,
    });
    expect(post).toContain('POST /api/v1/products: 200');
    expect(received.at(-1)).toMatchObject({
      method: 'POST',
      url: '/api/v1/products',
      body: '{"a":1}',
      devtools: '1',
    });
    expect(await call('analog-call-api', { path: '//evil.test/x' })).toContain('Refused');
    expect(await call('analog-call-api', { path: '/x', method: 'TRACE' })).toContain(
      'Unsupported method',
    );
  });

  it('analog-render-modes and analog-prerender-plan read config, build output and requests', async () => {
    const { call } = await boot(makeProject(BASE_FILES));
    recordCall({
      at: 1,
      kind: 'page',
      method: 'GET',
      url: '/dashboard',
      route: '/dashboard',
      status: 200,
      ms: 5,
      from: 'browser',
      render: 'client',
    });
    const modes = await call('analog-render-modes');
    expect(modes).toContain(
      "`/dashboard`: client only (routeRules['/dashboard'] ssr: false); last request: client only",
    );
    expect(modes).toContain('`/pricing`: prerendered (SSG)');
    expect(modes).toContain('`/login`: server rendered on each request (SSR)');
    const plan = await call('analog-prerender-plan');
    expect(plan).toContain('prerender.routes: `/`, `/pricing`, `/missing`');
    expect(plan).toContain('Dynamic pages need explicit entries');
    expect(plan).toContain('`/products/:id`');
  });

  it('matches route rules the way Nitro does', () => {
    expect(ruleMatches('/dash/**', '/dash')).toBe(true);
    expect(ruleMatches('/dash/**', '/dash/a/b')).toBe(true);
    expect(ruleMatches('/dash/**', '/dashboard')).toBe(false);
    expect(ruleMatches('/blog/*', '/blog/:slug')).toBe(true);
    expect(ruleMatches('/blog/*', '/blog/a/b')).toBe(false);
    expect(ruleMatches('/about/', '/about')).toBe(true);
    expect(ruleMatches('/**', '/')).toBe(true);
  });

  it('reads every route rule kind and matches requests to dynamic and catch-all pages', () => {
    const root = makeProject(BASE_FILES, {
      'vite.config.ts': `import analog from '@analogjs/platform';
export default {
  plugins: [
    analog({
      nitro: {
        routeRules: {
          '/dash/**': { ssr: false },
          '/login': { redirect: { to: '/', statusCode: 301 } },
          '/pricing': { prerender: true },
          '/products/**': { isr: 60 },
          '/docs/**': { swr: true },
          '/shop/**': { cache: { maxAge: 30 } },
          '/about': { headers: { 'Cache-Control': 's-maxage=600' } },
          '/': { headers: { 'cache-control': 'no-store' } },
        },
      },
    }),
  ],
};
`,
    });
    const project = scanAnalog(root);
    expect(project.config.routeRules).toHaveLength(8);
    expect(project.config.noSsrRoutes).toEqual(['/dash/**']);
    const page = (url: string, at: number) => ({
      id: at,
      at,
      kind: 'page' as const,
      method: 'GET',
      url,
      route: url,
      status: 200,
      ms: 7,
      from: 'browser' as const,
      render: 'ssr' as const,
    });
    const state: AnalogState = {
      pages: [],
      duplicates: [],
      reportedAt: 0,
      calls: [page('/products/42', 1), page('/docs/a/b', 2), page('/login/', 3)],
    };
    const rows = Object.fromEntries(renderRows(project, state).map((r) => [r.path, r]));
    expect(rows['/dashboard']).toMatchObject({ mode: 'ssr' });
    expect(rows['/login']).toMatchObject({
      mode: 'redirect',
      reason: "routeRules['/login'] redirect to /",
      last: { status: 200, ms: 7 },
    });
    expect(rows['/pricing']).toMatchObject({
      mode: 'ssg',
      reason: "routeRules['/pricing'] prerender: true",
    });
    expect(rows['/products/:id']).toMatchObject({
      mode: 'cached',
      reason: "routeRules['/products/**'] isr: 60",
      last: { at: 1 },
    });
    expect(rows['/products']).toMatchObject({ mode: 'cached' });
    expect(rows['/products']?.last).toBeUndefined();
    expect(rows['/docs/**']).toMatchObject({
      mode: 'cached',
      reason: "routeRules['/docs/**'] swr: true",
      last: { at: 2 },
    });
    expect(rows['/shop']).toMatchObject({ mode: 'cached', reason: "routeRules['/shop/**'] cache" });
    expect(rows['/about']).toMatchObject({
      mode: 'cached',
      reason: "routeRules['/about'] Cache-Control: s-maxage=600",
    });
    expect(rows['/']).toMatchObject({ mode: 'ssr' });
    const plan = prerenderPlan(project);
    expect(plan.fromRules).toEqual(['/pricing']);
    expect(plan.staticMissing).not.toContain('/pricing');
    expect(plan.staticMissing).not.toContain('/login');
  });

  it('analog-content and analog-lint cover content and static mistakes', async () => {
    const { call } = await boot(makeProject(BASE_FILES, BROKEN_FILES));
    const content = await call('analog-content');
    expect(content).toContain('`/src/content/hello.md` slug `hello`, served at `/hello`');
    expect(content).toContain('ERROR: Frontmatter block is not closed');
    expect(await call('analog-content', { filter: 'Copy' })).toContain('hello-copy.md');
    const lint = await call('analog-lint');
    for (const rule of [
      'duplicate-url',
      'missing-default-export',
      'orphan-server-file',
      'api-method-suffix',
      'duplicate-slug',
    ]) {
      expect(lint, rule).toContain(rule);
    }
  });

  it('get-routes and build-meta understand Analog apps', async () => {
    const { ctx } = await boot(makeProject(BASE_FILES));
    const routes = (await local(ctx, 'ng-devtools:get-routes')) as unknown as {
      path: string;
      file: string;
    }[];
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'products/:id',
          file: 'src/app/pages/products/[id].page.ts',
        }),
        expect.objectContaining({ path: 'pricing', title: 'Pricing' }),
      ]),
    );
    const meta = (await local(ctx, 'ng-devtools:build-meta')) as unknown as {
      ssr: boolean;
      analog?: string;
    };
    expect(meta).toMatchObject({ ssr: true, analog: '2.7.5' });
    const plain = await boot(makeProject({ 'package.json': '{}' }));
    const plainMeta = (await local(plain.ctx, 'ng-devtools:build-meta')) as unknown as {
      analog?: string;
    };
    expect(plainMeta.analog).toBeUndefined();
  });

  it('rejects malformed page reports', async () => {
    const { call, push } = await boot(makeProject(BASE_FILES));
    await push('push-analog', { ...report, chain: 'nope' });
    await push('push-analog', { ...report, hydrationErrors: [1] });
    await push('push-analog', { ...report, pageId: 'x'.repeat(80) });
    await push('push-analog', { ...report, chain: [{ path: '/a', file: 7 }] });
    await push('push-analog', { ...report, load: { preview: '{}', bytes: 2 } });
    await push('push-analog', { ...report, serverContext: 1 });
    expect(await call('analog-current-page')).toContain('No Analog page has reported yet');
  });

  it('checks page and server files against the project', async () => {
    const project = scanAnalog(
      makeProject(BASE_FILES, {
        'src/app/pages/blog.page.analog': '<template><p>blog</p></template>',
        'src/app/pages/blog.server.ts': 'export const load = async () => ({});\n',
      }),
    );
    const resolved = resolveAnalogReport(project, {
      ...report,
      chain: [
        {
          path: '/products',
          file: '/src/app/pages/products.page.ts',
          serverFile: '/src/app/pages/products.server.ts',
        },
      ],
      loadFrom: 0,
    });
    expect(resolved.chain[0]).toEqual({
      path: '/products',
      file: '/src/app/pages/products.page.ts',
    });
    expect(resolved.load).toBeUndefined();
    const kept = resolveAnalogReport(project, { ...report, loadFrom: 1 });
    expect(kept.chain[1].serverFile).toBe('/src/app/pages/products/[id].server.ts');
    expect(kept.load).toBeDefined();
    const blog = resolveAnalogReport(project, {
      ...report,
      chain: [
        {
          path: '/blog',
          file: '/src/app/pages/blog.page.ts',
          serverFile: '/src/app/pages/blog.server.ts',
        },
      ],
      loadFrom: 0,
    });
    expect(blog.chain[0].file).toBe('/src/app/pages/blog.page.analog');
    expect(blog.load).toBeDefined();
  });

  it('builds load endpoints the way Analog does', () => {
    expect(analogEndpoint('/src/app/pages/index.page.ts')).toBe('/pages/index');
    expect(analogEndpoint('/src/app/pages/products/[id].page.ts')).toBe('/pages/products/[id]');
    expect(analogEndpoint('/src/app/pages/(auth)/login.page.ts')).toBe('/pages/(auth)/login');
    expect(analogEndpoint('/src/app/pages/(home).page.ts')).toBe('/pages/-home-');
    expect(analogEndpoint('/src/app/pages/blog.[slug].page.analog')).toBe('/pages/blog/[slug]');
    expect(analogEndpoint('/src/app/pages/docs/[...slug].page.ts')).toBe('/pages/docs/**');
    expect(analogEndpoint('/src/app/pages/shop/[[...path]].page.ag')).toBe('/pages/shop/**');
    expect(loadEndpointUrl('/src/app/pages/products/[id].page.ts', 'api', { id: '7' })).toBe(
      '/api/_analog/pages/products/7',
    );
    expect(loadEndpointUrl('/src/app/pages/docs/[...slug].page.ts', 'api', { '**': 'a/b' })).toBe(
      '/api/_analog/pages/docs/a/b',
    );
  });

  it('forgets closed pages, clears calls and shares duplicate loads', async () => {
    const { ctx, push } = await boot(makeProject(BASE_FILES));
    const state = () =>
      (
        ctx.rpc as unknown as {
          sharedState: { get: (name: string) => Promise<{ value: () => AnalogState }> };
        }
      ).sharedState
        .get('ng-devtools:analog')
        .then((s) => s.value());
    await push('push-analog', report);
    expect((await state()).pages).toHaveLength(1);
    await push('forget-analog-page', 'pg1');
    expect((await state()).pages).toHaveLength(0);
    const base = { method: 'GET', status: 200, ms: 3, url: '/api/_analog/pages/products/1' };
    recordCall({ ...base, at: 1000, kind: 'load', route: '/products/1', from: 'ssr' });
    recordCall({
      ...base,
      at: 1100,
      kind: 'page',
      route: '/products/1',
      from: 'browser',
      render: 'ssr',
    });
    recordCall({ ...base, at: 1200, kind: 'load', route: '/products/1', from: 'browser' });
    expect((await state()).duplicates).toEqual([
      { route: '/products/1', ssrAt: 1000, browserAt: 1200 },
    ]);
    await push('analog-clear-calls', undefined);
    expect((await state()).calls).toEqual([]);
    expect((await state()).duplicates).toEqual([]);
  });
});
