import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PangularConfig } from '../config.ts';
import pangular, { createPangular } from '../devframe.ts';
import { httpRegistry, type HttpRule } from '../http-rules.ts';
import type { HttpPayloadState, HttpState } from '../types.ts';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createPangular(config) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<unknown>;
  const shared = (key: string) =>
    (
      ctx.rpc as unknown as {
        sharedState: {
          get: (key: string) => Promise<{
            value: () => unknown;
            on: (event: 'updated', fn: () => void) => () => void;
          }>;
        };
      }
    ).sharedState.get(`pangular:${key}`);
  const state = async () => (await shared('http')).value() as HttpState;
  const payloads = async () => (await shared('http-payloads')).value() as HttpPayloadState;
  return { push, state, payloads, shared };
}

const report = (pageId: string, extra: Record<string, unknown> = {}) => ({
  pageId,
  url: `/${pageId}`,
  initialUrl: `/${pageId}`,
  title: pageId,
  hydration: { enabled: true, warnings: [], skipHydrationHosts: [] },
  calls: [],
  ...extra,
});

describe('push-http', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps pages in first-seen order and keeps the payload between pushes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { push, state, payloads } = await boot();
    vi.setSystemTime(1000);
    expect(
      await push('push-http', report('a', { payload: { found: true, size: 2, entries: [] } })),
    ).toEqual({ needPayload: false });
    vi.setSystemTime(2000);
    await push('push-http', report('b', { payload: { found: false, size: 0, entries: [] } }));
    vi.setSystemTime(3000);
    expect(await push('push-http', report('a', { url: '/a/next' }))).toEqual({
      needPayload: false,
    });
    vi.setSystemTime(4000);
    await push('push-http', report('b'));
    const pages = (await state()).pages;
    expect(pages.map((p) => p.pageId)).toEqual(['a', 'b']);
    expect(pages[0]).toMatchObject({
      url: '/a/next',
      initialUrl: '/a',
      firstSeenAt: 1000,
      reportedAt: 3000,
    });
    expect(pages[0]).not.toHaveProperty('payload');
    expect(pages[1]).toMatchObject({ firstSeenAt: 2000, reportedAt: 4000 });
    expect((await payloads()).pages).toMatchObject({
      a: { found: true, size: 2 },
      b: { found: false },
    });
  });

  it('asks for the payload of an unknown page without listing it as not server rendered', async () => {
    const { push, state, payloads } = await boot();
    expect(await push('push-http', report('c'))).toEqual({ needPayload: true });
    expect((await state()).pages).toEqual([]);
    expect(
      await push('push-http', report('c', { payload: { found: true, size: 1, entries: [] } })),
    ).toEqual({ needPayload: false });
    expect((await state()).pages).toMatchObject([{ pageId: 'c' }]);
    expect((await payloads()).pages['c']).toMatchObject({ found: true });
  });

  const call = (id: string) => ({
    id,
    url: `/api/${id}`,
    method: 'GET',
    status: 200,
    durationMs: 1,
    side: 'client',
    cacheHit: false,
    faulted: false,
    at: 1,
  });
  const payload = { found: true, size: 1, entries: [] };

  it('adds the calls of a delta push and keeps the latest at the limit', async () => {
    const { push, state } = await boot({ limits: { httpCalls: 10 } });
    const first = Array.from({ length: 8 }, (_, i) => call(`c${i}`));
    await push('push-http', report('a', { payload, calls: first, full: true }));
    const next = Array.from({ length: 4 }, (_, i) => call(`d${i}`));
    await push('push-http', report('a', { calls: next, full: false, dropped: 2 }));
    const page = (await state()).pages[0];
    expect(page.calls.map((c) => c.id)).toEqual([
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'd0',
      'd1',
      'd2',
      'd3',
    ]);
    expect(page.dropped).toBe(2);
  });

  it('does not rebroadcast payloads when calls change, and a ping changes nothing', async () => {
    const { push, shared } = await boot();
    await push('push-http', report('a', { payload, full: true }));
    const httpUpdates = vi.fn();
    const payloadUpdates = vi.fn();
    (await shared('http')).on('updated', httpUpdates);
    (await shared('http-payloads')).on('updated', payloadUpdates);
    await push('push-http', report('a', { calls: [call('x')], full: false }));
    expect(httpUpdates).toHaveBeenCalledTimes(1);
    expect(payloadUpdates).not.toHaveBeenCalled();
    expect(await push('ping-http', 'a')).toEqual({ known: true });
    expect(await push('ping-http', 'zz')).toEqual({ known: false });
    expect(httpUpdates).toHaveBeenCalledTimes(1);
  });

  it('forgets the payload with the page', async () => {
    const { push, state, payloads } = await boot();
    await push('push-http', report('a', { payload, full: true }));
    await push('forget-http-page', 'a');
    expect((await state()).pages).toEqual([]);
    expect((await payloads()).pages).toEqual({});
  });

  it('counts SSR calls dropped at the limit and resets the count on clear', async () => {
    vi.useFakeTimers();
    const { push, state } = await boot({ limits: { httpCalls: 10 } });
    for (let i = 0; i < 13; i++) httpRegistry().record?.({ ...call(`s${i}`), side: 'server' });
    await vi.advanceTimersByTimeAsync(150);
    expect((await state()).serverCalls).toHaveLength(10);
    expect((await state()).serverDropped).toBe(3);
    await push('push-http', report('a', { payload, calls: [call('x')], full: true, dropped: 4 }));
    await push('clear-http-calls', undefined);
    const cleared = await state();
    expect(cleared.serverDropped).toBe(0);
    expect(cleared.pages[0]).toMatchObject({ calls: [], dropped: 0 });
    httpRegistry().dispose?.();
  });
});

describe('http redaction', () => {
  afterEach(() => {
    vi.useRealTimers();
    httpRegistry().dispose?.();
  });

  const call = (url: string, extra: Record<string, unknown> = {}) => ({
    id: 'c1',
    url,
    method: 'GET',
    status: 0,
    durationMs: 1,
    side: 'client',
    cacheHit: false,
    faulted: false,
    at: 1,
    ...extra,
  });

  it('redacts client call URLs, page URLs and errors like the router does', async () => {
    const { push, state } = await boot({ redaction: { secretNames: ['tenant'] } });
    await push(
      'push-http',
      report('a', {
        url: '/callback?code=abc123&tab=1',
        initialUrl: '/callback?code=abc123&tab=1',
        payload: { found: false, size: 0, entries: [] },
        calls: [
          call('/api/files?access_token=s3cr3t&tenant=acme&page=2', {
            pageUrl: '/callback?code=abc123',
            error: 'Http failure response for /api/files?access_token=s3cr3t: 0 Unknown Error',
          }),
        ],
      }),
    );
    const [page] = (await state()).pages;
    expect(page.url).toBe('/callback?code=[redacted]&tab=1');
    expect(page.initialUrl).toBe('/callback?code=[redacted]&tab=1');
    expect(page.calls[0]).toMatchObject({
      url: '/api/files?access_token=[redacted]&tenant=[redacted]&page=2',
      pageUrl: '/callback?code=[redacted]',
    });
    expect(page.calls[0].error).not.toContain('s3cr3t');
  });

  it('redacts response previews on client and SSR calls', async () => {
    vi.useFakeTimers();
    const { push, state } = await boot({ redaction: { secretNames: ['tenant'] } });
    const preview = JSON.stringify({
      access_token: 'eyJhbGciOi.eyJzdWIi.sigsig',
      password: 'hunter2',
      note: 'Bearer abc.def123',
      tenant: 'acme',
      ok: 1,
    });
    const payload = { found: false, size: 0, entries: [] };
    await push('push-http', report('a', { payload, calls: [call('/api/login', { preview })] }));
    httpRegistry().record?.(call('http://api.local/me', { side: 'server', preview }) as never);
    await vi.advanceTimersByTimeAsync(150);
    const current = await state();
    for (const text of [current.pages[0].calls[0].preview!, current.serverCalls[0].preview!]) {
      expect(text).not.toMatch(/eyJhbGci|hunter2|abc\.def123|acme/);
      expect(text).toContain('"ok":1');
    }
    const clipped = `{"password":"hunter2","items":[${'1,'.repeat(1200)}`;
    await push(
      'push-http',
      report('b', { payload, calls: [call('/api/x', { preview: clipped })] }),
    );
    const b = (await state()).pages.find((p) => p.pageId === 'b')!;
    expect(b.calls[0].preview).not.toContain('hunter2');
  });

  it('redacts secret query pairs inside value strings and clipped escaped keys', async () => {
    vi.useFakeTimers();
    const { push, state, payloads } = await boot();
    const payload = {
      found: true,
      size: 1,
      entries: [{ key: 'k', size: 1, value: { next: '/callback?token=abc123&tab=1' } }],
    };
    const preview = JSON.stringify({ next: '/cb?code=qrs456&tab=1' });
    const clipped = `{"pass\\u0077ord":"hunter2","items":[${'1,'.repeat(1200)}`;
    await push(
      'push-http',
      report('a', {
        payload,
        calls: [call('/a', { preview }), call('/b', { id: 'c2', preview: clipped })],
      }),
    );
    expect(JSON.stringify((await payloads()).pages['a'])).not.toContain('abc123');
    const [first, second] = (await state()).pages[0].calls;
    expect(first.preview).not.toContain('qrs456');
    expect(first.preview).toContain('tab=1');
    expect(second.preview).not.toContain('hunter2');
  });

  it('redacts TransferState payload values, URLs and keys', async () => {
    const { push, payloads } = await boot({ redaction: { secretNames: ['tenant'] } });
    await push(
      'push-http',
      report('a', {
        payload: {
          found: true,
          size: 10,
          entries: [
            {
              key: 'GET./api/me?access_token=abc123',
              size: 1,
              value: { access_token: 'eyJhbGciOi.eyJzdWIi.sigsig', tenant: 'acme', name: 'ada' },
              http: { url: '/api?access_token=abc123', status: 200 },
            },
          ],
        },
      }),
    );
    const [entry] = (await payloads()).pages['a'].entries;
    const text = JSON.stringify(entry);
    expect(text).not.toMatch(/eyJhbGci|acme|abc123/);
    expect(entry.value).toMatchObject({
      access_token: '[redacted]',
      tenant: '[redacted]',
      name: 'ada',
    });
    expect(entry.http?.url).toBe('/api?access_token=[redacted]');
  });

  it('redacts SSR calls before they reach the timeline', async () => {
    vi.useFakeTimers();
    const { state } = await boot();
    httpRegistry().record?.(
      call('http://api.local/items?sig=abcdef&id=7', {
        side: 'server',
        pageUrl: '/reset?token=xyz789',
      }) as never,
    );
    await vi.advanceTimersByTimeAsync(150);
    expect((await state()).serverCalls).toMatchObject([
      { url: 'http://api.local/items?sig=[redacted]&id=7', pageUrl: '/reset?token=[redacted]' },
    ]);
  });
});

describe('http rules across restarts', () => {
  const rule: HttpRule = {
    id: 'r1',
    pattern: '/api',
    enabled: true,
    target: 'server',
    status: 503,
  };

  afterEach(() => {
    httpRegistry().dispose?.();
    delete httpRegistry().rules;
  });

  it('shows the rules that still apply after a restart', async () => {
    httpRegistry().rules = [rule];
    const { state } = await boot();
    expect(httpRegistry().rules).toEqual([rule]);
    expect((await state()).rules).toEqual([rule]);
  });

  it('clears the rules when http actions are turned off', async () => {
    httpRegistry().rules = [rule];
    const { push, state } = await boot({ actions: { http: false } });
    expect(httpRegistry().rules).toEqual([]);
    expect((await state()).rules).toEqual([]);
    expect(await push('get-http-rules', undefined)).toEqual([]);
  });

  it('clears the rules when the http inspector is turned off', async () => {
    httpRegistry().rules = [rule];
    const { state } = await boot({ inspectors: { http: false } });
    expect(httpRegistry().rules).toEqual([]);
    expect((await state()).rules).toEqual([]);
  });
});
