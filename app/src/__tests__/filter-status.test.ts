import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filterAnnouncement } from '../ui/filter-status';

describe('filterAnnouncement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const query = signal('');
    const total = signal(10);
    const text = () => `${total()} of ${total()} events`;
    const status = TestBed.runInInjectionContext(() => filterAnnouncement(() => query(), text));
    TestBed.tick();
    return { query, total, status };
  }

  it('stays quiet when only the data changes', () => {
    const { total, status } = setup();
    total.set(11);
    TestBed.tick();
    vi.advanceTimersByTime(2000);
    total.set(12);
    TestBed.tick();
    vi.advanceTimersByTime(2000);
    expect(status()).toBe('');
  });

  it('speaks the count once after the user stops typing', () => {
    const { query, total, status } = setup();
    for (const value of ['t', 'tr', 'tri']) {
      query.set(value);
      TestBed.tick();
      vi.advanceTimersByTime(100);
    }
    expect(status()).toBe('');
    vi.advanceTimersByTime(1000);
    expect(status()).toBe('10 of 10 events');
    total.set(20);
    TestBed.tick();
    vi.advanceTimersByTime(2000);
    expect(status()).toBe('10 of 10 events');
  });
});
