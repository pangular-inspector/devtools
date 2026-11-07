import '@angular/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import { timingLabel } from '../http.ts';
import { MAX_TIMED_FETCHES, noteSsrFetch, ssrRegistry } from '../ssr-registry.ts';
import { beginSsrTrace, ssrTimingEntries, timingText } from '../ssr-trace.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('Server-Timing entry per server call', () => {
  afterEach(() => {
    ssrRegistry().record = undefined;
    ssrRegistry().active.clear();
  });

  it('adds a fetch-<n> entry with the method, path and time of each call', () => {
    ssrRegistry().record = () => {};
    const trace = beginSsrTrace('/shop', 'abc')!;
    noteSsrFetch('abc', 12, timingLabel('GET', 'http://api.test/api/products?token=x'));
    noteSsrFetch('abc', 30, timingLabel('POST', '/api/cart'));
    noteSsrFetch('abc', 5);
    expect(ssrTimingEntries(trace, 80)).toEqual([
      'pangular;desc="abc"',
      'render;dur=80',
      'fetch;desc="3 calls";dur=47',
      'fetch-1;desc="GET /api/products";dur=12',
      'fetch-2;desc="POST /api/cart";dur=30',
    ]);
  });

  it(`stops at ${MAX_TIMED_FETCHES} calls but keeps counting them all`, () => {
    ssrRegistry().record = () => {};
    const trace = beginSsrTrace('/shop', 'many')!;
    for (let i = 0; i < 25; i++) noteSsrFetch('many', 1, `GET /api/${i}`);
    const entries = ssrTimingEntries(trace, 10);
    expect(entries.filter((e) => e.startsWith('fetch-'))).toHaveLength(MAX_TIMED_FETCHES);
    expect(entries).toContain('fetch;desc="25 calls";dur=25');
  });

  it('leaves the query out and masks tokens in the path', () => {
    expect(timingLabel('GET', `/api/users/${JWT}/orders?apiKey=secret`)).not.toContain(JWT);
    expect(timingLabel('GET', '/api/x?apiKey=secret')).toBe('GET /api/x');
  });

  it('quotes descriptions safely', () => {
    expect(timingText('GET /a"b\\c')).toBe('"GET /a\\"b\\\\c"');
    expect(timingText('GET /café')).toBe('"GET /caf?"');
    expect(timingText('x'.repeat(150))).toHaveLength(102);
  });
});
