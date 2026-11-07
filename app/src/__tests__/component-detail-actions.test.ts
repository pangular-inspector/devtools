import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import { componentJson, hostPathText } from '../pages/component-copy';
import { ValueFlash, changedKeys } from '../pages/component-value-flash';
import type { SignalFocus } from '../types/signal-focus.types';

function detail(count: number) {
  return {
    id: 'c1',
    name: 'Cart',
    tag: 'app-cart',
    path: 'app-root > app-cart',
    selector: 'body:nth-child(2) > app-root:nth-child(1) > app-cart:nth-child(1)',
    inputs: [{ name: 'title', prop: 'title', value: 'Basket' }],
    outputs: [{ name: 'checkout', prop: 'checkout', listened: true }],
    properties: [
      { name: 'count', prop: 'count', value: count, kind: 'signal' },
      { name: 'token', prop: 'token', value: '[redacted]' },
    ],
    listeners: [],
    directives: [],
    dependencies: [
      { from: 'c1', token: 'CartStore', flags: [], providedBy: 'r', providedByName: 'Root' },
    ],
  };
}

function page(count: number) {
  return {
    pageId: 'p1',
    roots: [{ id: 'c1', name: 'Cart', tag: 'app-cart', children: [] }],
    count: 1,
    detail: detail(count),
    reportedAt: 1000,
    deferBlocks: [
      {
        id: 'd1',
        owner: { id: 'c1', name: 'Cart', tag: 'app-cart' },
        state: 'placeholder',
        hydration: 'not-configured',
        triggers: ['on viewport'],
        rootIds: [],
      },
    ],
  };
}

function client() {
  const listeners: ((value: unknown) => void)[] = [];
  let value: unknown = { pages: { p1: page(1) } };
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? value : null),
        on: (_event: string, listener: (value: unknown) => void) => {
          if (name === 'component-tree') listeners.push(listener);
          return () => {};
        },
      }),
  };
  const push = (next: unknown) => {
    value = next;
    for (const listener of listeners) listener(next);
  };
  const rpcClient = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { rpcClient, push };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function selected() {
  const fixture = TestBed.createComponent(ComponentTree);
  const { rpcClient, push } = client();
  fixture.componentRef.setInput('rpc', rpcClient);
  fixture.componentRef.setInput('canShowSignals', true);
  await settle(fixture);
  fixture.componentInstance.selectedId.set('c1');
  await settle(fixture);
  return { fixture, push, el: fixture.nativeElement as HTMLElement };
}

function button(el: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.replace(/\s+/g, ' ').trim().startsWith(text),
  );
  if (!found) throw new Error(`no button ${text}`);
  return found;
}

describe('component detail actions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('copies the detail as JSON and the host selector', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { fixture, el } = await selected();
    button(el, 'Copy as JSON').click();
    await settle(fixture);
    const json = JSON.parse(writeText.mock.calls[0]![0]);
    expect(json).toMatchObject({
      component: 'Cart',
      hostPath: 'app-root > app-cart',
      inputs: { title: 'Basket' },
      outputs: [{ name: 'checkout', listened: true }],
      properties: { count: 1, token: '[redacted]' },
      injected: [{ token: 'CartStore', providedBy: 'Root' }],
    });
    expect(el.textContent).toContain('Copied Cart as JSON.');
    button(el, 'Copy host path').click();
    await settle(fixture);
    expect(writeText).toHaveBeenLastCalledWith(detail(1).selector);
    expect(el.textContent).toContain('Copied the host selector.');
  });

  it('says so when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    const { fixture, el } = await selected();
    button(el, 'Copy host path').click();
    await settle(fixture);
    expect(el.textContent).toContain('The clipboard is not available here.');
  });

  it('outlines a value that changed in the last push', async () => {
    const { fixture, push, el } = await selected();
    const rows = () => Array.from(el.querySelectorAll('.prop.changed')).map((r) => r.textContent);
    expect(rows()).toEqual([]);
    push({ pages: { p1: page(2) } });
    await settle(fixture);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('count');
  });

  it('opens a signal property in the Signals tab', async () => {
    const { fixture, el } = await selected();
    const opened: SignalFocus[] = [];
    fixture.componentInstance.showSignals.subscribe((focus) => opened.push(focus));
    const link = el.querySelector<HTMLButtonElement>('.signal-link')!;
    expect(link.textContent).toContain('Show in Signals');
    link.click();
    button(el, 'Show in Signals').click();
    expect(opened).toEqual([
      { componentId: 'c1', pageId: 'p1', key: 'count' },
      { componentId: 'c1', pageId: 'p1' },
    ]);
  });

  it("lists the component's own defer blocks", async () => {
    const { el } = await selected();
    const heading = Array.from(el.querySelectorAll('.detail h3')).find((h) =>
      h.textContent?.includes('Defer blocks'),
    );
    expect(heading?.parentElement?.textContent).toContain('on viewport');
  });
});

describe('component copy text', () => {
  it('falls back to the component path without a selector', () => {
    expect(hostPathText({ path: 'Page > Label' })).toBe('Page > Label');
    expect(hostPathText({ path: 'a > b', selector: 'a > b:nth-child(2)' })).toBe(
      'a > b:nth-child(2)',
    );
  });

  it('keeps the masked values the page sent', () => {
    const text = componentJson({ ...detail(1), selector: undefined });
    expect(JSON.parse(text).properties.token).toBe('[redacted]');
    expect(JSON.parse(text).selector).toBeUndefined();
  });
});

describe('ValueFlash', () => {
  it('flashes changed keys for a second, and starts over for another component', () => {
    vi.useFakeTimers();
    const flash = new ValueFlash();
    flash.update('p1|c1', new Map([['input:a', 1]]));
    flash.update('p1|c1', new Map([['input:a', 2]]));
    expect([...flash.changed()]).toEqual(['input:a']);
    vi.advanceTimersByTime(999);
    expect(flash.changed().size).toBe(1);
    vi.advanceTimersByTime(1);
    expect(flash.changed().size).toBe(0);
    flash.update('p1|c2', new Map([['input:a', 3]]));
    expect(flash.changed().size).toBe(0);
  });

  it('does not count a new or a removed key as a change', () => {
    expect(
      changedKeys(
        new Map([
          ['a', '1'],
          ['b', '2'],
        ]),
        new Map([
          ['a', '1'],
          ['c', '3'],
        ]),
      ),
    ).toEqual([]);
  });
});
