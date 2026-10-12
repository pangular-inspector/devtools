import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

// A tree of 2,000 instances renders only the rows near view, and stays
// navigable by keyboard and described to screen readers.

const COUNT = 2000;

// jsdom has no CSS namespace; the page escapes ids with it.
(globalThis as { CSS?: { escape(value: string): string } }).CSS ??= {
  escape: (value: string) => value,
};

function bigTree() {
  const items = Array.from({ length: COUNT - 1 }, (_, i) => ({
    id: `c${i}`,
    name: `Item${i}`,
    tag: 'app-item',
    children: [],
  }));
  return [{ id: 'app', name: 'App', tag: 'app-root', children: items }];
}

function client(roots: unknown[]): DevframeRpcClient {
  const state: Record<string, unknown> = {
    'component-tree': {
      pages: {
        a: { pageId: 'a', title: 'a', url: '/', roots, count: COUNT, detail: null, reportedAt: 1 },
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
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function setup(roots: unknown[]) {
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', client(roots));
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const rows = (fixture: ComponentFixture<ComponentTree>) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.row'));

describe('ComponentTree with a long tree', () => {
  it('renders the rows near view and space for the rest', async () => {
    const fixture = await setup(bigTree());
    const shown = rows(fixture);
    expect(shown.length).toBeGreaterThan(10);
    expect(shown.length).toBeLessThan(200);
    const tree = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tree')!;
    expect(tree.classList).toContain('windowed');
    expect(parseFloat(tree.style.paddingBottom)).toBeGreaterThan(30_000);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Rows render as you scroll',
    );
    fixture.destroy();
  });

  it('tells screen readers where each row sits among its siblings', async () => {
    const fixture = await setup(bigTree());
    const item = rows(fixture).find((row) => row.dataset['id'] === 'c4')!;
    expect(item.getAttribute('aria-level')).toBe('2');
    expect(item.getAttribute('aria-posinset')).toBe('5');
    expect(item.getAttribute('aria-setsize')).toBe(String(COUNT - 1));
    // One Tab stop, on a rendered row.
    expect(rows(fixture).filter((row) => row.tabIndex === 0)).toHaveLength(1);
    fixture.destroy();
  });

  it('moves to the last row with End, rendering it first', async () => {
    const fixture = await setup(bigTree());
    const first = rows(fixture)[0]!;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    await settle(fixture);
    const last = rows(fixture).find((row) => row.dataset['id'] === `c${COUNT - 2}`);
    expect(last).toBeTruthy();
    expect(document.activeElement).toBe(last);
    expect(last!.tabIndex).toBe(0);
    expect(rows(fixture).length).toBeLessThan(200);
    fixture.destroy();
  });

  it('renders a short tree whole', async () => {
    const fixture = await setup([
      {
        id: 'app',
        name: 'App',
        tag: 'app-root',
        children: [{ id: 'x', name: 'X', tag: 'app-x', children: [] }],
      },
    ]);
    expect(rows(fixture)).toHaveLength(2);
    const tree = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tree')!;
    expect(tree.classList).not.toContain('windowed');
    fixture.destroy();
  });
});
