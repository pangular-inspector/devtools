import { describe, expect, it } from 'vitest';
import { pretty, short } from '../pages/store-types';

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
