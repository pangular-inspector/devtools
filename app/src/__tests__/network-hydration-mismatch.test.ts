import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

const page = {
  pageId: 'p1',
  url: 'http://localhost:4000/products',
  title: 'Products',
  hydration: {
    enabled: true,
    nodes: { hydrated: 10, skipped: 0, mismatched: 2 },
    mismatches: [
      { component: 'ProductCard', isClass: true, expected: '<div>', actual: '<span>' },
      { component: '#text', expected: 'Price' },
    ],
    skipHydrationHosts: [],
    warnings: [],
  },
  calls: [],
  reportedAt: 1,
};

function client(): DevframeRpcClient {
  const values: Record<string, unknown> = {
    http: { serverCalls: [], pages: [page], rules: [], ssrOverrides: [] },
  };
  const rpc = {
    sharedState: (name: string) =>
      Promise.resolve({ value: () => values[name], on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: { pangular: { actions: {} } } },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
}

let fixture: ComponentFixture<NetworkInspector>;

describe('NetworkInspector hydration mismatches', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows a component class as is and a node name in angle brackets', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    fixture.componentRef.setInput('rpc', client());
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const names = [...host.querySelectorAll('.mismatches > li > code:first-child')].map(
      (code) => code.textContent,
    );
    expect(names).toEqual(['ProductCard', '<#text>']);
  });
});
