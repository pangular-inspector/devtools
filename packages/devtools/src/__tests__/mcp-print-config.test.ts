import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangularCli } from '../cli.ts';
import { mcpEndpoint, mcpPrintConfig, shellQuote } from '../mcp-print-config.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';

const SECRET = 'do-not-print-this-token-0123456789';

/** The JSON block printed after `heading`. */
function block(text: string, heading: string): Record<string, unknown> {
  const start = text.indexOf('{', text.indexOf(heading));
  const end = text.indexOf('\n}\n', start);
  return JSON.parse(text.slice(start, end + 2)) as Record<string, unknown>;
}

function sections(text: string) {
  const http = text.indexOf('== HTTP');
  return { stdio: text.slice(0, http), http: text.slice(http) };
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('mcpEndpoint', () => {
  it('points at the standalone CLI by default, which asks for no token', () => {
    expect(mcpEndpoint({})).toEqual({
      url: 'http://localhost:9999/__mcp',
      origin: 'http://localhost:9999',
      token: false,
    });
  });

  it('points at a hub base with the bearer token', () => {
    expect(mcpEndpoint({ port: 4000, base: '__devframes' })).toEqual({
      url: 'http://localhost:4000/__devframes/__mcp',
      origin: 'http://localhost:4000',
      token: true,
    });
    expect(mcpEndpoint({ base: '/' }).token).toBe(false);
  });

  it('turns a wildcard bind host into one a client can reach', () => {
    expect(mcpEndpoint({ host: '0.0.0.0' }).origin).toBe('http://localhost:9999');
    expect(mcpEndpoint({ host: '::1', port: 5173 }).origin).toBe('http://[::1]:5173');
    expect(mcpEndpoint({ host: '192.168.1.20' }).origin).toBe('http://192.168.1.20:9999');
  });
});

describe('mcpPrintConfig', () => {
  it('prints stdio config for the project folder and HTTP config for the CLI server', () => {
    const text = mcpPrintConfig({ root: '/work/my app', readOnly: true, env: {} });
    const { stdio, http } = sections(text);
    expect(stdio).toContain(
      "claude mcp add pangular -- npx @pangular-inspector/devtools mcp --root '/work/my app' --read-only",
    );
    const args = ['@pangular-inspector/devtools', 'mcp', '--root', '/work/my app', '--read-only'];
    expect(block(stdio, 'Cursor')).toEqual({
      mcpServers: { pangular: { command: 'npx', args } },
    });
    expect(block(stdio, 'VS Code')).toEqual({
      servers: { pangular: { type: 'stdio', command: 'npx', args } },
    });

    expect(http).toContain(
      "claude mcp add --transport http --scope project pangular http://localhost:9999/__mcp --header 'Origin: http://localhost:9999'\n",
    );
    expect(block(http, 'Cursor')).toEqual({
      mcpServers: {
        pangular: {
          url: 'http://localhost:9999/__mcp',
          headers: { Origin: 'http://localhost:9999' },
        },
      },
    });
    expect(http).not.toContain('Authorization');
  });

  it('adds the token header for a hub and names the token file, never the token', () => {
    const tokenFile = '/home/me/.tokens/pangular token';
    const text = mcpPrintConfig({
      root: '/work/app',
      port: 4000,
      base: '/__devframes/',
      env: { PANGULAR_MCP_TOKEN: SECRET, PANGULAR_MCP_TOKEN_FILE: tokenFile },
    });
    const { http } = sections(text);
    expect(text).not.toContain(SECRET);
    expect(http).toContain(
      "--header 'Origin: http://localhost:4000' --header 'Authorization: Bearer ${PANGULAR_MCP_TOKEN}'",
    );
    expect(block(http, 'Cursor')).toEqual({
      mcpServers: {
        pangular: {
          url: 'http://localhost:4000/__devframes/__mcp',
          headers: {
            Authorization: 'Bearer ${env:PANGULAR_MCP_TOKEN}',
            Origin: 'http://localhost:4000',
          },
        },
      },
    });
    const vscode = block(http, 'VS Code') as {
      inputs: { id: string; password: boolean }[];
      servers: { pangular: { headers: Record<string, string> } };
    };
    expect(vscode.inputs).toEqual([
      expect.objectContaining({ id: 'pangular-token', password: true }),
    ]);
    expect(vscode.servers.pangular.headers['Authorization']).toBe('Bearer ${input:pangular-token}');
    expect(text).toContain(`export PANGULAR_MCP_TOKEN="$(cat '${tokenFile}')"`);
  });
});

describe('shellQuote', () => {
  it('leaves plain paths alone and quotes the rest', () => {
    expect(shellQuote('/a/b-c_d.json')).toBe('/a/b-c_d.json');
    expect(shellQuote("it's here")).toBe(`'it'\\''s here'`);
    expect(shellQuote('Bearer ${X}')).toBe(`'Bearer \${X}'`);
  });
});

describe('pangular mcp --print-config', () => {
  it('prints the config with the CLI flags and starts no server', async () => {
    const root = fixtureDir('pangular-print-config-');
    const lines: string[] = [];
    const cwd = process.cwd();
    await createPangularCli({
      env: { PANGULAR_MCP_TOKEN: SECRET },
      log: (line) => lines.push(line),
    }).parse([
      'node',
      'pangular',
      'mcp',
      '--print-config',
      '--root',
      root,
      '--config',
      join(root, 'pangular.config.json'),
      '--host',
      '127.0.0.1',
      '--port',
      '5173',
      '--base',
      '/__devframes/',
    ]);
    expect(process.exitCode).toBeUndefined();
    expect(process.cwd()).toBe(cwd);
    const text = lines.join('\n');
    expect(text).not.toContain(SECRET);
    expect(text).toContain(`--root ${root} --config ${join(root, 'pangular.config.json')}`);
    expect(text).toContain('== HTTP: live pages, at http://127.0.0.1:5173/__devframes/__mcp ==');
    expect(text).toContain("--header 'Authorization: Bearer ${PANGULAR_MCP_TOKEN}'");
  });

  it('fails on a project folder that does not exist', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await createPangularCli({ env: {}, log: () => {} }).parse([
      'node',
      'pangular',
      'mcp',
      '--print-config',
      '--root',
      '/no/such/folder',
    ]);
    expect(process.exitCode).toBe(1);
    expect(String(error.mock.calls[0]?.[0])).toContain('does not exist');
  });
});
