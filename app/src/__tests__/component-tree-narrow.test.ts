import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

const LONG = 'CustomerOrderHistoryTableWithInlineFiltersComponent';

const roots = [
  {
    id: 'app',
    name: 'App',
    tag: 'app-root',
    children: [{ id: 'long', name: LONG, tag: 'app-customer-order-history-table', children: [] }],
  },
];

function client(): DevframeRpcClient {
  const state: Record<string, unknown> = {
    'component-tree': {
      pages: {
        a: { pageId: 'a', title: 'a', url: '/', roots, count: 2, detail: null, reportedAt: 1 },
      },
    },
  };
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function setup() {
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', client());
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

/** jsdom has no layout, so names that are cut off report a wider content than their box. */
function cutOff(names: string[]) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return names.includes(this.textContent?.trim() ?? '') ? 400 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('component tree at narrow widths', () => {
  it('keeps a name and a hover title on every toolbar action', async () => {
    const { fixture, root } = await setup();
    const actions = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.toolbar .tree-action, .toolbar .pick'),
    );
    expect(actions.map((b) => b.querySelector('.label')?.textContent?.trim())).toEqual([
      'Expand all',
      'Collapse all',
      'Pick component on page',
    ]);
    for (const action of actions) {
      expect(action.title).toBe(action.textContent?.trim());
    }
    fixture.destroy();
  });

  it('gives each name and tag its full text as a hover title', async () => {
    const { fixture, root } = await setup();
    const row = root.querySelector<HTMLElement>('.row[data-id="long"]')!;
    expect(row.querySelector<HTMLElement>('.name')!.title).toBe(LONG);
    expect(row.querySelector<HTMLElement>('.tag')!.title).toBe(
      '<app-customer-order-history-table>',
    );
    fixture.destroy();
  });

  it('shows the full text of a cut off row while it has focus', async () => {
    cutOff([LONG]);
    const { fixture, root } = await setup();
    const row = root.querySelector<HTMLElement>('.row[data-id="long"]')!;
    row.focus();
    await settle(fixture);
    const tip = root.querySelector<HTMLElement>('.name-tip');
    expect(tip?.textContent?.trim()).toBe(`${LONG} <app-customer-order-history-table>`);
    expect(tip?.getAttribute('aria-hidden')).toBe('true');

    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(fixture);
    expect(root.querySelector('.name-tip')).toBeNull();

    row.blur();
    row.focus();
    await settle(fixture);
    expect(root.querySelector('.name-tip')).not.toBeNull();
    row.blur();
    await settle(fixture);
    expect(root.querySelector('.name-tip')).toBeNull();
    fixture.destroy();
  });

  it('shows no tip for a row that fits', async () => {
    cutOff([LONG]);
    const { fixture, root } = await setup();
    root.querySelector<HTMLElement>('.row[data-id="app"]')!.focus();
    await settle(fixture);
    expect(root.querySelector('.name-tip')).toBeNull();
    fixture.destroy();
  });
});
