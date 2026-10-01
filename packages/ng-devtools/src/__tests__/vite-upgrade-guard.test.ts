import { Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  hubOriginRegistry,
  hubRequestGate,
  hubUpgradeListener,
  isAllowedHubOrigin,
  isHubPath,
} from '../vite.ts';

function upgrade(server: Server, remoteAddress: string, url = '/__devframes/ws', origin?: string) {
  const socket = { destroy: vi.fn() };
  const headers = origin === undefined ? {} : { origin };
  server.emit('upgrade', { url, headers, socket: { remoteAddress } }, socket, Buffer.alloc(0));
  return socket;
}

function guarded() {
  const server = new Server();
  const hub = vi.fn();
  server.on('upgrade', hubUpgradeListener('/__devframes/', {}, hub));
  return { server, hub };
}

function request(
  url: string,
  remoteAddress = '127.0.0.1',
  origin?: string,
  base = '/__devframes/',
) {
  const res = { statusCode: 200, end: vi.fn() };
  const next = vi.fn();
  const headers = origin === undefined ? {} : { origin };
  hubRequestGate(base)({ url, headers, socket: { remoteAddress } } as never, res as never, next);
  return { status: next.mock.calls.length ? 'next' : res.statusCode };
}

describe('hubUpgradeListener', () => {
  it('only hands loopback hub upgrades to the hub and leaves the rest to Vite', () => {
    const server = new Server();
    const vite = vi.fn();
    server.on('upgrade', vite);
    const hub = vi.fn();
    server.on('upgrade', hubUpgradeListener('/__devframes/', {}, hub));

    const remote = upgrade(server, '192.168.1.20');
    expect(hub).not.toHaveBeenCalled();
    expect(remote.destroy).toHaveBeenCalled();
    expect(vite).toHaveBeenCalledTimes(1);

    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) upgrade(server, address);
    expect(hub).toHaveBeenCalledTimes(3);

    const hmr = upgrade(server, '192.168.1.20', '/?token=abc');
    expect(hmr.destroy).not.toHaveBeenCalled();
    expect(hub).toHaveBeenCalledTimes(3);
    expect(vite).toHaveBeenCalledTimes(5);
  });

  it('guards a base written without slashes', () => {
    const hub = vi.fn();
    const server = new Server();
    server.on('upgrade', hubUpgradeListener('devtools', {}, hub));
    expect(upgrade(server, '10.0.0.5', '/devtools/__ws').destroy).toHaveBeenCalled();
    upgrade(server, '127.0.0.1', '/devtools/__ws');
    expect(hub).toHaveBeenCalledTimes(1);
  });

  it('refuses hub upgrades from a web page on another origin, even over loopback', () => {
    const { server, hub } = guarded();
    const evil = upgrade(server, '127.0.0.1', '/__devframes/__ws', 'https://evil.example');
    expect(evil.destroy).toHaveBeenCalled();
    for (const origin of ['http://127.attacker.example', 'null', 'file://']) {
      expect(upgrade(server, '127.0.0.1', '/__devframes/__ws', origin).destroy).toHaveBeenCalled();
    }
    expect(hub).not.toHaveBeenCalled();

    for (const origin of [
      'http://localhost:5173',
      'https://127.0.0.1:4200',
      'http://[::1]:3000',
      'chrome-extension://abcdefghijklmnop',
      undefined,
    ]) {
      expect(
        upgrade(server, '127.0.0.1', '/__devframes/__ws', origin).destroy,
      ).not.toHaveBeenCalled();
    }
    expect(hub).toHaveBeenCalledTimes(5);
  });

  it('normalizes the path before deciding whether an upgrade targets the hub', () => {
    const { server, hub } = guarded();
    for (const url of [
      '/./__devframes/__ws',
      '/x/../__devframes/__ws',
      '/%2e/__devframes/__ws',
      '/__devframes',
    ]) {
      expect(upgrade(server, '192.168.1.20', url).destroy).toHaveBeenCalled();
    }
    expect(hub).not.toHaveBeenCalled();
  });
});

describe('hub origin policy', () => {
  it('allows loopback http(s) pages and the extension, and rejects other sites', () => {
    expect(isAllowedHubOrigin(undefined)).toBe(true);
    expect(isAllowedHubOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedHubOrigin('chrome-extension://abcdefghijklmnop')).toBe(true);
    expect(isAllowedHubOrigin('https://evil.example')).toBe(false);
    expect(isAllowedHubOrigin('ws://localhost:5173')).toBe(false);
    expect(hubOriginRegistry.isAllowed('https://evil.example')).toBe(false);
    expect(hubOriginRegistry.isAllowed('http://127.0.0.1:9777')).toBe(true);
  });
});

describe('hubRequestGate', () => {
  it('forbids hub requests from other machines, including dot-segment and encoded paths', () => {
    for (const url of [
      '/__devframes/__mcp',
      '/./__devframes/__mcp',
      '/a/../__devframes/__mcp',
      '/%2e/__devframes/__sse',
      '/__devframes',
    ]) {
      expect(request(url, '192.168.1.20')).toEqual({ status: 403 });
    }
    expect(request('/src/main.ts', '192.168.1.20')).toEqual({ status: 'next' });
  });

  it('forbids hub requests carrying a foreign Origin from this machine', () => {
    expect(request('/__devframes/__sse', '127.0.0.1', 'https://evil.example')).toEqual({
      status: 403,
    });
    expect(request('/./__devframes/__sse', '127.0.0.1', 'https://evil.example')).toEqual({
      status: 403,
    });
    expect(request('/__devframes/__sse', '127.0.0.1', 'http://localhost:5173')).toEqual({
      status: 'next',
    });
    expect(request('/__devframes/__mcp', '::1')).toEqual({ status: 'next' });
    expect(request('/src/main.ts', '127.0.0.1', 'https://evil.example')).toEqual({
      status: 'next',
    });
  });

  it('hides connection files outside the hub base', () => {
    expect(request('/other/__connection.json')).toEqual({ status: 404 });
    expect(request('/__devframes/__connection.json')).toEqual({ status: 'next' });
  });

  it('gates the same paths whether or not base has leading and trailing slashes', () => {
    for (const base of ['devtools', 'devtools/', '/devtools', '/devtools/']) {
      expect(request('/devtools/__mcp', '10.0.0.5', undefined, base), base).toEqual({
        status: 403,
      });
      expect(request('/devtools', '10.0.0.5', undefined, base), base).toEqual({ status: 403 });
      expect(request('/devtools/__connection.json', '127.0.0.1', undefined, base), base).toEqual({
        status: 'next',
      });
      expect(request('/devtoolsx/page', '10.0.0.5', undefined, base), base).toEqual({
        status: 'next',
      });
    }
  });
});

describe('isHubPath', () => {
  it('matches the base itself and paths under it, not paths that only share a prefix', () => {
    for (const base of ['devtools', 'devtools/', '/devtools', '/devtools/']) {
      expect(isHubPath('/devtools', base), base).toBe(true);
      expect(isHubPath('/devtools/', base), base).toBe(true);
      expect(isHubPath('/devtools/__mcp', base), base).toBe(true);
      expect(isHubPath('/devtoolsx', base), base).toBe(false);
      expect(isHubPath('/devtoolsx/__mcp', base), base).toBe(false);
    }
  });
});

describe('hub origin policy', () => {
  it('trusts hosts from Vite allowedHosts and explicit origins, and nothing else', async () => {
    const { isAllowedHubOrigin } = await import('../vite.ts');
    const policy = {
      allowedHosts: ['myapp.test', '.dev.local'] as const,
      allowedOrigins: ['https://tunnel.example:8443'],
    };
    expect(isAllowedHubOrigin('http://myapp.test:5173', policy)).toBe(true);
    expect(isAllowedHubOrigin('http://api.dev.local:5173', policy)).toBe(true);
    expect(isAllowedHubOrigin('http://dev.local', policy)).toBe(true);
    expect(isAllowedHubOrigin('https://tunnel.example:8443', policy)).toBe(true);
    expect(isAllowedHubOrigin('https://tunnel.example', policy)).toBe(false);
    expect(isAllowedHubOrigin('http://myapp.test.evil.example', policy)).toBe(false);
    expect(isAllowedHubOrigin('https://evil.example', policy)).toBe(false);
    expect(isAllowedHubOrigin('http://myapp.test:5173')).toBe(false);
    expect(isAllowedHubOrigin('https://evil.example', { allowedHosts: true })).toBe(true);
  });
});
