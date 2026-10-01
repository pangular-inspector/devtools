import { describe, expect, it } from 'vitest';
import { time } from '../format';

describe('time', () => {
  it('formats a timestamp as the local time of day', () => {
    const at = new Date(2026, 0, 2, 13, 4, 5).getTime();
    expect(time(at)).toBe(new Date(at).toLocaleTimeString());
  });
});
