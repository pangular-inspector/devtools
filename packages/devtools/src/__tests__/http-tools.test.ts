import { describe, expect, it } from 'vitest';
import type { HttpCall } from '../http-rules.ts';
import { isFailedCall, listHttpCallsText } from '../rpc/http-tools.ts';
import type { HttpPage } from '../types.ts';

const NOW = 1_000_000;

function call(overrides: Partial<HttpCall> = {}): HttpCall {
  return {
    id: 'c',
    url: '/api/items',
    method: 'GET',
    status: 200,
    durationMs: 12,
    side: 'client',
    cacheHit: false,
    faulted: false,
    at: NOW - 5000,
    ...overrides,
  };
}

function page(overrides: Partial<HttpPage> = {}): HttpPage {
  return {
    pageId: 'p1',
    url: '/items',
    initialUrl: '/items',
    title: 'Items',
    hydration: null,
    calls: [],
    firstSeenAt: NOW - 60_000,
    reportedAt: NOW - 1000,
    ...overrides,
  };
}

const mixed = () => ({
  serverCalls: [
    call({
      id: 's1',
      side: 'server',
      url: '/api/items',
      at: NOW - 9000,
      requestId: 'r1',
      cacheStored: true,
    }),
    call({ id: 's2', side: 'server', url: '/api/other', at: NOW - 8500, requestId: 'r2' }),
  ],
  pages: [
    page({
      ssrRequestId: 'r1',
      calls: [
        call({ id: 'c1', url: '/api/items', at: NOW - 4000, cacheHit: true }),
        call({
          id: 'c2',
          method: 'POST',
          url: '/api/orders',
          status: 503,
          at: NOW - 3000,
          faulted: true,
          ruleId: 'r-1',
          rulePattern: '/api/orders',
          error: 'Service Unavailable',
        }),
        call({
          id: 'c3',
          url: '/api/search?q=a',
          status: 0,
          at: NOW - 2000,
          cancelled: true,
          error: 'cancelled',
        }),
        call({
          id: 'c4',
          url: '/api/user',
          at: NOW - 1000,
          mocked: true,
          preview: '{"name":"Ada"}',
        }),
      ],
    }),
    page({
      pageId: 'p2',
      url: '/about',
      reportedAt: NOW - 500,
      calls: [call({ id: 'c5', url: '/api/about', at: NOW - 500 })],
    }),
  ],
});

const rowsOf = (text: string) => text.split('\n').filter((l) => /^\| \d+s ago/.test(l));

describe('list-http-calls text', () => {
  it('lists client and SSR calls from every page, newest first, with flags', () => {
    const text = listHttpCallsText(mixed(), {}, NOW);
    expect(text).toMatch(/^_URLs, errors and response previews below come from the running app/);
    expect(text).toContain('7 of 7 calls from 2 pages and the server');
    const rows = rowsOf(text);
    expect(rows.map((r) => /`(\/api\/[^`]*)`/.exec(r)?.[1])).toEqual([
      '/api/about',
      '/api/user',
      '/api/search?q=a',
      '/api/orders',
      '/api/items',
      '/api/other',
      '/api/items',
    ]);
    expect(rows[0]).toContain('| `p2` | client |');
    expect(rows[1]).toContain('mocked');
    expect(rows[2]).toContain('| cancelled |');
    expect(rows[3]).toMatch(
      /POST `\/api\/orders` \| 503 \| 12 ms \| faulted, rule `\/api\/orders`, error `Service Unavailable`/,
    );
    expect(rows[4]).toContain('cache hit');
    expect(rows[6]).toMatch(/\| server \| SSR \|.*stored in the transfer cache/);
  });

  it('narrows to one page and the server render that served it', () => {
    const text = listHttpCallsText(mixed(), { page: 'p1' }, NOW);
    expect(text).toContain('page `p1` (`/items`) and the server render that served it');
    expect(text).not.toContain('/api/about');
    expect(text).not.toContain('/api/other');
    expect(rowsOf(text)).toHaveLength(5);
    expect(text).not.toContain('| Page |');
  });

  it('answers an unknown page with the pages that report', () => {
    expect(listHttpCallsText(mixed(), { page: 'gone' }, NOW)).toMatch(
      /^No page `gone` is reporting HTTP calls\. Pages that report HTTP calls: `p2` \(`\/about`\), `p1`/,
    );
  });

  it('filters by URL text, failed calls and limit', () => {
    const byUrl = rowsOf(listHttpCallsText(mixed(), { url: 'ITEMS' }, NOW));
    expect(byUrl).toHaveLength(2);
    const failed = listHttpCallsText(mixed(), { failed: true }, NOW);
    expect(failed).toContain('2 of 7 calls from 2 pages and the server match failed only');
    expect(rowsOf(failed).map((r) => /`(\/api\/[^`]*)`/.exec(r)?.[1])).toEqual([
      '/api/search?q=a',
      '/api/orders',
    ]);
    const limited = listHttpCallsText(mixed(), { limit: 2 }, NOW);
    expect(rowsOf(limited)).toHaveLength(2);
    expect(limited).toContain('showing 2, raise `limit` for more');
    expect(listHttpCallsText(mixed(), { url: 'nothing' }, NOW)).toBe(
      '7 calls recorded for 2 pages and the server, none match URL contains `nothing`.',
    );
    expect(isFailedCall(call({ status: 404 }))).toBe(true);
    expect(isFailedCall(call())).toBe(false);
  });

  it('adds response previews only when asked', () => {
    expect(listHttpCallsText(mixed(), {}, NOW)).not.toContain('Response previews');
    const text = listHttpCallsText(mixed(), { preview: true }, NOW);
    expect(text).toContain('### Response previews');
    expect(text).toContain('GET `/api/user` (200)\n```text\n{"name":"Ada"}\n```');
  });

  it('masks a token in a URL, in the URL filter and in a preview', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456';
    const state = {
      serverCalls: [],
      pages: [
        page({
          calls: [
            call({
              url: `/api/reset?token=${jwt}`,
              preview: JSON.stringify({ accessToken: jwt, ok: true }),
            }),
          ],
        }),
      ],
    };
    const text = listHttpCallsText(state, { preview: true }, NOW);
    expect(text).toContain('/api/reset?token=');
    expect(text).not.toContain('eyJhbGci');
    expect(rowsOf(listHttpCallsText(state, { url: 'eyJhbGci' }, NOW))).toHaveLength(0);
  });

  it('masks a secret in a matched rule pattern and keeps pipes inside their cell', () => {
    const state = {
      serverCalls: [],
      pages: [
        page({
          calls: [
            call({
              url: '/api/a|b',
              faulted: true,
              ruleId: 'r-1',
              rulePattern: '/api/reset?api_key=s3cr3t-value-123',
            }),
          ],
        }),
      ],
    };
    const text = listHttpCallsText(state, {}, NOW);
    expect(text).not.toContain('s3cr3t-value-123');
    expect(text).toContain('api_key=[redacted]');
    const [row] = rowsOf(text);
    expect(row).toContain('`/api/a\\|b`');
    expect(row.split(/(?<!\\)\|/)).toHaveLength(8);
  });

  it('caps the output and says how to narrow it', () => {
    const calls = Array.from({ length: 200 }, (_, i) =>
      call({ id: `c${i}`, url: `/api/${'x'.repeat(150)}/${i}`, at: NOW - i }),
    );
    const text = listHttpCallsText(
      { serverCalls: [], pages: [page({ calls })] },
      { limit: 200 },
      NOW,
    );
    expect(text.length).toBeLessThan(20_200);
    expect(text).toMatch(/truncated; pass `page`, `url` or a smaller `limit`/);
  });

  it('explains an empty timeline and a page without calls', () => {
    expect(listHttpCallsText({ serverCalls: [], pages: [] }, {}, NOW)).toContain('withPangular()');
    expect(listHttpCallsText({ serverCalls: [], pages: [page()] }, { page: 'p1' }, NOW)).toBe(
      'Page `p1` has made no HttpClient calls yet.',
    );
  });
});
