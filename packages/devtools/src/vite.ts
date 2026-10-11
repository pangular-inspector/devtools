import { isAuthTokens, type PangularAuthTokens } from './auth-tokens.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { normalizeHubBase } from '@devframes/hub/constants';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { isLoopbackHostname } from 'devframe/utils/origin';
import { PANGULAR_HUB_BASE, initPangularHub } from './hub.ts';
import { analogMiddleware, setDevOrigin } from './analog-server-log.ts';
import { analogConfig, setAnalogRoot } from './rpc/analog-scan.ts';
import { releaseServerState } from './server-state.ts';
import { extensionOrigin, isAllowedExtensionOrigin } from './extension-origin.ts';
import { normalizeAllowedOrigins, webOrigin } from './allowed-origins.ts';
import { pickPangularConfig, resolvePangularConfig, type PangularConfig } from './config.ts';

export type { PangularConfig } from './config.ts';

export interface PangularViteOptions extends PangularConfig {
  base?: string;
  apiPrefix?: string;
  allowedOrigins?: string[];
  /**
   * The one-time code: on, off, or on with pairing tokens (`{tokens}`) that a
   * client may send instead. Left out, it is on when a non-loopback host or
   * origin is allowed.
   */
  auth?: boolean | PangularAuthTokens;
  /**
   * Also answer requests from other machines, such as a phone on Wi-Fi, when
   * their origin is in `allowedOrigins`. Needs the one-time code on: with
   * `auth: false` it is ignored. Off by default: only this machine.
   */
  allowLan?: boolean;
}

export interface HubOriginPolicy {
  allowedHosts?: readonly string[] | true;
  allowedOrigins?: readonly string[];
  /** Answer requests from other machines whose origin is in `allowedOrigins`. */
  lan?: boolean;
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  const ip = address.startsWith('::ffff:') ? address.slice(7) : address;
  return ip === '::1' || ip.startsWith('127.');
}

function hostAllowed(hostname: string, allowedHosts: HubOriginPolicy['allowedHosts']): boolean {
  if (allowedHosts === true) return true;
  const host = hostname.toLowerCase();
  return (allowedHosts ?? []).some((entry) => {
    const rule = entry.toLowerCase();
    return rule.startsWith('.') ? host === rule.slice(1) || host.endsWith(rule) : host === rule;
  });
}

export function isAllowedHubOrigin(
  origin: string | undefined,
  policy: HubOriginPolicy = {},
): boolean {
  if (origin === undefined) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === 'chrome-extension:') {
      return isAllowedExtensionOrigin(origin, policy.allowedOrigins);
    }
    // Listed origins first, so a scheme such as capacitor:// can be allowed too.
    if (policy.allowedOrigins?.includes(webOrigin(origin))) return true;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isLoopbackHostname(url.hostname) || hostAllowed(url.hostname, policy.allowedHosts);
  } catch {
    return false;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

export { normalizeAllowedOrigins };

export function allowsRemoteOrigins(policy: HubOriginPolicy = {}): boolean {
  if (policy.allowedHosts === true) return true;
  const hosts = policy.allowedHosts ?? [];
  if (hosts.some((entry) => !isLoopbackHostname(entry.replace(/^\./, '').toLowerCase()))) {
    return true;
  }
  return (policy.allowedOrigins ?? []).some(
    (origin) => !isLoopbackOrigin(origin) && !extensionOrigin(origin),
  );
}

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

export function hubAuthFor(policy: HubOriginPolicy, auth?: boolean): boolean {
  return auth ?? allowsRemoteOrigins(policy);
}

export function hubOriginRegistryFor(policy: HubOriginPolicy = {}): WsOriginRegistry {
  return {
    token: '',
    registerFromUrl: () => undefined,
    isAllowed: (origin: string | undefined) => isAllowedHubOrigin(origin, policy),
  };
}

export const hubOriginRegistry: WsOriginRegistry = hubOriginRegistryFor();

function requestPath(url: string | undefined): string {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return url ?? '/';
  }
}

export function isHubPath(url: string | undefined, base: string): boolean {
  const hubBase = normalizeHubBase(base);
  const path = requestPath(url);
  return path === hubBase.slice(0, -1) || path.startsWith(hubBase);
}

export function isAllowedHubRequest(
  req: IncomingMessage,
  policy: HubOriginPolicy = {},
  onBlockedOrigin?: (origin: string) => void,
): boolean {
  if (!isLoopback(req.socket?.remoteAddress)) return isAllowedLanRequest(req, policy);
  const origin = req.headers?.origin;
  if (isAllowedHubOrigin(origin, policy)) return true;
  if (origin !== undefined) onBlockedOrigin?.(origin);
  return false;
}

/** A `Host` header that is a plain host or IP, with an optional port. */
const HOST_HEADER = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

/**
 * A request from another machine passes only with `lan` on and an origin
 * listed in `allowedOrigins`. A same-origin GET carries no `Origin`, so its
 * origin comes from the `Host` it was sent to. The one-time code still guards
 * the data: `lan` is only on while the code is.
 */
function isAllowedLanRequest(req: IncomingMessage, policy: HubOriginPolicy): boolean {
  if (!policy.lan || !policy.allowedOrigins?.length) return false;
  let origin = req.headers?.origin;
  if (origin === undefined) {
    const host = req.headers?.host;
    if (!host) return false;
    const secure = (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true;
    // Only a plain host and port, then read like an allowedOrigins entry:
    // `Host: 192.168.1.20:80` is the origin `http://192.168.1.20`.
    if (!HOST_HEADER.test(host)) return false;
    origin = webOrigin(`${secure ? 'https' : 'http'}://${host}`);
  }
  return policy.allowedOrigins.includes(origin);
}

/** Warns once per origin that the origin check turned away. */
export function blockedOriginReporter(warn: (message: string) => void) {
  const seen = new Set<string>();
  return (origin: string) => {
    if (seen.has(origin) || seen.size >= 20) return;
    seen.add(origin);
    warn(
      `[pangular] Refused a devtools request from ${origin}. Add it to allowedOrigins, or its host to server.allowedHosts, to allow it.`,
    );
  };
}

export function hubRequestGate(
  base: string,
  policy: HubOriginPolicy = {},
  onBlockedOrigin?: (origin: string) => void,
) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const forHub = isHubPath(req.url, base);
    if (requestPath(req.url).endsWith('/__connection.json') && !forHub) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (forHub && !isAllowedHubRequest(req, policy, onBlockedOrigin)) {
      res.statusCode = 403;
      res.end('Pangular Inspector only answers requests from this machine.');
      return;
    }
    next();
  };
}

type UpgradeListener = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export function hubUpgradeListener(
  base: string,
  policy: HubOriginPolicy,
  handleUpgrade: UpgradeListener,
  onBlockedOrigin?: (origin: string) => void,
): UpgradeListener {
  return (req, socket, head) => {
    if (!isHubPath(req.url, base)) return;
    if (isAllowedHubRequest(req, policy, onBlockedOrigin)) handleUpgrade(req, socket, head);
    else socket.destroy();
  };
}

export { releaseServerState } from './server-state.ts';

export default function pangularVite(options: PangularViteOptions = {}): Plugin {
  const base = normalizeHubBase(options.base ?? PANGULAR_HUB_BASE);
  const { config } = pickPangularConfig(options);
  const analog = resolvePangularConfig(config).inspectors.analog;
  return {
    name: 'pangular',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      const logger = server.config.logger;
      const policy: HubOriginPolicy = {
        allowedHosts: server.config.server?.allowedHosts,
        allowedOrigins: normalizeAllowedOrigins(options.allowedOrigins, (message) =>
          logger?.warn(message),
        ),
      };
      const authOn = isAuthTokens(options.auth) || hubAuthFor(policy, options.auth);
      policy.lan = lanAllowed(options.allowLan, authOn, policy, (message) => logger?.warn(message));
      const blocked = blockedOriginReporter((message) => logger?.warn(message));
      server.middlewares.use(hubRequestGate(base, policy, blocked));
      if (analog) {
        setAnalogRoot(server.config.root);
        const apiPrefix = options.apiPrefix ?? analogConfig(server.config.root).apiPrefix;
        server.middlewares.use(analogMiddleware(apiPrefix));
      }
      const httpServer = server.httpServer;
      const devtools = initPangularHub({
        ...config,
        base,
        ...(httpServer ? {} : { ws: { sidecar: true } }),
        auth: isAuthTokens(options.auth) ? options.auth : hubAuthFor(policy, options.auth),
        allowedOrigins: hubOriginRegistryFor(policy),
      });
      httpServer?.on('upgrade', hubUpgradeListener(base, policy, devtools.handleUpgrade, blocked));
      server.middlewares.use(devtools.nodeMiddleware);
      httpServer?.once('listening', () => {
        setDevOrigin(server.resolvedUrls?.local[0]);
      });
      httpServer?.once('close', () => {
        void devtools.context
          .then(releaseServerState, () => undefined)
          .finally(() => devtools.close());
      });
    },
  };
}
