import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { isAngularNativePage } from '../native-page';
import { ComponentTree } from '../pages/component-tree';

function fakeClient(pages: Record<string, unknown>): DevframeRpcClient {
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

const root = { id: 'c1', name: 'App', tag: 'app-root', children: [] };

function page(pageId: string, platform?: string) {
  return { pageId, platform, roots: [root], count: 1, detail: null, reportedAt: 1000 };
}

async function render(platform?: string) {
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput('rpc', fakeClient({ p1: page('p1', platform) }));
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

function buttons(fixture: ComponentFixture<unknown>): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map(
    (button) => button.textContent?.trim() ?? '',
  );
}

function liveClient(initial: Record<string, unknown>) {
  let pages = initial;
  const listeners = new Set<(value: unknown) => void>();
  const calls: { name: string; arg: unknown }[] = [];
  const rpc = {
    call: (name: string, arg: unknown) => {
      calls.push({ name, arg });
      return name === 'request-component-pick' ? new Promise(() => {}) : Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: (_event: string, listener: (value: unknown) => void) => {
          if (name === 'component-tree') listeners.add(listener);
          return () => listeners.delete(listener);
        },
      }),
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  const report = (next: Record<string, unknown>) => {
    pages = next;
    for (const listener of listeners) listener({ pages });
  };
  return { client, calls, report };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

describe('browser-only controls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('knows an Angular Native page by its platform', () => {
    expect(isAngularNativePage({ platform: 'angular-native' })).toBe(true);
    expect(isAngularNativePage({})).toBe(false);
    expect(isAngularNativePage(null)).toBe(false);
  });

  it('shows the component picker and change detection recording for a browser page', async () => {
    const fixture = await render();
    expect(buttons(fixture)).toContain('Pick component on page');
    expect(buttons(fixture)).toContain('Record');
    expect((fixture.nativeElement as HTMLElement).querySelector('#cd-heading')).not.toBeNull();
  });

  it('hides them for an Angular Native page and keeps the tree', async () => {
    const fixture = await render('angular-native');
    const host = fixture.nativeElement as HTMLElement;
    expect(buttons(fixture)).not.toContain('Pick component on page');
    expect(buttons(fixture)).not.toContain('Record');
    expect(host.querySelector('#cd-heading')).toBeNull();
    expect(host.textContent).toContain('App');
    expect(host.querySelector('input[type="search"]')).not.toBeNull();
  });

  it('cancels a pick on its own page when the dropdown shows another page', async () => {
    const { client, calls } = liveClient({ p1: page('p1'), p2: page('p2') });
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client);
    await settle(fixture);
    const tree = fixture.componentInstance;
    const shown = tree.page()!.pageId;
    const other = shown === 'p1' ? 'p2' : 'p1';

    void tree.pick();
    await settle(fixture);
    expect(buttons(fixture)).toContain('Cancel pick');

    tree.selectPage(other);
    await settle(fixture);
    expect(calls).toContainEqual({ name: 'cancel-component-pick', arg: { pageId: shown } });
    expect(tree.picking()).toBe(false);
    expect(buttons(fixture)).toContain('Pick component on page');
  });

  it('cancels a pick on the browser page when an Angular Native page takes over', async () => {
    const { client, calls, report } = liveClient({ p1: page('p1') });
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client);
    await settle(fixture);
    const tree = fixture.componentInstance;

    void tree.pick();
    await settle(fixture);
    report({ an42: page('an42', 'angular-native') });
    await settle(fixture);

    expect(tree.page()?.pageId).toBe('an42');
    expect(calls).toContainEqual({ name: 'cancel-component-pick', arg: { pageId: 'p1' } });
    expect(tree.picking()).toBe(false);
    expect(buttons(fixture)).not.toContain('Cancel pick');
  });
});
