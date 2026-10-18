import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDevframe } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStoreDir } from '../auth-store.ts';
import { cliMcpSetting } from '../cli.ts';

const BIN = fileURLToPath(new URL('../../bin.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const MCP_TOKEN = 'cli-mcp-token-0123456789abcdef';

describe('cliMcpSetting', () => {
  it('asks for the MCP token while the one-time code is on', () => {
    expect(cliMcpSetting(undefined, true, () => MCP_TOKEN)).toEqual({ authorization: MCP_TOKEN });
    expect(cliMcpSetting(true, true, () => MCP_TOKEN)).toEqual({ authorization: MCP_TOKEN });
  });

  it('leaves the token out with --no-auth, and the route with --no-mcp', () => {
    const token = vi.fn(() => MCP_TOKEN);
    expect(cliMcpSetting(undefined, false, token)).toBe(true);
    expect(cliMcpSetting(false, true, token)).toBe(false);
    expect(token).not.toHaveBeenCalled();
  });
});

describe('pangular dev access', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    vi.unstubAllGlobals();
  });

  async function start(): Promise<{
    child: ChildProcess;
    port: number;
    home: string;
    out: () => string;
  }> {
    const home = mkdtempSync(join(tmpdir(), 'pangular-cli-home-'));
    const child = spawn(process.execPath, [BIN, 'dev', '--no-open', '--port', '0'], {
      cwd: REPO,
      env: {
        ...process.env,
        HOME: home,
        PANGULAR_ROOT: '',
        PANGULAR_CONFIG: '',
        PANGULAR_MCP_TOKEN: MCP_TOKEN,
      },
    });
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));
    cleanups.push(() => child.kill());
    let stdout = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no MCP line in ${stdout}`)), 20_000);
      child.stdout?.on('data', () => {
        const match = /MCP: +http:\/\/localhost:(\d+)\/__mcp/.exec(stdout);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
    });
    return { child, port, home, out: () => stdout };
  }

  function mcp(port: number, authorization?: string) {
    return fetch(`http://localhost:${port}/__mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        origin: `http://localhost:${port}`,
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    });
  }

  it('needs the MCP token on /__mcp, and keeps code tokens in a private per-project store', async () => {
    const { port, home, out } = await start();
    expect((await mcp(port)).status).toBe(401);
    expect((await mcp(port, 'Bearer wrong-token-0123456789')).status).toBe(401);
    expect((await mcp(port, `Bearer ${MCP_TOKEN}`)).status).toBe(200);

    vi.stubGlobal('location', new URL(`http://localhost:${port}/`));
    const rpc = await connectDevframe({
      baseURL: `http://localhost:${port}/`,
      simpleAuth: false,
      otpParam: false,
      webmcp: false,
    });
    cleanups.push(() => void rpc.close?.());
    const before = out().length;
    await rpc.requestAuthCode();
    const code = await vi.waitFor(
      () => {
        const match = /\b(\d{6})\b/.exec(out().slice(before));
        if (!match) throw new Error('no code yet');
        return match[1];
      },
      { timeout: 5000 },
    );
    expect(await rpc.requestTrustWithCode(code)).toBeTruthy();
    const dir = authStoreDir(REPO, home);
    await vi.waitFor(() => expect(statSync(join(dir, 'auth.json')).mode & 0o777).toBe(0o600), {
      timeout: 3000,
    });
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(
      Object.keys(JSON.parse(readFileSync(join(dir, 'auth.json'), 'utf8')).trusted),
    ).toHaveLength(1);
  }, 40_000);
});
