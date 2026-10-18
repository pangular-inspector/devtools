import { describe, expect, it } from 'vitest';
import { plural, prettyJson, time } from '../format';

describe('time', () => {
  it('formats a timestamp as the local time of day', () => {
    const at = new Date(2026, 0, 2, 13, 4, 5).getTime();
    expect(time(at)).toBe(new Date(at).toLocaleTimeString());
  });
});

describe('prettyJson', () => {
  it('indents objects and arrays by 2 spaces, like JSON.stringify', () => {
    const value = { a: 1, b: [true, null, { c: 'x' }], d: {}, e: [], f: 'p:q,{r}"s"' };
    expect(prettyJson(JSON.stringify(value))).toBe(JSON.stringify(value, null, 2));
  });

  it('keeps numbers and escapes as written', () => {
    expect(prettyJson('{"id":12345678901234567890,"s":"a\\"b\\\\","n":1.50}')).toBe(
      '{\n  "id": 12345678901234567890,\n  "s": "a\\"b\\\\",\n  "n": 1.50\n}',
    );
  });

  it('returns null for text, clipped JSON and bare values', () => {
    expect(prettyJson('hello')).toBeNull();
    expect(prettyJson('{"a":[1,2')).toBeNull();
    expect(prettyJson('{"a":1}…')).toBeNull();
    expect(prettyJson('42')).toBeNull();
    expect(prettyJson('"text"')).toBeNull();
  });
});

describe('plural', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(plural(1, 'route')).toBe('1 route');
    expect(plural(0, 'route')).toBe('0 routes');
    expect(plural(2, 'navigation is', 'navigations are')).toBe('2 navigations are');
  });
});
