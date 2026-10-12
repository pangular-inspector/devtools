import { Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  hubRequestGate,
  hubUpgradeListener,
  isAllowedHubHost,
  isAllowedHubRequest,
  type HubOriginPolicy,
} from '../hub-gate.ts';

type Headers = Record<string, string>;

function req(headers: Headers, remoteAddress = '127.0.0.1', url = '/__devframes/__sse') {
  return { url, headers, socket: { remoteAddress } } as never;
}

function status(headers: Headers, policy: HubOriginPolicy = {}, remoteAddress = '127.0.0.1') {
  const res = { statusCode: 200, end: vi.fn() };
  const next = vi.fn();
  hubRequestGate('/__devframes/', policy)(req(headers, remoteAddress), res as never, next);
  return next.mock.calls.length ? 'next' : res.statusCode;
}

describe('the Host check', () => {
  it('refuses a loopback request sent to a foreign Host, as after a DNS rebind', () => {
    expect(status({ host: 'evil.test' })).toBe(403);
    expect(status({ host: 'evil.test:5173' })).toBe(403);
    expect(status({ host: '127.0.0.1.evil.test:5173' })).toBe(403);
    expect(status({ host: 'evil.test', origin: 'http://localhost:5173' })).toBe(403);
  });

  it('accepts loopback hosts and requests without a Host header', () => {
    for (const host of ['localhost:5173', '127.0.0.1:4000', '[::1]:4000', 'app.localhost']) {
      expect(status({ host })).toBe('next');
    }
    expect(status({})).toBe('next');
  });

  it('accepts hosts from allowedHosts and from listed origins', () => {
    expect(status({ host: 'myapp.test:5173' }, { allowedHosts: ['myapp.test'] })).toBe('next');
    expect(status({ host: 'a.myapp.test' }, { allowedHosts: ['.myapp.test'] })).toBe('next');
    expect(status({ host: 'evil.test' }, { allowedHosts: true })).toBe('next');
    expect(status({ host: 'tunnel.example' }, { allowedOrigins: ['https://tunnel.example'] })).toBe(
      'next',
    );
    expect(
      isAllowedHubHost('tunnel.example', {
        isAllowedOrigin: (origin) => origin === 'https://tunnel.example',
      }),
    ).toBe(true);
    expect(isAllowedHubHost('evil.test', { isAllowedOrigin: () => false })).toBe(false);
  });

  it('refuses a Host header that is not a plain host and port', () => {
    expect(isAllowedHubHost('localhost@evil.test')).toBe(false);
    expect(isAllowedHubHost('localhost/evil')).toBe(false);
  });

  it('reports the refused host once', () => {
    const blocked = vi.fn();
    expect(isAllowedHubRequest(req({ host: 'evil.test' }), {}, blocked)).toBe(false);
    expect(blocked).toHaveBeenCalledWith('evil.test', 'host');
  });
});

describe('the Sec-Fetch-Site check', () => {
  it('refuses a cross-site browser request without Origin', () => {
    expect(status({ host: 'localhost:5173', 'sec-fetch-site': 'cross-site' })).toBe(403);
  });

  it('accepts a request without Origin from the same origin, the same site or the address bar', () => {
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect(status({ host: 'localhost:5173', 'sec-fetch-site': site })).toBe('next');
    }
  });

  it('accepts a request without Origin or Sec-Fetch-Site, as curl or a native app sends', () => {
    expect(status({ host: 'localhost:5173' })).toBe('next');
  });

  it('leaves requests with an Origin to the origin check', () => {
    expect(
      status({
        host: 'localhost:5173',
        origin: 'http://localhost:4200',
        'sec-fetch-site': 'same-site',
      }),
    ).toBe('next');
  });

  it('applies to requests from other machines too', () => {
    const lan = { lan: true, allowedOrigins: ['http://192.168.1.20:5173'] };
    expect(status({ host: '192.168.1.20:5173' }, lan, '192.168.1.30')).toBe('next');
    expect(
      status({ host: '192.168.1.20:5173', 'sec-fetch-site': 'cross-site' }, lan, '192.168.1.30'),
    ).toBe(403);
  });
});

describe('the upgrade gate', () => {
  it('destroys a hub upgrade sent to a foreign Host', () => {
    const server = new Server();
    const hub = vi.fn();
    server.on('upgrade', hubUpgradeListener('/__devframes/', {}, hub));
    const socket = { destroy: vi.fn() };
    server.emit(
      'upgrade',
      req(
        { host: 'evil.test:5173', origin: 'http://localhost:5173' },
        '127.0.0.1',
        '/__devframes/__ws',
      ),
      socket,
      Buffer.alloc(0),
    );
    expect(socket.destroy).toHaveBeenCalled();
    expect(hub).not.toHaveBeenCalled();
  });
});
