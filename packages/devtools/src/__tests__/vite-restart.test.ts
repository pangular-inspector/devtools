import '@angular/compiler';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpRequest, HttpResponse, type HttpEvent } from '@angular/common/http';
import { createHostContext } from 'devframe/node';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { clearCalls, recordCall, type AnalogCall } from '../analog-server-log.ts';
import { pangularHttpInterceptor } from '../http.ts';
import { httpRegistry, type HttpRule } from '../http-rules.ts';
import type { AnalogState } from '../rpc/analog-tools.ts';
import { releaseServerState } from '../vite.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const analog = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => AnalogState }> };
        }
      ).sharedState.get('pangular:analog')
    ).value();
  return { ctx, analog };
}

const call: Omit<AnalogCall, 'id'> = {
  at: 0,
  kind: 'api',
  method: 'GET',
  url: '/api/v1/hello',
  status: 200,
  ms: 3,
  from: 'ssr',
};

beforeEach(() => clearCalls());

describe('releaseServerState', () => {
  it('leaves the state of a newer server alone when an old one closes', async () => {
    const old = await boot();
    const current = await boot();

    releaseServerState(old.ctx);

    expect(typeof httpRegistry().record).toBe('function');
    recordCall(call);
    expect((await current.analog()).calls).toHaveLength(1);
  });

  it('turns off capture when the server that owns it closes', async () => {
    const current = await boot();

    releaseServerState(current.ctx);

    expect(httpRegistry().record).toBeUndefined();
    recordCall(call);
    expect((await current.analog()).calls).toHaveLength(0);
  });
});

describe('server fault rules across a Vite restart', () => {
  const g = globalThis as { ngDevMode?: unknown };
  const saved = g.ngDevMode;
  const rule: HttpRule = {
    id: 'r1',
    pattern: '/api',
    enabled: true,
    target: 'server',
    status: 503,
  };
  const injector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
  const ssrStatus = () =>
    new Promise<number>((resolve) => {
      const result = runInInjectionContext(injector, () =>
        pangularHttpInterceptor(new HttpRequest('GET', 'http://localhost/api/items'), () =>
          of(new HttpResponse({ status: 200 })),
        ),
      ) as Observable<HttpEvent<unknown>>;
      result.subscribe({
        next: (event) => {
          if (event instanceof HttpResponse) resolve(event.status);
        },
        error: (error: { status: number }) => resolve(error.status),
      });
    });

  beforeEach(() => {
    g.ngDevMode = true;
  });

  afterEach(() => {
    g.ngDevMode = saved;
    httpRegistry().dispose?.();
    delete httpRegistry().rules;
  });

  it('keeps applying the rules when a new server takes over in the same process', async () => {
    const old = await boot();
    httpRegistry().rules = [rule];
    await boot();
    releaseServerState(old.ctx);
    expect(await ssrStatus()).toBe(503);
  });

  it('stops applying the rules once the server that owns them closes', async () => {
    const current = await boot();
    httpRegistry().rules = [rule];
    expect(await ssrStatus()).toBe(503);
    releaseServerState(current.ctx);
    expect(await ssrStatus()).toBe(200);
  });
});
