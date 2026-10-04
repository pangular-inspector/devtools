// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { serialize, serializeNamed } from '../serialize.ts';

class _Trip {
  city = 'Paris';
}

describe('serialize', () => {
  it('handles Map, Set, Date and class instances', () => {
    expect(serialize(new Map([['a', 1]]))).toEqual({ $type: 'Map', size: 1, entries: [['a', 1]] });
    expect(serialize(new Set([1, 2]))).toEqual({ $type: 'Set', size: 2, values: [1, 2] });
    expect(serialize(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(serialize(new _Trip())).toEqual({ $type: 'Trip', city: 'Paris' });
  });

  it('marks cycles but keeps shared references', () => {
    const shared = { n: 1 };
    const loop: Record<string, unknown> = { shared, again: shared };
    loop['self'] = loop;
    expect(serialize(loop)).toEqual({ shared: { n: 1 }, again: { n: 1 }, self: '[Circular]' });
  });

  it('limits depth, keys, items and text', () => {
    expect(serialize({ a: { b: { c: 1 } } }, { depth: 1 })).toEqual({ a: '[Object]' });
    expect(serialize([1, 2, 3], { items: 2 })).toEqual([1, 2, '… 1 more']);
    expect(serialize({ a: 1, b: 2 }, { keys: 1 })).toEqual({ a: 1, '…': '1 more' });
    expect(serialize('abcdef', { text: 3 })).toBe('abc…');
  });

  it('marks text cut by the redaction window when the text limit is larger', () => {
    const out = serialize('a'.repeat(70000), { text: 100000 }) as string;
    expect(out).toBe(`${'a'.repeat(65536)}…`);
  });

  it('turns non-JSON values into readable text', () => {
    expect(serialize(Symbol('ERRORED'))).toBe('(threw an error)');
    expect(serialize(Symbol('UNSET'))).toBe('(not computed yet)');
    expect(serialize(10n)).toBe('10n');
    expect(serialize(NaN)).toBe('NaN');
    expect(serialize(function load() {})).toBe('[Function load]');
    expect(serialize(document.createElement('app-card'))).toBe('<app-card>');
    const throwing = {
      get boom() {
        throw new Error('no');
      },
    };
    expect(serialize(throwing)).toEqual({ boom: '[Unreadable]' });
  });

  it('redacts secret keys and token-looking strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghijk';
    expect(
      serialize({
        password: 'x',
        token: jwt,
        user: { accessToken: 'abc', name: 'Ana', hasPassword: true, apiKey: null },
        auth: `Bearer ${jwt}`,
        note: `id ${jwt}`,
        secrets: new Map([['clientSecret', 's3']]),
      }),
    ).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      user: { accessToken: '[redacted]', name: 'Ana', hasPassword: true, apiKey: null },
      auth: 'Bearer [redacted]',
      note: 'id [redacted]',
      secrets: '[redacted]',
    });
    expect(serialize(new Map([['clientSecret', 's3']]))).toEqual({
      $type: 'Map',
      size: 1,
      entries: [['clientSecret', '[redacted]']],
    });
    expect(serializeNamed('password', 'hunter2')).toBe('[redacted]');
    expect(serializeNamed('email', 'a@b.c')).toBe('a@b.c');
  });

  it('honors the mask and unmask config', () => {
    const g = globalThis as { __PANGULAR_FORMS__?: unknown };
    g.__PANGULAR_FORMS__ = { mask: ['email'], unmask: ['pin'] };
    try {
      expect(serialize({ email: 'a@b.c', pin: 1234 })).toEqual({ email: '[redacted]', pin: 1234 });
    } finally {
      delete g.__PANGULAR_FORMS__;
    }
  });

  it('stops after a total node budget', () => {
    const row = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}`, i]));
    const shared = Array.from({ length: 40 }, () => row);
    const big = Array.from({ length: 40 }, () => shared);
    const out = JSON.stringify(serialize(big, { budget: 100 }));
    expect(out).toContain('[Truncated]');
    expect(out.match(/"f\d+":\d+/g)!.length).toBeLessThan(100);
    expect(JSON.stringify(serialize(big))).toContain('[Truncated]');
  });
});
