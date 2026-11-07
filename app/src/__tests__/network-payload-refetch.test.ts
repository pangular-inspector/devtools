import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const calls: [string, unknown][] = [];
let answer: unknown = { ok: true, found: true, entries: 2, status: 200 };

vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, name: string, arg?: unknown) => {
    calls.push([name, arg]);
    return answer;
  },
}));

const { NetworkInspector } = await import('../pages/network-inspector');

const page = {
  pageId: 'p1',
  url: 'http://localhost:4000/trips',
  initialUrl: 'http://localhost:4000/trips',
  title: 'Trips',
  hydration: null,
  calls: [],
  reportedAt: 1,
};

function client(
  actions: Record<string, boolean> = {},
  payload: Record<string, unknown> = { found: true, size: 7, entries: [] },
): DevframeRpcClient {
  const values: Record<string, unknown> = {
    http: { serverCalls: [], pages: [page], rules: [], ssrOverrides: [] },
    'http-payloads': { pages: { p1: payload } },
  };
  const rpc = {
    sharedState: (name: string) =>
      Promise.resolve({ value: () => values[name], on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: { pangular: { actions } } },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
}

let fixture: ComponentFixture<InstanceType<typeof NetworkInspector>>;

async function render(rpc: DevframeRpcClient) {
  fixture = TestBed.createComponent(NetworkInspector);
  fixture.componentRef.setInput('rpc', rpc);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const button = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>('button[data-refetch-payload]')!;

describe('NetworkInspector payload refetch', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    calls.length = 0;
    answer = { ok: true, found: true, entries: 2, status: 200 };
  });

  it('asks the server to refetch the selected page and announces the result', async () => {
    const host = await render(client());
    const refetch = button(host);
    expect(refetch.textContent!.trim()).toBe('Refetch');
    expect(refetch.getAttribute('aria-describedby')).toBe('refetch-hint');
    refetch.click();
    await fixture.whenStable();
    expect(calls).toContainEqual(['request-http-payload-refetch', { pageId: 'p1' }]);
    expect(host.querySelector('.toolbar [role="status"]')!.textContent).toBe(
      'Refetched: 2 entries.',
    );
  });

  it('reads out the reason when the refetch does nothing', async () => {
    answer = { error: 'The page did not answer within 15s. Is the tab still open?' };
    const host = await render(client());
    button(host).click();
    await fixture.whenStable();
    expect(host.querySelector('.toolbar [role="status"]')!.textContent).toBe(
      'The page did not answer within 15s. Is the tab still open?',
    );
  });

  it('is off when HTTP actions are off, and says why', async () => {
    const host = await render(client({ http: false }));
    const refetch = button(host);
    expect(refetch.disabled).toBe(true);
    expect(refetch.getAttribute('aria-describedby')).toBe('http-writes-off refetch-hint');
    expect(host.querySelector('#http-writes-off')).not.toBeNull();
  });

  it('marks a payload that came from a refetch', async () => {
    const host = await render(client({}, { found: true, size: 7, entries: [], refetchedAt: 5 }));
    expect(host.querySelector('[data-refetched]')!.textContent).toBe('Refetched');
  });
});
