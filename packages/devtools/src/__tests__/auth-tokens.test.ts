import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectDevframe } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authTokensFrom, authTokensFromEnv, isAuthTokens, maskToken } from '../auth-tokens.ts';
import { initPangularHub } from '../hub.ts';

const TOKEN = 'pairing-token-0123456789abcdef';

describe('pairing token helpers', () => {
  it('keeps tokens of 16 characters or more and warns about the others without printing them', () => {
    const warn = vi.fn();
    expect(authTokensFrom([TOKEN, 'tiny-secret', ` ${TOKEN} `, 7], warn)).toEqual([TOKEN]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain('tiny-secret');
  });

  it('reads comma-separated tokens from PANGULAR_AUTH_TOKEN', () => {
    expect(authTokensFromEnv({ PANGULAR_AUTH_TOKEN: `${TOKEN},${TOKEN}-2` })).toEqual([
      TOKEN,
      `${TOKEN}-2`,
    ]);
    expect(authTokensFromEnv({})).toEqual([]);
  });

  it('shows only the start of a token', () => {
    expect(maskToken(TOKEN)).toBe('pair…');
  });

  it('tells a token option from an auth handler', () => {
    expect(isAuthTokens({ tokens: [TOKEN] })).toBe(true);
    expect(isAuthTokens({ tokens: [], rpcFunctions: [] })).toBe(false);
    expect(isAuthTokens(true)).toBe(false);
  });
});

describe('initPangularHub with pairing tokens', () => {
  const cleanups: (() => Promise<void> | void)[] = [];
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllGlobals();
  });

  async function serve(auth: NonNullable<Parameters<typeof initPangularHub>[0]>['auth']) {
    const storage = mkdtempSync(join(tmpdir(), 'pangular-auth-'));
    vi.stubEnv('XDG_CONFIG_HOME', storage);
    const hub = initPangularHub({ ws: false, auth, mcp: false });
    const server: Server = createServer((req, res) =>
      hub.nodeMiddleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    cleanups.push(() => rmSync(storage, { recursive: true, force: true }));
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    cleanups.push(() => hub.close());
    // The devframe client reads the page's location.
    vi.stubGlobal('location', new URL(`http://127.0.0.1:${port}/`));
    return `http://127.0.0.1:${port}/__devframes/pangular/`;
  }

  async function trusted(baseURL: string, authToken: string) {
    const rpc = await connectDevframe({
      baseURL,
      authToken,
      simpleAuth: false,
      otpParam: false,
      webmcp: false,
    });
    cleanups.push(() => rpc.close?.());
    return rpc.ensureTrusted(3000).catch(() => false);
  }

  it('trusts a client that sends a matching token at once', async () => {
    const baseURL = await serve({ tokens: [TOKEN] });
    expect(await trusted(baseURL, TOKEN)).toBe(true);
  });

  it('leaves a wrong token to the one-time code', async () => {
    const baseURL = await serve({ tokens: [TOKEN] });
    expect(await trusted(baseURL, `${TOKEN}-wrong`)).toBe(false);
  });

  it('trusts no token without the option', async () => {
    const baseURL = await serve(undefined);
    expect(await trusted(baseURL, TOKEN)).toBe(false);
  });
});
