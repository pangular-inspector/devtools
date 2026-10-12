// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Directive,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication, provideClientHydration } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { afterEach, describe, expect, it } from 'vitest';
import { collectComponentTree, type ComponentDebugNg } from '../component-tree.ts';

class TripBadge {}
Component({ selector: 'app-trip-badge', template: '<b>New</b>' })(TripBadge);

class TripMap {}
Component({ selector: 'app-trip-map', template: '<canvas></canvas>' })(TripMap);

class TripHeading {}
Directive({ selector: 'h1[appTripHeading]:not(.plain)' })(TripHeading);

class TripPage {}
Component({
  selector: 'app-root',
  imports: [TripBadge, TripMap, TripHeading],
  template: '<h1 appTripHeading>Trips</h1><app-trip-badge /><app-trip-map ngSkipHydration />',
})(TripPage);

/**
 * Renders the app the way the server does. The server platform puts its own
 * DOM classes (`Element`, `Node`, ...) on `globalThis`; they are put back
 * afterwards so the client side runs on jsdom's.
 */
async function serverHtml(): Promise<string> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = new Map(Object.getOwnPropertyNames(globals).map((key) => [key, globals[key]]));
  try {
    return await render();
  } finally {
    for (const [key, value] of saved) {
      if (!Object.is(globals[key], value)) globals[key] = value;
    }
  }
}

function render(): Promise<string> {
  return renderApplication(
    (context) =>
      bootstrapApplication(
        TripPage,
        {
          providers: [
            provideServerRendering(),
            provideClientHydration(),
            provideZonelessChangeDetection(),
          ],
        },
        context,
      ),
    { document: '<html><head></head><body><app-root></app-root></body></html>', url: '/' },
  );
}

describe('hydration status with a real server render', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads hydrated and skipped hosts from what Angular records', async () => {
    const html = await serverHtml();
    document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)![1];
    app = await bootstrapApplication(TripPage, {
      providers: [provideClientHydration(), provideZonelessChangeDetection()],
    });
    await app.whenStable();
    const ng = (globalThis as { ng?: ComponentDebugNg }).ng!;
    const tree = collectComponentTree(ng, { hydration: true });
    const [root] = tree.roots;
    expect(document.querySelector('app-root')!.hasAttribute('ng-server-context')).toBe(true);
    expect(root).toMatchObject({ name: 'TripPage', hydration: 'hydrated' });
    expect(root.children.map((node) => [node.name, node.hydration])).toEqual([
      ['TripBadge', 'hydrated'],
      ['TripMap', 'skipped'],
    ]);
    expect(tree.hydration).toMatchObject({
      hydrated: true,
      counts: { hydrated: 2, skipped: 1, mismatched: 0, client: 0 },
      mismatches: [],
    });
  });

  it('reports no hydration for an app rendered only in the browser', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [provideZonelessChangeDetection()],
    });
    await app.whenStable();
    const ng = (globalThis as { ng?: ComponentDebugNg }).ng!;
    const tree = collectComponentTree(ng, { hydration: true, directiveHosts: true });
    expect(tree.count).toBe(3);
    expect(tree.hydration).toBeUndefined();
    expect(tree.roots[0].hydration).toBeUndefined();
    // The element with a directive and no component is a node of its own.
    expect(tree.directiveHostCount).toBe(1);
    expect(tree.roots[0].children[0]).toMatchObject({
      kind: 'directive',
      tag: 'h1',
      name: 'TripHeading',
      directives: ['TripHeading'],
      attributes: ['appTripHeading'],
    });
  });
});
