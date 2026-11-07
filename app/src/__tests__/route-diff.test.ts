import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteDiff } from '../pages/route-diff';
import type { NavigationRecord, RouterPage } from '../pages/router-types';

type Call = (name: string, arg: unknown) => Promise<unknown>;

function fakeClient(call: Call): DevframeRpcClient {
  const rpc = { call, callEvent: () => Promise.resolve() };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/u/${id}`,
    trigger: 'imperative',
    startedAt: id,
    endedAt: id + 1,
    outcome: 'succeeded',
    ...extra,
  };
}

function page(navigations: NavigationRecord[]): RouterPage {
  return { pageId: 'p1', reportedAt: 1, snapshot: null, navigations };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function mount(data: RouterPage, call: Call, start: number | null = null) {
  const fixture = TestBed.createComponent(RouteDiff);
  fixture.componentRef.setInput('page', data);
  fixture.componentRef.setInput('rpc', fakeClient(call));
  fixture.componentRef.setInput('start', start);
  document.body.append(fixture.nativeElement as HTMLElement);
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteDiff', () => {
  it('asks for two navigations when fewer are recorded', async () => {
    const fixture = mount(page([nav(1)]), () => Promise.resolve(null));
    await settle(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Two navigations are needed to compare.',
    );
  });

  it('compares the newest two by default and shows each changed field', async () => {
    const calls: unknown[] = [];
    const fixture = mount(page([nav(1), nav(2), nav(3, { probe: true })]), (name, arg) => {
      calls.push([name, arg]);
      return Promise.resolve({
        a: 1,
        b: 2,
        sections: [
          { title: 'Route params', changes: [{ field: '/u/:id id', before: '"1"', after: '"2"' }] },
        ],
        same: ['Guards'],
        notes: [],
      });
    });
    await settle(fixture);
    expect(calls).toEqual([['router-diff', { pageId: 'p1', a: 1, b: 2 }]]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Route params');
    expect(text).toContain('/u/:id id');
    expect(text).toContain('Same in both: Guards.');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent,
    ).toContain('1 of 2 parts differ');
  });

  it('starts from the navigation a timeline row asked for', async () => {
    const calls: unknown[] = [];
    const fixture = mount(
      page([nav(1), nav(2), nav(3)]),
      (name, arg) => {
        calls.push(arg);
        return Promise.resolve({ error: 'x' });
      },
      2,
    );
    await settle(fixture);
    expect(calls).toEqual([{ pageId: 'p1', a: 1, b: 2 }]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.message')?.textContent).toBe('x');
  });
});
