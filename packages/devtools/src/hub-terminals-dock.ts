import createTerminalsDevframe from '@devframes/plugin-terminals';
import { PLUGIN_ID } from '@devframes/plugin-terminals/constants';
import { TerminalManager, setTerminalManager } from '@devframes/plugin-terminals/node';
import { serverFunctions } from '@devframes/plugin-terminals/rpc';
import { defineDevframe, type DevframeDefinition } from 'devframe';
import {
  isTerminalCommandId,
  type TerminalCommand,
  type TerminalCommandId,
} from './terminal-commands.ts';

/** The dock id of the terminals devframe in the hub rail. */
export const TERMINALS_DOCK_ID = PLUGIN_ID;

/** The plugin's spawn RPC, which Pangular replaces with `guardedSpawn`. */
export const TERMINALS_SPAWN_RPC = 'devframes:plugin:terminals:spawn';

/** The hub's own terminal stream, where the runner's sessions write. */
const HUB_TERMINAL_STREAM = 'devframe:terminals';

/** What the dock needs from the runner. */
export interface TerminalsDockRunner {
  readonly commands: readonly TerminalCommand[];
  start: (id: TerminalCommandId) => string;
}

const ALLOWED_SPAWN_KEYS = new Set(['presetId', 'cols', 'rows', 'title', 'mode']);

/**
 * Reads a spawn request from the terminals dock and returns the command id it
 * names, or throws. Only `{presetId}` for a detected command passes, with the
 * terminal size and title the dock adds. A command, arguments, a working
 * directory, environment variables or an interactive mode are refused, and so
 * is a request without a preset, which would start a shell.
 */
export function guardSpawnRequest(
  request: unknown,
  commands: readonly TerminalCommand[],
): TerminalCommandId {
  const input =
    request && typeof request === 'object' && !Array.isArray(request)
      ? (request as Record<string, unknown>)
      : {};
  const extra = Object.keys(input).filter(
    (key) => !ALLOWED_SPAWN_KEYS.has(key) && input[key] !== undefined,
  );
  if (extra.length) {
    throw new Error(
      `Pangular Inspector only runs the project's build and test commands; ${extra.join(', ')} cannot be set.`,
    );
  }
  if (input['mode'] !== undefined && input['mode'] !== 'readonly') {
    throw new Error('Pangular Inspector terminals are read-only.');
  }
  const id = input['presetId'];
  if (!isTerminalCommandId(id) || !commands.some((command) => command.id === id)) {
    throw new Error(
      "Pangular Inspector only runs the project's build and test commands. Pick one of them.",
    );
  }
  return id;
}

type RpcDefinition = (typeof serverFunctions)[number];

/**
 * The plugin's RPC functions as the dock registers them: without `agent`, so
 * none of them becomes an MCP tool, and with the spawn handler replaced by one
 * that starts a detected command through the runner and nothing else.
 */
export function dockRpcFunctions(runner: TerminalsDockRunner): RpcDefinition[] {
  return serverFunctions.map((fn) => {
    const { agent: _agent, ...rest } = fn as RpcDefinition & { agent?: unknown };
    if (fn.name !== TERMINALS_SPAWN_RPC) return rest as RpcDefinition;
    return {
      ...rest,
      setup: () => ({
        handler: (request: unknown) => {
          const id = guardSpawnRequest(request, runner.commands);
          const command = runner.commands.find((c) => c.id === id)!;
          const sessionId = runner.start(id);
          // The shape of a hub session in the plugin's own list, so the dock focuses it.
          return {
            id: sessionId,
            title: command.title,
            mode: 'readonly' as const,
            status: 'running' as const,
            backend: 'pipe' as const,
            command: '',
            args: [],
            cwd: '',
            cols: 80,
            rows: 24,
            createdAt: 0,
            channel: HUB_TERMINAL_STREAM,
          };
        },
      }),
    } as unknown as RpcDefinition;
  });
}

/**
 * The terminals dock: `@devframes/plugin-terminals` for its panel (xterm
 * views, stop and restart buttons, the session list), with Pangular's setup.
 * The plugin would start a shell or any command a client sends, so the setup
 * registers the plugin's RPC functions through `dockRpcFunctions` instead:
 * its presets are the detected commands, and its spawn RPC only starts those,
 * through the runner, as hub sessions.
 */
export function createTerminalsDock(runner: TerminalsDockRunner): DevframeDefinition {
  const plugin = createTerminalsDevframe();
  return defineDevframe({
    ...plugin,
    async setup(ctx) {
      const manager = new TerminalManager(ctx, {
        presets: runner.commands.map((command) => ({
          id: command.id,
          title: command.title,
          command: command.command,
          args: command.args,
          mode: 'readonly',
          icon: command.id === 'test' ? 'ph:flask-duotone' : 'ph:hammer-duotone',
        })),
        allowArbitraryCommands: false,
      });
      setTerminalManager(ctx, manager);
      await manager.init();
      for (const fn of dockRpcFunctions(runner)) ctx.rpc.register(fn as never);
    },
  });
}
