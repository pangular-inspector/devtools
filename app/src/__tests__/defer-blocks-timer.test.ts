import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferBlocksSection, type DeferBlock } from '../pages/defer-blocks-section';

const block = (id: string, extra: Partial<DeferBlock> = {}): DeferBlock => ({
  id,
  owner: { id: 'c1', name: 'App', tag: 'app-root' },
  state: 'complete',
  hydration: 'not-configured',
  triggers: ['on idle'],
  rootIds: [],
  since: Date.now(),
  ...extra,
});

describe('Defer blocks timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function render(blocks: DeferBlock[]) {
    const fixture = TestBed.createComponent(DeferBlocksSection);
    fixture.componentRef.setInput('blocks', blocks);
    fixture.detectChanges();
    return fixture;
  }

  it('runs only while a block is on its placeholder', () => {
    const fixture = render([]);
    expect(vi.getTimerCount()).toBe(0);
    fixture.componentRef.setInput('blocks', [block('d1')]);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(0);
    fixture.componentRef.setInput('blocks', [block('d1', { state: 'placeholder' })]);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(1);
    fixture.componentRef.setInput('blocks', [block('d1')]);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(0);
    fixture.componentRef.setInput('blocks', [block('d1', { state: 'initial' })]);
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts the age up without changing the row name', () => {
    const fixture = render([block('d1', { state: 'placeholder', since: Date.now() - 30_000 })]);
    const row = () => (fixture.nativeElement as HTMLElement).querySelector('.defer-row')!;
    /** The text a screen reader takes the name from: everything not aria-hidden. */
    const name = () => {
      const copy = row().cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
      return copy.textContent!.replace(/\s+/g, ' ').trim();
    };
    const before = name();
    expect(before).toContain('stuck');
    expect(row().querySelector('.note-stuck')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'stuck 30s',
    );
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(row().querySelector('.note-stuck')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'stuck 35s',
    );
    expect(name()).toBe(before);
    fixture.destroy();
  });
});
