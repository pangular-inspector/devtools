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
    expect(live()).toBe('Recording stopped. 3 cycles recorded.');

    await show(false, 3);
    await click('Clear');
    expect(live()).toBe('Cleared the recorded cycles.');
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
});
