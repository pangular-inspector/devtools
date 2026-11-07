import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReport } from '../entries/cli.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';

function angularProject() {
  const root = fixtureDir('pangular-report-root-');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@angular/core': '^21.0.0' } }),
  );
  mkdirSync(join(root, 'src'));
  writeFileSync(
    join(root, 'src', 'hello.component.ts'),
    `@Component({ selector: 'app-hello', template: 'hi' })\nexport class Hello {}\n`,
  );
  return root;
}

function panelBuild() {
  const dist = fixtureDir('pangular-report-ui-');
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>panel</title>');
  return dist;
}

/** Every dumped RPC result as one string, to look for scanned names. */
function dumpText(outDir: string): string {
  const walk = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)],
    );
  return walk(join(outDir, '__rpc-dump'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

afterEach(() => vi.restoreAllMocks());

describe('buildReport()', () => {
  it('writes the static report of the given root without changing the working directory', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = angularProject();
    const out = join(fixtureDir('pangular-report-out-'), 'report');
    const cwd = process.cwd();

    const result = await buildReport({ root, outDir: out, distDir: panelBuild() });

    expect(process.cwd()).toBe(cwd);
    expect(result).toEqual({ outDir: out, root });
    expect(existsSync(join(out, 'index.html'))).toBe(true);
    const meta = JSON.parse(readFileSync(join(out, '__connection.json'), 'utf8'));
    expect(meta.backend).toBe('static');
    // The scan ran in `root`, not in the working directory.
    expect(dumpText(out)).toContain('app-hello');
  });

  it('reads pangular.config.json from the root when no config is given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = angularProject();
    writeFileSync(
      join(root, 'pangular.config.json'),
      JSON.stringify({ inspectors: { pipes: false } }),
    );
    const out = join(fixtureDir('pangular-report-out-'), 'report');

    await buildReport({ root, outDir: out, distDir: panelBuild() });

    const meta = JSON.parse(readFileSync(join(out, '__connection.json'), 'utf8'));
    expect(meta.jsonSerializableMethods).not.toContain('pangular:get-pipes');
  });

  it('refuses a folder that is not a previous report unless forced', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = angularProject();
    const out = fixtureDir('pangular-report-out-');
    writeFileSync(join(out, 'notes.txt'), 'keep me');

    await expect(buildReport({ root, outDir: out, distDir: panelBuild() })).rejects.toThrow(
      /pass --force/,
    );
    expect(existsSync(join(out, 'notes.txt'))).toBe(true);

    await buildReport({ root, outDir: out, distDir: panelBuild(), force: true });
    expect(existsSync(join(out, 'notes.txt'))).toBe(false);
    expect(existsSync(join(out, '__connection.json'))).toBe(true);
  });

  it('refuses the project folder itself, even when forced', async () => {
    const root = angularProject();
    await expect(buildReport({ root, outDir: root, force: true })).rejects.toThrow(
      /working directory or one of its parents/,
    );
  });

  it('refuses a root that does not exist', async () => {
    await expect(buildReport({ root: '/no/such/project/here' })).rejects.toThrow(/does not exist/);
  });
});
