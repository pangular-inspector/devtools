import { describe, expect, it } from 'vitest';
import { LAST_BASE_KEY, orderedBases, rememberBase } from '../overlay-connection.ts';
import { DEVTOOLS_BASES } from '../panel-frame.ts';

function memory(initial?: string) {
  const items = new Map<string, string>(initial ? [[LAST_BASE_KEY, initial]] : []);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

describe('the bases the overlay probes', () => {
  it('keeps the default order until a base has answered', () => {
    expect(orderedBases(DEVTOOLS_BASES, memory())).toEqual(DEVTOOLS_BASES);
    expect(orderedBases(DEVTOOLS_BASES, undefined)).toEqual(DEVTOOLS_BASES);
  });

  it('tries the base that answered last first, so a later setup logs no 404 on reload', () => {
    const storage = memory();
    rememberBase(
      DEVTOOLS_BASES,
      'http://localhost:4200/__pangular/__connection.json',
      'http://localhost:4200/trips/1',
      storage,
    );
    expect(storage.items.get(LAST_BASE_KEY)).toBe('/__pangular/');
    expect(orderedBases(DEVTOOLS_BASES, storage)).toEqual([
      '/__pangular/',
      '/__devframes/pangular/',
      './',
      '/__devframe/',
    ]);
  });

  it('remembers nothing that is not a default base on this origin', () => {
    const storage = memory();
    rememberBase(
      DEVTOOLS_BASES,
      'http://other:9999/__pangular/__connection.json',
      'http://localhost:4200/',
      storage,
    );
    rememberBase(
      DEVTOOLS_BASES,
      'http://localhost:4200/custom/x.json',
      'http://localhost:4200/',
      storage,
    );
    rememberBase(DEVTOOLS_BASES, undefined, 'http://localhost:4200/', storage);
    expect(storage.items.size).toBe(0);
  });

  it('ignores a stored value that is not a default base, and storage that throws', () => {
    expect(orderedBases(DEVTOOLS_BASES, memory('https://evil.example/'))).toEqual(DEVTOOLS_BASES);
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(orderedBases(DEVTOOLS_BASES, broken)).toEqual(DEVTOOLS_BASES);
    expect(() =>
      rememberBase(DEVTOOLS_BASES, 'http://a/__pangular/__connection.json', 'http://a/', broken),
    ).not.toThrow();
  });
});
