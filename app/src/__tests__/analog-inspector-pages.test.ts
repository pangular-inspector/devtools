import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeToPage } from '../page-id';
import { AnalogInspector } from '../pages/analog-inspector';

const project = { analog: true, routes: [], api: [], middleware: [], content: [] };

const page = (pageId: string, url: string) => ({ pageId, url, chain: [] });

function client(options: { state?: unknown; failures?: number } = {}): DevframeRpcClient {
  let failures = options.failures ?? 0;
  const rpc = {
    call: (name: string) => {
      if (name === 'analog-project') {
        if (failures > 0) {
          failures--;
          return Promise.reject(new Error('scan failed'));
        }
        return Promise.resolve(project);
      }
      if (name === 'analog-render') return Promise.resolve({ rows: [], plan: null });
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => options.state ?? {},
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render(rpc: DevframeRpcClient) {
  const fixture = TestBed.createComponent(AnalogInspector);
  fixture.componentRef.setInput('rpc', rpc);
  await settle(fixture);
  return fixture;
}

describe('Analog page selection', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  it('shows the tab the panel belongs to, not whichever reported last', async () => {
    scopeToPage('A');
    const fixture = await render(
      client({ state: { pages: [page('B', '/from-b'), page('A', '/from-a')] } }),
    );
    expect(fixture.componentInstance.page()?.url).toBe('/from-a');
  });

  it('shows nothing from another tab while its own tab has not reported', async () => {
    scopeToPage('A');
    const fixture = await render(client({ state: { pages: [page('B', '/from-b')] } }));
    expect(fixture.componentInstance.page()).toBeNull();
  });

  it('follows the newest report when the panel has no page id', async () => {
    const fixture = await render(
      client({ state: { pages: [page('B', '/from-b'), page('A', '/from-a')] } }),
    );
    expect(fixture.componentInstance.page()?.url).toBe('/from-b');
  });
});

describe('Analog project load', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows an error with a retry instead of reading the project forever', async () => {
    const fixture = await render(client({ failures: 2 }));
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Could not read');
    expect(root.querySelector('.loading')).toBeNull();
    const retry = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry'),
    );
    retry!.click();
    await settle(fixture);
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.componentInstance.project()).not.toBeNull();
  });
});

describe('Analog route filter', () => {
  it('clears on Escape', async () => {
    const fixture = await render(client());
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#route-filter',
    )!;
    box.value = 'products';
    box.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(fixture.componentInstance.filter()).toBe('products');
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(fixture);
    expect(fixture.componentInstance.filter()).toBe('');
    expect(box.value).toBe('');
  });
});

describe('Analog open pages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks pages in named outlets with the outlet name', async () => {
    const route = (file: string) => ({
      id: file,
      fullPath: '/',
      file,
      kind: 'page' as const,
      params: [],
      children: [],
    });
    const fixture = await render(
      client({
        state: {
          pages: [
            {
              pageId: 'A',
              url: '/inbox(sidebar:chat)',
              chain: [
                { path: '/inbox', file: '/src/app/pages/inbox.page.ts' },
                { path: '/chat', file: '/src/app/pages/chat.page.ts', outlet: 'sidebar' },
              ],
            },
          ],
        },
      }),
    );
    const inspector = fixture.componentInstance;
    expect(inspector.openText(route('/src/app/pages/inbox.page.ts'))).toBe('open');
    expect(inspector.isOpen(route('/src/app/pages/chat.page.ts'))).toBe(true);
    expect(inspector.openText(route('/src/app/pages/chat.page.ts'))).toBe('open in sidebar');
    expect(inspector.isOpen(route('/src/app/pages/about.page.ts'))).toBe(false);
  });
});

describe('Analog server calls of the tab', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  const call = (id: number, url: string, pageId?: string) => ({
    id,
    at: id,
    kind: 'load',
    method: 'GET',
    url,
    status: 200,
    ms: 1,
    from: 'browser',
    ...(pageId ? { pageId } : {}),
  });
  const state = {
    pages: [page('A', '/a'), page('B', '/b')],
    calls: [call(1, '/from-a', 'A'), call(2, '/from-b', 'B'), call(3, '/untagged')],
    duplicates: [{ route: '/only-b', ssrAt: 1, browserAt: 2 }],
  };

  it('shows only the panel tab\'s calls until "All tabs" is ticked', async () => {
    scopeToPage('A');
    const fixture = await render(client({ state }));
    const inspector = fixture.componentInstance;
    inspector.view.set('server');
    await settle(fixture);
    const root: HTMLElement = fixture.nativeElement;
    const urls = () => Array.from(root.querySelectorAll('td.request .url'), (e) => e.textContent);
    expect(urls()).toEqual(['/from-a']);
    // A warning about a route this tab never called stays hidden.
    expect(inspector.duplicates()).toEqual([]);

    const toggle = root.querySelector<HTMLInputElement>('[data-testid="analog-all-tabs"]')!;
    expect(toggle.parentElement?.textContent).toContain('All tabs (including untagged)');
    toggle.click();
    await settle(fixture);
    expect(urls()).toEqual(['/untagged', '/from-b', '/from-a']);
  });

  it('shows every call when no page reports', async () => {
    const fixture = await render(client({ state: { calls: state.calls } }));
    fixture.componentInstance.view.set('server');
    await settle(fixture);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('td.request .url')).toHaveLength(3);
    expect(root.querySelector('[data-testid="analog-all-tabs"]')).toBeNull();
  });
});
