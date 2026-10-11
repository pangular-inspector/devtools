import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ExtensionBridge,
  insideExtension,
  requestPanelAction,
  type PanelActionResult,
} from '../extension-bridge';
import { ComponentTree } from '../pages/component-tree';

const root = { id: 'c1', name: 'Card', tag: 'app-card', children: [] };

function detail(source?: { file: string; line: number }) {
  return {
    id: 'c1',
    name: 'Card',
    tag: 'app-card',
    path: 'app-card',
    ...(source ? { source } : {}),
    inputs: [],
    outputs: [],
    properties: [],
    listeners: [],
    directives: [],
    dependencies: [],
  };
}

function fakeClient(pages: Record<string, unknown>): DevframeRpcClient {
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function fakeBridge(available: boolean, result: PanelActionResult = { ok: true }) {
  return {
    available,
    reveal: vi.fn(async () => result),
    openSource: vi.fn(async () => result),
  };
}

async function render(
  bridge: ReturnType<typeof fakeBridge>,
  { platform, source }: { platform?: string; source?: { file: string; line: number } } = {},
) {
  TestBed.configureTestingModule({ providers: [{ provide: ExtensionBridge, useValue: bridge }] });
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput(
    'rpc',
    fakeClient({
      p1: {
        pageId: 'p1',
        platform,
        roots: [root],
        count: 1,
        detail: detail(source),
        reportedAt: 1000,
      },
    }),
  );
  await settle(fixture);
  if (fixture.componentInstance.selectedId() !== 'c1') fixture.componentInstance.select('c1');
  await settle(fixture);
  return fixture;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function button(fixture: ComponentFixture<unknown>, label: string) {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  );
}

describe('Chrome DevTools actions on a component', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('are hidden outside the extension', async () => {
    const fixture = await render(fakeBridge(false));
    const title = (fixture.nativeElement as HTMLElement).querySelector('#ct-detail-title');
    expect(title?.textContent).toBe('Card');
    expect(button(fixture, 'Reveal in Elements')).toBeUndefined();
    expect(button(fixture, 'Open source')).toBeUndefined();
  });

  it('are hidden for an Angular Native page', async () => {
    const fixture = await render(fakeBridge(true), { platform: 'angular-native' });
    const title = (fixture.nativeElement as HTMLElement).querySelector('#ct-detail-title');
    expect(title?.textContent).toBe('Card');
    expect(button(fixture, 'Reveal in Elements')).toBeUndefined();
  });

  it('show as labelled buttons in the extension and send the page and instance', async () => {
    const bridge = fakeBridge(true);
    const fixture = await render(bridge, { source: { file: 'src/app/card.ts', line: 12 } });
    const reveal = button(fixture, 'Reveal in Elements')!;
    const open = button(fixture, 'Open source')!;
    expect(reveal.type).toBe('button');
    expect(reveal.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Chrome DevTools');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('src/app/card.ts:12');

    reveal.click();
    open.click();
    await settle(fixture);
    expect(bridge.reveal).toHaveBeenCalledWith('p1', 'c1');
    expect(bridge.openSource).toHaveBeenCalledWith('p1', 'c1', {
      file: 'src/app/card.ts',
      line: 12,
    });
  });

  it('shows the path to open by hand when Sources has no such file', async () => {
    const bridge = fakeBridge(true, { ok: false, error: 'not-found' });
    const fixture = await render(bridge, { source: { file: 'src/app/card.ts', line: 12 } });
    button(fixture, 'Open source')!.click();
    await settle(fixture);
    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '.action-message[role="status"]',
    );
    expect(status?.textContent).toBe(
      'Not found in Sources. Open src/app/card.ts:12 in your editor.',
    );
  });
});

describe('extension bridge requests', () => {
  function fakeWindow(protocol = 'chrome-extension:') {
    const listeners = new Set<(event: MessageEvent) => void>();
    const parent = { postMessage: vi.fn() };
    const win = {
      location: { protocol, origin: 'chrome-extension://ext' },
      parent,
      addEventListener: (_: string, l: (event: MessageEvent) => void) => listeners.add(l),
      removeEventListener: (_: string, l: (event: MessageEvent) => void) => listeners.delete(l),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id),
    };
    const send = (data: unknown, source: unknown = parent, origin = 'chrome-extension://ext') =>
      [...listeners].forEach((l) => l({ data, source, origin } as MessageEvent));
    return { win: win as unknown as Window, parent, send, listeners };
  }

  it('knows it runs inside the extension panel only in a chrome-extension frame', () => {
    expect(insideExtension(fakeWindow().win)).toBe(true);
    expect(insideExtension(fakeWindow('http:').win)).toBe(false);
    const top = fakeWindow().win as unknown as { parent: unknown };
    top.parent = top;
    expect(insideExtension(top as unknown as Window)).toBe(false);
  });

  it('posts to the parent and resolves with the matching answer only', async () => {
    const { win, parent, send, listeners } = fakeWindow();
    const pending = requestPanelAction(
      { type: 'pangular:reveal-element', pageId: 'p1', id: 'c1' },
      win,
    );
    const [[message, origin]] = parent.postMessage.mock.calls;
    expect(origin).toBe('chrome-extension://ext');
    expect(message).toMatchObject({ type: 'pangular:reveal-element', pageId: 'p1', id: 'c1' });
    const { requestId } = message as { requestId: string };

    send({ type: 'pangular:panel-action-result', requestId: 'other', ok: true });
    send(
      { type: 'pangular:panel-action-result', requestId, ok: true },
      {},
      'chrome-extension://ext',
    );
    send({ type: 'pangular:panel-action-result', requestId, ok: true }, parent, 'https://evil');
    expect(listeners.size).toBe(1);
    send({ type: 'pangular:panel-action-result', requestId, ok: true, opened: 'file' });
    await expect(pending).resolves.toEqual({ ok: true, opened: 'file' });
    expect(listeners.size).toBe(0);
  });

  it('gives up after a timeout when the bridge does not answer', async () => {
    vi.useFakeTimers();
    try {
      const { win, listeners } = fakeWindow();
      const pending = requestPanelAction({ type: 'pangular:open-source' }, win);
      await vi.advanceTimersByTimeAsync(6000);
      await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
      expect(listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
