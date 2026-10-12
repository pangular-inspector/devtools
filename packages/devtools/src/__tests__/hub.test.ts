import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hubDefaultOrigins, initPangularHub, type PangularHubOptions } from '../hub.ts';
import { httpRegistry } from '../http-rules.ts';
import { writeTokenOnce } from '../mcp-token.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const hubs: { close: () => Promise<void> }[] = [];

async function boot(cwd: string) {
  const hub = initPangularHub({ cwd, ws: false, auth: false, allowedOrigins: false });
  hubs.push(hub);
  await hub.ready;
  const ctx = await hub.context;
  const docks = [...ctx.docks.views.values()].map((dock) => ({
    id: dock.id,
    type: dock.type,
    title: dock.title,
    defaultChildId: 'defaultChildId' in dock ? dock.defaultChildId : undefined,
    url: 'url' in dock ? dock.url : undefined,
    frameId: 'frameId' in dock ? dock.frameId : undefined,
    defaultOrder: dock.defaultOrder ?? 0,
    badge: dock.badge,
    badgeVariant: dock.badgeVariant,
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
  it('adds an All tools dock first, then a dock per tool, Analog included even outside Analog apps', async () => {
    const { docks } = await boot(makeProject({ 'package.json': '{}' }));
    const ours = docks.filter((d) => d.id.startsWith('pangular:') && d.type !== 'group');
    // The rail puts lower orders first.
    const rail = [...ours].sort((a, b) => a.defaultOrder - b.defaultOrder);
    expect(rail.map((d) => [d.id, d.url])).toEqual([
      ['pangular:all', '/__devframes/pangular/'],
      ['pangular:angular', '/__devframes/pangular/?view=angular'],
      ['pangular:ngrx', '/__devframes/pangular/?view=ngrx'],
      ['pangular:analog', '/__devframes/pangular/?view=analog'],
      ['pangular:angular-native', '/__devframes/pangular/?view=angular-native'],
      ['pangular:nativescript', '/__devframes/pangular/?view=nativescript'],
      ['pangular:capacitor', '/__devframes/pangular/?view=capacitor'],
    ]);
    expect(rail[0].title).toBe('All tools');
    expect(ours.filter((d) => d.title.endsWith('Coming Soon'))).toEqual([]);
    // One rail button for all of them: the Pangular group, which opens All tools.
    expect(ours.every((d) => d.groupId === 'pangular:group')).toBe(true);
    expect(docks.find((d) => d.id === 'pangular:group')).toMatchObject({
      type: 'group',
      title: 'Pangular',
      defaultChildId: 'pangular:all',
    });
    expect(new Set(ours.map((d) => d.frameId))).toEqual(new Set(['pangular']));
    expect(docks.find((d) => d.id === 'pangular')?.visibility).toBe('false');
  });

  it('titles the docks of tools with nothing to show with the reason, and adds no badge', async () => {
    const { docks } = await boot(makeProject({ 'package.json': '{}' }));
    const status = Object.fromEntries(
      docks
        .filter((d) => d.id.startsWith('pangular:') && d.type !== 'group')
        .map((d) => [d.id, [d.title, d.badge, d.badgeVariant]]),
    );
    // The hub fades a badge with its button, so it would fail axe and cover the icon.
    // A badge only counts unseen messages, and there are none yet.
    expect(status).toEqual({
      'pangular:all': ['All tools', undefined, undefined],
      'pangular:angular': ['Angular', undefined, undefined],
      'pangular:ngrx': ['NgRx', undefined, undefined],
      'pangular:analog': ['Analog: not an Analog app', undefined, undefined],
      'pangular:angular-native': ['Angular Native: no app connected', undefined, undefined],
      'pangular:nativescript': ['NativeScript', undefined, undefined],
      'pangular:capacitor': ['Capacitor: no app connected', undefined, undefined],
    });
  });

  it('shows the Analog dock plainly in an Analog app', async () => {
    const { docks } = await boot(makeProject(BASE_FILES));
    const analog = docks.find((d) => d.id === 'pangular:analog');
    expect([analog?.title, analog?.badge]).toEqual(['Analog', undefined]);
  });

  it('restores the plain title while the tool reports and puts the reason back when the data goes', async () => {
    const { ctx } = await boot(makeProject({ 'package.json': '{}' }));
    const update = vi.spyOn(ctx.docks, 'update');
    const dock = (id: string) => {
      const entry = ctx.docks.views.get(id);
      return [entry?.title, entry?.badge];
    };
    const invoke = (name: string, arg: unknown) =>
      ctx.rpc.invokeLocal(name as never, ...([arg] as never));
    const capacitor = {
      pageId: 'cap1',
      url: '/',
      title: 'App',
      full: true,
      info: {
        platform: 'android',
        native: true,
        bridge: true,
        webCalls: false,
        env: { serverUrl: '', debug: false, logging: false, capacitorHttp: false, userAgent: 'UA' },
        plugins: [],
      },
      calls: [],
      listeners: [],
      dropped: 0,
    };

    await invoke('pangular:push-capacitor', capacitor);
    expect(dock('pangular:capacitor')).toEqual(['Capacitor', undefined]);
    expect(update).toHaveBeenCalledTimes(1);
    // More reports from the same app change nothing on the rail.
    await invoke('pangular:push-capacitor', { ...capacitor, title: 'Trips' });
    expect(update).toHaveBeenCalledTimes(1);

    await invoke('pangular:push-component-tree', {
      pageId: 'an42',
      roots: [],
      count: 0,
      detail: null,
      platform: 'angular-native',
    });
    expect(dock('pangular:angular-native')).toEqual(['Angular Native', undefined]);
    // A browser page is no Angular Native app.
    await invoke('pangular:push-component-tree', { pageId: 'web1', roots: [], count: 0 });
    expect(update).toHaveBeenCalledTimes(2);

    await invoke('pangular:forget-capacitor-page', 'cap1');
    expect(dock('pangular:capacitor')).toEqual(['Capacitor: no app connected', undefined]);
    await invoke('pangular:forget-component-page', 'an42');
    expect(dock('pangular:angular-native')).toEqual([
      'Angular Native: no app connected',
      undefined,
    ]);
    expect(update).toHaveBeenCalledTimes(4);
  });

  it('posts NG errors to the hub messages and counts them on the dock until it is opened', async () => {
    const { ctx } = await boot(makeProject({ 'package.json': '{}' }));
    const invoke = (name: string, arg: unknown) =>
      ctx.rpc.invokeLocal(name as never, ...([arg] as never));
    const report = {
      pageId: 'pg1',
      forms: [],
      events: [],
      setupErrors: ['NG01050: formControlName must be used with a parent formGroup directive'],
    };
    await invoke('pangular:push-forms', report);
    await invoke('pangular:push-forms', report);
    await vi.waitFor(() => expect(ctx.messages.entries.size).toBe(1));
    const [message] = [...ctx.messages.entries.values()];
    expect(message).toMatchObject({
      level: 'error',
      category: 'runtime',
      message: 'NG01050: formControlName must be used with a parent formGroup directive',
      labels: ['pangular', 'page:pg1'],
    });
    const badge = (id: string) => ctx.docks.views.get(id)?.badge;
    expect([badge('pangular:angular'), badge('pangular:group')]).toEqual(['1', '1']);
    await invoke('pangular:hub-dock-seen', 'pangular:angular');
    expect([badge('pangular:angular'), badge('pangular:group')]).toEqual([undefined, undefined]);
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

  it('writes a generated token to a file only the user can read, and prints the path only', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', '');
    const file = join(mkdtempSync(join(tmpdir(), 'pangular-token-')), 'nested', 'mcp-token');
    vi.stubEnv('PANGULAR_MCP_TOKEN_FILE', file);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = await bootMcp({ auth: true });
    const token = readFileSync(file, 'utf8').trim();
    expect(token).toMatch(/^[\w-]{32}$/);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
    const printed = log.mock.calls.flat().join('\n');
    expect(printed).toContain(file);
    expect(printed).not.toContain(token);
    expect((await mcp()).status).toBe(401);
    expect((await mcp(token)).status).toBe(200);
  });

  it('reuses the token in the file across restarts and tightens its mode', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', '');
    const file = join(mkdtempSync(join(tmpdir(), 'pangular-token-')), 'mcp-token');
    const saved = ['kept', 'across', 'restarts', 'x'.repeat(8)].join('-');
    writeFileSync(file, `${saved}\n`, { mode: 0o644 });
    vi.stubEnv('PANGULAR_MCP_TOKEN_FILE', file);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = await bootMcp({});
    expect((await mcp(saved)).status).toBe(200);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('keeps the token another server wrote first, so both servers share one token', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pangular-token-'));
    const file = join(dir, 'mcp-token');
    expect(writeTokenOnce(file, 'first-server-token-0001')).toBe('first-server-token-0001');
    // The second server read no file, then the first one wrote it before the second could.
    expect(writeTokenOnce(file, 'second-server-token-002')).toBe('first-server-token-0001');
    expect(readFileSync(file, 'utf8').trim()).toBe('first-server-token-0001');
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
    // A file without a valid token is replaced.
    writeFileSync(file, 'bad\n');
    expect(writeTokenOnce(file, 'third-server-token-0003')).toBe('third-server-token-0003');
    expect(readFileSync(file, 'utf8').trim()).toBe('third-server-token-0003');
    expect(readdirSync(dir)).toEqual(['mcp-token']);
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

  it('sends each tool tier to MCP clients as read-only and destructive hints', async () => {
    type Listed = {
      name: string;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
    };
    const list = async (options: PangularHubOptions) => {
      const response = await (await bootMcp({ auth: false, ...options }))();
      const text = await response.text();
      const json = text.startsWith('{') ? text : /^data: (.*)$/m.exec(text)?.[1];
      const tools = (JSON.parse(json ?? '{}') as { result?: { tools?: Listed[] } }).result?.tools;
      return new Map((tools ?? []).map((tool) => [tool.name, tool.annotations ?? {}]));
    };
    const tools = await list({});
    expect(tools.get('pangular_highlight')).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(tools.get('pangular_navigate')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(tools.get('pangular_clear-recordings')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    const readOnly = await list({ agent: { readOnly: true } });
    expect(readOnly.size).toBeGreaterThan(0);
    expect([...readOnly.values()].every((hints) => hints.readOnlyHint === true)).toBe(true);
    expect(readOnly.has('pangular_clear-recordings')).toBe(false);
    expect(readOnly.get('pangular_change-detection')).toMatchObject({ readOnlyHint: true });
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
    expect(
      log.mock.calls
        .flat()
        .join('\n')
        .match(/MCP token: /g),
    ).toHaveLength(1);
    const token = readFileSync(process.env['PANGULAR_MCP_TOKEN_FILE']!, 'utf8').trim();
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

describe('Pangular Inspector hub server state', () => {
  it('turns off server HTTP capture when the hub that owns it closes', async () => {
    const { hub, ctx } = await boot(makeProject({ 'package.json': '{}' }));
    expect(httpRegistry().owner).toBe(ctx);
    expect(typeof httpRegistry().record).toBe('function');
    await hub.close();
    expect(httpRegistry().record).toBeUndefined();
  });

  it('leaves a newer hub its capture when an older one closes', async () => {
    const first = await boot(makeProject({ 'package.json': '{}' }));
    const second = await boot(makeProject({ 'package.json': '{}' }));
    await first.hub.close();
    expect(httpRegistry().owner).toBe(second.ctx);
    expect(typeof httpRegistry().record).toBe('function');
  });
});
