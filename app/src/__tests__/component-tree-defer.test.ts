import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

function client(
  pages: Record<string, unknown>,
  call: (...args: unknown[]) => Promise<unknown> = () => Promise.resolve([]),
): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

describe('defer blocks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('style the state badge apart from the empty-state box', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    const page = {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
      reportedAt: 1000,
      deferBlocks: [
        {
          id: 'd1',
          owner: { id: 'c1', name: 'App', tag: 'app-root' },
          state: 'complete',
          hydration: 'not-configured',
          triggers: ['viewport'],
          rootIds: [],
        },
      ],
    };
    fixture.componentRef.setInput('rpc', client({ p1: page }));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const row = (fixture.nativeElement as HTMLElement).querySelector('.defer-row')!;
    const badge = Array.from(row.querySelectorAll('span')).find(
      (el) => el.textContent?.trim() === 'complete',
    )!;
    expect(badge.classList.contains('state')).toBe(false);
    expect(badge.classList.contains('defer-state')).toBe(true);
    expect(badge.classList.contains('defer-state-complete')).toBe(true);
  });

  it('keeps a row without an owner focusable, marked aria-disabled', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    const page = {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
      reportedAt: 1000,
      deferBlocks: [
        {
          id: 'd1',
          state: 'placeholder',
          hydration: 'not-configured',
          triggers: [],
          rootIds: [],
        },
      ],
    };
    fixture.componentRef.setInput('rpc', client({ p1: page }));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.defer-row',
    )!;
    expect(row.disabled).toBe(false);
    expect(row.getAttribute('aria-disabled')).toBe('true');
    row.click();
    await fixture.whenStable();
    expect(row.textContent).toContain('Unknown component');
  });

  it('shows a + on the count when the page has more blocks than it reported', async () => {
    const block = (id: string) => ({
      id,
      state: 'complete',
      hydration: 'not-configured',
      triggers: [],
      rootIds: [],
    });
    const page = (deferTruncated?: boolean) => ({
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
      reportedAt: 1000,
      deferBlocks: [block('d1'), block('d2')],
      ...(deferTruncated ? { deferTruncated } : {}),
    });
    const pill = async (value: unknown) => {
      const fixture = TestBed.createComponent(ComponentTree);
      fixture.componentRef.setInput('rpc', client({ p1: value }));
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
      const text = (fixture.nativeElement as HTMLElement)
        .querySelector('#ct-defer-title .pill')!
        .textContent!.trim();
      fixture.destroy();
      return text;
    };
    expect(await pill(page())).toBe('2');
    expect(await pill(page(true))).toBe('2+');
  });

  it('shows the notes the agent tool prints, the @error block and the block times', async () => {
    const hour = 3_600_000;
    // The page's clock runs an hour ahead of the panel's.
    const pageNow = Date.now() + hour;
    const block = (id: string, extra: Record<string, unknown>) => ({
      id,
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
      state: 'complete',
      hydration: 'not-configured',
      triggers: ['on idle'],
      rootIds: [],
      since: pageNow,
      hasErrorBlock: false,
      ...extra,
    });
    const page = {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
      reportedAt: 1000,
      clockOffset: -hour,
      deferBlocks: [
        block('d1', { state: 'error', hasErrorBlock: true }),
        block('d2', { state: 'placeholder', since: pageNow - 30_000 }),
        block('d3', { state: 'placeholder', since: pageNow - 2_000 }),
        block('d4', { hydration: 'dehydrated', triggers: ['hydrate on viewport'] }),
        block('d5', {
          state: 'loading',
          loading: { minimumTime: 1000, afterTime: 100 },
          placeholder: { minimumTime: 500 },
        }),
      ],
    };
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client({ p1: page }));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.defer-row'),
    );
    const flags = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('.flag')).map((el) => el.textContent?.trim());
    expect(flags(rows[0]!)).toEqual(['failed', '@error block']);
    expect(rows[0]!.querySelector('.note-failed')?.getAttribute('title')).toBe('failed to load');
    // 30 s on the page's clock, not an hour and 30 s.
    expect(flags(rows[1]!)).toEqual(['stuck 30s']);
    expect(rows[1]!.querySelector('.note-stuck')?.getAttribute('title')).toBe(
      'on its placeholder for 30s',
    );
    expect(flags(rows[2]!)).toEqual([]);
    expect(flags(rows[3]!)).toEqual(['dehydrated']);
    expect(rows[4]!.querySelector('.timings')?.textContent?.trim()).toBe(
      'placeholder min 500ms · loading after 100ms, min 1s',
    );
    expect(rows[0]!.querySelector('.timings')).toBeNull();
    fixture.destroy();
  });

  it('highlights every root element of a block in one request', async () => {
    const call = vi.fn((..._args: unknown[]) => Promise.resolve([] as unknown));
    const block = (id: string, rootIds: string[]) => ({
      id,
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
      state: 'complete',
      hydration: 'not-configured',
      triggers: [],
      rootIds,
    });
    const page = {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
      reportedAt: 1000,
      deferBlocks: [block('d1', ['e1', 'e2']), block('d2', ['e3']), block('d3', [])],
    };
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client({ p1: page }, call));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.defer-row');
    const highlights = () =>
      call.mock.calls.filter((args) => args[0] === 'request-page-highlight').map((args) => args[1]);
    call.mockClear();
    for (const row of Array.from(rows)) {
      row.dispatchEvent(new Event('mouseenter'));
      row.dispatchEvent(new Event('mouseleave'));
    }
    expect(highlights()).toEqual([
      { pageId: 'p1', ids: ['e1', 'e2'] },
      null,
      { pageId: 'p1', id: 'e3' },
      null,
      { pageId: 'p1', id: 'c1' },
      null,
    ]);
    fixture.destroy();
  });
});
