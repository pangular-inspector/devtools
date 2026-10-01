import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

function fakeClient(graph: Record<string, unknown>): DevframeRpcClient {
  const state = (value: unknown) => Promise.resolve({ value: () => value, on: () => () => {} });
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) => state(name === 'signal-graph' ? { graph } : { pages: {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function render(graph: Record<string, unknown>) {
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', fakeClient(graph));
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

function notices(fixture: ComponentFixture<unknown>): string[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('[role="status"]'),
    (el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

const graph = {
  nodes: [{ id: '1', kind: 'signal', label: 'query', epoch: 1, value: 'x' }],
  edges: [],
  componentSelector: 'app-root',
  component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
};

describe('SignalInspector', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says when the write hook did not load', async () => {
    const fixture = await render({ ...graph, writeHook: false });
    expect(notices(fixture)).toContain(
      'The signal write hook did not load. Value history shows sampled values only, with no exact set entries.',
    );
  });

  it('shows no write hook notice when the hook loaded', async () => {
    const fixture = await render(graph);
    expect(notices(fixture).some((text) => text.includes('write hook'))).toBe(false);
  });
});
