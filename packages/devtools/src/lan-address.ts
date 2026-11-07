// LAN address injection (`lanAddress` on the Vite plugin, `--lan-address` on
// `pangular dev`). Off by default. It only hands an app the address of a
// server that already answers other machines: the Vite plugin needs
// `allowLan` in effect (the one-time code on and a network origin listed),
// and both need the server listening on the network. It never widens who
// can reach the server.
import { networkInterfaces } from 'node:os';
import { listensOnNetwork, networkAddresses } from './cli-access.ts';
import type { ResolvedLanAddress } from './config.ts';
import { LAN_URL_DEFINE } from './lan-url.ts';

export { LAN_URL_DEFINE };

type Interfaces = ReturnType<typeof networkInterfaces>;

const PRIVATE = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];

/**
 * The machine's LAN address: the first private IPv4 address (10/8, 172.16/12,
 * 192.168/16), else the first other non-internal one, else `undefined`.
 */
export function pickLanAddress(interfaces: Interfaces = networkInterfaces()): string | undefined {
  const addresses = networkAddresses('0.0.0.0', interfaces);
  return addresses.find((address) => PRIVATE.some((range) => range.test(address))) ?? addresses[0];
}

/** Vite's `server.host` as a bind host: `true` and `''` listen everywhere, unset is loopback. */
export function viteBindHost(host: unknown): string {
  if (host === true || host === '') return '0.0.0.0';
  return typeof host === 'string' ? host : 'localhost';
}

/** The `define` entry that injects `url`, for Vite, esbuild or webpack's `DefinePlugin`. */
export function lanDefine(url: string): Record<string, string> {
  return { [LAN_URL_DEFINE]: JSON.stringify(url) };
}

export interface LanUrlInput {
  lan: ResolvedLanAddress;
  /** The host the server binds to. */
  host: string;
  port: number;
  /** The path the devtools answer on, with a trailing slash. */
  path: string;
  https?: boolean;
  interfaces?: Interfaces;
}

/**
 * The devtools URL to inject, or why there is none. With a bind host on one
 * network address, that address is the only one that answers, so it wins
 * over the machine's first address.
 */
export function lanUrl(input: LanUrlInput): { url: string } | { problem: string } {
  if (!input.lan.on) return { problem: 'lanAddress is off.' };
  if (!listensOnNetwork(input.host)) {
    return {
      problem: `the server listens on ${input.host} only, so other machines can't reach it. Start it on the network (Vite: server.host; CLI: --host 0.0.0.0).`,
    };
  }
  const bound = networkAddresses(input.host, input.interfaces);
  const all = input.host === '0.0.0.0' || input.host === '::' || input.host === '[::]';
  const address = all
    ? (input.lan.address ?? pickLanAddress(input.interfaces))
    : (bound[0] ?? input.lan.address);
  if (!address) return { problem: 'this machine has no network address.' };
  if (!all && input.lan.address && input.lan.address !== address) {
    return {
      problem: `the server listens on ${address} only, not on ${input.lan.address}.`,
    };
  }
  const scheme = input.https ? 'https' : 'http';
  return { url: `${scheme}://${address}:${input.port}${input.path}` };
}

/**
 * What `pangular dev --lan-address` prints once it listens: the URL and the
 * define to pass to the app's development build. The CLI does not build the
 * app, so the build injects it.
 */
export function cliLanLines(url: string): string[] {
  const value = `'${url}'`;
  return [
    `  LAN address for a device build: ${url}`,
    `  Inject it as ${LAN_URL_DEFINE}, for example in an Angular CLI app:`,
    `    ng build --configuration development --define "${LAN_URL_DEFINE}=${value}"`,
  ];
}
