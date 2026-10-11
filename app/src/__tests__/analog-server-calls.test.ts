import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalogInspector } from '../pages/analog-inspector';

const project = {
  analog: true,
  routes: [],
  api: [],
  middleware: [],
  content: [],
  serverFns: [{ id: 'fn-1', name: 'saveTodo', file: '/src/app/todo.server.ts' }],
};

interface Call {
  id: number;
  at: number;
  kind: 'page' | 'load' | 'action' | 'fn' | 'api';
  method: string;
  url: string;
  route?: string;
  status: number;
  ms: number;
  from: 'ssr' | 'browser' | 'devtools';
  outcome?: 'success' | 'redirect' | 'invalid' | 'error';
}

const apiCall = (id: number, url = `/api/items/${id}`, status = 200): Call => ({
  id,
  at: 1_700_000_000_000 + id,
  kind: 'api',
  method: 'GET',
  url,
  status,
  ms: 3,
  from: 'browser',
});

function client(calls: Call[], options: { clearFails?: boolean } = {}) {
  let value: unknown = { calls };
  const listeners = new Set<(value: unknown) => void>();
  const cleared: string[] = [];
  const rpc = {
    call: (name: string) => {
      if (name === 'analog-project') return Promise.resolve(project);
      if (name === 'analog-render') return Promise.resolve({ rows: [], plan: null });
      if (name === 'analog-clear-calls') {
        cleared.push(name);
        if (options.clearFails) return Promise.reject(new Error('offline'));
        value = { calls: [] };
        for (const listener of listeners) listener(value);
        return Promise.resolve(undefined);
      }
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => value,
        on: (_event: string, listener: (value: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      }),
  };
  return {
    cleared,
    rpc: { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient,
  };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render(rpc: DevframeRpcClient) {
  const fixture = TestBed.createComponent(AnalogInspector);
  fixture.componentRef.setInput('rpc', rpc);
  document.body.appendChild(fixture.nativeElement);
  await settle(fixture);
  fixture.componentInstance.view.set('server');
  await settle(fixture);
  return fixture;
}

const rows = (root: HTMLElement) =>
  root.querySelectorAll('[aria-label="Server calls"] tbody tr').length;

const button = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('Analog server calls list', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says when it shows only the newest 150 of the calls', async () => {
    const calls = Array.from({ length: 180 }, (_, i) => apiCall(i + 1));
    const fixture = await render(client(calls).rpc);
    const root: HTMLElement = fixture.nativeElement;
    expect(rows(root)).toBe(150);
    expect(root.querySelector('.note')?.textContent).toContain('Showing the newest 150 of 180.');
    expect(root.querySelector('.note')?.textContent).not.toContain('keeps only');
  });

  it('says the dev server drops older calls once it holds 200', async () => {
    const calls = Array.from({ length: 200 }, (_, i) => apiCall(i + 1));
    const fixture = await render(client(calls).rpc);
    const note = (fixture.nativeElement as HTMLElement).querySelector('.note')?.textContent;
    expect(note).toContain('Showing the newest 150 of 200.');
    expect(note).toContain('keeps only the newest 200 calls');
  });

  it('shows no note when every call fits', async () => {
    const fixture = await render(client([apiCall(1), apiCall(2)]).rpc);
    const root: HTMLElement = fixture.nativeElement;
    expect(rows(root)).toBe(2);
    expect(root.querySelector('.note')).toBeNull();
  });

  it('searches URLs and function names, and Escape clears the search', async () => {
    const fnCall: Call = {
      ...apiCall(3, '/_analog/fn'),
      kind: 'fn',
      route: 'fn-1',
      method: 'POST',
    };
    const fixture = await render(client([apiCall(1, '/api/users'), apiCall(2), fnCall]).rpc);
    const root: HTMLElement = fixture.nativeElement;
    const search = root.querySelector<HTMLInputElement>('#analog-call-search')!;
    expect(root.querySelector('.total')?.textContent?.trim()).toBe('3 of 3');

    type(search, 'users');
    await settle(fixture);
    expect(rows(root)).toBe(1);
    expect(root.querySelector('.total')?.textContent?.trim()).toBe('1 of 3');

    type(search, 'SAVETODO');
    await settle(fixture);
    expect(rows(root)).toBe(1);
    expect(root.querySelector('tbody')?.textContent).toContain('saveTodo');

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(fixture);
    expect(fixture.componentInstance.callQuery()).toBe('');
    expect(rows(root)).toBe(3);
  });

  it('keeps only failed calls with Failed only, combined with the kind filter', async () => {
    const failedAction: Call = { ...apiCall(4, '/todos'), kind: 'action', outcome: 'error' };
    const fixture = await render(
      client([
        apiCall(1),
        apiCall(2, '/api/missing', 404),
        apiCall(3, '/api/boom', 500),
        failedAction,
        apiCall(5, '/api/no-response', 0),
      ]).rpc,
    );
    const root: HTMLElement = fixture.nativeElement;
    const failed = root.querySelector<HTMLInputElement>('.call-filters input[type="checkbox"]')!;
    failed.click();
    await settle(fixture);
    expect(rows(root)).toBe(4);
    expect(root.querySelector('.total')?.textContent?.trim()).toBe('4 of 5');

    root.querySelector<HTMLInputElement>('input[data-kind="api"]')!.click();
    await settle(fixture);
    expect(rows(root)).toBe(3);
  });

  it('shows a no-match state whose Clear filters resets them and focuses the search', async () => {
    const fixture = await render(client([apiCall(1), apiCall(2)]).rpc);
    const root: HTMLElement = fixture.nativeElement;
    const search = root.querySelector<HTMLInputElement>('#analog-call-search')!;
    type(search, 'nothing-like-this');
    await settle(fixture);
    expect(rows(root)).toBe(0);
    expect(root.querySelector('.no-match')?.textContent).toContain('No calls match.');

    button(root, 'Clear filters').click();
    await settle(fixture);
    expect(fixture.componentInstance.callQuery()).toBe('');
    expect(fixture.componentInstance.failedOnly()).toBe(false);
    expect(fixture.componentInstance.kind()).toBe('all');
    expect(rows(root)).toBe(2);
    expect(document.activeElement).toBe(root.querySelector('#analog-call-search'));
  });

  it('announces a cleared list and moves focus to the kind filter', async () => {
    const { rpc, cleared } = client([apiCall(1)]);
    const fixture = await render(rpc);
    const root: HTMLElement = fixture.nativeElement;
    const clear = button(root, 'Clear calls');
    clear.focus();
    clear.click();
    await settle(fixture);
    expect(cleared).toEqual(['analog-clear-calls']);
    expect(root.querySelector('.calls-message')?.textContent?.trim()).toBe('Calls cleared.');
    expect(root.querySelector('.calls-message')?.getAttribute('role')).toBe('status');
    expect(rows(root)).toBe(0);
    expect(document.activeElement).toBe(root.querySelector('input[data-kind="all"]'));
  });

  it('says so when the calls could not be cleared', async () => {
    const fixture = await render(client([apiCall(1)], { clearFails: true }).rpc);
    const root: HTMLElement = fixture.nativeElement;
    button(root, 'Clear calls').click();
    await settle(fixture);
    expect(root.querySelector('.calls-message')?.textContent?.trim()).toBe(
      'Could not clear the calls.',
    );
    expect(rows(root)).toBe(1);
  });
});
