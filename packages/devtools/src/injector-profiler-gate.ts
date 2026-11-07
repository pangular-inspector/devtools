/**
 * Angular wires its injector profiler, which backs the provider lists the DI
 * inspector shows, only when `window` exists as the platform is created
 * (`publishDefaultGlobalUtils` in `@angular/core`). A native runtime may have
 * no `window`, so one is defined here and removed once the profiler is in
 * place. The moment is read off the `ng` global: core publishes its utilities
 * right after wiring the profiler, and `getComponent` is the sentinel rather
 * than the `ng` object itself because the router publishes its own utilities
 * onto that object earlier, while `provideRouter()` evaluates.
 *
 * Does nothing when `window` exists, or when `ng` already holds the core
 * utilities: the profiler is wired, or the platform was created without it and
 * it is too late. An `ng` that holds only the router's utilities still gates.
 */
export function gateInjectorProfiler(): void {
  const g = globalThis as Record<string, unknown>;
  if ('window' in g) return;
  const existing = g['ng'];
  // Core has published its utilities, or something else owns `ng`: too late.
  if (existing !== undefined && (!isObject(existing) || 'getComponent' in existing)) return;
  Object.defineProperty(g, 'window', { configurable: true, get: () => g });
  const removeWindow = () => {
    if (Object.getOwnPropertyDescriptor(g, 'window')?.get) delete g['window'];
  };
  const awaitCoreUtils = (ng: Record<string, unknown>) => {
    Object.defineProperty(ng, 'getComponent', {
      configurable: true,
      enumerable: true,
      get: () => undefined,
      set(fn: unknown) {
        Object.defineProperty(ng, 'getComponent', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: fn,
        });
        removeWindow();
      },
    });
  };
  // The router ran first (an `app.config.ts` imported before this module).
  if (isObject(existing)) {
    awaitCoreUtils(existing);
    return;
  }
  Object.defineProperty(g, 'ng', {
    configurable: true,
    enumerable: true,
    get: () => undefined,
    set(value: unknown) {
      Object.defineProperty(g, 'ng', {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
      // Not Angular's empty object, or one that already holds the core utilities.
      if (!isObject(value) || 'getComponent' in value) {
        removeWindow();
        return;
      }
      awaitCoreUtils(value);
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * The gate for Angular Native, run as its overlay module loads. The overlay
 * itself starts after `mount()`, once the platform exists, but `src/main.ts`
 * imports the module before `mount()` runs. Only in a React Native development
 * build (`__DEV__` is `true`): a release build never publishes `ng`, so the
 * stand-in `window` would stay.
 */
export function gateInjectorProfilerInReactNativeDev(): void {
  if ((globalThis as { __DEV__?: unknown }).__DEV__ === true) gateInjectorProfiler();
}
