// Fake `window.ng` objects shaped like each Angular version publishes them,
// from the fesm bundles of @angular/core 12.2 to 22.2 (see
// docs/angular-compat.md). Every util is a stub that throws when a test
// calls one it did not override, so a collector that relies on a util the
// version lacks fails loudly instead of reading `undefined`.

/** The `window.ng` keys each version publishes in a development build. */
export const NG_UTILS: Record<string, readonly string[]> = {
  '12.2': [
    'ɵsetProfiler',
    'getDirectiveMetadata',
    'getComponent',
    'getContext',
    'getListeners',
    'getOwningComponent',
    'getHostElement',
    'getInjector',
    'getRootComponents',
    'getDirectives',
    'applyChanges',
  ],
  '16.2': ['ɵgetDependenciesFromInjectable', 'ɵgetInjectorProviders', 'ɵgetInjectorResolutionPath'],
  '17.0': ['ɵgetInjectorMetadata'],
  '17.1': ['isSignal'],
  '19.1': ['ɵgetSignalGraph', 'ɵgetDeferBlocks'],
  '20.0': ['enableProfiling'],
  '20.2': ['ɵgetTransferState'],
  '20.3': ['ɵgetRouterInstance'],
  '22.0': ['ɵgetControlFlowBlocks'],
};

const ORDER = Object.keys(NG_UTILS);

function atLeast(version: string, since: string): boolean {
  const [a, b] = version.split('.').map(Number);
  const [c, d] = since.split('.').map(Number);
  return a !== c ? a > c : b >= d;
}

/** Every util name the given version publishes. 22.0 drops `ɵgetDeferBlocks`. */
export function ngUtilsOf(version: string): string[] {
  const names = ORDER.filter((since) => atLeast(version, since)).flatMap(
    (since) => NG_UTILS[since],
  );
  return atLeast(version, '22.0') ? names.filter((name) => name !== 'ɵgetDeferBlocks') : names;
}

/**
 * A fake `ng` with the version's util names. `overrides` give the utils a
 * test uses their behaviour; any other util throws when called.
 */
export function fakeNg(
  version: string,
  overrides: Record<string, (...args: never[]) => unknown> = {},
): Record<string, unknown> {
  const ng: Record<string, unknown> = {};
  for (const name of ngUtilsOf(version)) {
    ng[name] =
      overrides[name] ??
      (() => {
        throw new Error(`ng.${name} called without a test override`);
      });
  }
  for (const [name, fn] of Object.entries(overrides)) {
    if (!(name in ng)) {
      throw new Error(`Angular ${version} has no ng.${name}; the test should not give it one`);
    }
    ng[name] = fn;
  }
  return ng;
}

/** Puts an Angular root with `ng-version` into the document and returns it. */
export function angularRoot(version: string, tag = 'app-root'): HTMLElement {
  const root = document.createElement(tag);
  root.setAttribute('ng-version', version);
  document.body.append(root);
  return root;
}
