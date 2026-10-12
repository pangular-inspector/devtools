import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

/** A client whose server is down until `server.up` is set. */
function client() {
  const server = { up: false, calls: 0 };
  const down = () => Promise.reject(new Error('offline'));
  const rpc = {
    call: (name: string) => {
      if (name === 'get-signals') server.calls++;
      return server.up ? Promise.resolve([]) : down();
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      server.up ? Promise.resolve({ value: () => null, on: () => () => {} }) : down(),
  };
  const rpcClient = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { rpcClient, server };
}

const graph = (name: string) => ({
  nodes: [],
  edges: [],
  pageId: 'A',
  component: { id: name, name, tag: `app-${name.toLowerCase()}`, path: '' },
});

/** A client whose graph reads wait until the test settles them, one by one. */
function pendingGraphClient() {
  const reads: { resolve(value: unknown): void; reject(error: Error): void }[] = [];
  const subscribed: string[] = [];
  const rpc = {
    call: () => Promise.reject(new Error('offline')),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) => {
      if (name !== 'signal-graph')
        return Promise.resolve({ value: () => null, on: () => () => {} });
      return new Promise((resolve, reject) => {
        reads.push({
          resolve: (value) =>
            resolve({
              value: () => value,
              on: () => {
                subscribed.push(
                  (value as { graph: { component: { name: string } } }).graph.component.name,
                );
                return () => {};
              },
            }),
          reject,
        });
      });
    },
  };
  const rpcClient = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { rpcClient, reads, subscribed };
}

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render(rpc: DevframeRpcClient) {
  const fixture = TestBed.createComponent(SignalInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', rpc);
  await settle(fixture);
  return fixture;
}

function retryButton(host: HTMLElement) {
  return host.querySelector<HTMLButtonElement>('[role="alert"] button');
}

describe('Signals load error', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('shows an alert with Retry instead of the empty state when loading fails', async () => {
    const { rpcClient } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load signals");
    expect(retryButton(host)?.textContent?.trim()).toBe('Retry');
    expect(host.textContent).not.toContain('No signals found');
  });

  it('keeps focus on Retry when the server still does not answer', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    const button = retryButton(host)!;
    button.focus();
    button.click();
    await settle(fixture);
    expect(server.calls).toBe(2);
    expect(retryButton(host)).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('loads again on Retry and moves focus to the filter box', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    server.up = true;
    retryButton(host)!.focus();
    retryButton(host)!.click();
    await settle(fixture);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('No signals found');
    expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
  });

  it('moves focus to the filter box when the graph comes back but the scan still fails', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    const graphUp = { value: () => ({ graph: graph('Cart'), pages: {} }), on: () => () => {} };
    const rpc = rpcClient.scope('pangular').rpc as unknown as { sharedState: unknown };
    rpc.sharedState = (name: string) =>
      Promise.resolve(
        name === 'signal-graph' ? graphUp : { value: () => null, on: () => () => {} },
      );
    const button = retryButton(host)!;
    button.focus();
    button.click();
    await settle(fixture);
    expect(server.calls).toBe(2);
    expect(retryButton(host)).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
  });

  it('ignores a graph read that a Retry replaced, whether it fails or answers late', async () => {
    const { rpcClient, reads } = pendingGraphClient();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    retryButton(host)!.click();
    await settle(fixture);
    expect(reads).toHaveLength(2);

    reads[1]!.resolve({ graph: graph('Newer'), pages: {} });
    await settle(fixture);
    expect(host.textContent).toContain('Newer');

    reads[0]!.reject(new Error('offline'));
    await settle(fixture);
    expect(host.textContent).toContain('Newer');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the newer graph when an older read answers after it', async () => {
    const { rpcClient, reads, subscribed } = pendingGraphClient();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    retryButton(host)!.click();
    await settle(fixture);
    reads[1]!.resolve({ graph: graph('Newer'), pages: {} });
    await settle(fixture);
    reads[0]!.resolve({ graph: graph('Older'), pages: {} });
    await settle(fixture);
    expect(host.textContent).toContain('Newer');
    expect(host.textContent).not.toContain('Older');
    expect(subscribed).toEqual(['Newer']);
  });
});
