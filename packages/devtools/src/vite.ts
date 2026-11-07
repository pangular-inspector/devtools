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
import { lanAllowed, viteLanAddress } from './vite-lan.ts';

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
  /**
   * Inject the dev server's LAN address into the app as `__PANGULAR_LAN_URL__`,
   * so a phone app (Capacitor, NativeScript) built in development mode finds
   * the devtools. `true` picks this machine's address; a string names one,
   * such as `'192.168.1.20'`. Off by default. Needs `allowLan` in effect and
   * `server.host` on the network; it changes nothing about who may connect.
   */
  lanAddress?: boolean | string;
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
  lanAllowed,
  normalizeAllowedOrigins,
  type HubOriginPolicy,
};

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
  const lan = viteLanAddress(options, base);
  let serving = true;
  return {
    name: 'pangular',
    // A development build also gets the plugin when it injects the LAN address,
    // for an app bundled into a phone app. Then only the `define` applies.
    apply: lan.enabled
      ? (_config, env) => env.command === 'serve' || lan.appliesToBuild(env.mode)
      : 'serve',
    enforce: 'pre',
    config(user, env) {
      serving = env?.command !== 'build';
      const define = lan.define(user);
      if (!serving) return define ? { define } : undefined;
      // Vite allows a relative `root`, and `createRequire` needs an absolute path.
      const alias = signalPrimitivesAlias(resolve(process.cwd(), user.root ?? ''));
      if (!alias.length && !define) return undefined;
      return { ...(alias.length ? { resolve: { alias } } : {}), ...(define ? { define } : {}) };
    },
    configResolved(resolved) {
      lan.report(resolved.logger);
    },
    // `pre`, so Vite's own HTML pass resolves the injected import like any other.
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => (options.overlay === false || !serving ? [] : overlayTags(html, base)),
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
      });
      httpServer?.on('upgrade', hubUpgradeListener(base, policy, devtools.handleUpgrade, blocked));
      server.middlewares.use(devtools.nodeMiddleware);
      httpServer?.once('listening', () => {
        setDevOrigin(server.resolvedUrls?.local[0]);
        lan.checkPort(httpServer.address(), logger);
      });
      // Add the devtools URL to the URLs Vite prints at startup.
      const printUrls = server.printUrls?.bind(server);
      if (printUrls) {
        server.printUrls = () => {
          printUrls();
          const url = devtoolsUrl(server.resolvedUrls?.local[0], base);
          if (url) logger.info(`  \u279C  Pangular Inspector: ${url}`);
          if (lan.url) logger.info(`  \u279C  Pangular Inspector (LAN): ${lan.url}`);
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
