import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { RedactionCount } from '../ui/redaction-count';
import { StoreStateTree } from '../pages/store-state-tree';

function render<T>(type: Type<T>, inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(type);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

describe('RedactionCount', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says how many values the redaction masked', () => {
    const fixture = render(RedactionCount, {
      value: { token: '[redacted]', user: { email: '[email]', name: 'Ada' } },
    });
    const line = (fixture.nativeElement as HTMLElement).querySelector('[data-redaction-count]')!;
    expect(line.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '2 values masked by redaction (secret names, tokens and emails).',
    );
  });

  it('shows nothing when nothing was masked', () => {
    const fixture = render(RedactionCount, { value: { name: 'Ada' } });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-redaction-count]'),
    ).toBeNull();
  });

  it('marks a count past the budget as a lower bound', () => {
    const fixture = render(RedactionCount, {
      value: Array.from({ length: 30_000 }, () => '[redacted]'),
    });
    const line = (fixture.nativeElement as HTMLElement).querySelector('[data-redaction-count]')!;
    expect(line.textContent).toContain('At least 20000 values masked');
  });

  it('shows the count above the store state tree', () => {
    const fixture = render(StoreStateTree, { value: { auth: { token: '[redacted]' } } });
    const line = (fixture.nativeElement as HTMLElement).querySelector('[data-redaction-count]')!;
    expect(line.textContent).toContain('1 value masked');
  });
});
