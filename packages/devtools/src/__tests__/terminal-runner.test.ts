import { EventEmitter } from 'node:events';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TerminalCommand } from '../terminal-commands.ts';
import {
  KILL_GRACE_MS,
  TerminalRunner,
  spawnCommand,
  terminalSessionId,
  type TerminalSessionEntry,
} from '../terminal-runner.ts';
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
  title: 'ng test',
  command: 'pnpm',
  args: ['exec', 'ng', 'test'],
  source: 'angular-cli',
};

/** A stand-in for `ctx.terminals` that reads each session's stream like the hub does. */
function fakeHost() {
  const sessions = new Map<string, TerminalSessionEntry>();
  const output = new Map<string, string>();
  const readers = new Map<string, ReadableStreamDefaultReader<string>>();
  return {
    sessions,
    output: (id: string) => output.get(id) ?? '',
    register: vi.fn((session: TerminalSessionEntry) => {
      sessions.set(session.id, session);
      output.set(session.id, '');
      const reader = session.stream.getReader();
      readers.set(session.id, reader);
      void (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          output.set(session.id, (output.get(session.id) ?? '') + value);
        }
      })().catch(() => undefined);
      return session;
    }),
    update: vi.fn((patch: Partial<TerminalSessionEntry> & { id: string }) => {
      Object.assign(sessions.get(patch.id)!, patch);
    }),
    // Like the hub: dispose the bound stream, then forget the session.
    remove: vi.fn((session: { id: string }) => {
      void readers.get(session.id)?.cancel('removed');
      sessions.delete(session.id);
    }),
  };
}

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  constructor(readonly pid: number) {
    super();
  }
  print(text: string, stream: 'stdout' | 'stderr' = 'stdout') {
    this[stream].emit('data', Buffer.from(text));
  }
  exit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.emit('close', code, signal);
  }
}

function setup(commands: TerminalCommand[] = [BUILD, TEST]) {
  const host = fakeHost();
  const children: FakeChild[] = [];
  const spawn = vi.fn((_command: TerminalCommand, _cwd: string) => {
    const child = new FakeChild(1000 + children.length);
    children.push(child);
    return child as unknown as ChildProcess;
  });
  const kill = vi.fn((child: ChildProcess, signal: NodeJS.Signals) => {
    if (signal === 'SIGKILL') (child as unknown as FakeChild).exit(null, 'SIGKILL');
  });
  const runner = new TerminalRunner(host, commands, {
    cwd: '/work/app',
    spawn,
    kill,
    hookProcessExit: false,
  });
  return { host, runner, spawn, kill, children };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe('terminal runner', () => {
  it('runs a detected command as a hub terminal session and streams its output', async () => {
    const { host, runner, spawn, children } = setup();
    const id = runner.start('build');
    expect(id).toBe(terminalSessionId('build'));
    expect(spawn).toHaveBeenCalledWith(BUILD, '/work/app');
    const entry = host.sessions.get(id)!;
    expect(entry).toMatchObject({
      title: 'pnpm run build',
      status: 'running',
      interactive: false,
      restartable: true,
    });
    children[0].print('Building...\n');
    children[0].print('warning\n', 'stderr');
    children[0].exit(0);
    await flush();
    expect(host.output(id)).toContain('$ pnpm run build');
    expect(host.output(id)).toContain('Building...\nwarning\n');
    expect(host.output(id)).toContain('[exited with code 0]');
    expect(entry.status).toBe('stopped');
    expect(runner.isRunning('build')).toBe(false);
  });

  it('marks a failed run as an error', async () => {
    const { host, runner, children } = setup();
    const id = runner.start('test');
    children[0].exit(1);
    await flush();
    expect(host.sessions.get(id)!.status).toBe('error');
    expect(host.output(id)).toContain('[exited with code 1]');
  });

  it('refuses any command it did not detect and never spawns for it', () => {
    const { runner, spawn } = setup([BUILD]);
    expect(() => runner.start('test')).toThrow('No test command was found in this project.');
    expect(() => runner.start('rm -rf /' as never)).toThrow('was found in this project');
    expect(spawn).not.toHaveBeenCalled();
    expect(runner.commands.map((c) => c.id)).toEqual(['build']);
  });

  it('masks bearer tokens and JWTs in the output, also across chunks', async () => {
    const { host, runner, children } = setup();
    const id = runner.start('test');
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    children[0].print('Authorization: Bearer abc.def');
    children[0].print('ghi123\n');
    children[0].print(`token ${jwt.slice(0, 40)}`);
    children[0].print(`${jwt.slice(40)}\n`);
    children[0].exit(0);
    await flush();
    const text = host.output(id);
    expect(text).not.toContain('abc.defghi123');
    expect(text).not.toContain(jwt);
    expect(text).toContain('Bearer');
  });

  it('shows a partial line after a short wait, for progress output', async () => {
    vi.useFakeTimers();
    const { host, runner, children } = setup();
    const id = runner.start('build');
    children[0].print('Building 42%');
    await vi.advanceTimersByTimeAsync(200);
    expect(host.output(id)).toContain('Building 42%');
  });

  it('stops a run with SIGTERM, then SIGKILL after the grace period, and keeps the output', async () => {
    vi.useFakeTimers();
    const { host, runner, kill, children } = setup();
    const id = runner.start('build');
    children[0].print('compiling\n');
    runner.stop('build');
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGTERM');
    expect(kill).not.toHaveBeenCalledWith(children[0], 'SIGKILL');
    await vi.advanceTimersByTimeAsync(KILL_GRACE_MS);
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGKILL');
    expect(host.sessions.get(id)!.status).toBe('stopped');
    expect(host.output(id)).toContain('compiling');
    expect(host.output(id)).toContain('[stopped]');
  });

  it('does not force-kill a run that exits after SIGTERM', async () => {
    vi.useFakeTimers();
    const { runner, kill, children } = setup();
    runner.start('build');
    runner.stop('build');
    children[0].exit(null, 'SIGTERM');
    await vi.advanceTimersByTimeAsync(KILL_GRACE_MS * 2);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('restarts in the same session: stops the running command, then runs it again', async () => {
    const { host, runner, spawn, kill, children } = setup();
    const id = runner.start('build');
    expect(runner.start('build')).toBe(id);
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGTERM');
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(host.register).toHaveBeenCalledTimes(1);
    // Output from the old run no longer reaches the session.
    children[0].print('old\n');
    children[1].print('new\n');
    children[0].exit(null, 'SIGTERM');
    await flush();
    expect(host.output(id)).toContain('[restarting]');
    expect(host.output(id)).not.toContain('old');
    expect(host.output(id)).toContain('new');
    expect(host.sessions.get(id)!.status).toBe('running');
  });

  it('runs again after a run ended, through the session the hub restarts', async () => {
    const { host, runner, spawn, children } = setup();
    const id = runner.start('build');
    children[0].exit(0);
    await flush();
    const entry = host.sessions.get(id)!;
    // `hub:terminals:restart` and `hub:terminals:terminate` call these.
    await entry.restart();
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(entry.status).toBe('running');
    await entry.terminate();
    children[1].exit(null, 'SIGTERM');
    await flush();
    expect(entry.status).toBe('stopped');
  });

  it('stops the command when the hub removes its session, and starts a fresh session next time', async () => {
    const { host, runner, kill, children } = setup();
    const id = runner.start('build');
    host.remove(host.sessions.get(id)!);
    await flush();
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGTERM');
    runner.start('build');
    expect(host.register).toHaveBeenCalledTimes(2);
    expect(host.sessions.has(id)).toBe(true);
  });

  it('stops every command and removes the sessions on dispose', async () => {
    const { host, runner, kill, children } = setup();
    runner.start('build');
    runner.start('test');
    runner.dispose();
    expect(kill).toHaveBeenCalledWith(children[0], 'SIGTERM');
    expect(kill).toHaveBeenCalledWith(children[1], 'SIGTERM');
    expect(host.sessions.size).toBe(0);
    expect(() => runner.start('build')).toThrow('closed');
  });

  it('reports a command that cannot start', async () => {
    const { host } = setup();
    const runner = new TerminalRunner(host, [BUILD], {
      cwd: '/work/app',
      spawn: () => {
        throw new Error('spawn pnpm ENOENT');
      },
      hookProcessExit: false,
    });
    const id = runner.start('build');
    await flush();
    expect(host.sessions.get(id)!.status).toBe('error');
    expect(host.output(id)).toContain('could not start: spawn pnpm ENOENT');
  });

  it('hooks process exit while a command runs, and unhooks when it ends', () => {
    const host = fakeHost();
    const child = new FakeChild(7);
    const kill = vi.fn();
    const before = process.listeners('exit');
    const runner = new TerminalRunner(host, [BUILD], {
      cwd: '/work/app',
      spawn: () => child as unknown as ChildProcess,
      kill,
    });
    runner.start('build');
    const added = process.listeners('exit').filter((listener) => !before.includes(listener));
    expect(added).toHaveLength(1);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    // Only the runner's own listener, not the test runner's.
    (added[0] as (code: number) => void)(0);
    expect(kill).toHaveBeenCalledWith(child, 'SIGTERM');
    child.exit(0);
    expect(process.listeners('exit')).toEqual(before);
    runner.dispose();
  });
});

describe.skipIf(process.platform === 'win32')('terminal runner with real processes', () => {
  it('kills the command and the processes it started when the runner is disposed', async () => {
    const dir = makeProject({});
    const script = join(dir, 'parent.mjs');
    writeFileSync(
      script,
      [
        "import { spawn } from 'node:child_process';",
        "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
        'console.log(`pids ${process.pid} ${child.pid}`);',
        'setInterval(() => {}, 1000);',
      ].join('\n'),
    );
    const host = fakeHost();
    const command = { ...BUILD, command: process.execPath as never, args: [script] };
    const runner = new TerminalRunner(host, [command], {
      cwd: dir,
      spawn: spawnCommand,
      hookProcessExit: false,
    });
    const id = runner.start('build');
    let pids: number[] = [];
    await vi.waitFor(
      () => {
        const match = /pids (\d+) (\d+)/.exec(host.output(id));
        expect(match).not.toBeNull();
        pids = [Number(match![1]), Number(match![2])];
      },
      { timeout: 5000 },
    );
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    expect(pids.every(alive)).toBe(true);
    runner.dispose();
    await vi.waitFor(() => expect(pids.filter(alive)).toEqual([]), { timeout: 5000 });
  });
});
