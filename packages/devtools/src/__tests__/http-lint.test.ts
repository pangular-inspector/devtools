import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';
import { lintHttp } from '../http-data.ts';
import type { HttpCall } from '../http-rules.ts';
import { lintHttpText } from '../rpc/http-lint.ts';
import type { HttpPage } from '../types.ts';
import { answerText } from './tool-answer.ts';

const call = (id: string, at: number, overrides: Partial<HttpCall> = {}): HttpCall => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  side: 'client',
  status: 200,
  durationMs: 100,
  at,
  cacheHit: false,
  faulted: false,
  pageUrl: '/shop',
  ...overrides,
});

describe('lintHttp duplicates', () => {
  it('flags the same GET again within 2000 ms on one page', () => {
    const findings = lintHttp([
      call('a', 0, { url: '/api/user' }),
      call('b', 300, { url: '/api/user' }),
      call('c', 900, { url: '/api/user' }),
      call('d', 5000, { url: '/api/user' }),
    ]);
    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'duplicate',
        message: 'GET /api/user ran 3 times within 900 ms.',
        callIds: ['a', 'b', 'c'],
        wastedMs: 200,
      }),
    ]);
  });

  it('leaves out other methods, other pages, cache hits, mocks and cancelled calls', () => {
    const findings = lintHttp([
      call('a', 0, { url: '/api/user' }),
      call('b', 10, { url: '/api/user', method: 'POST' }),
      call('c', 20, { url: '/api/user', pageUrl: '/other' }),
      call('d', 30, { url: '/api/user', cacheHit: true }),
      call('e', 40, { url: '/api/user', mocked: true }),
      call('f', 50, { url: '/api/user', cancelled: true }),
      call('g', 60, { url: '/api/user', side: 'server' }),
    ]);
    expect(findings.filter((f) => f.kind === 'duplicate')).toEqual([]);
  });
});

describe('lintHttp waterfalls', () => {
  it('flags 3 or more calls that each start right after the previous one ended', () => {
    const findings = lintHttp([
      call('a', 0),
      call('b', 110),
      call('c', 230, { durationMs: 300 }),
      call('parallel', 5),
    ]);
    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'waterfall',
        message:
          '3 calls ran one after another, 530 ms in all: GET /api/a → GET /api/b → GET /api/c.',
        callIds: ['a', 'b', 'c'],
        wastedMs: 230,
      }),
    ]);
  });

  it('does not chain overlapping calls, long gaps or two calls only', () => {
    expect(lintHttp([call('a', 0), call('b', 50), call('c', 100)])).toEqual([]);
    expect(lintHttp([call('a', 0), call('b', 400), call('c', 800)])).toEqual([]);
    expect(lintHttp([call('a', 0), call('b', 100)])).toEqual([]);
    expect(lintHttp([call('a', 0), call('b', 100)], { minChain: 2 })).toHaveLength(1);
  });
});

describe('lintHttp refetches', () => {
  it('flags a server call the browser made again, once per request', () => {
    const findings = lintHttp(
      [call('c1', 1000, { url: '/api/p?x=1' }), call('c2', 9000, { url: '/api/p?x=1' })],
      {
        serverCalls: [
          call('s1', 0, { side: 'server', url: 'http://api.test/api/p?x=1' }),
          call('s2', 0, { side: 'server', url: 'http://api.test/api/err', status: 500 }),
        ],
      },
    );
    expect(findings.filter((f) => f.kind === 'refetch')).toEqual([
      expect.objectContaining({
        message: 'GET /api/p?x=1 ran on the server and again in the browser.',
        callIds: ['s1', 'c1'],
      }),
    ]);
  });
});

describe('lintHttpText', () => {
  const page = (calls: HttpCall[], extra: Partial<HttpPage> = {}): HttpPage => ({
    pageId: 'p1',
    url: '/shop',
    initialUrl: '/shop',
    title: 'Shop',
    hydration: null,
    calls,
    firstSeenAt: 1,
    reportedAt: 1,
    ...extra,
  });

  it('groups findings by kind with call ids and a fix', () => {
    const text = lintHttpText({
      pages: [
        page(
          [
            call('a', 0, { url: '/api/user' }),
            call('b', 300, { url: '/api/user' }),
            call('c', 5000, { url: '/api/p' }),
          ],
          { ssrRequestId: 'r1' },
        ),
      ],
      serverCalls: [call('s1', 0, { side: 'server', url: 'http://api/api/p', requestId: 'r1' })],
    });
    expect(text).toContain('2 findings in the 3 client calls of page `p1`');
    expect(text).toContain('### Duplicate requests (1)');
    expect(text).toContain('- GET /api/user ran 2 times within 300 ms. About 100 ms to win.');
    expect(text).toContain('  - Calls: `a`, `b`');
    expect(text).toContain('### Repeated server calls (1)');
    expect(text).not.toContain('### Request waterfalls');
  });

  it('masks secrets in URLs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const url = `/api/me?access_token=${jwt}`;
    const text = lintHttpText({
      pages: [page([call('a', 0, { url }), call('b', 10, { url })])],
      serverCalls: [],
    });
    expect(text).toContain('ran 2 times');
    expect(text).not.toContain(jwt);
  });

  it('says when there is nothing to report, no page, or an unknown page', () => {
    expect(lintHttpText({ pages: [page([call('a', 0)])], serverCalls: [] })).toContain(
      'No duplicate requests, waterfalls or repeated server calls',
    );
    expect(lintHttpText({ pages: [], serverCalls: [] })).toMatch(/^No page reports HTTP calls/);
    expect(lintHttpText({ pages: [page([])], serverCalls: [] })).toContain(
      'has made no HttpClient calls yet',
    );
    expect(lintHttpText({ pages: [page([])], serverCalls: [] }, { page: 'nope' })).toContain(
      'nope',
    );
  });
});

describe('lint-http agent tool', () => {
  it('is registered with the http inspector and answers from the http state', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({}).setup(ctx as never);
    expect(ctx.agent.list().tools.map((t) => t.id)).toContain('pangular:lint-http');
    const text = await answerText(ctx.agent.invoke('pangular:lint-http', {}));
    expect(text).toMatch(/^No page reports HTTP calls/);

    const off = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({ inspectors: { http: false } }).setup(off as never);
    expect(off.agent.list().tools.map((t) => t.id)).not.toContain('pangular:lint-http');
  });
});
