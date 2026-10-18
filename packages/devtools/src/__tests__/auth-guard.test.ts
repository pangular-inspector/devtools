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
import { join } from 'node:path';
import { connectDevframe } from 'devframe/client';
import { getTempAuthCode } from 'devframe/node/auth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeGuard, guardedExchange } from '../auth-guard.ts';
import { authStoreDir, pruneExpiredTokens, AUTH_TOKEN_TTL_MS } from '../auth-store.ts';
import { initPangularHub } from '../hub.ts';

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
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain('Restart the dev server');
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

  it('names the store after a hash of the project, not its path', () => {
    const dir = authStoreDir('/work/secret-project', '/home/me');
    expect(dir).toMatch(/^\/home\/me\/\.pangular-inspector\/auth\/[0-9a-f]{16}$/);
    expect(authStoreDir('/work/other', '/home/me')).not.toBe(dir);
  });
});

describe('initPangularHub one-time code', () => {
  const cleanups: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function serve(seed?: (home: string) => void) {
    const home = mkdtempSync(join(tmpdir(), 'pangular-home-'));
    vi.stubEnv('HOME', home);
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
    const rpc = await connectDevframe({
      baseURL: `http://127.0.0.1:${port}/__devframes/pangular/`,
      simpleAuth: false,
      otpParam: false,
      webmcp: false,
    });
    cleanups.push(() => rpc.close?.());
    return { rpc, home };
  }

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
    await vi.waitFor(() => expect(statSync(file).mode & 0o777).toBe(0o600), { timeout: 3000 });
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).trusted)).toHaveLength(1);
    expect(existsSync(join(home, '.devframes', 'devframe', 'auth.json'))).toBe(false);
  });

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
        expect(statSync(file).mode & 0o777).toBe(0o600);
      },
      { timeout: 3000 },
    );
  });
});
