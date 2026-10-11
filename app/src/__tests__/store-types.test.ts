import { describe, expect, it } from 'vitest';
import { changeCountText, moreChangesText, pretty, short } from '../pages/store-types';

describe('pretty', () => {
  it('shows every field of an app object that has its own @type key', () => {
    const text = pretty({ seo: { '@type': 'Product', name: 'Mug', price: 3 } });
    expect(text).toContain('"Product"');
    expect(text).toContain('name: "Mug"');
    expect(text).toContain('price: 3');
  });

  it('keeps the object visible when a user @type object has a value object', () => {
    expect(short({ '@type': 'Person', value: { a: 1 }, name: 'Ada' })).toContain('name: "Ada"');
  });

  it('still renders the collector tags', () => {
    expect(pretty({ '@type': 'Date', value: '2020-01-01' })).toBe('Date(2020-01-01)');
    expect(pretty({ '@type': 'undefined' })).toBe('undefined');
    expect(pretty({ '@type': 'bigint', value: '5' })).toBe('5n');
    expect(pretty({ '@type': 'number', value: 'NaN' })).toBe('NaN');
  });
});

describe('change counts', () => {
  const row = { path: 'a', op: 'change' as const, before: 0, after: 1 };

  it('counts the rows a long diff left out', () => {
    expect(changeCountText({ diff: [] })).toBe('no change');
    expect(changeCountText({ diff: [row] })).toBe('1 change');
    expect(changeCountText({ diff: [row, row], diffTruncated: 10 })).toBe('12 changes');
    expect(changeCountText({ diff: [row], diffTruncated: 1000 })).toBe('1001+ changes');
  });

  it('says how many changes are not shown', () => {
    expect(moreChangesText(1)).toBe('1 more change not shown');
    expect(moreChangesText(10)).toBe('10 more changes not shown');
    expect(moreChangesText(1000)).toBe('1000+ more changes not shown');
  });
});
