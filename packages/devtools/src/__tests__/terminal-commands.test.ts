import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectTerminalCommands,
  isTerminalCommandId,
  packageManagerFor,
} from '../terminal-commands.ts';
import { makeProject } from './analog-fixture.ts';

/** A fake file system: paths relative to `/work/app`. */
function files(entries: Record<string, unknown>) {
  const map = new Map(
    Object.entries(entries).map(([path, value]) => [
      join('/work/app', path),
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );
  return (path: string) => map.get(path);
}

const ANGULAR_JSON = {
  projects: { shop: { architect: { build: {}, serve: {}, test: {} } } },
};

describe('terminal command detection', () => {
  it('runs the build and test scripts with the package manager of the lockfile', () => {
    const read = files({
      'package.json': { scripts: { build: 'ng build', test: 'ng test', start: 'ng serve' } },
      'pnpm-lock.yaml': '',
    });
    expect(detectTerminalCommands('/work/app', read)).toEqual([
      {
        id: 'build',
        title: 'pnpm run build',
        command: 'pnpm',
        args: ['run', 'build'],
        source: 'script',
      },
      {
        id: 'test',
        title: 'pnpm run test',
        command: 'pnpm',
        args: ['run', 'test'],
        source: 'script',
      },
    ]);
  });

  it('only ever offers build and test, whatever other scripts the project has', () => {
    const read = files({
      'package.json': { scripts: { deploy: 'rm -rf /', start: 'ng serve', lint: 'eslint .' } },
    });
    expect(detectTerminalCommands('/work/app', read)).toEqual([]);
  });

  it('falls back to ng build and ng test when angular.json has the targets', () => {
    const read = files({
      'package.json': { devDependencies: { '@angular/cli': '^22.0.0' } },
      'angular.json': ANGULAR_JSON,
      'package-lock.json': '{}',
    });
    expect(detectTerminalCommands('/work/app', read)).toEqual([
      {
        id: 'build',
        title: 'ng build',
        command: 'npm',
        args: ['exec', '--', 'ng', 'build'],
        source: 'angular-cli',
      },
      {
        id: 'test',
        title: 'ng test',
        command: 'npm',
        args: ['exec', '--', 'ng', 'test'],
        source: 'angular-cli',
      },
    ]);
  });

  it('runs ng through each package manager', () => {
    const pkg = { devDependencies: { '@angular/cli': '^22.0.0' } };
    const argsFor = (lockfile: string) =>
      detectTerminalCommands(
        '/work/app',
        files({ 'package.json': pkg, 'angular.json': ANGULAR_JSON, [lockfile]: '' }),
      )[0];
    expect(argsFor('pnpm-lock.yaml')).toMatchObject({
      command: 'pnpm',
      args: ['exec', 'ng', 'build'],
    });
    expect(argsFor('yarn.lock')).toMatchObject({ command: 'yarn', args: ['ng', 'build'] });
    expect(argsFor('bun.lock')).toMatchObject({ command: 'bun', args: ['run', 'ng', 'build'] });
  });

  it('prefers a script over the Angular CLI target and skips the npm placeholder test script', () => {
    const read = files({
      'package.json': {
        scripts: {
          build: 'ng build --configuration production',
          test: 'echo "Error: no test specified" && exit 1',
        },
        devDependencies: { '@angular/cli': '^22.0.0' },
      },
      'angular.json': { projects: { shop: { targets: { build: {} } } } },
    });
    expect(detectTerminalCommands('/work/app', read)).toEqual([
      expect.objectContaining({ id: 'build', source: 'script', args: ['run', 'build'] }),
    ]);
  });

  it('needs the Angular CLI installed for ng commands', () => {
    const read = files({ 'package.json': {}, 'angular.json': ANGULAR_JSON });
    expect(detectTerminalCommands('/work/app', read)).toEqual([]);
  });

  it('finds nothing without a package.json, or with one that is not JSON', () => {
    expect(detectTerminalCommands('/work/app', files({}))).toEqual([]);
    expect(detectTerminalCommands('/work/app', files({ 'package.json': '{oops' }))).toEqual([]);
  });

  it('reads the package manager from packageManager, then the nearest lockfile above the project', () => {
    expect(
      packageManagerFor('/work/app', files({ 'package.json': { packageManager: 'yarn@4.5.0' } })),
    ).toBe('yarn');
    const workspace = (path: string) =>
      path === '/work/pnpm-lock.yaml' ? '' : path === '/work/app/package.json' ? '{}' : undefined;
    expect(packageManagerFor('/work/app', workspace)).toBe('pnpm');
    expect(packageManagerFor('/work/app', files({ 'package.json': {} }))).toBe('npm');
  });

  it('reads a real project folder', () => {
    const cwd = makeProject({
      'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }),
      'yarn.lock': '',
    });
    expect(detectTerminalCommands(cwd)).toEqual([
      {
        id: 'test',
        title: 'yarn run test',
        command: 'yarn',
        args: ['run', 'test'],
        source: 'script',
      },
    ]);
  });

  it('knows its command ids', () => {
    expect(isTerminalCommandId('build')).toBe(true);
    expect(isTerminalCommandId('test')).toBe(true);
    expect(isTerminalCommandId('bash')).toBe(false);
    expect(isTerminalCommandId(undefined)).toBe(false);
  });
});
