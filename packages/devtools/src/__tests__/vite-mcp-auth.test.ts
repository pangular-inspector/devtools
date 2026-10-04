import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangularVite from '../vite.ts';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

const servers: Server[] = [];

async function devServer(allowedHosts?: readonly string[] | true) {
  const middlewares: Middleware[] = [];
  const httpServer = createServer((req, res) => {
    const run = (i: number): void => {
      const middleware = middlewares[i];
      if (!middleware) {
        res.statusCode = 404;
        res.end();
        return;
      }
      middleware(req, res, () => run(i + 1));
    };
    run(0);
  });
  servers.push(httpServer);
  const plugin = pangularVite({ apiPrefix: 'api' });
  (plugin.configureServer as (server: unknown) => void)({
    config: { root: process.cwd(), server: { allowedHosts } },
    middlewares: { use: (middleware: Middleware) => middlewares.push(middleware) },
    httpServer,
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  return (token?: string) =>
    fetch(`http://127.0.0.1:${port}/__devframes/__mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        origin: `http://localhost:${port}`,
        ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('pangularVite MCP route', () => {
  it('stays open for a purely local dev server', async () => {
    const mcp = await devServer();
    expect((await mcp()).status).toBe(200);
  });

  it('asks for the MCP token once a tunnel host is allowed', async () => {
    vi.stubEnv('PANGULAR_MCP_TOKEN', 'tunnel-secret');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const mcp = await devServer(['abc.trycloudflare.com']);
    expect((await mcp()).status).toBe(401);
    expect((await mcp('wrong')).status).toBe(401);
    expect((await mcp('tunnel-secret')).status).toBe(200);
  });
});
