import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCac } from 'devframe/adapters/cac';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkReportOutDir, createPangularCli, guardReportOutDir, startupLines } from '../cli.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';

function project() {
  const cwd = fixtureDir('pangular-cli-');
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'src/app.ts'), 'x');
  return cwd;
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('pangular build --outDir', () => {
  it('refuses the working directory and its parents, even with --force', () => {
    const cwd = project();
    for (const outDir of ['.', '..', cwd, join(cwd, '..')]) {
      expect(() => checkReportOutDir(outDir, { cwd, force: true })).toThrow(
        /working directory or one of its parents/,
      );
    }
  });

  it('sees through symlinks to the working directory and its parents, even with --force', () => {
    const root = fixtureDir('pangular-cli-link-');
    const cwd = join(root, 'workspace');
    mkdirSync(join(cwd, 'src'), { recursive: true });
    symlinkSync(root, join(root, 'alias'), 'dir');
    for (const outDir of [join(root, 'alias', 'workspace'), join(root, 'alias')]) {
      expect(() => checkReportOutDir(outDir, { cwd, force: true })).toThrow(
        /working directory or one of its parents/,
      );
    }
    expect(() =>
      checkReportOutDir(cwd, { cwd: join(root, 'alias', 'workspace'), force: true }),
    ).toThrow(/working directory or one of its parents/);
    expect(() =>
      checkReportOutDir(join(root, 'alias', 'workspace', 'new', 'report'), { cwd }),
    ).not.toThrow();
  });

  it('refuses a folder or file that is not a previous report unless forced', () => {
    const cwd = project();
    writeFileSync(join(cwd, 'notes.txt'), 'x');
    for (const outDir of ['src', 'notes.txt']) {
      expect(() => checkReportOutDir(outDir, { cwd })).toThrow(/pass --force/);
      expect(() => checkReportOutDir(outDir, { cwd, force: true })).not.toThrow();
    }
  });

  it('accepts a new folder, an empty one and a previous report', () => {
    const cwd = project();
    mkdirSync(join(cwd, 'empty'));
    mkdirSync(join(cwd, 'report'));
    writeFileSync(join(cwd, 'report/__connection.json'), '{}');
    writeFileSync(join(cwd, 'report/index.html'), '');
    for (const outDir of ['dist-report', 'empty', 'report']) {
      expect(() => checkReportOutDir(outDir, { cwd })).not.toThrow();
    }
  });

  it('stops the build command before it empties the folder', async () => {
    const cwd = project();
    const assets = fixtureDir('pangular-assets-');
    writeFileSync(join(assets, 'index.html'), '<!doctype html>');
    const definition = { id: 'demo', clientAssets: assets, setup: () => {} };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const run = (outDir: string, ...extra: string[]) =>
      createCac(definition as never, { configureCli: guardReportOutDir }).parse([
        'node',
        'pangular',
        'build',
        '--outDir',
        outDir,
        ...extra,
      ]);

    await run(join(cwd, 'src'));
    expect(existsSync(join(cwd, 'src/app.ts'))).toBe(true);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toContain('pass --force');

    process.exitCode = undefined;
    await run(join(cwd, 'src'), '--force');
    expect(existsSync(join(cwd, 'src/app.ts'))).toBe(false);
    expect(existsSync(join(cwd, 'src/__connection.json'))).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it('keeps refusing the folder it was run from after --root moves the working directory', async () => {
    const root = project();
    const shell = project();
    const from = process.cwd();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => checkReportOutDir(shell, { cwd: root, force: true, invokedFrom: shell })).toThrow(
      /working directory or one of its parents/,
    );
    process.chdir(shell);
    try {
      await createPangularCli({ log: () => {} }).parse([
        'node',
        'pangular',
        'build',
        '--root',
        root,
        '--outDir',
        shell,
        '--force',
      ]);
    } finally {
      process.chdir(from);
    }
    expect(existsSync(join(shell, 'src/app.ts'))).toBe(true);
    expect(process.exitCode).toBe(1);
    expect(error.mock.calls.flat().join('\n')).toContain('working directory or one of its parents');
  });
});

describe('pangular dev startup', () => {
  it('prints the Angular Native view next to the panel URL', () => {
    for (const origin of ['http://localhost:9999', 'http://localhost:9999/']) {
      const lines = startupLines(origin, 9999, { mcp: true });
      expect(lines).toContain('  Panel: http://localhost:9999/');
      expect(lines).toContain('  Angular Native apps: http://localhost:9999/?view=angular-native');
      expect(lines).toContain('  MCP:   http://localhost:9999/__mcp');
    }
  });

  it('keeps the Angular Native line without MCP and on a fallback port', () => {
    const lines = startupLines('http://127.0.0.1:4321', 4321, { mcp: false });
    expect(lines.slice(1)).toEqual([
      '  Panel: http://127.0.0.1:4321/',
      '  Angular Native apps: http://127.0.0.1:4321/?view=angular-native',
      '  Port 9999 is taken, so the server uses port 4321.',
    ]);
  });
});
