import { APP_BASE_HREF } from '@angular/common';
import type { TestModuleMetadata } from '@angular/core/testing';
import * as router from '@angular/router';
import type { Routes } from '@angular/router';
import { angularAtLeast } from './angular-version.ts';

type Feature = (...args: never[]) => unknown;

const api = router as unknown as Record<string, unknown>;

/**
 * A router function by name, or undefined on a version without it, for tests
 * that run on every version the compat workflow installs.
 */
export function routerApi<T = Feature>(name: string): T | undefined {
  const value = api[name];
  return typeof value === 'function' ? (value as T) : undefined;
}

/**
 * The TestBed setup for `routes`: `provideRouter` with `features` from 14.2,
 * `RouterModule.forRoot` before (where `features` must be empty).
 */
export function routerTestModule(routes: Routes, ...features: unknown[]): TestModuleMetadata {
  const provideRouter =
    routerApi<(routes: Routes, ...features: unknown[]) => unknown>('provideRouter');
  if (provideRouter) return { providers: [provideRouter(routes, ...features) as never] };
  if (features.length) throw new Error('Router features need provideRouter (Angular 14.2+)');
  return {
    imports: [router.RouterModule.forRoot(routes)],
    providers: [{ provide: APP_BASE_HREF, useValue: '/' }],
  };
}

/** Functional guards and resolvers, and `provideRouter`, exist from 14.2. */
export const functionalRouter = angularAtLeast('14.2');

/**
 * The overlay reads providers and environment injectors through
 * `ɵgetInjectorProviders`, which Angular publishes from 16.2. Before it the
 * router setup is reported in `events-only` mode.
 */
export const injectorProviders = angularAtLeast('16.2');
