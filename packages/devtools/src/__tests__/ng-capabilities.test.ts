// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  angularUnavailableText,
  angularVersionAtLeast,
  lacksCapability,
  shortAngularVersion,
} from '../config.ts';
import { attachAngularInfo, detectAngular } from '../ng-capabilities.ts';
import { angularRoot, fakeNg } from './ng-shapes.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

const capabilitiesOn = (version: string, full = `${version}.0`) => {
  document.body.innerHTML = '';
  angularRoot(full);
  return detectAngular(fakeNg(version), document);
};

describe('detectAngular', () => {
  it('finds only the public debug API on Angular 12', () => {
    const info = capabilitiesOn('12.2', '12.2.17');
    expect(info.version).toBe('12.2.17');
    expect(info.capabilities).toEqual({
      debugApi: true,
      injectorProviders: false,
      injectorMetadata: false,
      isSignal: false,
      signalGraph: false,
      deferBlocks: false,
      forBlocks: false,
      profiler: false,
      angularProfiling: false,
      routerInstance: false,
    });
  });

  it('finds providers on 16.2 and injector metadata from 17.0', () => {
    expect(capabilitiesOn('16.2').capabilities).toMatchObject({
      injectorProviders: true,
      injectorMetadata: false,
    });
    expect(capabilitiesOn('17.0').capabilities).toMatchObject({
      injectorProviders: true,
      injectorMetadata: true,
      isSignal: false,
    });
  });

  it('finds the signal graph and defer blocks from 19.1, the profiler from 20.0', () => {
    expect(capabilitiesOn('19.1').capabilities).toMatchObject({
      isSignal: true,
      signalGraph: true,
      deferBlocks: true,
      forBlocks: false,
      profiler: false,
      angularProfiling: false,
    });
    expect(capabilitiesOn('20.0').capabilities).toMatchObject({
      profiler: true,
      angularProfiling: true,
      routerInstance: false,
    });
  });

  it('reads defer blocks through ɵgetControlFlowBlocks on 22, which has no ɵgetDeferBlocks', () => {
    const ng = fakeNg('22.0');
    expect(ng['ɵgetDeferBlocks']).toBeUndefined();
    angularRoot('22.0.8');
    expect(detectAngular(ng, document).capabilities).toMatchObject({
      deferBlocks: true,
      forBlocks: true,
      routerInstance: true,
    });
  });

  it('never calls a util to find out whether the page has it', () => {
    // fakeNg utils throw when called, so detection passing proves it.
    expect(() => capabilitiesOn('22.0')).not.toThrow();
  });

  it('does not count ɵsetProfiler before 20.0, where taking its one slot would evict another profiler', () => {
    angularRoot('19.2.25');
    const ng = fakeNg('19.2');
    expect(typeof ng['ɵsetProfiler']).toBe('function');
    expect(detectAngular(ng, document).capabilities.profiler).toBe(false);
  });

  it('reports every part missing on a production build, which has no `ng`', () => {
    angularRoot('22.2.2');
    const info = detectAngular(undefined, document);
    expect(info.version).toBe('22.2.2');
    expect(Object.values(info.capabilities).every((on) => on === false)).toBe(true);
  });

  it('leaves the version out when no root carries ng-version yet', () => {
    expect(detectAngular(fakeNg('15.2'), document)).not.toHaveProperty('version');
  });

  it('counts the profiler without ng-version only where ng.enableProfiling marks 20.0 or later', () => {
    // An app started with createApplication (Angular Elements) has no ng-version root.
    expect(detectAngular(fakeNg('22.0'), document).capabilities.profiler).toBe(true);
    expect(detectAngular(fakeNg('20.0'), document).capabilities.profiler).toBe(true);
    expect(detectAngular(fakeNg('19.2'), document).capabilities.profiler).toBe(false);
  });
});

describe('attachAngularInfo', () => {
  const rpc = () => {
    const calls: [string, unknown][] = [];
    const call = vi.fn(async (name: string, arg: unknown) => {
      calls.push([name, arg]);
      return undefined;
    });
    return { my: { rpc: { call } }, calls, call };
  };

  it('sends the version and capabilities with the pageId, then skips unchanged pushes', async () => {
    angularRoot('15.2.10');
    const { my, calls } = rpc();
    let now = 1000;
    const info = attachAngularInfo(my, 'p1', () => fakeNg('15.2'), { now: () => now });
    await info.push();
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe('report-page-angular');
    expect(calls[0]![1]).toMatchObject({
      pageId: 'p1',
      version: '15.2.10',
      capabilities: { debugApi: true, injectorProviders: false },
    });
    now += 500;
    await info.push();
    expect(calls).toHaveLength(1);
  });

  it('sends again when Angular starts after the overlay', async () => {
    const { my, calls } = rpc();
    let ng: unknown;
    const info = attachAngularInfo(my, 'p1', () => ng);
    await info.push();
    angularRoot('17.3.12');
    ng = fakeNg('17.3');
    await info.push();
    expect(calls).toHaveLength(2);
    expect(calls[1]![1]).toMatchObject({ version: '17.3.12', capabilities: { debugApi: true } });
  });

  it('re-sends an unchanged report before the server expires the page', async () => {
    angularRoot('15.2.10');
    const { my, calls } = rpc();
    let now = 0;
    const info = attachAngularInfo(my, 'p1', () => fakeNg('15.2'), {
      now: () => now,
      tickMs: () => 3000,
    });
    await info.push();
    now = 4000;
    await info.push();
    expect(calls).toHaveLength(1);
    now = 6000;
    await info.push();
    expect(calls).toHaveLength(2);
  });

  it('tells the server to forget the page when it leaves, and sends it again after', async () => {
    angularRoot('15.2.10');
    const { my, calls } = rpc();
    const info = attachAngularInfo(my, 'p1', () => fakeNg('15.2'));
    await info.push();
    info.leave();
    expect(calls.at(-1)).toEqual(['forget-page-angular', 'p1']);
    await info.push();
    expect(calls.at(-1)![0]).toBe('report-page-angular');
  });

  it('sends again after a failed push', async () => {
    angularRoot('15.2.10');
    const call = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const info = attachAngularInfo({ rpc: { call } }, 'p1', () => fakeNg('15.2'));
    await info.push();
    await info.push();
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe('Angular version messages', () => {
  it('names the feature, its version and the page version', () => {
    expect(angularUnavailableText('signalGraph', '15.2.10')).toBe(
      'The live signal graph needs Angular 20.1 or later; this page runs Angular 15.2.',
    );
    expect(angularUnavailableText('forBlocks', '21.0.9')).toBe(
      'Listing @for blocks needs Angular 22.0 or later; this page runs Angular 21.0.',
    );
  });

  it('points at a production build when the version is new enough', () => {
    expect(angularUnavailableText('signalGraph', '22.1.7')).toMatch(
      /needs Angular 20\.1 or later in a development build; this page runs Angular 22\.1 without it/,
    );
  });

  it('says when the page version is unknown', () => {
    expect(angularUnavailableText('debugApi', undefined)).toBe(
      "Live data needs Angular 12.0 or later; this page's Angular version is unknown.",
    );
  });

  it('compares and shortens versions', () => {
    expect(angularVersionAtLeast('16.2.12', '16.2')).toBe(true);
    expect(angularVersionAtLeast('16.1.9', '16.2')).toBe(false);
    expect(angularVersionAtLeast('20.0.0-next.3', '19.1')).toBe(true);
    expect(angularVersionAtLeast('nonsense', '12.0')).toBe(false);
    expect(shortAngularVersion('15.2.10')).toBe('15.2');
  });

  it('only marks a capability missing when the page said so', () => {
    expect(lacksCapability(undefined, 'signalGraph')).toBe(false);
    expect(lacksCapability({ capabilities: {} }, 'signalGraph')).toBe(false);
    expect(lacksCapability({ capabilities: { signalGraph: false } }, 'signalGraph')).toBe(true);
  });
});
