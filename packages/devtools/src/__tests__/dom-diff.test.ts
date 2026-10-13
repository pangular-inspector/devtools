import { describe, expect, it } from 'vitest';
import { MAX_DIFF_LINES, diffDom, diffText } from '../dom-diff.ts';

const EXPECTED = `<app-price>
  …
  <div class="total">…</div>  <-- AT THIS LOCATION
  …
</app-price>`;

const ACTUAL = `<app-price>
  …
  <span class="total">…</span>  <-- AT THIS LOCATION
  …
</app-price>`;

describe('diffDom', () => {
  it('keeps the shared lines and marks what only the server or the client has', () => {
    expect(diffDom(EXPECTED, ACTUAL)).toEqual([
      { op: 'same', text: '<app-price>' },
      { op: 'same', text: '  …' },
      { op: 'expected', text: '  <div class="total">…</div>  <-- AT THIS LOCATION' },
      { op: 'actual', text: '  <span class="total">…</span>  <-- AT THIS LOCATION' },
      { op: 'same', text: '  …' },
      { op: 'same', text: '</app-price>' },
    ]);
  });

  it("matches a line with Angular's location marker to the same line without it", () => {
    const diff = diffDom('<p>\n  <b>…</b>  <-- AT THIS LOCATION\n</p>', '<p>\n  <b>…</b>\n</p>');
    expect(diff.every((line) => line.op === 'same')).toBe(true);
    // The marked line is kept, so the reader still sees where Angular looked.
    expect(diff[1]!.text).toContain('AT THIS LOCATION');
  });

  it('lists only one side when Angular found no node at all', () => {
    expect(diffDom('<div>…</div>', '')).toEqual([{ op: 'expected', text: '<div>…</div>' }]);
    expect(diffDom(undefined, '<i></i>')).toEqual([{ op: 'actual', text: '<i></i>' }]);
  });

  it('caps each side so a huge description stays small', () => {
    const many = Array.from({ length: 500 }, (_, i) => `<li>${i}</li>`).join('\n');
    expect(diffDom(many, many)).toHaveLength(MAX_DIFF_LINES);
  });

  it('writes the diff as unified text', () => {
    expect(diffText(diffDom('<a>\n<b>', '<a>\n<c>'))).toBe('  <a>\n- <b>\n+ <c>');
  });
});
