// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialTab, storeTab, storedTab } from '../../../../app/src/tab-memory.ts';

const tabs = ['dashboard', 'components', 'routes', 'forms'] as const;

describe('panel tab on reload', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reopens the last tab when the panel reloads without a hash', () => {
    storeTab('panel', 'forms');
    expect(initialTab('', storedTab('panel'), tabs)).toBe('forms');
  });

  it('lets the #tab= deep link win over the stored tab', () => {
    storeTab('panel', 'forms');
    expect(initialTab('#tab=routes', storedTab('panel'), tabs)).toBe('routes');
  });

  it('falls back to the default for a tab that is turned off or unknown', () => {
    storeTab('panel', 'store');
    expect(initialTab('', storedTab('panel'), tabs)).toBeUndefined();
    expect(initialTab('#tab=store', 'forms', tabs)).toBeUndefined();
  });

  it('keeps each view to its own tab', () => {
    storeTab('angular', 'routes');
    expect(storedTab('panel')).toBeNull();
    expect(storedTab('angular')).toBe('routes');
  });

  it('works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => storeTab('panel', 'forms')).not.toThrow();
    expect(storedTab('panel')).toBeNull();
  });
});
