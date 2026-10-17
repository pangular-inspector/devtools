// The hub's on/off switch and the hub it returns when off. Both the hub
// (`hub.ts`) and its published loader (`hub-entry.ts`) use them, and they
// import nothing at runtime, so a production server with the hub off never
// loads the hub's server code.

import type { initHub } from '@devframes/hub/initiate';
import type { createSsrMiddleware } from './ssr-middleware.ts';

export type PangularHub = ReturnType<typeof initHub> & {
  /**
   * Opt-in Express or Connect middleware that traces each SSR request and adds
   * a `Server-Timing` header. Add it before the Angular request handler.
   */
  ssrMiddleware: ReturnType<typeof createSsrMiddleware>;
  /** Whether the hub is mounted. `false` when `enabled` is off, as in production by default. */
  enabled: boolean;
};

function processEnv(): Record<string, string | undefined> {
  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  );
}

/** `enabled`, or on unless `NODE_ENV` is `production`. */
export function hubEnabled(
  enabled: boolean | undefined,
  env: Record<string, string | undefined> = processEnv(),
  warn: (message: string) => void = console.warn,
): boolean {
  const production = env['NODE_ENV'] === 'production';
  if (enabled === undefined) return !production;
  if (enabled && production) {
    warn(
      '\n  [pangular] WARNING: the Pangular Inspector hub is on in production (enabled: true with NODE_ENV=production).\n' +
        '  It exposes your app state, source and agent tools to anyone who can pass its checks.\n' +
        '  Remove enabled: true unless this server only runs on your machine.\n',
    );
  }
  return enabled;
}

/** The hub when `enabled` is off: every middleware calls `next()` and nothing is mounted. */
export function disabledHub(base: string): PangularHub {
  const context = Promise.reject(new Error('[pangular] The hub is off (enabled: false).'));
  context.catch(() => undefined);
  return {
    base,
    enabled: false,
    handler: async () => new Response(null, { status: 404 }),
    nodeMiddleware: (_req, _res, next) => next?.(),
    ssrMiddleware: ((_req: unknown, _res: unknown, next: () => void) =>
      next()) as PangularHub['ssrMiddleware'],
    attach: () => () => undefined,
    handleUpgrade: (_req, socket) => socket.destroy(),
    ready: Promise.resolve(),
    context,
    connectionMeta: () => {
      throw new Error('[pangular] The hub is off (enabled: false).');
    },
    close: async () => undefined,
  };
}
