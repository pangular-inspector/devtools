import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  gateInjectorProfiler,
  gateInjectorProfilerInReactNativeDev,
} from '../injector-profiler-gate.ts';

const g = globalThis as Record<string, unknown>;

/** What `publishDefaultGlobalUtils` and `publishUtil` in `@angular/core` do, in that order. */
function bootAngular(): { profiler: boolean } {
  const profiler = typeof g['window'] !== 'undefined';
  const ng = (g['ng'] ??= {}) as Record<string, unknown>;
  ng['getComponent'] = () => null;
  ng['getInjector'] = () => null;
  return { profiler };
}

function clean() {
  delete g['window'];
  delete g['ng'];
  delete g['__DEV__'];
}

describe('gateInjectorProfiler', () => {
  beforeEach(() => {
    // The tests run in Node, which has no `window`, like a native runtime.
    expect('window' in g).toBe(false);
    clean();
  });
  afterEach(clean);

  it('defines window until Angular publishes getComponent, then removes it', () => {
    gateInjectorProfiler();
    expect(g['window']).toBe(globalThis);
    expect(bootAngular().profiler).toBe(true);
    expect('window' in g).toBe(false);
    expect(typeof (g['ng'] as Record<string, unknown>)['getComponent']).toBe('function');
    expect(typeof (g['ng'] as Record<string, unknown>)['getInjector']).toBe('function');
  });

  it('keeps window while the router publishes onto ng first', () => {
    gateInjectorProfiler();
    g['ng'] ??= {};
    (g['ng'] as Record<string, unknown>)['ɵgetLoadedRoutes'] = () => [];
    expect(g['window']).toBe(globalThis);
    expect(bootAngular().profiler).toBe(true);
    expect('window' in g).toBe(false);
    expect((g['ng'] as Record<string, unknown>)['ɵgetLoadedRoutes']).toBeTypeOf('function');
  });

  it('removes window when ng arrives with the utilities already on it', () => {
    gateInjectorProfiler();
    const getComponent = () => null;
    g['ng'] = { getComponent };
    expect('window' in g).toBe(false);
    expect((g['ng'] as Record<string, unknown>)['getComponent']).toBe(getComponent);
  });

  it('does nothing when window already exists', () => {
    const window = { own: true };
    g['window'] = window;
    gateInjectorProfiler();
    expect(Object.getOwnPropertyDescriptor(g, 'ng')).toBeUndefined();
    bootAngular();
    expect(g['window']).toBe(window);
  });

  it('does nothing once Angular has published ng', () => {
    g['ng'] = { getComponent: () => null };
    gateInjectorProfiler();
    expect('window' in g).toBe(false);
  });
});

describe('gateInjectorProfilerInReactNativeDev', () => {
  beforeEach(clean);
  afterEach(clean);

  it('gates in a React Native development build', () => {
    g['__DEV__'] = true;
    gateInjectorProfilerInReactNativeDev();
    expect(bootAngular().profiler).toBe(true);
    expect('window' in g).toBe(false);
  });

  it('leaves a release build and other runtimes alone', () => {
    g['__DEV__'] = false;
    gateInjectorProfilerInReactNativeDev();
    delete g['__DEV__'];
    gateInjectorProfilerInReactNativeDev();
    expect('window' in g).toBe(false);
    expect(bootAngular().profiler).toBe(false);
  });
});

describe('the Angular Native overlay', () => {
  beforeEach(() => {
    clean();
    vi.resetModules();
  });
  afterEach(clean);

  it('gates the injector profiler as its module loads, before mount()', async () => {
    g['__DEV__'] = true;
    await import('../overlay-angular-native.ts');
    expect(g['window']).toBe(globalThis);
    expect(bootAngular().profiler).toBe(true);
    expect('window' in g).toBe(false);
  });

  it('is a no-op when window exists', async () => {
    g['__DEV__'] = true;
    const window = { own: true };
    g['window'] = window;
    await import('../overlay-angular-native.ts');
    expect(Object.getOwnPropertyDescriptor(g, 'ng')).toBeUndefined();
    expect(g['window']).toBe(window);
  });
});
