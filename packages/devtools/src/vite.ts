import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { normalizeHubBase } from '@devframes/hub/constants';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { isLoopbackHostname } from 'devframe/utils/origin';
import { PANGULAR_HUB_BASE, initPangularHub } from './hub.ts';
import { analogMiddleware, setDevOrigin } from './analog-server-log.ts';
import { analogConfig, setAnalogRoot } from './rpc/analog-scan.ts';
import { stopAnalog } from './rpc/analog-register.ts';
import { httpRegistry } from './http-rules.ts';
import { extensionOrigin, isAllowedExtensionOrigin } from './extension-origin.ts';
import { pickPangularConfig, resolvePangularConfig, type PangularConfig } from './config.ts';

export type { PangularConfig } from './config.ts';

export interface PangularViteOptions extends PangularConfig {
  base?: string;
  apiPrefix?: string;
  allowedOrigins?: string[];
  auth?: boolean;
}

export interface HubOriginPolicy {
  allowedHosts?: readonly string[] | true;
  allowedOrigins?: readonly string[];
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
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (policy.allowedOrigins?.includes(url.origin)) return true;
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

function webOrigin(entry: string): string {
  try {
    return new URL(entry).origin;
  } catch {
    return 'null';
  }
}

/**
 * Reduces each `allowedOrigins` entry to the origin a browser sends: no path or
 * trailing slash, and a lowercase host. Entries that are not URLs are dropped.
 */
export function normalizeAllowedOrigins(
  entries: readonly string[] | undefined,
  warn: (message: string) => void = () => undefined,
): string[] {
  const origins: string[] = [];
  for (const entry of entries ?? []) {
    const origin = extensionOrigin(entry) ?? webOrigin(entry);
    if (origin === 'null') {
      warn(
        `[pangular] Ignoring allowedOrigins entry "${entry}": it is not an origin such as https://tunnel.example.`,
      );
      continue;
    }
    if (origin !== entry) {
      warn(
        `[pangular] allowedOrigins entry "${entry}" is read as "${origin}". Browsers send the origin only, without a path.`,
      );
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

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
  if (!isLoopback(req.socket?.remoteAddress)) return false;
  const origin = req.headers?.origin;
  if (isAllowedHubOrigin(origin, policy)) return true;
  if (origin !== undefined) onBlockedOrigin?.(origin);
  return false;
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

export function releaseServerState(owner: unknown) {
  const registry = httpRegistry();
  if (registry.owner === owner) registry.dispose?.();
  stopAnalog(owner);
}

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
        auth: hubAuthFor(policy, options.auth),
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
