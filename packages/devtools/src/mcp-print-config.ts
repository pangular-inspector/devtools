// `pangular mcp --print-config`: the MCP client config for this project, ready
// to paste. It names the token file and the variable that holds the token,
// never the token itself.
import { PANGULAR_MCP_TOKEN_ENV, mcpTokenFile } from './mcp-token.ts';

/** The package name `npx` runs for the stdio server. */
const PACKAGE = '@pangular-inspector/devtools';
/** The stdio server's name in the client config. */
const SERVER_NAME = 'pangular';
/**
 * The HTTP server's name. It differs from the stdio one: Claude Code prefers a
 * local entry over a project one of the same name, so a shared name would hide
 * the HTTP server whenever both are added.
 */
const HTTP_SERVER_NAME = 'pangular-live';
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 9999;

export interface McpPrintConfigOptions {
  /** The absolute project folder the stdio server scans. */
  root: string;
  /** An absolute config file to pass to the stdio server. */
  config?: string;
  readOnly?: boolean;
  /** Host and port of the server that runs the app. Default: the standalone CLI on localhost:9999. */
  host?: string;
  port?: number | string;
  /** Whether the server is behind TLS, so the endpoint is `https://`. */
  https?: boolean;
  /**
   * The hub base, such as `/__devframes/`. Without it, the endpoint is the
   * standalone CLI's `/__mcp`, which asks for no token.
   */
  base?: string;
  env?: Record<string, string | undefined>;
}

/**
 * The `--port` of `--print-config` as a number: a whole number from 1 to
 * 65535, or `undefined` when it was left out. Throws on anything else.
 */
export function printConfigPort(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  const port = /^\d+$/.test(text) ? Number(text) : NaN;
  if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
  throw new Error(
    `[pangular] --port must be a whole number from 1 to 65535, not "${String(value)}".`,
  );
}

/** Quotes `value` for a POSIX shell when it holds anything but plain path characters. */
export function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeBase(base: string): string {
  return `/${base}/`.replace(/\/{2,}/g, '/');
}

/** A host a client can reach: a wildcard bind address becomes `localhost`. */
function clientHost(host: string): string {
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare === '0.0.0.0' || bare === '::' || bare === '') return DEFAULT_HOST;
  return bare.includes(':') ? `[${bare}]` : bare;
}

/** Whether `host` (as `clientHost` returns it) names this machine. */
export function isLoopbackHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    /^127(\.\d{1,3}){3}$/.test(bare) ||
    bare === '::1' ||
    bare === '0:0:0:0:0:0:0:1' ||
    /^::ffff:127(\.\d{1,3}){3}$/.test(bare)
  );
}

/** The HTTP endpoint, its `Origin` and whether it asks for the bearer token. */
export function mcpEndpoint(
  options: Pick<McpPrintConfigOptions, 'host' | 'port' | 'base' | 'https'>,
) {
  const scheme = options.https ? 'https' : 'http';
  const origin = `${scheme}://${clientHost(options.host ?? DEFAULT_HOST)}:${options.port ?? DEFAULT_PORT}`;
  const hub = options.base !== undefined && normalizeBase(options.base) !== '/';
  const base = hub ? normalizeBase(options.base as string) : '/';
  return { url: `${origin}${base}__mcp`, origin, token: hub };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** The text `pangular mcp --print-config` prints. */
export function mcpPrintConfig(options: McpPrintConfigOptions): string {
  const args = [
    PACKAGE,
    'mcp',
    '--root',
    options.root,
    ...(options.config ? ['--config', options.config] : []),
    ...(options.readOnly ? ['--read-only'] : []),
  ];
  const { url, origin, token } = mcpEndpoint(options);
  const clearText =
    token && !options.https && !isLoopbackHost(clientHost(options.host ?? DEFAULT_HOST));
  const bearer = (variable: string) => `Bearer ${variable}`;
  const headers = (variable: string) => ({
    ...(token ? { Authorization: bearer(variable) } : {}),
    Origin: origin,
  });
  const claudeHeaders = [
    `--header ${shellQuote(`Origin: ${origin}`)}`,
    ...(token
      ? [`--header ${shellQuote(`Authorization: ${bearer(`\${${PANGULAR_MCP_TOKEN_ENV}}`)}`)}`]
      : []),
  ];

  const lines = [
    'Pangular Inspector MCP config',
    '',
    '== stdio: source scans only, no page connects ==',
    '',
    'Claude Code (run in the project folder):',
    `  claude mcp add ${SERVER_NAME} -- npx ${args.map(shellQuote).join(' ')}`,
    '',
    'Cursor (.cursor/mcp.json):',
    json({ mcpServers: { [SERVER_NAME]: { command: 'npx', args } } }),
    '',
    'VS Code (.vscode/mcp.json):',
    json({ servers: { [SERVER_NAME]: { type: 'stdio', command: 'npx', args } } }),
    '',
    `== HTTP: live pages, at ${url} ==`,
    '',
    ...(clearText
      ? [
          `Warning: ${origin} is not a loopback address and the URL is http, so the MCP token travels in clear text on the network.`,
          'Serve the hub over TLS and pass --https, or keep it to a network you trust.',
          '',
        ]
      : []),
    'Start the server that runs your app and open the app in a browser first.',
    '',
    'Claude Code (writes .mcp.json in the project folder):',
    `  claude mcp add --transport http --scope project ${HTTP_SERVER_NAME} ${url} ${claudeHeaders.join(' ')}`,
    '',
    'Cursor (.cursor/mcp.json):',
    json({
      mcpServers: {
        [HTTP_SERVER_NAME]: { url, headers: headers(`\${env:${PANGULAR_MCP_TOKEN_ENV}}`) },
      },
    }),
    '',
    'VS Code (.vscode/mcp.json):',
    json({
      ...(token
        ? {
            inputs: [
              {
                type: 'promptString',
                id: 'pangular-token',
                description: 'Pangular Inspector MCP token',
                password: true,
              },
            ],
          }
        : {}),
      servers: {
        [HTTP_SERVER_NAME]: { type: 'http', url, headers: headers('${input:pangular-token}') },
      },
    }),
    '',
  ];
  if (token) {
    lines.push(
      `The hub keeps its MCP token in ${mcpTokenFile(options.env)}. Claude Code and Cursor read it from ${PANGULAR_MCP_TOKEN_ENV}:`,
      `  export ${PANGULAR_MCP_TOKEN_ENV}="$(cat ${shellQuote(mcpTokenFile(options.env))})"`,
      `If the server sets ${PANGULAR_MCP_TOKEN_ENV} itself, use that value. VS Code asks for the token once.`,
      'Leave the Authorization header out when the hub runs with auth: false.',
    );
  } else {
    lines.push(
      'The standalone CLI asks for no token. For the Express hub or the Vite plugin, pass --base /__devframes/ and their port.',
    );
  }
  return `${lines.join('\n')}\n`;
}
