// @vitest-environment jsdom
import '@angular/compiler';
import { APP_BASE_HREF } from '@angular/common';
import * as core from '@angular/core';
import { Component, Directive } from '@angular/core';
import { RouterModule } from '@angular/router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  angularAtLeast,
  bootstrapRoot,
  writableSignal,
  STANDALONE,
  type BootedApp,
} from './angular-version.ts';
import { routerApi } from './router-testing.ts';

/**
 * Every private (`ɵ`) and public debug symbol the collectors read from the
 * running Angular. A rename or removal fails here first, by name, instead of
 * as an empty inspector. Symbols with a version are optional before it, and
 * the collectors fall back or report that the page has no data.
 */

/** `window.ng` utils every supported version (Angular 12.0+) publishes. */
const REQUIRED_NG_UTILS = [
  // component-tree, forms, pipes-runtime, signal-graph, cd-overlay, router
  'getComponent',
  'getDirectives',
  'getInjector',
  'getHostElement',
  'getOwningComponent',
  'getListeners',
  'getDirectiveMetadata',
  'getRootComponents',
  'applyChanges',
  // change-detection, cd-overlay
  'ɵsetProfiler',
] as const;

/**
 * Utils that exist only from a given version, or only up to one. Each entry
 * names the version that brought it in (`since`) or took it out (`until`), as
 * docs/angular-compat.md lists them.
 */
const VERSIONED_NG_UTILS = [
  // injector-tree, router, router-setup, ngrx-collector, forms-webmcp
  { name: 'ɵgetInjectorProviders', since: '16.2.0' },
  { name: 'ɵgetInjectorResolutionPath', since: '16.2.0' },
  { name: 'ɵgetDependenciesFromInjectable', since: '16.2.0' },
  { name: 'ɵgetInjectorMetadata', since: '17.0.0' },
  // component-tree, component-values, signal-graph
  { name: 'isSignal', since: '17.1.0' },
  // signal-graph
  { name: 'ɵgetSignalGraph', since: '19.1.0' },
  // cd-live
  { name: 'enableProfiling', since: '20.0.0' },
  // defer-blocks: renamed from `ɵgetDeferBlocks` in Angular 22.0.
  { name: 'ɵgetControlFlowBlocks', since: '22.0.0' },
  { name: 'ɵgetDeferBlocks', since: '19.1.0', until: '22.0.0' },
  // router: provideRouter publishes it since Angular 20.3.5; before that the
  // overlay finds the Router through `ɵgetInjectorProviders`.
  { name: 'ɵgetRouterInstance', since: '20.3.5' },
] as const;

class TripBadge {}
Directive({ ...STANDALONE, selector: '[appTripBadge]' })(TripBadge);

class TripCard {
  tripId = '';
  readonly selected = writableSignal(false);
}
Component({
  ...STANDALONE,
  selector: 'app-trip-card',
  imports: [TripBadge],
  // The string form; the object form of inputs exists from 16.0.
  inputs: ['tripId: trip'],
  template: '<span appTripBadge>Trip</span>',
})(TripCard);
// Dev builds record where a component is declared from 17.0.
const setClassDebugInfo = (core as unknown as Record<string, unknown>)['ɵsetClassDebugInfo'] as
  ((type: unknown, info: unknown) => void) | undefined;
setClassDebugInfo?.(TripCard, {
  className: 'TripCard',
  filePath: 'src/app/trip-card.ts',
  lineNumber: 12,
});

class TripPage {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripCard],
  template: '<app-trip-card trip="lisbon"></app-trip-card>',
})(TripPage);

type Ng = Record<string, unknown>;
type Def = Record<string, unknown>;

describe('private API canary', () => {
  let app: BootedApp;
  let ng: Ng;

  beforeAll(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    // provideRouter publishes ɵgetRouterInstance; before 14.2 there is only forRoot.
    const provideRouter =
      routerApi<(routes: unknown[]) => core.EnvironmentProviders>('provideRouter');
    app = await bootstrapRoot(TripPage, {
      declarations: [TripCard, TripBadge],
      providers: [
        { provide: APP_BASE_HREF, useValue: '/' },
        ...(provideRouter ? [provideRouter([])] : []),
      ],
      modules: provideRouter ? [] : [RouterModule.forRoot([])],
    });
    app.appRef.tick();
    ng = (globalThis as { ng?: Ng }).ng!;
  });

  afterAll(() => {
    app.destroy();
    document.body.innerHTML = '';
  });

  it.each(REQUIRED_NG_UTILS)('window.ng.%s is a function', (name) => {
    expect(typeof ng[name], `ng.${name}`).toBe('function');
  });

  it.each(VERSIONED_NG_UTILS)('window.ng.$name matches its version range', (entry) => {
    const expected =
      ('since' in entry ? angularAtLeast(entry.since) : true) &&
      ('until' in entry ? !angularAtLeast(entry.until) : true);
    expect(typeof ng[entry.name] === 'function', `ng.${entry.name}`).toBe(expected);
  });

  // Before 20.0 setting a profiler evicts the one in place, so the overlay never calls it.
  it.runIf(angularAtLeast('20.0'))('ɵsetProfiler hands back a remover (Angular 20.0+)', () => {
    const remove = (ng['ɵsetProfiler'] as (fn: () => void) => unknown)(() => {});
    expect(typeof remove).toBe('function');
    (remove as () => void)();
  });

  it('component and directive definitions keep the fields the collectors read', () => {
    const cmp = (TripCard as unknown as { ɵcmp?: Def }).ɵcmp;
    expect(cmp, 'TripCard.ɵcmp').toBeDefined();
    // overlay-angular-native-views, overlay-nativescript-views: selectors[0][0]
    expect((cmp!['selectors'] as unknown[][])[0][0]).toBe('app-trip-card');
    // router-config, router-links: inputs keyed by public name
    expect(Object.keys(cmp!['inputs'] as object)).toContain('trip');
    // component-source, router: debugInfo set by ɵsetClassDebugInfo in dev builds (17.0+)
    if (setClassDebugInfo) {
      expect(cmp!['debugInfo']).toMatchObject({
        className: 'TripCard',
        filePath: 'src/app/trip-card.ts',
        lineNumber: 12,
      });
    } else {
      expect(cmp!['debugInfo']).toBeUndefined();
    }
    // forms: ɵdir.selectors
    const dir = (TripBadge as unknown as { ɵdir?: Def }).ɵdir;
    expect((dir!['selectors'] as unknown[][])[0]).toContain('appTripBadge');
  });

  it('the debug utils return the shapes the collectors read', () => {
    const host = document.querySelector('app-trip-card')!;
    const getComponent = ng['getComponent'] as (el: Element) => unknown;
    const card = getComponent(host);
    expect(card).toBeInstanceOf(TripCard);
    expect((card as TripCard).tripId).toBe('lisbon');
    expect((ng['getHostElement'] as (c: unknown) => unknown)(card)).toBe(host);
    const span = host.querySelector('span')!;
    expect((ng['getDirectives'] as (el: Element) => unknown[])(span)[0]).toBeInstanceOf(TripBadge);
    expect((ng['getOwningComponent'] as (el: Element) => unknown)(span)).toBe(card);
    if (angularAtLeast('17.1')) {
      expect((ng['isSignal'] as (v: unknown) => boolean)((card as TripCard).selected)).toBe(true);
    }

    // pipes-runtime: 12.x and 13.x patch the LView array onto the node; from 14.0
    // it is a view id that getComponent upgrades to an LContext with an lView.
    const context = (host as unknown as { __ngContext__?: unknown }).__ngContext__;
    if (angularAtLeast('14.0')) {
      expect(Array.isArray((context as { lView?: unknown })?.lView)).toBe(true);
    } else {
      const lView = Array.isArray(context) ? context : (context as { lView?: unknown })?.lView;
      expect(Array.isArray(lView)).toBe(true);
    }
    if (!angularAtLeast('17.0')) return;

    const injector = (ng['getInjector'] as (el: Element) => unknown)(host);
    const meta = (ng['ɵgetInjectorMetadata'] as (i: unknown) => { type: string } | null)(injector);
    expect(meta?.type).toBe('element');
    const path = (ng['ɵgetInjectorResolutionPath'] as (i: unknown) => unknown[])(injector);
    expect(path.length).toBeGreaterThan(1);
    const types = path.map(
      (each) => (ng['ɵgetInjectorMetadata'] as (i: unknown) => { type: string } | null)(each)?.type,
    );
    expect(types).toContain('environment');
    const providers = (ng['ɵgetInjectorProviders'] as (i: unknown) => { token: unknown }[])(
      path.find((_, i) => types[i] === 'environment'),
    );
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0]).toHaveProperty('token');
  });
});
