import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import type { NgrxLogEntry, NgrxPage, NgrxState } from '../pages/store-types';

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

function eventPage(events: NgrxLogEntry[]): NgrxPage {
  return {
    pageId: 'p1',
    url: 'http://localhost/',
    title: 'Shop',
    stores: [],
    classic: null,
    log: events,
    reportedAt: 1,
  };
}

function eventEntry(seq: number, type = 'bookingCancelled'): NgrxLogEntry {
  return {
    seq,
    source: 'event',
    storeId: 'event',
    type,
    eventType: type,
    payload: { id: seq },
    timestamp: seq,
    diff: [],
    restorable: false,
  };
}

function fakeEventClient(events: NgrxLogEntry[]): DevframeRpcClient {
  const ep = eventPage(events);
  return {
    connectionMeta: {},
    scope: () => ({
      rpc: {
        call: async (name: string) => (name === 'request-ngrx-action' ? { ok: true } : []),
        sharedState: async () => ({
          value: () => ({ pages: [ep] }) as NgrxState,
          on: () => () => undefined,
        }),
      },
    }),
  } as unknown as DevframeRpcClient;
}

describe('StoreInspector events', () => {
  it('shows events in a dedicated section and selects one on click', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', fakeEventClient([eventEntry(1), eventEntry(2)]));
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const evtButtons = host.querySelectorAll<HTMLButtonElement>('.event-item');
    expect(evtButtons.length).toBe(2);
    expect(host.querySelector('.event-detail-focus')).toBeNull();

    evtButtons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('.event-detail-focus')).not.toBeNull();
    expect(evtButtons[0].getAttribute('aria-pressed')).toBe('true');
    expect(evtButtons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('moves focus to the event detail panel when an event is clicked', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', fakeEventClient([eventEntry(1)]));
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.event-item')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(host.querySelector('.event-detail-focus'));
  });

  it('does not steal focus from the filter when typing after an event is selected', async () => {
    const fixture = TestBed.createComponent(StoreInspector);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('rpc', fakeEventClient([eventEntry(1)]));
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.event-item')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // Now type in the filter — this causes a re-render but must not steal focus
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    input.value = 'book';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
  });
});

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
