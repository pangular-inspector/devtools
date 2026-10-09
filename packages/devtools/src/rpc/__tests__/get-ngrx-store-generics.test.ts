import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { getNgrxStore } from '../get-ngrx-store.ts';

async function storeFor(source: string) {
  const dir = fixtureDir('pangular-ngrx-generics-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'store.ts'), source);
  return scan(getNgrxStore, dir);
}

describe('get-ngrx-store generics', () => {
  it('keeps a withState feature whose type argument has a comma', async () => {
    const [store] = await storeFor(
      `export const S = signalStore(withState<Record<string, number>>({ a: 1 }), withMethods(() => ({ go() {} })));`,
    );
    expect(store.members?.state).toEqual(['a']);
    expect(store.members?.methods).toEqual(['go']);
  });

  it('does not report generic arguments inside a value as members', async () => {
    const [store] = await storeFor(
      `export const S = signalStore(withState({ cache: new Map<string, Set<number>>(), other: 1 }));`,
    );
    expect(store.members?.state).toEqual(['cache', 'other']);
  });
});
