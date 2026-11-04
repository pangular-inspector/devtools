import { describe, expect, it } from 'vitest';
import { ancestors } from '../pages/component-tree';

describe('ancestors', () => {
  it('lists the ids above a node, nearest first', () => {
    const parents = new Map([
      ['c3', 'c2'],
      ['c2', 'c1'],
    ]);
    expect(ancestors(parents, 'c3')).toEqual(['c2', 'c1']);
    expect(ancestors(parents, 'c1')).toEqual([]);
  });

  it('stops when an id repeats instead of looping', () => {
    const parents = new Map([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'b'],
    ]);
    expect(ancestors(parents, 'a')).toEqual(['b', 'c']);
    expect(ancestors(new Map([['a', 'a']]), 'a')).toEqual([]);
  });
});
