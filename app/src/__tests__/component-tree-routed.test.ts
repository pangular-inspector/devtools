import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';

function treePage(pageId: string, reportedAt: number) {
  return {
    pageId,
    title: pageId,
    url: `/${pageId}`,
    roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
    count: 1,
    detail: null,
    reportedAt,
  };
}

function routerPage(pageId: string, route: string, snapshot: boolean) {
  return {
    pageId,
    reportedAt: 1,
    snapshot: snapshot ? { url: route } : undefined,
    outlets: [{ outlet: 'primary', activated: true, devtoolsId: 'c1', route, children: [] }],
  };
}

function client(): DevframeRpcClient {
  const state: Record<string, unknown> = {
    'component-tree': { pages: { a: treePage('a', 2000), b: treePage('b', 1000) } },
    router: {
      pages: [routerPage('a', '/route-a', false), routerPage('b', '/route-b', true)],
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

function routed(fixture: ComponentFixture<unknown>): string[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.routed')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

describe('ComponentTree routed badges', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('come from the router report of the page the tree shows', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', client());
    await settle(fixture);
    expect(fixture.componentInstance.page()?.pageId).toBe('a');
    expect(routed(fixture)).toContain('/route-a');
    expect(routed(fixture)).not.toContain('/route-b');

    fixture.componentInstance.selectPage('b');
    await settle(fixture);
    expect(routed(fixture)).toContain('/route-b');
    expect(routed(fixture)).not.toContain('/route-a');
  });
});
