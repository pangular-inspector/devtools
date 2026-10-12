import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The commands the terminals dock can run. Nothing else is ever spawned. */
export const TERMINAL_COMMAND_IDS = ['build', 'test'] as const;

export type TerminalCommandId = (typeof TERMINAL_COMMAND_IDS)[number];

export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun';

/** One fixed command, found in the project when the hub starts. */
export interface TerminalCommand {
  id: TerminalCommandId;
  /** What the dock and the palette show, such as `pnpm run build` or `ng test`. */
  title: string;
  command: PackageManager;
  args: string[];
  /** A `package.json` script, or an Angular CLI target in `angular.json`. */
  source: 'script' | 'angular-cli';
}

/** Reads a text file, or `undefined` when it is missing. Tests pass a fake. */
export type ReadText = (path: string) => string | undefined;

const readText: ReadText = (path) => {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  } catch {
    return undefined;
  }
};

function json(text: string | undefined): Record<string, unknown> | undefined {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const LOCKFILES: [file: string, manager: PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

/** How many folders above the project the lockfile search goes, for workspaces. */
const MAX_PARENTS = 5;

/**
 * The project's package manager: `packageManager` in `package.json`, then the
 * nearest lockfile in the project or up to five folders above it, then npm.
 */
export function packageManagerFor(cwd: string, read: ReadText = readText): PackageManager {
  let dir = cwd;
  for (let level = 0; level <= MAX_PARENTS; level++) {
    const declared = json(read(join(dir, 'package.json')))?.['packageManager'];
    if (typeof declared === 'string') {
      const name = declared.split('@')[0];
      if (name === 'pnpm' || name === 'yarn' || name === 'npm' || name === 'bun') return name;
    }
    for (const [file, manager] of LOCKFILES) {
      if (read(join(dir, file)) !== undefined) return manager;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'npm';
}

/** `npm init` writes this test script; it only fails, so it doesn't count. */
const PLACEHOLDER_TEST = /no test specified/i;

function scriptFor(pkg: Record<string, unknown>, id: TerminalCommandId): string | undefined {
  const script = record(pkg['scripts'])[id];
  if (typeof script !== 'string' || !script.trim()) return undefined;
  if (id === 'test' && PLACEHOLDER_TEST.test(script)) return undefined;
  return script;
}

function hasAngularCli(pkg: Record<string, unknown>): boolean {
  return ['dependencies', 'devDependencies'].some(
    (field) => typeof record(pkg[field])['@angular/cli'] === 'string',
  );
}

/** Whether a project in `angular.json` has the target, under `architect` or `targets`. */
function hasAngularTarget(angular: Record<string, unknown>, id: TerminalCommandId): boolean {
  return Object.values(record(angular['projects'])).some((project) => {
    const p = record(project);
    return id in record(p['architect']) || id in record(p['targets']);
  });
}

/** `ng <id>` through the package manager, so the project's own CLI runs. */
function ngArgs(manager: PackageManager, id: TerminalCommandId): string[] {
  switch (manager) {
    case 'pnpm':
      return ['exec', 'ng', id];
    case 'npm':
      return ['exec', '--', 'ng', id];
    case 'yarn':
      return ['ng', id];
    case 'bun':
      return ['run', 'ng', id];
  }
}

/**
 * The build and test commands of the project in `cwd`, found once when the hub
 * starts: the `build` and `test` scripts of `package.json`, run with the
 * project's package manager, or else `ng build` and `ng test` when
 * `angular.json` has the target and `@angular/cli` is installed. The list
 * holds at most one command per id, and the dock runs only these.
 */
export function detectTerminalCommands(cwd: string, read: ReadText = readText): TerminalCommand[] {
  const pkg = json(read(join(cwd, 'package.json')));
  if (!pkg) return [];
  const manager = packageManagerFor(cwd, read);
  const angular = hasAngularCli(pkg) ? json(read(join(cwd, 'angular.json'))) : undefined;
  const commands: TerminalCommand[] = [];
  for (const id of TERMINAL_COMMAND_IDS) {
    if (scriptFor(pkg, id)) {
      commands.push({
        id,
        title: `${manager} run ${id}`,
        command: manager,
        args: ['run', id],
        source: 'script',
      });
    } else if (angular && hasAngularTarget(angular, id)) {
      commands.push({
        id,
        title: `ng ${id}`,
        command: manager,
        args: ngArgs(manager, id),
        source: 'angular-cli',
      });
    }
  }
  return commands;
}

export function isTerminalCommandId(value: unknown): value is TerminalCommandId {
  return typeof value === 'string' && (TERMINAL_COMMAND_IDS as readonly string[]).includes(value);
}
