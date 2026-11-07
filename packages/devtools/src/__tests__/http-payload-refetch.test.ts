// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PangularConfig } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { attachHttp } from '../http-overlay.ts';
import { refetchPayload } from '../http-payload-refetch.ts';
import { httpRegistry } from '../http-rules.ts';
import type { HttpPayloadState } from '../types.ts';
import { toolAnswer } from './tool-answer.ts';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXRlc3Q';

const html = (state: Record<string, unknown>) =>
  `<!doctype html><html><body><app-root></app-root><script id="ng-state" type="application/json">${JSON.stringify(state)}</script><script>window.ran = true</script></body></html>`;

const answer = (body: string, type = 'text/html; charset=utf-8', status = 200) =>
  vi.fn(async () => new Response(body, { status, headers: { 'content-type': type } }));

describe('refetchPayload', () => {
  it('reads the TransferState of the HTML the server sends now, with the tab cookies', async () => {
    const fetchFn = answer(html({ trips: { count: 3 } }));
    const result = await refetchPayload('http://localhost/trips', {
      fetch: fetchFn as unknown as typeof fetch,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost/trips',
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
    expect(result).toMatchObject({
      status: 200,
      payload: { found: true, entries: [expect.objectContaining({ key: 'trips' })] },
    });
    // The HTML is parsed into a detached document: its scripts never run.
    expect((window as { ran?: boolean }).ran).toBeUndefined();
  });

  it('says why there is no payload instead of guessing', async () => {
    const json = answer('{"a":1}', 'application/json', 404);
    expect(await refetchPayload('/x', { fetch: json as unknown as typeof fetch })).toEqual({
      error: 'The server answered 404 with `application/json`, not HTML.',
    });
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    });
    expect(await refetchPayload('/x', { fetch: failing as unknown as typeof fetch })).toEqual({
      error: 'The request failed: offline.',
    });
    const noParser = answer(html({}));
    expect(
      await refetchPayload('/x', { fetch: noParser as unknown as typeof fetch, parse: () => null }),
    ).toEqual({ error: 'This platform cannot parse HTML, so the payload cannot be read.' });
  });
});

describe('the page side of a refetch', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    httpRegistry().calls = [];
  });

  it('pushes the refetched payload masked, answers with counts, and ignores other pages', async () => {
    document.body.innerHTML = `<script id="ng-state" type="application/json">${JSON.stringify({ old: 1 })}</script>`;
    const calls: [string, unknown][] = [];
    const handlers = new Map<string, (message: unknown) => unknown>();
    const my = {
      rpc: {
        call: async (name: string, arg?: unknown) => {
          calls.push([name, arg]);
          if (name === 'get-http-rules') return [];
          return name === 'push-http' ? { needPayload: false } : { known: true };
        },
        register: (definition: { name: string; handler: (message: unknown) => unknown }) =>
          handlers.set(definition.name, definition.handler),
      },
    };
    const fetchFn = answer(html({ fresh: { password: 'PW-SECRET-9', note: JWT, city: 'Kyoto' } }));
    const http = attachHttp(my, 'p1', () => 0, { fetch: fetchFn as unknown as typeof fetch });
    try {
      await http.push();
      const refetch = handlers.get('http-payload-refetch')!;
      refetch({ requestId: 'x1', pageId: 'other' });
      expect(fetchFn).not.toHaveBeenCalled();

      refetch({ requestId: 'p1-r', pageId: 'p1' });
      await vi.waitFor(() =>
        expect(calls.some(([name]) => name === 'http-payload-refetch-result')).toBe(true),
      );
      const pushes = calls.filter(([name]) => name === 'push-http').map(([, arg]) => arg);
      const last = JSON.stringify(pushes.at(-1));
      expect(last).toContain('"fresh"');
      expect(last).toContain('Kyoto');
      expect(last).not.toContain('"old"');
      expect(last).not.toContain('PW-SECRET-9');
      expect(last).not.toContain(JWT);
      expect(pushes.at(-1)).toMatchObject({ payload: { refetchedAt: expect.any(Number) } });
      const [, result] = calls.find(([name]) => name === 'http-payload-refetch-result')!;
      expect(result).toEqual({
        requestId: 'p1-r',
        pageId: 'p1',
        result: { ok: true, status: 200, found: true, entries: 1, size: expect.any(Number) },
      });
    } finally {
      http.stop();
    }
  });
});

async function boot(config: PangularConfig = {}) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<unknown>;
  const payloads = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get('pangular:http-payloads')
    ).value() as HttpPayloadState;
  return { ctx, push, payloads };
}

const report = (pageId: string, payload: unknown) => ({
  pageId,
  url: `/${pageId}`,
  initialUrl: `/${pageId}`,
  title: pageId,
  hydration: { enabled: true, warnings: [], skipHydrationHosts: [] },
  calls: [],
  payload,
});

describe('refetch on the server', () => {
  it('asks the page, stores the new payload with refetchedAt and answers the agent', async () => {
    const { ctx, push, payloads } = await boot();
    await push('push-http', report('tab1', { found: true, size: 2, entries: [] }));
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: [{ requestId: string; pageId: string }];
    }) => {
      if (!options.method.endsWith('http-payload-refetch')) return;
      const { requestId, pageId } = options.args[0];
      await push(
        'push-http',
        report(pageId, {
          found: true,
          size: 20,
          entries: [{ key: 'trips', size: 20, value: { count: 3 } }],
        }),
      );
      await push('http-payload-refetch-result', {
        requestId,
        pageId,
        result: { ok: true, status: 200, found: true, entries: 1, size: 20 },
      });
    }) as never);
    const result = await toolAnswer(ctx.agent.invoke('pangular:refetch-transfer-state', {}));
    expect(result.isError).toBeFalsy();
    expect(result.markdown).toContain(
      'Refetched the TransferState of page `tab1`: the server answered 200 with 1 entry, 20 bytes.',
    );
    expect(result.markdown).toContain('`trips`');
    expect((await payloads()).pages['tab1']).toMatchObject({
      size: 20,
      refetchedAt: expect.any(Number),
    });
  });

  it('keeps the Refetched mark when the page sends its payload again', async () => {
    const { push, payloads } = await boot();
    await push('push-http', report('tab1', { found: true, size: 2, entries: [], refetchedAt: 7 }));
    expect((await payloads()).pages['tab1']).toMatchObject({ refetchedAt: 7 });
    await push(
      'push-http',
      report('tab1', { found: true, size: 2, entries: [], refetchedAt: 'x' }),
    );
    expect((await payloads()).pages['tab1']).not.toHaveProperty('refetchedAt');
  });

  it('refuses when actions.http is off, from the panel RPC as well', async () => {
    const { ctx, push } = await boot({ actions: { http: false } });
    await push('push-http', report('tab1', { found: true, size: 2, entries: [] }));
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    expect(ctx.agent.getTool('pangular:refetch-transfer-state')).toBeFalsy();
    expect(await push('request-http-payload-refetch', { pageId: 'tab1' })).toEqual({
      error:
        'Changing HTTP mock rules and SSR overrides, refetching the TransferState payload, and clearing HTTP calls is turned off in the devtools config (actions.http).',
    });
    expect(broadcast).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'pangular:http-payload-refetch' }),
    );
  });

  it('ignores an answer from a page the request did not go to', async () => {
    const { ctx, push } = await boot();
    await push('push-http', report('tab1', { found: true, size: 2, entries: [] }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
        method: string;
        args: [{ requestId: string }];
      }) => {
        if (!options.method.endsWith('http-payload-refetch')) return;
        await push('http-payload-refetch-result', {
          requestId: options.args[0].requestId,
          pageId: 'tab2',
          result: { ok: true, status: 200, found: true, entries: 0, size: 0 },
        });
      }) as never);
      const pending = push('request-http-payload-refetch', { pageId: 'tab1' });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await pending).toEqual({
        error: 'The page did not answer within 15s. Is the tab still open?',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
