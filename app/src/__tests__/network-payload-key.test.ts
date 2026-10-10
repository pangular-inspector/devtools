import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, _name: string, ...args: unknown[]) => args[0],
}));

const { NetworkInspector } = await import('../pages/network-inspector');

const HTTP_KEY = '3415328893';

const page = {
  pageId: 'p1',
  url: 'http://localhost:4000/examples/ssr?token=[redacted]',
  initialUrl: 'http://localhost:4000/examples/ssr?token=[redacted]',
  title: 'SSR example',
  hydration: null,
  calls: [],
  reportedAt: 1,
};

const payload = {
  found: true,
  size: 120,
  entries: [
    {
      key: HTTP_KEY,
      source: 'http',
      http: { url: '/api/products', status: 200 },
      size: 80,
      value: { items: [1, 2] },
    },
    { key: 'greeting', size: 7, value: 'hello' },
  ],
};

function client(
  actions: Record<string, boolean> = {},
  shown: typeof page = page,
): DevframeRpcClient {
  const values: Record<string, unknown> = {
    http: { serverCalls: [], pages: [shown], rules: [], ssrOverrides: [] },
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

function entries(host: HTMLElement): HTMLDetailsElement[] {
  return [...host.querySelectorAll<HTMLDetailsElement>('.entries details')];
}

describe('NetworkInspector TransferState keys', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('shows the cache key for every entry, also when the summary shows the URL', async () => {
    const host = await render(client());
    const [http, plain] = entries(host);
    expect(http.querySelector('summary .entry-key')!.textContent!.trim()).toBe('/api/products');
    expect(http.querySelector('.entry-key-text')!.textContent).toBe(HTTP_KEY);
    expect(plain.querySelector('.entry-key-text')!.textContent).toBe('greeting');
  });

  it('copies the key and says so politely', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const host = await render(client());
    const copy = entries(host)[0].querySelector<HTMLButtonElement>(
      `button[aria-label="Copy key ${HTTP_KEY}"]`,
    )!;
    copy.click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith(HTTP_KEY);
    const status = host.querySelector('.toolbar [role="status"]')!;
    expect(status.textContent).toBe('Copied.');
  });

  it('reports when the clipboard is not available', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const host = await render(client());
    await fixture.componentInstance.copyKey('greeting');
    await fixture.whenStable();
    expect(host.querySelector('.toolbar [role="status"]')!.textContent).toBe(
      'The clipboard is not available here.',
    );
  });

  it('opens the SSR overrides form filled in for the entry and focuses the value', async () => {
    const host = await render(client());
    const edit = entries(host)[0].querySelector<HTMLButtonElement>(
      `button[aria-label="Edit in SSR overrides, key ${HTTP_KEY}"]`,
    )!;
    expect(edit.textContent!.trim()).toBe('Edit in SSR overrides');
    edit.click();
    await fixture.whenStable();
    const inspector = fixture.componentInstance;
    expect(inspector.overrideDraft()).toEqual({
      kind: 'state-edit',
      pattern: '/examples/ssr',
      key: HTTP_KEY,
      message: '',
      value: '',
    });
    expect(host.querySelector<HTMLInputElement>('#override-key')!.value).toBe(HTTP_KEY);
    expect(host.querySelector<HTMLInputElement>('#override-pattern')!.value).toBe('/examples/ssr');
    expect(document.activeElement).toBe(host.querySelector('#override-value'));
    const note = host.querySelector('#override-value-note')!.textContent!;
    expect(note).toContain('redacted copy');
    expect(note).toContain('whole cache record');
    expect(host.querySelector('#override-value')!.getAttribute('aria-describedby')).toContain(
      'override-value-note',
    );
  });

  it('leaves the pattern empty for the site root, which would match every page', async () => {
    const root = 'http://localhost:4000/';
    const host = await render(client({}, { ...page, url: root, initialUrl: root }));
    entries(host)[0]
      .querySelector<HTMLButtonElement>(
        `button[aria-label="Edit in SSR overrides, key ${HTTP_KEY}"]`,
      )!
      .click();
    await fixture.whenStable();
    expect(fixture.componentInstance.overrideDraft().pattern).toBe('');
    expect(document.activeElement).toBe(host.querySelector('#override-pattern'));
  });

  it('offers the edit only for keys the server keeps exactly', async () => {
    await render(client());
    const inspector = fixture.componentInstance;
    const entry = (key: string) => ({ key, size: 1, value: 1 }) as never;
    expect(inspector.canEditEntry(entry('greeting'))).toBe(true);
    expect(inspector.canEditEntry(entry(' greeting'))).toBe(false);
    expect(inspector.canEditEntry(entry(''))).toBe(false);
    expect(inspector.canEditEntry(entry('k'.repeat(201)))).toBe(false);
  });

  it('hides the edit action when HTTP writes are off but keeps Copy', async () => {
    const host = await render(client({ http: false }));
    const [http] = entries(host);
    expect(http.querySelector('.entry-key-text')!.textContent).toBe(HTTP_KEY);
    const labels = [...http.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(labels).toEqual(['Copy']);
  });
});
