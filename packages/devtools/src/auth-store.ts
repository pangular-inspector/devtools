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
// - Tokens older than `AUTH_TOKEN_TTL_MS` are dropped at startup and every hour.
//
// The "global" scope only holds `auth.json` (and settings stored under the
// `devframe:settings:global:` keys, which Pangular Inspector doesn't use), so
// the other scopes keep devframe's own folders.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { getInternalContext, internalContextMap } from 'devframe/node/hub-internals';

type StorageScope = 'workspace' | 'project' | 'global';

/** How long a token from the one-time code stays trusted: 7 days. */
export const AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

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
}

/** Drops tokens older than `ttl`. Returns how many it dropped. */
export function pruneExpiredTokens(
  storage: AuthStorage,
  now = Date.now(),
  ttl = AUTH_TOKEN_TTL_MS,
): number {
  const trusted = storage.value().trusted ?? {};
  const expired = Object.entries(trusted)
    .filter(([, record]) => typeof record?.timestamp !== 'number' || now - record.timestamp > ttl)
    .map(([token]) => token);
  if (!expired.length) return 0;
  storage.mutate((state) => {
    for (const token of expired) delete state.trusted[token];
  });
  return expired.length;
}

const pruning = new WeakSet<object>();

/**
 * Prunes the context's token store now and every hour. Safe to call more
 * than once per context. Skipped for a static build, which has no tokens.
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
  const prune = () => {
    if (pruneExpiredTokens(storage, Date.now(), ttl)) onPruned();
  };
  prune();
  const timer = setInterval(prune, PRUNE_EVERY_MS);
  timer.unref?.();
}
