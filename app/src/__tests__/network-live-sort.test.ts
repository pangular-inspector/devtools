import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rpc', () => ({
  rpcCall: async (_rpc: unknown, _name: string, ...args: unknown[]) => args[0],
}));

const { NetworkInspector } = await import('../pages/network-inspector');

type Inspector = InstanceType<typeof NetworkInspector>;
type Call = ReturnType<Inspector['serverCalls']>[number];
type SsrRequest = ReturnType<Inspector['requests']>[number];

let fixture: ComponentFixture<Inspector>;
const host = () => fixture.nativeElement as HTMLElement;

function call(id: string, extra: Partial<Call>): Call {
  return {
    id,
    url: `http://localhost/api/${id}`,
    method: 'GET',
    status: 200,
    durationMs: 1,
    side: 'server',
    cacheHit: false,
    faulted: false,
    at: 1000,
    ...extra,
  };
}

const calls = [
  call('a', { status: 500, durationMs: 30, at: 3000, method: 'POST' }),
  call('b', { status: 200, durationMs: 10, at: 2000 }),
  call('c', { status: 404, durationMs: 20, at: 1000, method: 'DELETE' }),
];

async function settle() {
  for (let i = 0; i < 2; i++) {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }
  await fixture.whenStable();
}

async function mount() {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  fixture.componentInstance.serverCalls.set(calls);
  await settle();
  return fixture.componentInstance;
}

const order = () =>
  [...host().querySelectorAll<HTMLButtonElement>('button[data-call-id]')].map(
    (b) => b.dataset['callId'],
  );
const header = (name: string) =>
  [...host().querySelectorAll<HTMLTableCellElement>('th')].find(
    (th) => th.textContent!.trim() === name,
  )!;
const pause = () =>
  [...host().querySelectorAll<HTMLButtonElement>('app-live-controls button')].find(
    (b) => b.textContent!.trim() === 'Pause',
  )!;

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  fixture?.destroy();
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

describe('the network call table headers', () => {
  it('sort by status, then the other way, then back to newest first', async () => {
    await mount();
    expect(order()).toEqual(['a', 'b', 'c']);
    const status = header('Status');
    expect(status.hasAttribute('aria-sort')).toBe(false);

    status.querySelector('button')!.click();
    await settle();
    expect(status.getAttribute('aria-sort')).toBe('ascending');
    expect(order()).toEqual(['b', 'c', 'a']);

    status.querySelector('button')!.click();
    await settle();
    expect(status.getAttribute('aria-sort')).toBe('descending');
    expect(order()).toEqual(['a', 'c', 'b']);

    status.querySelector('button')!.click();
    await settle();
    expect(status.hasAttribute('aria-sort')).toBe(false);
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('sort by time and by method, one column at a time', async () => {
    await mount();
    header('Time').querySelector('button')!.click();
    await settle();
    expect(order()).toEqual(['b', 'c', 'a']);

    header('Method').querySelector('button')!.click();
    await settle();
    expect(header('Time').hasAttribute('aria-sort')).toBe(false);
    expect(header('Method').getAttribute('aria-sort')).toBe('ascending');
    expect(order()).toEqual(['c', 'b', 'a']);
  });
});

describe('the network live controls', () => {
  it('hold the table while paused and count the calls that arrive', async () => {
    const inspector = await mount();
    const button = pause();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    await settle();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(host().querySelector('app-live-controls [role="status"]')!.textContent).toBe(
      'Paused. New calls wait until you resume.',
    );

    inspector.serverCalls.set([call('d', { at: 4000 }), ...calls]);
    await settle();
    expect(order()).toEqual(['a', 'b', 'c']);
    expect(host().querySelector('.pending')!.textContent!.trim()).toBe('1 new');

    button.click();
    await settle();
    expect(order()).toEqual(['d', 'a', 'b', 'c']);
    expect(host().querySelector('.pending')).toBeNull();
    expect(host().querySelector('app-live-controls [role="status"]')!.textContent).toBe(
      'Resumed. New calls: 1.',
    );
  });

  it('shows the cleared timeline when Clear timeline runs while paused', async () => {
    const inspector = await mount();
    pause().click();
    await settle();
    expect(order()).toEqual(['a', 'b', 'c']);

    inspector.serverCalls.set([]);
    await inspector.clearCalls();
    await settle();
    expect(order()).toEqual([]);
    expect(pause().getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the newest call in view while Follow newest is on, and remembers the choice', async () => {
    const inspector = await mount();
    const wrap = host().querySelector<HTMLElement>('.table-wrap')!;
    let top = 0;
    Object.defineProperty(wrap, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    const follow = host().querySelector<HTMLInputElement>('app-live-controls input')!;
    expect(follow.checked).toBe(false);

    top = 120;
    inspector.serverCalls.set([call('d', { at: 4000 }), ...calls]);
    await settle();
    expect(top).toBe(120);

    follow.click();
    await settle();
    expect(top).toBe(0);
    top = 120;
    inspector.serverCalls.set([call('e', { at: 5000 }), call('d', { at: 4000 }), ...calls]);
    await settle();
    expect(top).toBe(0);
    expect(localStorage.getItem('pangular-pref:follow:network')).toBe('true');
  });
});

describe('Follow newest with SSR requests on the page', () => {
  it('scrolls the call table, not the SSR requests table above it', async () => {
    const inspector = await mount();
    const request: SsrRequest = {
      id: 'r1',
      method: 'GET',
      url: '/trips',
      status: 200,
      at: 500,
      durationMs: 40,
      renderMs: 30,
      bytes: 1024,
      renderMode: 'server',
      fetches: 1,
      fetchMs: 10,
      headers: {},
    };
    inspector.requests.set([request]);
    await settle();
    const wraps = [...host().querySelectorAll<HTMLElement>('.table-wrap')];
    expect(wraps.length).toBe(2);
    const tops = wraps.map(() => 120);
    wraps.forEach((wrap, i) =>
      Object.defineProperty(wrap, 'scrollTop', {
        configurable: true,
        get: () => tops[i],
        set: (value: number) => {
          tops[i] = value;
        },
      }),
    );
    host().querySelector<HTMLInputElement>('app-live-controls input')!.click();
    await settle();
    expect(tops).toEqual([120, 0]);
  });
});
