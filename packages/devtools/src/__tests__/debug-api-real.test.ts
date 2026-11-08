// @vitest-environment jsdom
import '@angular/compiler';
import { Component, type ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { NG_DEBUG_FUNCTIONS, NG_DEBUG_REQUIRED, pageDebugApi } from '../debug-api.ts';
import { STANDALONE, angularAtLeast, zonelessProviders } from './angular-version.ts';

class DebugRoot {}
Component({ ...STANDALONE, selector: 'app-root', template: '<p>ok</p>' })(DebugRoot);

// `bootstrapApplication` and standalone components arrive in 14.0.
describe.runIf(angularAtLeast('14.0'))('NgDebugApi against a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('has every required function, and declares every function Angular publishes', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(DebugRoot, { providers: [...zonelessProviders()] });
    const ng = pageDebugApi();
    expect(ng).toBeDefined();
    for (const name of NG_DEBUG_REQUIRED) expect(typeof ng![name], name).toBe('function');
    const published = Object.keys(ng!).filter(
      (name) => typeof (ng as unknown as Record<string, unknown>)[name] === 'function',
    );
    // A function Angular adds or renames shows up here, so the type follows it. The
    // list was checked on 22.1; older versions in the compat run check the required part.
    const known: readonly string[] = NG_DEBUG_FUNCTIONS;
    if (angularAtLeast('22.0'))
      expect(published.filter((name) => !known.includes(name))).toEqual([]);
    const root = document.querySelector('app-root')!;
    expect(ng!.getComponent(root)).toBeInstanceOf(DebugRoot);
    expect(ng!.getHostElement(ng!.getComponent<object>(root)!)).toBe(root);
  });
});
