// Brute-force guard for the one-time code.
//
// devframe's code has 6 digits and rotates after 5 wrong guesses, but it
// never limits how many guesses come in, so a client can try tens of
// thousands of codes a second. The code is devframe's, so this guard wraps
// the exchange instead: devframe's RPC core registers its auth functions only
// when no function of that name is registered yet, so the devframe's setup
// registers `anonymous:devframe:auth:exchange` first, and the default
// exchange runs only for attempts the guard lets through.
//
// - Per client: after a few wrong codes, each next attempt waits twice as long.
// - Globally: at most `windowLimit` wrong codes per `windowMs`, from all clients.
// - Lock: after `lockAfter` wrong codes since the last right one, no code is
//   accepted until the server restarts. A new code does not unlock it, since
//   any client may ask for one. Clients that are already trusted stay trusted.
//
// Attempts the guard refuses are not checked, so they don't rotate the code
// the developer is typing either.
//
// devframe answers `null` both for a wrong code and for the right code sent
// after it expired. Only a wrong code counts: an attempt is left uncounted
// when it carries exactly the code that was current when it arrived, which
// only the developer (or a right guess) can send, so no guess goes uncounted.
import { createHash, timingSafeEqual } from 'node:crypto';
import { exchangeTempAuthCode, getTempAuthCode } from 'devframe/node/auth';
import { getInternalContext } from 'devframe/node/hub-internals';

const EXCHANGE = 'anonymous:devframe:auth:exchange';

export interface CodeGuardOptions {
  /** Wrong codes a client may send before it has to wait. */
  freeAttempts?: number;
  /** The first wait, doubled for each further wrong code. */
  backoffMs?: number;
  /** The longest wait for one client. */
  maxBackoffMs?: number;
  /** Wrong codes from all clients allowed in one window. */
  windowLimit?: number;
  windowMs?: number;
  /** Wrong codes since the last right one that lock the exchange until a restart. */
  lockAfter?: number;
  now?: () => number;
  warn?: (message: string) => void;
}

export type CodeGuardVerdict = 'ok' | 'backoff' | 'throttled' | 'locked';

interface ClientState {
  failures: number;
  nextAt: number;
}

export const CODE_GUARD_DEFAULTS = {
  freeAttempts: 3,
  backoffMs: 1000,
  maxBackoffMs: 60_000,
  windowLimit: 10,
  windowMs: 60_000,
  lockAfter: 50,
} as const;

/**
 * Counts wrong one-time codes per client and in total. `check()` before an
 * attempt, then `failed()` or `succeeded()` with its result. Clients are keyed
 * by object (the RPC session's meta) in a `WeakMap`, so a closed connection
 * leaves nothing behind.
 */
export class CodeGuard {
  private readonly options: Required<Omit<CodeGuardOptions, 'now' | 'warn'>>;
  private readonly now: () => number;
  private readonly warn: (message: string) => void;
  private clients = new WeakMap<object, ClientState>();
  private recent: number[] = [];
  private failures = 0;
  private warnedWindowAt = -Infinity;
  locked = false;

  constructor(options: CodeGuardOptions = {}) {
    const { now, warn, ...rest } = options;
    this.options = { ...CODE_GUARD_DEFAULTS, ...rest };
    this.now = now ?? Date.now;
    this.warn = warn ?? ((message) => console.warn(message));
  }

  check(client: object): CodeGuardVerdict {
    if (this.locked) return 'locked';
    const now = this.now();
    this.recent = this.recent.filter((at) => now - at < this.options.windowMs);
    if (this.recent.length >= this.options.windowLimit) {
      if (now - this.warnedWindowAt >= this.options.windowMs) {
        this.warnedWindowAt = now;
        this.warn(
          `[pangular] More than ${this.options.windowLimit} wrong one-time codes in a minute. The devtools server ignores codes for a moment. If you didn't type them, something on this machine or network is guessing the code.`,
        );
      }
      return 'throttled';
    }
    const state = this.clients.get(client);
    if (state && now < state.nextAt) return 'backoff';
    return 'ok';
  }

  failed(client: object): void {
    const now = this.now();
    this.recent.push(now);
    this.failures += 1;
    const state = this.clients.get(client) ?? { failures: 0, nextAt: 0 };
    state.failures += 1;
    const over = state.failures - this.options.freeAttempts;
    if (over >= 0) {
      state.nextAt =
        now + Math.min(this.options.maxBackoffMs, this.options.backoffMs * 2 ** Math.min(over, 30));
    }
    this.clients.set(client, state);
    if (this.failures >= this.options.lockAfter && !this.locked) {
      this.locked = true;
      this.warn(
        `\n  [pangular] WARNING: ${this.failures} wrong one-time codes. The devtools server no longer accepts codes.\n` +
          '  Restart the dev server to get a new code. Clients that already connected stay connected.\n' +
          "  If you didn't type these codes, something on this machine or network is guessing the code.\n",
      );
    }
  }

  succeeded(client: object): void {
    this.clients.delete(client);
    this.failures = 0;
    this.recent = [];
  }

  /** Forgets every wrong code and unlocks the exchange: the user rotated the tokens and the code. */
  reset(): void {
    this.clients = new WeakMap();
    this.failures = 0;
    this.recent = [];
    this.locked = false;
  }
}

interface AuthSession {
  meta: object & { isTrusted?: boolean };
}

interface ExchangeParams {
  code: string;
  ua: string;
  origin: string;
}

interface GuardContext {
  mode?: string;
  rpc: {
    definitions: Map<string, unknown>;
    register(definition: unknown): void;
    getCurrentRpcSession(): AuthSession | undefined;
  };
}

/**
 * devframe's exchange: checks the code, and on a match stores and returns a
 * new token. `'expired'` means the code was the current one but had expired,
 * so devframe rotated it; `null` means a wrong code.
 */
export type CodeExchange = (
  params: ExchangeParams,
  session: AuthSession,
) => string | null | 'expired';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Compares two codes in constant time, whatever their lengths. */
function sameCode(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

function defaultExchange(ctx: GuardContext): CodeExchange {
  return (params, session) => {
    const storage = getInternalContext(ctx as never).storage.auth;
    // The code devframe checks against. Reading it changes nothing: devframe
    // only creates one when there is none, as the exchange would.
    const current = getTempAuthCode();
    const authToken = exchangeTempAuthCode(params.code, session as never, params, storage);
    if (authToken) return authToken;
    // devframe accepts the current code unless it has expired, so a refused
    // current code was an expired one.
    return sameCode(params.code, current) ? 'expired' : null;
  };
}

/** The exchange handler, guarded. Exported for tests. */
export function guardedExchange(
  ctx: GuardContext,
  guard: CodeGuard,
  exchange: CodeExchange = defaultExchange(ctx),
  onTrusted?: () => void,
) {
  return (params: ExchangeParams): { authToken: string | null } => {
    const session = ctx.rpc.getCurrentRpcSession();
    if (!session) return { authToken: null };
    if (typeof params?.code !== 'string' || guard.check(session.meta) !== 'ok') {
      return { authToken: null };
    }
    const result = exchange(
      { code: params.code, ua: String(params.ua ?? ''), origin: String(params.origin ?? '') },
      session,
    );
    // The right code, too late: not a guess, so neither counted nor trusted.
    if (result === 'expired') return { authToken: null };
    if (result) {
      guard.succeeded(session.meta);
      onTrusted?.();
    } else guard.failed(session.meta);
    return { authToken: result };
  };
}

const guards = new WeakMap<object, CodeGuard>();

/**
 * Whether the context's code guard locked the exchange after too many wrong
 * codes (`CodeGuard.locked`). False when no guard was registered.
 */
export function codeGuardLocked(ctx: unknown): boolean {
  return guards.get(ctx as object)?.locked ?? false;
}

/**
 * Unlocks the context's code guard. Only `pangular token --rotate` calls it,
 * which the user runs on this machine, so a guesser can't unlock it.
 */
export function resetCodeGuard(ctx: unknown): void {
  guards.get(ctx as object)?.reset();
}

/**
 * Registers the guarded code exchange on the devframe's RPC host, before
 * devframe registers its own. Returns false when an exchange was registered
 * already, so the guard can't take effect.
 */
export function registerCodeGuard(
  ctx: unknown,
  options: CodeGuardOptions & { onTrusted?: () => void } = {},
): boolean {
  const context = ctx as GuardContext;
  if (context.mode === 'build') return true;
  if (context.rpc.definitions.has(EXCHANGE)) return false;
  const { onTrusted, ...guardOptions } = options;
  const guard = new CodeGuard(guardOptions);
  guards.set(context, guard);
  const handler = guardedExchange(context, guard, defaultExchange(context), onTrusted);
  context.rpc.register({ name: EXCHANGE, type: 'action', jsonSerializable: true, handler });
  return true;
}
