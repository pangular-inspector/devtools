import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiInspector } from '../pages/di-inspector';

const PROVIDERS = [
  {
    token: 'CartService',
    source: 'class',
    type: 'injectable',
    providedIn: 'root',
    file: 'src/cart.ts',
    line: 3,
  },
];

const ROOT = {
  injector: { id: 'e1', type: 'element', name: 'app-cart', component: 'Cart', providerCount: 0 },
  providers: [],
  children: [],
};

/** A client whose server parts fail until they are switched on. */
function client() {
  const server = { tree: false, scan: false, scans: 0, roots: [] as unknown[] };
  const down = () => Promise.reject(new Error('offline'));
  const rpc = {
    call: (name: string) => {
      if (name !== 'get-providers') return Promise.resolve([]);
      server.scans++;
      return server.scan ? Promise.resolve(PROVIDERS) : down();
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) => {
      if (name === 'injector-tree' && !server.tree) return down();
      const value = name === 'injector-tree' ? { roots: server.roots, environment: [] } : null;
      return Promise.resolve({ value: () => value, on: () => () => {} });
    },
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
  const fixture = TestBed.createComponent(DiInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', rpc);
  await settle(fixture);
  return fixture;
}

function alertOf(host: HTMLElement) {
  return host.querySelector<HTMLElement>('[role="alert"]');
}

describe('DI load error', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('shows an alert with Retry instead of No DI data found when loading fails', async () => {
    const { rpcClient } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    expect(alertOf(host)?.textContent).toContain("Couldn't load DI data");
    expect(alertOf(host)?.querySelector('button')?.textContent?.trim()).toBe('Retry');
    expect(host.textContent).not.toContain('No DI data found');
  });

  it('keeps focus on Retry when the server still does not answer', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    const button = alertOf(host)!.querySelector('button')!;
    button.focus();
    button.click();
    await settle(fixture);
    expect(server.scans).toBe(2);
    expect(alertOf(host)?.querySelector('button')).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it('loads again on Retry and moves focus to the toolbar', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    server.tree = true;
    server.scan = true;
    alertOf(host)!.querySelector('button')!.click();
    await settle(fixture);
    expect(alertOf(host)).toBeNull();
    expect(host.textContent).toContain('CartService');
    expect(document.activeElement).toBe(host.querySelector('.toolbar input[type="search"]'));
  });

  it('keeps the source scan and says the live tree failed when only the tree fails', async () => {
    const { rpcClient, server } = client();
    server.scan = true;
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('CartService');
    expect(alertOf(host)?.textContent).toContain("Couldn't load the live injector tree");
  });

  it('shows the live injectors when only the source scan fails', async () => {
    const { rpcClient, server } = client();
    server.tree = true;
    server.roots = [ROOT];
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('app-cart');
    expect(host.textContent).not.toContain("Couldn't load DI data");
  });

  it('moves focus to the toolbar when live injectors arrive but the scan still fails', async () => {
    const { rpcClient, server } = client();
    const fixture = await render(rpcClient);
    const host = fixture.nativeElement as HTMLElement;
    server.tree = true;
    server.roots = [ROOT];
    const button = alertOf(host)!.querySelector('button')!;
    button.focus();
    button.click();
    await settle(fixture);
    expect(server.scans).toBe(2);
    expect(alertOf(host)).toBeNull();
    expect(host.textContent).toContain('app-cart');
    expect(document.activeElement).toBe(host.querySelector('.toolbar input, .toolbar button'));
  });
});
