// `pangular token --rotate`: drops every trusted token of a project and gets
// a new one-time code from the server that runs it.
//
// The token store is the project's private folder (`auth-store.ts`). The
// command empties `auth.json` there, so the tokens are gone even when no
// server runs. A running server keeps its tokens in memory, though, and the
// one-time code only exists in its process. So the command also leaves a
// request in the same folder: the server (`watchTokenRotation`) drops its
// tokens, ends the connections that used them, makes a new code, and writes
// the code back for the command to print. Both files sit in the folder only
// the user can read (`0700`), are written `0600`, and are deleted once read.
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getTempAuthCodeInfo,
  refreshTempAuthCode,
  revokeActiveConnectionsForToken,
} from 'devframe/node/auth';
import { getInternalContext } from 'devframe/node/hub-internals';
import { resetCodeGuard } from './auth-guard.ts';
import { privateAuthStoreDir, summarizeTrustedTokens } from './auth-store.ts';

export const ROTATE_REQUEST_FILE = 'rotate-request.json';
export const ROTATE_ANSWER_FILE = 'rotate-answer.json';
/** How often a running server looks for a request. */
export const ROTATE_POLL_MS = 1000;
/** How long the command waits for a running server's answer. */
export const ROTATE_WAIT_MS = 3000;
/** A request older than this is stale: its command stopped waiting long ago. */
const STALE_REQUEST_MS = 60_000;

interface RotateRequest {
  id: string;
  at: number;
}

interface RotateAnswer {
  id: string;
  code: string;
  expiresAt: number;
  dropped: number;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Writes a file only its owner can read, through a temporary file so a reader never sees half of it. */
function writePrivate(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    // Windows.
  }
  renameSync(tmp, file);
}

function remove(file: string): void {
  try {
    rmSync(file, { force: true });
  } catch {
    // Already gone, or not ours.
  }
}

/** How many tokens a project's `auth.json` trusts, and when they expire. No token is read out. */
export function tokenFileSummary(dir: string, now = Date.now()) {
  const saved = readJson(join(dir, 'auth.json')) as { trusted?: Record<string, never> } | undefined;
  return summarizeTrustedTokens({ value: () => ({ trusted: saved?.trusted ?? {} }) }, now);
}

/** Empties `trusted` in a project's `auth.json`, keeping its other keys. Returns how many it dropped. */
export function clearTokenFile(dir: string): number {
  const file = join(dir, 'auth.json');
  const saved = readJson(file);
  const state = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {};
  const trusted = state['trusted'];
  const count = trusted && typeof trusted === 'object' ? Object.keys(trusted).length : 0;
  if (existsSync(file) || count) writePrivate(file, { ...state, trusted: {} });
  return count;
}

export type RotateResult =
  | { server: true; dropped: number; code: string; expiresAt: number }
  | { server: false; dropped: number };

/**
 * The command's side: drops the tokens in the file, asks a running server for
 * a new code, and waits up to `waitMs` for it.
 */
export async function rotateTokens(
  projectRoot: string,
  options: { home?: string; waitMs?: number; pollMs?: number; now?: () => number } = {},
): Promise<RotateResult> {
  const now = options.now ?? Date.now;
  const dir = privateAuthStoreDir(projectRoot, options.home);
  const droppedInFile = clearTokenFile(dir);
  const request: RotateRequest = { id: randomBytes(16).toString('hex'), at: now() };
  const requestFile = join(dir, ROTATE_REQUEST_FILE);
  const answerFile = join(dir, ROTATE_ANSWER_FILE);
  remove(answerFile);
  writePrivate(requestFile, request);
  const waitMs = options.waitMs ?? ROTATE_WAIT_MS;
  const pollMs = options.pollMs ?? 100;
  const deadline = Date.now() + waitMs;
  try {
    for (;;) {
      const answer = readJson(answerFile) as Partial<RotateAnswer> | undefined;
      if (answer?.id === request.id && typeof answer.code === 'string') {
        remove(answerFile);
        return {
          server: true,
          dropped: Math.max(droppedInFile, Number(answer.dropped) || 0),
          code: answer.code,
          expiresAt: Number(answer.expiresAt) || 0,
        };
      }
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  } finally {
    // An answered request is gone already; an unanswered one must not rotate a server started later.
    const left = readJson(requestFile) as Partial<RotateRequest> | undefined;
    if (left?.id === request.id) remove(requestFile);
  }
  return { server: false, dropped: droppedInFile };
}

interface AuthStorage {
  value(): { trusted?: Record<string, unknown> };
  mutate(fn: (state: { trusted: Record<string, unknown> }) => void): void;
}

/**
 * The server's side of one request: makes a new one-time code and writes the
 * answer, then drops every token it trusts and ends their connections.
 * Returns the answer, or null when there is no fresh request. The request is
 * removed first, so a request that fails is not tried again every second.
 */
export function answerRotateRequest(
  ctx: unknown,
  dir: string,
  now = Date.now(),
  write: (file: string, value: unknown) => void = writePrivate,
): RotateAnswer | null {
  const requestFile = join(dir, ROTATE_REQUEST_FILE);
  if (!existsSync(requestFile)) return null;
  const request = readJson(requestFile) as Partial<RotateRequest> | undefined;
  remove(requestFile);
  if (typeof request?.id !== 'string' || typeof request.at !== 'number') return null;
  if (now - request.at > STALE_REQUEST_MS) return null;
  let storage: AuthStorage;
  try {
    storage = getInternalContext(ctx as never).storage.auth as unknown as AuthStorage;
  } catch {
    return null;
  }
  const tokens = Object.keys(storage.value().trusted ?? {});
  refreshTempAuthCode();
  const { code, expireAt } = getTempAuthCodeInfo();
  const answer: RotateAnswer = {
    id: request.id,
    code,
    expiresAt: expireAt,
    dropped: tokens.length,
  };
  // The answer goes first: a failed write throws with every token still trusted.
  write(join(dir, ROTATE_ANSWER_FILE), answer);
  storage.mutate((state) => {
    state.trusted = Object.create(null) as Record<string, unknown>;
  });
  for (const token of tokens) {
    void revokeActiveConnectionsForToken(ctx as never, token).catch(() => undefined);
  }
  // The user asked for a new code, so a lock from wrong guesses ends too.
  resetCodeGuard(ctx);
  return answer;
}

/**
 * One look for a request, as the server's timer runs it. A failure is logged
 * instead of thrown, so it can't stop the dev server.
 */
export function pollTokenRotation(
  ctx: unknown,
  dir: string,
  log: (message: string) => void,
  answer: (ctx: unknown, dir: string) => RotateAnswer | null = answerRotateRequest,
): void {
  try {
    const result = answer(ctx, dir);
    if (result) {
      log(
        `\n  [pangular] pangular token --rotate dropped ${result.dropped} trusted token(s). Browsers that used them need the new one-time code, which the command printed.\n`,
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(
      `\n  [pangular] pangular token --rotate failed, so every trusted token is kept: ${reason}\n`,
    );
  }
}

const watching = new WeakSet<object>();

/**
 * Looks for `pangular token --rotate` requests in the project's token folder
 * every second while the server runs. The timer is `unref`'d and holds the
 * context weakly, like the token expiry (`expireAuthTokens`).
 */
export function watchTokenRotation(
  ctx: unknown,
  dir: string,
  log: (message: string) => void = (message) => console.log(message),
): void {
  const context = ctx as { mode?: string };
  if (context.mode === 'build' || watching.has(context)) return;
  watching.add(context);
  const ref = new WeakRef(context);
  const timer = setInterval(() => {
    const live = ref.deref();
    if (!live) {
      clearInterval(timer);
      return;
    }
    pollTokenRotation(live, dir, log);
  }, ROTATE_POLL_MS);
  timer.unref?.();
}

/** The command's output. The code is printed only to the user who ran it. */
export function rotateText(result: RotateResult, now = Date.now()): string {
  const dropped = `Dropped ${result.dropped} trusted token(s) for this project.`;
  if (!result.server) {
    return `${dropped}\nNo running devtools server answered, so there is no code to print yet. The server prints a new one-time code when it starts.`;
  }
  const minutes = Math.max(1, Math.round((result.expiresAt - now) / 60_000));
  return `${dropped}\nNew one-time code: ${result.code} (expires in ${minutes} min)\nEnter it in the panel to connect again.`;
}
