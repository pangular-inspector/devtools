// How long the Vite dev server spends on each module: resolving imports to
// it, loading it and transforming it, for the Build tab and the
// `module-graph` agent tool. The Vite plugin wraps the client environment's
// plugin container once, in `configureServer`, so every plugin's hooks are
// timed together, as Vite runs them. Dev server only, and capped.

/** Milliseconds the dev server spent on one module, wall clock. */
export interface ModuleTiming {
  /** Every resolution of an import to this module, added up. */
  resolve: number;
  /** The last load. */
  load: number;
  /** The last transform, all plugins together. */
  transform: number;
}

/** Modules timed at most; the oldest is dropped first. */
export const MAX_TIMED_MODULES = 5000;

/** The plugin container methods the timings wrap (`EnvironmentPluginContainer` in Vite 6+). */
export interface PluginContainerLike {
  resolveId(rawId: string, ...rest: unknown[]): Promise<{ id?: unknown } | null | undefined>;
  load(id: string, ...rest: unknown[]): Promise<unknown>;
  transform(code: string, id: string, ...rest: unknown[]): Promise<unknown>;
}

/** The parts of a Vite dev server the timings read. */
export interface TimedServerLike {
  environments?: Record<string, { pluginContainer?: PluginContainerLike } | undefined>;
  /** Vite 5's shared container, which also runs SSR transforms. */
  pluginContainer?: PluginContainerLike;
}

/** Timings by module id, with the oldest dropped past the cap. */
export class ModuleTimings {
  private readonly byId = new Map<string, ModuleTiming>();
  /** Whether a module was dropped to stay under the cap. */
  capped = false;

  readonly max: number;

  // No parameter property: Node loads vite.config.ts with type stripping only.
  constructor(max = MAX_TIMED_MODULES) {
    this.max = max;
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: string): ModuleTiming | undefined {
    return this.byId.get(id);
  }

  add(id: string, phase: keyof ModuleTiming, ms: number): void {
    let timing = this.byId.get(id);
    if (!timing) {
      if (this.byId.size >= this.max) {
        const oldest = this.byId.keys().next().value;
        if (oldest !== undefined) this.byId.delete(oldest);
        this.capped = true;
      }
      timing = { resolve: 0, load: 0, transform: 0 };
      this.byId.set(id, timing);
    }
    if (phase === 'resolve') timing.resolve += ms;
    else timing[phase] = ms;
  }
}

const wrapped = new WeakSet<object>();

/** Whether a Vite 5 call runs for SSR, which the client graph does not show. */
function isSsr(options: unknown): boolean {
  return !!options && typeof options === 'object' && (options as { ssr?: unknown }).ssr === true;
}

/**
 * Wraps `resolveId`, `load` and `transform` of one plugin container so each
 * call records its duration under the module id. Returns the undo, which
 * only restores methods that are still the wrappers.
 */
export function timePluginContainer(
  container: PluginContainerLike,
  timings: ModuleTimings,
  skipSsr = false,
): () => void {
  if (wrapped.has(container)) return () => undefined;
  wrapped.add(container);
  const { resolveId, load, transform } = container;
  const now = () => performance.now();
  const timedResolve: PluginContainerLike['resolveId'] = async function (this: unknown, ...args) {
    const started = now();
    const result = await resolveId.apply(this, args);
    const id = result?.id;
    if (typeof id === 'string' && !(skipSsr && isSsr(args[2]))) {
      timings.add(id, 'resolve', now() - started);
    }
    return result;
  };
  const timedLoad: PluginContainerLike['load'] = async function (this: unknown, id, ...rest) {
    const started = now();
    const result = await load.call(this, id, ...rest);
    if (!(skipSsr && isSsr(rest[0]))) timings.add(id, 'load', now() - started);
    return result;
  };
  const timedTransform: PluginContainerLike['transform'] = async function (
    this: unknown,
    code,
    id,
    ...rest
  ) {
    const started = now();
    const result = await transform.call(this, code, id, ...rest);
    if (!(skipSsr && isSsr(rest[0]))) timings.add(id, 'transform', now() - started);
    return result;
  };
  container.resolveId = timedResolve;
  container.load = timedLoad;
  container.transform = timedTransform;
  return () => {
    wrapped.delete(container);
    if (container.resolveId === timedResolve) container.resolveId = resolveId;
    if (container.load === timedLoad) container.load = load;
    if (container.transform === timedTransform) container.transform = transform;
  };
}

/** The timings of a dev server, and the undo the plugin calls when the server closes. */
export interface ViteTimings {
  timings: ModuleTimings;
  stop(): void;
}

/**
 * Times the client modules of a Vite dev server: the `client` environment's
 * container in Vite 6+, or the shared one before it, without SSR calls.
 * `undefined` when the server has neither.
 */
export function timeViteModules(
  server: TimedServerLike,
  timings = new ModuleTimings(),
): ViteTimings | undefined {
  let client: PluginContainerLike | undefined;
  try {
    client = server.environments?.['client']?.pluginContainer;
  } catch {
    // Vite throws when an environment's container is read before it is set up.
    return undefined;
  }
  const container = client ?? server.pluginContainer;
  if (!container || typeof container.transform !== 'function') return undefined;
  const stop = timePluginContainer(container, timings, !client);
  return { timings, stop };
}
