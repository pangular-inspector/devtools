import { describe, expect, it } from 'vitest';
import { childPath, joinPath, splitPath } from '../forms-path.ts';

describe('form control paths', () => {
  it('keeps plain keys exactly as they were joined before', () => {
    expect(joinPath(['address', 'city'])).toBe('address.city');
    expect(joinPath(['items', '0', 'name'])).toBe('items.0.name');
    expect(joinPath(['name'])).toBe('name');
    expect(joinPath([])).toBe('');
    expect(splitPath('address.city')).toEqual(['address', 'city']);
    expect(splitPath('items.0.name')).toEqual(['items', '0', 'name']);
    expect(splitPath('')).toEqual([]);
  });

  it('writes a literal dot as \\. and a literal backslash as \\\\', () => {
    expect(joinPath(['a.b'])).toBe('a\\.b');
    expect(joinPath(['a\\b'])).toBe('a\\\\b');
    expect(joinPath(['a.b', 'c'])).toBe('a\\.b.c');
    expect(joinPath(['a', 'b.c'])).toBe('a.b\\.c');
    expect(joinPath(['\\.'])).toBe('\\\\\\.');
  });

  it('reads an escaped path back into its segments', () => {
    expect(splitPath('a\\.b')).toEqual(['a.b']);
    expect(splitPath('a\\.b.c')).toEqual(['a.b', 'c']);
    expect(splitPath('a\\\\.b')).toEqual(['a\\', 'b']);
    expect(splitPath('a\\\\\\.b')).toEqual(['a\\.b']);
  });

  it('round trips dots, backslashes, empty and numeric segments', () => {
    const cases = [
      ['a.b'],
      ['a.b', 'c.d'],
      ['x', 'a\\b', 'y'],
      ['\\'],
      ['.'],
      ['..'],
      ['a', ''],
      ['', 'a'],
      ['a', '', 'b'],
      ['0', '1.5', '2'],
      ['\\.', '.\\'],
      ['trailing\\'],
    ];
    for (const segments of cases) expect(splitPath(joinPath(segments))).toEqual(segments);
  });

  it('appends one key to an existing path', () => {
    expect(childPath('', 'name')).toBe('name');
    expect(childPath('', 'a.b')).toBe('a\\.b');
    expect(childPath('g', 'a.b')).toBe('g.a\\.b');
    expect(childPath('g\\.h', 'c')).toBe('g\\.h.c');
  });
});
