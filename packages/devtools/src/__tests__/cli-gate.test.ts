import { describe, expect, it, vi } from 'vitest';
import { cliGatePolicy, cliRequestGate, gatedDevApp } from '../cli-gate.ts';

const EVIL = 'http://evil.example';

function nodeEvent(headers: Record<string, string>, remoteAddress = '127.0.0.1') {
  const req = { url: '/__connection.json', headers, socket: { remoteAddress } };
  return {
    req: {
      url: `http://localhost:4300/__connection.json`,
      headers: new Headers(headers),
      runtime: { node: { req: req as never } },
    },
  };
}

describe('pangular dev request gate', () => {
  const gate = cliRequestGate(cliGatePolicy(['http://192.168.1.20:8100'], 'localhost'));
  const status = (headers: Record<string, string>, remote?: string) =>
    gate(nodeEvent({ host: 'localhost:4300', ...headers }, remote))?.status ?? 200;

  it('answers a plain local request and a listed origin', () => {
    expect(status({})).toBe(200);
    expect(status({ origin: 'http://localhost:4300' })).toBe(200);
    expect(status({ origin: 'http://192.168.1.20:8100' })).toBe(200);
    expect(status({ 'sec-fetch-site': 'same-origin' })).toBe(200);
  });

  it('refuses a foreign origin, a rebinding host, Origin null and a cross-site request', () => {
    expect(status({ origin: EVIL })).toBe(403);
    expect(status({ origin: 'null' })).toBe(403);
    expect(status({ origin: 'http://localhost.evil.example' })).toBe(403);
    expect(status({ host: 'evil.example' })).toBe(403);
    expect(status({ host: 'evil.example:80', origin: 'http://evil.example:80' })).toBe(403);
    expect(status({ 'sec-fetch-site': 'cross-site' })).toBe(403);
  });

  it('answers the Android emulator, which reaches this machine at 10.0.2.2', () => {
    // The emulator forwards 10.0.2.2 (Genymotion: 10.0.3.2) to the host's loopback.
    expect(status({ host: '10.0.2.2:4300' })).toBe(200);
    expect(status({ host: '10.0.3.2:4300' })).toBe(200);
    // Only from loopback, and a foreign Origin is still refused.
    expect(status({ host: '10.0.2.2:4300' }, '10.0.2.15')).toBe(403);
    expect(status({ host: '10.0.2.2:4300', origin: EVIL })).toBe(403);
    expect(status({ host: '10.0.2.2:4300', 'sec-fetch-site': 'cross-site' })).toBe(403);
    expect(status({ host: '10.0.2.3:4300' })).toBe(403);
  });

  it('refuses other machines unless the server listens on the network', () => {
    expect(status({}, '192.168.1.30')).toBe(403);
    const lan = cliRequestGate(cliGatePolicy([], '0.0.0.0'));
    const remote = nodeEvent({ host: '192.168.1.20:4300' }, '192.168.1.30');
    expect(lan(remote)).toBeUndefined();
    const evil = nodeEvent({ host: '192.168.1.20:4300', origin: EVIL }, '192.168.1.30');
    expect(lan(evil)?.status).toBe(403);
  });

  it("answers the app's dev server named by --proxy-origin when it keeps Origin and Host", () => {
    const proxied = { host: 'myapp.test:4200', origin: 'http://myapp.test:4200' };
    expect(cliRequestGate(cliGatePolicy([], 'localhost'))(nodeEvent(proxied))?.status).toBe(403);
    const gate = cliRequestGate(
      cliGatePolicy([], 'localhost', 'http://myapp.test:4200/__pangular/'),
    );
    expect(gate(nodeEvent(proxied))).toBeUndefined();
    expect(gate(nodeEvent({ host: 'myapp.test:4200' }))).toBeUndefined();
    expect(gate(nodeEvent({ host: 'myapp.test:4200', origin: EVIL }))?.status).toBe(403);
    expect(gate(nodeEvent({ host: 'evil.example', origin: EVIL }))?.status).toBe(403);
  });

  it('runs in front of the routes of the dev server app', async () => {
    const warn = vi.fn();
    const app = (await gatedDevApp(cliGatePolicy([], 'localhost'), warn)) as unknown as {
      use(fn: () => Response): void;
      fetch(request: Request): Promise<Response>;
    };
    app.use(() => new Response('{}'));
    const ok = await app.fetch(new Request('http://localhost:4300/__connection.json'));
    expect(ok.status).toBe(200);
    const refused = await app.fetch(
      new Request('http://localhost:4300/__connection.json', { headers: { origin: EVIL } }),
    );
    expect(refused.status).toBe(403);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(EVIL));
  });
});
