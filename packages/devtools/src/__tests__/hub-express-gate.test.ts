import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hubEnabled, hubGatePolicy, hubDefaultOrigins, initPangularHub } from '../hub.ts';
import { isAllowedHubRequest } from '../hub-gate.ts';
import { makeProject } from './analog-fixture.ts';

const hubs: { close: () => Promise<void> }[] = [];
const servers: Server[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const hub of hubs.splice(0)) await hub.close();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

async function expressLike() {
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    auth: false,
  });
  hubs.push(hub);
  await hub.ready;
  const server = createServer((req, res) =>
    hub.nodeMiddleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return (headers: Record<string, string>, path = '/__devframes/__connection.json') =>
    new Promise<number>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path, headers }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
}

function fakeRequest(remoteAddress: string, headers: Record<string, string>) {
  return {
    url: '/__devframes/__connection.json',
    headers,
    socket: { remoteAddress },
  } as never;
}

describe('the Express hub request gate', () => {
  it('refuses a request sent to a foreign Host and answers localhost', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = await expressLike();
    expect(await get({ host: 'evil.test' })).toBe(403);
    expect(await get({ host: 'localhost:4000' })).toBe(200);
  });

  it('refuses a cross-site request without Origin and answers a same-origin one', async () => {
    const get = await expressLike();
    expect(await get({ host: 'localhost:4000', 'sec-fetch-site': 'cross-site' })).toBe(403);
    expect(await get({ host: 'localhost:4000', 'sec-fetch-site': 'same-origin' })).toBe(200);
    expect(await get({ host: 'localhost:4000' })).toBe(200);
  });

  it('applies the Host, Origin and Sec-Fetch-Site checks to the web handler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      auth: false,
    });
    hubs.push(hub);
    await hub.ready;
    const get = (url: string, headers: Record<string, string> = {}) =>
      hub.handler(new Request(url, { headers })).then((res) => res.status);
    expect(await get('http://evil.test/__devframes/__connection.json')).toBe(403);
    expect(
      await get('http://localhost:4000/__devframes/__connection.json', {
        'sec-fetch-site': 'cross-site',
      }),
    ).toBe(403);
    expect(
      await get('http://localhost:4000/__devframes/__connection.json', {
        origin: 'https://evil.example',
      }),
    ).toBe(403);
    expect(await get('http://localhost:4000/__devframes/__connection.json')).toBe(200);
  });

  it('leaves routes outside the hub alone', async () => {
    const get = await expressLike();
    expect(await get({ host: 'evil.test' }, '/products')).toBe(404);
  });

  it('refuses other machines unless allowLan is on, and keeps the origin check then', () => {
    const local = hubGatePolicy(hubDefaultOrigins)!;
    const lan = hubGatePolicy(hubDefaultOrigins, true)!;
    const phone = fakeRequest('192.168.1.30', { host: '192.168.1.20:4000' });
    expect(isAllowedHubRequest(phone, local)).toBe(false);
    expect(isAllowedHubRequest(phone, lan)).toBe(true);
    const ios = fakeRequest('192.168.1.30', {
      host: '192.168.1.20:4000',
      origin: 'capacitor://localhost',
    });
    expect(isAllowedHubRequest(ios, lan)).toBe(true);
    const evil = fakeRequest('192.168.1.30', {
      host: '192.168.1.20:4000',
      origin: 'https://evil.example',
    });
    expect(isAllowedHubRequest(evil, lan)).toBe(false);
  });

  it('answers 403 to another machine through the middleware', () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', 'express-gate-test-value');
    const hub = initPangularHub({ cwd: makeProject({ 'package.json': '{}' }), ws: false });
    hubs.push(hub);
    const res = { statusCode: 200, end: vi.fn() };
    const next = vi.fn();
    hub.nodeMiddleware(
      fakeRequest('192.168.1.30', { host: '192.168.1.20:4000' }),
      res as never,
      next,
    );
    expect(res.statusCode).toBe(403);
    expect(String(res.end.mock.calls[0][0])).toContain('allowLan: true');
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores allowLan with auth: false, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      auth: false,
      allowLan: true,
    });
    hubs.push(hub);
    const res = { statusCode: 200, end: vi.fn() };
    hub.nodeMiddleware(
      fakeRequest('192.168.1.30', { host: '192.168.1.20:4000' }),
      res as never,
      vi.fn(),
    );
    expect(res.statusCode).toBe(403);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring allowLan'));
  });

  it('gates the upgrades of a server given to attach() or the server option', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const shared of [false, true]) {
      const server = createServer((_req, res) => res.end());
      servers.push(server);
      const hub = initPangularHub({
        cwd: makeProject({ 'package.json': '{}' }),
        auth: false,
        ...(shared ? { server } : {}),
      });
      hubs.push(hub);
      if (!shared) hub.attach(server);
      await hub.ready;
      const [listener] = server.listeners('upgrade');
      const upgrade = (url: string, remoteAddress: string, host: string) => {
        const socket = { remoteAddress, destroy: vi.fn() };
        const req = { url, headers: { host }, socket };
        listener!.call(server, req, socket, Buffer.alloc(0));
        return socket.destroy;
      };
      expect(server.listeners('upgrade')).toHaveLength(1);
      expect(upgrade('/__devframes/__ws', '127.0.0.1', 'evil.test')).toHaveBeenCalled();
      expect(upgrade('/__devframes/__ws', '192.168.1.30', '192.168.1.20:4000')).toHaveBeenCalled();
      // Upgrades outside the hub, such as a dev server's own socket, are left alone.
      expect(upgrade('/hmr', '192.168.1.30', 'evil.test')).not.toHaveBeenCalled();
    }
  });

  it('turns the gate off with allowedOrigins: false', () => {
    expect(hubGatePolicy(false)).toBeUndefined();
  });
});

describe('the Express hub in production', () => {
  it('is off when NODE_ENV is production, and its middlewares only call next', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const hub = initPangularHub({ cwd: makeProject({ 'package.json': '{}' }), ws: false });
    hubs.push(hub);
    expect(hub.enabled).toBe(false);
    expect((globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__).toBeUndefined();
    const next = vi.fn();
    const req = fakeRequest('127.0.0.1', { host: 'localhost:4000' });
    hub.nodeMiddleware(req, {} as never, next);
    hub.ssrMiddleware(req, {} as never, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect((await hub.handler(new Request('http://localhost/__devframes/'))).status).toBe(404);
    await expect(hub.context).rejects.toThrow('hub is off');
  });

  it('warns loudly when forced on in production', () => {
    const warn = vi.fn();
    expect(hubEnabled(true, { NODE_ENV: 'production' }, warn)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NODE_ENV=production'));
  });

  it('is on by default outside production, and can be turned off', () => {
    const warn = vi.fn();
    expect(hubEnabled(undefined, {}, warn)).toBe(true);
    expect(hubEnabled(undefined, { NODE_ENV: 'development' }, warn)).toBe(true);
    expect(hubEnabled(false, {}, warn)).toBe(false);
    expect(hubEnabled(undefined, { NODE_ENV: 'production' }, warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is off in a production Angular build without NODE_ENV, where ngDevMode is false', () => {
    const warn = vi.fn();
    expect(hubEnabled(undefined, {}, warn, false)).toBe(false);
    expect(hubEnabled(undefined, {}, warn, true)).toBe(true);
    expect(hubEnabled(true, {}, warn, false)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('production build'));
  });

  it('starts when forced on in production, with the warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      auth: false,
      enabled: true,
    });
    hubs.push(hub);
    await hub.ready;
    expect(hub.enabled).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('on in production'));
  });
});
