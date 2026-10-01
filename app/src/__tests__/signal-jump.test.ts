import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

const graph = {
  pageId: 'p1',
  nodes: [
    { id: '1', kind: 'signal', label: 'count', epoch: 1, value: 1 },
    { id: '2', kind: 'computed', label: 'doubled', epoch: 1, value: 2 },
    { id: '3', kind: 'effect', epoch: 1 },
    { id: '4', kind: 'signal', label: 'Resource#user.value', epoch: 1 },
  ],
  edges: [
    { consumer: 1, producer: 0 },
    { consumer: 2, producer: 1 },
    { consumer: 2, producer: 3 },
  ],
  resources: [{ id: 'r1', name: 'user', named: true, status: 'resolved', nodeIds: ['4'] }],
};

function fakeClient(): DevframeRpcClient {
  const rpc = {
    call: () => Promise.resolve([]),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'signal-graph' ? { graph, pages: { p1: graph } } : {}),
        on: () => () => {},
      }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function host(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function card(fixture: ComponentFixture<unknown>, id: string): HTMLElement | undefined {
  return [...host(fixture).querySelectorAll<HTMLElement>('.node-card')].find(
    (el) => el.dataset['card'] === id,
  );
}

function relation(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = [...host(fixture).querySelectorAll<HTMLButtonElement>('.detail-panel button')].find(
    (b) => b.getAttribute('aria-label') === name,
  );
  if (!found) throw new Error(`No relation named ${name}`);
  return found;
}

async function open() {
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', fakeClient());
  document.body.append(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SignalInspector relations', () => {
  it('selects a dependency and moves focus to its card', async () => {
    const fixture = await open();
    card(fixture, '2')!.click();
    await settle(fixture);

    relation(fixture, 'Go to signal count').click();
    await settle(fixture);

    expect(card(fixture, '1')!.getAttribute('aria-expanded')).toBe('true');
    expect(card(fixture, '2')!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(card(fixture, '1'));
  });

  it('reaches an unnamed consumer and clears a filter that hides it', async () => {
    const fixture = await open();
    const filter = host(fixture).querySelector<HTMLInputElement>('.toolbar input')!;
    filter.value = 'doubled';
    filter.dispatchEvent(new Event('input'));
    await settle(fixture);
    card(fixture, '2')!.click();
    await settle(fixture);

    relation(fixture, 'Go to effect 3').click();
    await settle(fixture);

    expect(filter.value).toBe('');
    expect(card(fixture, '3')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(card(fixture, '3'));
    expect(host(fixture).querySelector('.jump-note')!.textContent).toContain(
      'Cleared the filters to show 3',
    );
  });

  it('opens the resource that owns an internal signal', async () => {
    const fixture = await open();
    card(fixture, '3')!.click();
    await settle(fixture);

    relation(fixture, 'Go to signal Resource#user.value').click();
    await settle(fixture);

    expect(card(fixture, 'r1')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(card(fixture, 'r1'));
  });
});
