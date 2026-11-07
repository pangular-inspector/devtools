import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { connectDevframe } from 'devframe/client';
import { getTempAuthCode, verifyAuthToken } from 'devframe/node/auth';
import { getInternalContext } from 'devframe/node/hub-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeGuard, guardedExchange } from '../auth-guard.ts';
import {
  authStoreDir,
  expireAuthTokens,
  hardenTokenStore,
  pruneExpiredTokens,
  AUTH_TOKEN_TTL_MS,
} from '../auth-store.ts';
import { initPangularHub } from '../hub.ts';

/**
 * Checks that `path` exists and, on POSIX, that only its owner can read it. Windows has no such
 * modes: `chmod` there only sets the read-only flag, and `stat` reports 0o666.
 */
function expectPrivate(path: string, mode: number) {
  const actual = statSync(path).mode & 0o777;
  if (process.platform !== 'win32') expect(actual).toBe(mode);
}

describe('CodeGuard', () => {
  function guard(now: { t: number }, warn = vi.fn()) {
    return new CodeGuard({ now: () => now.t, warn });
  }

  it('lets a client make a few wrong guesses, then doubles its wait', () => {
    const now = { t: 0 };
    const g = guard(now);
    const client = {};
    for (let i = 0; i < 3; i++) {
      expect(g.check(client)).toBe('ok');
      g.failed(client);
    }
    // The third wrong guess starts a 1 s wait.
    expect(g.check(client)).toBe('backoff');
    now.t = 1000;
    expect(g.check(client)).toBe('ok');
    g.failed(client);
    now.t = 2999;
    expect(g.check(client)).toBe('backoff');
    now.t = 3000;
    expect(g.check(client)).toBe('ok');
    // Another client is not slowed down.
    now.t = 1500;
    expect(g.check({})).toBe('ok');
  });

  it('caps wrong guesses from all clients per minute and warns once', () => {
    const now = { t: 0 };
    const warn = vi.fn();
    const g = guard(now, warn);
    for (let i = 0; i < 10; i++) g.failed({});
    expect(g.check({})).toBe('throttled');
    expect(g.check({})).toBe('throttled');
    expect(warn).toHaveBeenCalledTimes(1);
    now.t = 60_000;
    expect(g.check({})).toBe('ok');
  });

  it('locks after 50 wrong guesses until a restart, and a right code first resets the count', () => {
    const now = { t: 0 };
    const warn = vi.fn();
    const g = guard(now, warn);
    for (let i = 0; i < 49; i++) {
      now.t += 60_000;
      g.failed({});
    }
    g.succeeded({});
    for (let i = 0; i < 49; i++) {
      now.t += 60_000;
      g.failed({});
    }
    expect(g.locked).toBe(false);
    g.failed({});
    expect(g.locked).toBe(true);
    now.t += 24 * 60 * 60 * 1000;
    expect(g.check({})).toBe('locked');
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain(
      'Run pangular token --rotate in the project folder, or restart the dev server',
    );
  });
});

describe('guardedExchange', () => {
  function context(meta: object) {
    return {
      rpc: {
        definitions: new Map(),
        register: vi.fn(),
        getCurrentRpcSession: () => ({ meta }),
      },
    };
  }

  it('does not check the code while a client must wait, so the code is not rotated', () => {
    const meta = {};
    const exchange = vi.fn(() => null);
    const handler = guardedExchange(context(meta), new CodeGuard({ warn: vi.fn() }), exchange);
    for (let i = 0; i < 10; i++) handler({ code: '000000', ua: '', origin: '' });
    expect(exchange).toHaveBeenCalledTimes(3);
  });

  it('refuses a right code during the wait and accepts it after, then reports the trust', () => {
    const meta = {};
    const now = { t: 0 };
    const onTrusted = vi.fn();
    const exchange = vi.fn((params: { code: string }) => (params.code === '123456' ? 'tok' : null));
    const handler = guardedExchange(
      context(meta),
      new CodeGuard({ now: () => now.t, warn: vi.fn() }),
      exchange,
      onTrusted,
    );
    for (let i = 0; i < 3; i++) handler({ code: '000000', ua: '', origin: '' });
    expect(handler({ code: '123456', ua: '', origin: '' }).authToken).toBeNull();
    now.t = 1000;
    expect(handler({ code: '123456', ua: '', origin: '' }).authToken).toBe('tok');
    expect(onTrusted).toHaveBeenCalledOnce();
  });

  describe("with devframe's exchange", () => {
    // devframe's one-time code lives 5 minutes.
    const CODE_TTL_MS = 5 * 60_000;
    let dir = '';
    afterEach(() => {
      vi.useRealTimers();
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    function devframeContext(meta: object) {
      dir = mkdtempSync(join(tmpdir(), 'pangular-code-'));
      return { ...context(meta), host: { getStorageDir: () => dir } };
    }

    it('does not count a right code that expired before it arrived as a wrong guess', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const meta = {};
      const guard = new CodeGuard({ warn: vi.fn() });
      const handler = guardedExchange(devframeContext(meta) as never, guard);
      // A slow developer types the code just after it expires, more often than the lock allows.
      for (let i = 0; i < 60; i++) {
        const code = getTempAuthCode();
        vi.setSystemTime(Date.now() + CODE_TTL_MS + 1);
        expect(handler({ code, ua: '', origin: '' }).authToken).toBeNull();
      }
      expect(guard.locked).toBe(false);
      expect(guard.check(meta)).toBe('ok');
      expect(handler({ code: getTempAuthCode(), ua: '', origin: '' }).authToken).toBeTruthy();
    });

    it('still counts a wrong code, also one sent after the code expired', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const meta = {};
      const guard = new CodeGuard({ warn: vi.fn() });
      const handler = guardedExchange(devframeContext(meta) as never, guard);
      const wrong = (code: string) => (code === '000000' ? '000001' : '000000');
      handler({ code: wrong(getTempAuthCode()), ua: '', origin: '' });
      for (let i = 0; i < 2; i++) {
        const code = getTempAuthCode();
        vi.setSystemTime(Date.now() + CODE_TTL_MS + 1);
        handler({ code: wrong(code), ua: '', origin: '' });
      }
      // Three wrong guesses start the wait.
      expect(guard.check(meta)).toBe('backoff');
    });
  });

  it('answers null for a call without a session or a code', () => {
    const exchange = vi.fn(() => 'tok');
    const ctx = { rpc: { ...context({}).rpc, getCurrentRpcSession: () => undefined } };
    expect(guardedExchange(ctx, new CodeGuard(), exchange)({} as never).authToken).toBeNull();
    const withSession = guardedExchange(context({}), new CodeGuard(), exchange);
    expect(withSession({ code: 5 } as never).authToken).toBeNull();
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe('pruneExpiredTokens', () => {
  it('drops tokens older than the lifetime and ones without a time', () => {
    const state = {
      trusted: {
        fresh: { timestamp: 1_000 },
        old: { timestamp: 1_000 - AUTH_TOKEN_TTL_MS - 1 },
        none: {},
      } as Record<string, { timestamp?: number }>,
    };
    const storage = { value: () => state, mutate: (fn: (s: typeof state) => void) => fn(state) };
    expect(pruneExpiredTokens(storage, 1_000)).toBe(2);
    expect(Object.keys(state.trusted)).toEqual(['fresh']);
  });

  it('rebuilds the store without a prototype and drops entries that are not token records', () => {
    const state = {
      trusted: {
        good: { authToken: 'good', timestamp: 1 },
        legacy: { timestamp: 1 },
        swapped: { authToken: 'other', timestamp: 1 },
        bare: true,
      } as Record<string, unknown>,
    };
    const storage = {
      value: () => state as never,
      mutate: (fn: (s: never) => void) => fn(state as never),
    };
    expect(hardenTokenStore(storage)).toBe(2);
    expect(Object.getPrototypeOf(state.trusted)).toBeNull();
    expect(Object.keys(state.trusted)).toEqual(['good', 'legacy']);
    expect(state.trusted['constructor']).toBeUndefined();
    expect(state.trusted['toString']).toBeUndefined();
    expect(hardenTokenStore(storage)).toBe(0);
  });

  it('names the store after a hash of the project, not its path', () => {
    const dir = authStoreDir('/work/secret-project', '/home/me');
    expect(dirname(dir)).toBe(join('/home/me', '.pangular-inspector', 'auth'));
    expect(basename(dir)).toMatch(/^[0-9a-f]{16}$/);
    expect(authStoreDir('/work/other', '/home/me')).not.toBe(dir);
  });
});

describe('expireAuthTokens', () => {
  let dir = '';
  afterEach(() => {
    vi.useRealTimers();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function fakeContext(meta: Record<string, unknown>) {
    dir = mkdtempSync(join(tmpdir(), 'pangular-expiry-'));
    return {
      mode: 'dev',
      host: { getStorageDir: () => dir },
      // devframe's RPC host: the live connections, each with its session meta.
      rpc: { _rpcGroup: { clients: [{ $meta: meta }] }, broadcast: vi.fn(async () => undefined) },
    };
  }

  it('drops a token at its exact expiry and untrusts the connections that use it', () => {
    vi.useFakeTimers();
    const start = Date.UTC(2026, 0, 1);
    vi.setSystemTime(start);
    const meta: Record<string, unknown> = { id: 'a', isTrusted: true, clientAuthToken: 'tok' };
    const ctx = fakeContext(meta);
    const storage = getInternalContext(ctx as never).storage.auth;
    const onPruned = vi.fn();
    expireAuthTokens(ctx, onPruned);
    // Issued half an hour after the server started, so off the hourly beat.
    vi.advanceTimersByTime(30 * 60_000);
    const issuedAt = Date.now();
    storage.mutate((state) => {
      state.trusted['tok'] = { authToken: 'tok', ua: '', origin: '', timestamp: issuedAt };
    });

    vi.advanceTimersByTime(AUTH_TOKEN_TTL_MS - 1);
    expect(storage.value().trusted['tok']).toBeDefined();
    expect(meta['isTrusted']).toBe(true);

    vi.advanceTimersByTime(1);
    expect(Date.now()).toBe(issuedAt + AUTH_TOKEN_TTL_MS);
    expect(storage.value().trusted['tok']).toBeUndefined();
    expect(verifyAuthToken('tok', { meta: {} } as never, storage)).toBe(false);
    expect(meta['isTrusted']).toBe(false);
    expect(meta['clientAuthToken']).toBeUndefined();
    expect(ctx.rpc.broadcast).toHaveBeenCalledOnce();
    expect(onPruned).toHaveBeenCalledOnce();
  });

  it('untrusts a live connection once the prune has dropped its token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 1));
    const meta: Record<string, unknown> = { id: 'a', isTrusted: true, clientAuthToken: 'tok' };
    const other: Record<string, unknown> = { id: 'b', isTrusted: true, clientAuthToken: 'kept' };
    const ctx = fakeContext(meta);
    ctx.rpc._rpcGroup.clients.push({ $meta: other });
    const storage = getInternalContext(ctx as never).storage.auth;
    storage.mutate((state) => {
      state.trusted['tok'] = { authToken: 'tok', ua: '', origin: '', timestamp: Date.now() };
    });
    expireAuthTokens(ctx);
    vi.advanceTimersByTime(3 * 60 * 60_000);
    storage.mutate((state) => {
      state.trusted['kept'] = { authToken: 'kept', ua: '', origin: '', timestamp: Date.now() };
    });
    // Two hours past the first token's expiry, so any schedule has pruned it by now.
    vi.advanceTimersByTime(AUTH_TOKEN_TTL_MS - 60 * 60_000);
    expect(storage.value().trusted['kept']).toBeDefined();
    expect(storage.value().trusted['tok']).toBeUndefined();
    expect(meta['isTrusted']).toBe(false);
    expect(other['isTrusted']).toBe(true);
  });
});

describe('initPangularHub one-time code', () => {
  const cleanups: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    // The devframe client keeps its last connection and token on globalThis.
    const stored = globalThis as Record<string, unknown>;
    for (const key of [
      '__DEVFRAME_CONNECTION__',
      '__DEVFRAME_CONNECTION_META__',
      '__DEVFRAME_CONNECTION_AUTH_TOKEN__',
    ]) {
      delete stored[key];
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function serve(seed?: (home: string) => void) {
    const home = mkdtempSync(join(tmpdir(), 'pangular-home-'));
    // `homedir()` reads HOME on POSIX and USERPROFILE on Windows.
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    seed?.(home);
    const hub = initPangularHub({ ws: false, mcp: false });
    const server: Server = createServer((req, res) =>
      hub.nodeMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    cleanups.push(() => hub.close());
    vi.stubGlobal('location', new URL(`http://127.0.0.1:${port}/`));
    await hub.context;
    const baseURL = `http://127.0.0.1:${port}/__devframes/pangular/`;
    const connect = async (authToken?: string) => {
      const client = await connectDevframe({
        baseURL,
        ...(authToken ? { authToken } : {}),
        simpleAuth: false,
        otpParam: false,
        webmcp: false,
      });
      cleanups.push(() => client.close?.());
      return client;
    };
    const rpc = await connect();
    return { rpc, home, connect };
  }

  it('trusts no token named after an Object.prototype property', async () => {
    const { rpc, connect, home } = await serve();
    expect(await rpc.requestTrustWithCode(getTempAuthCode())).toBeTruthy();
    for (const token of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const client = await connect(token);
      expect(await client.ensureTrusted(500).catch(() => false), token).toBe(false);
    }
    const file = join(authStoreDir(process.cwd(), home), 'auth.json');
    const issued = await vi.waitFor(
      () => Object.keys(JSON.parse(readFileSync(file, 'utf8')).trusted)[0] as string,
      { timeout: 3000 },
    );
    expect(await (await connect(issued)).ensureTrusted(3000)).toBe(true);
  });

  it('slows down a client that guesses, and stores its token privately per project', async () => {
    const { rpc, home } = await serve();
    const wrong = (code: string) => (code === '000000' ? '000001' : '000000');
    for (let i = 0; i < 3; i++) {
      expect(await rpc.requestTrustWithCode(wrong(getTempAuthCode()))).toBeFalsy();
    }
    // The client has to wait now, so even the right code is refused.
    expect(await rpc.requestTrustWithCode(getTempAuthCode())).toBeFalsy();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await rpc.requestTrustWithCode(getTempAuthCode())).toBeTruthy();

    const dir = authStoreDir(process.cwd(), home);
    const file = join(dir, 'auth.json');
    // The store holds an empty `auth.json` from startup and devframe writes the token a moment
    // later, so wait for the token itself. Only on POSIX does the mode check also wait for it.
    await vi.waitFor(
      () => {
        expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).trusted)).toHaveLength(1);
        expectPrivate(file, 0o600);
      },
      { timeout: 3000 },
    );
    expectPrivate(dir, 0o700);
    expect(existsSync(join(home, '.devframes', 'devframe', 'auth.json'))).toBe(false);
  });

  it('stops trusting a connected client when its token expires', async () => {
    // The token has four seconds left, room for the hub to start and the client to be trusted.
    const issuedAt = Date.now() - AUTH_TOKEN_TTL_MS + 4000;
    const { connect } = await serve((home) => {
      const dir = authStoreDir(process.cwd(), home);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'auth.json'),
        JSON.stringify({
          trusted: { 'expiring-token': { authToken: 'expiring-token', timestamp: issuedAt } },
        }),
      );
    });
    const client = await connect('expiring-token');
    expect(await client.ensureTrusted(1000)).toBe(true);
    await vi.waitFor(() => expect(client.isTrusted).toBe(false), { timeout: 6000 });
    const again = await connect('expiring-token');
    expect(await again.ensureTrusted(500).catch(() => false)).toBe(false);
  }, 15_000);

  it('drops expired tokens at startup and keeps the rewritten file private', async () => {
    const old = Date.now() - AUTH_TOKEN_TTL_MS - 1000;
    let file = '';
    await serve((home) => {
      const dir = authStoreDir(process.cwd(), home);
      mkdirSync(dir, { recursive: true });
      file = join(dir, 'auth.json');
      writeFileSync(
        file,
        JSON.stringify({
          trusted: { 'old-token': { timestamp: old }, 'fresh-token': { timestamp: Date.now() } },
        }),
        { mode: 0o644 },
      );
    });
    await vi.waitFor(
      () => {
        expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).trusted)).toEqual([
          'fresh-token',
        ]);
        expectPrivate(file, 0o600);
      },
      { timeout: 3000 },
    );
  });
});
