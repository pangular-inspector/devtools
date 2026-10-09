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
