import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
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
