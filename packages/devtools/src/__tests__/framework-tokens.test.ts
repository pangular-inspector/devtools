import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFrameworkNames,
  frameworkNamesIn,
  markFramework,
  scanFrameworkNames,
} from '../rpc/framework-tokens.ts';
import type { InjectorTreeNode, ProviderInfo } from '../types.ts';

const provider = (token: string): ProviderInfo => ({ token, type: 'class', isViewProvider: false });

const node = (
  injector: Partial<InjectorTreeNode['injector']>,
  tokens: string[] = [],
  children: InjectorTreeNode[] = [],
): InjectorTreeNode => ({
  injector: { id: 'x', type: 'element', name: 'x', providerCount: tokens.length, ...injector },
  providers: tokens.map(provider),
  children,
});

describe('frameworkNamesIn', () => {
  it('reads class names and InjectionToken descriptions the way the collector names them', () => {
    const names = frameworkNamesIn(`
      class ApplicationRef {
      class _ChangeDetectionSchedulerImpl extends ChangeDetectionScheduler {
      const APP_ID = new InjectionToken(typeof ngDevMode !== 'undefined' && ngDevMode ? 'AppId' : '', {
      const ROUTES = new InjectionToken(ngDevMode ? 'ROUTES' : '');
      const SCOPE = new InjectionToken(
        ngDevMode ? 'Set Injector scope.' : '');
      const PLAIN = new InjectionToken('FOREIGN_CONTEXT');
      // This class doesn't provide anything, and new InjectionToken(desc) is dynamic.
    `);
    expect([...names].sort()).toEqual(
      [
        'AppId',
        'ApplicationRef',
        'ChangeDetectionSchedulerImpl',
        'FOREIGN_CONTEXT',
        'ROUTES',
        'Set Injector scope.',
      ].sort(),
    );
  });
});

describe('scanFrameworkNames', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('reads the fesm2022 bundles of every @angular package up the folder tree', async () => {
    dir = mkdtempSync(join(tmpdir(), 'pangular-framework-'));
    const bundle = (pkg: string, file: string, source: string) => {
      const folder = join(dir, 'node_modules', '@angular', pkg, 'fesm2022');
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, file), source);
    };
    bundle('core', 'core.mjs', 'class ApplicationRef {}');
    bundle('router', 'router.mjs', "const R = new InjectionToken('ROUTES');");
    bundle('compiler', 'compiler.mjs', 'class Element {}');
    writeFileSync(
      join(dir, 'node_modules', '@angular', 'core', 'fesm2022', 'core.mjs.map'),
      'class Map {}',
    );
    const app = join(dir, 'apps', 'shop');
    mkdirSync(app, { recursive: true });

    const names = await scanFrameworkNames([app]);
    expect(names.has('ApplicationRef')).toBe(true);
    expect(names.has('ROUTES')).toBe(true);
    // The compiler provides nothing at runtime, and source maps are not bundles.
    expect(names.has('Element')).toBe(false);
    expect(names.has('Map')).toBe(false);
  });

  it('finds nothing when no Angular package is installed', async () => {
    dir = mkdtempSync(join(tmpdir(), 'pangular-framework-'));
    expect((await scanFrameworkNames([dir])).size).toBe(0);
  });

  it('reads the installed Angular packages of this repository', async () => {
    const names = await scanFrameworkNames([process.cwd()]);
    for (const name of ['ApplicationRef', 'NgZone', 'Router', 'HttpClient', 'Platform ID']) {
      expect(names.has(name), name).toBe(true);
    }
  });
});

describe('markFramework', () => {
  const names = new Set(['ApplicationRef', 'NgZone', 'RouterOutlet', 'HttpClient', 'NgModel']);

  it('marks framework providers and keeps the app ones unmarked', () => {
    const [root] = markFramework(
      [node({ type: 'environment', name: 'Root' }, ['ApplicationRef', 'TripStore'])],
      names,
    );
    expect(root!.providers).toEqual([
      { ...provider('ApplicationRef'), framework: true },
      provider('TripStore'),
    ]);
    // Root holds the app's root services, so it is never a framework injector.
    expect(root!.injector.framework).toBeUndefined();
  });

  it('marks the Platform injector and environment injectors that only hold Angular providers', () => {
    const [platform] = markFramework(
      [
        node(
          { type: 'environment', name: 'Platform' },
          ['Console'],
          [
            node({ type: 'environment', name: 'Root' }, ['NgZone']),
            node({ type: 'environment', name: 'Route: admin' }, ['HttpClient']),
            node({ type: 'environment', name: 'Route: shop' }, ['HttpClient', 'CartStore']),
          ],
        ),
      ],
      names,
    );
    expect(platform!.injector.framework).toBe(true);
    expect(platform!.children.map((child) => child.injector.framework ?? false)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('marks element injectors whose only directives come from Angular, never a component', () => {
    const marked = markFramework(
      [
        node({ name: 'router-outlet', directives: ['RouterOutlet'] }),
        node({ name: 'input', directives: ['NgModel', 'AutoFocus'] }),
        node({ name: 'app-root', component: 'App', directives: ['App'] }),
        node({ name: 'div', directives: ['RouterOutlet'] }, ['TripStore']),
      ],
      names,
    );
    expect(marked.map((entry) => entry.injector.framework ?? false)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('drops flags the page sent and leaves the input untouched', () => {
    const input = [
      {
        ...node({ type: 'environment', name: 'Route: x', framework: true }, ['TripStore']),
        providers: [{ ...provider('TripStore'), framework: true }],
      },
    ];
    const [marked] = markFramework(input, names);
    expect(marked!.injector.framework).toBeUndefined();
    expect(marked!.providers[0]!.framework).toBeUndefined();
    expect(input[0]!.injector.framework).toBe(true);
  });
});

describe('createFrameworkNames', () => {
  it('scans once, in the background, and reports when the names are ready', async () => {
    const onLoaded = vi.fn();
    const starts = vi.fn(() => [process.cwd()]);
    const framework = createFrameworkNames(starts, onLoaded);
    expect(framework.current()).toBeNull();
    expect(framework.current()).toBeNull();
    const names = await framework.load();
    expect(framework.current()).toBe(names);
    expect(starts).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});
