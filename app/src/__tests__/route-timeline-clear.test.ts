import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteTimeline } from '../pages/route-timeline';
import type { NavigationRecord, RouterPage } from '../pages/router-types';

type Call = (name: string, arg: unknown) => Promise<unknown>;

function fakeClient(call: Call, connectionMeta: object = {}): DevframeRpcClient {
  const rpc = { call, callEvent: () => Promise.resolve() };
  return { connectionMeta, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function nav(id: number, url: string, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url,
    trigger: 'imperative',
    startedAt: 1,
    endedAt: 2,
    outcome: 'succeeded',
    ...extra,
  };
}

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return { pageId: 'p1', reportedAt: 1, snapshot: null, navigations: [], ...extra };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function el(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function mount(data: RouterPage, call: Call, connectionMeta?: object) {
  const fixture = TestBed.createComponent(RouteTimeline);
  fixture.componentRef.setInput('page', data);
  fixture.componentRef.setInput('rpc', fakeClient(call, connectionMeta));
  document.body.append(el(fixture));
  return fixture;
}

function clearButton(fixture: ComponentFixture<unknown>): HTMLButtonElement {
  const found = el(fixture).querySelector<HTMLButtonElement>(
    'button[aria-label="Clear navigations"]',
  );
  if (!found) throw new Error('No Clear button');
  return found;
}

function status(fixture: ComponentFixture<unknown>): string {
  return el(fixture).querySelector('[role="status"]')?.textContent?.trim() ?? '';
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTimeline Clear', () => {
  const navigations = [nav(1, '/a'), nav(2, '/b', { outcome: 'cancelled' })];

  it("clears the shown page's navigations, says so and keeps focus on Clear", async () => {
    const calls: [string, unknown][] = [];
    const fixture = mount(page({ navigations }), (name, arg) => {
      calls.push([name, arg]);
      return Promise.resolve(undefined);
    });
    await settle(fixture);
    expect(status(fixture)).toBe('');
    const clear = clearButton(fixture);
    expect(clear.textContent?.trim()).toBe('Clear');
    clear.focus();
    clear.click();
    await settle(fixture);
    expect(calls).toEqual([['clear-router-navigations', 'p1']]);
    expect(status(fixture)).toBe('Navigations cleared.');

    // The server then sends the emptied page.
    fixture.componentRef.setInput('page', page());
    await settle(fixture);
    expect(el(fixture).textContent).toContain('No navigations since Pangular Inspector connected.');
    expect(document.activeElement).toBe(clearButton(fixture));
  });

  it('says when clearing fails', async () => {
    const fixture = mount(page({ navigations }), () => Promise.reject(new Error('offline')));
    await settle(fixture);
    clearButton(fixture).click();
    await settle(fixture);
    expect(status(fixture)).toBe('Could not clear the navigations.');
    expect(el(fixture).querySelectorAll('ol.navs > li')).toHaveLength(2);
  });

  it('keeps the answer off a page the user switched to while clearing', async () => {
    let answer!: (value: unknown) => void;
    const fixture = mount(
      page({ pageId: 'a', navigations }),
      () => new Promise((resolve) => (answer = resolve)),
    );
    await settle(fixture);
    clearButton(fixture).click();
    fixture.componentRef.setInput('page', page({ pageId: 'b', navigations }));
    await settle(fixture);
    answer({ ok: true });
    await settle(fixture);
    expect(status(fixture)).not.toContain('Navigations cleared.');
    expect(status(fixture)).not.toContain('Clearing');
  });

  it('says it is clearing first, so a second clear in a row is announced again', async () => {
    let answer!: (value: unknown) => void;
    const fixture = mount(
      page({ navigations }),
      () => new Promise((resolve) => (answer = resolve)),
    );
    await settle(fixture);
    for (let i = 0; i < 2; i++) {
      clearButton(fixture).click();
      await settle(fixture);
      expect(status(fixture)).toBe('Clearing navigations…');
      answer({ ok: true });
      await settle(fixture);
      expect(status(fixture)).toBe('Navigations cleared.');
    }
  });

  it('is off, with the note, when router actions are turned off', async () => {
    const calls: string[] = [];
    const fixture = mount(
      page({ navigations }),
      (name) => {
        calls.push(name);
        return Promise.resolve(undefined);
      },
      { configs: { pangular: { actions: { router: false } } } },
    );
    await settle(fixture);
    const clear = clearButton(fixture);
    expect(clear.disabled).toBe(true);
    const note = document.getElementById(clear.getAttribute('aria-describedby')!);
    expect(note?.textContent).toContain('clearing navigations is turned off');
    clear.click();
    await settle(fixture);
    expect(calls).toEqual([]);
  });
});

describe('RouteTimeline Only problems', () => {
  it('leaves out probes, like the tab badge', async () => {
    const fixture = mount(
      page({
        navigations: [
          nav(1, '/ok'),
          nav(2, '/blocked', { outcome: 'cancelled' }),
          nav(3, '/probed', { outcome: 'cancelled', probe: true }),
        ],
      }),
      () => Promise.resolve(undefined),
    );
    await settle(fixture);
    const onlyProblems = Array.from(
      el(fixture).querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
    ).find((input) => input.parentElement?.textContent?.includes('Only problems'))!;
    onlyProblems.click();
    await settle(fixture);
    const urls = Array.from(el(fixture).querySelectorAll('ol.navs > li .head .url')).map((node) =>
      node.textContent?.trim(),
    );
    expect(urls).toEqual(['/blocked']);
  });
});
