import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cac from 'cac';
import { getTempAuthCode, verifyAuthToken } from 'devframe/node/auth';
import { getInternalContext } from 'devframe/node/hub-internals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ROTATE_ANSWER_FILE,
  ROTATE_REQUEST_FILE,
  answerRotateRequest,
  clearTokenFile,
  rotateText,
  rotateTokens,
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

describe('pangular token --rotate', () => {
  it('drops the file tokens and says so when no server answers', async () => {
    const home = temp('pangular-home-');
    const root = temp('pangular-root-');
    const dir = privateAuthStoreDir(root, home);
    seedFile(dir, { a: { timestamp: Date.now() } });
    const result = await rotateTokens(root, { home, waitMs: 50, pollMs: 10 });
    expect(result).toEqual({ server: false, dropped: 1 });
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
    const storage = getInternalContext(ctx as never).storage.auth;
    storage.mutate((state) => {
      state.trusted['tok'] = { authToken: 'tok', ua: '', origin: '', timestamp: Date.now() };
    });
    const before = getTempAuthCode();
    // The server looks for requests while the command waits.
    const timer = setInterval(() => answerRotateRequest(ctx, dir), 10);
    try {
      const result = await rotateTokens(root, { home, waitMs: 2000, pollMs: 10 });
      expect(result.server).toBe(true);
      if (!result.server) return;
      expect(result.dropped).toBe(1);
      expect(result.code).toMatch(/^\d+$/);
      expect(result.code).toBe(getTempAuthCode());
      expect(result.code).not.toBe(before);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(rotateText(result, Date.now())).toContain(`New one-time code: ${result.code}`);
    } finally {
      clearInterval(timer);
    }
    expect(verifyAuthToken('tok', { meta: {} } as never, storage)).toBe(false);
    expect(meta['isTrusted']).toBe(false);
    // The answer, which holds the code, is deleted once read.
    expect(existsSync(join(dir, ROTATE_ANSWER_FILE))).toBe(false);
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
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), JSON.stringify({ id: 'r1', at: Date.now() }));
    expect(answerRotateRequest(ctx2, dir)?.id).toBe('r1');
    expect(codeGuardLocked(ctx2)).toBe(false);
  });

  it('ignores a stale or broken request', () => {
    const dir = temp('pangular-stale-');
    const ctx = serverContext(dir, {});
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), JSON.stringify({ id: 'old', at: 0 }));
    expect(answerRotateRequest(ctx, dir)).toBeNull();
    expect(existsSync(join(dir, ROTATE_REQUEST_FILE))).toBe(false);
    writeFileSync(join(dir, ROTATE_REQUEST_FILE), '{not json');
    expect(answerRotateRequest(ctx, dir)).toBeNull();
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
