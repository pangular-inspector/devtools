import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cac from 'cac';
import { getTempAuthCode, verifyAuthToken } from 'devframe/node/auth';
import { getInternalContext } from 'devframe/node/hub-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ROTATE_REQUEST_FILE,
  answerRotateRequest,
  beatTokenRotation,
  clearTokenFile,
  pollTokenRotation,
  rotateAnswerFile,
  rotateText,
  rotateTokens,
  rotateWatcherFile,
  tokenFileSummary,
} from '../auth-rotate.ts';
import { codeGuardLocked, registerCodeGuard } from '../auth-guard.ts';
import { privateAuthStoreDir } from '../auth-store.ts';
import { registerTokenCommand, tokenStatusText } from '../token-command.ts';

const dirs: string[] = [];
function temp(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.useRealTimers();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function seedFile(dir: string, trusted: Record<string, unknown>) {
  writeFileSync(join(dir, 'auth.json'), JSON.stringify({ trusted, other: 1 }));
}

/** A server context whose token store is the project's private folder, with one live connection. */
function serverContext(dir: string, meta: Record<string, unknown>) {
  return {
    mode: 'dev',
    host: { getStorageDir: () => dir },
    rpc: {
      _rpcGroup: { clients: [{ $meta: meta }] },
      broadcast: vi.fn(async () => undefined),
      definitions: new Map(),
      register: () => undefined,
      getCurrentRpcSession: () => undefined,
    },
  };
}

describe('token file', () => {
  it('counts and clears the tokens, keeping the other keys, file 0600', () => {
    const dir = temp('pangular-tokens-');
    const now = Date.now();
    seedFile(dir, { a: { timestamp: now }, b: { timestamp: now - 1000 } });
    expect(tokenFileSummary(dir, now).count).toBe(2);
    expect(clearTokenFile(dir)).toBe(2);
    expect(JSON.parse(readFileSync(join(dir, 'auth.json'), 'utf8'))).toEqual({
      trusted: {},
      other: 1,
    });
    if (process.platform !== 'win32') {
      expect(statSync(join(dir, 'auth.json')).mode & 0o777).toBe(0o600);
    }
    expect(tokenFileSummary(dir, now).count).toBe(0);
    expect(clearTokenFile(temp('pangular-empty-'))).toBe(0);
  });

  it('says how many tokens there are, never a token', () => {
    const dir = temp('pangular-status-');
    expect(tokenStatusText(dir)).toContain('No trusted tokens');
    seedFile(dir, { 'secret-token-value': { timestamp: Date.now() } });
    const text = tokenStatusText(dir);
    expect(text).toContain('1 trusted token(s)');
    expect(text).not.toContain('secret-token-value');
  });
});

/** A trusted token on a server context, with the live connection that used it. */
function trustToken(ctx: ReturnType<typeof serverContext>, token: string) {
  const storage = getInternalContext(ctx as never).storage.auth;
  storage.mutate((state) => {
    state.trusted[token] = { authToken: token, ua: '', origin: '', timestamp: Date.now() };
  });
  return storage;
}

/** Runs the server's poll for each context every 10 ms, as `watchTokenRotation` does every second. */
function serve(contexts: ReturnType<typeof serverContext>[], dir: string, log = vi.fn()) {
  const tick = () => {
    for (const ctx of contexts) pollTokenRotation(ctx, dir, log);
  };
  tick();
  const timer = setInterval(tick, 10);
  return () => clearInterval(timer);
}

const REQUEST_ID = 'abcdef0123456789';

describe('pangular token --rotate', () => {
  it('drops the file tokens and says so when no server runs', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    const dir = privateAuthStoreDir(root, home);
    seedFile(dir, { a: { timestamp: Date.now() } });
    const result = await rotateTokens(root, { home, waitMs: 50, pollMs: 10 });
    expect(result).toEqual({ dropped: 1, answers: [], missing: 0 });
    // The request is gone, so a server started later doesn't rotate.
    expect(existsSync(join(dir, ROTATE_REQUEST_FILE))).toBe(false);
    expect(rotateText(result)).toContain('No running devtools server answered');
  });

  it('has the running server drop its tokens, untrust their connections and print a new code', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    const dir = privateAuthStoreDir(root, home);
    const meta: Record<string, unknown> = { id: 'a', isTrusted: true, clientAuthToken: 'tok' };
    const ctx = serverContext(dir, meta);
    const storage = trustToken(ctx, 'tok');
    const before = getTempAuthCode();
    const stop = serve([ctx], dir);
    let result;
    try {
      result = await rotateTokens(root, { home, waitMs: 2000, pollMs: 10 });
    } finally {
      stop();
    }
    expect(result.missing).toBe(0);
    expect(result.dropped).toBe(1);
    expect(result.answers).toHaveLength(1);
    const [{ code, expiresAt }] = result.answers;
    expect(code).toMatch(/^\d+$/);
    expect(code).toBe(getTempAuthCode());
    expect(code).not.toBe(before);
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(rotateText(result, Date.now())).toContain(`New one-time code: ${code}`);
    expect(verifyAuthToken('tok', { meta: {} } as never, storage)).toBe(false);
    expect(meta['isTrusted']).toBe(false);
    // The request and the answer, which holds the code, are deleted once read.
    expect(readdirSync(dir).filter((name) => name.startsWith('rotate-answer.'))).toEqual([]);
    expect(existsSync(join(dir, ROTATE_REQUEST_FILE))).toBe(false);
  });

  it('rotates every server that shares the token folder, not only the first to see the request', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    const dir = privateAuthStoreDir(root, home);
    const metaA: Record<string, unknown> = { id: 'a', isTrusted: true, clientAuthToken: 'tokA' };
    const metaB: Record<string, unknown> = { id: 'b', isTrusted: true, clientAuthToken: 'tokB' };
    const a = serverContext(dir, metaA);
    const b = serverContext(dir, metaB);
    const storageA = trustToken(a, 'tokA');
    const storageB = trustToken(b, 'tokB');
    const stop = serve([a, b], dir);
    let result;
    try {
      result = await rotateTokens(root, { home, waitMs: 2000, pollMs: 10 });
    } finally {
      stop();
    }
    expect(result.missing).toBe(0);
    expect(result.answers).toHaveLength(2);
    // One process has one code: the second context answers with the first one's.
    expect(new Set(result.answers.map((answer) => answer.code)).size).toBe(1);
    expect(verifyAuthToken('tokA', { meta: {} } as never, storageA)).toBe(false);
    expect(verifyAuthToken('tokB', { meta: {} } as never, storageB)).toBe(false);
    expect(metaA['isTrusted']).toBe(false);
    expect(metaB['isTrusted']).toBe(false);
  });

  it('does not let one server delete the request before another answered', () => {
    const dir = temp('pangular-shared-');
    const a = serverContext(dir, {});
    const b = serverContext(dir, {});
    writeFileSync(
      join(dir, ROTATE_REQUEST_FILE),
      JSON.stringify({ id: REQUEST_ID, at: Date.now() }),
    );
    const first = answerRotateRequest(a, dir);
    expect(first?.id).toBe(REQUEST_ID);
    expect(existsSync(join(dir, ROTATE_REQUEST_FILE))).toBe(true);
    expect(answerRotateRequest(b, dir)?.id).toBe(REQUEST_ID);
    expect(existsSync(rotateAnswerFile(dir, REQUEST_ID, first!.watcher))).toBe(true);
    // Each server answers a request once.
    expect(answerRotateRequest(a, dir)).toBeNull();
  });

  it('says which running servers did not answer in time, and keeps no code for them', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    const dir = privateAuthStoreDir(root, home);
    const live = serverContext(dir, {});
    // A server with a fresh heartbeat that never answers, such as one that is busy.
    writeFileSync(rotateWatcherFile(dir, 'deadbeefdeadbeef'), JSON.stringify({ at: Date.now() }));
    // A heartbeat from a server that stopped long ago is not waited for.
    writeFileSync(rotateWatcherFile(dir, 'cafecafecafecafe'), JSON.stringify({ at: 0 }));
    const stop = serve([live], dir);
    let result;
    try {
      result = await rotateTokens(root, { home, waitMs: 200, pollMs: 10 });
    } finally {
      stop();
    }
    expect(result.answers).toHaveLength(1);
    expect(result.missing).toBe(1);
    const text = rotateText(result, Date.now());
    expect(text).toContain('New one-time code:');
    expect(text).toContain('1 running devtools server(s) did not answer in time');
    expect(existsSync(rotateWatcherFile(dir, 'cafecafecafecafe'))).toBe(false);
  });

  it('keeps a heartbeat file per server', () => {
    const dir = temp('pangular-beat-');
    const ctx = serverContext(dir, {});
    beatTokenRotation(ctx, dir, 1234);
    const beats = readdirSync(dir).filter((name) => name.startsWith('rotate-watcher.'));
    expect(beats).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, beats[0]), 'utf8'))).toEqual({ at: 1234 });
  });

  it('unlocks a code guard locked by wrong guesses', () => {
    const dir = temp('pangular-guard-');
    const ctx = serverContext(dir, {});
    const warn = vi.fn();
    // Lock it the way the exchange does, through the registered handler.
    const handlers: { name: string; handler: (p: unknown) => unknown }[] = [];
    const ctx2 = {
      ...ctx,
      rpc: {
        ...ctx.rpc,
        register: (definition: { name: string; handler: (p: unknown) => unknown }) =>
          handlers.push(definition),
        getCurrentRpcSession: () => ({ meta: {} }),
      },
    };
    registerCodeGuard(ctx2, { lockAfter: 1, warn });
    handlers[0].handler({ code: 'not-the-code', ua: '', origin: '' });
    expect(codeGuardLocked(ctx2)).toBe(true);
    writeFileSync(
      join(dir, ROTATE_REQUEST_FILE),
      JSON.stringify({ id: REQUEST_ID, at: Date.now() }),
    );
    expect(answerRotateRequest(ctx2, dir)?.id).toBe(REQUEST_ID);
    expect(codeGuardLocked(ctx2)).toBe(false);
  });

  it('keeps every token and logs instead of throwing when the answer cannot be written', () => {
    const dir = temp('pangular-fail-');
    const meta: Record<string, unknown> = { id: 'a', isTrusted: true, clientAuthToken: 'tok' };
    const ctx = serverContext(dir, meta);
    const storage = trustToken(ctx, 'tok');
    writeFileSync(
      join(dir, ROTATE_REQUEST_FILE),
      JSON.stringify({ id: REQUEST_ID, at: Date.now() }),
    );
    const lines: string[] = [];
    const failingWrite = () => {
      throw new Error('ENOSPC: no space left on device');
    };
    const poll = () =>
      pollTokenRotation(
        ctx,
        dir,
        (line) => lines.push(line),
        (c, d) => answerRotateRequest(c, d, Date.now(), failingWrite),
      );
    expect(poll).not.toThrow();
    expect(lines.join('')).toContain('failed, so every trusted token is kept: ENOSPC');
    expect(verifyAuthToken('tok', { meta: {} } as never, storage)).toBe(true);
    expect(meta['isTrusted']).toBe(true);
    // The server tries a request once, so the failure is not retried every second.
    lines.length = 0;
    poll();
    expect(lines).toEqual([]);
    expect(readdirSync(dir).filter((name) => name.startsWith('rotate-answer.'))).toEqual([]);
  });

  it('ignores a stale or broken request', () => {
    const dir = temp('pangular-stale-');
    const ctx = serverContext(dir, {});
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), JSON.stringify({ id: REQUEST_ID, at: 0 }));
    expect(answerRotateRequest(ctx, dir)).toBeNull();
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), JSON.stringify({ id: '../x', at: Date.now() }));
    expect(answerRotateRequest(ctx, dir)).toBeNull();
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), '{not json');
    expect(answerRotateRequest(ctx, dir)).toBeNull();
  });

  it('runs as a CLI command', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    seedFile(privateAuthStoreDir(root, home), { a: { timestamp: Date.now() } });
    const lines: string[] = [];
    const cli = cac('pangular');
    registerTokenCommand(cli, {
      cwd: () => root,
      log: (line) => lines.push(line),
      home,
      waitMs: 20,
    });
    cli.parse(['node', 'pangular', 'token'], { run: false });
    await cli.runMatchedCommand();
    expect(lines.at(-1)).toContain('1 trusted token(s)');
    cli.parse(['node', 'pangular', 'token', '--rotate'], { run: false });
    await cli.runMatchedCommand();
    expect(lines.at(-1)).toContain('Dropped 1 trusted token(s)');
  });
});
