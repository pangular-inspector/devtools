// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Injector, resource, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { angularAtLeast, initAngularTestBed, zonelessProviders } from './angular-version.ts';
import { originFromStack, originText, sanitizeOrigin } from '../http-origin.ts';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry, sanitizeCalls } from '../http-rules.ts';
import { listHttpCallsText } from '../rpc/http-tools.ts';

describe('originFromStack', () => {
  it('reads V8 and Firefox frames, the most specific first', () => {
    const v8 = (frames: string[]) =>
      ['Error', ...frames.map((f) => `    at ${f} (x.js:1:1)`)].join('\n');
    expect(
      originFromStack(
        v8(['interceptor', 'HttpResourceImpl.loaderFn', 'HttpResourceImpl.loadEffect']),
      ),
    ).toBe('httpResource');
    expect(originFromStack(v8(['loader', 'ResourceImpl.loadEffect']))).toBe('resource');
    expect(originFromStack(v8(['ngOnInit', 'applyDeferBlockState']))).toBe('defer');
    expect(originFromStack(v8(['HttpResourceImpl2.loadEffect', 'applyDeferBlockState']))).toBe(
      'httpResource',
    );
    expect(originFromStack('interceptor@x.js:1:1\nHttpResourceImpl/<@x.js:2:2')).toBe(
      'httpResource',
    );
    expect(originFromStack('renderDeferBlockState@x.js:1:1')).toBe('defer');
    expect(originFromStack(v8(['ngOnInit', 'refreshView']))).toBeUndefined();
    expect(originFromStack(undefined)).toBeUndefined();
  });

  it('names origins as likely, and drops unknown ones from reports', () => {
    expect(originText('httpResource')).toBe('likely httpResource()');
    expect(originText('defer')).toBe('likely @defer');
    expect(sanitizeOrigin('resource')).toBe('resource');
    expect(sanitizeOrigin('<script>')).toBeUndefined();
    const [kept, dropped] = sanitizeCalls([
      { id: 'a', url: '/x', method: 'GET', origin: 'httpResource' },
      { id: 'b', url: '/y', method: 'GET', origin: 'nope' },
    ]);
    expect(kept.origin).toBe('httpResource');
    expect(dropped.origin).toBeUndefined();
  });

  it('shows the origin in list-http-calls', () => {
    const text = listHttpCallsText({
      pages: [],
      serverCalls: [
        {
          id: 's1',
          url: '/api/x',
          method: 'GET',
          status: 200,
          durationMs: 1,
          side: 'server',
          cacheHit: false,
          faulted: false,
          at: 0,
          origin: 'resource',
        },
      ],
    });
    expect(text).toContain('likely resource()');
  });
});

// httpResource arrived in Angular 19.2, resource() in 19.0.
describe.runIf(angularAtLeast('19.2'))('call origin with real Angular resources', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode ??= true;
    httpRegistry().calls = [];
    httpRegistry().rules = [];
    initAngularTestBed();
    TestBed.configureTestingModule({
      providers: [
        ...zonelessProviders(),
        provideHttpClient(withInterceptors([pangularHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });
  afterEach(() => {
    g.ngDevMode = saved;
    delete httpRegistry().rules;
    TestBed.resetTestingModule();
  });

  const lastOrigin = () => httpRegistry().calls?.at(-1)?.origin;

  it('labels a call made by httpResource', async () => {
    const { httpResource } = await import('@angular/common/http');
    const injector = TestBed.inject(Injector);
    runInInjectionContext(injector, () => httpResource(() => '/api/products'));
    TestBed.tick();
    TestBed.inject(HttpTestingController).expectOne('/api/products').flush([]);
    expect(lastOrigin()).toBe('httpResource');
  });

  it('labels a call made from a resource() loader', async () => {
    const injector = TestBed.inject(Injector);
    const http = TestBed.inject(HttpClient);
    runInInjectionContext(injector, () =>
      resource({ loader: () => firstValueFrom(http.get('/api/orders')) }),
    );
    TestBed.tick();
    TestBed.inject(HttpTestingController).expectOne('/api/orders').flush([]);
    expect(lastOrigin()).toBe('resource');
  });

  it('leaves a plain HttpClient call unlabeled', () => {
    TestBed.inject(HttpClient).get('/api/plain').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/plain').flush([]);
    expect(lastOrigin()).toBeUndefined();
  });
});
