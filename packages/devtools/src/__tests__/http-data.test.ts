import { describe, expect, it } from 'vitest';
import { callsMatchingRule, ruleScopeMatches, urlGlobMatch } from '../http-data.ts';
import { matchRule, type HttpRule } from '../http-rules.ts';
import { urlGlobMatch as reexported } from '../url-glob.ts';

const call = (url: string, method = 'GET', side: 'client' | 'server' = 'client') => ({
  id: url,
  url,
  method,
  side,
});

describe('urlGlobMatch', () => {
  it('is the matcher url-glob.ts exports', () => {
    expect(reexported).toBe(urlGlobMatch);
  });

  it('matches anywhere, or from the path start with ^', () => {
    expect(urlGlobMatch('/v1/api/x', '/api')).toBe(true);
    expect(urlGlobMatch('/v1/api/x', '^/api')).toBe(false);
    expect(urlGlobMatch('http://host/api/x?y=1', '^/api/*')).toBe(true);
  });
});

describe('callsMatchingRule', () => {
  const calls = [
    call('/api/products'),
    call('/api/products/7'),
    call('/api/cart', 'POST'),
    call('http://api.test/api/products', 'GET', 'server'),
  ];

  it('returns nothing for an empty pattern', () => {
    expect(callsMatchingRule(calls, { pattern: '  ', target: 'both' })).toEqual([]);
  });

  it('applies the pattern, the method in any case and the target', () => {
    const ids = (scope: Parameters<typeof callsMatchingRule>[1]) =>
      callsMatchingRule(calls, scope).map((c) => c.id);
    expect(ids({ pattern: '/api/products', target: 'both' })).toHaveLength(3);
    expect(ids({ pattern: '/api/*', method: 'post', target: 'both' })).toEqual(['/api/cart']);
    expect(ids({ pattern: '/api/*', target: 'server' })).toEqual(['http://api.test/api/products']);
    expect(ids({ pattern: ' ^/api/cart ', target: 'client' })).toEqual(['/api/cart']);
  });

  it('agrees with the rule the interceptor picks', () => {
    const rule: HttpRule = {
      id: 'r1',
      pattern: '^/api/products',
      method: 'GET',
      enabled: true,
      target: 'client',
      status: 503,
    };
    for (const c of calls) {
      expect(ruleScopeMatches(rule, c)).toBe(!!matchRule(c.url, c.method, [rule], c.side));
    }
  });
});
