// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { redactMessage, setRedaction, SecretSet } from '../forms-privacy.ts';
import { serialize } from '../serialize.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';
import { redactRecord } from '../router.ts';
import { redactPreview } from '../http-redact.ts';

afterEach(() => setRedaction());

const b64 = (n: number, seed: string) => seed.repeat(Math.ceil(n / seed.length)).slice(0, n);
const longJwt = `eyJhbGciOiJIUzI1NiJ9.${b64(260, 'eyJzdWIiOiIxMjM0')}.${b64(43, 'sigsigsig')}`;

describe('redaction before clipping', () => {
  it('masks a JWT that straddles the ngrx maxString cut', () => {
    const text = `${'x'.repeat(280)} ${longJwt}`;
    const out = ngrxSerialize({ log: text }, { maxString: 300 }) as { log: string };
    expect(out.log).not.toContain('eyJ');
  });

  it('masks a JWT longer than the router clip in route params and query params', () => {
    const out = redactRecord({ next: longJwt, nested: { state: longJwt }, list: [longJwt] });
    expect(JSON.stringify(out)).not.toContain('eyJ');
    expect(JSON.stringify(out)).toContain('[redacted]');
  });
});

describe('redactMessage with overlapping secrets', () => {
  it('masks the longer secret first so no tail is left behind', () => {
    const set = new SecretSet();
    set.add('123');
    set.add('123456789');
    expect(set.redact('token 123456789 here')).toBe('token [redacted] here');
    expect(redactMessage('abcdef', ['abc', 'abcdef'])).toBe('[redacted]');
  });
});

describe('serialize object keys', () => {
  it('masks a JWT or bearer token used as an object key', () => {
    const out = serialize({ [longJwt]: 1, 'Bearer abcdefgh12345': 2 }) as Record<string, number>;
    expect(JSON.stringify(out)).not.toContain('eyJ');
    expect(JSON.stringify(out)).not.toContain('abcdefgh12345');
    expect(Object.values(out).sort()).toEqual([1, 2]);
  });

  it('keeps both entries when two keys redact to the same text', () => {
    const other = longJwt.replace('sigsigsig', 'othersigs');
    const out = serialize({ [longJwt]: 1, [other]: 2 }) as Record<string, number>;
    expect(Object.values(out).sort()).toEqual([1, 2]);
  });

  it('keeps an own __proto__ key as data', () => {
    const out = serialize(JSON.parse('{"__proto__":{"a":1},"b":2}')) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['__proto__', 'b']);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual({ a: 1 });
  });
});

describe('clipped JSON response previews', () => {
  it.each([
    ['a secret nested in an object', '{"user":{"password":"hunter2"},"n":[1', 'hunter2'],
    [
      'a secret whose value is an array',
      '{"password":["hunter2","hunter3"],"items":[{"id":1',
      'hunter3',
    ],
    [
      'a secret whose value is an object',
      '{"password":{"a":"hunter2","b":"x"},"n":2,"k',
      'hunter2',
    ],
  ])('masks %s', (_name, preview, leak) => {
    const out = redactPreview(preview);
    expect(out).not.toContain(leak);
    expect(out).toContain('[redacted]');
  });
});
