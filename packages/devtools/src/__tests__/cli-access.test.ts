import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cliHostOptions } from '../cli.ts';
import {
  accessLines,
  cliAccess,
  listensOnNetwork,
  networkAddresses,
  setupSnippetLines,
} from '../cli-access.ts';

const TOKEN = 'pairing-token-0123456789abcdef';

const devServer = vi.hoisted(() => ({ options: [] as Record<string, unknown>[] }));
const hosts = vi.hoisted(() => [] as { authTokens?: string[] }[]);

vi.mock('../devframe.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../devframe.ts')>();
  return {
    ...real,
    createPangular: (config: unknown, host: { authTokens?: string[] } = {}) => {
      hosts.push(host);
      return real.createPangular(config as never, host as never);
    },
  };
});

vi.mock('devframe/adapters/dev', async (importOriginal) => {
  const real = await importOriginal<typeof import('devframe/adapters/dev')>();
  return {
    ...real,
    createDevServer: vi.fn(async (_def: unknown, options: Record<string, unknown>) => {
      devServer.options.push(options);
      return {};
    }),
  };
});

describe('cliAccess', () => {
  it('joins the origins of the config file and the flags, as browsers send them', () => {
    const warn = vi.fn();
    const access = cliAccess(
      { allowedOrigin: ['http://192.168.1.20:8100/', 'not an origin'] },
      ['http://192.168.1.20:4200'],
      {},
      warn,
    );
    expect(access.allowedOrigins).toEqual(['http://192.168.1.20:4200', 'http://192.168.1.20:8100']);
    expect(warn).toHaveBeenCalled();
  });

  it('takes pairing tokens from the flags and PANGULAR_AUTH_TOKEN', () => {
    const access = cliAccess({ authToken: TOKEN }, undefined, {
      PANGULAR_AUTH_TOKEN: `${TOKEN}-env`,
    });
    expect(access.authTokens).toEqual([TOKEN, `${TOKEN}-env`]);
  });

  it('prints the origins and never a whole token', () => {
    const text = accessLines({
      allowedOrigins: ['http://192.168.1.20:8100'],
      authTokens: [TOKEN],
    }).join('\n');
    expect(text).toContain('Allowed origins: http://192.168.1.20:8100');
    expect(text).toMatch(/Pairing tokens: #[0-9a-f]{6}/);
    expect(text).not.toContain(TOKEN);
    expect(accessLines({ allowedOrigins: [], authTokens: [] })).toEqual([]);
  });
});

describe('the setup snippet', () => {
  const interfaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    en0: [
      { address: '192.168.1.20', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
  } as never;

  it('finds the network addresses only when the server listens beyond loopback', () => {
    expect(listensOnNetwork('localhost')).toBe(false);
    expect(listensOnNetwork('127.0.0.1')).toBe(false);
    expect(listensOnNetwork('0.0.0.0')).toBe(true);
    expect(listensOnNetwork('192.168.1.20')).toBe(true);
    expect(networkAddresses('0.0.0.0', interfaces)).toEqual(['192.168.1.20']);
    expect(networkAddresses('192.168.1.20', interfaces)).toEqual(['192.168.1.20']);
    expect(networkAddresses('localhost', interfaces)).toEqual([]);
  });

  it('prints an initOverlay call with the whole connection info and a token placeholder', () => {
    const meta = { backend: 'websocket', websocket: { path: '__ws' }, configs: { pangular: {} } };
    const text = setupSnippetLines(['192.168.1.20'], 9999, meta, true).join('\n');
    expect(text).toContain('On your network: http://192.168.1.20:9999/');
    expect(text).toContain("baseURL: 'http://192.168.1.20:9999/'");
    expect(text).toContain(`connectionMeta: ${JSON.stringify(meta)}`);
    expect(text).toContain("// authToken: '<one of the pairing tokens>'");
    expect(text).not.toMatch(/authToken: .*undefined/);
    expect(setupSnippetLines([], 9999, meta, false)).toEqual([]);
  });

  it('prints code that runs as pasted: no top-level await, and the overlay only in dev mode', async () => {
    const meta = { backend: 'websocket', websocket: { path: '__ws' } };
    const lines = setupSnippetLines(['192.168.1.20'], 9999, meta, true);
    const start = lines.findIndex((line) => line.includes('bootstrapApplication('));
    const code = lines
      .slice(start)
      .map((line) => line.slice(4))
      .join('\n');
    expect(code.split('\n')[0]).toBe('bootstrapApplication(App, appConfig)');
    expect(code).toContain("if (typeof ngDevMode === 'undefined' || ngDevMode) {");
    // A plain function body rejects a top-level await, so this also checks there is none.
    const run = new Function('bootstrapApplication', 'App', 'appConfig', 'ngDevMode', code);
    const bootstrap = vi.fn(() => Promise.resolve());
    run(bootstrap, {}, {}, false);
    await Promise.resolve();
    expect(bootstrap).toHaveBeenCalledOnce();
  });
});

describe('pangular dev', () => {
  const dirs: string[] = [];
  afterEach(() => {
    devServer.options.length = 0;
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('passes the allowed origins to the dev server and keeps them out of the published config', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pangular-cli-'));
    dirs.push(root);
    writeFileSync(join(root, 'angular.json'), '{}');
    writeFileSync(
      join(root, 'pangular.config.json'),
      JSON.stringify({ allowedOrigins: ['http://192.168.1.20:4200'] }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cwd = process.cwd();
    const { createPangularCli } = await import('../cli.ts');
    try {
      await createPangularCli({ log: () => {}, env: {} }).parse([
        'node',
        'pangular',
        'dev',
        '--root',
        root,
        '--port',
        '9990',
        '--no-open',
        '--allowed-origin',
        'http://192.168.1.20:8100',
      ]);
    } finally {
      process.chdir(cwd);
    }
    const warnings = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();

    expect(devServer.options[0]).toMatchObject({
      port: 9990,
      allowedOrigins: ['http://192.168.1.20:4200', 'http://192.168.1.20:8100'],
    });
    expect(warnings.some((message) => message.includes('Unknown option'))).toBe(false);
    expect(warnings.some((message) => message.includes('allowedOrigins'))).toBe(false);
  });

  it('prints the startup lines first, then the snippet, with a time limit on its fetch', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pangular-cli-'));
    dirs.push(root);
    writeFileSync(join(root, 'angular.json'), '{}');
    const log = vi.fn();
    const cwd = process.cwd();
    const { createPangularCli } = await import('../cli.ts');
    try {
      await createPangularCli({ log, env: {} }).parse([
        'node',
        'pangular',
        'dev',
        '--root',
        root,
        '--host',
        '192.168.1.20',
        '--port',
        '9990',
        '--no-open',
      ]);
    } finally {
      process.chdir(cwd);
    }
    const onReady = devServer.options[0]['onReady'] as (info: {
      origin: string;
      port: number;
    }) => Promise<void>;
    let signal: unknown;
    let printedBefore = -1;
    const fetchStub = vi.fn(async (_url: string, init?: { signal?: unknown }) => {
      signal = init?.signal;
      printedBefore = log.mock.calls.length;
      return {
        ok: true,
        json: async () => ({ backend: 'websocket', websocket: { path: '__ws' } }),
      };
    });
    vi.stubGlobal('fetch', fetchStub);
    try {
      await onReady({ origin: 'http://192.168.1.20:9990', port: 9990 });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchStub).toHaveBeenCalledWith('http://192.168.1.20:9990/__connection.json', {
      signal: expect.any(AbortSignal),
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(printedBefore).toBe(1);
    expect(String(log.mock.calls[0][0])).toContain('http://192.168.1.20:9990');
    expect(String(log.mock.calls[1][0])).toContain('bootstrapApplication(App, appConfig)');
  });

  it("keeps devframe's default origin check without --allowed-origin", async () => {
    const root = mkdtempSync(join(tmpdir(), 'pangular-cli-'));
    dirs.push(root);
    writeFileSync(join(root, 'angular.json'), '{}');
    const cwd = process.cwd();
    const { createPangularCli } = await import('../cli.ts');
    try {
      await createPangularCli({ log: () => {}, env: {} }).parse([
        'node',
        'pangular',
        'dev',
        '--root',
        root,
        '--port',
        '9991',
        '--no-open',
      ]);
    } finally {
      process.chdir(cwd);
    }
    expect(devServer.options[0]).not.toHaveProperty('allowedOrigins');
  });
});

describe('pairing tokens on the CLI', () => {
  const access = { allowedOrigins: [], authTokens: [TOKEN] };

  it('reach the dev server only, not the MCP server or a static build', () => {
    expect(cliHostOptions('dev', access)).toEqual({ pageTools: true, authTokens: [TOKEN] });
    expect(cliHostOptions('mcp', access)).toEqual({ pageTools: false, authTokens: [] });
    expect(cliHostOptions('build', access)).toEqual({ pageTools: true, authTokens: [] });
  });

  async function dev(args: string[], env: Record<string, string> = {}) {
    const root = mkdtempSync(join(tmpdir(), 'pangular-cli-'));
    writeFileSync(join(root, 'angular.json'), '{}');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cwd = process.cwd();
    hosts.length = 0;
    const { createPangularCli } = await import('../cli.ts');
    try {
      await createPangularCli({ log: () => {}, env }).parse([
        'node',
        'pangular',
        'dev',
        '--root',
        root,
        '--port',
        '9992',
        '--no-open',
        ...args,
      ]);
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
    const warnings = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    devServer.options.length = 0;
    return { host: hosts.at(-1), warnings };
  }

  it('passes --auth-token to the dev server', async () => {
    const { host } = await dev(['--auth-token', TOKEN]);
    expect(host?.authTokens).toEqual([TOKEN]);
  });

  it('ignores the tokens with --no-auth, which trusts every client already, and says so', async () => {
    const { host, warnings } = await dev(['--no-auth'], { PANGULAR_AUTH_TOKEN: TOKEN });
    expect(host?.authTokens).toEqual([]);
    expect(warnings.some((message) => message.includes('--no-auth already trusts'))).toBe(true);
  });
});
