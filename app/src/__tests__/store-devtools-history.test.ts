import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StoreInspector } from '../pages/store-inspector';
import { traceFrame, type NgrxLogEntry, type NgrxPage } from '../pages/store-types';

type Call = (name: string, arg?: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call, page: NgrxPage): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => ({ pages: [page] }), on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

function entry(seq: number, extra: Partial<NgrxLogEntry> = {}): NgrxLogEntry {
  return {
    seq,
    source: 'store',
    storeId: 'store',
    type: '[Cart] Add Item',
    action: { type: '[Cart] Add Item', id: seq },
    origin: 'dispatch',
    timestamp: 0,
    diff: [{ path: 'cart.items[0]', op: 'add', after: seq }],
    restorable: true,
    ...extra,
  };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const root = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

function button(fixture: ComponentFixture<unknown>, name: string) {
  return Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => (b.textContent ?? '').trim() === name,
  );
}

async function mount(page: Partial<NgrxPage>) {
  const calls: { name: string; arg?: Record<string, unknown> }[] = [];
  const fixture = TestBed.createComponent(StoreInspector);
  fixture.componentRef.setInput(
    'rpc',
    fakeClient(
      (name, arg) => {
        if (name === 'get-ngrx-store') return Promise.resolve([]);
        calls.push({ name, arg });
        return Promise.resolve({ ok: true, message: 'Done on the page.' });
      },
      {
        pageId: 'p1',
        url: '/',
        title: 'App',
        stores: [],
        classic: { state: { cart: { items: [1, 2] } }, devtools: true, scope: 'root' },
        log: [],
        reportedAt: 0,
        ...page,
      },
    ),
  );
  await settle(fixture);
  return { fixture, calls };
}

const devtoolsCalls = (calls: { name: string; arg?: Record<string, unknown> }[]) =>
  calls.filter((c) => c.name === 'request-ngrx-action').map((c) => c.arg?.['request']);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Store DevTools history controls', () => {
  it('pauses recording, jumps to the committed state and commits', async () => {
    const { fixture, calls } = await mount({ log: [entry(1)] });
    button(fixture, 'Pause recording')!.click();
    await settle(fixture);
    button(fixture, 'Jump to committed state')!.click();
    await settle(fixture);
    button(fixture, 'Commit')!.click();
    await settle(fixture);
    expect(devtoolsCalls(calls)).toEqual([
      { type: 'devtools', op: 'pause', paused: true },
      { type: 'devtools', op: 'jump', index: 0 },
      { type: 'devtools', op: 'commit' },
    ]);
    expect(root(fixture).querySelector('.message')?.textContent).toContain('Done on the page.');
  });

  it('asks before a reset, and Cancel goes back to the Reset button', async () => {
    const { fixture, calls } = await mount({ log: [entry(1)] });
    button(fixture, 'Reset…')!.click();
    await settle(fixture);
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    button(fixture, 'Cancel')!.click();
    await settle(fixture);
    expect(document.activeElement?.textContent?.trim()).toBe('Reset…');
    button(fixture, 'Reset…')!.click();
    await settle(fixture);
    button(fixture, 'Reset history')!.click();
    await settle(fixture);
    expect(devtoolsCalls(calls)).toEqual([{ type: 'devtools', op: 'reset' }]);
  });

  it('shows paused recording and skipped actions, and toggles the selected one', async () => {
    const { fixture, calls } = await mount({
      log: [entry(1), entry(2)],
      classic: {
        state: {},
        devtools: true,
        scope: 'root',
        recordingPaused: true,
        skipped: [1],
      },
    });
    const text = root(fixture).textContent ?? '';
    expect(text).toContain('Recording is paused');
    expect(text).toContain('1 skipped action is left out of the state.');
    expect(button(fixture, 'Resume recording')).toBeDefined();
    const items = Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('.log-item'));
    const first = items.find((b) => b.textContent?.includes('#1'))!;
    expect(first.textContent).toContain('skipped');
    first.click();
    await settle(fixture);
    button(fixture, 'Include this action')!.click();
    await settle(fixture);
    expect(devtoolsCalls(calls)).toEqual([{ type: 'devtools', op: 'toggle', seq: 1 }]);
  });
});

describe('call sites and action frequency', () => {
  it('splits a trace frame into its function, file and line', () => {
    expect(traceFrame('addItem (src/app/cart.ts:12:5)')).toEqual({
      name: 'addItem',
      file: 'src/app/cart.ts',
      line: 12,
    });
    expect(traceFrame('src/main.ts:3:1')).toEqual({ name: '', file: 'src/main.ts', line: 3 });
    expect(traceFrame('native')).toEqual({ name: 'native' });
  });

  it('lists where the selected entry came from', async () => {
    const { fixture } = await mount({
      log: [entry(1, { trace: ['addItem (src/app/cart.ts:12:5)', 'onClick (src/app/x.ts:4:2)'] })],
    });
    root(fixture).querySelector<HTMLButtonElement>('.log-item')!.click();
    await settle(fixture);
    const frames = Array.from(root(fixture).querySelectorAll('.trace li')).map((li) =>
      li.textContent?.trim(),
    );
    expect(frames).toEqual(['addItem (src/app/cart.ts:12)', 'onClick (src/app/x.ts:4)']);
  });

  it('shows how often each action ran and flags an effect loop', async () => {
    const { fixture } = await mount({
      log: [entry(1)],
      stats: [
        {
          source: 'store',
          storeId: 'store',
          type: '[Poll] Tick',
          count: 40,
          effects: 40,
          lastAt: 1,
          burst: 25,
          loop: true,
        },
        {
          source: 'store',
          storeId: 'store',
          type: '[Cart] Add Item',
          count: 1,
          lastAt: 1,
          burst: 1,
        },
        { source: 'signal-store', storeId: 'ngrx-1', type: 'load', count: 3, lastAt: 1, burst: 1 },
      ],
    });
    const rows = Array.from(root(fixture).querySelectorAll('.stats tbody tr')).map((tr) =>
      Array.from(tr.children).map((c) => c.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['[Poll] Tick Possible effect loop', '40', 'n/a', 'n/a', '25'],
      ['[Cart] Add Item', '1', 'n/a', 'n/a', '1'],
    ]);
    expect(root(fixture).textContent).toContain('dispatched 20 or more times within one second');
  });

  it('marks the paths the newest change wrote in the state tree', async () => {
    const { fixture } = await mount({ log: [entry(1)] });
    const changed = Array.from(root(fixture).querySelectorAll('app-state-tree .row.changed')).map(
      (row) => row.querySelector('.key')?.textContent,
    );
    expect(changed).toEqual(['0:']);
    expect(root(fixture).querySelector('app-state-tree .row .mark')?.textContent).toBe('changed');
  });
});
