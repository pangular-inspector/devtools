import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

const graphOf = (componentId: string, pageId = 'p1') => ({
  pageId,
  component: { id: componentId, name: 'Cart', tag: 'app-cart', path: 'app-cart' },
  nodes: [
    {
      id: '1',
      kind: 'signal',
      label: 'count',
      epoch: 1,
      value: 1,
      locator: { id: componentId, key: 'count' },
    },
    { id: '2', kind: 'computed', label: 'doubled', epoch: 1, value: 2 },
  ],
  edges: [{ consumer: 1, producer: 0 }],
});

function fakeClient() {
  const calls: { name: string; args: unknown }[] = [];
  const listeners: ((value: unknown) => void)[] = [];
  let state: unknown = { graph: graphOf('c0'), pages: { p1: graphOf('c0') } };
  const rpc = {
    call: (name: string, args: unknown) => {
      calls.push({ name, args });
      return Promise.resolve([]);
    },
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'signal-graph' ? state : {}),
        on: (_event: string, listener: (value: unknown) => void) => {
          if (name === 'signal-graph') listeners.push(listener);
          return () => {};
        },
      }),
  };
  const push = (next: unknown) => {
    state = next;
    for (const listener of listeners) listener(next);
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { client, calls, push };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SignalInspector focus', () => {
  it('asks the page for the focused component and selects the signal once its graph arrives', async () => {
    const fixture = TestBed.createComponent(SignalInspector);
    const { client, calls, push } = fakeClient();
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);

    fixture.componentRef.setInput('focus', { componentId: 'c1', pageId: 'p1', key: 'count' });
    await settle(fixture);
    expect(calls).toContainEqual({
      name: 'select-signal-target',
      args: { pageId: 'p1', id: 'c1' },
    });
    // The graph of another component does not select anything.
    expect(fixture.componentInstance.selectedId()).toBeNull();

    push({ graph: graphOf('c1'), pages: { p1: graphOf('c1') } });
    await settle(fixture);
    expect(fixture.componentInstance.selectedId()).toBe('1');
  });

  it('forgets the focused signal when another component is picked', async () => {
    const fixture = TestBed.createComponent(SignalInspector);
    const { client, push } = fakeClient();
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);

    fixture.componentRef.setInput('focus', { componentId: 'c1', pageId: 'p1', key: 'count' });
    await settle(fixture);
    fixture.componentInstance.pickComponent('c2');
    push({ graph: graphOf('c1'), pages: { p1: graphOf('c1') } });
    await settle(fixture);
    expect(fixture.componentInstance.selectedId()).toBeNull();
  });

  it('shows the page a focus names once that page reports its graph', async () => {
    const fixture = TestBed.createComponent(SignalInspector);
    const { client, push } = fakeClient();
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);

    fixture.componentRef.setInput('focus', { componentId: 'c5', pageId: 'p2' });
    await settle(fixture);
    expect(fixture.componentInstance.shownPageId()).toBe('p1');

    // p1 reports last, but the focus asked for p2.
    push({ graph: graphOf('c0'), pages: { p1: graphOf('c0'), p2: graphOf('c5', 'p2') } });
    await settle(fixture);
    expect(fixture.componentInstance.shownPageId()).toBe('p2');
  });
});
