import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resetScanVersion, viteScanWatcher } from '../analog-scan-cache.ts';
import { scanPipes } from '../get-pipes.ts';
import { clearSourceFileIndex, scanSourceFiles } from '../source-file-index.ts';
import { fixtureDir } from './fixture-dir.ts';

afterEach(() => {
  clearSourceFileIndex();
  resetScanVersion();
});

function project() {
  const cwd = fixtureDir('pangular-source-index-');
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(cwd, 'src', 'b.ts'), 'export const b = 2;\n');
  return cwd;
}

/** Moves a file's mtime, so a rewrite in the same millisecond still counts as a change. */
function touch(path: string, seconds: number) {
  utimesSync(path, seconds, seconds);
}

describe('source file index', () => {
  it('parses each file once and again only after it changes', () => {
    const cwd = project();
    const parsed: string[] = [];
    const scan = () =>
      scanSourceFiles(cwd, 'test', (file) => {
        parsed.push(file.relPath);
        return { value: file.content.trim() };
      });
    expect(scan().sort()).toEqual(['export const a = 1;', 'export const b = 2;']);
    expect(parsed.sort()).toEqual(['src/a.ts', 'src/b.ts']);
    parsed.length = 0;
    scan();
    expect(parsed).toEqual([]);
    writeFileSync(join(cwd, 'src', 'a.ts'), 'export const a = 10;\n');
    touch(join(cwd, 'src', 'a.ts'), 1_000_000);
    expect(scan()).toContain('export const a = 10;');
    expect(parsed).toEqual(['src/a.ts']);
  });

  it('rescans a component when its templateUrl file changes', () => {
    const cwd = project();
    const component = `import { Component } from '@angular/core';
@Component({ selector: 'app-x', templateUrl: './x.html' })
export class X {}
`;
    writeFileSync(join(cwd, 'src', 'x.ts'), component);
    writeFileSync(join(cwd, 'src', 'x.html'), '<p>{{ when | date }}</p>');
    expect(scanPipes(cwd).map((p) => p.name)).toEqual(['date']);
    writeFileSync(join(cwd, 'src', 'x.html'), '<p>{{ name | uppercase }}</p>');
    touch(join(cwd, 'src', 'x.html'), 1_000_000);
    expect(scanPipes(cwd).map((p) => p.name)).toEqual(['uppercase']);
  });

  it('skips the walk while the Vite watcher covers the sources and saw no change', () => {
    const cwd = project();
    const onChange = viteScanWatcher(cwd);
    let parses = 0;
    const scan = () =>
      scanSourceFiles(cwd, 'test', (file) => {
        parses++;
        return { value: file.relPath };
      });
    expect(scan()).toHaveLength(2);
    writeFileSync(join(cwd, 'src', 'c.ts'), 'export const c = 3;\n');
    // The watcher has not reported the new file yet, so the kept list stands.
    expect(scan()).toHaveLength(2);
    onChange('add', join(cwd, 'src', 'c.ts'));
    expect(scan()).toHaveLength(3);
    expect(parses).toBe(3);
  });

  it('keeps walking when the Vite watcher does not cover the source roots', () => {
    const cwd = project();
    viteScanWatcher(join(cwd, 'elsewhere'));
    const scan = () => scanSourceFiles(cwd, 'test', (file) => ({ value: file.relPath }));
    expect(scan()).toHaveLength(2);
    writeFileSync(join(cwd, 'src', 'c.ts'), 'export const c = 3;\n');
    expect(scan()).toHaveLength(3);
  });

  it('answers with copies, so a caller changing a pipe does not change the kept scan', () => {
    const cwd = project();
    writeFileSync(
      join(cwd, 'src', 'p.ts'),
      `import { Pipe } from '@angular/core';\n@Pipe({ name: 'shout' })\nexport class ShoutPipe {}\n`,
    );
    const first = scanPipes(cwd);
    first[0].name = 'changed';
    expect(scanPipes(cwd)[0].name).toBe('shout');
  });
});
