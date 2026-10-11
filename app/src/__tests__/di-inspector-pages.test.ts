import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scopeToPage } from '../page-id';
import { DiInspector } from '../pages/di-inspector';

const node = (name: string) => ({
  injector: { name, kind: 'element' },
  providers: [],
  children: [],
});

function client(shared: unknown, calls: string[] = []): DevframeRpcClient {
  const rpc = {
    call: (name: string) => {
      calls.push(name);
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => shared,
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function render(shared: unknown) {
  const fixture = TestBed.createComponent(DiInspector);
  fixture.componentRef.setInput('rpc', client(shared));
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

describe('injector tree loading and row actions', () => {
  afterEach(() => {
    scopeToPage(null);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('keeps one tree subscription when loads overlap', async () => {
    const pending: ((value: unknown) => void)[] = [];
    let active = 0;
    const rpc = {
      call: () => Promise.resolve([]),
      callEvent: () => Promise.resolve(),
      sharedState: () =>
        new Promise((resolve) => {
          pending.push(() =>
            resolve({
              value: () => ({ roots: [], environment: [] }),
              on: () => {
                active++;
                return () => {
                  active--;
                };
              },
            }),
          );
        }),
    };
    const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(DiInspector);
    fixture.componentRef.setInput('rpc', client);
    fixture.detectChanges();
    fixture.componentRef.setInput('rpc', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('rpc', client);
    fixture.detectChanges();
    expect(pending).toHaveLength(2);
    pending.forEach((resolve) => resolve(undefined));
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    expect(active).toBe(1);
    fixture.destroy();
    expect(active).toBe(0);
  });

  it('applies the newest load when an older one for the same client resolves last', async () => {
    const pending: (() => void)[] = [];
    const states = [
      { roots: [node('old')], environment: [] },
      { roots: [node('new')], environment: [] },
    ];
    let call = 0;
    const rpc = {
      call: () => Promise.resolve([]),
      callEvent: () => Promise.resolve(),
      sharedState: () => {
        const state = states[call++];
        return new Promise((resolve) => {
          pending.push(() => resolve({ value: () => state, on: () => () => {} }));
        });
      },
    };
    const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(DiInspector);
    fixture.componentRef.setInput('rpc', client);
    fixture.detectChanges();
    fixture.componentRef.setInput('rpc', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('rpc', client);
    fixture.detectChanges();
    pending[1]();
    await new Promise((resolve) => setTimeout(resolve));
    pending[0]();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    expect(fixture.componentInstance.roots().map((n) => n.injector.name)).toEqual(['new']);
  });

  it('scrolls to a revealed row that was collapsed and not yet rendered', async () => {
    const tree = [
      {
        injector: { id: 'a', type: 'element', name: 'A', providerCount: 0, component: 'A' },
        providers: [],
        children: [
          {
            injector: { id: 'b', type: 'element', name: 'B', providerCount: 0, component: 'B' },
            providers: [],
            children: [],
          },
        ],
      },
    ];
    const fixture = await render({ roots: tree, environment: [] });
    fixture.componentInstance.collapsed.set(new Set(['a']));
    fixture.detectChanges();
    expect(document.querySelector('.row[data-id="b"]')).toBeNull();
    const scrolled: string[] = [];
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute('data-id') ?? '');
    };
    document.body.appendChild(fixture.nativeElement);
    fixture.componentInstance.reveal('b');
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrolled).toContain('b');
  });

  it('sends a row highlight with the page id of the tab the panel belongs to', async () => {
    scopeToPage('A');
    const calls: unknown[][] = [];
    const rpc = {
      call: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve([]);
      },
      callEvent: () => Promise.resolve(),
      sharedState: () => Promise.resolve({ value: () => ({}), on: () => () => {} }),
    };
    const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(DiInspector);
    fixture.componentRef.setInput('rpc', client);
    fixture.detectChanges();
    fixture.componentInstance.highlight({
      injector: { id: 'a', type: 'element', name: 'A', providerCount: 0, selector: 'app-card' },
      providers: [],
      children: [],
    });
    expect(calls).toContainEqual(['request-page-highlight', { pageId: 'A', selector: 'app-card' }]);
  });
});

describe('injector tree selection that leaves the page', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const element = (id: string, name: string) => ({
    injector: { id, type: 'element', name, providerCount: 0, component: name },
    providers: [],
    children: [],
  });

  async function live(first: unknown) {
    const listeners: ((value: unknown) => void)[] = [];
    const rpc = {
      call: () => Promise.resolve([]),
      callEvent: () => Promise.resolve(),
      sharedState: () =>
        Promise.resolve({
          value: () => first,
          on: (_: string, listener: (value: unknown) => void) => {
            listeners.push(listener);
            return () => {};
          },
        }),
    };
    const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(DiInspector);
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
    };
    await settle();
    const push = async (value: unknown) => {
      listeners.forEach((listener) => listener(value));
      await settle();
    };
    return { fixture, push, el: fixture.nativeElement as HTMLElement };
  }

  it('shows a gone note and announces it instead of silently selecting another injector', async () => {
    const { fixture, push, el } = await live({
      roots: [element('a', 'app-a'), element('b', 'app-b')],
      environment: [],
    });
    const status = el.querySelector('[role="status"].sr-only');
    expect(status?.textContent?.trim()).toBe('');
    fixture.componentInstance.select('b');
    await fixture.whenStable();
    expect(el.querySelector('#di-detail-title')?.textContent).toContain('<app-b>');

    await push({ roots: [element('a', 'app-a')], environment: [] });
    expect(fixture.componentInstance.selected()).toBeNull();
    expect(el.querySelector('#di-detail-title')?.textContent).toContain('<app-b>');
    expect(el.textContent).toContain('This injector is no longer on the page');
    expect(el.querySelector('.row[aria-selected="true"]')).toBeNull();
    expect(el.querySelector('[role="status"].sr-only')).toBe(status);
    expect(status?.textContent?.trim()).toBe('The selected injector is no longer on the page.');

    const show = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show <app-a>'),
    );
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    Element.prototype.scrollIntoView ??= () => {};
    show!.click();
    await fixture.whenStable();
    vi.unstubAllGlobals();
    expect(fixture.componentInstance.selected()?.injector.id).toBe('a');
    expect(el.textContent).not.toContain('This injector is no longer on the page');

    // A second injector going away changes the status text, so it is read out again.
    const before = status?.textContent;
    await push({ roots: [element('d', 'app-d')], environment: [] });
    expect(status?.textContent?.trim()).toBe('The selected injector is no longer on the page.');
    expect(status?.textContent).not.toBe(before);
  });

  it('still shows the first injector while nothing is chosen', async () => {
    const { fixture, push } = await live({ roots: [element('a', 'app-a')], environment: [] });
    expect(fixture.componentInstance.selected()?.injector.id).toBe('a');
    await push({ roots: [element('c', 'app-c')], environment: [] });
    expect(fixture.componentInstance.selected()?.injector.id).toBe('c');
    expect(fixture.componentInstance.gone()).toBeNull();
  });
});

describe('injector tree page selection', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  it('never shows another tab when its own page has not reported', async () => {
    scopeToPage('A');
    const fixture = await render({
      roots: [node('from-B')],
      environment: [node('env-B')],
      pages: { B: { roots: [node('from-B')], environment: [node('env-B')] } },
    });
    expect(fixture.componentInstance.roots()).toEqual([]);
    expect(fixture.componentInstance.environment()).toEqual([]);
  });

  it('shows its own page when it has reported', async () => {
    scopeToPage('A');
    const fixture = await render({
      roots: [node('from-B')],
      pages: { A: { roots: [node('from-A')], environment: [] }, B: { roots: [node('from-B')] } },
    });
    expect(fixture.componentInstance.roots().map((n) => n.injector.name)).toEqual(['from-A']);
  });

  it('follows the shared top level when the panel has no page id', async () => {
    const fixture = await render({ roots: [node('shared')], environment: [] });
    expect(fixture.componentInstance.roots().map((n) => n.injector.name)).toEqual(['shared']);
  });
});
