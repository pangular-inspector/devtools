import { describe, expect, it } from 'vitest';
import { DEFAULT_CD_SLOW_MS, cdSlowMs, sanitizeCdRecording } from '../cd-data.ts';
import { PROFILER_EVENT as E, createCdRecorder } from '../cd-recorder.ts';
import {
  PANGULAR_LIMITS,
  pangularConfigProblems,
  resolvePangularConfig,
  summarizePangularConfig,
} from '../config.ts';
import { changeDetectionText, toCdPage, type CdState } from '../rpc/cd-tools.ts';

class Shell {}

function clocked() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/** Records one cycle per duration, each checking `Shell` for the whole cycle. */
function record(durations: number[], slowMs?: number) {
  const clock = clocked();
  const recorder = createCdRecorder({
    maxCycles: 10,
    now: clock.now,
    clock: () => 1000,
    ...(slowMs === undefined ? {} : { slowMs }),
  });
  recorder.start();
  const shell = new Shell();
  for (const ms of durations) {
    recorder.onEvent(E.ChangeDetectionStart);
    recorder.onEvent(E.ChangeDetectionSyncStart);
    recorder.onEvent(E.ComponentStart);
    recorder.onEvent(E.TemplateUpdateStart, shell);
    clock.advance(ms);
    recorder.onEvent(E.ComponentEnd, shell);
    recorder.onEvent(E.ChangeDetectionEnd);
  }
  return recorder.snapshot(() => null);
}

describe('limits.cdSlowMs', () => {
  it('defaults to 16 ms, the same as the sanitizer default', () => {
    expect(PANGULAR_LIMITS.cdSlowMs.default).toBe(16);
    expect(DEFAULT_CD_SLOW_MS).toBe(PANGULAR_LIMITS.cdSlowMs.default);
    expect(resolvePangularConfig({}).limits.cdSlowMs).toBe(16);
  });

  it('clamps values out of range and says so', () => {
    expect(resolvePangularConfig({ limits: { cdSlowMs: 33 } }).limits.cdSlowMs).toBe(33);
    expect(resolvePangularConfig({ limits: { cdSlowMs: 0 } }).limits.cdSlowMs).toBe(1);
    expect(resolvePangularConfig({ limits: { cdSlowMs: 5000 } }).limits.cdSlowMs).toBe(1000);
    expect(pangularConfigProblems({ limits: { cdSlowMs: 5000 } }).join('\n')).toContain(
      'limits.cdSlowMs',
    );
  });

  it('lists a changed threshold in the config summary', () => {
    const summary = summarizePangularConfig(resolvePangularConfig({ limits: { cdSlowMs: 8 } }));
    expect(summary).toContainEqual({ label: 'Limits', value: 'slow cycles over 8 ms' });
  });
});

describe('slow cycle flags', () => {
  it('flags cycles longer than 16 ms by default', () => {
    const snap = record([4, 16, 20]);
    expect(snap.slowMs).toBe(16);
    expect(snap.cycles.map((c) => c.slow ?? false)).toEqual([false, false, true]);
  });

  it('uses the slowMs it is given', () => {
    const snap = record([4, 6, 20], 5);
    expect(snap.slowMs).toBe(5);
    expect(snap.cycles.map((c) => c.slow ?? false)).toEqual([false, true, true]);
  });

  it('works the flags out again on the server instead of trusting the page', () => {
    const clean = sanitizeCdRecording(
      {
        slowMs: 10,
        cycles: [
          { id: 1, ms: 5, slow: true, components: [] },
          { id: 2, ms: 12, components: [] },
        ],
      },
      10,
    )!;
    expect(clean.slowMs).toBe(10);
    expect(clean.cycles.map((c) => c.slow ?? false)).toEqual([false, true]);
  });

  it('reads a recording without a threshold, or with one out of range, as 16 ms', () => {
    expect(cdSlowMs(undefined)).toBe(16);
    expect(cdSlowMs(-1)).toBe(16);
    expect(cdSlowMs(Number.NaN)).toBe(16);
    expect(cdSlowMs(1e9)).toBe(16);
    expect(cdSlowMs(25)).toBe(25);
    const clean = sanitizeCdRecording({ cycles: [{ id: 1, ms: 17, components: [] }] }, 10)!;
    expect(clean.slowMs).toBe(16);
    expect(clean.cycles[0].slow).toBe(true);
  });

  it('names slow cycles and the threshold in the change-detection tool', () => {
    const page = toCdPage({ pageId: 'p1', ...record([4, 30], 20) }, 50, 1)!;
    const state: CdState = { pages: { p1: page } };
    const text = changeDetectionText(state);
    expect(text).toContain('1 slow (over 20ms, `limits.cdSlowMs`)');
    expect(text).toMatch(/#2: 30ms \(slow\)/);
    expect(text).not.toMatch(/#1: 4ms \(slow\)/);
  });
});
