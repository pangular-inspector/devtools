import { afterEach, describe, expect, it, vi } from 'vitest';
import { newPageId } from '../page-id.ts';

afterEach(() => vi.unstubAllGlobals());

describe('newPageId', () => {
  it('takes 8 random characters from randomUUID, well under the server limit', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newPageId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('falls back to Math.random where randomUUID is missing, as on some devices', () => {
    vi.stubGlobal('crypto', {});
    const id = newPageId();
    expect(id).toMatch(/^[0-9a-z]{8}$/);
  });
});
