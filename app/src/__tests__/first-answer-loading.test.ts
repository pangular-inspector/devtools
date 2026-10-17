import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import { SignalInspector } from '../pages/signal-inspector';
import { StoreInspector } from '../pages/store-inspector';

/** A client whose shared states have not loaded from the server yet. */
function pendingClient(): DevframeRpcClient {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => undefined, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const text = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

afterEach(() => TestBed.resetTestingModule());

describe('before the first answer', () => {
  it('Components says it is loading, not that no page is connected', async () => {
    const fixture = TestBed.createComponent(ComponentTree);
    fixture.componentRef.setInput('rpc', pendingClient());
    await settle(fixture);
    expect(text(fixture)).toContain('Loading the live component tree…');
    expect(text(fixture)).not.toContain('No page is connected');
  });

  it('Signals says it is loading, not that it shows the source', async () => {
    const fixture = TestBed.createComponent(SignalInspector);
    fixture.componentRef.setInput('rpc', pendingClient());
    await settle(fixture);
    expect(text(fixture)).toContain('Loading the live signal graph…');
    expect(text(fixture)).not.toContain('found in your source');
  });

  it('Store says it is loading, not that no page is connected', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    fixture.componentRef.setInput('rpc', pendingClient());
    await settle(fixture);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.status')?.textContent?.trim(),
    ).toBe('Loading…');
  });
});
