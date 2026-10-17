import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';

function client(angularPages: Record<string, unknown>): DevframeRpcClient {
  const states: Record<string, unknown> = {
    'ngrx-store': { pages: [] },
    'redux-stores': { pages: [] },
    'page-angular': { pages: angularPages },
  };
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (key: string) =>
      Promise.resolve({ value: () => states[key] ?? null, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const header = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('.status')?.textContent?.trim();

afterEach(() => TestBed.resetTestingModule());

describe('Store header', () => {
  it('says Live for a connected page that has no stores', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    fixture.componentRef.setInput(
      'rpc',
      client({ p1: { pageId: 'p1', reportedAt: 1, version: '22.1.0', capabilities: {} } }),
    );
    await settle(fixture);
    expect(header(fixture)).toBe('Live');
  });

  it('says no page is connected when none reports', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    fixture.componentRef.setInput('rpc', client({}));
    await settle(fixture);
    expect(header(fixture)).toBe('No page connected');
  });
});
