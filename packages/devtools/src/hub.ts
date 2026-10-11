import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createUi } from '@devframes/hub-ui';
import { DEVFRAMES_HUB_BASE, initHub } from '@devframes/hub/initiate';
import type { InitHubOptions } from '@devframes/hub/initiate';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { isAllowedOrigin } from 'devframe/utils/origin';
import { createPangular } from './devframe.ts';
import { authTokensFrom, isAuthTokens, type PangularAuthTokens } from './auth-tokens.ts';
import { PANGULAR_EXTENSION_ORIGINS, isAllowedExtensionOrigin } from './extension-origin.ts';
import { pickPangularConfig, type PangularConfig } from './config.ts';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { createSsrMiddleware } from './ssr-middleware.ts';
import { releaseServerState } from './server-state.ts';
import pkg from '../package.json' with { type: 'json' };

export const PANGULAR_HUB_BASE = DEVFRAMES_HUB_BASE;

export type { PangularConfig } from './config.ts';

const PANGULAR_MCP_TOKEN_ENV = 'PANGULAR_MCP_TOKEN';

export type PangularHubOptions = Partial<Omit<InitHubOptions, 'devframes' | 'ui' | 'auth'>> &
  PangularConfig & {
    /**
     * The one-time code. `false` turns it off. `{tokens}` keeps it on and also
     * trusts clients that send one of the tokens, such as an app on a phone.
     */
    auth?: InitHubOptions['auth'] | PangularAuthTokens;
    /** The app's browser build folder, so a forced Client render can serve `index.csr.html`. */
    browserDistFolder?: string;
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
      primaryColor: '#f5a524',
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
  if (registry.token) return registry.token;
  const token = (registry.token = randomBytes(24).toString('base64url'));
  console.log(
    `\n  Pangular Inspector MCP token: ${token}\n` +
      `  HTTP MCP clients send it as "Authorization: Bearer <token>".\n` +
      `  Set ${PANGULAR_MCP_TOKEN_ENV} to keep it the same across restarts.\n`,
  );
  return token;
}

function hubMcpFor(options: {
  mcp?: InitHubOptions['mcp'];
  auth?: unknown;
}): InitHubOptions['mcp'] {
  if (options.mcp !== undefined || options.auth === false) return options.mcp;
  return { authorization: mcpToken() };
}

/**
 * Keeps one hub per base in the process. A dev server that runs `server.ts`
 * again after a rebuild gets a fresh hub, and the previous one is closed.
 */
export function initPangularHub(options: PangularHubOptions = {}): PangularHub {
  const { browserDistFolder, auth: authOption, ...hubOptions } = options;
  const { config, rest } = pickPangularConfig(hubOptions);
  const authTokens = isAuthTokens(authOption) ? authTokensFrom(authOption.tokens) : [];
  const auth = isAuthTokens(authOption) ? undefined : authOption;
  const hub = initHub({
    name: 'pangular',
    version: pkg.version,
    base: PANGULAR_HUB_BASE,
    ...rest,
    ...(auth === undefined ? {} : { auth }),
    allowedOrigins: hubAllowedOrigins(rest.allowedOrigins),
    mcp: hubMcpFor({ ...rest, auth }),
    devframes: [createPangular(config, { authTokens })],
    ui: hubUi(),
  });
  const hubs = (hubRegistry().hubs ??= new Map());
  let closing: Promise<void> | undefined;
  const own: PangularHub = {
    ...hub,
    ssrMiddleware: createSsrMiddleware({ skip: [hub.base], browserDistFolder }),
    close: () => {
      if (hubs.get(hub.base) === own) hubs.delete(hub.base);
      // Stop the HTTP registry timers and SSR capture this hub installed, as Vite does.
      return (closing ??= hub.context
        .then(releaseServerState, () => undefined)
        .finally(() => hub.close()));
    },
  };
  const previous = hubs.get(hub.base);
  hubs.set(hub.base, own);
  void previous?.close();
  return own;
}
