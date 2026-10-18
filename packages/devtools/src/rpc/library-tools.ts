import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_ENTRIES, type PangularInspector } from '../config.ts';

/**
 * Agent tools of a library an app may not use (Analog, Capacitor, TanStack
 * Query) cost every agent context room in `tools/list`. When the config leaves
 * them to the project (`agent.autoLibraries`), they are offered only when:
 *
 * - the project's package.json lists the library (decided at startup), or
 * - a page reports the library's data later; the tools are then registered,
 *   and devframe sends `notifications/tools/list_changed`, so clients that
 *   follow it see them. Clients that don't see them after reconnecting.
 *
 * A project without a package.json the server can read keeps every tool.
 */

/** Which library each inspector needs, by package name. */
const LIBRARY_PACKAGES: Partial<Record<PangularInspector, (name: string) => boolean>> = {
  capacitor: (name) => name === '@capacitor/core',
  tanstackQuery: (name) => name.startsWith('@tanstack/angular-query'),
};

/** The dependency names of the package.json files in `roots`; undefined when none can be read. */
export function projectDependencies(roots: readonly string[]): Set<string> | undefined {
  let found = false;
  const names = new Set<string>();
  for (const root of new Set(roots)) {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
    } catch {
      continue;
    }
    found = true;
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[key];
      if (deps && typeof deps === 'object') for (const name of Object.keys(deps)) names.add(name);
    }
  }
  return found ? names : undefined;
}

/**
 * The library inspectors the project uses, out of `auto`. Undefined when the
 * project can't be read, so nothing is held back.
 */
export function usedLibraries(
  auto: readonly PangularInspector[],
  roots: readonly string[],
  isAnalog: () => boolean,
): Set<PangularInspector> | undefined {
  const deps = projectDependencies(roots);
  if (!deps) return undefined;
  const used = new Set<PangularInspector>();
  for (const inspector of auto) {
    const uses =
      inspector === 'analog'
        ? isAnalog()
        : [...deps].some((name) => !!LIBRARY_PACKAGES[inspector]?.(name));
    if (uses) used.add(inspector);
  }
  return used;
}

/** The inspector that turns an agent tool off, from AGENT_ENTRIES. */
function inspectorOf(id: string): PangularInspector | undefined {
  return AGENT_ENTRIES[id.replace(/^pangular:/, '')]?.inspectors?.[0];
}

export interface LibraryGate<T> {
  /** True when the tool is held back until its library shows up; the gate registers it then. */
  hold(tool: T & { id: string }): boolean;
  /** Registers the held tools of every library a page now reports. */
  check(): void;
  /** The inspectors whose tools are held back. */
  held(): PangularInspector[];
  stop(): void;
}

const CHECK_EVERY_MS = 2000;

export function createLibraryGate<T>(options: {
  /** Library inspectors the config leaves to the project. */
  auto: readonly PangularInspector[];
  /** What the project uses, or undefined when unknown. */
  used: Set<PangularInspector> | undefined;
  /** Whether a page reports the library's data now. */
  reporting: Partial<Record<PangularInspector, () => boolean>>;
  register(tool: T): void;
}): LibraryGate<T> {
  const waiting = new Map<PangularInspector, T[]>();
  const gated = (inspector: PangularInspector | undefined): inspector is PangularInspector =>
    !!inspector &&
    !!options.used &&
    options.auto.includes(inspector) &&
    !options.used.has(inspector);
  const check = () => {
    for (const [inspector, tools] of [...waiting]) {
      if (!options.reporting[inspector]?.()) continue;
      waiting.delete(inspector);
      for (const tool of tools) options.register(tool);
    }
    if (!waiting.size) clearInterval(timer);
  };
  const timer = setInterval(check, CHECK_EVERY_MS);
  timer.unref?.();
  return {
    hold(tool) {
      const inspector = inspectorOf(tool.id);
      if (!gated(inspector)) return false;
      waiting.set(inspector, [...(waiting.get(inspector) ?? []), tool]);
      return true;
    },
    check,
    held: () => [...waiting.keys()],
    stop: () => clearInterval(timer),
  };
}
