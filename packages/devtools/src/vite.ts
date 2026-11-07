import { resolve } from 'node:path';
import { isAuthTokens, type PangularAuthTokens } from './auth-tokens.ts';
import type { Plugin } from 'vite';
import { normalizeHubBase } from '@devframes/hub/constants';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { PANGULAR_HUB_BASE, startPangularHub } from './hub.ts';
import { analogMiddleware, setDevOrigin } from './analog-server-log.ts';
import { analogConfig, setAnalogRoot } from './rpc/analog-scan.ts';
import { viteScanWatcher } from './rpc/analog-scan-cache.ts';
import { clearViteEnv, setViteEnv } from './rpc/analog-runtime-config.ts';
import {
  installTransformTracer,
  resetTransformTracer,
  type ViteServerLike,
} from './analog-transform.ts';
import { releaseServerState } from './server-state.ts';
import { normalizeAllowedOrigins } from './allowed-origins.ts';
import {
  allowedHostsWarning,
  allowsRemoteOrigins,
  blockedOriginReporter,
  hubOriginRegistryFor,
  hubRequestGate,
  hubUpgradeListener,
  isAllowedFetchSite,
  isAllowedHubHost,
  isAllowedHubOrigin,
  isAllowedHubRequest,
  isHubPath,
  type HubOriginPolicy,
} from './hub-gate.ts';
import { pickPangularConfig, resolvePangularConfig, type PangularConfig } from './config.ts';
import { overlayTags } from './vite-overlay.ts';
import { signalPrimitivesAlias } from './vite-signals-stub.ts';
import { terminalsEnabled } from './hub-terminals.ts';

export type { PangularConfig } from './config.ts';
import type { PangularServerPlugin } from './plugin.ts';

export interface PangularViteOptions extends PangularConfig {
  base?: string;
  apiPrefix?: string;
  allowedOrigins?: string[];
  /**
   * The one-time code: on, off, or on with pairing tokens (`{tokens}`) that a
   * client may send instead. On by default, along with the MCP token.
   */
  auth?: boolean | PangularAuthTokens;
  /**
   * Also answer requests from other machines, such as a phone on Wi-Fi, when
   * their origin is in `allowedOrigins`. Needs the one-time code on: with
   * `auth: false` it is ignored. Off by default: only this machine.
   */
  allowLan?: boolean;
  /**
   * Add the overlay to the pages the dev server serves. On by default; pass
   * `false` to load it yourself, for example with `initOverlay` options.
   */
  overlay?: boolean;
  /**
   * Add a terminals dock that runs the project's own build and test commands
   * (its `build` and `test` scripts, or `ng build` and `ng test`). Off by
   * default. Ignored with `allowLan`.
   */
  terminals?: boolean;
  /** Pangular plugins' server sides: their agent tools and shared state. */
  serverPlugins?: readonly PangularServerPlugin[];
}

export {
  allowsRemoteOrigins,
  blockedOriginReporter,
  hubOriginRegistryFor,
  hubRequestGate,
  hubUpgradeListener,
  isAllowedFetchSite,
  isAllowedHubHost,
  isAllowedHubOrigin,
  isAllowedHubRequest,
  isHubPath,
  normalizeAllowedOrigins,
  type HubOriginPolicy,
};

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

/** The one-time code is on unless `auth` is `false`. */
export function hubAuthFor(auth?: boolean): boolean {
  return auth ?? true;
}

export const hubOriginRegistry: WsOriginRegistry = hubOriginRegistryFor();

export { releaseServerState } from './server-state.ts';

/**
 * The full-page devtools URL on the origin of the dev server's first local
 * URL. The hub answers at the root of the origin, not under Vite's `base`.
 */
export function devtoolsUrl(local: string | undefined, base: string): string | undefined {
  if (!local || !URL.canParse(local)) return undefined;
  return `${new URL(local).origin}${normalizeHubBase(base)}`;
}

export default function pangularVite(options: PangularViteOptions = {}): Plugin {
  const base = normalizeHubBase(options.base ?? PANGULAR_HUB_BASE);
  const { config } = pickPangularConfig(options);
  const analog = resolvePangularConfig(config).inspectors.analog;
  return {
    name: 'pangular',
    apply: 'serve',
    enforce: 'pre',
    config(user) {
      // Vite allows a relative `root`, and `createRequire` needs an absolute path.
      const alias = signalPrimitivesAlias(resolve(process.cwd(), user.root ?? ''));
      return alias.length ? { resolve: { alias } } : undefined;
    },
    // `pre`, so Vite's own HTML pass resolves the injected import like any other.
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => (options.overlay === false ? [] : overlayTags(html, base)),
    },
    configureServer(server) {
      const logger = server.config.logger;
      const policy: HubOriginPolicy = {
        allowedHosts: server.config.server?.allowedHosts,
        allowedOrigins: normalizeAllowedOrigins(options.allowedOrigins, (message) =>
          logger?.warn(message),
        ),
      };
      const authOn = isAuthTokens(options.auth) || hubAuthFor(options.auth);
      policy.lan = lanAllowed(options.allowLan, authOn, policy, (message) => logger?.warn(message));
      const hostsWarning = allowedHostsWarning(policy.allowedHosts, authOn);
      if (hostsWarning) logger?.warn(hostsWarning);
      const blocked = blockedOriginReporter((message) => logger?.warn(message));
      server.middlewares.use(hubRequestGate(base, policy, blocked));
      if (analog) {
        setAnalogRoot(server.config.root);
        const apiPrefix = options.apiPrefix ?? analogConfig(server.config.root).apiPrefix;
        server.middlewares.use(analogMiddleware(apiPrefix));
        // Lets the Analog Routes view show a page file's transform stack.
        installTransformTracer(server as unknown as ViteServerLike);
        // What import.meta.env holds, for the Runtime view.
        setViteEnv(server.config.env, server);
      }
      // The Analog and pipe source scans are kept until this watcher sees a change. With
      // `server.watch: null` Vite's watcher never fires, so the scans check by themselves.
      if (server.config.server?.watch !== null) {
        server.watcher?.on('all', viteScanWatcher(server.config.root));
      }
      const httpServer = server.httpServer;
      // The plugin runs the gate itself, in front of the whole dev server.
      const devtools = startPangularHub({
        ...config,
        base,
        ...(httpServer ? {} : { ws: { sidecar: true } }),
        auth: isAuthTokens(options.auth) ? options.auth : hubAuthFor(options.auth),
        // The gate in front checks upgrades on the dev server; a side-car socket has none.
        allowedOrigins: hubOriginRegistryFor(policy, !!httpServer),
        terminals: terminalsEnabled(options.terminals, { remote: policy.lan }, (message) =>
          logger?.warn(message),
        ),
        serverPlugins: options.serverPlugins,
        security: {
          auth: authOn,
          originCheck: true,
          allowedOrigins: policy.allowedOrigins ?? [],
          ...(policy.allowedHosts === undefined ? {} : { allowedHosts: policy.allowedHosts }),
          network: policy.lan === true,
        },
      });
      httpServer?.on('upgrade', hubUpgradeListener(base, policy, devtools.handleUpgrade, blocked));
      server.middlewares.use(devtools.nodeMiddleware);
      httpServer?.once('listening', () => {
        setDevOrigin(server.resolvedUrls?.local[0]);
      });
      // Add the devtools URL to the URLs Vite prints at startup.
      const printUrls = server.printUrls?.bind(server);
      if (printUrls) {
        server.printUrls = () => {
          printUrls();
          const url = devtoolsUrl(server.resolvedUrls?.local[0], base);
          if (url) logger.info(`  \u279C  Pangular Inspector: ${url}`);
        };
      }
      httpServer?.once('close', () => {
        // A restart opens the new server before this one closes: clear only what is still ours.
        if (analog) {
          resetTransformTracer(server);
          clearViteEnv(server);
        }
        void devtools.context
          .then(releaseServerState, () => undefined)
          .finally(() => devtools.close());
      });
    },
  };
}
