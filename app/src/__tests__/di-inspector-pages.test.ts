import { type ComponentFixture, TestBed } from '@angular/core/testing';
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
      // The page-angular state answers at once; only the tree load is held.
      sharedState: (name: string) =>
        name === 'page-angular'
          ? Promise.resolve({ value: () => null, on: () => () => {} })
          : new Promise((resolve) => {
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
      sharedState: (name: string) => {
        if (name === 'page-angular') {
          return Promise.resolve({ value: () => null, on: () => () => {} });
        }
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

describe('injector search box focus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function clickNamed(host: HTMLElement, name: string) {
    const button = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );
    if (!button) throw new Error(`No button named ${name}`);
    button.focus();
    button.click();
  }

  it('keeps focus on the search box after Clear filters in the live tree', async () => {
    const fixture = await render({
      roots: [
        {
          injector: { id: 'a', type: 'element', name: 'A', providerCount: 0, component: 'A' },
          providers: [],
          children: [],
        },
      ],
      environment: [],
    });
    const host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    fixture.componentInstance.query.set('zzz');
    await fixture.whenStable();
    clickNamed(host, 'Clear filters');
    await fixture.whenStable();
    expect(fixture.componentInstance.query()).toBe('');
    expect(document.activeElement).toBe(
      host.querySelector('input[aria-label="Find a token, component or injector"]'),
    );
  });

  it('keeps focus on the search box after Clear filter in the source scan', async () => {
    const fixture = await render({});
    const host = fixture.nativeElement as HTMLElement;
    document.body.append(host);
    fixture.componentInstance.sourceProviders.set([
      {
        token: 'CartService',
        source: 'CartService',
        file: 'src/cart.ts',
        line: 1,
        type: 'injectable',
      },
    ]);
    fixture.componentInstance.query.set('zzz');
    await fixture.whenStable();
    clickNamed(host, 'Clear filters');
    await fixture.whenStable();
    expect(host.textContent).toContain('CartService');
    expect(document.activeElement).toBe(
      host.querySelector('input[aria-label="Filter by token or file"]'),
    );
  });
});

describe('injector tree page picker', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  const element = (id: string, name: string) => ({
    injector: { id, type: 'element', name, providerCount: 0, component: name, selector: name },
    providers: [],
    children: [],
  });
  const pageA = { pageId: 'A', reportedAt: 1, roots: [element('a1', 'app-a')], environment: [] };
  const pageB = { pageId: 'B', reportedAt: 2, roots: [element('b1', 'app-b')], environment: [] };
  const titles = {
    pages: { A: { title: 'Tab A', url: '/a' }, B: { title: 'Tab B', url: '/b' } },
  };
  const shared = (...pages: (typeof pageA)[]) => {
    const latest = [...pages].sort((x, y) => y.reportedAt - x.reportedAt)[0];
    return {
      roots: latest?.roots ?? [],
      environment: [],
      pages: Object.fromEntries(pages.map((page) => [page.pageId, page])),
    };
  };

  async function renderPages(first: unknown) {
    const listeners = new Set<(value: unknown) => void>();
    const calls: unknown[][] = [];
    const rpc = {
      call: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve([]);
      },
      callEvent: () => Promise.resolve(),
      sharedState: (name: string) =>
        Promise.resolve({
          value: () => (name === 'injector-tree' ? first : titles),
          on: (_event: string, listener: (value: unknown) => void) => {
            if (name === 'injector-tree') listeners.add(listener);
            return () => listeners.delete(listener);
          },
        }),
    };
    const fixture = TestBed.createComponent(DiInspector);
    fixture.componentRef.setInput('rpc', {
      connectionMeta: {},
      scope: () => ({ rpc }),
    } as unknown as DevframeRpcClient);
    document.body.append(fixture.nativeElement);
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
    };
    await settle();
    const push = async (value: unknown) => {
      for (const listener of listeners) listener(value);
      await settle();
    };
    return { fixture, push, calls, el: fixture.nativeElement as HTMLElement };
  }

  const trigger = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('[aria-labelledby="di-page-label"][role="combobox"]');

  async function choose(fixture: ComponentFixture<DiInspector>, label: string) {
    const el = fixture.nativeElement as HTMLElement;
    trigger(el)!.click();
    await fixture.whenStable();
    const option = Array.from(el.querySelectorAll<HTMLElement>('[role="option"]')).find((o) =>
      o.textContent?.includes(label),
    );
    expect(option).toBeDefined();
    option!.click();
    await fixture.whenStable();
  }

  const names = (fixture: ComponentFixture<DiInspector>) =>
    fixture.componentInstance.roots().map((n) => n.injector.name);
  const notice = (el: HTMLElement) =>
    el.querySelector('[role="status"].sr-only')?.textContent?.trim();

  it('shows no page picker when one page reports', async () => {
    const { el, fixture } = await renderPages(shared(pageA));
    expect(trigger(el)).toBeNull();
    expect(names(fixture)).toEqual(['app-a']);
  });

  it('shows no page picker when the panel belongs to a page', async () => {
    scopeToPage('A');
    const { el, fixture } = await renderPages(shared(pageA, pageB));
    expect(trigger(el)).toBeNull();
    expect(names(fixture)).toEqual(['app-a']);
  });

  it('switches the tree to the chosen page and highlights on that page', async () => {
    const { fixture, el, calls } = await renderPages(shared(pageA, pageB));
    expect(trigger(el)?.textContent).toContain('Tab B');
    expect(names(fixture)).toEqual(['app-b']);

    await choose(fixture, 'Tab A');
    expect(names(fixture)).toEqual(['app-a']);
    expect(el.querySelector('.row[data-id="a1"]')).not.toBeNull();
    expect(el.querySelector('.row[data-id="b1"]')).toBeNull();
    expect(notice(el)).toBe('Showing the injectors of Tab A.');

    fixture.componentInstance.highlight(fixture.componentInstance.roots()[0]);
    expect(calls).toContainEqual(['request-page-highlight', { pageId: 'A', selector: 'app-a' }]);
  });

  it('stays on the page it shows when another page reports later', async () => {
    const { fixture, push } = await renderPages(shared(pageA));
    fixture.componentInstance.select('a1');
    await push(shared(pageA, { ...pageB, reportedAt: 5 }));
    expect(names(fixture)).toEqual(['app-a']);
    expect(fixture.componentInstance.selected()?.injector.id).toBe('a1');
    expect(fixture.componentInstance.gone()).toBeNull();
  });

  it('keeps the chosen page and its selection when the other page reports', async () => {
    const { fixture, push, el } = await renderPages(shared(pageA, pageB));
    await choose(fixture, 'Tab A');
    fixture.componentInstance.select('a1');
    await push(shared(pageA, { ...pageB, reportedAt: 9, roots: [element('b2', 'app-b2')] }));
    expect(names(fixture)).toEqual(['app-a']);
    expect(fixture.componentInstance.selected()?.injector.id).toBe('a1');
    expect(el.textContent).not.toContain('This injector is no longer on the page');
  });

  it('keeps a selection per page', async () => {
    const twoRoots = { ...pageB, roots: [element('b1', 'app-b'), element('b2', 'app-b2')] };
    const { fixture } = await renderPages(shared(pageA, twoRoots));
    fixture.componentInstance.select('b2');
    await choose(fixture, 'Tab A');
    expect(fixture.componentInstance.selectedId()).toBeNull();
    expect(fixture.componentInstance.gone()).toBeNull();
    await choose(fixture, 'Tab B');
    expect(fixture.componentInstance.selected()?.injector.id).toBe('b2');
  });

  it('falls back to another page and announces it when the chosen page closes', async () => {
    const { fixture, push, el } = await renderPages(shared(pageA, pageB));
    await choose(fixture, 'Tab A');
    fixture.componentInstance.select('a1');
    await push(shared(pageB));
    expect(names(fixture)).toEqual(['app-b']);
    expect(trigger(el)).toBeNull();
    expect(notice(el)).toBe('Tab A closed, so this shows another page.');
    expect(el.textContent).not.toContain('This injector is no longer on the page');
  });
});

describe('injector tree search and zone', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  const providing = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      injector: {
        id: `e${i}`,
        type: 'element',
        name: `app-${i}`,
        providerCount: 1,
        component: 'C',
      },
      providers: [{ token: 'Store', type: 'class', isViewProvider: false }],
      children: [],
    }));

  it('shows the change detection mode the page reported', async () => {
    const fixture = await render({ roots: providing(1), environment: [], zone: 'zone-unused' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Change detection: Zoneless, zone.js loaded',
    );
  });

  it('says how many more injectors provide the token past the shown chips', async () => {
    const fixture = await render({ roots: providing(15), environment: [] });
    fixture.componentInstance.query.set('store');
    await fixture.whenStable();
    const where = (fixture.nativeElement as HTMLElement).querySelector('.where')!;
    expect(where.querySelectorAll('.chip')).toHaveLength(12);
    expect(where.textContent).toContain('+3 more');
    expect(where.getAttribute('role')).toBeNull();
  });

  it('announces one search summary once typing pauses', async () => {
    const fixture = await render({ roots: providing(2), environment: [] });
    vi.useFakeTimers();
    try {
      const status = () =>
        (fixture.nativeElement as HTMLElement).querySelector('[role="status"].sr-only')!
          .textContent;
      for (const query of ['s', 'st', 'sto', 'store']) {
        fixture.componentInstance.query.set(query);
        fixture.detectChanges();
        await vi.advanceTimersByTimeAsync(100);
      }
      expect(status()).toBe('');
      await vi.advanceTimersByTimeAsync(600);
      fixture.detectChanges();
      expect(status()).toBe('2 injectors provide “store”.');
      fixture.componentInstance.query.set('zzz');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(600);
      fixture.detectChanges();
      expect(status()).toBe('Nothing here matches “zzz”.');
    } finally {
      vi.useRealTimers();
    }
  });
});
