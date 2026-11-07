// Where trusted session tokens live, and how long they stay trusted.
//
// devframe keeps the tokens it mints for the one-time code in `auth.json`
// under its "global" storage folder, `~/.devframes/devframe` for the hub or
// `~/.pangular/devframe` for the CLI. It writes that file with the default
// umask (readable by other users), never expires a token, and shares it with
// every server on the machine. devframe takes the storage folder from its
// host, so the devframe's setup points it elsewhere (`scopeAuthStore()`):
//
// - `~/.pangular-inspector/auth/<project hash>/`, in a folder only the user
//   can read (`0700`), with the file itself kept at `0600`. One project's
//   tokens don't open another project's server.
// - Tokens older than `AUTH_TOKEN_TTL_MS` are dropped at startup and at the
//   moment they expire, and connections that used them stop being trusted.
//   devframe's `verifyAuthToken` only checks that a token is in the store, so
//   removing it on time is what ends it.
//
// The "global" scope only holds `auth.json` (and settings stored under the
// `devframe:settings:global:` keys, which Pangular Inspector doesn't use), so
// the other scopes keep devframe's own folders.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { revokeActiveConnectionsForToken } from 'devframe/node/auth';
import { getInternalContext, internalContextMap } from 'devframe/node/hub-internals';

type StorageScope = 'workspace' | 'project' | 'global';

/** How long a token from the one-time code stays trusted: 7 days. */
export const AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * The longest wait between two prunes. The next prune runs when the oldest
 * token expires, but no later than this: Node's timers don't count time the
 * machine sleeps, so a long wait could end well after the expiry.
 */
const MAX_PRUNE_WAIT_MS = 60 * 1000;

/** The folder that holds every project's token store. */
export function authStoreRoot(home: string = homedir()): string {
  return join(home, '.pangular-inspector', 'auth');
}

/** The token store folder for one project: a hash of its absolute path, so no path leaks. */
export function authStoreDir(projectRoot: string, home: string = homedir()): string {
  const key = createHash('sha256').update(resolve(projectRoot)).digest('hex').slice(0, 16);
  return join(authStoreRoot(home), key);
}

function ensurePrivateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const path of [join(dir, '..', '..'), join(dir, '..'), dir]) {
    try {
      chmodSync(path, 0o700);
    } catch {
      // A folder we can't change (another owner, Windows) keeps its mode.
    }
  }
}

/** Keeps the token file readable by its owner only. devframe rewrites it with the default mode. */
export function protectAuthFile(dir: string): void {
  const file = join(dir, 'auth.json');
  try {
    if (existsSync(file)) chmodSync(file, 0o600);
  } catch {
    // Windows, or a file we don't own.
  }
}

/** The private, per-project folder for `auth.json`, created `0700`. */
export function privateAuthStoreDir(projectRoot: string, home: string = homedir()): string {
  const dir = authStoreDir(projectRoot, home);
  ensurePrivateDir(dir);
  protectAuthFile(dir);
  return dir;
}

/**
 * The hub's `getStorageDir`: devframe's own hub folders for `workspace` and
 * `project`, and the private token store for `global`. The hub opens its token
 * store when it creates its context, before any devframe's setup, so it takes
 * this as its `getStorageDir` option.
 */
export function hubStorageDir(
  cwd: string,
  home: string = homedir(),
): (scope: StorageScope) => string {
  const root = resolve(cwd);
  return (scope) => {
    if (scope === 'workspace') return join(root, '.devframe');
    if (scope === 'project') return join(root, 'node_modules', '.devframes', 'devframe');
    return privateAuthStoreDir(root, home);
  };
}

interface StorageHost {
  getStorageDir(scope: StorageScope): string;
}

const scoped = new WeakSet<object>();

/**
 * Points the context's "global" storage, which only holds `auth.json`, at the
 * private per-project store, for a server whose token store isn't open yet
 * (the CLI opens it after the devframe's setup, so the setup calls this; the
 * hub takes `hubStorageDir()` instead). The other scopes keep devframe's
 * folders. Returns the folder that holds `auth.json`. Skipped for a static build.
 */
export function scopeAuthStore(ctx: unknown, home: string = homedir()): string | undefined {
  const context = ctx as { mode?: string; cwd?: string; host?: StorageHost };
  const host = context.host;
  if (context.mode === 'build' || !host || typeof host.getStorageDir !== 'function') return;
  const opened = internalContextMap.has(ctx as never);
  if (!opened && !scoped.has(host)) {
    scoped.add(host);
    const root = resolve(context.cwd ?? process.cwd());
    const original = host.getStorageDir.bind(host);
    host.getStorageDir = (scope) =>
      scope === 'global' ? privateAuthStoreDir(root, home) : original(scope);
  }
  try {
    return host.getStorageDir('global');
  } catch {
    return undefined;
  }
}

interface TrustedRecord {
  timestamp?: number;
}

interface AuthStorage {
  value(): { trusted?: Record<string, TrustedRecord> };
  mutate(fn: (state: { trusted: Record<string, TrustedRecord> }) => void): void;
  /** devframe's storage is a shared state, which emits `updated` after each change. */
  on?(event: 'updated', fn: () => void): unknown;
}

function isTokenRecord(token: string, record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const { authToken, timestamp } = record as TrustedRecord & { authToken?: unknown };
  return typeof timestamp === 'number' && (authToken === undefined || authToken === token);
}

/**
 * devframe trusts a token when `trusted[token]` is truthy. With an ordinary
 * object that includes inherited keys, so `constructor` or `toString` would
 * pass as a token. This rebuilds `trusted` with no prototype, keeping only
 * own entries that hold a record for their own token. devframe's storage
 * copies objects with their prototype, so the store stays prototype-free
 * through later exchanges and revokes. Returns how many entries it dropped.
 */
export function hardenTokenStore(storage: AuthStorage): number {
  const trusted = storage.value().trusted;
  const entries = trusted && typeof trusted === 'object' ? Object.entries(trusted) : [];
  const kept = entries.filter(([token, record]) => isTokenRecord(token, record));
  if (trusted && Object.getPrototypeOf(trusted) === null && kept.length === entries.length) {
    return 0;
  }
  storage.mutate((state) => {
    state.trusted = Object.assign(
      Object.create(null) as Record<string, TrustedRecord>,
      Object.fromEntries(kept),
    );
  });
  return entries.length - kept.length;
}

function isExpired(record: TrustedRecord | undefined, now: number, ttl: number): boolean {
  return typeof record?.timestamp !== 'number' || now - record.timestamp >= ttl;
}

/** Drops tokens that are `ttl` old or older, and ones without a time. Returns the dropped tokens. */
function dropExpiredTokens(storage: AuthStorage, now: number, ttl: number): string[] {
  const trusted = storage.value().trusted ?? {};
  const expired = Object.entries(trusted)
    .filter(([, record]) => isExpired(record, now, ttl))
    .map(([token]) => token);
  if (!expired.length) return expired;
  storage.mutate((state) => {
    for (const token of expired) delete state.trusted[token];
  });
  return expired;
}

/** Drops tokens that are `ttl` old or older. Returns how many it dropped. */
export function pruneExpiredTokens(
  storage: AuthStorage,
  now = Date.now(),
  ttl = AUTH_TOKEN_TTL_MS,
): number {
  return dropExpiredTokens(storage, now, ttl).length;
}

/** How long until the next token expires, at most `MAX_PRUNE_WAIT_MS`. */
function nextPruneDelay(storage: AuthStorage, now = Date.now(), ttl = AUTH_TOKEN_TTL_MS): number {
  let delay = MAX_PRUNE_WAIT_MS;
  for (const record of Object.values(storage.value().trusted ?? {})) {
    if (typeof record?.timestamp === 'number') {
      delay = Math.min(delay, record.timestamp + ttl - now);
    }
  }
  return Math.max(1, delay);
}

const pruning = new WeakSet<object>();

/**
 * Hardens the context's token store (`hardenTokenStore`), then prunes it now,
 * when each token expires and at least every minute. A pruned token's live
 * connections stop being trusted (devframe's `revokeActiveConnectionsForToken`,
 * which also tells their clients). Safe to call more than once per context.
 * Skipped for a static build, which has no tokens.
 *
 * devframe gives the context no dispose hook, so the timer is `unref`'d and
 * holds the context weakly: once the context is gone, the timer stops.
 */
export function expireAuthTokens(
  ctx: unknown,
  onPruned: () => void = () => undefined,
  ttl = AUTH_TOKEN_TTL_MS,
): void {
  const context = ctx as { mode?: string };
  if (context.mode === 'build' || pruning.has(context)) return;
  pruning.add(context);
  let storage: AuthStorage;
  try {
    storage = getInternalContext(ctx as never).storage.auth as unknown as AuthStorage;
  } catch {
    return;
  }
  // devframe rewrites the file after a change, with the default mode.
  hardenTokenStore(storage);
  const ref = new WeakRef(context);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  const schedule = (store: AuthStorage) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, nextPruneDelay(store, Date.now(), ttl));
    timer.unref?.();
  };
  const prune = (live: object, store: AuthStorage) => {
    let dropped: string[] = [];
    busy = true;
    try {
      dropped = dropExpiredTokens(store, Date.now(), ttl);
    } finally {
      busy = false;
      // Even if this prune failed, the next one runs.
      schedule(store);
    }
    for (const token of dropped) {
      // Flips `isTrusted` off synchronously, then tells the clients.
      void revokeActiveConnectionsForToken(live as never, token).catch(() => undefined);
    }
    if (dropped.length) onPruned();
  };
  function run() {
    timer = undefined;
    const live = ref.deref();
    if (!live) return;
    let store: AuthStorage;
    try {
      store = getInternalContext(live as never).storage.auth as unknown as AuthStorage;
    } catch {
      return;
    }
    prune(live, store);
  }
  // A new token, or one revoked elsewhere, moves the next expiry.
  storage.on?.('updated', () => {
    if (busy) return;
    const live = ref.deref();
    if (live) schedule(getInternalContext(live as never).storage.auth as unknown as AuthStorage);
  });
  prune(context, storage);
}
