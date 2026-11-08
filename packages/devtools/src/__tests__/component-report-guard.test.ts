import { describe, expect, it } from 'vitest';
import { guardComponentDetail } from '../rpc/component-report-guard.ts';

const detail = (extra: Record<string, unknown>) =>
  guardComponentDetail({ id: 'c1', name: 'Card', tag: 'app-card', ...extra });

describe('guardComponentDetail', () => {
  it('keeps a text selector whole', () => {
    const selector = `app-card${'[data-x]'.repeat(200)}`;
    expect(detail({ selector })?.selector).toBe(selector);
  });

  it('leaves out a selector that is not text', () => {
    for (const selector of [42, { css: 'app-card' }, ['app-card'], null]) {
      const guarded = detail({ selector });
      expect(guarded).not.toBeNull();
      expect(guarded && 'selector' in guarded).toBe(false);
    }
  });
});
