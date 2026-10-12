import { spawn as nodeSpawn, spawnSync, type ChildProcess } from 'node:child_process';
import { redactText } from './text-redact.ts';
import type { TerminalCommand, TerminalCommandId } from './terminal-commands.ts';

/**
 * The part of the hub's `ctx.terminals` the runner uses. Sessions registered
 * here show in the hub's terminals dock, and the hub's own
 * `hub:terminals:terminate`, `restart` and `remove` RPCs drive them through
 * the session's `terminate()` and `restart()`.
 */
export interface TerminalsHostLike {
  readonly sessions: Map<string, unknown>;
  register: (session: TerminalSessionEntry) => unknown;
  update: (patch: Partial<TerminalSessionEntry> & { id: string }) => void;
  remove: (session: { id: string }) => void;
}

export type TerminalSessionStatus = 'running' | 'stopped' | 'error';

/** The session object handed to `ctx.terminals.register()`. */
export interface TerminalSessionEntry {
  id: string;
  title: string;
  description?: string;
  status: TerminalSessionStatus;
  icon?: string;
  interactive: false;
  restartable: true;
  stream: ReadableStream<string>;
  terminate: () => Promise<void>;
  restart: () => Promise<void>;
}

/** Starts a command. Tests pass a fake that returns an `EventEmitter` child. */
export type SpawnCommand = (command: TerminalCommand, cwd: string) => ChildProcess;

/** Stops a child and everything it started. Tests pass a fake. */
export type KillTree = (child: ChildProcess, signal: NodeJS.Signals) => void;

const WINDOWS = process.platform === 'win32';

/**
 * Runs a fixed command with no shell on POSIX, in its own process group so a
 * stop reaches the CLI under the package manager too. Windows runs the
 * `pnpm.cmd` style shims through `cmd.exe`; the arguments are fixed, never
 * user input.
 */
export const spawnCommand: SpawnCommand = (command, cwd) =>
  nodeSpawn(command.command, command.args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS,
    shell: WINDOWS,
    windowsHide: true,
  });

/** Kills the child's process group (POSIX) or tree (`taskkill /T` on Windows). */
export const killTree: KillTree = (child, signal) => {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    if (WINDOWS) {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already gone.
    }
  }
};

/** How long a stopped command gets to exit after SIGTERM before SIGKILL. */
export const KILL_GRACE_MS = 3000;
/** How long a partial line waits for its end before it is shown, for progress output. */
const FLUSH_MS = 100;
/** A partial line longer than this is shown without waiting for its end. */
const MAX_PENDING = 8192;

interface Run {
  child: ChildProcess;
  exited: boolean;
  /** Set when the runner stopped it, so the exit reads as stopped, not failed. */
  stopping: boolean;
  killTimer?: ReturnType<typeof setTimeout>;
}

interface Session {
  command: TerminalCommand;
  entry: TerminalSessionEntry;
  controller?: ReadableStreamDefaultController<string>;
  closed: boolean;
  run?: Run;
  pending: string;
  flushTimer?: ReturnType<typeof setTimeout>;
}

export interface TerminalRunnerOptions {
  cwd: string;
  spawn?: SpawnCommand;
  kill?: KillTree;
  /** Masks secrets in the output, line by line. Defaults to `redactText`. */
  redact?: (text: string) => string;
  /** Hooks process signals so the commands die with the server. Off in tests. */
  hookProcessExit?: boolean;
}

/** The hub session id of a command, such as `pangular:terminal:build`. */
export function terminalSessionId(id: TerminalCommandId): string {
  return `pangular:terminal:${id}`;
}

const EXIT_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * Runs the project's detected build and test commands as hub terminal
 * sessions. Only the commands it was created with can run: `start()` takes a
 * command id, never a command line. Output is masked like the rest of the
 * devtools before it reaches the dock. Each session keeps one output stream
 * for its whole life, so a run that ended can be started again in place, and
 * `dispose()` stops every command when the hub closes.
 */
export class TerminalRunner {
  readonly #host: TerminalsHostLike;
  readonly #commands: Map<TerminalCommandId, TerminalCommand>;
  readonly #sessions = new Map<TerminalCommandId, Session>();
  readonly #options: Required<Omit<TerminalRunnerOptions, 'hookProcessExit'>> & {
    hookProcessExit: boolean;
  };
  #hooked = false;
  #disposed = false;

  constructor(
    host: TerminalsHostLike,
    commands: readonly TerminalCommand[],
    options: TerminalRunnerOptions,
  ) {
    this.#host = host;
    this.#commands = new Map(commands.map((command) => [command.id, command]));
    this.#options = {
      cwd: options.cwd,
      spawn: options.spawn ?? spawnCommand,
      kill: options.kill ?? killTree,
      redact: options.redact ?? ((text) => redactText(text)),
      hookProcessExit: options.hookProcessExit ?? true,
    };
  }

  /** The commands this runner may run. */
  get commands(): TerminalCommand[] {
    return [...this.#commands.values()];
  }

  /** Whether the command is running now. */
  isRunning(id: TerminalCommandId): boolean {
    const run = this.#sessions.get(id)?.run;
    return !!run && !run.exited;
  }

  /**
   * Runs the command in its session, creating the session the first time. A
   * run in progress is stopped first, so this is also the restart. Returns the
   * hub session id.
   */
  start(id: TerminalCommandId): string {
    if (this.#disposed) throw new Error('The terminals are closed.');
    const command = this.#commands.get(id);
    if (!command) throw new Error(`No ${String(id)} command was found in this project.`);
    let session = this.#sessions.get(id);
    if (!session || session.closed) session = this.#open(command);
    this.#launch(session);
    return session.entry.id;
  }

  /** Stops the command and keeps its session and output. */
  stop(id: TerminalCommandId): void {
    const session = this.#sessions.get(id);
    if (session) this.#stopRun(session);
  }

  /** Stops every command and drops their sessions from the hub. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const session of this.#sessions.values()) {
      this.#stopRun(session);
      this.#close(session);
      if (this.#host.sessions.has(session.entry.id)) this.#host.remove(session.entry);
    }
    this.#sessions.clear();
    this.#unhook();
  }

  #open(command: TerminalCommand): Session {
    const session: Session = {
      command,
      closed: false,
      pending: '',
      entry: undefined as unknown as TerminalSessionEntry,
    };
    const stream = new ReadableStream<string>({
      start: (controller) => {
        session.controller = controller;
      },
      // The hub cancels the stream when the session is removed from the dock.
      cancel: () => {
        session.closed = true;
        this.#stopRun(session);
        if (this.#sessions.get(command.id) === session) this.#sessions.delete(command.id);
      },
    });
    session.entry = {
      id: terminalSessionId(command.id),
      title: command.title,
      description: `Pangular Inspector · ${command.source === 'script' ? 'package.json script' : 'Angular CLI'}`,
      status: 'stopped',
      icon: command.id === 'test' ? 'ph:flask-duotone' : 'ph:hammer-duotone',
      interactive: false,
      restartable: true,
      stream,
      terminate: async () => this.stop(command.id),
      restart: async () => {
        this.start(command.id);
      },
    };
    this.#sessions.set(command.id, session);
    const stale = this.#host.sessions.get(session.entry.id);
    if (stale) this.#host.remove(stale as { id: string });
    this.#host.register(session.entry);
    return session;
  }

  #launch(session: Session): void {
    if (session.run && !session.run.exited) {
      this.#write(session, '\r\n\x1b[2m[restarting]\x1b[0m\r\n');
      this.#stopRun(session);
    } else if (session.run) {
      this.#write(session, '\r\n');
    }
    const { command } = session;
    this.#write(session, `\x1b[2m$ ${command.command} ${command.args.join(' ')}\x1b[0m\r\n`);
    let child: ChildProcess;
    try {
      child = this.#options.spawn(command, this.#options.cwd);
    } catch (error) {
      this.#write(session, `\x1b[31m[could not start: ${errorText(error)}]\x1b[0m\r\n`);
      this.#setStatus(session, 'error');
      return;
    }
    const run: Run = { child, exited: false, stopping: false };
    session.run = run;
    this.#setStatus(session, 'running');
    this.#hook();
    const onData = (chunk: Buffer | string) => {
      if (session.run === run) this.#output(session, chunk.toString());
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('error', (error) => {
      if (run.exited) return;
      run.exited = true;
      this.#settle(run);
      if (session.run !== run) return;
      this.#flush(session);
      this.#write(session, `\x1b[31m[could not start: ${errorText(error)}]\x1b[0m\r\n`);
      this.#setStatus(session, 'error');
    });
    child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (run.exited) return;
      run.exited = true;
      this.#settle(run);
      if (session.run !== run) return;
      this.#flush(session);
      const stopped = run.stopping || (code === null && signal !== null);
      this.#write(
        session,
        stopped
          ? '\r\n\x1b[2m[stopped]\x1b[0m\r\n'
          : `\r\n\x1b[2m[exited with code ${code ?? 0}]\x1b[0m\r\n`,
      );
      this.#setStatus(session, !stopped && code !== 0 ? 'error' : 'stopped');
    });
  }

  #stopRun(session: Session): void {
    const run = session.run;
    if (!run || run.exited || run.stopping) return;
    run.stopping = true;
    this.#options.kill(run.child, 'SIGTERM');
    run.killTimer = setTimeout(() => {
      if (!run.exited) this.#options.kill(run.child, 'SIGKILL');
    }, KILL_GRACE_MS);
    run.killTimer.unref?.();
  }

  #settle(run: Run): void {
    if (run.killTimer) clearTimeout(run.killTimer);
    if (![...this.#sessions.values()].some((s) => s.run && !s.run.exited)) this.#unhook();
  }

  /** Masks complete lines; a partial line waits briefly for the rest. */
  #output(session: Session, text: string): void {
    const all = session.pending + text;
    const end = Math.max(all.lastIndexOf('\n'), all.lastIndexOf('\r'));
    if (end >= 0) {
      this.#write(session, this.#options.redact(all.slice(0, end + 1)));
      session.pending = all.slice(end + 1);
    } else {
      session.pending = all;
    }
    if (session.pending.length > MAX_PENDING) {
      this.#flush(session);
    } else if (session.pending && !session.flushTimer) {
      session.flushTimer = setTimeout(() => this.#flush(session), FLUSH_MS);
      session.flushTimer.unref?.();
    }
  }

  #flush(session: Session): void {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = undefined;
    if (!session.pending) return;
    const text = session.pending;
    session.pending = '';
    this.#write(session, this.#options.redact(text));
  }

  #write(session: Session, text: string): void {
    if (session.closed || !text) return;
    try {
      session.controller?.enqueue(text);
    } catch {
      session.closed = true;
    }
  }

  #close(session: Session): void {
    this.#flush(session);
    if (session.closed) return;
    session.closed = true;
    try {
      session.controller?.close();
    } catch {
      // Already closed or cancelled.
    }
  }

  #setStatus(session: Session, status: TerminalSessionStatus): void {
    session.entry.status = status;
    if (this.#host.sessions.get(session.entry.id) === session.entry) {
      this.#host.update({ id: session.entry.id, status });
    }
  }

  /** Stops the running commands when the server process exits or is interrupted. */
  readonly #onExit = () => {
    for (const session of this.#sessions.values()) {
      const run = session.run;
      if (run && !run.exited) this.#options.kill(run.child, 'SIGTERM');
    }
  };

  /**
   * On a signal, stops the commands, then lets the signal end the server as
   * it would have: re-raised when nothing else listens for it.
   */
  readonly #onSignal = (signal: NodeJS.Signals) => {
    this.#onExit();
    this.#unhook();
    if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
  };

  #hook(): void {
    if (this.#hooked || !this.#options.hookProcessExit) return;
    this.#hooked = true;
    process.on('exit', this.#onExit);
    for (const signal of EXIT_SIGNALS) process.on(signal, this.#onSignal);
  }

  #unhook(): void {
    if (!this.#hooked) return;
    this.#hooked = false;
    process.off('exit', this.#onExit);
    for (const signal of EXIT_SIGNALS) process.off(signal, this.#onSignal);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
