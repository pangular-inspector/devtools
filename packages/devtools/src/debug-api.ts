// The shape of `window.ng`, the debug API Angular publishes in development
// builds. Checked against `publishDefaultGlobalUtils` in
// `@angular/core/fesm2022/_debug_node-chunk.mjs` (22.1) and the router's
// `_publishNonCoreGlobalUtil` calls. Each `@since` names the first Angular
// version that publishes the function; `ng-capabilities.ts` checks the page
// at runtime, and `ANGULAR_FEATURE_NEEDS` in `config.ts` words what is missing.
// Functions published by every version the overlay supports (12.0+, the
// `debugApi` capability) are required; later ones are optional.
//
// Collectors keep their own narrow interfaces (`ComponentDebugNg`,
// `HydrationScanNg` and so on) so they stay testable with a small fake `ng`;
// this type is what the overlay hands them, so a renamed or retyped function
// shows up as a type error at the call site.

/** A listener as `ng.getListeners` returns it. */
export interface NgDebugListener {
  name: string;
  element: Element;
  callback: (value: unknown) => unknown;
  useCapture: boolean;
  type: 'dom' | 'output';
}

/** What `ng.getDirectiveMetadata` returns for a component or directive instance. */
export interface NgDebugDirectiveMetadata {
  inputs?: Record<string, string | { alias?: string; [key: string]: unknown }>;
  outputs?: Record<string, string>;
  encapsulation?: number;
  changeDetection?: number;
  [key: string]: unknown;
}

/** What `ng.ɵgetInjectorMetadata` returns. */
export interface NgDebugInjectorMetadata {
  /** `element`, `environment` or `null` in 22.1. */
  type: string;
  /** The host element, the environment injector's name, or `null`. */
  source: unknown;
}

/** What `ng.ɵgetDependenciesFromInjectable` returns for a created token. */
export interface NgDebugDependencies {
  instance?: unknown;
  dependencies: {
    token?: unknown;
    value?: unknown;
    flags?: { optional?: boolean; host?: boolean; self?: boolean; skipSelf?: boolean };
    /** The injector the dependency resolved from. */
    providedIn?: unknown;
  }[];
}

/** One entry of `ng.ɵgetInjectorProviders`. */
export interface NgDebugProviderRecord {
  token: unknown;
  provider: unknown;
  /** Element injectors only. */
  isViewProvider?: boolean;
  /** Environment injectors only: the imports that brought the provider in. */
  importPath?: unknown[];
}

/** A node of `ng.ɵgetSignalGraph`; `id` exists from 20.1. */
export interface NgDebugSignalNode {
  id?: string;
  kind?: string;
  label?: string;
  epoch?: number;
  value?: unknown;
  debuggableFn?: unknown;
}

/** What `ng.ɵgetSignalGraph` returns: edges index into `nodes`. */
export interface NgDebugSignalGraph {
  nodes: NgDebugSignalNode[];
  edges?: { consumer: number; producer: number }[];
}

export interface NgDebugApi {
  /** The component whose host is `element`, or `null`. @since 12.0 */
  getComponent<T = unknown>(element: Element): T | null;
  /** The template context of an embedded view, or the component. @since 12.0 */
  getContext<T extends object = object>(element: Element): T | null;
  /** The component whose template holds `elementOrDir`. @since 12.0 */
  getOwningComponent<T = unknown>(elementOrDir: Element | object): T | null;
  /** The root components of the app that holds `elementOrDir`. @since 12.0 */
  getRootComponents(elementOrDir: Element | object): object[];
  /** The element injector (`Injector.NULL` outside Angular). @since 12.0 */
  getInjector(elementOrDir: Element | object): unknown;
  /** Directives on a node, components included. @since 12.0 */
  getDirectives(node: Node): object[];
  /** Inputs, outputs, encapsulation and change detection of an instance. @since 12.0 */
  getDirectiveMetadata(instance: object): NgDebugDirectiveMetadata | null;
  /** The host element of a component or directive instance. @since 12.0 */
  getHostElement(componentOrDirective: object): Element;
  /** DOM and output listeners of an element. @since 12.0 */
  getListeners(element: Element): NgDebugListener[];
  /** Marks a component for check and runs change detection. @since 12.0 */
  applyChanges(component: object): void;
  /** Whether a value is a signal. @since 17.1 */
  isSignal?(value: unknown): boolean;
  /** Turns on Angular's own Chrome Performance track and hands back the stop function. @since 20.0 */
  enableProfiling?(): () => void;
  /** Dependencies a token injected from `injector`. @since 16.2 */
  ɵgetDependenciesFromInjectable?(injector: unknown, token: unknown): NgDebugDependencies;
  /** Providers registered on an injector. @since 16.2 */
  ɵgetInjectorProviders?(injector: unknown): NgDebugProviderRecord[];
  /** The injectors a lookup walks from `injector` up. @since 16.2 */
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
  /** Type (`element`, `environment` or `null`) and source of an injector. @since 17.0 */
  ɵgetInjectorMetadata?(injector: unknown): NgDebugInjectorMetadata | null;
  /** Adds a profiler. From 20.0 it hands back its remover; before that it has one slot (`ng-capabilities.ts` checks the version). */
  ɵsetProfiler?(
    profiler: ((event: number, instance?: unknown, context?: unknown) => void) | null,
  ): unknown;
  /** The reactive graph of an injector. Node ids from 20.1. @since 19.1 */
  ɵgetSignalGraph?(injector: unknown): NgDebugSignalGraph | null;
  /** `@defer` blocks under a node. Replaced by `ɵgetControlFlowBlocks` in 22.0. @since 19.1 */
  ɵgetDeferBlocks?(node: Node): unknown[];
  /** `@defer` and `@for` blocks under a node. @since 22.0 */
  ɵgetControlFlowBlocks?(node: Node): unknown[];
  /** The TransferState entries without Angular's own hydration keys. Present in 22.1; not checked on older versions. */
  ɵgetTransferState?(injector: unknown): Record<string, unknown>;
  /** The id a component instance has in Angular DevTools deep links. Present in 22.1; not checked on older versions. */
  ɵgetComponentInstanceDeepLinkId?(instance: object): number | undefined;
  /** The router of the app, published by `provideRouter()`. @since 20.3 */
  ɵgetRouterInstance?(injector: unknown): unknown;
  /** Router-loaded routes of a route config. @since 20.3 */
  ɵgetLoadedRoutes?(route: unknown): unknown;
  /** Navigates the router of an injector. @since 20.3 */
  ɵnavigateByUrl?(router: unknown, url: string): unknown;
}

/** Functions every supported version publishes (the `debugApi` capability floor). */
export const NG_DEBUG_REQUIRED = [
  'getComponent',
  'getContext',
  'getOwningComponent',
  'getRootComponents',
  'getInjector',
  'getDirectives',
  'getDirectiveMetadata',
  'getHostElement',
  'getListeners',
  'applyChanges',
] as const satisfies readonly (keyof NgDebugApi)[];

/** Every function {@link NgDebugApi} declares, for the canary test against a real app. */
export const NG_DEBUG_FUNCTIONS = [
  ...NG_DEBUG_REQUIRED,
  'isSignal',
  'enableProfiling',
  'ɵgetDependenciesFromInjectable',
  'ɵgetInjectorProviders',
  'ɵgetInjectorResolutionPath',
  'ɵgetInjectorMetadata',
  'ɵsetProfiler',
  'ɵgetSignalGraph',
  'ɵgetDeferBlocks',
  'ɵgetControlFlowBlocks',
  'ɵgetTransferState',
  'ɵgetComponentInstanceDeepLinkId',
  'ɵgetRouterInstance',
  'ɵgetLoadedRoutes',
  'ɵnavigateByUrl',
] as const satisfies readonly (keyof NgDebugApi)[];

/** `window.ng` when the page is an Angular development build, else `undefined`. */
export function pageDebugApi(): NgDebugApi | undefined {
  const ng = (globalThis as { ng?: unknown }).ng;
  return ng && typeof ng === 'object' ? (ng as NgDebugApi) : undefined;
}
