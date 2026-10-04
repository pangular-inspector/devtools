import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The major version of `@angular/core` the project builds against, or
 * `undefined` when it cannot be told apart from the workspace root.
 *
 * Angular 22 made `OnPush` the implicit change detection strategy, so a
 * component without a `changeDetection` key means something different
 * depending on which major the project is on; this resolves that once per
 * scan rather than per file.
 *
 * Only one version is resolved for the whole workspace root, so a monorepo
 * that mixes Angular majors across packages is not distinguished per package.
 */
export function angularMajor(cwd: string): number | undefined {
  const installed = readJson(join(cwd, 'node_modules', '@angular', 'core', 'package.json'))[
    'version'
  ];
  if (typeof installed === 'string') {
    const major = majorOf(installed);
    if (major !== undefined) return major;
  }

  const pkg = readJson(join(cwd, 'package.json'));
  const range = {
    ...asRecord(pkg['dependencies']),
    ...asRecord(pkg['devDependencies']),
  }['@angular/core'];
  // Only a pinned or `^`/`~` range names one version; `>=20`, `latest`,
  // `workspace:*` and the like could resolve to anything and are left alone
  // rather than guessed at.
  if (typeof range === 'string') return majorOf(range.replace(/^[\^~]/, ''));
  return undefined;
}

function majorOf(version: string): number | undefined {
  const match = /^(\d+)(?:\.|$)/.exec(version.trim());
  return match ? Number(match[1]) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readJson(path: string): Record<string, unknown> {
  try {
    if (!existsSync(path)) return {};
    return asRecord(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return {};
  }
}
