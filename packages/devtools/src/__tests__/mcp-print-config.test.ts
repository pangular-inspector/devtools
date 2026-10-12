import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangularCli } from '../cli.ts';
import { isLoopbackHost, mcpEndpoint, mcpPrintConfig, shellQuote } from '../mcp-print-config.ts';
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
      "claude mcp add --transport http --scope project pangular-live http://localhost:9999/__mcp --header 'Origin: http://localhost:9999'\n",
    );
    expect(block(http, 'Cursor')).toEqual({
      mcpServers: {
        'pangular-live': {
          url: 'http://localhost:9999/__mcp',
          headers: { Origin: 'http://localhost:9999' },
        },
      },
    });
    expect(http).not.toContain('Authorization');
    expect(text).not.toContain('Warning');
  });

  it('names the HTTP server apart from the stdio one, so Claude Code loads both', () => {
    const { stdio, http } = sections(mcpPrintConfig({ root: '/work/app', env: {} }));
    expect(stdio).toContain('claude mcp add pangular -- ');
    expect(http).toContain('claude mcp add --transport http --scope project pangular-live ');
    expect(Object.keys(block(http, 'VS Code')['servers'] as object)).toEqual(['pangular-live']);
    expect(Object.keys(block(stdio, 'VS Code')['servers'] as object)).toEqual(['pangular']);
  });

  it('prints no clear-text warning for a hub on a loopback host', () => {
    for (const host of ['localhost', '127.0.0.1', '::1', '0.0.0.0']) {
      const text = mcpPrintConfig({ root: '/work/app', host, port: 4000, base: '/__devframes/' });
      expect(text).toContain('Authorization');
      expect(text).not.toContain('Warning');
    }
  });

  it('warns that the token travels in clear text for a hub on a LAN address over http', () => {
    const text = mcpPrintConfig({
      root: '/work/app',
      host: '192.168.1.20',
      port: 4000,
      base: '/__devframes/',
      env: {},
    });
    const { http } = sections(text);
    expect(http).toContain(
      'Warning: http://192.168.1.20:4000 is not a loopback address and the URL is http, so the MCP token travels in clear text on the network.',
    );
    expect(http.indexOf('Warning')).toBeLessThan(http.indexOf('claude mcp add'));
    // The standalone CLI asks for no token, so there is nothing to leak.
    expect(mcpPrintConfig({ root: '/work/app', host: '192.168.1.20', env: {} })).not.toContain(
      'Warning',
    );
  });

  it('prints an https endpoint with --https, and no warning', () => {
    const text = mcpPrintConfig({
      root: '/work/app',
      host: 'dev.example.test',
      port: 8443,
      base: '/__devframes/',
      https: true,
      env: {},
    });
    const { http } = sections(text);
    expect(http).toContain(
      '== HTTP: live pages, at https://dev.example.test:8443/__devframes/__mcp ==',
    );
    expect(http).toContain("--header 'Origin: https://dev.example.test:8443'");
    expect(block(http, 'Cursor')).toEqual({
      mcpServers: {
        'pangular-live': {
          url: 'https://dev.example.test:8443/__devframes/__mcp',
          headers: {
            Authorization: 'Bearer ${env:PANGULAR_MCP_TOKEN}',
            Origin: 'https://dev.example.test:8443',
          },
        },
      },
    });
    expect(text).not.toContain('Warning');
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
        'pangular-live': {
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
      servers: { 'pangular-live': { headers: Record<string, string> } };
    };
    expect(vscode.inputs).toEqual([
      expect.objectContaining({ id: 'pangular-token', password: true }),
    ]);
    expect(vscode.servers['pangular-live'].headers['Authorization']).toBe(
      'Bearer ${input:pangular-token}',
    );
    expect(text).toContain(`export PANGULAR_MCP_TOKEN="$(cat '${tokenFile}')"`);
  });
});

describe('isLoopbackHost', () => {
  it('knows the names and addresses of this machine', () => {
    for (const host of ['localhost', 'app.localhost', '127.0.0.1', '127.1.2.3', '[::1]', '::1']) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ['192.168.1.20', 'dev.example.test', '[fe80::1]', '10.0.0.2']) {
      expect(isLoopbackHost(host)).toBe(false);
    }
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
    expect(text).not.toContain('Warning');
  });

  it('takes --https for a server behind TLS', async () => {
    const lines: string[] = [];
    await createPangularCli({ env: {}, log: (line) => lines.push(line) }).parse([
      'node',
      'pangular',
      'mcp',
      '--print-config',
      '--root',
      fixtureDir('pangular-print-config-https-'),
      '--host',
      '192.168.1.20',
      '--port',
      '4000',
      '--base',
      '/__devframes/',
      '--https',
    ]);
    const text = lines.join('\n');
    expect(text).toContain(
      '== HTTP: live pages, at https://192.168.1.20:4000/__devframes/__mcp ==',
    );
    expect(text).not.toContain('Warning');
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
