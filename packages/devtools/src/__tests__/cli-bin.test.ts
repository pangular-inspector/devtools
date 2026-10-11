import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCliConfig, looksLikeAngularProject, resolveCliRoot } from '../cli.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';
import pkg from '../../package.json' with { type: 'json' };

const BIN = fileURLToPath(new URL('../../bin.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(
  args: string[],
  options: { cwd?: string; input?: string[]; until?: (out: string) => boolean } = {},
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: options.cwd ?? REPO,
      env: { ...process.env, PANGULAR_ROOT: '', PANGULAR_CONFIG: '' },
    });
    let stdout = '';
    let stderr = '';
    const done = () => resolve({ code: child.exitCode, stdout, stderr });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (options.until?.(stdout)) child.kill();
    });
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', done);
    for (const line of options.input ?? []) child.stdin.write(`${line}\n`);
    if (!options.until) child.stdin.end();
  });
}

function mcpRequests(): string[] {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'pangular_build-meta', arguments: {} },
    },
  ].map((message) => JSON.stringify(message));
}

async function mcp(args: string[], cwd: string) {
  const result = await run(['mcp', ...args], {
    cwd,
    input: mcpRequests(),
    until: (out) => out.includes('"id":3'),
  });
  const replies = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { id?: number; result?: Record<string, unknown> });
  const tools = (replies.find((reply) => reply.id === 2)?.result?.['tools'] ?? []) as {
    name: string;
  }[];
  const meta = replies.find((reply) => reply.id === 3)?.result?.['structuredContent'] as
    { projectName?: string } | undefined;
  return { ...result, tools: tools.map((tool) => tool.name.replace(/^pangular_/, '')), meta };
}

describe('pangular binary', () => {
  it('prints the package version', async () => {
    const { stdout, code } = await run(['--version']);
    expect(code).toBe(0);
    expect(stdout).toContain(`pangular/${pkg.version}`);
    expect((await run(['--help'])).stdout).toMatch(/\n\s+dev\s+Start a local dev server/);
  });

  it('prints the panel and MCP URLs when the dev server starts', async () => {
    const { stdout } = await run(['dev', '--no-open', '--port', '0'], {
      until: (out) => out.includes('MCP:'),
    });
    expect(stdout).toContain(`pangular v${pkg.version}`);
    expect(stdout).toMatch(/Panel: http:\/\/localhost:\d+\//);
    expect(stdout).toMatch(/Angular Native apps: http:\/\/localhost:\d+\/\?view=angular-native/);
    expect(stdout).toMatch(/MCP: {3}http:\/\/localhost:\d+\/__mcp/);
  });

  it('reports an unknown flag or command in one line and exits 1', async () => {
    for (const args of [['--outDir', 'x'], ['biuld']]) {
      const { code, stderr, stdout } = await run(args);
      expect(code).toBe(1);
      expect(stdout).toBe('');
      expect(stderr.trim().split('\n')).toHaveLength(1);
      expect(stderr).toMatch(/^\[pangular\] Unknown (option `--outDir`|command "biuld")/);
    }
  });

  it('scans the --root folder over stdio and drops the tools that need a page', async () => {
    const elsewhere = fixtureDir('pangular-cwd-');
    const { tools, meta, stderr } = await mcp(['--root', REPO], elsewhere);
    expect(meta?.projectName).toBe('pangular-inspector');
    expect(stderr).not.toContain('source scans find nothing');
    expect(tools).toContain('get-components');
    expect(tools).toContain('lint-pipes');
    for (const pageTool of [
      'highlight',
      'inspect-component',
      'defer-blocks',
      'change-detection',
      'navigate',
      'form-action',
      'fill-form',
      'list-routes',
    ]) {
      expect(tools).not.toContain(pageTool);
    }
  }, 30_000);

  it('reads a config file, and warns when the folder is not an Angular project', async () => {
    const elsewhere = fixtureDir('pangular-cwd-');
    writeFileSync(
      join(elsewhere, 'devtools.json'),
      JSON.stringify({ inspectors: { analog: false, pipes: false } }),
    );
    const { tools, meta, stderr } = await mcp(['--config', 'devtools.json'], elsewhere);
    expect(meta?.projectName).toBe('unknown');
    expect(stderr).toContain('source scans find nothing');
    expect(tools.some((tool) => tool.startsWith('analog-'))).toBe(false);
    expect(tools).not.toContain('get-pipes');
    expect(tools).toContain('get-components');
  }, 30_000);
});

describe('CLI root and config', () => {
  it('resolves --root before PANGULAR_ROOT and refuses a missing folder', () => {
    const cwd = fixtureDir('pangular-root-');
    mkdirSync(join(cwd, 'app'));
    expect(resolveCliRoot({}, {}, cwd)).toBe(cwd);
    expect(resolveCliRoot({}, { PANGULAR_ROOT: 'app' }, cwd)).toBe(join(cwd, 'app'));
    expect(resolveCliRoot({ root: '.' }, { PANGULAR_ROOT: 'app' }, cwd)).toBe(cwd);
    expect(() => resolveCliRoot({ root: 'missing' }, {}, cwd)).toThrow(/does not exist/);
  });

  it('detects an Angular project by angular.json or an @angular/core dependency', () => {
    const dir = fixtureDir('pangular-root-');
    expect(looksLikeAngularProject(dir)).toBe(false);
    writeFileSync(join(dir, 'package.json'), '{"dependencies":{"@angular/core":"^22.0.0"}}');
    expect(looksLikeAngularProject(dir)).toBe(true);
    expect(looksLikeAngularProject(REPO)).toBe(true);
  });

  it('reads --config, PANGULAR_CONFIG or the default file, and applies --read-only', () => {
    const root = fixtureDir('pangular-config-');
    expect(loadCliConfig({}, root, {}, root)).toEqual({});
    expect(loadCliConfig({ readOnly: true }, root, {}, root)).toEqual({
      agent: { readOnly: true },
    });
    writeFileSync(join(root, 'pangular.config.json'), '{"inspectors":{"pipes":false}}');
    writeFileSync(join(root, 'other.json'), '{"agent":{"tools":{"router":false}}}');
    expect(loadCliConfig({}, root, {}, root)).toEqual({ inspectors: { pipes: false } });
    expect(loadCliConfig({}, root, { PANGULAR_CONFIG: 'other.json' }, root)).toEqual({
      agent: { tools: { router: false } },
    });
    expect(loadCliConfig({ config: 'other.json', readOnly: true }, root, {}, root)).toEqual({
      agent: { tools: { router: false }, readOnly: true },
    });
    expect(() => loadCliConfig({ config: 'missing.json' }, root, {}, root)).toThrow(
      /Can't read the config file/,
    );
    writeFileSync(join(root, 'bad.json'), '{inspectors:');
    expect(() => loadCliConfig({ config: 'bad.json' }, root, {}, root)).toThrow(/not valid JSON/);
  });
});
