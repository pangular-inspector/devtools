// A tiny feature flag store, standing in for any library that wants its own
// Pangular tab. It knows nothing about Pangular Inspector: the tab lives in
// the `./pangular` entry and the agent tools in `./pangular-server`, so an app
// that never loads the devtools never loads them either.

export interface FlagDefinition {
  /** Whether the flag is on until something overrides it. */
  default: boolean;
  description?: string;
}

export interface FlagState {
  name: string;
  description: string;
  default: boolean;
  value: boolean;
  /** Whether `set()` changed it away from its default. */
  overridden: boolean;
}

export interface FlagStore {
  /** Every flag in the order it was defined. */
  list(): FlagState[];
  /** Whether a flag is on. An unknown flag is off. */
  enabled(name: string): boolean;
  /** Turns a known flag on or off. Returns `false` for an unknown flag. */
  set(name: string, value: boolean): boolean;
  /** Puts every flag back to its default and returns how many changed. */
  reset(): number;
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Creates a store from flag definitions, keyed by flag name. */
export function createFlagStore(definitions: Record<string, FlagDefinition>): FlagStore {
  const overrides = new Map<string, boolean>();
  const listeners = new Set<() => void>();
  const known = (name: string) => Object.hasOwn(definitions, name);
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const valueOf = (name: string) => overrides.get(name) ?? definitions[name]!.default;

  return {
    list: () =>
      Object.entries(definitions).map(([name, definition]) => ({
        name,
        description: definition.description ?? '',
        default: definition.default,
        value: valueOf(name),
        overridden: overrides.has(name),
      })),
    enabled: (name) => known(name) && valueOf(name),
    set(name, value) {
      if (!known(name)) return false;
      if (value === definitions[name]!.default) overrides.delete(name);
      else overrides.set(name, value);
      notify();
      return true;
    },
    reset() {
      const changed = overrides.size;
      overrides.clear();
      if (changed) notify();
      return changed;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
