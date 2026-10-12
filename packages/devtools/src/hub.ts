import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createUi } from '@devframes/hub-ui';
import { DEVFRAMES_HUB_BASE, initHub } from '@devframes/hub/initiate';
import { normalizeHubBase } from '@devframes/hub/constants';
import type { InitHubOptions } from '@devframes/hub/initiate';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { isAllowedOrigin } from 'devframe/utils/origin';
import { createPangular } from './devframe.ts';
import { withMessagesPanel } from './hub-messages-panel.ts';
import {
  blockedOriginReporter,
  isAllowedHubRequest,
  isHubPath,
  refuseHubRequest,
  type HubOriginPolicy,
} from './hub-gate.ts';
import { PANGULAR_MCP_TOKEN_ENV, loadMcpToken } from './mcp-token.ts';
import { authTokensFrom, isAuthTokens, type PangularAuthTokens } from './auth-tokens.ts';
import { PANGULAR_EXTENSION_ORIGINS, isAllowedExtensionOrigin } from './extension-origin.ts';
import { pickPangularConfig, resolvePangularConfig, type PangularConfig } from './config.ts';
import { pangularMcp } from './agent-mcp.ts';
import { PANGULAR_LOGO_DATA_URI, PANGULAR_PRIMARY_COLOR } from './brand.ts';
import { createSsrMiddleware } from './ssr-middleware.ts';
import { releaseServerState } from './server-state.ts';
import pkg from '../package.json' with { type: 'json' };

export const PANGULAR_HUB_BASE = DEVFRAMES_HUB_BASE;

export type { PangularConfig } from './config.ts';

export type PangularHubOptions = Partial<Omit<InitHubOptions, 'devframes' | 'ui' | 'auth'>> &
  PangularConfig & {
    /**
     * The one-time code. `false` turns it off. `{tokens}` keeps it on and also
     * trusts clients that send one of the tokens, such as an app on a phone.
     */
    auth?: InitHubOptions['auth'] | PangularAuthTokens;
    /** The app's browser build folder, so a forced Client render can serve `index.csr.html`. */
    browserDistFolder?: string;
    /**
     * Mount the hub. Defaults to `process.env.NODE_ENV !== 'production'`. When
     * off, the middlewares only call `next()`. Passing `true` in production
     * mounts it anyway, with a warning.
     */
    enabled?: boolean;
    /**
     * Also answer other machines, such as a phone on Wi-Fi, under the same
     * origin check. Needs the one-time code on: with `auth: false` it is
     * ignored. Off by default: only this machine.
     */
    allowLan?: boolean;
  };

function hubUiClientDir(): string | undefined {
  try {
    const own = createRequire(import.meta.url).resolve(`${pkg.name}/package.json`);
    const hubUi = createRequire(own).resolve('@devframes/hub-ui/package.json');
    const dir = join(dirname(hubUi), 'dist/client');
    return existsSync(join(dir, 'embedded.js')) ? dir : undefined;
  } catch {
    return undefined;
  }
}

function hubUi() {
  const ui = createUi({
    branding: {
      productName: 'Pangular Inspector',
      logo: PANGULAR_LOGO_DATA_URI,
      primaryColor: PANGULAR_PRIMARY_COLOR,
    },
  });
  const dir = hubUiClientDir();
  if (!dir) return ui;
  return {
    ...ui,
    viewer: { distDir: join(dir, 'standalone') },
    embedded: { entry: join(dir, 'embedded.js') },
  };
}

export const hubDefaultOrigins: WsOriginRegistry = {
  token: '',
  registerFromUrl: () => undefined,
  isAllowed: (origin: string | undefined) =>
    (origin !== undefined && isAllowedExtensionOrigin(origin)) || isAllowedOrigin(origin, []),
};

let warnedOriginCheckOff = false;

/**
 * The origin check the hub runs: the defaults, a list plus the published
 * extension, or a custom registry that also accepts the published extension.
 * `false` turns the check off, and says so once.
 */
export function hubAllowedOrigins(
  allowedOrigins: InitHubOptions['allowedOrigins'],
  warn: (message: string) => void = console.warn,
): NonNullable<InitHubOptions['allowedOrigins']> {
  if (allowedOrigins === undefined) return hubDefaultOrigins;
  if (allowedOrigins === false) {
    if (!warnedOriginCheckOff) {
      warnedOriginCheckOff = true;
      warn(
        '[pangular] allowedOrigins is false: the devtools hub accepts requests from any origin.',
      );
    }
    return false;
  }
  if (Array.isArray(allowedOrigins)) return [...allowedOrigins, ...PANGULAR_EXTENSION_ORIGINS];
  const custom = allowedOrigins as WsOriginRegistry;
  return {
    get token() {
      return custom.token;
    },
    registerFromUrl: (url: string) => custom.registerFromUrl(url),
    isAllowed: (origin: string | undefined) =>
      (origin !== undefined && isAllowedExtensionOrigin(origin)) || custom.isAllowed(origin),
  };
}

type PangularHub = ReturnType<typeof initHub> & {
  /**
   * Opt-in Express or Connect middleware that traces each SSR request and adds
   * a `Server-Timing` header. Add it before the Angular request handler.
   */
  ssrMiddleware: ReturnType<typeof createSsrMiddleware>;
  /** Whether the hub is mounted. `false` when `enabled` is off, as in production by default. */
  enabled: boolean;
};

interface HubRegistry {
  token?: string;
  hubs?: Map<string, PangularHub>;
}

function hubRegistry(): HubRegistry {
  const g = globalThis as { __PANGULAR_HUB__?: HubRegistry };
  return (g.__PANGULAR_HUB__ ??= {});
}

function mcpToken(): string {
  const fromEnv = process.env[PANGULAR_MCP_TOKEN_ENV];
  if (fromEnv) return fromEnv;
  const registry = hubRegistry();
  return (registry.token ??= loadMcpToken());
}

function hubMcpFor(options: {
  mcp?: InitHubOptions['mcp'];
  auth?: unknown;
}): InitHubOptions['mcp'] {
  if (options.mcp !== undefined || options.auth === false) return options.mcp;
  return { authorization: mcpToken() };
}

/**
 * Starts the hub without the `enabled` switch, behind `gate` when one is
 * given. The Vite plugin calls it and runs the same gate in front of its whole
 * server; apps call `initPangularHub()`.
 *
 * Keeps one hub per base in the process. A dev server that runs `server.ts`
 * again after a rebuild gets a fresh hub, and the previous one is closed.
 *
 * @internal
 */
export function startPangularHub(
  options: Omit<PangularHubOptions, 'enabled' | 'allowLan'> = {},
  gate?: HubOriginPolicy,
): PangularHub {
  const { browserDistFolder, auth: authOption, ...hubOptions } = options;
  const { config, rest: picked } = pickPangularConfig(hubOptions);
  // Behind a gate, a shared `server` is attached through the gated `attach`
  // below, so its upgrades pass the same checks as `handleUpgrade`.
  const { server: sharedServer, ...hubRest } = picked;
  const rest = withMessagesPanel(hubRest, normalizeHubBase(hubRest.base ?? PANGULAR_HUB_BASE));
  const authTokens = isAuthTokens(authOption) ? authTokensFrom(authOption.tokens) : [];
  const auth = isAuthTokens(authOption) ? undefined : authOption;
  const hub = initHub({
    name: 'pangular',
    version: pkg.version,
    base: PANGULAR_HUB_BASE,
    ...rest,
    ...(auth === undefined ? {} : { auth }),
    allowedOrigins: hubAllowedOrigins(rest.allowedOrigins),
    mcp: pangularMcp(hubMcpFor({ ...rest, auth }), resolvePangularConfig(config)),
    devframes: [createPangular(config, { authTokens })],
    ui: hubUi(),
    ...(gate || sharedServer === undefined ? {} : { server: sharedServer }),
  });
  const hubs = (hubRegistry().hubs ??= new Map());
  let closing: Promise<void> | undefined;
  let detachShared: (() => void) | undefined;
  const own: PangularHub = {
    ...hub,
    ...(gate ? gatedTransport(hub, gate) : {}),
    enabled: true,
    ssrMiddleware: createSsrMiddleware({ skip: [hub.base], browserDistFolder }),
    close: () => {
      if (hubs.get(hub.base) === own) hubs.delete(hub.base);
      detachShared?.();
      // Stop the HTTP registry timers and SSR capture this hub installed, as Vite does.
      return (closing ??= hub.context
        .then(releaseServerState, () => undefined)
        .finally(() => hub.close()));
    },
  };
  if (gate && sharedServer) detachShared = own.attach(sharedServer);
  const previous = hubs.get(hub.base);
  hubs.set(hub.base, own);
  void previous?.close();
  return own;
}

const REFUSED_BODY = 'Pangular Inspector only answers requests from this machine.';
const EXPRESS_LAN_FIX = 'To answer other machines, pass allowLan: true and keep auth on.';

/**
 * The request gate for the Express hub: the one the Vite plugin runs, with
 * the hub's own origin check. `undefined` when `allowedOrigins` is `false`.
 */
export function hubGatePolicy(
  allowedOrigins: NonNullable<InitHubOptions['allowedOrigins']>,
  remote = false,
): HubOriginPolicy | undefined {
  if (allowedOrigins === false) return undefined;
  const isAllowed = Array.isArray(allowedOrigins)
    ? (origin: string) => isAllowedOrigin(origin, allowedOrigins)
    : (origin: string) => (allowedOrigins as WsOriginRegistry).isAllowed(origin);
  return { isAllowedOrigin: isAllowed, remote };
}

/** Puts the gate in front of the hub's Express middleware and WebSocket upgrades. */
function gatedTransport(
  hub: ReturnType<typeof initHub>,
  policy: HubOriginPolicy,
): Pick<ReturnType<typeof initHub>, 'nodeMiddleware' | 'handleUpgrade' | 'handler' | 'attach'> {
  const blocked = blockedOriginReporter((message) => console.warn(message));
  return {
    // A web request carries no peer address, so the handler checks the
    // headers as for a request from this machine (or from any, with allowLan).
    handler: (request) => {
      const headers = Object.fromEntries(request.headers);
      headers['host'] ??= new URL(request.url).host;
      const remoteAddress = policy.remote ? '' : '127.0.0.1';
      const req = { url: request.url, headers, socket: { remoteAddress } };
      if (!isAllowedHubRequest(req as never, policy, blocked)) {
        return Promise.resolve(new Response(REFUSED_BODY, { status: 403 }));
      }
      return hub.handler(request);
    },
    nodeMiddleware: (req, res, next) => {
      if (isHubPath(req.url, hub.base) && !isAllowedHubRequest(req, policy, blocked)) {
        refuseHubRequest(req, res, EXPRESS_LAN_FIX);
        return;
      }
      hub.nodeMiddleware(req, res, next);
    },
    handleUpgrade: (req, socket, head) => {
      if (isAllowedHubRequest(req, policy, blocked)) hub.handleUpgrade(req, socket, head);
      else socket.destroy();
    },
    // The hub's own `attach` adds an ungated upgrade listener. Take the
    // listeners it adds off the server and run them behind the gate instead,
    // for hub paths only, so the server's other upgrades are left alone.
    attach: (server) => {
      const before = new Set(server.listeners('upgrade'));
      const detach = hub.attach(server);
      const added = server.listeners('upgrade').filter((listener) => !before.has(listener)) as ((
        ...args: unknown[]
      ) => void)[];
      for (const listener of added) server.off('upgrade', listener);
      const gated = (...args: Parameters<ReturnType<typeof initHub>['handleUpgrade']>) => {
        const [req, socket] = args;
        if (isHubPath(req.url, hub.base) && !isAllowedHubRequest(req, policy, blocked)) {
          socket.destroy();
          return;
        }
        for (const listener of added) listener.apply(server, args);
      };
      server.on('upgrade', gated);
      return () => {
        server.off('upgrade', gated);
        detach();
      };
    },
  };
}

/** `enabled`, or on unless `NODE_ENV` is `production`. */
export function hubEnabled(
  enabled: boolean | undefined,
  env: Record<string, string | undefined> = process.env,
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
function disabledHub(base: string): PangularHub {
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

/**
 * Mounts the devtools hub in an Express or Connect server, behind the request
 * gate: loopback requests only (unless `allowLan`), a loopback or allowed
 * `Host`, and the origin check. Off in production unless `enabled` is `true`.
 */
export function initPangularHub(options: PangularHubOptions = {}): PangularHub {
  const { enabled, allowLan, ...hubOptions } = options;
  const base = normalizeHubBase(hubOptions.base ?? PANGULAR_HUB_BASE);
  if (!hubEnabled(enabled)) return disabledHub(base);
  const authOn = hubOptions.auth !== false;
  if (allowLan === true && !authOn) {
    console.warn(
      '[pangular] Ignoring allowLan: it needs the one-time code, and auth is false. Only this machine can reach the devtools.',
    );
  }
  // `allowedOrigins: false` turns the gate off; startPangularHub prints that warning.
  const policy =
    hubOptions.allowedOrigins === false
      ? undefined
      : hubGatePolicy(hubAllowedOrigins(hubOptions.allowedOrigins), allowLan === true && authOn);
  return startPangularHub(hubOptions, policy);
}
