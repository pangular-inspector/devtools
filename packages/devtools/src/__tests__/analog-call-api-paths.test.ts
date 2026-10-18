import { createServer, type Server } from 'node:http';
import { createHostContext } from 'devframe/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { setDevOrigin } from '../analog-server-log.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import { apiPathRefusal } from '../rpc/analog-register.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';
import { toolAnswer } from './tool-answer.ts';

const project = scanAnalog(
  makeProject(BASE_FILES, {
    'src/server/routes/health.ts': 'export default () => "ok";\n',
    'src/server/routes/feed/[name].xml.ts': 'export default () => "<rss/>";\n',
  }),
);

describe('apiPathRefusal', () => {
  it.each([
    '/api/v1/hello',
    '/api/v1/hello?id=1',
    '/api/v1/products/42',
    '/api/_analog/pages/login',
    '/_analog/pages/products/1',
    '/health',
    '/',
    '/products/42',
    '/docs/a/b/c',
    '/shop',
    '/about',
    '/pricing',
  ])('allows %s', (path) => {
    expect(apiPathRefusal(path, project)).toBeUndefined();
  });

  it.each([
    ['/@fs/etc/passwd', 'internal'],
    ['/%40fs/etc/passwd', 'internal'],
    ['/@id/virtual:module', 'internal'],
    ['/@vite/client', 'internal'],
    ['/node_modules/.vite/deps/x.js', 'internal'],
    ['/__pangular/__connection.json', 'internal'],
    ['/api/v1/hello?raw', '?raw'],
    ['/products/42?import&raw', '?import'],
    ['/docs/x?url', '?url'],
    ['/docs/x?worker', '?worker'],
    ['/docs/src/main.ts?raw', '?raw'],
    ['/src/app/pages/dashboard.page.ts', 'names a file'],
    ['/src/app/pages/index.page', 'names a file'],
    ['/package.json', 'names a file'],
    ['/api/../src/main.ts', '..'],
    ['/api/%2e%2e/package.json', '..'],
    ['/api/v1\\..\\x', 'Pass a path'],
    ['/nope/never', 'not an API route'],
  ])('refuses %s', (path, reason) => {
    expect(apiPathRefusal(path, project)).toContain(reason);
  });

  it('refuses project files even when a catch-all page matches every URL', () => {
    const catchAll = scanAnalog(
      makeProject(BASE_FILES, {
        'src/app/pages/[...all].page.ts': BASE_FILES['src/app/pages/index.page.ts'],
      }),
    );
    expect(apiPathRefusal('/anything/at/all', catchAll)).toBeUndefined();
    expect(apiPathRefusal('/src/app/pages/dashboard.page.ts', catchAll)).toContain('names a file');
    expect(apiPathRefusal('/src/app/pages/dashboard.page', catchAll)).toContain('names a file');
    expect(apiPathRefusal('/src', catchAll)).toContain('names a file');
    expect(apiPathRefusal('/vite.config', catchAll)).toContain('names a file');
  });
});

describe('analog-run-api paths', () => {
  let server: Server;
  const received: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      received.push(req.url ?? '');
      res.end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    setDevOrigin(`http://127.0.0.1:${port}/`);
  });

  afterAll(() => {
    setDevOrigin(undefined);
    server.close();
  });

  async function boot() {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({
      cwd: makeProject(BASE_FILES),
      mode: 'dev',
      host: host as never,
    });
    await pangular.setup(ctx as never);
    return ctx;
  }

  it('never sends a Vite file request from the agent tool or the panel RPC', async () => {
    const ctx = await boot();
    const tool = await toolAnswer(
      ctx.agent.invoke('pangular:analog-run-api', { path: '/@fs/etc/passwd' }),
    );
    expect(tool.isError).toBe(true);
    const rpc = (await ctx.rpc.invokeLocal(
      'pangular:analog-call-api' as never,
      ...([{ path: '/src/main.ts?raw' }] as never),
    )) as { ok: boolean; error: string };
    expect(rpc).toMatchObject({ ok: false });
    expect(rpc.error).toContain('?raw');
    expect(received).toEqual([]);

    const ok = (await ctx.agent.invoke('pangular:analog-run-api', {
      path: '/api/v1/hello',
    })) as string;
    expect(ok).toContain('GET /api/v1/hello: 200');
    expect(received).toEqual(['/api/v1/hello']);
  });
});
