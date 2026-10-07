import { connect } from 'node:net';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hubDefaultOrigins, initPangularHub, type PangularHubOptions } from '../hub.ts';
import { makeProject } from './analog-fixture.ts';

const hubs: { close: () => Promise<void> }[] = [];

async function boot(cwd: string) {
  const hub = initPangularHub({ cwd, ws: false, auth: false, allowedOrigins: false });
  hubs.push(hub);
  await hub.ready;
  const ctx = await hub.context;
  const docks = [...ctx.docks.views.values()].map((dock) => ({
    id: dock.id,
    title: dock.title,
    url: 'url' in dock ? dock.url : undefined,
    frameId: 'frameId' in dock ? dock.frameId : undefined,
    badge: dock.badge,
    groupId: dock.groupId,
    visibility: dock.visibility,
  }));
  return { hub, ctx, docks };
}

async function bootMcp(options: PangularHubOptions) {
  const cwd = makeProject({ 'package.json': '{}' });
  const hub = initPangularHub({ cwd, ws: false, allowedOrigins: false, ...options });
  hubs.push(hub);
  await hub.ready;
  return (token?: string) =>
    hub.handler(
      new Request('http://localhost/__devframes/__mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
    );
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const hub of hubs.splice(0)) await hub.close();
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

describe('Pangular Inspector hub', () => {
  it('adds a dock per tool, Analog included even outside Analog apps', async () => {
    const { docks } = await boot(makeProject({ 'package.json': '{}' }));
    const ours = docks.filter((d) => d.id.startsWith('pangular:'));
    expect(ours.map((d) => [d.id, d.url])).toEqual([
      ['pangular:angular', '/__devframes/pangular/?view=angular'],
      ['pangular:ngrx', '/__devframes/pangular/?view=ngrx'],
      ['pangular:analog', '/__devframes/pangular/?view=analog'],
      ['pangular:angular-native', '/__devframes/pangular/?view=angular-native'],
      ['pangular:nativescript', '/__devframes/pangular/?view=nativescript'],
      ['pangular:capacitor', '/__devframes/pangular/?view=capacitor'],
    ]);
    expect(ours.filter((d) => d.title.endsWith('Coming Soon')).map((d) => d.id)).toEqual([
      'pangular:capacitor',
    ]);
    expect(ours.find((d) => d.id === 'pangular:angular-native')?.title).toBe('Angular Native');
    expect(ours.some((d) => d.badge || d.groupId)).toBe(false);
    expect(new Set(ours.map((d) => d.frameId))).toEqual(new Set(['pangular']));
    expect(docks.find((d) => d.id === 'pangular')?.visibility).toBe('false');
  });

  it('serves the dock script, the viewer and the MCP tools', async () => {
    const { hub, ctx } = await boot(makeProject({ 'package.json': '{}' }));
    const get = (path: string) => hub.handler(new Request(`http://localhost${path}`));
    expect((await get('/__devframes/embedded.js')).status).toBe(200);
    expect((await get('/__devframes/')).status).toBe(200);
    const meta = await (await get('/__devframes/pangular/__connection.json')).json();
    expect(meta.configs.ui.branding.primaryColor).toBe('#f5a524');
    const forms = (await ctx.agent.invoke('pangular:inspect-forms', {})) as { markdown: string };
    expect(forms.markdown).toContain('No forms');
  });
});

const PANGULAR_EXTENSION = 'chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk';
const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const OTHER_EXTENSION = 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba';

async function sseStatus(
  options: Parameters<typeof initPangularHub>[0],
  origin: string | undefined,
) {
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    auth: false,
    ...options,
  });
  hubs.push(hub);
  await hub.ready;
  const headers: Record<string, string> = { accept: 'text/event-stream' };
  if (origin !== undefined) headers['origin'] = origin;
  const res = await hub.handler(new Request('http://localhost/__devframes/__sse', { headers }));
  await res.body?.cancel();
  return res.status;
}

describe('Pangular Inspector hub behind a web router', () => {
  it('answers under its base and lets other routes reach the app', async () => {
    const cwd = makeProject({ 'package.json': '{}' });
    const devtools = initPangularHub({ cwd, ws: false, auth: false });
    hubs.push(devtools);
    await devtools.ready;
    const app = new Hono();
    app.all(`${devtools.base}*`, (c) => devtools.handler(c.req.raw));
    app.get('*', (c) => c.text('angular app'));
    const get = (path: string) => app.request(`http://localhost${path}`);

    const meta = await get('/__devframes/__connection.json');
    expect(meta.status).toBe(200);
    expect(await meta.json()).toHaveProperty('backend');
    expect((await get('/__devframes/pangular/__connection.json')).status).toBe(200);
    expect((await get('/__devframes/')).status).toBe(200);
    const page = await get('/trips/42');
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('angular app');
  });

  it('answers 404 outside its base instead of falling through', async () => {
    const cwd = makeProject({ 'package.json': '{}' });
    const devtools = initPangularHub({ cwd, ws: false, auth: false });
    hubs.push(devtools);
    await devtools.ready;
    expect((await devtools.handler(new Request('http://localhost/trips/42'))).status).toBe(404);
  });
});

describe('Pangular Inspector hub origins', () => {
  it('accepts loopback pages and the Pangular Inspector extension by default, and nothing else', () => {
    for (const origin of [
      undefined,
      'http://localhost:4000',
      'http://127.0.0.1:4200',
      'http://[::1]:3000',
      PANGULAR_EXTENSION,
    ]) {
      expect(hubDefaultOrigins.isAllowed(origin)).toBe(true);
    }
    for (const origin of [
      'https://evil.example',
      'http://127.attacker.example',
      'chrome-extension://',
      `${PANGULAR_EXTENSION}/`,
      EXTENSION,
      OTHER_EXTENSION,
      'moz-extension://abcdefghijklmnop',
      'null',
    ]) {
      expect(hubDefaultOrigins.isAllowed(origin)).toBe(false);
    }
  });

  it('lets the Pangular Inspector extension open the SSE stream by default, and refuses other extensions', async () => {
    expect(await sseStatus({}, PANGULAR_EXTENSION)).toBe(200);
    expect(await sseStatus({}, OTHER_EXTENSION)).toBe(403);
    expect(await sseStatus({}, 'http://localhost:4000')).toBe(200);
    expect(await sseStatus({}, 'https://evil.example')).toBe(403);
  });

  it('accepts an unpacked extension listed in allowedOrigins and refuses other extensions', async () => {
    const unpacked = { allowedOrigins: [EXTENSION] };
    expect(await sseStatus(unpacked, EXTENSION)).toBe(200);
    expect(await sseStatus(unpacked, OTHER_EXTENSION)).toBe(403);
    expect(await sseStatus(unpacked, PANGULAR_EXTENSION)).toBe(200);
    expect(await sseStatus(unpacked, 'http://localhost:4000')).toBe(200);
  });

  it('keeps an explicit allowedOrigins setting as given', async () => {
    const tunnel = { allowedOrigins: ['https://tunnel.example'] };
    expect(await sseStatus(tunnel, 'https://tunnel.example')).toBe(200);
    expect(await sseStatus(tunnel, EXTENSION)).toBe(403);
    expect(await sseStatus(tunnel, PANGULAR_EXTENSION)).toBe(200);
    expect(await sseStatus({ allowedOrigins: [] }, PANGULAR_EXTENSION)).toBe(200);
    expect(await sseStatus({ allowedOrigins: false }, 'https://evil.example')).toBe(200);
  });
});

describe('Pangular Inspector hub MCP route', () => {
  it('stays open when the hub runs without auth', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = await bootMcp({ auth: false });
    expect((await mcp()).status).toBe(200);
    expect(log.mock.calls.flat().join('\n')).not.toContain('MCP token');
  });

  it('requires the token from PANGULAR_MCP_TOKEN when auth is on', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', 'env-secret');
    const mcp = await bootMcp({});
    expect((await mcp()).status).toBe(401);
    expect((await mcp('wrong')).status).toBe(401);
    const allowed = await mcp('env-secret');
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('pangular_get-routes');
  });

  it('prints a generated token when none is configured', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = await bootMcp({ auth: true });
    const token = /MCP token: (\S+)/.exec(log.mock.calls.flat().join('\n'))?.[1];
    expect(token).toMatch(/^[\w-]{32}$/);
    expect((await mcp()).status).toBe(401);
    expect((await mcp(token)).status).toBe(200);
  });

  it('keeps the token and the mcp setting next to the devtools config', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', 'env-secret');
    const guarded = await bootMcp({ inspectors: { http: false }, agent: { readOnly: true } });
    expect((await guarded()).status).toBe(401);
    expect((await guarded('env-secret')).status).toBe(200);
    const own = await bootMcp({
      mcp: { authorization: 'own-secret' },
      limits: { refreshMs: 1000 },
    });
    expect((await own('env-secret')).status).toBe(401);
    expect((await own('own-secret')).status).toBe(200);
  });

  it('keeps an explicit mcp setting', async () => {
    const mcp = await bootMcp({ auth: true, mcp: { authorization: 'own-secret' } });
    expect((await mcp()).status).toBe(401);
    expect((await mcp('own-secret')).status).toBe(200);
  });
});

function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

describe('Pangular Inspector hub on a server that reloads server.ts', () => {
  it('keeps the generated token and closes the previous hub', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const boot = async () => {
      const hub = initPangularHub({
        cwd: makeProject({ 'package.json': '{}' }),
        ws: { sidecar: true },
        auth: true,
        allowedOrigins: false,
      });
      hubs.push(hub);
      await hub.ready;
      const meta = hub.connectionMeta() as { websocket: { port: number } };
      return { hub, port: meta.websocket.port };
    };
    const first = await boot();
    const second = await boot();
    await first.hub.close();
    const tokens = log.mock.calls
      .flat()
      .join('\n')
      .match(/MCP token: \S+/g);
    expect(tokens).toHaveLength(1);
    const token = tokens![0].slice('MCP token: '.length);
    const mcp = await second.hub.handler(
      new Request('http://localhost/__devframes/__mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
    );
    expect(mcp.status).toBe(200);
    expect(await listening(second.port)).toBe(true);
    if (first.port !== second.port) expect(await listening(first.port)).toBe(false);
  });
});
