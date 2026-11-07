import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CdRecording, type CdPage } from '../pages/cd-recording';
import { FormsWebMcp } from '../pages/forms-webmcp';
import type { WebMcpTool } from '../pages/forms-types';

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function cdPage(ms: [number, number]): CdPage {
  const stat = (m: number) => ({ name: 'ItemComponent', checks: 1, ms: m, maxMs: m, cycles: 1 });
  return {
    pageId: 'p1',
    supported: true,
    recording: false,
    startedAt: null,
    dropped: 0,
    cycles: [],
    components: [stat(ms[0]), stat(ms[1])],
    hosts: {},
  };
}

function tool(outcomes: [string, string]): WebMcpTool {
  return {
    name: 'submit',
    description: 'd',
    status: 'registered',
    seen: 'register',
    calls: [
      { at: 1000, outcome: outcomes[0] },
      { at: 1000, outcome: outcomes[1] },
    ],
  };
}

function logs(spies: ReturnType<typeof vi.spyOn>[]): string {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .flat()
    .join(' ');
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('lists with repeated keys', () => {
  it('shows two same-named components in the change detection table without a duplicate key', async () => {
    const spies = [
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('page', cdPage([9, 3]));
    await settle(fixture);
    fixture.componentRef.setInput('page', cdPage([2, 7]));
    await settle(fixture);
    const rows = (table: number) =>
      Array.from(
        (fixture.nativeElement as HTMLElement)
          .querySelectorAll('.cd-grid table')
          [table]!.querySelectorAll('tbody tr'),
        (row) =>
          Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim()).join('|'),
      );
    expect(rows(0)).toEqual(['ItemComponent|1|7.00 ms|7.00 ms', 'ItemComponent|1|2.00 ms|2.00 ms']);
    // The "Most often checked" table lists the same two classes.
    expect(rows(1)).toEqual(['ItemComponent|1|1|7.00 ms', 'ItemComponent|1|1|2.00 ms']);
    expect(logs(spies)).not.toContain('NG0955');
  });

  it('shows two same-millisecond calls of a WebMCP tool without a duplicate key', async () => {
    const spies = [
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const fixture = TestBed.createComponent(FormsWebMcp);
    fixture.componentRef.setInput('tool', tool(['running', 'failed']));
    await settle(fixture);
    fixture.componentRef.setInput('tool', tool(['submitted', 'failed']));
    await settle(fixture);
    const states = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('li .state'),
      (el) => el.getAttribute('data-state'),
    );
    expect(states).toEqual(['submitted', 'failed']);
    expect(logs(spies)).not.toContain('NG0955');
  });
});

describe('change detection component tables', () => {
  it('lists the most checked classes and selects one from its name', async () => {
    const fixture = TestBed.createComponent(CdRecording);
    const stat = (name: string, checks: number, ms: number) => ({
      name,
      checks,
      ms,
      maxMs: ms,
      cycles: checks,
    });
    fixture.componentRef.setInput('page', {
      ...cdPage([1, 1]),
      components: [stat('Slow', 1, 9), stat('Busy', 12, 1)],
    });
    await settle(fixture);
    const shown: string[] = [];
    fixture.componentInstance.showComponent.subscribe((name) => shown.push(name));
    const tables = (fixture.nativeElement as HTMLElement).querySelectorAll('.cd-grid table');
    const first = (table: Element) => table.querySelector('tbody .name-link')!;
    expect(first(tables[0]!).textContent?.trim()).toBe('Slow');
    expect(first(tables[1]!).textContent?.trim()).toBe('Busy');
    (first(tables[1]!) as HTMLButtonElement).click();
    expect(shown).toEqual(['Busy']);
  });
});
