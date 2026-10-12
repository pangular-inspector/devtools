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
});
