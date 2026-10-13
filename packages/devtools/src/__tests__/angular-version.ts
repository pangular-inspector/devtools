import '@angular/compiler';
import * as core from '@angular/core';
import { CommonModule as commonModule, DOCUMENT } from '@angular/common';
import { TestBed, TestComponentRenderer } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

const { VERSION } = core;

export function angularAtLeast(version: string): boolean {
  const have = VERSION.full.split(/[.-]/).map((part) => parseInt(part, 10));
  const want = version.split('.').map((part) => parseInt(part, 10));
  for (let i = 0; i < want.length; i++) {
    if ((have[i] || 0) !== want[i]) return (have[i] || 0) > want[i];
  }
  return true;
}

/** The installed Angular major, for tests that compare against a version table. */
export const angularMajor = parseInt(VERSION.major, 10);

/** What `DOMTestComponentRenderer` of `@angular/platform-browser-dynamic/testing` does. */
class DomTestComponentRenderer extends TestComponentRenderer {
  private readonly roots: Element[] = [];
  override insertRootElement(rootElId: string): void {
    this.removeAllRootElements();
    const root = document.createElement('div');
    root.setAttribute('id', rootElId);
    document.body.appendChild(root);
    this.roots.push(root);
  }
  override removeAllRootElements(): void {
    for (const root of this.roots.splice(0)) root.remove();
  }
}

/**
 * Starts TestBed on any Ivy version. Before 19.0 the browser testing platform
 * is built on `platformCore`, so it has no JIT compiler options, no `DOCUMENT`
 * and no component renderer: apps on those versions used
 * `platformBrowserDynamicTesting`. They are added here instead of installing
 * `@angular/platform-browser-dynamic`.
 */
export function initAngularTestBed(): void {
  let testingModule: unknown = BrowserTestingModule;
  const extra: core.StaticProvider[] = [];
  if (!angularAtLeast('19.0')) {
    extra.push(
      { provide: core.COMPILER_OPTIONS, useValue: {}, multi: true },
      { provide: DOCUMENT, useFactory: () => document, deps: [] },
    );
    class LegacyBrowserTestingModule {}
    core.NgModule({
      exports: [BrowserTestingModule],
      providers: [{ provide: TestComponentRenderer, useClass: DomTestComponentRenderer }],
    })(LegacyBrowserTestingModule);
    testingModule = LegacyBrowserTestingModule;
  }
  try {
    TestBed.initTestEnvironment(
      testingModule as typeof BrowserTestingModule,
      platformBrowserTesting(extra),
    );
  } catch {
    // already initialized in this worker
  }
}

type AnyCore = Record<string, unknown>;

/**
 * Zoneless change detection where Angular has it (18.0 experimental, 20.0
 * stable). Older versions run on zone.js, which `zone-setup.ts` loads for them.
 */
export function zonelessProviders(): core.EnvironmentProviders[] {
  const api = core as unknown as AnyCore;
  const provide = (api['provideZonelessChangeDetection'] ??
    api['provideExperimentalZonelessChangeDetection']) as
    (() => core.EnvironmentProviders) | undefined;
  return provide ? [provide()] : [];
}

/**
 * Decorator options that make a JIT component or directive standalone. From
 * 19.0 that is the default; 14.0 to 18.x need the flag.
 */
export const STANDALONE: { standalone?: true } = angularAtLeast('19.0') ? {} : { standalone: true };

/** A bootstrapped test app: its root injector and how to tear it down. */
export interface BootedApp {
  injector: core.Injector;
  appRef: core.ApplicationRef;
  destroy(): void;
}

/**
 * Bootstraps `root` the way an app on the installed version would:
 * `bootstrapApplication` from 14.1 (with zoneless change detection where
 * Angular has it), an NgModule before. `modules` are NgModules such as
 * `RouterModule.forRoot(...)`, imported into the app either way.
 */
export async function bootstrapRoot(
  root: core.Type<unknown>,
  options: {
    providers?: (core.Provider | core.EnvironmentProviders)[];
    modules?: unknown[];
    /** Components, directives and pipes `root` uses, declared with it before 14.0. */
    declarations?: core.Type<unknown>[];
  } = {},
): Promise<BootedApp> {
  const browser = (await import('@angular/platform-browser')) as unknown as Record<string, unknown>;
  const api = core as unknown as AnyCore;
  const bootstrapApplication = browser['bootstrapApplication'] as
    ((type: unknown, config: unknown) => Promise<core.ApplicationRef>) | undefined;
  const importProvidersFrom = api['importProvidersFrom'] as
    ((...modules: unknown[]) => core.EnvironmentProviders) | undefined;
  if (bootstrapApplication && importProvidersFrom && angularAtLeast('14.1')) {
    const appRef = await bootstrapApplication(root, {
      providers: [
        ...zonelessProviders(),
        ...(options.modules?.length ? [importProvidersFrom(...options.modules)] : []),
        ...(options.providers ?? []),
      ],
    });
    return { injector: appRef.injector, appRef, destroy: () => appRef.destroy() };
  }
  // A component belongs to one NgModule, so each root gets its own, reused by every boot.
  let declaring = rootModules.get(root);
  if (!declaring) {
    declaring = class RootModule {};
    const declarations = [root, ...(options.declarations ?? [])];
    core.NgModule({
      imports: [commonModule],
      declarations,
      exports: declarations,
    })(declaring);
    rootModules.set(root, declaring);
  }
  class AppModule {}
  core.NgModule({
    imports: [browser['BrowserModule'], declaring, ...(options.modules ?? [])] as never[],
    providers: options.providers as core.Provider[],
    bootstrap: [root],
  })(AppModule);
  const platformBrowser = browser['platformBrowser'] as () => core.PlatformRef;
  const moduleRef = await platformBrowser().bootstrapModule(AppModule);
  let destroyed = false;
  return {
    injector: moduleRef.injector,
    appRef: moduleRef.injector.get(core.ApplicationRef),
    destroy: () => {
      if (!destroyed) moduleRef.destroy();
      destroyed = true;
    },
  };
}

const rootModules = new WeakMap<object, core.Type<unknown>>();

/**
 * A writable signal, or on Angular before 16.0 (no signals) a function with the
 * same `set` and `update`, so a template that calls it renders on every version.
 */
export function writableSignal<T>(initial: T): core.WritableSignal<T> {
  const create = (core as unknown as AnyCore)['signal'] as
    ((value: T) => core.WritableSignal<T>) | undefined;
  if (create) return create(initial);
  let value = initial;
  const read = (() => value) as core.WritableSignal<T>;
  return Object.assign(read, {
    set: (next: T) => void (value = next),
    update: (fn: (current: T) => T) => void (value = fn(value)),
  });
}

/** Registers `callback` after each render: `afterEveryRender` from 20.0, `afterRender` from 16.2. */
export function afterEachRender(callback: () => void): void {
  const api = core as unknown as AnyCore;
  const register = (api['afterEveryRender'] ?? api['afterRender']) as
    ((callback: () => void) => unknown) | undefined;
  register?.(callback);
}

/** `@if`, `@for` and the other control flow blocks exist from 17.0. */
export const controlFlow = angularAtLeast('17.0');

type Annotated = { __annotations__?: { ngMetadataName?: string; imports?: unknown[] }[] };

/**
 * What TestBed needs to create `types` on any version. From 14.0 the test's
 * components are standalone and need nothing. Before, each is declared in
 * the testing module with the components, directives and pipes its
 * decorator lists in `imports` (read back from the JIT annotations), and
 * anything else, such as `CurrencyPipe` or `NgIf`, comes from `CommonModule`.
 */
export function testModuleFor(...types: core.Type<unknown>[]): {
  declarations?: core.Type<unknown>[];
  imports?: unknown[];
} {
  if (angularAtLeast('14.0')) return {};
  const declarations = new Set<core.Type<unknown>>();
  const visit = (each: unknown) => {
    const annotations = Object.hasOwn(each as object, '__annotations__')
      ? (each as Annotated).__annotations__
      : undefined;
    if (!annotations?.length || declarations.has(each as core.Type<unknown>)) return;
    declarations.add(each as core.Type<unknown>);
    for (const annotation of annotations) for (const dep of annotation.imports ?? []) visit(dep);
  };
  types.forEach(visit);
  return { declarations: [...declarations], imports: [commonModule] };
}

/**
 * `inject(token)` for a component field. Before 14.0 a component's field
 * initializers can't call `inject()`, so the directive injector the compiled
 * factory uses is asked instead.
 */
export function injectHere<T>(token: core.ProviderToken<T>): T {
  if (angularAtLeast('14.0')) return core.inject(token);
  const directiveInject = (core as unknown as AnyCore)['ɵɵdirectiveInject'] as (
    token: core.ProviderToken<T>,
  ) => T;
  return directiveInject(token);
}
