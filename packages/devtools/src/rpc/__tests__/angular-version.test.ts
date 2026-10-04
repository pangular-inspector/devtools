import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { angularMajor } from '../angular-version.ts';

describe('angularMajor', () => {
  it('reads the major from the installed package', () => {
    const dir = fixtureDir('pangular-version-');
    const coreDir = join(dir, 'node_modules', '@angular', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ version: '22.1.7' }));
    expect(angularMajor(dir)).toBe(22);
  });

  it('prefers the installed version over the declared range', () => {
    const dir = fixtureDir('pangular-version-');
    const coreDir = join(dir, 'node_modules', '@angular', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ version: '22.1.7' }));
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@angular/core': '^20.0.0' } }),
    );
    expect(angularMajor(dir)).toBe(22);
  });

  it('falls back to a pinned or ^/~ range in package.json', () => {
    const dir = fixtureDir('pangular-version-');
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@angular/core': '^21.0.0' } }),
    );
    expect(angularMajor(dir)).toBe(21);

    const dir2 = fixtureDir('pangular-version-');
    writeFileSync(
      join(dir2, 'package.json'),
      JSON.stringify({ devDependencies: { '@angular/core': '~21.1.0' } }),
    );
    expect(angularMajor(dir2)).toBe(21);
  });

  it('gives up on a range that names no single version', () => {
    const dir = fixtureDir('pangular-version-');
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { '@angular/core': '>=20.0.0' } }),
    );
    expect(angularMajor(dir)).toBeUndefined();

    const dir2 = fixtureDir('pangular-version-');
    writeFileSync(
      join(dir2, 'package.json'),
      JSON.stringify({ dependencies: { '@angular/core': 'latest' } }),
    );
    expect(angularMajor(dir2)).toBeUndefined();
  });

  it('returns undefined when nothing names a version at all', () => {
    const dir = fixtureDir('pangular-version-');
    expect(angularMajor(dir)).toBeUndefined();
  });
});

describe('angularMajor with malformed metadata', () => {
  it('yields undefined when package.json is not an object or its dependencies are', () => {
    const arrayRoot = fixtureDir('pangular-version-');
    writeFileSync(join(arrayRoot, 'package.json'), '[]');
    expect(angularMajor(arrayRoot)).toBeUndefined();

    const badDeps = fixtureDir('pangular-version-');
    writeFileSync(
      join(badDeps, 'package.json'),
      JSON.stringify({ dependencies: 'nope', devDependencies: null }),
    );
    expect(angularMajor(badDeps)).toBeUndefined();
  });
});
