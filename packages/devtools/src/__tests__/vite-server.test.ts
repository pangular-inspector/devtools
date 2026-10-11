import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Duplex } from 'node:stream';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRegistry } from '../http-rules.ts';
import pangularVite from '../vite.ts';

const servers: ViteDevServer[] = [];

async function devServer(config: InlineConfig = {}) {
  const server = await createServer({
    configFile: false,
    root: mkdtempSync(join(tmpdir(), 'pangular-vite-')),
    logLevel: 'silent',
    plugins: [pangularVite({ apiPrefix: 'api' })],
    ...config,
    server: { host: '127.0.0.1', port: 0, ...config.server },
  });
  servers.push(server);
  await server.listen();
  return server;
}

function origin(server: ViteDevServer) {
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const https = Boolean(server.config.server.https);
  return { url: `${https ? 'https' : 'http'}://127.0.0.1:${port}`, port, https };
}

async function connectionMeta(server: ViteDevServer) {
  const { url, https } = origin(server);
  return JSON.parse(
    await new Promise<string>((resolve, reject) => {
      const req = (https ? httpsRequest : httpRequest)(
        `${url}/__devframes/__connection.json`,
        { rejectUnauthorized: false },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () =>
            res.statusCode === 200 ? resolve(body) : reject(new Error(`${res.statusCode}`)),
          );
        },
      );
      req.on('error', reject);
      req.end();
    }),
  ) as { backend: string; websocket?: { path: string; port?: number } };
}

function openSocket(server: ViteDevServer, path: string) {
  const { url, https } = origin(server);
  return new Promise<number>((resolve, reject) => {
    const req = (https ? httpsRequest : httpRequest)(`${url}${path}`, {
      rejectUnauthorized: false,
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': Buffer.from('pangular-ws-test').toString('base64'),
      },
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve(res.statusCode ?? 0);
    });
    req.on('response', (res) => resolve(res.statusCode ?? 0));
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function selfSignedCert() {
  const dir = mkdtempSync(join(tmpdir(), 'pangular-cert-'));
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-keyout',
        join(dir, 'key.pem'),
        '-out',
        join(dir, 'cert.pem'),
      ],
      { stdio: 'ignore' },
    );
  } catch {
    return undefined;
  }
  return { key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) };
}

const cert = selfSignedCert();

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

describe('pangularVite on a real Vite server', () => {
  it('shares the dev server socket and accepts loopback WebSocket upgrades', async () => {
    const server = await devServer();
    const meta = await connectionMeta(server);
    expect(meta.backend).toBe('websocket');
    expect(meta.websocket).toEqual({ path: '/__devframes/__ws' });
    expect(await openSocket(server, meta.websocket!.path)).toBe(101);
  });

  it('refuses a hub upgrade from another machine once the hub is ready', async () => {
    const server = await devServer();
    await connectionMeta(server);
    const written: string[] = [];
    const socket = Object.assign(
      new Duplex({
        read() {},
        write(chunk, _encoding, done) {
          written.push(String(chunk));
          done();
        },
      }),
      { setTimeout() {}, setNoDelay() {}, setKeepAlive() {} },
    );
    const destroy = vi.spyOn(socket, 'destroy');
    server.httpServer!.emit(
      'upgrade',
      {
        method: 'GET',
        url: '/__devframes/__ws',
        headers: {
          host: '192.168.1.105:5194',
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': Buffer.from('pangular-ws-test').toString('base64'),
        },
        socket: { remoteAddress: '192.168.1.105' },
      },
      socket,
      Buffer.alloc(0),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(destroy).toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it.skipIf(!cert)('serves the WebSocket over the same port when Vite uses HTTPS', async () => {
    const server = await devServer({ server: { https: cert } });
    const meta = await connectionMeta(server);
    expect(meta.backend).toBe('websocket');
    expect(meta.websocket).toEqual({ path: '/__devframes/__ws' });
    expect(await openSocket(server, meta.websocket!.path)).toBe(101);
  });

  it('serves a base written without slashes and still gates it', async () => {
    const server = await devServer({ plugins: [pangularVite({ base: 'devtools' })] });
    const { url } = origin(server);
    const response = await fetch(`${url}/devtools/__connection.json`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { websocket: { path: string } }).websocket.path).toBe(
      '/devtools/__ws',
    );
    expect(await openSocket(server, '/devtools/__ws')).toBe(101);
  });

  it('keeps SSR HTTP capture on after a restart', async () => {
    const server = await devServer();
    await connectionMeta(server);
    expect(typeof httpRegistry().record).toBe('function');
    await server.restart();
    await connectionMeta(server);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(typeof httpRegistry().record).toBe('function');
  });
});
