import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import type { TreeNode } from '../pages/component-tree-state';
import { LeaksSection } from '../pages/leaks-section';

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
    document.body.append(fixture.nativeElement);
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const el = fixture.nativeElement as HTMLElement;
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
    expect(el.style.getPropertyValue('--ct-toolbar-clearance')).toMatch(/px$/);
  });
});
