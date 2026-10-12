import { describe, expect, it, vi } from 'vitest';

const hubOptions = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('../hub.ts', () => ({
  PANGULAR_HUB_BASE: '/__devframes/',
  startPangularHub: (options: Record<string, unknown>) => {
    hubOptions.push(options);
    return { nodeMiddleware: vi.fn(), close: vi.fn() };
  },
}));

const { default: pangularVite } = await import('../vite.ts');

function hubTerminals(options: Parameters<typeof pangularVite>[0]) {
  hubOptions.length = 0;
  const warn = vi.fn();
  const plugin = pangularVite({ apiPrefix: 'api', ...options });
  (plugin.configureServer as (server: unknown) => void)({
    config: { root: process.cwd(), server: {}, logger: { warn, info: vi.fn() } },
    middlewares: { use: vi.fn() },
    httpServer: null,
  });
  return { terminals: hubOptions[0]?.['terminals'], warn };
}

describe('Vite plugin terminals option', () => {
  it('is off by default and on with terminals: true', () => {
    expect(hubTerminals({}).terminals).toBe(false);
    expect(hubTerminals({ terminals: true }).terminals).toBe(true);
  });

  it('stays off when other machines can reach the dev server', () => {
    const { terminals, warn } = hubTerminals({
      terminals: true,
      allowLan: true,
      allowedOrigins: ['http://192.168.1.20:5173'],
    });
    expect(terminals).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[pangular] The terminals dock is off: allowLan lets other machines reach the hub.',
    );
  });
});
