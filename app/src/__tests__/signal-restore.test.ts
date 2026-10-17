import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalInspector } from '../pages/signal-inspector';

const at = (s: number) => new Date(2026, 0, 1, 10, 0, s).getTime();

const graph = {
  pageId: 'p1',
  nodes: [
    {
      id: '1',
      kind: 'signal',
      label: 'query',
      epoch: 2,
      value: 'c',
      locator: { id: 'c1', key: 'query' },
    },
    { id: '2', kind: 'computed', label: 'shout', epoch: 2, value: 'C' },
  ],
  edges: [],
  component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
  history: {
    '1': [
      { epoch: 0, value: 'a', at: at(1), source: 'initial' },
      { epoch: 1, value: 'b', at: at(2), source: 'write' },
      { epoch: 2, value: 'c', at: at(3), source: 'write' },
    ],
    '2': [
      { epoch: 1, value: 'A', at: at(1), source: 'initial' },
      { epoch: 2, value: 'C', at: at(3), source: 'sample' },
    ],
  },
};

async function render(
  meta: Record<string, unknown> = {},
  call: (name: string, args?: unknown) => Promise<unknown> = () => Promise.resolve([]),
  page: Record<string, unknown> = { pageId: 'p1', roots: [] },
) {
  const state = (value: unknown) => Promise.resolve({ value: () => value, on: () => () => {} });
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      state(
        name === 'signal-graph'
          ? { graph, pages: { p1: graph } }
          : name === 'component-tree'
            ? { pages: { p1: page } }
            : { pages: {} },
      ),
  };
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', {
    connectionMeta: meta,
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient);
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  return fixture;
}

async function select(fixture: ComponentFixture<SignalInspector>, id: string) {
  fixture.componentInstance.selectedId.set(id);
  await fixture.whenStable();
  fixture.detectChanges();
}

const restoreButtons = (fixture: ComponentFixture<unknown>) =>
  Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.restore'),
  );

const text = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

describe('Restore on signal history', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('offers a named Restore button on each past entry of a located signal', async () => {
    const fixture = await render();
    await select(fixture, '1');
    const buttons = restoreButtons(fixture);
    // The newest entry is the current value, so it has no button.
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Restore value from 10:00:02.000',
      'Restore value from 10:00:01.000',
    ]);
    expect(buttons.every((b) => b.type === 'button' && !b.disabled)).toBe(true);
  });

  it('sends the entry to the page and shows the answer', async () => {
    const call = vi.fn(async (name: string) =>
      name === 'request-signal-restore' ? { ok: true, key: 'query' } : [],
    );
    const fixture = await render({}, call);
    await select(fixture, '1');
    restoreButtons(fixture)[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(call).toHaveBeenCalledWith('request-signal-restore', {
      pageId: 'p1',
      request: { component: 'c1', node: '1', epoch: 1 },
    });
    const status = (fixture.nativeElement as HTMLElement).querySelector('.restore-result');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent?.trim()).toBe('Restored query to the value from 10:00:02.000.');
  });

  it('shows the page refusal as an error', async () => {
    const fixture = await render({}, async (name) =>
      name === 'request-signal-restore' ? { error: 'Epoch 1 is no longer kept.' } : [],
    );
    await select(fixture, '1');
    restoreButtons(fixture)[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    const status = (fixture.nativeElement as HTMLElement).querySelector('.restore-result');
    expect(status?.classList.contains('restore-error')).toBe(true);
    expect(status?.textContent?.trim()).toBe('Epoch 1 is no longer kept.');
  });

  it('has no Restore for a node without a locator', async () => {
    const fixture = await render();
    await select(fixture, '2');
    expect(text(fixture)).toContain('Value history');
    expect(restoreButtons(fixture)).toHaveLength(0);
  });

  it('hides Restore with a reason when component writes are off', async () => {
    const fixture = await render({ configs: { pangular: { actions: { components: false } } } });
    await select(fixture, '1');
    expect(restoreButtons(fixture)).toHaveLength(0);
    expect(text(fixture)).toContain(
      'Restore is off. Editing component properties and signals is turned off in the devtools config (actions.components).',
    );
  });

  it('hides Restore in a saved report and on a native page', async () => {
    const report = await render({ backend: 'static' });
    await select(report, '1');
    expect(restoreButtons(report)).toHaveLength(0);
    expect(text(report)).toContain('Restore is off. A saved report cannot write to the app.');
    TestBed.resetTestingModule();

    const native = await render({}, undefined, {
      pageId: 'p1',
      roots: [],
      platform: 'nativescript',
    });
    await select(native, '1');
    expect(restoreButtons(native)).toHaveLength(0);
    expect(text(native)).toContain('Restore is off. It needs the app open in a browser.');
  });
});
