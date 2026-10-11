import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PipesInspector } from '../pages/pipes-inspector';

const PIPES = [
  {
    name: 'currencyFormat',
    className: 'CurrencyFormatPipe',
    file: 'src/app/currency-format.pipe.ts',
    line: 4,
    isStandalone: true,
    isPure: true,
  },
  {
    name: 'filterBy',
    className: 'FilterByPipe',
    file: 'src/app/filter-by.pipe.ts',
    line: 3,
    isStandalone: true,
    isPure: false,
  },
];

const LINT = [
  {
    rule: 'impure-pipe-in-for',
    severity: 'warning',
    pipe: 'filterBy',
    file: 'src/app/list.html',
    line: 12,
    message: 'Impure pipe inside @for.',
    fix: 'Use a pure pipe.',
  },
  {
    rule: 'signal-read-in-pure-pipe',
    severity: 'warning',
    pipe: 'currencyFormat',
    file: 'src/app/currency-format.pipe.ts',
    line: 9,
    message: 'Reads a signal.',
    fix: 'Pass the value in.',
  },
  {
    rule: 'impure-pipe-in-for',
    severity: 'warning',
    pipe: 'libraryPipe',
    file: 'src/app/list.html',
    line: 20,
    message: 'Impure pipe inside @for.',
    fix: 'Use a pure pipe.',
  },
];

function client() {
  const rpc = {
    call: (name: string) => {
      if (name === 'get-pipes') return Promise.resolve(PIPES);
      if (name === 'pipe-lint') return Promise.resolve(LINT);
      return Promise.resolve(null);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => ({ pipes: [], async: [], instrumented: [] }),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render() {
  const fixture = TestBed.createComponent(PipesInspector);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', client());
  await settle(fixture);
  return fixture;
}

function showButtons(host: HTMLElement) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.findings button.pipe-link'));
}

function names(host: HTMLElement) {
  return Array.from(host.querySelectorAll('[data-pipe-row] .name')).map((n) => n.textContent);
}

describe('pipes lint show pipe', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('gives findings with a listed pipe a Show pipe button, and none to the rest', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;
    const buttons = showButtons(host);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Show pipe filterBy',
      'Show pipe currencyFormat',
    ]);
    const findings = host.querySelectorAll('.findings .finding');
    expect(findings).toHaveLength(3);
    expect(findings[2].querySelector('button')).toBeNull();
    expect(findings[2].querySelector('.where')?.textContent).toContain('libraryPipe');
  });

  it('selects the pipe and moves focus to its detail heading', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;
    showButtons(host)[0].click();
    await settle(fixture);
    expect(fixture.componentInstance.selected()?.name).toBe('filterBy');
    expect(host.querySelector('.row.selected .name')?.textContent).toBe('filterBy');
    const heading = host.querySelector('#pipe-detail-title');
    expect(heading?.textContent).toBe('filterBy');
    expect(document.activeElement).toBe(heading);
  });

  it('clears a search and a kind filter that hide the pipe', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;
    page.filter.set('currency');
    page.kind.set('custom');
    await settle(fixture);
    expect(names(host)).toEqual(['currencyFormat']);
    showButtons(host)[0].click();
    await settle(fixture);
    expect(page.filter()).toBe('');
    expect(page.kind()).toBe('custom');
    expect(names(host)).toContain('filterBy');

    page.kind.set('builtin');
    await settle(fixture);
    showButtons(host)[1].click();
    await settle(fixture);
    expect(page.kind()).toBe('all');
    expect(page.selected()?.name).toBe('currencyFormat');
  });

  it('keeps filters that do not hide the pipe', async () => {
    const fixture = await render();
    const page = fixture.componentInstance;
    page.filter.set('pipe.ts');
    page.kind.set('impure');
    await settle(fixture);
    showButtons(fixture.nativeElement)[0].click();
    await settle(fixture);
    expect(page.filter()).toBe('pipe.ts');
    expect(page.kind()).toBe('impure');
    expect(page.selected()?.name).toBe('filterBy');
  });
});
