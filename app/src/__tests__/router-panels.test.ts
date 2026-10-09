import type { Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteCurrent } from '../pages/route-current';
import { RouteLint } from '../pages/route-lint';
import { RouteTimeline } from '../pages/route-timeline';
import { RouteTree } from '../pages/route-tree';
import type { NavigationRecord, RouterPage } from '../pages/router-types';

type Call = (name: string, arg: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call, connectionMeta: object = {}): DevframeRpcClient {
  const rpc = { call, callEvent: () => Promise.resolve() };
  return { connectionMeta, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

const routerActionsOff = { configs: { pangular: { actions: { router: false } } } };

const offline: Call = () => Promise.reject(new Error('offline'));

function nav(id: number, url: string): NavigationRecord {
  return { id, url, trigger: 'imperative', startedAt: 1, endedAt: 2, outcome: 'succeeded' };
}

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return {
    pageId: 'p1',
    reportedAt: 1,
    snapshot: {
      url: '/users/42',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [],
    ...extra,
  };
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

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = Array.from(el(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name,
  );
  if (!found) throw new Error(`No button named ${name}`);
  return found;
}

function mount<T>(type: Type<T>, data: RouterPage, call: Call, connectionMeta?: object) {
  const fixture = TestBed.createComponent(type);
  fixture.componentRef.setInput('page', data);
  fixture.componentRef.setInput('rpc', fakeClient(call, connectionMeta));
  document.body.append(el(fixture));
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTree row actions', () => {
  const config = page({
    config: [
      { id: 'r1', path: 'users/:id', fullPath: 'users/:id', kind: 'component', component: 'User' },
      { id: 'r2', path: 'lazy', fullPath: 'lazy', kind: 'lazy', lazy: 'unloaded' },
    ],
  });

  it('shows the param it will navigate with after the row is hidden and shown again', async () => {
    const calls: Record<string, unknown>[] = [];
    const fixture = mount(RouteTree, config, (_, arg) => {
      calls.push(arg);
      return Promise.resolve({ id: 4, outcome: 'succeeded', finalUrl: '/users/42' });
    });
    await settle(fixture);
    const first = el(fixture).querySelector<HTMLInputElement>('input.param')!;
    first.value = '42';
    first.dispatchEvent(new Event('input'));

    const filter = el(fixture).querySelector<HTMLInputElement>('input.filter')!;
    filter.value = 'lazy';
    filter.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(el(fixture).querySelector('input.param')).toBeNull();
    filter.value = '';
    filter.dispatchEvent(new Event('input'));
    await settle(fixture);

    const again = el(fixture).querySelector<HTMLInputElement>('input.param')!;
    expect(again.value).toBe('42');
    button(fixture, 'Navigate to users/:id').click();
    await settle(fixture);
    expect(calls[0]).toMatchObject({ request: { params: { id: '42' } } });
  });

  it('asks for empty params next to the row instead of calling the page', async () => {
    const calls: Record<string, unknown>[] = [];
    const fixture = mount(RouteTree, config, (_, arg) => {
      calls.push(arg);
      return Promise.resolve({ id: 3, outcome: 'succeeded', finalUrl: '/users/7' });
    });
    await settle(fixture);
    button(fixture, 'Navigate to users/:id').click();
    await settle(fixture);
    expect(calls).toEqual([]);
    const field = el(fixture).querySelector<HTMLInputElement>('input.param')!;
    const status = el(fixture).querySelector('tr.row-result [role="status"]');
    expect(status?.textContent?.trim()).toBe('Fill in :id to navigate.');
    expect(status?.closest('tr')?.previousElementSibling?.textContent).toContain('users/:id');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(status?.id);
    expect(document.activeElement).toBe(field);
    expect(el(fixture).textContent).not.toContain('Give a url');

    field.value = '7';
    field.dispatchEvent(new Event('input'));
    button(fixture, 'Navigate to users/:id').click();
    await settle(fixture);
    expect(calls).toEqual([
      {
        pageId: 'p1',
        request: { action: 'navigate', pattern: 'users/:id', params: { id: '7' } },
      },
    ]);
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(el(fixture).querySelector('tr.row-result')?.textContent).toContain(
      'Navigation #3: succeeded at /users/7.',
    );
  });

  it('turns Probe off with the config hint when router actions are off and keeps Read lazy', async () => {
    const fixture = mount(RouteTree, config, offline, routerActionsOff);
    await settle(fixture);
    const probe = button(fixture, 'Probe in app');
    const hint = el(fixture).querySelector('#route-tree-writes-off');
    expect(probe.disabled).toBe(true);
    expect(probe.getAttribute('aria-describedby')).toBe('route-tree-writes-off');
    expect(hint?.textContent?.trim()).toBe(
      'Navigating is turned off in the devtools config (actions.router).',
    );
    expect(button(fixture, 'Navigate to users/:id').disabled).toBe(true);
    expect(button(fixture, 'Read lazy routes of lazy').disabled).toBe(false);
  });

  it('shows Read lazy results and unreachable pages under the row', async () => {
    const fixture = mount(RouteTree, config, offline);
    await settle(fixture);
    button(fixture, 'Read lazy routes of lazy').click();
    await settle(fixture);
    const result = el(fixture).querySelector('tr.row-result');
    expect(result?.previousElementSibling?.textContent).toContain('lazy');
    expect(result?.textContent?.trim()).toBe('Could not reach the page.');
    expect(el(fixture).querySelector('p.message')).toBeNull();
  });
});

describe('RouteTree edge cases', () => {
  async function submitUrl(fixture: ComponentFixture<unknown>, url: string) {
    const input = el(fixture).querySelector<HTMLInputElement>('#test-url')!;
    input.value = url;
    input.dispatchEvent(new Event('input'));
    el(fixture)
      .querySelector('form.test')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
  }

  it('lists two unnamed guards of one kind without a duplicate track key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fixture = mount(
      RouteTree,
      page({
        config: [
          {
            id: 'r1',
            path: 'a',
            fullPath: 'a',
            kind: 'component',
            component: 'A',
            guards: { canActivate: ['anonymous function', 'anonymous function'] },
          },
        ],
      }),
      offline,
    );
    await settle(fixture);
    fixture.componentRef.setInput(
      'page',
      page({
        generation: 2,
        config: [
          {
            id: 'r1',
            path: 'a',
            fullPath: 'a',
            kind: 'component',
            component: 'A',
            guards: { canActivate: ['anonymous function', 'anonymous function', 'x'] },
          },
        ],
      }),
    );
    await settle(fixture);
    expect(el(fixture).querySelectorAll('td .tag')).toHaveLength(3);
    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    warn.mockRestore();
    error.mockRestore();
    expect(logged).not.toContain('NG0955');
  });

  it('tells the user when Predict gets no answer from the page', async () => {
    const fixture = mount(
      RouteTree,
      page({
        config: [{ id: 'r1', path: 'a', fullPath: 'a', kind: 'component', component: 'A' }],
      }),
      () => Promise.resolve(null),
    );
    await settle(fixture);
    await submitUrl(fixture, '/users/1');
    expect(el(fixture).querySelector('p.message[role="status"]')?.textContent).toContain(
      'Could not reach the page.',
    );
  });

  it('offers no Go button for a custom matcher route', async () => {
    const fixture = mount(
      RouteTree,
      page({
        config: [
          {
            id: 'r1',
            path: '',
            fullPath: '/',
            kind: 'component',
            component: 'Foo',
            matcher: 'customMatcher',
          },
        ],
      }),
      offline,
    );
    await settle(fixture);
    expect(el(fixture).querySelector('[aria-label="Navigate to /"]')).toBeNull();
  });
});

describe('RouteLint reruns', () => {
  it('checks again when a link without ariaCurrentWhenActive appears and no navigation happened', async () => {
    let checks = 0;
    const fixture = mount(RouteLint, page({ links: [] }), () => {
      checks++;
      return Promise.resolve({ checked: true, findings: [] });
    });
    await settle(fixture);
    expect(checks).toBe(1);

    fixture.componentRef.setInput(
      'page',
      page({ links: [{ text: 'Home', href: '/', linkActive: true }] }),
    );
    await settle(fixture);
    expect(checks).toBe(2);

    fixture.componentRef.setInput(
      'page',
      page({ links: [{ text: 'Home', href: '/', linkActive: true }], reportedAt: 5 }),
    );
    await settle(fixture);
    expect(checks).toBe(2);

    fixture.componentRef.setInput(
      'page',
      page({ links: [{ text: 'Start', href: '/start', linkActive: true }] }),
    );
    await settle(fixture);
    expect(checks).toBe(3);
  });
});

describe('RouteTimeline guard recording', () => {
  function checkbox(fixture: ComponentFixture<unknown>) {
    return Array.from(el(fixture).querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find(
      (input) => input.parentElement?.textContent?.includes('Record each guard'),
    )!;
  }

  it('puts the checkbox back when the page does not answer', async () => {
    const fixture = mount(RouteTimeline, page({ instrumented: false }), () =>
      Promise.resolve({ error: 'No page answered within 15s.' }),
    );
    await settle(fixture);
    const input = checkbox(fixture);
    input.click();
    expect(input.checked).toBe(true);
    await settle(fixture);
    expect(input.checked).toBe(false);
    expect(el(fixture).textContent).toContain('No page answered within 15s.');
  });

  it('treats a failed call as a failure, not as recording', async () => {
    const fixture = mount(RouteTimeline, page({ instrumented: true }), offline);
    await settle(fixture);
    const input = checkbox(fixture);
    input.click();
    await settle(fixture);
    expect(input.checked).toBe(true);
    expect(el(fixture).textContent).toContain('Could not reach the page.');
    expect(el(fixture).textContent).not.toContain('Stopped recording');
  });
});

describe('RouteTimeline replay', () => {
  it('turns Replay off for redacted and absolute URLs, with a note', async () => {
    const calls: unknown[] = [];
    const fixture = mount(
      RouteTimeline,
      page({
        navigations: [
          nav(1, '/users/1'),
          nav(2, '/reset?token=[redacted]'),
          nav(3, 'https://example.com/x'),
        ],
      }),
      (_, arg) => {
        calls.push(arg);
        return Promise.resolve({ replay: { outcome: 'succeeded' }, same: true });
      },
    );
    await settle(fixture);
    const ok = button(fixture, 'Replay navigation 1');
    expect(ok.disabled).toBe(false);
    expect(ok.getAttribute('aria-describedby')).toBeNull();
    for (const id of [2, 3]) {
      const replay = button(fixture, `Replay navigation ${id}`);
      expect(replay.disabled).toBe(true);
      const note = document.getElementById(replay.getAttribute('aria-describedby')!);
      expect(note?.textContent?.trim()).toBe('Replay is off: the URL is redacted or not relative.');
    }
    ok.click();
    await settle(fixture);
    expect(calls).toEqual([{ pageId: 'p1', request: { action: 'replay', id: 1 } }]);
  });
});

describe('RouteCurrent', () => {
  it('reports an unreachable page on Abort instead of #undefined', async () => {
    const fixture = mount(
      RouteCurrent,
      page({
        snapshot: { ...page().snapshot!, pending: { id: 5, url: '/slow' } },
      }),
      offline,
    );
    await settle(fixture);
    button(fixture, 'Abort').click();
    await settle(fixture);
    expect(el(fixture).textContent).toContain('Could not reach the page.');
    expect(el(fixture).textContent).not.toContain('#undefined');
  });

  it('shows the routerOutletData each outlet passes', async () => {
    const fixture = mount(
      RouteCurrent,
      page({
        outlets: [
          {
            outlet: 'primary',
            activated: true,
            component: 'Shell',
            route: '/shell',
            data: '{"user":"Ada"}',
            children: [{ outlet: 'side', activated: true, component: 'Filters', route: '/side' }],
          },
        ],
      }),
      offline,
    );
    await settle(fixture);
    const rows = el(fixture).querySelectorAll('.outlets li');
    expect(rows[0].textContent).toContain('routerOutletData {"user":"Ada"}');
    expect(rows[1].textContent).not.toContain('routerOutletData');
  });
});
