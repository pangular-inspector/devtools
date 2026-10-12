import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeToPage } from '../page-id';
import { PipesInspector } from '../pages/pipes-inspector';

const SOURCE = [
  {
    name: 'price',
    className: 'PricePipe',
    file: 'src/price.pipe.ts',
    line: 4,
    isStandalone: true,
    isPure: true,
  },
];

const live = (name: string, className: string, extra: Record<string, unknown> = {}) => ({
  name,
  className,
  isPure: false,
  instanceCount: 2,
  components: [{ name: 'Header', count: 2 }],
  ...extra,
});

function client(snapshot: unknown, { scanFails = false, scansBeforeFailing = 0 } = {}) {
  let scans = 0;
  const rpc = {
    call: (name: string) => {
      if (name === 'get-pipes') {
        const fails = scanFails && scans++ >= scansBeforeFailing;
        return fails ? Promise.reject(new Error('offline')) : Promise.resolve(SOURCE);
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => snapshot, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function render(rpc: DevframeRpcClient) {
  const fixture = TestBed.createComponent(PipesInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', rpc);
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

function rowNames(host: HTMLElement) {
  return Array.from(host.querySelectorAll('[data-pipe-row] .name'), (n) => n.textContent);
}

function text(el: Element | null) {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('pipes seen only at runtime', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  it('lists a pipe the source scan did not find, without a source location', async () => {
    const fixture = await render(
      client({
        pipes: [live('price', 'PricePipe'), live('translate', 'TranslatePipe')],
        async: [],
        instrumented: [],
      }),
    );
    const host = fixture.nativeElement as HTMLElement;
    expect(rowNames(host)).toEqual(['price', 'translate']);
    expect(text(host.querySelector('.total'))).toBe('2 of 2');

    const row = host.querySelectorAll('[data-pipe-row]')[1];
    expect(text(row)).toContain('runtime only');
    expect(text(row)).toContain('No source location');
    expect(text(row)).not.toContain(':0');
  });

  it('shows the call data of a runtime-only pipe in its details', async () => {
    const fixture = await render(
      client({
        pipes: [
          live('translate', 'TranslatePipe', {
            call: { callCount: 3, totalMs: 1.5, maxMs: 1, lastArgs: ['HELLO'], lastResult: 'Hi' },
          }),
        ],
        async: [],
        instrumented: ['A'],
      }),
    );
    const host = fixture.nativeElement as HTMLElement;
    const row = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-pipe-row]')).find(
      (b) => text(b.querySelector('.name')) === 'translate',
    )!;
    row.click();
    await fixture.whenStable();
    const detail = text(host.querySelector('#pipe-detail'));
    expect(detail).toContain('Seen on the page only');
    expect(detail).toContain('TranslatePipe');
    expect(detail).not.toContain('File');
    expect(detail).not.toContain('Standalone');
    expect(detail).toContain('1.50 ms total');
    expect(detail).toContain('HELLO');
    expect(detail).toContain('Hi');
  });

  it('filters runtime-only pipes with Runtime only and leaves them out of Custom', async () => {
    const fixture = await render(
      client({ pipes: [live('translate', 'TranslatePipe')], async: [], instrumented: [] }),
    );
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    page.kind.set('runtime');
    await fixture.whenStable();
    expect(rowNames(host)).toEqual(['translate']);
    page.kind.set('custom');
    await fixture.whenStable();
    expect(rowNames(host)).toEqual(['price']);
  });

  it('lists only the runtime pipes of the page the panel belongs to', async () => {
    scopeToPage('B');
    const fixture = await render(
      client({
        pipes: [live('ngrxPush', 'PushPipe')],
        async: [],
        instrumented: [],
        pages: [
          { pageId: 'A', pipes: [live('ngrxPush', 'PushPipe')], async: [] },
          { pageId: 'B', pipes: [live('translate', 'TranslatePipe')], async: [] },
        ],
      }),
    );
    expect(rowNames(fixture.nativeElement)).toEqual(['price', 'translate']);
  });

  it('keeps runtime pipes listed and says so when the source scan fails', async () => {
    const fixture = await render(
      client(
        { pipes: [live('translate', 'TranslatePipe')], async: [], instrumented: [] },
        { scanFails: true },
      ),
    );
    const host = fixture.nativeElement as HTMLElement;
    expect(rowNames(host)).toEqual(['translate']);
    const alert = host.querySelector('.notice.error[role="alert"]');
    expect(text(alert)).toContain("Couldn't scan the source");
    expect(alert?.querySelector('button')?.textContent?.trim()).toBe('Try again');
    expect(text(alert)).toContain('Only pipes seen on the page are listed');
  });

  it('keeps the last scan listed and says so when a later scan fails', async () => {
    const fixture = await render(
      client(
        { pipes: [live('translate', 'TranslatePipe')], async: [], instrumented: [] },
        { scanFails: true, scansBeforeFailing: 1 },
      ),
    );
    const host = fixture.nativeElement as HTMLElement;
    await fixture.componentInstance.refresh();
    await fixture.whenStable();
    expect(rowNames(host)).toEqual(['price', 'translate']);
    const alert = host.querySelector('.notice.error[role="alert"]');
    expect(text(alert)).toContain("Couldn't scan the source again. The list keeps the last scan.");
    expect(text(alert)).not.toContain('Only pipes seen on the page');
  });
});
