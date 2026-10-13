import { describe, expect, it, vi } from 'vitest';
import { cachedPipeLint } from '../rpc/pipe-lint-cache.ts';
import type { PipeLintFinding } from '../rpc/pipe-lint.ts';

describe('cachedPipeLint', () => {
  it('scans once within the time to live, then again', () => {
    let now = 0;
    const findings: PipeLintFinding[] = [];
    const lint = vi.fn(() => findings);
    const cached = cachedPipeLint(lint, { ttlMs: 1000, now: () => now });
    expect(cached()).toBe(findings);
    now = 999;
    cached();
    cached();
    expect(lint).toHaveBeenCalledTimes(1);
    now = 1000;
    cached();
    expect(lint).toHaveBeenCalledTimes(2);
  });
});
