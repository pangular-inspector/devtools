import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import type { TreeNode } from '../pages/component-tree-state';
import { LeaksSection } from '../pages/leaks-section';
import { keepBelowSticky, scrollParent, stickyClearance } from '../ui/sticky-clearance';

const roots: TreeNode[] = [
  {
    id: 'c1',
    name: 'App',
    tag: 'app-root',
    children: [
      {
        id: 'c2',
        name: 'TripList',
        tag: 'app-trip-list',
        children: [{ id: 'c3', name: 'TripCard', tag: 'app-trip-card', children: [] }],
      },
    ],
  },
];

function client() {
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () =>
          name === 'component-tree'
            ? { pages: { p1: { pageId: 'p1', roots, count: 3, detail: null, reportedAt: 1000 } } }
            : null,
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

describe('component tree and the Leaks section', () => {
  beforeEach(() => {
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    Element.prototype.scrollIntoView ??= () => {};
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('moves focus to the tree row of a Leaks row and keeps it clear of the toolbar', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client());
    // The panel's scroller: the toolbar sticks inside its padding.
    const main = document.createElement('main');
    main.style.overflowY = 'auto';
    main.style.paddingTop = '20px';
    main.append(fixture.nativeElement);
    document.body.append(main);
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const el = fixture.nativeElement as HTMLElement;
    Object.defineProperty(el.querySelector('.toolbar')!, 'offsetHeight', { value: 64 });
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    const leaks = fixture.debugElement.query(By.directive(LeaksSection));
    expect(leaks).not.toBeNull();
    (leaks.componentInstance as LeaksSection).showComponent.emit('c3');
    fixture.detectChanges();
    await fixture.whenStable();
    const row = el.querySelector<HTMLElement>('.row[data-id="c3"]')!;
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(row);
    expect(scrolled).toHaveBeenCalled();
    // The scroller's padding, the toolbar's height and an 8px gap.
    expect(el.style.getPropertyValue('--ct-toolbar-clearance')).toBe('92px');
  });

  it('measures the clearance a sticky bar needs, with the scroller padding and scroll padding', () => {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    scroller.style.paddingTop = '16px';
    const wrap = document.createElement('section');
    const bar = document.createElement('div');
    bar.style.top = '4px';
    Object.defineProperty(bar, 'offsetHeight', { value: 100 });
    wrap.append(bar);
    scroller.append(wrap);
    document.body.append(scroller);
    expect(scrollParent(bar)).toBe(scroller);
    expect(stickyClearance(bar)).toBe(16 + 4 + 100 + 8);
    scroller.style.scrollPaddingTop = '10px';
    expect(stickyClearance(bar, 0)).toBe(16 + 4 + 100 - 10);
    // Without a scrolling ancestor the page scrolls, with no padding to add.
    const loose = document.createElement('div');
    Object.defineProperty(loose, 'offsetHeight', { value: 50 });
    document.body.append(loose);
    expect(scrollParent(loose)).toBeNull();
    expect(stickyClearance(loose)).toBe(58);
  });

  it('scrolls a row the sticky bar covers back below it, and leaves a clear row alone', () => {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    const bar = document.createElement('div');
    const row = document.createElement('div');
    scroller.append(bar, row);
    document.body.append(scroller);
    scroller.scrollTop = 400;
    const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;
    bar.getBoundingClientRect = () => rect(65, 117);
    row.getBoundingClientRect = () => rect(92, 124);
    keepBelowSticky(row, bar);
    // 117 + 8 - 92: the row moves 33px down.
    expect(scroller.scrollTop).toBe(367);
    row.getBoundingClientRect = () => rect(130, 162);
    keepBelowSticky(row, bar);
    expect(scroller.scrollTop).toBe(367);
  });
});
