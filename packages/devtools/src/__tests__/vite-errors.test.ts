import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverErrorsRegistry } from '../server-errors.ts';

vi.mock('../hub.ts', () => ({
  PANGULAR_HUB_BASE: '/__devframes/',
  startPangularHub: () => ({ nodeMiddleware: vi.fn(), close: vi.fn() }),
}));

const { default: pangularVite } = await import('../vite.ts');

function serve(options: Parameters<typeof pangularVite>[0]) {
  const sent: unknown[] = [];
  const ws = { send: (payload: unknown) => void sent.push(payload) };
  const original = ws.send;
  const plugin = pangularVite({ apiPrefix: 'api', ...options });
  (plugin.configureServer as (server: unknown) => void)({
    config: { root: process.cwd(), server: {}, logger: { warn: vi.fn(), info: vi.fn() } },
    middlewares: { use: vi.fn() },
    httpServer: null,
    ws,
  });
  return { ws, sent, original };
}

afterEach(() => {
  delete (globalThis as { __PANGULAR_SERVER_ERRORS__?: unknown }).__PANGULAR_SERVER_ERRORS__;
});

describe('Vite plugin error capture', () => {
  it("records Vite's overlay errors and still sends them", () => {
    const { ws, sent } = serve({});
    ws.send({ type: 'error', err: { message: 'Transform failed', plugin: 'vite:esbuild' } });
    expect(sent).toHaveLength(1);
    expect(serverErrorsRegistry().pending.map((e) => [e.kind, e.message])).toEqual([
      ['vite', 'Transform failed'],
    ]);
  });

  it('leaves ws.send alone with the errors inspector off', () => {
    const { ws, original } = serve({ inspectors: { errors: false } });
    expect(ws.send).toBe(original);
  });
});
