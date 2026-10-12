// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Directive,
  provideZonelessChangeDetection,
  signal,
  ɵsetClassDebugInfo,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { angularAtLeast } from './angular-version.ts';

/**
 * Every private (`ɵ`) and public debug symbol the collectors read from the
 * running Angular. A rename or removal fails here first, by name, instead of
 * as an empty inspector. Symbols with a version are optional before it, and
 * the collectors fall back or report that the page has no data.
 */

/** `window.ng` utils every supported version (Angular 20.0+) publishes. */
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
  'isSignal',
  // injector-tree, router, router-setup, ngrx-collector, forms-webmcp
  'ɵgetInjectorProviders',
  'ɵgetInjectorResolutionPath',
  'ɵgetInjectorMetadata',
  'ɵgetDependenciesFromInjectable',
  // change-detection, cd-overlay
  'ɵsetProfiler',
  // signal-graph
  'ɵgetSignalGraph',
] as const;

/**
 * Utils that exist only from a given version, or only up to one. Each entry
 * names the version that brought it in (`since`) or took it out (`until`).
 */
const VERSIONED_NG_UTILS = [
  // defer-blocks: renamed from `ɵgetDeferBlocks` in Angular 22.0.
  { name: 'ɵgetControlFlowBlocks', since: '22.0.0' },
  { name: 'ɵgetDeferBlocks', until: '22.0.0' },
  // router: provideRouter publishes it since Angular 20.3.5; before that the
  // overlay finds the Router through `ɵgetInjectorProviders`.
  { name: 'ɵgetRouterInstance', since: '20.3.5' },
] as const;

class TripBadge {}
Directive({ selector: '[appTripBadge]' })(TripBadge);

class TripCard {
  tripId = '';
  readonly selected = signal(false);
}
Component({
  selector: 'app-trip-card',
  imports: [TripBadge],
  inputs: [{ name: 'tripId', alias: 'trip' }],
  template: '<span appTripBadge>Trip</span>',
})(TripCard);
ɵsetClassDebugInfo(TripCard, {
  className: 'TripCard',
  filePath: 'src/app/trip-card.ts',
  lineNumber: 12,
});

class TripPage {}
Component({
  selector: 'app-root',
  imports: [TripCard],
  template: '<app-trip-card trip="lisbon" />',
})(TripPage);

type Ng = Record<string, unknown>;
type Def = Record<string, unknown>;

describe('private API canary', () => {
  let app: ApplicationRef;
  let ng: Ng;

  beforeAll(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    app.tick();
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

  it('ɵsetProfiler hands back a remover (Angular 20.0+)', () => {
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
    // component-source, router: debugInfo set by ɵsetClassDebugInfo in dev builds
    expect(cmp!['debugInfo']).toMatchObject({
      className: 'TripCard',
      filePath: 'src/app/trip-card.ts',
      lineNumber: 12,
    });
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
    expect((ng['isSignal'] as (v: unknown) => boolean)((card as TripCard).selected)).toBe(true);

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

    // pipes-runtime: after getComponent, __ngContext__ is an LContext with an lView array.
    const context = (host as unknown as { __ngContext__?: { lView?: unknown } }).__ngContext__;
    expect(Array.isArray(context?.lView)).toBe(true);
  });
});
