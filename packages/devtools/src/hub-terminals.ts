import type { InitHubOptions } from '@devframes/hub/initiate';
import { PLUGIN_ID as TERMINALS_DOCK_ID } from '@devframes/plugin-terminals/constants';
import type { DevframeDefinition } from 'devframe';
import { detectTerminalCommands, type TerminalCommand } from './terminal-commands.ts';
import {
  TerminalRunner,
  type TerminalRunnerOptions,
  type TerminalsHostLike,
} from './terminal-runner.ts';

/** Why the hub runs no terminals although `terminals: true` was passed, or `undefined`. */
export function terminalsRefusal(context: {
  env?: Record<string, string | undefined>;
  /** The hub's origin check is off (`allowedOrigins: false`). */
  originCheckOff?: boolean;
  /** Other machines can reach the hub (`allowLan`). */
  remote?: boolean;
}): string | undefined {
  if ((context.env ?? process.env)['NODE_ENV'] === 'production') {
    return 'NODE_ENV is production';
  }
  if (context.originCheckOff) return 'allowedOrigins is false, so the origin check is off';
  if (context.remote) return 'allowLan lets other machines reach the hub';
  return undefined;
}

/**
 * Whether the hub runs the terminals dock: only when `terminals` is `true`,
 * in development, behind the hub's origin check and for this machine only.
 * Any other value keeps it off; a value that is not a boolean, or `true` in a
 * setup that refuses it, says so once through `warn`.
 */
export function terminalsEnabled(
  terminals: unknown,
  context: Parameters<typeof terminalsRefusal>[0],
  warn: (message: string) => void = console.warn,
): boolean {
  if (terminals === undefined || terminals === false) return false;
  if (terminals !== true) {
    warn(`[pangular] Ignoring terminals: ${JSON.stringify(terminals)}. Pass true to turn it on.`);
    return false;
  }
  const refusal = terminalsRefusal(context);
  if (refusal) {
    warn(`[pangular] The terminals dock is off: ${refusal}.`);
    return false;
  }
  return true;
}

interface HubTerminalsContext {
  cwd?: string;
  terminals?: unknown;
  commands?: { register: (command: TerminalPaletteCommand) => unknown };
  docks?: { activate?: (dockId: string, params?: Record<string, unknown>) => void };
  install: (devframe: DevframeDefinition, options?: { base?: string }) => Promise<void>;
}

interface TerminalPaletteCommand {
  id: string;
  title: string;
  category: string;
  description?: string;
  handler: () => void;
}

function isTerminalsHost(value: unknown): value is TerminalsHostLike {
  const host = value as Partial<TerminalsHostLike> | null;
  return (
    !!host &&
    host.sessions instanceof Map &&
    typeof host.register === 'function' &&
    typeof host.update === 'function' &&
    typeof host.remove === 'function'
  );
}

const CATEGORY = 'Pangular Inspector';

/** The hub palette commands for the detected commands: run (or run again) and stop each one. */
export function registerTerminalCommands(
  ctx: Pick<HubTerminalsContext, 'commands' | 'docks'>,
  runner: TerminalRunner,
): string[] {
  if (typeof ctx.commands?.register !== 'function') return [];
  const ids: string[] = [];
  for (const command of runner.commands) {
    const run = {
      id: `pangular:terminal:run-${command.id}`,
      title: `Pangular: run ${command.title}`,
      category: CATEGORY,
      description: `Runs the project's ${command.id} command in the terminals dock, or runs it again.`,
      handler: () => {
        const sessionId = runner.start(command.id);
        ctx.docks?.activate?.(TERMINALS_DOCK_ID, { sessionId });
      },
    };
    const stop = {
      id: `pangular:terminal:stop-${command.id}`,
      title: `Pangular: stop ${command.title}`,
      category: CATEGORY,
      handler: () => runner.stop(command.id),
    };
    ctx.commands.register(run);
    ctx.commands.register(stop);
    ids.push(run.id, stop.id);
  }
  return ids;
}

/** Holds the runner the hub started, so closing the hub stops its commands. */
export interface HubTerminals {
  runner?: TerminalRunner;
  dispose: () => void;
}

export function hubTerminals(): HubTerminals {
  const handle: HubTerminals = {
    dispose: () => {
      handle.runner?.dispose();
      handle.runner = undefined;
    },
  };
  return handle;
}

export interface SetupTerminalsOptions {
  /** Defaults to `ctx.cwd`, then the process directory. */
  cwd?: string;
  /** Defaults to `detectTerminalCommands(cwd)`. */
  commands?: TerminalCommand[];
  runner?: Omit<TerminalRunnerOptions, 'cwd'>;
  warn?: (message: string) => void;
}

/**
 * Starts the terminals in a hub context: detects the build and test commands,
 * runs them as `ctx.terminals` sessions, installs the terminals dock under the
 * hub base, and adds the run and stop commands to the hub palette. Does
 * nothing outside a hub or when the project has neither command.
 */
export async function setupHubTerminals(
  ctx: HubTerminalsContext,
  hubBase: string,
  handle: HubTerminals,
  options: SetupTerminalsOptions = {},
): Promise<TerminalRunner | undefined> {
  const warn = options.warn ?? console.warn;
  if (!isTerminalsHost(ctx.terminals)) return undefined;
  const cwd = options.cwd ?? ctx.cwd ?? process.cwd();
  const commands = options.commands ?? detectTerminalCommands(cwd);
  if (!commands.length) {
    warn(
      `[pangular] The terminals dock is off: no build or test script in package.json and no Angular CLI target in angular.json under ${cwd}.`,
    );
    return undefined;
  }
  handle.runner?.dispose();
  const runner = new TerminalRunner(ctx.terminals, commands, { ...options.runner, cwd });
  handle.runner = runner;
  // Loaded here, so a hub without terminals never loads the plugin.
  const { createTerminalsDock } = await import('./hub-terminals-dock.ts');
  await ctx.install(createTerminalsDock(runner), { base: `${hubBase}${TERMINALS_DOCK_ID}/` });
  registerTerminalCommands(ctx, runner);
  return runner;
}

/**
 * Adds the terminals to the hub before the app's own `configure` runs, when
 * `enabled`. `handle` keeps the runner so the hub's `close()` stops it.
 */
export function withTerminals<T extends Pick<InitHubOptions, 'configure' | 'cwd'>>(
  options: T,
  hubBase: string,
  enabled: boolean,
  handle: HubTerminals,
): T {
  if (!enabled) return options;
  const { configure } = options;
  return {
    ...options,
    configure: async (ctx) => {
      await setupHubTerminals(ctx as unknown as HubTerminalsContext, hubBase, handle, {
        cwd: options.cwd,
      });
      await configure?.(ctx);
    },
  };
}
