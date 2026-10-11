// Who may reach the standalone CLI server, beyond devframe's defaults:
// extra origins (`--allowed-origin`, or `allowedOrigins` in the config file),
// and pairing tokens (`--auth-token`, or PANGULAR_AUTH_TOKEN).
import { networkInterfaces } from 'node:os';
import { authTokensFrom, authTokensFromEnv, maskToken } from './auth-tokens.ts';
import { normalizeAllowedOrigins } from './allowed-origins.ts';

export interface CliAccessFlags {
  allowedOrigin?: string | string[];
  authToken?: string | string[];
}

export interface CliAccess {
  allowedOrigins: string[];
  authTokens: string[];
}

type Env = Record<string, string | undefined>;

function list(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** The extra origins and pairing tokens from the flags, the config file and the environment. */
export function cliAccess(
  flags: CliAccessFlags,
  fileOrigins: unknown,
  env: Env,
  warn: (message: string) => void = (message) => console.warn(message),
): CliAccess {
  const origins = [...list(fileOrigins), ...list(flags.allowedOrigin)].filter(
    (origin): origin is string => typeof origin === 'string',
  );
  return {
    allowedOrigins: normalizeAllowedOrigins(origins, warn),
    authTokens: [
      ...new Set([...authTokensFrom(list(flags.authToken), warn), ...authTokensFromEnv(env, warn)]),
    ],
  };
}

/** Lines for the startup output. Tokens are never printed whole. */
export function accessLines(access: CliAccess): string[] {
  const lines: string[] = [];
  if (access.allowedOrigins.length) {
    lines.push(`  Allowed origins: ${access.allowedOrigins.join(', ')}`);
  }
  if (access.authTokens.length) {
    lines.push(`  Pairing tokens: ${access.authTokens.map(maskToken).join(', ')}`);
  }
  return lines;
}

/** Whether a bind host listens beyond loopback: every interface, or a network address. */
export function listensOnNetwork(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare === '0.0.0.0' || bare === '::') return true;
  return !(bare === 'localhost' || bare === '::1' || bare.startsWith('127.'));
}

/** The machine's non-internal IPv4 addresses, or `host` itself when it names one. */
export function networkAddresses(
  host: string,
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] {
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare !== '0.0.0.0' && bare !== '::') return listensOnNetwork(host) ? [bare] : [];
  const addresses: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (!entry.internal && (entry.family === 'IPv4' || (entry.family as unknown) === 4)) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

/**
 * A ready-to-paste `initOverlay()` call for a device, with the server's whole
 * connection info, so the app gets its config too. The token stays a
 * placeholder.
 */
export function setupSnippetLines(
  addresses: string[],
  port: number,
  connectionMeta: unknown,
  tokens: boolean,
): string[] {
  if (!addresses.length || !connectionMeta || typeof connectionMeta !== 'object') return [];
  const urls = addresses.map((address) => `http://${address}:${port}/`);
  const meta = JSON.stringify(connectionMeta);
  return [
    `  On your network: ${urls.join(', ')}`,
    '  For an app on a device (Capacitor, development builds only), in src/main.ts:',
    '    bootstrapApplication(App, appConfig)',
    '      .then(async () => {',
    "        if (typeof ngDevMode === 'undefined' || ngDevMode) {",
    "          const {initOverlay} = await import('@pangular-inspector/devtools/overlay-manual');",
    '          await initOverlay({',
    `            baseURL: '${urls[0]}',`,
    `            connectionMeta: ${meta},`,
    ...(tokens
      ? [
          "            // authToken: '<one of the pairing tokens>', kept out of git: see the Capacitor guide",
        ]
      : []),
    '          });',
    '        }',
    '      })',
    '      .catch((err) => console.error(err));',
  ];
}
