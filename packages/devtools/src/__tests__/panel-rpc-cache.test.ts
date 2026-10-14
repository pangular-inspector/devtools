import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineDevframe } from 'devframe';
import { createDevServer } from 'devframe/adapters/dev';
import { connectDevframe, type DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_CACHED_RPC, RPC_INSPECTOR, SHARED_RPC } from '../config.ts';
import { getBuildMeta } from '../rpc/build-meta.ts';

type Started = Awaited<ReturnType<typeof createDevServer>>;

/**
 * A devframe server with the real `build-meta` and a live query, each counting
 * the calls that reach the server, so the tests see what the client cached.
 */
async function startServer(cwd: string, calls: Map<string, number>): Promise<Started> {
  const count = (name: string) => calls.set(name, (calls.get(name) ?? 0) + 1);
  const definition = defineDevframe({
    id: 'pangular',
    name: 'Pangular Inspector',
    version: '0.0.0',
    packageName: '@pangular-inspector/devtools',
    homepage: 'https://pangular-inspector.dev',
    description: 'Cache test server',
    setup(ctx) {
      const my = ctx.scope('pangular');
      my.rpc.register({
        ...getBuildMeta,
        setup: async (setupCtx) => {
          // The dev server's context reads process.cwd(); point it at the fixture.
          const { handler } = await getBuildMeta.setup!({ ...setupCtx, cwd });
          return {
            handler: (...args: []) => {
              count('build-meta');
              return handler!(...args);
            },
          };
        },
      });
      my.rpc.register({
        name: 'list-pages',
        type: 'query',
        jsonSerializable: true,
        handler: () => {
          count('list-pages');
          return [];
        },
      });
    },
  });
  return createDevServer(definition, {
    host: '127.0.0.1',
    port: 0,
    auth: false,
    mcp: false,
    openBrowser: false,
  });
}

function scoped(client: DevframeRpcClient) {
  return client.scope('pangular').rpc as unknown as {
    call: (name: string) => Promise<unknown>;
  };
}

describe('panel RPC cache', () => {
  let cwd: string;
  const servers: Started[] = [];
  const clients: DevframeRpcClient[] = [];

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'pangular-cache-'));
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'cache-demo' }));
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close?.();
    for (const server of servers.splice(0)) await server.close().catch(() => undefined);
    rmSync(cwd, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  async function connect(server: Started): Promise<DevframeRpcClient> {
    // The browser client resolves the socket URL against its page location.
    vi.stubGlobal('location', new URL(`${server.origin}/`));
    // It also reuses the connection an earlier client stored on the global
    // object, which points at an earlier server here.
    const stored = globalThis as Record<string, unknown>;
    delete stored['__DEVFRAME_CONNECTION__'];
    delete stored['__DEVFRAME_CONNECTION_META__'];
    const client = await connectDevframe({
      baseURL: `${server.origin}/`,
      cacheOptions: { functions: [...PANEL_CACHED_RPC] },
      webmcp: false,
      callTimeout: 5000,
    });
    clients.push(client);
    await client.ensureTrusted();
    return client;
  }

  async function start(calls: Map<string, number>): Promise<Started> {
    const server = await startServer(cwd, calls);
    servers.push(server);
    return server;
  }

  it('lists only static or cacheable functions the panel server registers', () => {
    expect(PANEL_CACHED_RPC).toEqual(['pangular:build-meta']);
    expect(getBuildMeta.type).toBe('static');
    expect(getBuildMeta.cacheable).toBe(true);
    for (const name of PANEL_CACHED_RPC) {
      const bare = name.replace(/^pangular:/, '');
      expect(SHARED_RPC.includes(bare) || bare in RPC_INSPECTOR).toBe(true);
    }
  });

  it('answers a repeat build-meta call from the cache', async () => {
    const calls = new Map<string, number>();
    const client = await connect(await start(calls));
    const first = (await scoped(client).call('build-meta')) as { projectName: string };
    const second = await scoped(client).call('build-meta');
    expect(first.projectName).toBe('cache-demo');
    expect(second).toEqual(first);
    expect(calls.get('build-meta')).toBe(1);
    expect(client.cacheManager.has('pangular:build-meta', [])).toBe(true);
  });

  it('sends every call of a function outside the list to the server', async () => {
    const calls = new Map<string, number>();
    const client = await connect(await start(calls));
    await scoped(client).call('list-pages');
    await scoped(client).call('list-pages');
    await scoped(client).call('list-pages');
    expect(calls.get('list-pages')).toBe(3);
    expect(client.cacheManager.has('pangular:list-pages', [])).toBe(false);
  });

  it('asks a restarted server again instead of serving the old answer', async () => {
    const before = new Map<string, number>();
    const server = await start(before);
    const client = await connect(server);
    await scoped(client).call('build-meta');
    expect(client.cacheManager.has('pangular:build-meta', [])).toBe(true);

    const dropped = new Promise<void>((resolve) =>
      client.events.on('connection:status', (status) => {
        if (status !== 'connected') resolve();
      }),
    );
    await server.close();
    await dropped;
    // devframe clears the cache when the connection status changes.
    expect(client.cacheManager.has('pangular:build-meta', [])).toBe(false);

    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'renamed-demo' }));
    const after = new Map<string, number>();
    const next = await connect(await start(after));
    const meta = (await scoped(next).call('build-meta')) as { projectName: string };
    expect(meta.projectName).toBe('renamed-demo');
    expect(after.get('build-meta')).toBe(1);
  });
});
