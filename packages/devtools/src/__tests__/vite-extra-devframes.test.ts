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

function startedWith(options: Parameters<typeof pangularVite>[0]) {
  hubOptions.length = 0;
  const plugin = pangularVite({ apiPrefix: 'api', ...options });
  (plugin.configureServer as (server: unknown) => void)({
    config: { root: process.cwd(), server: {}, logger: { warn: vi.fn(), info: vi.fn() } },
    middlewares: { use: vi.fn() },
    httpServer: null,
  });
  return hubOptions[0]!;
}

describe('Vite plugin extraDevframes option', () => {
  it('passes the extra devframes to the hub as given', () => {
    const extra = [{ devframe: { id: 'acme' } }] as never;
    expect(startedWith({ extraDevframes: extra })['extraDevframes']).toBe(extra);
  });

  it('passes nothing when the option is left out', () => {
    expect(startedWith({})['extraDevframes']).toBeUndefined();
  });
});
