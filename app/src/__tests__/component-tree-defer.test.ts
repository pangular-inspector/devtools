import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

function client(pages: Record<string, unknown>): DevframeRpcClient {
  const rpc = {
    call: () => Promise.resolve([]),
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
});
