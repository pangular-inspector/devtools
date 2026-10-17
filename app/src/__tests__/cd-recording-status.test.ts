import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CdRecording, type CdCycle, type CdPage } from '../pages/cd-recording';

let fixture: ComponentFixture<CdRecording>;
let rpcCall: ReturnType<typeof vi.fn>;

function cycle(id: number): CdCycle {
  return { id, at: 1000 + id, ms: 1, passes: 1, checks: 2, components: [] };
}

function page(recording: boolean, count: number): CdPage {
  return {
    pageId: 'p1',
    supported: true,
    recording,
    startedAt: recording ? 1000 : null,
    dropped: 0,
    cycles: Array.from({ length: count }, (_, i) => cycle(i + 1)),
    components: [],
    hosts: {},
  };
}

const host = () => fixture.nativeElement as HTMLElement;
const live = () => host().querySelector('[role="status"]')!.textContent!;
const visible = () => host().querySelector('.status')!.textContent!.trim();
const button = (text: string) =>
  [...host().querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;

async function show(recording: boolean, count: number) {
  fixture.componentRef.setInput('page', page(recording, count));
  await fixture.whenStable();
}

async function click(text: string) {
  button(text).click();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('CdRecording status', () => {
  beforeEach(async () => {
    rpcCall = vi.fn(() => Promise.resolve({ ok: true }));
    const client = { scope: () => ({ rpc: { call: rpcCall } }) };
    fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient);
    await show(false, 0);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('keeps the cycle count visible but out of the live region', async () => {
    await show(true, 1);
    const before = live();
    expect(visible()).toBe('Recording. 1 cycle so far.');
    expect(host().querySelector('.status')!.closest('[role="status"], [aria-live]')).toBeNull();

    await show(true, 2);
    await show(true, 30);
    expect(visible()).toBe('Recording. 30 cycles so far.');
    expect(live()).toBe(before);
  });

  it('announces Record, Stop with the total, and Clear', async () => {
    await click('Record');
    expect(rpcCall).toHaveBeenLastCalledWith('request-change-detection-record', {
      pageId: 'p1',
      on: true,
    });
    expect(live()).toBe('Recording started.');

    await show(true, 3);
    expect(live()).toBe('Recording started.');

    await click('Stop recording');
    // The page's last report still brings cycles: the total waits for it.
    expect(live()).toBe('Recording started.');
    await show(false, 5);
    expect(live()).toBe('Recording stopped. 5 cycles recorded.');

    await click('Clear');
    expect(live()).toBe('Cleared the recorded cycles.');
  });

  it('announces the count it has when the last report does not come', async () => {
    await show(true, 2);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      button('Stop recording').click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(live()).not.toContain('stopped');
      await vi.advanceTimersByTimeAsync(3000);
      fixture.detectChanges();
      expect(live()).toBe('Recording stopped. 2 cycles recorded.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces a repeated message again', async () => {
    await show(false, 2);
    await click('Clear');
    const first = live();
    await click('Clear');
    expect(live()).not.toBe(first);
    expect(live().trim()).toBe('Cleared the recorded cycles.');
  });

  it('announces when the page cannot be reached', async () => {
    rpcCall.mockImplementation(() => Promise.reject(new Error('offline')));
    await click('Record');
    expect(live()).toBe('Could not reach the page.');
    expect(visible()).toBe('Could not reach the page.');
  });

  it('reports a failure, not success, when there is no connection to clear through', async () => {
    fixture.componentRef.setInput('rpc', null);
    await show(false, 3);
    await click('Clear');
    expect(live()).toBe('Could not reach the page.');
    expect(live()).not.toContain('Cleared');
  });

  it('notes the classes and instances a recording checked past its caps', async () => {
    expect(host().querySelectorAll('.note')).toHaveLength(0);
    fixture.componentRef.setInput('page', {
      ...page(false, 1),
      droppedClasses: 905,
      droppedHosts: 1,
    });
    await fixture.whenStable();
    const notes = [...host().querySelectorAll('.note')].map((n) => n.textContent!.trim());
    expect(notes).toEqual([
      '905 more component classes were checked than a recording keeps, so they are left out of these totals.',
      '1 component instance was checked past the 2000 a recording counts, so its tree row shows no check count.',
    ]);
  });
});

describe('CdRecording on a page that could not record', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  async function showUnsupported(capabilities: Record<string, boolean>, version: string) {
    const angular = {
      pages: { p1: { pageId: 'p1', reportedAt: 1, version, capabilities } },
    };
    const rpc = {
      call: () => Promise.resolve({ ok: true }),
      sharedState: (name: string) =>
        Promise.resolve({
          value: () => (name === 'page-angular' ? angular : null),
          on: () => () => {},
        }),
    };
    fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('rpc', {
      scope: () => ({ rpc }),
    } as unknown as DevframeRpcClient);
    fixture.componentRef.setInput('page', { ...page(false, 0), supported: false });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return host().textContent!.replace(/\s+/g, ' ');
  }

  it('names the version when the page lacks the profiler hook', async () => {
    const text = await showUnsupported({ profiler: false }, '19.2.0');
    expect(text).toContain('Recording change detection needs Angular 20.0 or later');
    expect(text).not.toContain('could not attach');
  });

  it('says the recording could not attach, not the version, when the page has the hook', async () => {
    const text = await showUnsupported({ profiler: true }, '22.1.0');
    expect(text).toContain('could not attach to it yet');
    expect(text).not.toContain('needs Angular 20.0');
    expect(text).not.toContain('Not available on Angular 22.1');
  });
});
