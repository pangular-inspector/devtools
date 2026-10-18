import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { normalizeHubBase } from '@devframes/hub/constants';
import type { WsOriginRegistry } from 'devframe/rpc/transports/ws-server';
import { isLoopbackHostname } from 'devframe/utils/origin';
import { extensionOrigin, isAllowedExtensionOrigin } from './extension-origin.ts';
import { webOrigin } from './allowed-origins.ts';

/**
 * The request gate both servers put in front of the hub: the Vite plugin and
 * the Express hub (`initPangularHub()`). A request passes when it comes from a
 * loopback address, names a loopback or allowed host (or an Android emulator's
 * address for this machine) in `Host`, and carries an
 * allowed `Origin`, or no `Origin` and no cross-site `Sec-Fetch-Site`.
 */
export interface HubOriginPolicy {
  allowedHosts?: readonly string[] | true;
  allowedOrigins?: readonly string[];
  /** Another origin check that can allow an origin, such as a custom origin registry. */
  isAllowedOrigin?: (origin: string) => boolean;
  /** Answer requests from other machines whose origin is in `allowedOrigins` (the Vite plugin). */
  lan?: boolean;
  /**
   * Answer requests from other machines whose `Origin` passes the origin
   * check, or that send none (the Express hub's `allowLan`). Their `Host`
   * must be an IP address, a `.local` name or an allowed host, which refuses
   * a DNS rebinding name.
   */
  remote?: boolean;
}

export function isLoopback(address: string | undefined): boolean {
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

/**
 * Whether an `Origin` may reach the hub: a loopback origin, one listed in
 * `allowedOrigins`, or one whose host is listed in `allowedHosts`.
 * `allowedHosts: true` lets any `Host` through but is no origin wildcard: it
 * only adds a same-origin request, whose `Origin` names the `Host` it was sent
 * to (`requestHost`), as a page served through a tunnel does. A website on
 * another origin still gets refused.
 */
export function isAllowedHubOrigin(
  origin: string | undefined,
  policy: HubOriginPolicy = {},
  requestHost?: string,
): boolean {
  if (origin === undefined) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === 'chrome-extension:') {
      return (
        isAllowedExtensionOrigin(origin, policy.allowedOrigins) ||
        policy.isAllowedOrigin?.(origin) === true
      );
    }
    // Listed origins first, so a scheme such as capacitor:// can be allowed too.
    if (policy.allowedOrigins?.includes(webOrigin(origin))) return true;
    if (policy.isAllowedOrigin?.(origin)) return true;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (isLoopbackHostname(url.hostname)) return true;
    if (policy.allowedHosts === true) {
      if (requestHost === undefined || !HOST_HEADER.test(requestHost)) return false;
      return url.host === new URL(`${url.protocol}//${requestHost}`).host;
    }
    return hostAllowed(url.hostname, policy.allowedHosts);
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

/**
 * The origin check for the hub's WebSocket server. It sees no `Host`, so with
 * `allowedHosts: true` it refuses every origin that isn't loopback or listed,
 * unless `gated`: the request gate already checked the upgrade against its
 * `Host` (`isAllowedHubRequest`), so a same-origin tunnel page passes.
 */
export function hubOriginRegistryFor(
  policy: HubOriginPolicy = {},
  gated = false,
): WsOriginRegistry {
  return {
    token: '',
    registerFromUrl: () => undefined,
    isAllowed: (origin: string | undefined) => {
      if (isAllowedHubOrigin(origin, policy)) return true;
      if (!gated || policy.allowedHosts !== true || origin === undefined) return false;
      try {
        const { protocol } = new URL(origin);
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    },
  };
}

/**
 * The startup warning for Vite's `server.allowedHosts: true`, or undefined.
 * Vite then stops checking `Host`, so DNS rebinding reaches the dev server.
 * The devtools still check `Origin`, and the one-time code still guards the
 * data, unless `auth` is off.
 */
export function allowedHostsWarning(
  allowedHosts: HubOriginPolicy['allowedHosts'],
  authOn: boolean,
): string | undefined {
  if (allowedHosts !== true) return undefined;
  return authOn
    ? '[pangular] server.allowedHosts is true, so any Host reaches the dev server. The devtools still refuse other websites by their Origin, and ask for the one-time code. List your hosts in server.allowedHosts instead, such as [".ngrok-free.app"].'
    : '[pangular] WARNING: server.allowedHosts is true and auth is false. Any Host reaches the dev server, and a website that rebinds its DNS name to this machine can read the devtools with no code. Turn the one-time code back on, or list your hosts in server.allowedHosts.';
}

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

/** A `Host` header that is a plain host or IP, with an optional port. */
const HOST_HEADER = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

function hostnameOf(host: string): string | undefined {
  if (!HOST_HEADER.test(host)) return undefined;
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Whether the `Host` header names this machine or a host the config allows:
 * a loopback host, a host in `allowedHosts`, or the host of an allowed origin.
 * A page that rebinds its own DNS name to 127.0.0.1 still sends its own name,
 * so this refuses it. A request without `Host` passes: browsers always send it.
 */
export function isAllowedHubHost(host: string | undefined, policy: HubOriginPolicy = {}): boolean {
  if (host === undefined) return true;
  const hostname = hostnameOf(host);
  if (hostname === undefined) return false;
  if (isLoopbackHostname(hostname) || hostAllowed(hostname, policy.allowedHosts)) return true;
  const listed = (policy.allowedOrigins ?? []).some((origin) => {
    try {
      const url = new URL(origin);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === hostname;
    } catch {
      return false;
    }
  });
  if (listed) return true;
  const check = policy.isAllowedOrigin;
  return check !== undefined && (check(`http://${host}`) || check(`https://${host}`));
}

/**
 * A browser request without `Origin` must say where it comes from: a
 * `Sec-Fetch-Site` of `same-origin`, `same-site` or `none` (typed in the
 * address bar). A cross-site one, such as an image load from another
 * website, is refused. Clients that send neither header, such as curl or a
 * native app, are not browsers, and pass.
 */
export function isAllowedFetchSite(req: IncomingMessage): boolean {
  if (req.headers?.origin !== undefined) return true;
  const site = req.headers?.['sec-fetch-site'];
  if (site === undefined) return true;
  return site === 'same-origin' || site === 'same-site' || site === 'none';
}

/**
 * The addresses an Android emulator uses for the machine that runs it: `10.0.2.2`
 * (the SDK emulator) and `10.0.3.2` (Genymotion). The emulator forwards them
 * to the host's loopback interface, so a request sent to one arrives from a
 * loopback address with that IP in `Host`.
 */
const EMULATOR_HOSTS: ReadonlySet<string> = new Set(['10.0.2.2', '10.0.3.2']);

/**
 * Whether `Host` is the address an Android emulator reaches this machine at.
 * Only checked for a request from a loopback address: an IP literal cannot
 * be a DNS rebinding name, and on this machine those addresses lead nowhere
 * but the emulator. Its `Origin` and `Sec-Fetch-Site` are still checked.
 */
function isEmulatorHost(host: string | undefined): boolean {
  const hostname = host === undefined ? undefined : hostnameOf(host);
  return hostname !== undefined && EMULATOR_HOSTS.has(hostname);
}

/**
 * The `Host` of a request from another machine (`allowLan`, or the CLI on a
 * network address): an IP address, a `.local` name, or a host the config
 * allows. A DNS rebinding page always sends its own DNS name, so a page in
 * the developer's browser pointed at this machine's LAN address by a
 * rebound name gets refused, while a device that types the IP passes.
 */
function isAllowedRemoteHost(host: string | undefined, policy: HubOriginPolicy): boolean {
  if (host === undefined) return true;
  const hostname = hostnameOf(host);
  if (hostname === undefined) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) return true;
  if (hostname.endsWith('.local')) return true;
  return isAllowedHubHost(host, policy);
}

/** What the gate refused: an `Origin`, or the `Host` a request was sent to. */
export type BlockedRequest = (value: string, kind?: 'origin' | 'host') => void;

export function isAllowedHubRequest(
  req: IncomingMessage,
  policy: HubOriginPolicy = {},
  onBlocked?: BlockedRequest,
): boolean {
  if (!isAllowedFetchSite(req)) return false;
  const local = isLoopback(req.socket?.remoteAddress);
  if (!local && !policy.remote) return isAllowedLanRequest(req, policy);
  const host = req.headers?.host;
  if (local && !isAllowedHubHost(host, policy) && !isEmulatorHost(host)) {
    if (host !== undefined) onBlocked?.(host, 'host');
    return false;
  }
  if (!local && !isAllowedRemoteHost(host, policy)) {
    if (host !== undefined) onBlocked?.(host, 'host');
    return false;
  }
  const origin = req.headers?.origin;
  if (isAllowedHubOrigin(origin, policy, host)) return true;
  if (origin !== undefined) onBlocked?.(origin, 'origin');
  return false;
}

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

/** Warns once per origin or host that the gate turned away. */
export function blockedOriginReporter(warn: (message: string) => void): BlockedRequest {
  const seen = new Set<string>();
  return (value, kind = 'origin') => {
    const key = `${kind} ${value}`;
    if (seen.has(key) || seen.size >= 20) return;
    seen.add(key);
    warn(
      kind === 'host'
        ? `[pangular] Refused a devtools request sent to the host ${value}. Add the host to server.allowedHosts, or its origin to allowedOrigins, to allow it.`
        : `[pangular] Refused a devtools request from ${value}. Add it to allowedOrigins, or its host to server.allowedHosts, to allow it.`,
    );
  };
}

const REFUSED = 'Pangular Inspector only answers requests from this machine.';

/** Answers a refused request with `403` and what to change. */
export function refuseHubRequest(req: IncomingMessage, res: ServerResponse, fix: string): void {
  res.statusCode = 403;
  res.end(isLoopback(req.socket?.remoteAddress) ? REFUSED : `${REFUSED} ${fix}`);
}

const VITE_LAN_FIX =
  'To answer other machines, set allowLan: true and list their origin in allowedOrigins.';

export function hubRequestGate(
  base: string,
  policy: HubOriginPolicy = {},
  onBlocked?: BlockedRequest,
) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const forHub = isHubPath(req.url, base);
    if (requestPath(req.url).endsWith('/__connection.json') && !forHub) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (forHub && !isAllowedHubRequest(req, policy, onBlocked)) {
      refuseHubRequest(req, res, VITE_LAN_FIX);
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
  onBlocked?: BlockedRequest,
): UpgradeListener {
  return (req, socket, head) => {
    if (!isHubPath(req.url, base)) return;
    if (isAllowedHubRequest(req, policy, onBlocked)) handleUpgrade(req, socket, head);
    else socket.destroy();
  };
}
