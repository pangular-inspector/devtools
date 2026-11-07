import { describe, expect, it } from 'vitest';
import type { HttpCall } from '../http-rules.ts';
import type { NavigationRecord } from '../router.ts';
import {
  AFTER_MS,
  callsForNavigation,
  navigationCallsLines,
  nextNavigation,
} from '../rpc/router-http.ts';
import { explainNavigationText, type RouterPage } from '../rpc/router-tools.ts';

function call(id: string, at: number, extra: Partial<HttpCall> = {}): HttpCall {
  return {
    id,
    url: `/api/${id}`,
    method: 'GET',
    status: 200,
    durationMs: 12,
    side: 'client',
    cacheHit: false,
    faulted: false,
    at,
    ...extra,
  };
}

function nav(
  id: number,
  startedAt: number,
  extra: Partial<NavigationRecord> = {},
): NavigationRecord {
  return {
    id,
    url: `/p${id}`,
    trigger: 'imperative',
    startedAt,
    endedAt: startedAt + 100,
    outcome: 'succeeded',
    ...extra,
  };
}

describe('callsForNavigation', () => {
  const calls = [
    call('before', 900),
    call('resolver', 1050),
    call('component', 1200),
    call('server', 1210, { side: 'server' }),
    call('late', 1100 + AFTER_MS + 1),
    call('next', 3000),
  ];

  it('splits the calls of a navigation into while it ran and after it ended', () => {
    const first = nav(1, 1000);
    const result = callsForNavigation(first, nav(2, 2500), calls);
    expect(result.during.map((c) => c.id)).toEqual(['resolver']);
    expect(result.after.map((c) => c.id)).toEqual(['component']);
  });

  it('stops the after window at the next navigation or after 5 seconds', () => {
    const last = nav(1, 1000);
    expect(callsForNavigation(last, undefined, calls).after.map((c) => c.id)).toEqual([
      'component',
      'next',
    ]);
  });

  it('gives probes and navigations from before the inspector connected no calls', () => {
    expect(callsForNavigation(nav(1, 1000, { probe: true }), undefined, calls).during).toEqual([]);
    expect(
      callsForNavigation(nav(1, 1000, { beforeConnect: true }), undefined, calls).after,
    ).toEqual([]);
  });

  it('redacts the URLs it returns', () => {
    const secret = call('s', 1050, { url: '/api/me?access_token=abcdef123456' });
    const [found] = callsForNavigation(nav(1, 1000), undefined, [secret]).during;
    expect(found.url).not.toContain('abcdef123456');
  });

  it('finds the next navigation, skipping probes', () => {
    const list = [nav(1, 1), nav(2, 2, { probe: true }), nav(3, 3)];
    expect(nextNavigation(list, list[0])?.id).toBe(3);
  });

  it('lists the calls with method, status and time', () => {
    const lines = navigationCallsLines({
      during: [call('a', 1, { status: 404 })],
      after: [call('b', 2, { cacheHit: true })],
    });
    expect(lines[0]).toBe(
      '  - HTTP calls while it ran (1, from the HTTP inspector): GET `/api/a` 404 12ms',
    );
    expect(lines[1]).toContain('GET `/api/b` 200 12ms (cache hit)');
  });
});

describe('explain-navigation with HTTP calls', () => {
  const page: RouterPage = {
    pageId: 'p1',
    snapshot: null,
    navigations: [nav(1, 1000, { requests: { count: 1, urls: ['/x'] } }), nav(2, 9000)],
    reportedAt: Date.now(),
    changedAt: Date.now(),
  };

  it('uses the HTTP inspector calls in place of resource timing when it has some', () => {
    const text = explainNavigationText({ pages: [page] }, { id: 1 }, Date.now(), 50, () => [
      call('resolver', 1050),
    ]);
    expect(text).toContain('HTTP calls while it ran (1, from the HTTP inspector)');
    expect(text).not.toContain('HTTP request(s) during it');
  });

  it('keeps the resource timing line when the HTTP inspector has nothing', () => {
    const text = explainNavigationText({ pages: [page] }, { id: 1 }, Date.now(), 50, () => []);
    expect(text).toContain('1 HTTP request(s) during it');
  });
});
