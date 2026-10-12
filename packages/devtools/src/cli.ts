import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import type { CAC, Command } from 'cac';
import { defineDevframe } from 'devframe';
import { createCac } from 'devframe/adapters/cac';
import { createDevServer, resolveDevServerPort } from 'devframe/adapters/dev';
import { createInteractiveAuth } from 'devframe/recipes/interactive-auth';
import {
  accessLines,
  cliAccess,
  networkAddresses,
  setupSnippetLines,
  type CliAccess,
  type CliAccessFlags,
} from './cli-access.ts';
import pangular, { createPangular } from './devframe.ts';
import { mcpPrintConfig } from './mcp-print-config.ts';
import type { PangularConfig } from './config.ts';
import pkg from '../package.json' with { type: 'json' };

export const PANGULAR_CONFIG_FILE = 'pangular.config.json';
const SNIPPET_FETCH_MS = 2000;
const DEFAULT_PORT = 9999;

/**
 * Throws when `build` would delete something that is not a previous report.
 * devframe empties the output folder before it writes the report.
 */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(canonical(parent), basename(path));
  }
}

export function checkReportOutDir(
  outDir: string,
  options: { cwd?: string; force?: boolean; invokedFrom?: string } = {},
) {
  const cwd = canonical(resolve(options.cwd ?? process.cwd()));
  const target = canonical(resolve(cwd, outDir));
  const kept = [cwd, ...(options.invokedFrom ? [canonical(resolve(options.invokedFrom))] : [])];
  const holds = (dir: string) => {
    const up = relative(target, dir);
    return up === '' || (!up.startsWith('..') && !isAbsolute(up));
  };
  if (kept.some(holds)) {
    throw new Error(
      `[pangular] Refusing to build into "${outDir}": it is the working directory or one of its parents, and the build empties it first. Pick a new folder, such as --outDir dist-report.`,
    );
  }
  if (options.force || !existsSync(target)) return;
  const isReport = statSync(target).isDirectory()
    ? readdirSync(target).length === 0 || existsSync(join(target, '__connection.json'))
    : false;
  if (!isReport) {
    throw new Error(
      `[pangular] Refusing to build into "${outDir}": it is not empty and is not a previous report, and the build empties it first. Pick a new folder, or pass --force to replace it.`,
    );
  }
}

/**
 * Adds `--force` to `build` and checks `--outDir` before devframe empties it.
 * `invokedFrom` stays protected after `--root` changes the working directory.
 */
export function guardReportOutDir(cli: CAC, invokedFrom = process.cwd()) {
  const build = cli.commands.find((command) => command.name === 'build');
  const run = build?.commandAction;
  if (!build || !run) return;
  build.option('--force', 'Empty --outDir even when it is not a previous report');
  build.action(async (flags: { outDir: string; force?: boolean }) => {
    try {
      checkReportOutDir(flags.outDir, { force: flags.force, invokedFrom });
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
      return;
    }
    await run(flags);
  });
}

export interface PangularCliFlags extends CliAccessFlags {
  root?: string;
  proxyOrigin?: string;
  config?: string;
  readOnly?: boolean;
}

type Env = Record<string, string | undefined>;

/** Whether `dir` holds an Angular workspace or an app that depends on `@angular/core`. */
export function looksLikeAngularProject(dir: string): boolean {
  if (existsSync(join(dir, 'angular.json'))) return true;
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >;
    return ['dependencies', 'devDependencies', 'peerDependencies'].some(
      (field) => !!manifest[field]?.['@angular/core'],
    );
  } catch {
    return false;
  }
}

/**
 * The project folder the CLI scans: `--root`, then `PANGULAR_ROOT`, then the
 * working directory. Throws when the folder does not exist.
 */
export function resolveCliRoot(
  flags: PangularCliFlags,
  env: Env = process.env,
  cwd = process.cwd(),
) {
  const root = flags.root ?? env['PANGULAR_ROOT'];
  if (!root) return cwd;
  const dir = resolve(cwd, root);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`[pangular] The project folder "${root}" does not exist.`);
  }
  return dir;
}

/**
 * Reads the devtools config for the CLI: `--config`, then `PANGULAR_CONFIG`,
 * then `pangular.config.json` in the project folder. `--read-only` sets
 * `agent.readOnly` on top.
 */
export function loadCliConfig(
  flags: PangularCliFlags,
  root: string,
  env: Env = process.env,
  cwd = process.cwd(),
): PangularConfig {
  const named = flags.config ?? env['PANGULAR_CONFIG'];
  const file = named ? resolve(cwd, named) : join(root, PANGULAR_CONFIG_FILE);
  let config: PangularConfig = {};
  if (named || existsSync(file)) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      throw new Error(`[pangular] Can't read the config file "${file}".`);
    }
    try {
      config = JSON.parse(text) as PangularConfig;
    } catch (error) {
      throw new Error(
        `[pangular] The config file "${file}" is not valid JSON: ${(error as Error).message}`,
      );
    }
  }
  if (!flags.readOnly) return config;
  const agent = config.agent && typeof config.agent === 'object' ? config.agent : {};
  return { ...config, agent: { ...agent, readOnly: true } };
}

function copyCommand(cli: CAC, from: Command, name: string, description: string) {
  const command = cli.command(name, description);
  for (const option of from.options) {
    command.option(option.rawName, option.description, option.config);
  }
  return command;
}

/** What `createPangular()` gets for a command: pairing tokens only for the dev server. */
export function cliHostOptions(command: string, access: CliAccess) {
  return {
    pageTools: command !== 'mcp',
    authTokens: command === 'dev' ? access.authTokens : [],
  };
}

/** The path the overlay and the popup look for on the app's own origin. */
const PROXY_PATH = '/__pangular/';

/**
 * The panel URL behind the app's dev server proxy, from `--proxy-origin`: the
 * origin with `/__pangular/` when no path is given, or the given path.
 */
export function proxyPanelUrl(value: string): string {
  const url = URL.canParse(value) ? new URL(value) : undefined;
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(
      `[pangular] --proxy-origin needs an http or https URL, such as http://localhost:4200, not "${value}".`,
    );
  }
  const path = url.pathname === '/' ? PROXY_PATH : url.pathname.replace(/\/?$/, '/');
  return `${url.origin}${path}`;
}

/**
 * devframe's one-time code gate, with the code link printed for the app's
 * origin. The link it prints by default only trusts the CLI's own port.
 */
export function proxyAuth(panelUrl: string) {
  return (ctx: Parameters<typeof createInteractiveAuth>[0]) =>
    createInteractiveAuth(ctx, { serverUrl: () => panelUrl });
}

/** The lines the dev server prints once it listens. */
export function startupLines(
  origin: string,
  port: number,
  options: { mcp: boolean; requestedPort?: number; proxyUrl?: string },
): string[] {
  const base = origin.replace(/\/$/, '');
  const panel = `${base}/`;
  const lines = [
    `  pangular v${pkg.version}`,
    `  Panel: ${panel}`,
    ...(options.proxyUrl ? [`  Panel on your app: ${options.proxyUrl}`] : []),
    `  Angular Native apps: ${panel}?view=angular-native`,
  ];
  if (options.mcp) lines.push(`  MCP:   ${base}/__mcp`);
  if (options.requestedPort === undefined && port !== DEFAULT_PORT) {
    lines.push(`  Port ${DEFAULT_PORT} is taken, so the server uses port ${port}.`);
  }
  return lines;
}

interface PrintConfigFlags {
  printConfig?: boolean;
  host?: string;
  port?: number | string;
  base?: string;
  https?: boolean;
}

function addPrintConfigOptions(command: Command) {
  command.option('--print-config', 'Print MCP client config for this project and exit');
  command.option('--host <host>', 'With --print-config: host of the server that runs the app');
  command.option('--port <port>', 'With --print-config: port of that server (default: 9999)');
  command.option('--base <path>', 'With --print-config: the hub base, such as /__devframes/');
  command.option('--https', 'With --print-config: the server is behind TLS, so use an https URL');
}

/** The `--print-config` text, with the project folder and config file as absolute paths. */
function printConfig(flags: PangularCliFlags & PrintConfigFlags, env: Env): string {
  const named = flags.config ?? env['PANGULAR_CONFIG'];
  return mcpPrintConfig({
    root: resolveCliRoot(flags, env),
    ...(named ? { config: resolve(named) } : {}),
    readOnly: flags.readOnly,
    host: flags.host,
    port: flags.port,
    base: flags.base,
    https: flags.https === true,
    env,
  });
}

export interface PangularCliOptions {
  env?: Env;
  log?: (message: string) => void;
}

/**
 * The `pangular` command line: `dev` (the default), `build` and `mcp`, with
 * `--root`, `--config` and `--read-only` on each.
 */
export function createPangularCli(options: PangularCliOptions = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.log(message));
  let current = createPangular();
  let requestedPort: number | undefined;
  let mcpOn = true;
  let access: CliAccess = { allowedOrigins: [], authTokens: [] };
  let listenHost = 'localhost';
  let proxyUrl: string | undefined;
  const definition = defineDevframe({
    ...pangular,
    cli: { ...pangular.cli, command: 'pangular' },
    setup: (ctx, info) => current.setup(ctx, info),
  });

  const prepare = (command: string, flags: PangularCliFlags) => {
    const root = resolveCliRoot(flags, env);
    // `allowedOrigins` is a server option, so it stays out of the published config.
    const { allowedOrigins: fileOrigins, ...config } = loadCliConfig(
      flags,
      root,
      env,
    ) as PangularConfig & {
      allowedOrigins?: unknown;
    };
    access = cliAccess(flags, fileOrigins, env);
    // With --no-auth, devframe trusts every client through its own handshake;
    // ours would replace it and trust only token holders.
    if ((flags as { auth?: boolean }).auth === false && access.authTokens.length) {
      console.warn(
        '[pangular] Ignoring the pairing tokens: --no-auth already trusts every client.',
      );
      access = { ...access, authTokens: [] };
    }
    if (root !== process.cwd()) process.chdir(root);
    if (!looksLikeAngularProject(root)) {
      console.error(
        `[pangular] ${root} has no angular.json and no package.json that depends on @angular/core, so the source scans find nothing. Pass --root <dir> or set PANGULAR_ROOT to your project folder.`,
      );
    }
    current = createPangular(config, cliHostOptions(command, access));
  };

  const configureCli = (cli: CAC) => {
    guardReportOutDir(cli);
    cli.option('--root <dir>', 'Project folder to scan (default: the working directory)');
    cli.option('--config <file>', `Devtools config as JSON (default: ${PANGULAR_CONFIG_FILE})`);
    cli.option('--read-only', 'Drop the agent tools that act on the page or the server');
    cli.option(
      '--allowed-origin <origin>',
      'An extra origin allowed to reach the server, such as http://192.168.1.20:8100 (repeat for more)',
    );
    cli.option(
      '--auth-token <token>',
      'A pairing token a client may send instead of the one-time code (repeat for more; prefer PANGULAR_AUTH_TOKEN)',
    );
    const defaultCommand = cli.commands.find((command) => command.isDefaultCommand);
    if (defaultCommand) {
      const run = async (
        flags: PangularCliFlags & { port?: number; host?: string; mcp?: boolean },
      ) => {
        prepare('dev', flags);
        requestedPort = flags.port === undefined ? undefined : Number(flags.port);
        mcpOn = flags.mcp !== false;
        listenHost = flags.host ?? 'localhost';
        proxyUrl = flags.proxyOrigin ? proxyPanelUrl(flags.proxyOrigin) : undefined;
        // createCac's own dev action, plus the origins it does not forward.
        const port =
          requestedPort ??
          (await resolveDevServerPort(definition, { host: listenHost, defaultPort: DEFAULT_PORT }));
        await createDevServer(definition, {
          host: listenHost,
          port,
          flags: flags as Record<string, unknown>,
          mcp: flags.mcp ?? true,
          ...(access.allowedOrigins.length ? { allowedOrigins: access.allowedOrigins } : {}),
          // devframe builds the handler from a function too; its dev server
          // types only list the handler object. `--no-auth` still turns it off.
          ...(proxyUrl ? { auth: proxyAuth(proxyUrl) as unknown as boolean } : {}),
          onReady,
        });
      };
      defaultCommand.option(
        '--proxy-origin <origin>',
        "Your app's dev server origin that proxies /__pangular/ to this server, such as http://localhost:4200, so the one-time code link opens there",
      );
      copyCommand(cli, defaultCommand, 'dev', 'Start a local dev server (the default)').action(run);
      defaultCommand.description = 'Same as dev';
      defaultCommand.action(async (args: string[], flags: PangularCliFlags) => {
        if (args.length) {
          throw new Error(
            `[pangular] Unknown command "${args[0]}". Run pangular --help to list the commands.`,
          );
        }
        await run(flags);
      });
    }
    for (const name of ['build', 'mcp']) {
      const command = cli.commands.find((entry) => entry.name === name);
      const run = command?.commandAction;
      if (!command || !run) continue;
      if (name === 'mcp') addPrintConfigOptions(command);
      command.action(async (flags: PangularCliFlags & PrintConfigFlags) => {
        if (name === 'mcp' && flags.printConfig) {
          log(printConfig(flags, env).trimEnd());
          return;
        }
        prepare(name, flags);
        await run(flags);
      });
    }
  };

  const onReady = async ({ origin, port }: { origin: string; port: number }) => {
    log(
      `\n${[...startupLines(origin, port, { mcp: mcpOn, requestedPort, proxyUrl }), ...accessLines(access)].join('\n')}\n`,
    );
    const addresses = networkAddresses(listenHost);
    if (!addresses.length) return;
    // The server's own connection info, so the printed call carries its config.
    // A server that doesn't answer in time just gets no snippet.
    const meta = await fetch(`http://${addresses[0]}:${port}/__connection.json`, {
      signal: AbortSignal.timeout(SNIPPET_FETCH_MS),
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined);
    const snippet = setupSnippetLines(addresses, port, meta, access.authTokens.length > 0);
    if (snippet.length) log(`${snippet.join('\n')}\n`);
  };

  const { cli } = createCac(definition, {
    mcp: true,
    defaultPort: DEFAULT_PORT,
    configureCli,
    onReady,
  });
  cli.globalCommand.versionNumber = pkg.version;

  return {
    cli,
    async parse(argv = process.argv) {
      try {
        cli.parse(argv, { run: false });
        await cli.runMatchedCommand();
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        console.error(
          message.startsWith('[pangular]')
            ? message
            : `[pangular] ${message}. Run pangular --help for the commands and flags.`,
        );
        process.exitCode = 1;
      }
    },
  };
}
