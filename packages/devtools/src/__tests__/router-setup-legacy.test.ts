// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { routerOf } from '../analog-runtime.ts';
import { findRouter, type RouterDebugApi } from '../router.ts';
import { detectSetup } from '../router-setup.ts';

class Root {}
Component({ selector: 'app-root', template: '' })(Root);

let app: Awaited<ReturnType<typeof bootstrapApplication>>;
let ng: RouterDebugApi;
let util: unknown;

beforeEach(async () => {
  document.body.innerHTML = '<app-root></app-root>';
  app = await bootstrapApplication(Root, {
    providers: [provideZonelessChangeDetection(), provideRouter([{ path: '', component: Root }])],
  });
  const published = (globalThis as { ng?: RouterDebugApi & Record<string, unknown> }).ng!;
  util = published['ɵgetRouterInstance'];
  delete published['ɵgetRouterInstance'];
  ng = {
    getInjector: published.getInjector,
    ɵgetInjectorResolutionPath: published.ɵgetInjectorResolutionPath,
    ɵgetInjectorProviders: published.ɵgetInjectorProviders,
  };
});

afterEach(() => {
  (globalThis as { ng?: Record<string, unknown> }).ng!['ɵgetRouterInstance'] = util;
  app.destroy();
});

it('finds the router of a provideRouter app without ng.ɵgetRouterInstance', () => {
  const roots = [document.querySelector('app-root')!];
  expect(findRouter(ng, roots)).toBe(app.injector.get(Router));
  expect(routerOf(ng as never)).toBe(app.injector.get(Router));
});

it.each(['20.3.4', '20.3.5'])(
  'reports provideRouter from the root ROUTES when the router util is missing on %s',
  (version) => {
    const root = document.querySelector('app-root')!;
    root.setAttribute('ng-version', version);
    expect(detectSetup(ng, app.injector.get(Router) as never, 1, root).setupKind).toBe(
      'provideRouter',
    );
  },
);

it('reports unknown when neither the util nor the providers tell the setup apart', () => {
  const root = document.querySelector('app-root')!;
  root.setAttribute('ng-version', '20.3.4');
  const bare: RouterDebugApi = { ...ng, ɵgetInjectorProviders: () => [] };
  expect(detectSetup(bare, app.injector.get(Router) as never, 1, root).setupKind).toBe('unknown');
});
