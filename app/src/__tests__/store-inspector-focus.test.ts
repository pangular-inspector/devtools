import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import type { NgrxPage, NgrxState } from '../pages/store-types';

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

function page(paused: boolean): NgrxPage {
  return {
    pageId: 'p1',
    url: 'http://localhost/',
    title: 'Shop',
    stores: [],
    classic: { state: { n: 2 }, devtools: true, scope: 'root', ...(paused ? { paused } : {}) },
    log: [1, 2].map((seq) => ({
      seq,
      source: 'store',
      storeId: 'store',
      type: 'inc',
      timestamp: seq,
      diff: [],
      restorable: true,
    })),
    reportedAt: 1,
  } as NgrxPage;
}

function fakeClient(result: { ok: boolean; paused?: boolean; message: string }) {
  const listeners = new Set<(value: unknown) => void>();
  let value: NgrxState = { pages: [page(false)] };
  const client = {
    connectionMeta: {},
    scope: () => ({
      rpc: {
        call: async (name: string) => {
          if (name !== 'request-ngrx-action') return [];
          if (result.paused) {
            value = { pages: [page(true)] };
            listeners.forEach((listener) => listener(value));
          }
          return result;
        },
        sharedState: async () => ({
          value: () => value,
          on: (_: string, listener: (value: unknown) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        }),
      },
    }),
  };
  return client as unknown as DevframeRpcClient;
}

async function restoreNewest(result: { ok: boolean; paused?: boolean; message: string }) {
  const fixture = TestBed.createComponent(StoreInspector);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', fakeClient(result));
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.componentInstance.restore(2, true);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StoreInspector restore focus', () => {
  it('focuses the state when restoring the newest action does not pause the store', async () => {
    const host = await restoreNewest({ ok: true, paused: false, message: 'Jumped.' });
    expect(host.querySelector('.paused')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('pre.tree'));
  });

  it('focuses "Back to latest" when the restore pauses the store', async () => {
    const host = await restoreNewest({ ok: true, paused: true, message: 'Jumped. Paused.' });
    const latest = host.querySelector('.paused button');
    expect(latest).not.toBeNull();
    expect(document.activeElement).toBe(latest);
  });

  it('focuses "Back to latest" after a deferred restore on an already paused page', async () => {
    let resolve!: (value: unknown) => void;
    const client = {
      connectionMeta: {},
      scope: () => ({
        rpc: {
          call: async (name: string) =>
            name === 'request-ngrx-action' ? new Promise((done) => (resolve = done)) : [],
          sharedState: async () => ({
            value: () => ({ pages: [page(true)] }),
            on: () => () => undefined,
          }),
        },
      }),
    } as unknown as DevframeRpcClient;
    const fixture = TestBed.createComponent(StoreInspector);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', client);
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const latest = host.querySelector('.paused button');
    expect(latest).not.toBeNull();

    const restoring = fixture.componentInstance.restore(1, true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    resolve({ ok: true, paused: true, message: 'Jumped. Paused.' });
    await restoring;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(latest);
  });
});
