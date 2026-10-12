import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initPangularHub } from '../hub.ts';
import {
  TERMINALS_DOCK_ID,
  TERMINALS_SPAWN_RPC,
  dockRpcFunctions,
  guardSpawnRequest,
} from '../hub-terminals-dock.ts';
import {
  hubTerminals,
  registerTerminalCommands,
  setupHubTerminals,
  terminalsEnabled,
  terminalsRefusal,
} from '../hub-terminals.ts';
import type { TerminalCommand } from '../terminal-commands.ts';
import { TerminalRunner, terminalSessionId } from '../terminal-runner.ts';
import { makeProject } from './analog-fixture.ts';

const BUILD: TerminalCommand = {
  id: 'build',
  title: 'pnpm run build',
  command: 'pnpm',
  args: ['run', 'build'],
  source: 'script',
};
const TEST: TerminalCommand = {
  id: 'test',
  title: 'pnpm run test',
  command: 'pnpm',
  args: ['run', 'test'],
  source: 'script',
};

const PROJECT = {
  'package.json': JSON.stringify({ scripts: { build: 'ng build', test: 'ng test' } }),
  'pnpm-lock.yaml': '',
};

const hubs: { close: () => Promise<void> }[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const hub of hubs.splice(0)) await hub.close();
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

async function boot(options: Parameters<typeof initPangularHub>[0] = {}) {
  const hub = initPangularHub({
    cwd: makeProject(PROJECT),
    ws: false,
    auth: false,
    ...options,
  });
  hubs.push(hub);
  await hub.ready;
  return { hub, ctx: await hub.context };
}

function fakeSpawner() {
  const children: (EventEmitter & { stdout: EventEmitter; stderr: EventEmitter })[] = [];
  const spawn = vi.fn(() => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 4000 + children.length,
    });
    children.push(child);
    return child as unknown as ChildProcess;
  });
  const kill = vi.fn();
  return { spawn, kill, children };
}

describe('terminals option', () => {
  it('is off unless it is true', () => {
    const warn = vi.fn();
    expect(terminalsEnabled(undefined, {}, warn)).toBe(false);
    expect(terminalsEnabled(false, {}, warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(terminalsEnabled('yes', {}, warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[pangular] Ignoring terminals: "yes". Pass true to turn it on.',
    );
    expect(terminalsEnabled(true, { env: {} }, warn)).toBe(true);
  });

  it('stays off in production, without the origin check and with allowLan', () => {
    expect(terminalsRefusal({ env: { NODE_ENV: 'production' } })).toBe('NODE_ENV is production');
    expect(terminalsRefusal({ env: {}, originCheckOff: true })).toContain(
      'allowedOrigins is false',
    );
    expect(terminalsRefusal({ env: {}, remote: true })).toContain('allowLan');
    const warn = vi.fn();
    expect(terminalsEnabled(true, { env: {}, remote: true }, warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[pangular] The terminals dock is off: allowLan lets other machines reach the hub.',
    );
  });
});

describe('terminals dock guard', () => {
  it('lets a detected preset through and nothing else', () => {
    const commands = [BUILD];
    expect(guardSpawnRequest({ presetId: 'build', cols: 120, rows: 30 }, commands)).toBe('build');
    expect(guardSpawnRequest({ presetId: 'build', mode: 'readonly' }, commands)).toBe('build');
    // No preset means the default shell in the plugin.
    expect(() => guardSpawnRequest({}, commands)).toThrow('build and test commands');
    expect(() => guardSpawnRequest(undefined, commands)).toThrow('build and test commands');
    expect(() => guardSpawnRequest({ mode: 'interactive' }, commands)).toThrow('read-only');
    expect(() => guardSpawnRequest({ presetId: 'test' }, commands)).toThrow('Pick one of them');
    expect(() => guardSpawnRequest({ command: 'bash' }, commands)).toThrow('command cannot be set');
    expect(() =>
      guardSpawnRequest({ presetId: 'build', args: ['--', 'rm', '-rf', '/'] }, commands),
    ).toThrow('args cannot be set');
    expect(() => guardSpawnRequest({ presetId: 'build', cwd: '/' }, commands)).toThrow(
      'cwd cannot be set',
    );
    expect(() =>
      guardSpawnRequest({ presetId: 'build', env: { NODE_OPTIONS: '--require x' } }, commands),
    ).toThrow('env cannot be set');
  });

  it('registers the plugin functions without agent tools, and spawns through the runner', () => {
    const start = vi.fn(() => terminalSessionId('build'));
    const functions = dockRpcFunctions({ commands: [BUILD], start });
    expect(functions.length).toBeGreaterThan(5);
    expect(functions.filter((fn) => 'agent' in fn && fn.agent)).toEqual([]);
    const spawn = functions.find((fn) => fn.name === TERMINALS_SPAWN_RPC)!;
    const { handler } = (spawn.setup as (ctx: unknown) => { handler: (req: unknown) => unknown })(
      {},
    );
    expect(handler({ presetId: 'build' })).toMatchObject({
      id: 'pangular:terminal:build',
      mode: 'readonly',
      channel: 'devframe:terminals',
    });
    expect(start).toHaveBeenCalledWith('build');
    expect(() => handler({ command: 'sh', args: ['-c', 'id'] })).toThrow();
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('terminals palette commands', () => {
  it('adds run and stop for each detected command', () => {
    const host = {
      sessions: new Map(),
      register: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    const { spawn, kill } = fakeSpawner();
    const runner = new TerminalRunner(host as never, [BUILD, TEST], {
      cwd: '/work',
      spawn,
      kill,
      hookProcessExit: false,
    });
    const registered: { id: string; title: string; handler: () => void }[] = [];
    const activate = vi.fn();
    const ids = registerTerminalCommands(
      { commands: { register: (command) => registered.push(command) }, docks: { activate } },
      runner,
    );
    expect(ids).toEqual([
      'pangular:terminal:run-build',
      'pangular:terminal:stop-build',
      'pangular:terminal:run-test',
      'pangular:terminal:stop-test',
    ]);
    expect(registered[0].title).toBe('Pangular: run pnpm run build');
    registered[0].handler();
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(TERMINALS_DOCK_ID, {
      sessionId: 'pangular:terminal:build',
    });
    registered[1].handler();
    expect(kill).toHaveBeenCalledWith(expect.anything(), 'SIGTERM');
    runner.dispose();
  });

  it('registers nothing outside a hub', () => {
    const runner = new TerminalRunner({ sessions: new Map() } as never, [BUILD], {
      cwd: '/work',
      hookProcessExit: false,
    });
    expect(registerTerminalCommands({}, runner)).toEqual([]);
  });
});

describe('terminals in the hub', () => {
  it('adds no terminals dock by default', async () => {
    const { ctx } = await boot();
    expect(ctx.docks.views.has(TERMINALS_DOCK_ID)).toBe(false);
    expect(ctx.rpc.has(TERMINALS_SPAWN_RPC)).toBe(false);
  });

  it('adds the dock with the detected commands as presets, and refuses a shell', async () => {
    const { hub, ctx } = await boot({ terminals: true });
    const dock = ctx.docks.views.get(TERMINALS_DOCK_ID);
    expect(dock && 'url' in dock ? dock.url : undefined).toBe(`/__devframes/${TERMINALS_DOCK_ID}/`);
    const presets = (await ctx.rpc.invokeLocal(
      'devframes:plugin:terminals:presets' as never,
      ...([] as never),
    )) as {
      id: string;
      title: string;
      mode: string;
    }[];
    expect(presets.map((p) => [p.id, p.title, p.mode])).toEqual([
      ['build', 'pnpm run build', 'readonly'],
      ['test', 'pnpm run test', 'readonly'],
    ]);
    const spawnShell = ctx.rpc.invokeLocal(TERMINALS_SPAWN_RPC as never, ...([{}] as never));
    await expect(spawnShell).rejects.toThrow('build and test commands');
    const spawnCommand = ctx.rpc.invokeLocal(
      TERMINALS_SPAWN_RPC as never,
      ...([{ command: process.env['SHELL'] ?? 'bash' }] as never),
    );
    await expect(spawnCommand).rejects.toThrow('command cannot be set');
    expect(ctx.terminals.sessions.size).toBe(0);
    const panel = await hub.handler(
      new Request(`http://localhost/__devframes/${TERMINALS_DOCK_ID}/`),
    );
    expect(panel.status).toBe(200);
  });

  it('keeps the terminal functions out of the MCP tools', async () => {
    const { hub } = await boot({ terminals: true, mcp: { authorization: 'secret-token' } });
    const response = await hub.handler(
      new Request('http://localhost/__devframes/__mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
          authorization: 'Bearer secret-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
    );
    const text = await response.text();
    expect(text).toContain('pangular_');
    expect(text).not.toContain('terminals');
  });

  it('turns the dock off when other machines can reach the hub', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ctx } = await boot({ terminals: true, auth: true, allowLan: true });
    expect(ctx.docks.views.has(TERMINALS_DOCK_ID)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[pangular] The terminals dock is off: allowLan lets other machines reach the hub.',
    );
  });

  it('runs a preset from the dock as a hub session, stops it from the hub, and stops it on close', async () => {
    const { ctx } = await boot();
    const handle = hubTerminals();
    const { spawn, kill, children } = fakeSpawner();
    const runner = await setupHubTerminals(ctx as never, '/__devframes/', handle, {
      commands: [BUILD, TEST],
      runner: { spawn, kill, hookProcessExit: false },
    });
    expect(runner).toBeDefined();
    const info = (await ctx.rpc.invokeLocal(
      TERMINALS_SPAWN_RPC as never,
      ...([{ presetId: 'build' }] as never),
    )) as { id: string };
    expect(info.id).toBe('pangular:terminal:build');
    expect(spawn).toHaveBeenCalledWith(BUILD, expect.any(String));
    expect(ctx.terminals.sessions.get(info.id)?.status).toBe('running');
    // The dock lists hub sessions next to its own.
    const list = (await ctx.rpc.invokeLocal(
      'devframes:plugin:terminals:list' as never,
      ...([] as never),
    )) as {
      id: string;
      channel?: string;
    }[];
    expect(list).toContainEqual(
      expect.objectContaining({ id: info.id, channel: 'devframe:terminals' }),
    );
    await ctx.rpc.invokeLocal('hub:terminals:terminate' as never, ...([info.id] as never));
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGTERM');
    await ctx.rpc.invokeLocal('hub:terminals:restart' as never, ...([info.id] as never));
    expect(spawn).toHaveBeenCalledTimes(2);
    handle.dispose();
    expect(kill).toHaveBeenCalledWith(children[1], 'SIGTERM');
    expect(ctx.terminals.sessions.has(info.id)).toBe(false);
  });

  it('says so and adds nothing when the project has no build or test command', async () => {
    const { ctx } = await boot();
    const warn = vi.fn();
    const runner = await setupHubTerminals(ctx as never, '/__devframes/', hubTerminals(), {
      commands: [],
      warn,
    });
    expect(runner).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no build or test script'));
  });
});
