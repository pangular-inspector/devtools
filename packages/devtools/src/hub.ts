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
import { pickPangularConfig, type PangularConfig } from './config.ts';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import pkg from '../package.json' with { type: 'json' };

export const PANGULAR_HUB_BASE = DEVFRAMES_HUB_BASE;

export type { PangularConfig } from './config.ts';

const PANGULAR_MCP_TOKEN_ENV = 'PANGULAR_MCP_TOKEN';

export type PangularHubOptions = Partial<Omit<InitHubOptions, 'devframes' | 'ui'>> & PangularConfig;

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

function isExtensionOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'chrome-extension:' && url.hostname !== '';
  } catch {
    return false;
  }
}

export const hubDefaultOrigins: WsOriginRegistry = {
  token: '',
  registerFromUrl: () => undefined,
  isAllowed: (origin: string | undefined) =>
    (origin !== undefined && isExtensionOrigin(origin)) || isAllowedOrigin(origin, []),
};

type PangularHub = ReturnType<typeof initHub>;

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

function hubMcpFor(options: PangularHubOptions): InitHubOptions['mcp'] {
  if (options.mcp !== undefined || options.auth === false) return options.mcp;
  return { authorization: mcpToken() };
}

/**
 * Keeps one hub per base in the process. A dev server that runs `server.ts`
 * again after a rebuild gets a fresh hub, and the previous one is closed.
 */
export function initPangularHub(options: PangularHubOptions = {}): PangularHub {
  const { config, rest } = pickPangularConfig(options);
  const hub = initHub({
    name: 'pangular',
    version: pkg.version,
    base: PANGULAR_HUB_BASE,
    ...rest,
    allowedOrigins: rest.allowedOrigins ?? hubDefaultOrigins,
    mcp: hubMcpFor(rest),
    devframes: [createPangular(config)],
    ui: hubUi(),
  });
  const hubs = (hubRegistry().hubs ??= new Map());
  let closing: Promise<void> | undefined;
  const own: PangularHub = {
    ...hub,
    close: () => {
      if (hubs.get(hub.base) === own) hubs.delete(hub.base);
      return (closing ??= hub.close());
    },
  };
  const previous = hubs.get(hub.base);
  hubs.set(hub.base, own);
  void previous?.close();
  return own;
}
