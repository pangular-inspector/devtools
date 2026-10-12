import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { InjectorTreeNode, ProviderInfo } from '../types.ts';

/**
 * Angular packages that never provide anything at runtime. The compiler's
 * classes (`Element`, `Text`, `Comment`…) would only make app names collide.
 */
const SKIPPED_PACKAGES = new Set(['build', 'cli', 'compiler', 'compiler-cli', 'language-service']);

/** `class Foo {` or `class _Foo extends Bar {`, not "class doesn't" in a comment. */
const CLASS_NAME = /(?:^|[\s;{}(=,])class\s+(_?[A-Z][\w$]*)\s*(?:extends\s+[\w$.]+\s*)?\{/g;

/**
 * The description of an `InjectionToken`, which `tokenName()` on the page
 * reports: `new InjectionToken('X')`, `new InjectionToken(ngDevMode ? 'X' : '')`. The
 * dev mode check can hold quotes (`typeof ngDevMode !== 'undefined'`) but no `?`.
 */
const TOKEN_DESCRIPTION = /new InjectionToken\(\s*(?:[^?)]*\?\s*)?(['"`])([^'"`\n]+)\1/g;

/**
 * Adds the class names and `InjectionToken` descriptions declared in one
 * Angular bundle to `into`, named the way the injector collector names
 * tokens (`className()` strips a bundler `_` prefix).
 */
export function frameworkNamesIn(source: string, into = new Set<string>()): Set<string> {
  for (const match of source.matchAll(CLASS_NAME)) {
    into.add(match[1]!.replace(/^_(?=[A-Z])/, ''));
  }
  for (const match of source.matchAll(TOKEN_DESCRIPTION)) into.add(match[2]!);
  return into;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Every `node_modules/@angular/<name>` from `start` up to the file system root, nearest first. */
async function angularPackages(starts: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const seen = new Set<string>();
  for (const start of starts) {
    let dir = start;
    for (;;) {
      if (!seen.has(dir)) {
        seen.add(dir);
        const scope = join(dir, 'node_modules', '@angular');
        let names: string[] = [];
        try {
          names = await readdir(scope);
        } catch {
          names = [];
        }
        for (const name of names) {
          if (!found.has(name) && !SKIPPED_PACKAGES.has(name)) found.set(name, join(scope, name));
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return found;
}

async function bundles(dir: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = (await readdir(dir, { recursive: true })).map(String);
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.endsWith('.mjs')).map((entry) => join(dir, entry));
}

/**
 * The names of the tokens the installed `@angular/*` packages declare, read
 * from their `fesm2022` bundles under the `node_modules` of each start
 * folder and its parents. Empty when no Angular package is found.
 */
export async function scanFrameworkNames(starts: string[]): Promise<Set<string>> {
  const names = new Set<string>();
  for (const dir of (await angularPackages(starts)).values()) {
    const fesm = join(dir, 'fesm2022');
    if (!(await isDirectory(fesm))) continue;
    for (const file of await bundles(fesm)) {
      try {
        frameworkNamesIn(await readFile(file, 'utf8'), names);
      } catch {
        // An unreadable bundle only leaves its tokens unmarked.
      }
    }
  }
  return names;
}

const isFrameworkProvider = (provider: ProviderInfo) => provider.framework === true;

/**
 * Whether an injector belongs to Angular rather than the app:
 * - the Platform injector, which Angular creates for every app;
 * - an environment injector other than Root whose providers all come from
 *   Angular (Root always holds the app's own root services);
 * - an element injector with no component whose directives and providers
 *   all come from Angular, such as `<router-outlet>` or an `ngModel` input.
 */
function isFrameworkInjector(node: InjectorTreeNode, names: ReadonlySet<string>): boolean {
  const { injector, providers } = node;
  if (injector.type === 'environment') {
    if (injector.name === 'Platform') return true;
    return injector.name !== 'Root' && providers.length > 0 && providers.every(isFrameworkProvider);
  }
  if (injector.type !== 'element' || injector.component) return false;
  const directives = injector.directives ?? [];
  return (
    directives.length > 0 &&
    directives.every((name) => names.has(name)) &&
    providers.every(isFrameworkProvider)
  );
}

/**
 * A copy of `nodes` with `framework: true` on the providers whose token is in
 * `names` and on the injectors that belong to Angular (see
 * {@link isFrameworkInjector}). Flags the page sent are dropped first.
 */
export function markFramework(
  nodes: InjectorTreeNode[],
  names: ReadonlySet<string>,
): InjectorTreeNode[] {
  return nodes.map((node) => {
    const providers = node.providers.map(({ framework: _ignored, ...provider }) =>
      names.has(provider.token) ? { ...provider, framework: true } : provider,
    );
    const { framework: _dropped, ...injector } = node.injector;
    const marked: InjectorTreeNode = {
      ...node,
      injector,
      providers,
      children: markFramework(node.children, names),
    };
    if (isFrameworkInjector(marked, names)) marked.injector = { ...injector, framework: true };
    return marked;
  });
}

/**
 * Reads the framework token names once, in the background, the first time
 * they are asked for. `current()` is `null` until they are read, and
 * `onLoaded` runs once when they are.
 */
export function createFrameworkNames(
  starts: () => string[],
  onLoaded?: (names: ReadonlySet<string>) => void,
) {
  let names: Set<string> | null = null;
  let loading: Promise<Set<string>> | null = null;
  const load = () =>
    (loading ??= scanFrameworkNames(starts().filter(Boolean))
      .catch(() => new Set<string>())
      .then((found) => {
        names = found;
        onLoaded?.(found);
        return found;
      }));
  return {
    current(): ReadonlySet<string> | null {
      if (!names) void load();
      return names;
    },
    load,
  };
}
