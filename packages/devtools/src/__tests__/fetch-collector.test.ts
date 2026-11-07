// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { requestOf, watchNativeFetch } from '../fetch-collector.ts';
import { notePendingClientRequest } from '../http-record.ts';
import { httpRegistry, sanitizeCalls } from '../http-rules.ts';
import { readHeaders, withCapturedHeaders } from '../http-headers.ts';
import { withPangular } from '../http.ts';
import { angularAtLeast, initAngularTestBed, zonelessProviders } from './angular-version.ts';

const g = globalThis as { fetch?: typeof fetch; __PANGULAR_HTTP__?: unknown };
let realFetch: typeof fetch | undefined;
let stop: () => void = () => {};

function stubFetch(answer: (input: unknown, init?: RequestInit) => Promise<Response>) {
  const stub = vi.fn(answer);
  g.fetch = stub as unknown as typeof fetch;
  return stub;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const calls = () => httpRegistry().calls ?? [];

beforeEach(() => {
  realFetch = g.fetch;
  delete g.__PANGULAR_HTTP__;
});

afterEach(() => {
  stop();
  stop = () => {};
  g.fetch = realFetch;
  delete g.__PANGULAR_HTTP__;
});

describe('watchNativeFetch', () => {
  it('records a fetch() call and hands the app the original response', async () => {
    const response = new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
    const stub = stubFetch(async () => response);
    stop = watchNativeFetch({
      now: (() => {
        let t = 1000;
        return () => (t += 25);
      })(),
    });
    const got = await fetch('/api/trips', {
      method: 'post',
      headers: { 'x-trace': 'abc' },
      body: '{}',
    });
    await flush();
    expect(got).toBe(response);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(calls()).toHaveLength(1);
    const call = calls()[0]!;
    expect(call).toMatchObject({
      url: '/api/trips',
      method: 'POST',
      status: 201,
      side: 'client',
      nativeFetch: true,
      durationMs: 25,
    });
    expect(call.error).toBeUndefined();
    const read = withCapturedHeaders(call);
    expect(read.requestHeaders).toEqual({ 'x-trace': 'abc' });
    expect(read.responseHeaders).toEqual({ 'content-type': 'application/json' });
    // The body is left for the app.
    expect(await got.json()).toEqual({ ok: true });
  });

  it('notes an error status, a network failure and an abort', async () => {
    let mode: 'status' | 'network' | 'abort' = 'status';
    stubFetch(async () => {
      if (mode === 'network') throw new TypeError('Failed to fetch');
      if (mode === 'abort') throw new DOMException('The user aborted a request.', 'AbortError');
      return new Response('nope', { status: 404, statusText: 'Not Found' });
    });
    stop = watchNativeFetch();
    await fetch('/api/missing');
    mode = 'network';
    await expect(fetch('/api/down')).rejects.toThrow('Failed to fetch');
    mode = 'abort';
    await expect(fetch('/api/slow')).rejects.toThrow();
    await flush();
    expect(calls().map((c) => [c.url, c.status, c.error, c.cancelled ?? false])).toEqual([
      ['/api/missing', 404, '404 Not Found', false],
      ['/api/down', 0, 'Failed to fetch', false],
      ['/api/slow', 0, 'cancelled', true],
    ]);
  });

  it("skips the devtools' own requests and URLs the caller skips", async () => {
    stubFetch(async () => new Response(''));
    stop = watchNativeFetch({ skip: (url) => url.includes('/metrics') });
    await fetch('/__devframes/pangular/__connection.json');
    await fetch('http://localhost:4000/__devframes/__rpc');
    await fetch('/metrics');
    await fetch('/api/kept');
    await flush();
    expect(calls().map((c) => c.url)).toEqual(['/api/kept']);
  });

  it('skips the fetch() of an HttpClient request withPangular() records', async () => {
    stubFetch(async () => new Response(''));
    stop = watchNativeFetch();
    const end = notePendingClientRequest('GET', '/api/products');
    await fetch('/api/products');
    end();
    await fetch('/api/products');
    await flush();
    expect(calls()).toHaveLength(1);
    expect(httpRegistry().clientPending?.size).toBe(0);
  });

  it('wraps fetch once and restores it', async () => {
    const stub = stubFetch(async () => new Response(''));
    stop = watchNativeFetch();
    const wrapped = g.fetch;
    expect(wrapped).not.toBe(stub);
    const second = watchNativeFetch();
    expect(g.fetch).toBe(wrapped);
    second();
    expect(g.fetch).toBe(wrapped);
    stop();
    expect(g.fetch).toBe(stub);
  });

  it('keeps the calls the page keeps, and the sanitizer keeps the flag', async () => {
    stubFetch(async () => new Response(''));
    httpRegistry().maxCalls = 2;
    stop = watchNativeFetch();
    await fetch('/a');
    await fetch('/b');
    await fetch('/c');
    await flush();
    expect(calls().map((c) => c.url)).toEqual(['/b', '/c']);
    expect(httpRegistry().dropped).toBe(1);
    expect(sanitizeCalls(calls())[0]!.nativeFetch).toBe(true);
    expect(sanitizeCalls([{ ...calls()[0]!, nativeFetch: 'yes' }])[0]!.nativeFetch).toBeUndefined();
  });

  it('reads the URL, method and headers of a Request', () => {
    const request = new Request('http://localhost/api/x', {
      method: 'PUT',
      headers: { 'x-a': '1' },
    });
    const read = requestOf(request, undefined);
    expect(read.url).toBe('http://localhost/api/x');
    expect(read.method).toBe('PUT');
    expect(
      readHeaders({
        keys: () => [...new Headers(read.headers).keys()],
        getAll: (n) => [new Headers(read.headers).get(n)!],
      }),
    ).toEqual({ 'x-a': '1' });
    expect(requestOf(new URL('http://localhost/b'), { method: 'delete' })).toMatchObject({
      url: 'http://localhost/b',
      method: 'DELETE',
    });
  });
});

describe.runIf(angularAtLeast('19.0'))('native fetch with HttpClient', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('records an HttpClient request on withFetch() once, as an HttpClient call', async () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = true;
    const stub = stubFetch(
      async () =>
        new Response('[1,2]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    stop = watchNativeFetch();
    initAngularTestBed();
    TestBed.configureTestingModule({
      providers: [...zonelessProviders(), provideHttpClient(withFetch(), withPangular())],
    });
    const http = TestBed.inject(HttpClient);
    expect(await firstValueFrom(http.get('/api/list'))).toEqual([1, 2]);
    await flush();
    expect(stub).toHaveBeenCalledTimes(1);
    expect(calls()).toHaveLength(1);
    expect(calls()[0]!.nativeFetch).toBeUndefined();
    expect(httpRegistry().clientPending?.size).toBe(0);
    // A plain fetch() to the same URL afterwards is a native call.
    await fetch('/api/list');
    await flush();
    expect(calls().map((c) => c.nativeFetch ?? false)).toEqual([false, true]);
  });
});
