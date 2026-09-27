// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_DELAY_MS,
  MAX_RULES,
  RULES_STORAGE_KEY,
  clientRules,
  httpRegistry,
  MAX_CALLS,
  matchRule,
  sanitizeCalls,
  sanitizeRules,
  storeRules,
  type HttpRule,
} from '../http-rules.ts';
import { decodePayload, sanitizeHydration, sanitizePayload } from '../http-payload.ts';

const rule = (overrides: Partial<HttpRule> = {}): HttpRule => ({
  id: 'r1',
  pattern: '/api/products',
  enabled: true,
  target: 'both',
  status: 500,
  ...overrides,
});

describe('matchRule', () => {
  it('matches by substring on relative and absolute URLs', () => {
    const rules = [rule()];
    expect(matchRule('/api/products?x=1', 'GET', rules, 'client')?.id).toBe('r1');
    expect(matchRule('http://localhost:4000/api/products', 'GET', rules, 'server')?.id).toBe('r1');
    expect(matchRule('/api/users', 'GET', rules, 'client')).toBeUndefined();
  });

  it('supports * globs', () => {
    const rules = [rule({ pattern: '/api/*/42' })];
    expect(matchRule('/api/products/42', 'GET', rules, 'client')).toBeDefined();
    expect(matchRule('http://host/api/orders/42', 'GET', rules, 'server')).toBeDefined();
    expect(matchRule('/api/products/7', 'GET', rules, 'client')).toBeUndefined();
  });

  it('filters by method, side and enabled flag', () => {
    expect(matchRule('/api/products', 'post', [rule({ method: 'POST' })], 'client')).toBeDefined();
    expect(matchRule('/api/products', 'GET', [rule({ method: 'POST' })], 'client')).toBeUndefined();
    expect(
      matchRule('/api/products', 'GET', [rule({ target: 'server' })], 'client'),
    ).toBeUndefined();
    expect(matchRule('/api/products', 'GET', [rule({ target: 'server' })], 'server')).toBeDefined();
    expect(matchRule('/api/products', 'GET', [rule({ enabled: false })], 'client')).toBeUndefined();
    expect(matchRule('/api/products', 'GET', undefined, 'client')).toBeUndefined();
  });

  it('returns the first matching rule', () => {
    const rules = [rule({ id: 'a', enabled: false }), rule({ id: 'b' }), rule({ id: 'c' })];
    expect(matchRule('/api/products', 'GET', rules, 'client')?.id).toBe('b');
  });
});

describe('sanitizeRules', () => {
  it('drops malformed input', () => {
    expect(sanitizeRules(null)).toEqual([]);
    expect(sanitizeRules('x')).toEqual([]);
    expect(sanitizeRules([null, 1, {}, { pattern: '   ' }])).toEqual([]);
  });

  it('normalises fields', () => {
    const [r] = sanitizeRules([
      {
        pattern: ' /api ',
        method: 'get',
        target: 'weird',
        status: 42,
        delayMs: 999_999,
        body: '{}',
      },
    ]);
    expect(r).toMatchObject({
      id: 'r1',
      pattern: '/api',
      method: 'GET',
      target: 'both',
      enabled: true,
      body: '{}',
    });
    expect(r.status).toBeUndefined();
    expect(r.delayMs).toBe(MAX_DELAY_MS);
  });

  it('rejects bad methods and caps the rule count', () => {
    expect(sanitizeRules([{ pattern: '/a', method: 'G T' }])[0].method).toBeUndefined();
    const many = Array.from({ length: MAX_RULES + 10 }, (_, i) => ({ pattern: `/p${i}` }));
    expect(sanitizeRules(many)).toHaveLength(MAX_RULES);
  });
});

describe('push-http report sanitizers', () => {
  it('drops malformed calls and caps the count', () => {
    const ok = { id: 'c1', url: '/a', method: 'GET', status: 200 };
    expect(sanitizeCalls([null, {}, { id: 'x' }, ok])).toEqual([
      expect.objectContaining({ ...ok, side: 'client', cacheHit: false, durationMs: 0 }),
    ]);
    expect(sanitizeCalls('x')).toEqual([]);
    const many = Array.from({ length: MAX_CALLS + 5 }, (_, i) => ({ ...ok, id: `c${i}` }));
    expect(sanitizeCalls(many)).toHaveLength(MAX_CALLS);
  });

  it('falls back for malformed payloads and hydration stats', () => {
    expect(sanitizePayload(null)).toEqual({ found: false, size: 0, entries: [] });
    expect(sanitizePayload({ found: true, entries: [1, { key: 'k', value: 2 }] }).entries).toEqual([
      { key: 'k', size: 0, value: 2 },
    ]);
    expect(sanitizeHydration({})).toBeNull();
    expect(sanitizeHydration({ enabled: true, warnings: ['w', 3] })).toMatchObject({
      enabled: true,
      skipHydrationHosts: [],
      warnings: ['w'],
    });
  });
});

describe('client rule storage', () => {
  afterEach(() => {
    sessionStorage.clear();
    delete httpRegistry().rules;
  });

  it('persists rules and reads them back after a reload', () => {
    storeRules([rule()]);
    expect(JSON.parse(sessionStorage.getItem(RULES_STORAGE_KEY) ?? '[]')).toHaveLength(1);
    delete httpRegistry().rules;
    expect(clientRules()[0].pattern).toBe('/api/products');
  });

  it('removes storage when rules are cleared and survives bad JSON', () => {
    storeRules([rule()]);
    storeRules([]);
    expect(sessionStorage.getItem(RULES_STORAGE_KEY)).toBeNull();
    delete httpRegistry().rules;
    sessionStorage.setItem(RULES_STORAGE_KEY, '{nope');
    expect(clientRules()).toEqual([]);
  });
});

describe('decodePayload', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const addState = (text: string, id = 'ng-state') => {
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/json';
    script.textContent = text;
    document.body.append(script);
  };

  it('reports a missing payload', () => {
    expect(decodePayload(document)).toEqual({ found: false, size: 0, entries: [] });
  });

  it('decodes HTTP transfer-cache entries and plain keys', () => {
    addState(
      JSON.stringify({
        '123': { b: [{ id: 1 }], s: 200, st: 'OK', u: '/api/products', rt: 'json' },
        theme: 'dark',
      }),
    );
    const summary = decodePayload(document);
    expect(summary.found).toBe(true);
    expect(summary.entries).toHaveLength(2);
    const http = summary.entries.find((e) => e.key === '123');
    expect(http?.http).toEqual({
      url: '/api/products',
      status: 200,
      statusText: 'OK',
      responseType: 'json',
    });
    expect(http?.value).toEqual([{ id: 1 }]);
    expect(summary.entries.find((e) => e.key === 'theme')?.value).toBe('dark');
  });

  it('uses a custom app id and reports parse errors', () => {
    addState('{bad', 'shop-state');
    const summary = decodePayload(document, 'shop');
    expect(summary.found).toBe(true);
    expect(summary.error).toBeTruthy();
  });
});
