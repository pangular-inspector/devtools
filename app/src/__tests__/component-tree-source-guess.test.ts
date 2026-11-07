import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionBridge } from '../extension-bridge';
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

function scanned(file: string, selector: string, line = 5) {
  return {
    selector,
    className: 'Card',
    kind: 'component',
    file,
    line,
    inputs: [],
    outputs: [],
    isStandalone: true,
  };
}

function fakeClient(pages: Record<string, unknown>, components: unknown[]): DevframeRpcClient {
  const rpc = {
    call: (name: string) => Promise.resolve(name === 'get-components' ? components : []),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

const bridge = {
  available: true,
  reveal: vi.fn(async () => ({ ok: true })),
  openSource: vi.fn(async () => ({ ok: true })),
};

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render(components: unknown[], source?: { file: string; line: number }) {
  TestBed.configureTestingModule({ providers: [{ provide: ExtensionBridge, useValue: bridge }] });
  const fixture = TestBed.createComponent(ComponentTree);
  fixture.componentRef.setInput(
    'rpc',
    fakeClient(
      {
        p1: { pageId: 'p1', roots: [root], count: 1, detail: detail(source), reportedAt: 1000 },
      },
      components,
    ),
  );
  await settle(fixture);
  if (fixture.componentInstance.selectedId() !== 'c1') fixture.componentInstance.select('c1');
  await settle(fixture);
  return fixture;
}

function head(fixture: ComponentFixture<unknown>): HTMLElement {
  return (fixture.nativeElement as HTMLElement).querySelector('.detail-head')!;
}

function text(element: Element | null | undefined) {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function openSourceButton(fixture: ComponentFixture<unknown>) {
  return [...head(fixture).querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Open source',
  )!;
}

describe('Component source location without debug info', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    bridge.openSource.mockClear();
    document.body.innerHTML = '';
  });

  it('shows the exact location from the page without a guess label', async () => {
    const fixture = await render([scanned('src/app/other/card.ts', 'app-other')], {
      file: 'src/app/card.ts',
      line: 12,
    });
    const where = head(fixture).querySelector('.where.mono');
    expect(text(where)).toBe('src/app/card.ts:12');
    expect(head(fixture).querySelector('.likely')).toBeNull();
  });

  it('prefers the class whose selector is the host tag and marks it as likely', async () => {
    const fixture = await render([
      scanned('src/app/other/card.ts', 'app-other', 3),
      scanned('src/app/card.ts', 'app-card', 8),
    ]);
    const where = head(fixture).querySelector('.where.guess');
    expect(text(where)).toBe('Likely, matched by class name: src/app/card.ts:8');
    expect(where?.getAttribute('title')).toContain('no exact location');

    openSourceButton(fixture).click();
    await settle(fixture);
    expect(bridge.openSource).toHaveBeenCalledWith(
      'p1',
      'c1',
      expect.objectContaining({ file: 'src/app/card.ts', line: 8 }),
    );
  });

  it('marks a single name match with another selector as likely', async () => {
    const fixture = await render([scanned('src/app/card.ts', 'app-card-legacy')]);
    expect(text(head(fixture).querySelector('.where.guess'))).toBe(
      'Likely, matched by class name: src/app/card.ts:5',
    );
  });

  it('lists every candidate when several classes may be it, and opens none of them', async () => {
    const fixture = await render([
      scanned('src/app/a/card.ts', 'a-card', 3),
      scanned('src/app/b/card.ts', 'b-card', 9),
    ]);
    const where = head(fixture).querySelector('.where.guess');
    expect(text(where?.querySelector('.guess-text'))).toBe(
      'Not certain 2 source files define Card:',
    );
    expect([...(where?.querySelectorAll('li') ?? [])].map(text)).toEqual([
      'src/app/a/card.ts:3',
      'src/app/b/card.ts:9',
    ]);

    openSourceButton(fixture).click();
    await settle(fixture);
    expect(bridge.openSource).toHaveBeenCalledWith('p1', 'c1', null);
  });
});
