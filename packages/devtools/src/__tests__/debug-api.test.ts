import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { pageDebugApi, type NgDebugApi } from '../debug-api.ts';
import type { ComponentDebugNg } from '../component-tree.ts';
import type { DebugNg as InjectorDebugNg } from '../injector-tree.ts';
import type { SignalDebugNg } from '../signal-graph.ts';
import type { ErrorsDebugNg } from '../errors-collector.ts';
import type { DeferDebugNg } from '../defer-blocks.ts';

const g = globalThis as { ng?: unknown };

describe('pageDebugApi', () => {
  afterEach(() => {
    delete g.ng;
  });

  it('is undefined without a debug API, or when ng is not an object', () => {
    expect(pageDebugApi()).toBeUndefined();
    g.ng = 'production';
    expect(pageDebugApi()).toBeUndefined();
  });

  it('hands back window.ng as it is', () => {
    const ng = { getComponent: () => null };
    g.ng = ng;
    expect(pageDebugApi()).toBe(ng);
  });

  it('fits what the collectors ask for', () => {
    // A field typed differently here and in a collector fails `tsc`.
    expectTypeOf<NgDebugApi>().toExtend<ComponentDebugNg<Element>>();
    expectTypeOf<NgDebugApi>().toExtend<InjectorDebugNg<Element>>();
    expectTypeOf<NgDebugApi>().toExtend<SignalDebugNg<Element>>();
    expectTypeOf<NgDebugApi>().toExtend<ErrorsDebugNg>();
    expectTypeOf<NgDebugApi>().toExtend<DeferDebugNg>();
  });
});
