import { nameOf, providerOf, read, type AnyRecord, type RouterDebugApi } from './router.ts';

export interface RouterOption {
  name: string;
  value: string;
  set: boolean;
}

export interface RouterSetup {
  mode: 'full' | 'events-only';
  setupKind: 'provideRouter' | 'forRoot or other' | 'unknown';
  routers: number;
  angularVersion?: string;
  options: RouterOption[];
  features: Record<string, string>;
  strategies: Record<string, string>;
  baseHref?: string;
  hydrated?: number;
}

const OPTION_DEFAULTS: [string, string][] = [
  ['onSameUrlNavigation', 'ignore'],
  ['paramsInheritanceStrategy', 'always'],
  ['urlUpdateStrategy', 'deferred'],
  ['canceledNavigationResolution', 'replace'],
  ['defaultQueryParamsHandling', 'replace'],
  ['resolveNavigationPromiseOnError', 'false'],
  ['scrollPositionRestoration', 'disabled'],
  ['anchorScrolling', 'disabled'],
  ['initialNavigation', 'enabledNonBlocking'],
];

function strategyName(value: unknown): string {
  return nameOf(value).replace(/^_+/, '') || 'unknown';
}

export function preloaderOf(ng: RouterDebugApi, root: Element | null): AnyRecord | null {
  const injector = root ? read(() => ng.getInjector?.(root), undefined) : undefined;
  if (!injector) return null;
  return providerOf(ng, injector, 'RouterPreloader', (value) =>
    read(() => !!(value as AnyRecord)?.['preloadingStrategy'], false),
  );
}

function scrollerOf(ng: RouterDebugApi, root: Element | null): AnyRecord | null {
  const injector = root ? read(() => ng.getInjector?.(root), undefined) : undefined;
  if (!injector) return null;
  const accept = (value: unknown) => read(() => !!(value as AnyRecord)?.['options'], false);
  const byClass = providerOf(ng, injector, 'RouterScroller', accept);
  if (byClass) return byClass;
  const record = providersOf(ng, root).find((p) => tokenDescription(p.token) === 'Router Scroller');
  const value = record
    ? read(() => (injector as AnyRecord)['get'](record.token, null) as unknown, null)
    : null;
  return accept(value) ? (value as AnyRecord) : null;
}

/** provideRouter publishes `ng.ɵgetRouterInstance` from Angular 20.3.5. */
export function publishesRouterUtil(version: string | undefined): boolean {
  const [major, minor, patch] = (version ?? '').split('.').map((part) => parseInt(part, 10));
  if (!Number.isFinite(major)) return false;
  if (major !== 20) return major > 20;
  return minor > 3 || (minor === 3 && patch >= 5);
}

const INITIAL_NAVIGATION_MODES = ['enabledBlocking', 'enabledNonBlocking', 'disabled'];

interface ProvidedToken {
  token: unknown;
  provider: unknown;
}

function providersOf(ng: RouterDebugApi, root: Element | null): ProvidedToken[] {
  const injector = root ? read(() => ng.getInjector?.(root), undefined) : undefined;
  if (!injector) return [];
  const path = read(() => ng.ɵgetInjectorResolutionPath?.(injector) ?? [injector], [injector]);
  return path.flatMap((candidate) =>
    read(() => (ng.ɵgetInjectorProviders?.(candidate) ?? []) as ProvidedToken[], []),
  );
}

function tokenDescription(token: unknown): string {
  return read(() => String((token as AnyRecord)['_desc'] ?? ''), '');
}

/**
 * The initial navigation mode from the INITIAL_NAVIGATION token, which
 * withEnabledBlockingInitialNavigation(), withDisabledInitialNavigation() and
 * RouterModule.forRoot() provide (0 blocking, 1 non-blocking, 2 disabled).
 */
function initialNavigationOf(
  ng: RouterDebugApi,
  root: Element | null,
  provided: ProvidedToken[],
): string | undefined {
  const record = provided.find(
    (p) =>
      tokenDescription(p.token) === 'initial navigation' &&
      read(() => 'provide' in (p.provider as AnyRecord), false),
  );
  if (!record || !root) return undefined;
  const injector = read(() => ng.getInjector?.(root) as AnyRecord, null);
  const value = read(() => injector?.['get'](record.token, null) as unknown, null);
  return typeof value === 'number' ? INITIAL_NAVIGATION_MODES[value] : undefined;
}

/**
 * withDebugTracing() adds an ENVIRONMENT_INITIALIZER that logs "Router Event".
 * The provider list leaves those out, so read the injector records instead.
 */
function hasDebugTracing(ng: RouterDebugApi, root: Element | null): boolean {
  const injector = root ? read(() => ng.getInjector?.(root), undefined) : undefined;
  if (!injector) return false;
  const path = read(() => ng.ɵgetInjectorResolutionPath?.(injector) ?? [], [] as unknown[]);
  return path.some((candidate) =>
    read(() => {
      for (const key of ((candidate as AnyRecord)['records'] as Map<unknown, unknown>).keys()) {
        const provider = key as AnyRecord;
        if (
          tokenDescription(provider?.['provide']) === 'ENVIRONMENT_INITIALIZER' &&
          String(provider['useFactory']).includes('Router Event')
        )
          return true;
      }
      return false;
    }, false),
  );
}

export function detectSetup(
  ng: RouterDebugApi,
  router: AnyRecord,
  routers: number,
  root: Element | null,
): RouterSetup {
  const options = read(() => (router['options'] as AnyRecord) ?? {}, {});
  const scroller = scrollerOf(ng, root);
  const scrollOptions = read(() => (scroller?.['options'] as AnyRecord) ?? {}, {});
  const transitions = read(() => router['navigationTransitions'] as AnyRecord, null);
  const initialNavigation = initialNavigationOf(ng, root, providersOf(ng, root));
  const effective: Record<string, unknown> = {
    ...options,
    initialNavigation: initialNavigation ?? options['initialNavigation'],
    onSameUrlNavigation: read(() => router['onSameUrlNavigation'], options['onSameUrlNavigation']),
    paramsInheritanceStrategy: read(
      () => transitions?.['paramsInheritanceStrategy'],
      options['paramsInheritanceStrategy'],
    ),
    urlUpdateStrategy: read(() => router['urlUpdateStrategy'], options['urlUpdateStrategy']),
    scrollPositionRestoration:
      scrollOptions['scrollPositionRestoration'] ?? options['scrollPositionRestoration'],
    anchorScrolling: scrollOptions['anchorScrolling'] ?? options['anchorScrolling'],
  };
  const list: RouterOption[] = OPTION_DEFAULTS.map(([name, fallback]) => {
    const value = effective[name];
    return {
      name,
      value: value === undefined ? fallback : String(value),
      set: options[name] !== undefined || (name === 'initialNavigation' && !!initialNavigation),
    };
  });

  const features: Record<string, string> = {};
  features['componentInputBinding'] = read(() => router['componentInputBindingEnabled'], false)
    ? 'on'
    : 'off';
  features['viewTransitions'] = read(() => !!transitions?.['createViewTransition'], false)
    ? 'on'
    : 'off';
  features['navigationErrorHandler'] = read(() => !!transitions?.['navigationErrorHandler'], false)
    ? 'on'
    : 'off';
  features['routerResources'] = read(() => !!transitions?.['routerResourcesFeature'], false)
    ? 'on'
    : 'off';
  features['injectorCleanup'] = read(() => !!router['injectorCleanup'], false) ? 'on' : 'off';
  const preloader = preloaderOf(ng, root);
  features['preloading'] = preloader
    ? strategyName(read(() => preloader['preloadingStrategy'], null))
    : 'off';
  features['scroller'] = scroller ? 'on' : 'off';
  features['debugTracing'] =
    read(() => !!options['enableTracing'], false) || hasDebugTracing(ng, root) ? 'on' : 'off';
  features['platformNavigation'] = /NavigationStateManager$/.test(
    strategyName(read(() => router['stateManager'], null)),
  )
    ? 'on'
    : 'off';

  const strategies: Record<string, string> = {
    locationStrategy: strategyName(read(() => router['location']['_locationStrategy'], null)),
    titleStrategy: strategyName(read(() => transitions?.['titleStrategy'], null)),
    routeReuseStrategy: strategyName(read(() => router['routeReuseStrategy'], null)),
    urlHandlingStrategy: strategyName(read(() => router['urlHandlingStrategy'], null)),
    urlSerializer: strategyName(read(() => router['urlSerializer'], null)),
  };
  if (/Ionic/i.test(strategies['routeReuseStrategy'])) features['ionic'] = 'detected';

  const version = read(
    () => document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? undefined,
    undefined,
  );
  const setup: RouterSetup = {
    mode: 'full',
    setupKind:
      typeof (globalThis as AnyRecord)['ng']?.['ɵgetRouterInstance'] === 'function'
        ? 'provideRouter'
        : publishesRouterUtil(version)
          ? 'forRoot or other'
          : 'unknown',
    routers,
    options: list,
    features,
    strategies,
  };
  if (version) setup.angularVersion = version;
  const external = read(() => String(router['location']['prepareExternalUrl']('/')), '');
  if (external) setup.baseHref = external;
  const hydrated = read(
    () => (globalThis as AnyRecord)['ngDevMode']?.['hydratedComponents'] as number | undefined,
    undefined,
  );
  if (typeof hydrated === 'number' && hydrated > 0) setup.hydrated = hydrated;
  if (!(ng as AnyRecord)['ɵgetInjectorProviders']) setup.mode = 'events-only';
  return setup;
}
