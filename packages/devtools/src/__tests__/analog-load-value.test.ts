import { describe, expect, it } from 'vitest';
import { loadValueText, MAX_LOAD_ANSWER_CHARS } from '../rpc/analog-register.ts';

describe('loadValueText', () => {
  it('shows a short load() value as a JSON block', () => {
    const text = loadValueText({ city: 'Lisbon' });
    expect(text).toContain('```json\n{\n  "city": "Lisbon"\n}\n```');
    expect(text).not.toMatch(/Truncated/);
  });

  it('marks a value past the cap as truncated and does not label it JSON', () => {
    const value = { rows: 'x'.repeat(MAX_LOAD_ANSWER_CHARS * 2) };
    const text = loadValueText(value);
    expect(text).not.toContain('```json');
    expect(text).toMatch(/Truncated: the value is 40,0\d\d characters of JSON/);
    expect(text).toContain('shows the first 20,000');
  });
});
