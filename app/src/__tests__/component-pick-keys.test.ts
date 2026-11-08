import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

const page = {
  pageId: 'p1',
  roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
  count: 1,
  detail: null,
  reportedAt: 1000,
};

function client(calls: { name: string; args: unknown }[]) {
  const rpc = {
    call: (name: string, args: unknown) => {
      calls.push({ name, args });
      if (name === 'request-component-pick') return new Promise(() => {});
      if (name === 'request-component-pick-move') {
        return Promise.resolve({ moved: true, id: 'c1', name: 'App', tag: 'app-root' });
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages: { p1: page } } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

describe('keyboard pick', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sends the arrow keys and Enter to the page while picking, and announces the component', async () => {
    const calls: { name: string; args: unknown }[] = [];
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client(calls));
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      el.querySelector('.pick')!.dispatchEvent(event);
      return event;
    };
    expect(press('ArrowDown').defaultPrevented).toBe(false);
    void fixture.componentInstance.pick();
    await settle(fixture);
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    await settle(fixture);
    expect(calls.filter((c) => c.name === 'request-component-pick-move')).toEqual([
      { name: 'request-component-pick-move', args: { pageId: 'p1', key: 'next' } },
    ]);
    expect(fixture.componentInstance.announcement()).toBe(
      'App <app-root>. Press Enter to pick it.',
    );
    // The same component again changes the live text, so a screen reader repeats it.
    press('ArrowDown');
    await settle(fixture);
    expect(fixture.componentInstance.announcement()).toBe(
      'App <app-root>. Press Enter to pick it.\u00a0',
    );
    expect(fixture.componentInstance.pickMessage()).toBe('App <app-root>. Press Enter to pick it.');
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(calls.at(-1)).toEqual({
      name: 'request-component-pick-move',
      args: { pageId: 'p1', key: 'pick' },
    });
  });
});
