import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CdRecording, type CdPage } from '../pages/cd-recording';

let fixture: ComponentFixture<CdRecording>;
let rpcCall: ReturnType<typeof vi.fn>;

function page(options?: CdPage['options'], supported = true): CdPage {
  return {
    pageId: 'p1',
    supported,
    recording: false,
    startedAt: null,
    dropped: 0,
    cycles: [],
    components: [],
    hosts: {},
    ...(options ? { options } : {}),
  };
}

const host = () => fixture.nativeElement as HTMLElement;
const live = () => host().querySelector('[role="status"]')!.textContent!;
const toggle = (text: string) =>
  [...host().querySelectorAll<HTMLButtonElement>('.views button')].find(
    (b) => b.textContent?.trim() === text,
  )!;
const pressed = (text: string) => toggle(text).getAttribute('aria-pressed');

async function show(value: CdPage | null) {
  fixture.componentRef.setInput('page', value);
  await fixture.whenStable();
}

async function click(text: string) {
  toggle(text).click();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('CdRecording live views', () => {
  beforeEach(async () => {
    rpcCall = vi.fn(() => Promise.resolve({ ok: true }));
    const client = { scope: () => ({ rpc: { call: rpcCall } }) };
    fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient);
    await show(null);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows the three toggles off in a labelled group', () => {
    const group = host().querySelector('.views')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(host().querySelector(`#${group.getAttribute('aria-labelledby')}`)!.textContent).toBe(
      'Live views',
    );
    expect(pressed('Flash checks')).toBe('false');
    expect(pressed('Performance track')).toBe('false');
    expect(pressed('Angular profiling')).toBe('false');
    for (const button of host().querySelectorAll<HTMLButtonElement>('.views button')) {
      expect(button.type).toBe('button');
      expect(button.disabled).toBe(false);
    }
  });

  it('turns flash checks on and off for the page and announces it', async () => {
    await click('Flash checks');
    expect(rpcCall).toHaveBeenLastCalledWith('request-change-detection-options', {
      pageId: 'p1',
      flash: true,
    });
    expect(pressed('Flash checks')).toBe('true');
    expect(live()).toBe('Flash checks on.');

    await show(
      page({ flash: true, track: false, angularProfiling: false, angularProfilingAvailable: true }),
    );
    await click('Flash checks');
    expect(rpcCall).toHaveBeenLastCalledWith('request-change-detection-options', {
      pageId: 'p1',
      flash: false,
    });
    expect(pressed('Flash checks')).toBe('false');
  });

  it('turns the Performance track on', async () => {
    await click('Performance track');
    expect(rpcCall).toHaveBeenLastCalledWith('request-change-detection-options', {
      pageId: 'p1',
      track: true,
    });
    expect(live()).toContain('Performance track on.');
  });

  it('turns Angular profiling on once and says it stays on', async () => {
    await click('Angular profiling');
    expect(rpcCall).toHaveBeenLastCalledWith('request-change-detection-options', {
      pageId: 'p1',
      angularProfiling: true,
    });
    expect(pressed('Angular profiling')).toBe('true');
    expect(toggle('Angular profiling').disabled).toBe(true);
    expect(host().textContent).toContain('Angular profiling stays on until the page reloads.');
  });

  it('shows the state the page reports', async () => {
    await show(
      page({ flash: false, track: true, angularProfiling: true, angularProfilingAvailable: true }),
    );
    expect(pressed('Performance track')).toBe('true');
    expect(pressed('Angular profiling')).toBe('true');
    expect(toggle('Angular profiling').disabled).toBe(true);
  });

  it('explains when the page has no ng.enableProfiling', async () => {
    await show(
      page({
        flash: false,
        track: false,
        angularProfiling: false,
        angularProfilingAvailable: false,
      }),
    );
    expect(toggle('Angular profiling').disabled).toBe(true);
    expect(host().textContent).toContain('It needs Angular 20 or later in a development build.');
  });

  it('puts a toggle back when the page cannot be reached', async () => {
    rpcCall.mockImplementation(() => Promise.reject(new Error('offline')));
    await click('Flash checks');
    expect(pressed('Flash checks')).toBe('false');
    expect(live()).toBe('Could not reach the page.');
  });

  it('disables the toggles on a page that cannot record', async () => {
    await show(page(undefined, false));
    for (const button of host().querySelectorAll<HTMLButtonElement>('.views button')) {
      expect(button.disabled).toBe(true);
    }
  });
});
