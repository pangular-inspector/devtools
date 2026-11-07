import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { AUTH_TOKEN_TTL_MS, summarizeTrustedTokens } from '../auth-store.ts';
import { CodeGuard, codeGuardLocked, registerCodeGuard } from '../auth-guard.ts';
import { cliHostOptions, cliSecurity } from '../cli.ts';
import { SHARED_RPC } from '../config.ts';
import { createPangular } from '../devframe.ts';
import {
  NOT_TRUSTED,
  securityStatus,
  securityStatusHandler,
  type PangularSecurityHost,
} from '../security-status.ts';

const HOST: PangularSecurityHost = {
  auth: true,
  originCheck: true,
  allowedOrigins: ['http://192.168.1.20:8100'],
  allowedHosts: ['.ngrok-free.app'],
  network: true,
};

const NO_TOKENS = { count: 0, nextExpiresAt: null, lastExpiresAt: null };

describe('security status', () => {
  it('reports auth, access, tokens and the code state, never a secret', () => {
    const status = securityStatus({
      host: HOST,
      tokens: { count: 2, nextExpiresAt: 1000, lastExpiresAt: 5000 },
      pairingTokens: 1,
      codeLocked: false,
      codeExpiresAt: () => 900,
    });
    expect(status).toEqual({
      reported: true,
      auth: true,
      originCheck: true,
      allowedOrigins: ['http://192.168.1.20:8100'],
      customOrigins: false,
      allowedHosts: ['.ngrok-free.app'],
      network: true,
      tokens: { count: 2, nextExpiresAt: 1000, lastExpiresAt: 5000, ttlMs: AUTH_TOKEN_TTL_MS },
      pairingTokens: 1,
      oneTimeCode: { state: 'accepting', expiresAt: 900 },
    });
    // Counts and times only: no field could hold a token or the code.
    expect(JSON.stringify(status)).not.toMatch(/code"\s*:\s*"/);
  });

  it('says the code is off with auth off, and does not read it', () => {
    let read = false;
    const status = securityStatus({
      host: { ...HOST, auth: false },
      tokens: NO_TOKENS,
      pairingTokens: 2,
      codeLocked: false,
      codeExpiresAt: () => {
        read = true;
        return 1;
      },
    });
    expect(status.oneTimeCode).toEqual({ state: 'off' });
    expect(status.pairingTokens).toBe(0);
    expect(read).toBe(false);
  });

  it('says the code is locked after too many wrong codes', () => {
    const status = securityStatus({
      host: HOST,
      tokens: NO_TOKENS,
      pairingTokens: 0,
      codeLocked: true,
      codeExpiresAt: () => 1,
    });
    expect(status.oneTimeCode).toEqual({ state: 'locked' });
  });

  it('marks a host that did not report its settings, and any host as any', () => {
    const unknown = securityStatus({ tokens: null, pairingTokens: 0, codeLocked: false });
    expect(unknown).toMatchObject({
      reported: false,
      auth: true,
      allowedOrigins: [],
      network: false,
    });
    expect(unknown.tokens.count).toBe(0);
    const any = securityStatus({
      host: { ...HOST, allowedHosts: true },
      tokens: null,
      pairingTokens: 0,
      codeLocked: false,
    });
    expect(any.allowedHosts).toBe('any');
  });

  it('masks a secret in a listed origin and lists at most 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `http://10.0.0.${i}:4200`);
    const status = securityStatus({
      host: { ...HOST, allowedOrigins: ['http://dev.local/?access_token=abc123secret', ...many] },
      tokens: null,
      pairingTokens: 0,
      codeLocked: false,
    });
    expect(status.allowedOrigins).toHaveLength(20);
    expect(status.allowedOrigins[0]).not.toContain('abc123secret');
  });
});

describe('trusted token summary', () => {
  it('counts unexpired tokens with their first and last expiry, without the tokens', () => {
    const now = 10 * AUTH_TOKEN_TTL_MS;
    const storage = {
      value: () => ({
        trusted: {
          a: { timestamp: now - 1000 },
          b: { timestamp: now - 5000 },
          old: { timestamp: now - AUTH_TOKEN_TTL_MS - 1 },
          broken: {},
        },
      }),
    };
    const summary = summarizeTrustedTokens(storage, now);
    expect(summary).toEqual({
      count: 2,
      nextExpiresAt: now - 5000 + AUTH_TOKEN_TTL_MS,
      lastExpiresAt: now - 1000 + AUTH_TOKEN_TTL_MS,
    });
    expect(JSON.stringify(summary)).not.toContain('"a"');
  });
});

describe('security-status handler', () => {
  const ctx = (isTrusted: boolean | undefined) => ({
    rpc: { getCurrentRpcSession: () => ({ meta: { isTrusted } }) },
  });

  it('answers a trusted client', () => {
    const status = securityStatusHandler(ctx(true), HOST, 1)();
    expect(status.reported).toBe(true);
    expect(status.pairingTokens).toBe(1);
  });

  it('refuses a client that is not trusted', () => {
    expect(() => securityStatusHandler(ctx(false), HOST, 1)()).toThrow(NOT_TRUSTED);
    expect(() => securityStatusHandler(ctx(undefined), HOST, 1)()).toThrow(NOT_TRUSTED);
  });
});

describe('code guard lock', () => {
  it('tells when the guard locked the exchange', () => {
    const context = {
      mode: 'dev',
      rpc: {
        definitions: new Map(),
        register: () => undefined,
        getCurrentRpcSession: () => undefined,
      },
    };
    expect(codeGuardLocked(context)).toBe(false);
    registerCodeGuard(context, { lockAfter: 2, warn: () => undefined });
    expect(codeGuardLocked(context)).toBe(false);
    // The guard is private to the context; drive one the same way to check the flag it reads.
    const guard = new CodeGuard({ lockAfter: 1, warn: () => undefined });
    guard.failed({});
    expect(guard.locked).toBe(true);
  });
});

describe('host settings', () => {
  it('fills the CLI dev server settings from its flags', () => {
    const access = { allowedOrigins: ['http://192.168.1.20:8100'], authTokens: ['x'.repeat(16)] };
    expect(cliSecurity({}, access)).toEqual({
      auth: true,
      originCheck: true,
      allowedOrigins: ['http://192.168.1.20:8100'],
      network: false,
    });
    expect(
      cliSecurity({ auth: false, host: '0.0.0.0', proxyOrigin: 'http://localhost:4200' }, access),
    ).toEqual({
      auth: false,
      originCheck: true,
      allowedOrigins: ['http://192.168.1.20:8100', 'http://localhost:4200'],
      network: true,
    });
    const security = cliSecurity({}, access);
    expect(cliHostOptions('dev', access, undefined, security).security).toBe(security);
    expect('security' in cliHostOptions('mcp', access, undefined, security)).toBe(false);
  });

  it('registers security-status as a shared RPC for servers with pages', async () => {
    expect(SHARED_RPC).toContain('security-status');
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const boot = async (pageTools: boolean) => {
      const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
      await createPangular({}, { pageTools, security: HOST }).setup(ctx as never);
      return ctx;
    };
    const ctx = await boot(true);
    const definitions = (ctx.rpc as unknown as { definitions: Map<string, unknown> }).definitions;
    expect(definitions.has('pangular:security-status')).toBe(true);
    const invoke = ctx.rpc.invokeLocal.bind(ctx.rpc) as unknown as (
      name: string,
    ) => Promise<{ reported: boolean; allowedHosts: unknown }>;
    const answer = await invoke('pangular:security-status');
    expect(answer.reported).toBe(true);
    expect(answer.allowedHosts).toEqual(['.ngrok-free.app']);
    const mcp = await boot(false);
    const mcpDefinitions = (mcp.rpc as unknown as { definitions: Map<string, unknown> })
      .definitions;
    expect(mcpDefinitions.has('pangular:security-status')).toBe(false);
  });
});
