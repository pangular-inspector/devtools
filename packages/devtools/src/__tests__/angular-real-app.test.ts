// @vitest-environment jsdom
// A small real app on whichever Angular is installed (the compat workflow runs
// this file on 12.2, 15.2, 17.3, 19.2, 20.0, 21 and 22): an NgModule app before
// 14.0, which has no standalone components, and a standalone app from 14.0. It
// checks that the page reports the debug API docs/angular-compat.md lists for
// that version, and that each collector gives data or its documented fallback.
import '@angular/compiler';
import * as core from '@angular/core';
import {
  Component,
  Directive,
  Injectable,
  NgModule,
  Pipe,
  type ApplicationRef,
} from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { BrowserModule, platformBrowser } from '@angular/platform-browser';
import * as browser from '@angular/platform-browser';
import { RouterModule, type Routes } from '@angular/router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProfilerListener } from '../change-detection.ts';
import { collectComponentTree, selectedComponentDetail } from '../component-tree.ts';
import { ANGULAR_FEATURE_NEEDS, angularVersionAtLeast, type AngularCapability } from '../config.ts';
import { createDeferTracker } from '../defer-blocks.ts';
import { elementId } from '../element-id.ts';
import { createForTracker } from '../for-blocks.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import { detectAngular } from '../ng-capabilities.ts';
import { scanPipeViews } from '../pipes-runtime.ts';
import { findRouters, snapshotRouter, type RouterDebugApi } from '../router.ts';
import { collectSignalGraph } from '../signal-graph.ts';
import { angularAtLeast, STANDALONE, zonelessProviders } from './angular-version.ts';
import { NG_UTILS, ngUtilsOf } from './ng-shapes.ts';

const version = core.VERSION.full;
const minor = `${core.VERSION.major}.${core.VERSION.minor}`;
const standalone = angularAtLeast('14.0');

class TripService {
  readonly trips = ['lisbon', 'porto'];
}
Injectable({ providedIn: 'root' })(TripService);

class TripTitlePipe {
  transform(value: string): string {
    return value.toUpperCase();
  }
}
Pipe({ ...STANDALONE, name: 'tripTitle' })(TripTitlePipe);

class Tooltip {}
Directive({ ...STANDALONE, selector: '[appTooltip]' })(Tooltip);

const signal = (core as unknown as { signal?: <T>(value: T) => () => T }).signal;

class TripCard {
  trip = '';
  // A signal from 16.0, so the signal graph has a node to report; a getter before.
  readonly seats = signal ? signal(2) : () => 2;
}
Component({
  ...STANDALONE,
  selector: 'app-trip-card',
  inputs: ['trip'],
  ...(standalone ? { imports: [TripTitlePipe] } : {}),
  template: '<h2>{{ trip | tripTitle }}</h2><p>{{ seats() }} seats</p>',
})(TripCard);

class TripsPage {}
Component({ ...STANDALONE, selector: 'app-trips', template: '<p>Trips</p>' })(TripsPage);

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trips' },
  { path: 'trips', component: TripsPage },
];

class App {
  title = 'Trips';
  // An injected service, so the injector tree has a dependency to list.
  constructor(readonly trips: TripService) {}
}
Component({
  ...STANDALONE,
  selector: 'app-root',
  ...(standalone ? { imports: [CommonModule, RouterModule, TripCard, Tooltip] } : {}),
  template: `
    <main>
      <app-trip-card appTooltip [trip]="title"></app-trip-card>
      <a routerLink="/trips">Trips</a>
      <router-outlet></router-outlet>
    </main>
  `,
})(App);
// What the CLI emits for constructor injection, which JIT cannot read from types.
(App as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
  { type: TripService },
];

class AppModule {}

async function bootstrap(): Promise<{ app: ApplicationRef; destroy: () => void }> {
  if (standalone) {
    const bootstrapApplication = (
      browser as unknown as {
        bootstrapApplication: (type: unknown, config: unknown) => Promise<ApplicationRef>;
      }
    ).bootstrapApplication;
    const importProvidersFrom = (
      core as unknown as { importProvidersFrom: (m: unknown) => unknown }
    ).importProvidersFrom;
    const app = await bootstrapApplication(App, {
      providers: [
        ...zonelessProviders(),
        { provide: APP_BASE_HREF, useValue: '/' },
        importProvidersFrom(RouterModule.forRoot(routes, { initialNavigation: 'enabledBlocking' })),
      ],
    });
    return { app, destroy: () => app.destroy() };
  }
  NgModule({
    imports: [
      BrowserModule,
      RouterModule.forRoot(routes, { initialNavigation: 'enabledBlocking' } as never),
    ],
    declarations: [App, TripCard, Tooltip, TripTitlePipe, TripsPage],
    providers: [{ provide: APP_BASE_HREF, useValue: '/' }],
    bootstrap: [App],
  })(AppModule);
  const ref = await platformBrowser().bootstrapModule(AppModule);
  // `ApplicationRef.destroy()` exists from 14.1; the module ref tears the app down before.
  return { app: ref.injector.get(core.ApplicationRef), destroy: () => ref.destroy() };
}

type Ng = Record<string, unknown>;

describe(`a real Angular ${version} app`, () => {
  let app: ApplicationRef;
  let destroy: () => void;
  let ng: Ng;
  let root: Element;

  beforeAll(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    ({ app, destroy } = await bootstrap());
    app.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
    ng = (globalThis as { ng?: Ng }).ng!;
    root = document.querySelector('app-root')!;
  });

  afterAll(() => {
    destroy();
    document.body.innerHTML = '';
  });

  it('publishes the window.ng utils docs/angular-compat.md lists for this version', () => {
    const expected = ngUtilsOf(minor);
    // `ɵgetRouterInstance` comes from `provideRouter`, which this app does not use.
    const checked = Object.values(NG_UTILS)
      .flat()
      .filter((name) => name !== 'ɵgetRouterInstance');
    const have = checked.filter((name) => typeof ng[name] === 'function');
    expect(have.sort()).toEqual(expected.filter((name) => checked.includes(name)).sort());
  });

  it('reports the capabilities config.ts names for this version', () => {
    const info = detectAngular(ng, document);
    expect(info.version).toBe(version);
    const expected: Partial<Record<AngularCapability, boolean>> = {
      debugApi: true,
      injectorProviders: angularAtLeast('16.2'),
      injectorMetadata: angularAtLeast('17.0'),
      isSignal: angularAtLeast('17.1'),
      // The util exists from 19.1; its nodes carry ids from 20.1 (see below).
      signalGraph: angularAtLeast('19.1'),
      deferBlocks: angularAtLeast('19.1'),
      forBlocks: angularAtLeast('22.0'),
      profiler: angularAtLeast('20.0'),
      angularProfiling: angularAtLeast('20.0'),
      routerInstance: false,
    };
    expect(info.capabilities).toEqual(expected);
    // The panel and the agent tools name the same first versions.
    for (const name of [
      'injectorProviders',
      'injectorMetadata',
      'isSignal',
      'deferBlocks',
    ] as const) {
      expect(angularVersionAtLeast(version, ANGULAR_FEATURE_NEEDS[name].since), name).toBe(
        expected[name],
      );
    }
  });

  it('lists the component tree and reads the selected component', () => {
    const tree = collectComponentTree(ng as never, {});
    expect(tree.roots.map((node) => node.name)).toEqual(['App']);
    const names = (nodes: typeof tree.roots): string[] =>
      nodes.flatMap((node) => [node.name, ...names(node.children)]);
    expect(names(tree.roots)).toEqual(['App', 'TripCard', 'TripsPage']);
    const card = document.querySelector('app-trip-card')!;
    const detail = selectedComponentDetail(ng as never, { selectedId: elementId(card) });
    expect(detail?.name).toBe('TripCard');
    expect(detail?.inputs.map((input) => input.name)).toEqual(['trip']);
    expect(detail?.directives.map((directive) => directive.name)).toContain('Tooltip');
  });

  it('lists the injector tree as far as this version allows', () => {
    const report = collectInjectorTree(ng as never);
    const [appNode] = report.roots;
    expect(appNode?.injector).toMatchObject({ type: 'element', component: 'App' });
    const services = appNode!.providers.map((provider) => provider.token);
    if (angularAtLeast('17.0')) {
      expect(report.environment.length).toBeGreaterThan(0);
      expect(appNode!.injector.path?.length).toBeGreaterThan(0);
    } else if (angularAtLeast('16.2')) {
      expect(report.environment.length).toBeGreaterThan(0);
    } else {
      // 12.0 to 16.1: element injectors with their components and directives only.
      expect(report.environment).toEqual([]);
      expect(appNode!.injector.path).toEqual([]);
      expect(services).toEqual([]);
    }
    const card = appNode!.children.find((child) => child.injector.component === 'TripCard');
    expect(card?.injector.directives).toEqual(['TripCard', 'Tooltip']);
  });

  it('finds the Router and reads the active route on every version', () => {
    const routers = findRouters(ng as RouterDebugApi, [root]);
    expect(routers).toHaveLength(1);
    const snapshot = snapshotRouter(routers[0]!);
    expect(snapshot?.url).toBe('/trips');
  });

  it('attributes pipe usages to the component that declares them', () => {
    const { usages } = scanPipeViews(ng as never, document.querySelectorAll('*'));
    const usage = usages.find((each) => each.name === 'tripTitle');
    expect(usage?.component).toBeInstanceOf(TripCard);
  });

  it('gives no signal graph, defer or @for data where the version lacks the util', () => {
    const card = document.querySelector('app-trip-card')!;
    const graph = collectSignalGraph(ng as never, { id: elementId(card) }, document);
    if (angularAtLeast('20.1')) {
      expect(graph?.unsupported).toBeFalsy();
      expect(graph?.component?.name).toBe('TripCard');
      expect(graph?.nodes.length).toBeGreaterThan(0);
    } else if (angularAtLeast('19.1')) expect(graph?.unsupported).toBe(true);
    else expect(graph).toBeNull();

    const defer = createDeferTracker().collect(ng as never, document);
    expect(defer).toEqual(angularAtLeast('19.1') ? [] : undefined);
    const forBlocks = createForTracker().collect(ng as never, document);
    expect(forBlocks).toEqual(angularAtLeast('22.0') ? { forBlocks: [] } : undefined);
  });

  it('leaves the profiler slot alone before 20.0', () => {
    const remove = addProfilerListener(ng, () => {}, document);
    expect(typeof remove).toBe(angularAtLeast('20.0') ? 'function' : 'object');
    remove?.();
  });
});
