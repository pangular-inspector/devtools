import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeToPage } from '../page-id';
import { PipesInspector } from '../pages/pipes-inspector';

function client(instrumented: string[] = []) {
  const requests: unknown[] = [];
  const rpc = {
    call: (name: string, arg?: unknown) => {
      if (name === 'request-instrument-pipes') {
        requests.push(arg);
        return Promise.resolve({ pages: 1 });
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => ({ pipes: [], async: [], reportedAt: 0, instrumented }),
        on: () => () => {},
      }),
  };
  const rpcClient = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { rpcClient, requests };
}

async function render(rpc: DevframeRpcClient) {
  const fixture = TestBed.createComponent(PipesInspector);
  fixture.componentRef.setInput('rpc', rpc);
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

describe('pipe recording request', () => {
  afterEach(() => {
    scopeToPage(null);
    document.body.innerHTML = '';
  });

  it('asks to record on the page the panel belongs to', async () => {
    scopeToPage('A');
    const { rpcClient, requests } = client();
    const fixture = await render(rpcClient);
    await fixture.componentInstance.toggleInstrument();
    expect(requests).toEqual([{ pageId: 'A', on: true }]);
  });

  it('stops recording without a page id so every recording page stops', async () => {
    const { rpcClient, requests } = client(['A', 'B']);
    const fixture = await render(rpcClient);
    await fixture.componentInstance.toggleInstrument();
    expect(requests).toEqual([{ on: false }]);
  });
});
