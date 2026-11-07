// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { of } from 'rxjs';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry } from '../http-rules.ts';
import { runInAnalogRender } from '../ssr-context.ts';
import { ANALOG_META_DESCRIPTION, attachAnalog } from '../analog-runtime.ts';
import { isAnalogReport } from '../rpc/analog-tools.ts';

const g = globalThis as { ngDevMode?: unknown };
let saved: unknown;

beforeEach(() => {
  saved = g.ngDevMode;
  g.ngDevMode = true;
  httpRegistry().calls = [];
});

afterEach(() => {
  g.ngDevMode = saved;
  delete httpRegistry().pageId;
  vi.restoreAllMocks();
});

/** The request the interceptor passes on, for a call made on `platform`. */
function sent(url: string, platform: 'browser' | 'server' = 'browser'): HttpRequest<unknown> {
  let out!: HttpRequest<unknown>;
  const injector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  runInInjectionContext(injector, () =>
    pangularHttpInterceptor(new HttpRequest('GET', url), (req) => {
      out = req;
      return of(new HttpResponse({ status: 200, body: {} }) as HttpEvent<unknown>);
    }),
  ).subscribe();
  return out;
}

describe('the page header on Analog requests', () => {
  it('sends the page id on same-origin requests only', () => {
    httpRegistry().pageId = 'pg1';
    expect(sent('/api/_analog/pages/products/1').headers.get('x-pangular-page')).toBe('pg1');
    expect(sent(`${location.origin}/api/v1/hello`).headers.get('x-pangular-page')).toBe('pg1');
    // A custom header on another origin would add a CORS preflight.
    expect(sent('https://api.example.com/v1').headers.has('x-pangular-page')).toBe(false);
  });

  it('sends nothing before an Analog page reported its id', () => {
    expect(sent('/api/_analog/pages/products/1').headers.has('x-pangular-page')).toBe(false);
  });

  it('keeps the recorded request free of the header', () => {
    httpRegistry().pageId = 'pg1';
    sent('/api/v1/hello');
    const call = httpRegistry().calls!.at(-1)!;
    expect(JSON.stringify(call)).not.toContain('x-pangular-page');
  });

  it('sends the render id on the /_analog requests of a server render', () => {
    const load = runInAnalogRender('r1', () =>
      sent('http://localhost:5173/api/_analog/pages/products/1', 'server'),
    );
    expect(load.headers.get('x-pangular-render')).toBe('r1');
    const other = runInAnalogRender('r1', () => sent('https://api.example.com/v1', 'server'));
    expect(other.headers.has('x-pangular-render')).toBe(false);
    expect(
      sent('http://localhost:5173/api/_analog/fn/x', 'server').headers.has('x-pangular-render'),
    ).toBe(false);
  });
});

describe('the Analog collector and its render', () => {
  const META = Symbol(ANALOG_META_DESCRIPTION);
  const router = (config: unknown[]) => ({
    url: '/',
    config,
    routerState: { snapshot: { root: { routeConfig: null, data: {}, firstChild: null } } },
  });

  it('reports the render id from Server-Timing and hands its page id to the interceptor', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { serverTiming: [{ name: 'pangular-analog', description: 'abc123', duration: 0 }] },
    ] as never);
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const ng = {
      getInjector: () => ({}),
      ɵgetRouterInstance: () =>
        router([
          {
            path: '',
            [META]: { endpoint: '/pages/', endpointKey: '/src/app/pages/index.page.ts' },
          },
        ]),
    };
    const reports: Record<string, unknown>[] = [];
    const call = async (_name: string, report: unknown) =>
      void reports.push(report as Record<string, unknown>);
    const detach = attachAnalog({ rpc: { call } } as never, 'pg1', () => ng, 60_000);
    try {
      expect(reports[0]).toMatchObject({ pageId: 'pg1', renderId: 'abc123' });
      expect(isAnalogReport(reports[0])).toBe(true);
      expect(httpRegistry().pageId).toBe('pg1');
    } finally {
      detach();
    }
    expect(httpRegistry().pageId).toBeUndefined();
    expect(isAnalogReport({ ...reports[0], renderId: '"; drop' })).toBe(false);
  });

  it('leaves the requests of an app that is not Analog alone', () => {
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router([{ path: '' }]) };
    const detach = attachAnalog(
      { rpc: { call: async () => {} } } as never,
      'pg1',
      () => ng,
      60_000,
    );
    try {
      expect(httpRegistry().pageId).toBeUndefined();
    } finally {
      detach();
    }
  });
});
