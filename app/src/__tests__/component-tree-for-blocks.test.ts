import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

interface Call {
  name: string;
  payload: Record<string, unknown>;
}

function client(pages: Record<string, unknown>, calls: Call[] = []): DevframeRpcClient {
  const rpc = {
    call: (name: string, payload: Record<string, unknown>) => {
      calls.push({ name, payload });
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

const basePage = {
  pageId: 'p1',
  roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
  count: 1,
  detail: null,
  reportedAt: 1000,
};

async function render(page: Record<string, unknown>, calls: Call[] = []) {
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', client({ p1: page }, calls));
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('@for blocks section', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists each block with its owner, item count, @empty and track kind', async () => {
    const { el } = await render({
      ...basePage,
      forBlocks: [
        {
          id: 'f1',
          owner: { id: 'c1', name: 'App', tag: 'app-root' },
          count: 2,
          track: '$index',
          hasEmptyBlock: false,
          showingEmpty: false,
          rootIds: [],
        },
        {
          id: 'f2',
          count: 0,
          track: 'function',
          hasEmptyBlock: true,
          showingEmpty: true,
          rootIds: [],
        },
      ],
      forBlocksTruncated: true,
    });
    const section = el.querySelector('section[aria-labelledby="ct-for-title"]')!;
    expect(section.querySelector('h2')!.textContent).toContain('@for blocks');
    expect(section.querySelector('.pill')!.textContent).toContain('2+');
    expect(section.textContent).toContain('more @for blocks than the 2 listed');
    const rows = Array.from(section.querySelectorAll<HTMLButtonElement>('.for-row'));
    const text = (row: Element) =>
      Array.from(row.children, (part) => part.textContent?.replace(/\s+/g, ' ').trim()).join(' ');
    expect(rows.map(text)).toEqual([
      'App 2 items track $index',
      'Unknown component 0 items @empty showing track expression',
    ]);
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('says when the page Angular is too old to report @for blocks', async () => {
    const { el } = await render({ ...basePage, deferBlocks: [] });
    expect(el.textContent).toContain('@for blocks are listed from Angular 22.0');
    expect(el.querySelector('#ct-for-title')).toBeNull();
  });

  it('shows nothing when the page has no @for block', async () => {
    const { el } = await render({ ...basePage, deferBlocks: [], forBlocks: [] });
    expect(el.textContent).not.toContain('@for blocks');
  });
});
