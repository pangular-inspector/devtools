// The Vite plugin's `lanAddress` option: the dev server's LAN address,
// injected as `__PANGULAR_LAN_URL__` into the app the dev server serves and
// into development builds. It only injects an address the hub answers on:
// `allowLan` must be in effect and `server.host` on the network.
import type { AddressInfo } from 'node:net';
import type { networkInterfaces } from 'node:os';
import type { UserConfig } from 'vite';
import { normalizeAllowedOrigins } from './allowed-origins.ts';
import { isAuthTokens, type PangularAuthTokens } from './auth-tokens.ts';
import { resolveLanAddress } from './config.ts';
import { allowsRemoteOrigins, type HubOriginPolicy } from './hub-gate.ts';
import { lanDefine, lanUrl, viteBindHost } from './lan-address.ts';

/** Whether `allowLan` takes effect: only with the one-time code on and a remote origin listed. */
export function lanAllowed(
  allowLan: unknown,
  authOn: boolean,
  policy: HubOriginPolicy,
  warn: (message: string) => void = () => undefined,
): boolean {
  if (allowLan !== true) {
    if (allowLan !== undefined && allowLan !== false) {
      warn(`[pangular] Ignoring allowLan: ${JSON.stringify(allowLan)}. Pass true to turn it on.`);
    }
    return false;
  }
  if (!authOn) {
    warn(
      '[pangular] Ignoring allowLan: it needs the one-time code, and auth is false. Only this machine can reach the devtools.',
    );
    return false;
  }
  if (!allowsRemoteOrigins({ allowedOrigins: policy.allowedOrigins })) {
    warn(
      '[pangular] allowLan has no effect without a network origin in allowedOrigins, such as http://192.168.1.20:5173.',
    );
    return false;
  }
  return true;
}

/** The plugin options `lanAddress` reads. */
export interface ViteLanOptions {
  lanAddress?: unknown;
  allowLan?: unknown;
  auth?: boolean | PangularAuthTokens;
  allowedOrigins?: string[];
}

interface Logger {
  warn(message: string): void;
}

const VITE_PORT = 5173;
const SKIPPED = '[pangular] Not injecting the LAN address:';

/**
 * The `lanAddress` state of one plugin instance. `define()` runs in the
 * `config` hook, before Vite has a logger, so its warnings wait for `report()`.
 */
export function viteLanAddress(
  options: ViteLanOptions,
  base: string,
  interfaces?: ReturnType<typeof networkInterfaces>,
) {
  const optionWarnings: string[] = [];
  const lan = resolveLanAddress(options.lanAddress, (message) => optionWarnings.push(message));
  let pending: string[] = [];
  let port: number | undefined;
  const state = {
    /** Whether `lanAddress` is on. */
    enabled: lan.on,
    /** The injected URL, once `define()` ran and injected one. */
    url: undefined as string | undefined,
    /** Whether a `vite build` in `mode` gets the plugin: never for production. */
    appliesToBuild(mode: string): boolean {
      return lan.on && mode !== 'production';
    },
    /** The `define` entries for the resolved config, or `undefined` when nothing is injected. */
    define(user: UserConfig): Record<string, string> | undefined {
      pending = [...optionWarnings];
      state.url = undefined;
      port = undefined;
      if (!lan.on) return undefined;
      const authOn = isAuthTokens(options.auth) || (options.auth ?? true);
      const policy: HubOriginPolicy = {
        allowedHosts: user.server?.allowedHosts,
        allowedOrigins: normalizeAllowedOrigins(options.allowedOrigins, () => undefined),
      };
      if (!lanAllowed(options.allowLan, authOn, policy)) {
        pending.push(
          `${SKIPPED} the devtools don't answer other machines. Pass allowLan: true and a network origin in allowedOrigins, and keep auth on.`,
        );
        return undefined;
      }
      const result = lanUrl({
        lan,
        host: viteBindHost(user.server?.host),
        port: user.server?.port ?? VITE_PORT,
        path: `${base}pangular/`,
        https: !!user.server?.https,
        interfaces,
      });
      if ('problem' in result) {
        pending.push(`${SKIPPED} ${result.problem}`);
        return undefined;
      }
      state.url = result.url;
      port = user.server?.port ?? VITE_PORT;
      return lanDefine(result.url);
    },
    /** Logs the warnings `define()` collected. */
    report(logger: Logger): void {
      for (const message of pending.splice(0)) logger.warn(message);
    },
    /** Warns when Vite moved to another port than the one in the injected URL. */
    checkPort(address: AddressInfo | string | null, logger: Logger): void {
      if (port === undefined || !address || typeof address === 'string') return;
      if (address.port !== port) {
        logger.warn(
          `[pangular] The injected LAN address uses port ${port}, but the dev server listens on ${address.port}. Set server.strictPort, or free port ${port}.`,
        );
      }
    },
  };
  return state;
}
