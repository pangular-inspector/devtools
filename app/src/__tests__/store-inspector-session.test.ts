import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import { sameNgrxLog, type NgrxLogEntry, type NgrxPage } from '../pages/store-types';

afterEach(() => {
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

function entry(seq: number, timestamp: number, extra: Partial<NgrxLogEntry> = {}): NgrxLogEntry {
  return {
    seq,
    source: 'store',
    storeId: 'store',
    type: `[Cart] Step ${seq}`,
    timestamp,
    diff: [],
    restorable: true,
    ...extra,
  };
}

function page(pageId: string, log: NgrxLogEntry[]): NgrxPage {
  return {
    pageId,
    url: `http://localhost/${pageId}`,
    title: pageId,
    stores: [],
    classic: { state: { n: 1 }, devtools: true, scope: 'root' },
    log,
    reportedAt: 1,
  };
}

async function mount(pages: NgrxPage[]) {
  const listeners = new Set<(value: unknown) => void>();
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => ({ pages }),
        on: (_: string, listener: (value: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      }),
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  const fixture = TestBed.createComponent(StoreInspector);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentRef.setInput('rpc', client);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
  };
  await settle();
  const push = async (next: NgrxPage[]) => {
    listeners.forEach((listener) => listener({ pages: next }));
    await settle();
  };
  return { fixture, inspector: fixture.componentInstance, push, settle };
}

function confirmShown(fixture: { nativeElement: unknown }) {
  return (fixture.nativeElement as HTMLElement).querySelector('.confirm') !== null;
}

describe('StoreInspector selection across change logs', () => {
  it('drops the selected entries and the armed Restore when the app reloads', async () => {
    const event = entry(3, 30, { source: 'event', storeId: '', type: 'opened' });
    const { fixture, inspector, push, settle } = await mount([
      page('p1', [entry(1, 10), entry(2, 20), event]),
    ]);
    inspector.selectChange(2);
    inspector.selectEvent(3);
    inspector.askRestore(2);
    await settle();
    expect(inspector.changeEntry()?.type).toBe('[Cart] Step 2');
    expect(confirmShown(fixture)).toBe(true);

    await push([page('p1', [entry(1, 500), entry(2, 600), { ...event, timestamp: 700 }])]);
    expect(inspector.selectedChangeSeq()).toBeNull();
    expect(inspector.selectedEventSeq()).toBeNull();
    expect(inspector.confirmSeq()).toBeNull();
    expect(confirmShown(fixture)).toBe(false);
  });

  it('drops them when the chosen page closes and the view falls back to another page', async () => {
    const { fixture, inspector, push, settle } = await mount([
      page('p1', [entry(1, 10), entry(2, 20)]),
      page('p2', [entry(1, 11), entry(2, 21)]),
    ]);
    inspector.selectPage('p2');
    inspector.selectChange(2);
    inspector.askRestore(2);
    await settle();
    expect(confirmShown(fixture)).toBe(true);

    await push([page('p1', [entry(1, 10), entry(2, 20)])]);
    expect(inspector.page()?.pageId).toBe('p1');
    expect(inspector.selectedChangeSeq()).toBeNull();
    expect(inspector.confirmSeq()).toBeNull();
    expect(confirmShown(fixture)).toBe(false);
  });

  it('keeps them while the same log grows', async () => {
    const { fixture, inspector, push, settle } = await mount([
      page('p1', [entry(1, 10), entry(2, 20)]),
    ]);
    inspector.selectChange(2);
    inspector.askRestore(2);
    await settle();
    await push([page('p1', [entry(1, 10), entry(2, 20), entry(3, 30)])]);
    expect(inspector.selectedChangeSeq()).toBe(2);
    expect(inspector.confirmSeq()).toBe(2);
    expect(confirmShown(fixture)).toBe(true);
  });
});

describe('sameNgrxLog', () => {
  const key = (pageId: string, log: NgrxLogEntry[]) => ({ pageId, log });

  it('is true while the log grows or is trimmed at the front', () => {
    const before = key('p1', [entry(1, 10), entry(2, 20)]);
    expect(sameNgrxLog(before, key('p1', [entry(2, 20), entry(3, 30)]))).toBe(true);
    expect(sameNgrxLog(key('p1', []), key('p1', [entry(1, 10)]))).toBe(true);
  });

  it('is false for another page or a restarted log', () => {
    const before = key('p1', [entry(1, 10), entry(2, 20)]);
    expect(sameNgrxLog(before, key('p2', [entry(1, 10), entry(2, 20)]))).toBe(false);
    expect(sameNgrxLog(before, key('p1', [entry(1, 50)]))).toBe(false);
    expect(sameNgrxLog(before, key('p1', []))).toBe(false);
    expect(sameNgrxLog(before, key('p1', [entry(1, 50), entry(2, 60), entry(3, 70)]))).toBe(false);
  });
});
