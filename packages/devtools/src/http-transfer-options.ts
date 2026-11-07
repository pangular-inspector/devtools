import * as angularHttp from '@angular/common/http';
import type { HttpTransferCacheOptions } from '@angular/common/http';
import {
  APP_BOOTSTRAP_LISTENER,
  InjectionToken,
  inject,
  provideEnvironmentInitializer,
  type Provider,
} from '@angular/core';

export type { HttpTransferCacheOptions };

/**
 * The transfer cache options passed to `withPangular({ transferCache })`. The
 * interceptor reads them to explain why a request was or was not cached. Not
 * provided without options, which means Angular's defaults.
 */
export const PANGULAR_TRANSFER_CACHE = new InjectionToken<HttpTransferCacheOptions>(
  'PANGULAR_TRANSFER_CACHE',
);

const devMode = () => !!(globalThis as { ngDevMode?: unknown }).ngDevMode;

/**
 * Angular's private `CACHE_OPTIONS` token, the one its transfer cache
 * interceptor and `provideClientHydration()` read. Angular doesn't export it,
 * so it is the token of the factory provider `ɵwithHttpTransferCache()`
 * returns (checked against `@angular/common/fesm2022/http.mjs`, Angular 22):
 * the one that is not the interceptor or the bootstrap listener.
 */
export function angularCacheOptionsToken(): InjectionToken<Record<string, unknown>> | null {
  // Read through the namespace, so a version without these exports gets null, not a link error.
  const http = angularHttp as unknown as {
    ɵwithHttpTransferCache?: (options: object) => unknown[];
    ɵHTTP_ROOT_INTERCEPTOR_FNS?: unknown;
  };
  let providers: unknown[];
  try {
    providers = http.ɵwithHttpTransferCache?.({}) ?? [];
  } catch {
    return null;
  }
  for (const provider of providers) {
    const token = (provider as { provide?: unknown } | null)?.provide;
    if (
      token instanceof InjectionToken &&
      token !== http.ɵHTTP_ROOT_INTERCEPTOR_FNS &&
      token !== APP_BOOTSTRAP_LISTENER &&
      'useFactory' in (provider as object)
    ) {
      return token as InjectionToken<Record<string, unknown>>;
    }
  }
  return null;
}

/**
 * Copies the options onto the options object Angular's transfer cache uses.
 * Whichever provider set it up (`provideClientHydration()` or
 * `withHttpTransferCacheOptions()`), and in whatever order the providers come,
 * the cache then runs with these options. Without hydration there is no cache
 * to configure, so nothing changes.
 */
function applyToAngularCache(options: HttpTransferCacheOptions): void {
  const token = angularCacheOptionsToken();
  const cache = token ? inject(token, { optional: true }) : null;
  if (!cache) {
    if (devMode()) {
      console.warn(
        '[Pangular Inspector] withPangular({ transferCache }) found no HTTP transfer cache. Add provideClientHydration() so the options take effect.',
      );
    }
    return;
  }
  // `isCacheActive` stays Angular's: it turns the cache off once the app is stable.
  const { isCacheActive: _ignored, ...rest } = options as HttpTransferCacheOptions & {
    isCacheActive?: unknown;
  };
  Object.assign(cache, rest);
}

/** The providers `withPangular({ transferCache })` adds next to its interceptor. */
export function transferCacheProviders(options: HttpTransferCacheOptions): Provider[] {
  return [
    { provide: PANGULAR_TRANSFER_CACHE, useValue: options },
    provideEnvironmentInitializer(() => applyToAngularCache(options)) as unknown as Provider,
  ];
}
