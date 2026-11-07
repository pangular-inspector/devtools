import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RouteTimeline } from '../pages/route-timeline';
import type { NavigationRecord, RouterPage } from '../pages/router-types';
import { LiveFeed } from '../ui/live-feed';

interface Entry {
  id: number;
}

function feed(scope = signal('p1')) {
  const source = signal<Entry[]>([{ id: 1 }, { id: 2 }]);
  const live = runInInjectionContext(TestBed.inject(Injector), () => {
    return new LiveFeed<Entry>({
      name: 'test',
      source,
      key: (entry) => entry.id,
      newest: 'last',
      scope,
    });
  });
  return { source, live, scope };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('LiveFeed', () => {
  it('passes the live list through until it is paused', () => {
    const { source, live } = feed();
    expect(live.items()).toEqual([{ id: 1 }, { id: 2 }]);
    source.set([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(live.items().length).toBe(3);
    expect(live.newestKey()).toBe(3);
    expect(live.paused()).toBe(false);
    expect(live.pending()).toBe(0);
  });

  it('holds the entries while paused, counts the new ones and shows them on resume', () => {
    const { source, live } = feed();
    live.pause();
    source.set([{ id: 2 }, { id: 3 }, { id: 4 }]);
    expect(live.items()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(live.pending()).toBe(2);
    live.toggle();
    expect(live.paused()).toBe(false);
    expect(live.items()).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }]);
  });

  it('stays paused on another page, holding that page’s entries', () => {
    const { source, live, scope } = feed();
    live.pause();
    source.set([{ id: 9 }]);
    scope.set('p2');
    expect(live.paused()).toBe(true);
    expect(live.items()).toEqual([{ id: 9 }]);
    source.set([{ id: 9 }, { id: 10 }]);
    expect(live.pending()).toBe(1);
  });

  it('saves Follow newest per feed', () => {
    const { live } = feed();
    expect(live.follow()).toBe(false);
    live.setFollow(true);
    expect(localStorage.getItem('pangular-pref:follow:test')).toBe('true');
    expect(feed().live.follow()).toBe(true);
  });
});

describe('the router timeline live controls', () => {
  function nav(id: number, url: string): NavigationRecord {
    return { id, url, trigger: 'imperative', startedAt: id, endedAt: id + 1, outcome: 'succeeded' };
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
  const client = {
    connectionMeta: {},
    scope: () => ({ rpc: { call: () => Promise.resolve(null) } }),
  } as unknown as DevframeRpcClient;

  it('holds the navigations while paused and shows the held count', async () => {
    const fixture = TestBed.createComponent(RouteTimeline);
    fixture.componentRef.setInput('page', page([nav(1, '/a'), nav(2, '/b')]));
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement as HTMLElement);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const urls = () => [...root.querySelectorAll('.navs .head .url')].map((e) => e.textContent);
    expect(urls()).toEqual(['/b', '/a']);

    const pause = root.querySelector<HTMLButtonElement>('app-live-controls button')!;
    pause.click();
    fixture.componentRef.setInput('page', page([nav(1, '/a'), nav(2, '/b'), nav(3, '/c')]));
    await settle(fixture);
    expect(urls()).toEqual(['/b', '/a']);
    expect(root.querySelector('.pending')!.textContent!.trim()).toBe('1 new');
    expect(pause.getAttribute('aria-describedby')).toBe(root.querySelector('.pending')!.id);

    pause.click();
    await settle(fixture);
    expect(urls()).toEqual(['/c', '/b', '/a']);
  });
});
