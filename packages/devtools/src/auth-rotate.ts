// `pangular token --rotate`: drops every trusted token of a project and gets
// a new one-time code from each server that runs it.
//
// The token store is the project's private folder (`auth-store.ts`). The
// command empties `auth.json` there, so the tokens are gone even when no
// server runs. A running server keeps its tokens in memory, though, and the
// one-time code only exists in its process. Several servers can share the
// folder (the Vite plugin and `pangular dev` for the same project), so:
//
// - Each running server (`watchTokenRotation`) keeps a heartbeat file there.
// - The command leaves a request with an id. No server deletes it; each one
//   that sees it drops its tokens, ends the connections that used them,
//   makes a new code, and writes its own answer file for that request.
// - The command waits until every server with a fresh heartbeat answered, or
//   the wait ends, then deletes the request and the answers and prints each
//   code. Servers that did not answer in time are counted in the output.
//
// All files sit in the folder only the user can read (`0700`) and are written
// `0600`.
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
const ANSWER_PREFIX = 'rotate-answer.';
const WATCHER_PREFIX = 'rotate-watcher.';
/** How often a running server looks for a request and renews its heartbeat. */
export const ROTATE_POLL_MS = 1000;
/** How long the command waits for the running servers' answers. */
export const ROTATE_WAIT_MS = 3000;
/** A heartbeat older than this belongs to a server that stopped. */
export const WATCHER_FRESH_MS = 5000;
/** A request older than this is stale: its command stopped waiting long ago. */
const STALE_REQUEST_MS = 60_000;
const SAFE_ID = /^[0-9a-f]{8,64}$/;

interface RotateRequest {
  id: string;
  at: number;
}

interface RotateAnswer {
  id: string;
  watcher: string;
  code: string;
  expiresAt: number;
  dropped: number;
}

/** The file one server answers one request in. */
export function rotateAnswerFile(dir: string, requestId: string, watcherId: string): string {
  return join(dir, `${ANSWER_PREFIX}${requestId}.${watcherId}.json`);
}

/** A running server's heartbeat file. */
export function rotateWatcherFile(dir: string, watcherId: string): string {
  return join(dir, `${WATCHER_PREFIX}${watcherId}.json`);
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

function filesIn(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
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

export interface RotateResult {
  /** Trusted tokens dropped, in the file or on the servers that answered. */
  dropped: number;
  /** One new code per server that answered. */
  answers: { code: string; expiresAt: number }[];
  /** Running servers (with a fresh heartbeat) that did not answer in time. */
  missing: number;
}

/** The running servers' ids: those with a heartbeat at `since` or later. Long-stale heartbeats are deleted. */
export function liveWatchers(dir: string, since: number, now = Date.now()): string[] {
  const ids: string[] = [];
  for (const name of filesIn(dir)) {
    if (!name.startsWith(WATCHER_PREFIX) || !name.endsWith('.json')) continue;
    const id = name.slice(WATCHER_PREFIX.length, -'.json'.length);
    const beat = readJson(join(dir, name)) as { at?: unknown } | undefined;
    const at = typeof beat?.at === 'number' ? beat.at : 0;
    if (at >= since) ids.push(id);
    else if (now - at > STALE_REQUEST_MS) remove(join(dir, name));
  }
  return ids;
}

function answersFor(dir: string, requestId: string): Map<string, RotateAnswer> {
  const answers = new Map<string, RotateAnswer>();
  const prefix = `${ANSWER_PREFIX}${requestId}.`;
  for (const name of filesIn(dir)) {
    if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
    const answer = readJson(join(dir, name)) as Partial<RotateAnswer> | undefined;
    if (
      answer?.id === requestId &&
      typeof answer.code === 'string' &&
      typeof answer.watcher === 'string'
    ) {
      answers.set(answer.watcher, answer as RotateAnswer);
    }
  }
  return answers;
}

/**
 * The command's side: drops the tokens in the file, asks every running server
 * for a new code, and waits up to `waitMs` until each one answered.
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
  const expected = new Set(liveWatchers(dir, request.at - WATCHER_FRESH_MS, request.at));
  writePrivate(requestFile, request);
  const waitMs = options.waitMs ?? ROTATE_WAIT_MS;
  const pollMs = options.pollMs ?? 100;
  const deadline = Date.now() + waitMs;
  let answers = new Map<string, RotateAnswer>();
  try {
    while (expected.size) {
      answers = answersFor(dir, request.id);
      if ([...expected].every((id) => answers.has(id))) break;
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    answers = answersFor(dir, request.id);
  } finally {
    // The request must not rotate a server started later, and the answers hold codes.
    const left = readJson(requestFile) as Partial<RotateRequest> | undefined;
    if (left?.id === request.id) remove(requestFile);
    for (const name of filesIn(dir)) {
      if (name.startsWith(`${ANSWER_PREFIX}${request.id}.`)) remove(join(dir, name));
    }
  }
  const answered = [...answers.values()];
  return {
    dropped: Math.max(droppedInFile, ...answered.map((answer) => Number(answer.dropped) || 0)),
    answers: answered.map((answer) => ({
      code: answer.code,
      expiresAt: Number(answer.expiresAt) || 0,
    })),
    missing: [...expected].filter((id) => !answers.has(id)).length,
  };
}

interface AuthStorage {
  value(): { trusted?: Record<string, unknown> };
  mutate(fn: (state: { trusted: Record<string, unknown> }) => void): void;
}

/** One server's part in the rotation: its heartbeat id and the requests it answered. */
interface Watcher {
  id: string;
  handled: Set<string>;
}

const watchers = new WeakMap<object, Watcher>();

function watcherFor(ctx: unknown): Watcher {
  let watcher = watchers.get(ctx as object);
  if (!watcher) {
    watcher = { id: randomBytes(8).toString('hex'), handled: new Set() };
    watchers.set(ctx as object, watcher);
  }
  return watcher;
}

/**
 * The one-time code is devframe's, one per process. Two contexts in one
 * process answer the same request with the code the first one made, so the
 * second doesn't replace a code the command is about to print.
 */
const processCodes = new Map<string, { code: string; expireAt: number }>();

/** Renews the server's heartbeat, so a command waits for its answer. */
export function beatTokenRotation(ctx: unknown, dir: string, now = Date.now()): void {
  writePrivate(rotateWatcherFile(dir, watcherFor(ctx).id), { at: now });
}

/**
 * The server's side of one request: makes a new one-time code and writes its
 * answer, then drops every token it trusts and ends their connections.
 * Returns the answer, or null when there is no fresh request it hasn't
 * answered yet. The request stays for the other servers; the command deletes
 * it. Each server tries a request once, so one that fails is not tried again
 * every second.
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
  if (typeof request?.id !== 'string' || !SAFE_ID.test(request.id)) return null;
  if (typeof request.at !== 'number' || now - request.at > STALE_REQUEST_MS) return null;
  const watcher = watcherFor(ctx);
  if (watcher.handled.has(request.id)) return null;
  watcher.handled.add(request.id);
  let storage: AuthStorage;
  try {
    storage = getInternalContext(ctx as never).storage.auth as unknown as AuthStorage;
  } catch {
    return null;
  }
  const tokens = Object.keys(storage.value().trusted ?? {});
  const requestId = request.id;
  let made = processCodes.get(requestId);
  if (!made) {
    refreshTempAuthCode();
    made = getTempAuthCodeInfo();
    processCodes.set(requestId, made);
    setTimeout(() => processCodes.delete(requestId), STALE_REQUEST_MS).unref?.();
  }
  const answer: RotateAnswer = {
    id: request.id,
    watcher: watcher.id,
    code: made.code,
    expiresAt: made.expireAt,
    dropped: tokens.length,
  };
  // The answer goes first: a failed write throws with every token still trusted.
  write(rotateAnswerFile(dir, request.id, watcher.id), answer);
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
 * One look for a request, as the server's timer runs it, after renewing the
 * heartbeat. A failure is logged instead of thrown, so it can't stop the dev
 * server.
 */
export function pollTokenRotation(
  ctx: unknown,
  dir: string,
  log: (message: string) => void,
  answer: (ctx: unknown, dir: string) => RotateAnswer | null = answerRotateRequest,
): void {
  try {
    beatTokenRotation(ctx, dir);
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
 * Keeps a heartbeat in the project's token folder and looks for
 * `pangular token --rotate` requests there every second while the server
 * runs. The timer is `unref`'d and holds the context weakly, like the token
 * expiry (`expireAuthTokens`); once the context is gone, the heartbeat is
 * deleted.
 */
export function watchTokenRotation(
  ctx: unknown,
  dir: string,
  log: (message: string) => void = (message) => console.log(message),
): void {
  const context = ctx as { mode?: string };
  if (context.mode === 'build' || watching.has(context)) return;
  watching.add(context);
  const heartbeat = rotateWatcherFile(dir, watcherFor(context).id);
  const ref = new WeakRef(context);
  // Beat at once, so a command run right after the server starts waits for it.
  pollTokenRotation(context, dir, log);
  const timer = setInterval(() => {
    const live = ref.deref();
    if (!live) {
      clearInterval(timer);
      remove(heartbeat);
      return;
    }
    pollTokenRotation(live, dir, log);
  }, ROTATE_POLL_MS);
  timer.unref?.();
}

/** The command's output. The codes are printed only to the user who ran it. */
export function rotateText(result: RotateResult, now = Date.now()): string {
  const lines = [`Dropped ${result.dropped} trusted token(s) for this project.`];
  const minutes = (at: number) => Math.max(1, Math.round((at - now) / 60_000));
  const codes = [...new Map(result.answers.map((answer) => [answer.code, answer])).values()];
  if (codes.length === 1) {
    lines.push(
      `New one-time code: ${codes[0].code} (expires in ${minutes(codes[0].expiresAt)} min)`,
    );
  } else if (codes.length > 1) {
    lines.push('New one-time codes, one per running devtools server:');
    for (const answer of codes) {
      lines.push(`  ${answer.code} (expires in ${minutes(answer.expiresAt)} min)`);
    }
  }
  if (result.missing) {
    lines.push(
      `${result.missing} running devtools server(s) did not answer in time, so they still trust their tokens. Run the command again, or restart them.`,
    );
  } else if (!codes.length) {
    lines.push(
      'No running devtools server answered, so there is no code to print yet. The server prints a new one-time code when it starts.',
    );
  }
  if (codes.length) lines.push('Enter the code in the panel to connect again.');
  return lines.join('\n');
}
