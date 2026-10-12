// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Injectable,
  InjectionToken,
  inject,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { collectInjectorTree, type DebugNg } from '../injector-tree.ts';
import { markFramework, scanFrameworkNames } from '../rpc/framework-tokens.ts';
import type { InjectorTreeNode } from '../types.ts';

const API_URL = new InjectionToken<string>('API_URL');

class TripStore {
  readonly api = inject(API_URL);
}
Injectable({ providedIn: 'root' })(TripStore);

class TripPage {
  readonly store = inject(TripStore);
}
Component({ selector: 'app-root', template: 'trips' })(TripPage);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('framework providers in a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('marks everything Angular provides and nothing the app provides', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    app.tick();
    const report = collectInjectorTree((globalThis as { ng?: DebugNg }).ng);
    const names = await scanFrameworkNames([process.cwd()]);
    const environment = flatten(markFramework(report.environment, names));

    const platform = environment.find((node) => node.injector.name === 'Platform')!;
    const root = environment.find((node) => node.injector.name === 'Root')!;
    expect(platform.injector.framework).toBe(true);
    expect(root.injector.framework).toBeUndefined();
    expect(platform.providers.every((p) => p.framework)).toBe(true);
    // Root holds about 70 providers from Angular; only the app's own two stay unmarked.
    const unmarked = root.providers.filter((p) => !p.framework).map((p) => p.token);
    expect(unmarked.sort()).toEqual(['API_URL', 'TripStore']);
  });
});
