import { describe, expect, it } from 'vitest';
import {
  CD_EXPORT_FORMAT,
  MAX_CD_IMPORT_BYTES,
  MAX_SPANS,
  cdExportFile,
  cdTraceFile,
  parseCdImport,
  sanitizeCdRecording,
  type CdTraceEvent,
} from '../cd-data.ts';
import type { CdRecording, CdSpan } from '../config.ts';

function recording(): CdRecording {
  return {
    recording: true,
    startedAt: 1_700_000_000_000,
    dropped: 0,
    hosts: { e1: 3 },
    components: [{ name: 'Cart', checks: 2, ms: 3, maxMs: 2, cycles: 2 }],
    hooks: [{ name: 'Cart', hook: 'ngDoCheck', calls: 2, ms: 0.5, maxMs: 0.3 }],
    outputs: [{ name: 'Cart', listener: 'onAdd', calls: 1, ms: 0.2, maxMs: 0.2 }],
    afterRender: { runs: 2, ms: 0.4, maxMs: 0.3 },
    spanNames: ['Shell', 'Cart', 'Cart.ngDoCheck', 'afterRender', 'Cart (onAdd)'],
    cycles: [
      {
        id: 1,
        at: 1_700_000_000_010,
        t: 1.5,
        ms: 2,
        passes: 1,
        trigger: 'Cart (onAdd)',
        checks: 2,
        components: [{ name: 'Cart', checks: 1, ms: 1 }],
        hookMs: 0.3,
        afterRenderMs: 0.2,
        outputMs: 0.2,
        spans: [
          [4, -0.5, 0.2, 0, 'o'],
          [0, 0, 1.6, 0, 'c'],
          [2, 0.1, 0.3, 1, 'h'],
          // Rounding can leave a child a little past its parent's end.
          [1, 0.5, 1.101, 1, 'c'],
          [3, 1.7, 0.2, 0, 'r'],
        ],
      },
      {
        id: 2,
        at: 1_700_000_000_020,
        t: 10,
        ms: 1,
        passes: 1,
        checks: 1,
        components: [],
        spans: [[1, 0, 0.9, 0, 'c']],
      },
    ],
  };
}

/** Checks the fields the Trace Event Format requires and that complete events nest per thread. */
function validateTrace(events: CdTraceEvent[]) {
  for (const event of events) {
    expect(typeof event.name).toBe('string');
    expect(['X', 'M']).toContain(event.ph);
    expect(Number.isInteger(event.pid)).toBe(true);
    expect(Number.isInteger(event.tid)).toBe(true);
    if (event.ph === 'M') {
      expect(['process_name', 'thread_name']).toContain(event.name);
      expect(typeof event.args?.['name']).toBe('string');
      continue;
    }
    expect(Number.isFinite(event.ts)).toBe(true);
    expect(Number.isFinite(event.dur)).toBe(true);
    expect(event.ts).toBeGreaterThanOrEqual(0);
    expect(event.dur).toBeGreaterThanOrEqual(0);
  }
  const threads = new Map<number, CdTraceEvent[]>();
  for (const event of events.filter((e) => e.ph === 'X')) {
    threads.set(event.tid, [...(threads.get(event.tid) ?? []), event]);
  }
  for (const list of threads.values()) {
    const open: number[] = [];
    for (const event of [...list].sort((a, b) => a.ts! - b.ts! || b.dur! - a.dur!)) {
      while (open.length && open.at(-1)! <= event.ts!) open.pop();
      if (open.length) expect(event.ts! + event.dur!).toBeLessThanOrEqual(open.at(-1)! + 1e-6);
      open.push(event.ts! + event.dur!);
    }
  }
}

describe('change detection recording sanitizer', () => {
  it('keeps the timing fields and drops what is not a recording field', () => {
    const value = {
      ...recording(),
      extra: '<script>alert(1)</script>',
      hooks: [
        { name: 'Cart', hook: 'ngDoCheck', calls: 2, ms: 0.5, maxMs: 0.3, html: '<b>' },
        { name: '', hook: 'ngOnInit', calls: 1, ms: 1, maxMs: 1 },
        { name: 'X', hook: 'h'.repeat(500), calls: -1, ms: Number.NaN, maxMs: '9' },
      ],
    };
    const clean = sanitizeCdRecording(value, 200)!;
    expect(clean).not.toHaveProperty('extra');
    expect(clean.hooks).toEqual([
      { name: 'Cart', hook: 'ngDoCheck', calls: 2, ms: 0.5, maxMs: 0.3 },
      { name: 'X', hook: 'h'.repeat(100), calls: 0, ms: 0, maxMs: 0 },
    ]);
    expect(clean.cycles[0]).toMatchObject({
      t: 1.5,
      hookMs: 0.3,
      afterRenderMs: 0.2,
      outputMs: 0.2,
    });
    expect(clean.cycles[0]!.spans).toHaveLength(5);
    expect(clean.afterRender).toEqual({ runs: 2, ms: 0.4, maxMs: 0.3 });
    expect(clean.outputs).toEqual(recording().outputs);
  });

  it('drops spans with a bad name index, kind, depth or start and caps them per cycle', () => {
    const base = recording();
    const cycle = {
      ...base.cycles[1]!,
      spans: [
        [9, 0, 1, 0, 'c'],
        [0, 0, 1, 0, 'x'],
        [0, 0, 1, -1, 'c'],
        [0, Number.POSITIVE_INFINITY, 1, 0, 'c'],
        [0, 0, 1, 0, 'c', 'extra'],
        '<img src=x onerror=alert(1)>',
        [0, -2, -5, 0, 'o'],
      ],
    };
    const clean = sanitizeCdRecording({ ...base, cycles: [cycle] }, 200)!;
    expect(clean.cycles[0]!.spans).toEqual([[0, -2, 0, 0, 'o']]);

    const many = Array.from({ length: MAX_SPANS + 3 }, () => [0, 0, 1, 0, 'c']);
    const capped = sanitizeCdRecording(
      { ...base, cycles: [{ ...cycle, spans: many, droppedSpans: 2 }] },
      200,
    )!;
    expect(capped.cycles[0]!.spans).toHaveLength(MAX_SPANS);
    expect(capped.cycles[0]!.droppedSpans).toBe(5);
  });

  it('leaves the new fields out of a recording without them', () => {
    const clean = sanitizeCdRecording(
      { cycles: [{ id: 1, at: 1, ms: 1, passes: 1, checks: 1, components: [] }] },
      200,
    )!;
    expect(clean.cycles[0]).toEqual({ id: 1, at: 1, ms: 1, passes: 1, checks: 1, components: [] });
    for (const key of ['hooks', 'outputs', 'afterRender', 'spanNames', 'droppedTimings']) {
      expect(clean).not.toHaveProperty(key);
    }
  });
});

describe('change detection recording files', () => {
  it('writes a file that imports back to the same recording, stopped and without host ids', () => {
    const file = cdExportFile(recording(), 'p1', 5);
    expect(file).toMatchObject({
      format: CD_EXPORT_FORMAT,
      version: 1,
      exportedAt: 5,
      pageId: 'p1',
    });
    expect(file.recording.hosts).toEqual({});
    const parsed = parseCdImport(JSON.stringify(file), 200);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.pageId).toBe('p1');
    expect(parsed.exportedAt).toBe(5);
    expect(parsed.recording).toEqual({ ...recording(), recording: false, hosts: {} });
  });

  it('refuses a file over the limit in UTF-8 bytes, not string length', () => {
    // 7 million emoji are 14 million string units but 28 million bytes.
    const padded = JSON.stringify({ ...recording(), padding: '\u{1F600}'.repeat(7_000_000) });
    expect(padded.length).toBeLessThan(MAX_CD_IMPORT_BYTES);
    expect(parseCdImport(padded, 200)).toEqual({
      ok: false,
      error: 'The file is larger than 20 MB.',
    });
  });

  it('reads a bare recording and refuses files that are not recordings', () => {
    const bare = parseCdImport(JSON.stringify({ ...recording(), pageId: 'p9' }), 200);
    expect(bare).toMatchObject({ ok: true, pageId: 'p9', recording: { recording: false } });
    expect(parseCdImport('{', 200)).toEqual({ ok: false, error: 'The file is not valid JSON.' });
    expect(parseCdImport('[1]', 200)).toMatchObject({ ok: false });
    expect(parseCdImport(JSON.stringify({ format: 'other', cycles: [] }), 200)).toEqual({
      ok: false,
      error: 'The file is not a change detection recording.',
    });
    expect(parseCdImport(JSON.stringify({ navigations: [] }), 200)).toEqual({
      ok: false,
      error: 'The file has no change detection cycles.',
    });
  });

  it('keeps only the latest cycles the limit allows and cuts long names', () => {
    const cycles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      at: i,
      ms: 1,
      passes: 1,
      checks: 1,
      components: [{ name: 'N'.repeat(1000), checks: 1, ms: 1 }],
    }));
    const parsed = parseCdImport(JSON.stringify({ cycles, pageId: 'x'.repeat(80) }), 10);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.recording.cycles.map((c) => c.id)).toEqual([
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    ]);
    expect(parsed.recording.cycles[0]!.components[0]!.name).toHaveLength(200);
    expect(parsed.pageId).toHaveLength(49);
  });
});

describe('change detection trace export', () => {
  it('writes valid Trace Event Format JSON with a complete event per cycle and per span', () => {
    const trace = JSON.parse(JSON.stringify(cdTraceFile(recording(), 'p1'))) as ReturnType<
      typeof cdTraceFile
    >;
    expect(trace.displayTimeUnit).toBe('ms');
    validateTrace(trace.traceEvents);
    const complete = trace.traceEvents.filter((e) => e.ph === 'X');
    const cycles = complete.filter((e) => e.cat === 'change-detection');
    expect(cycles.map((e) => e.name)).toEqual(['Change detection #1', 'Change detection #2']);
    // Microseconds from the start of the recording.
    expect(cycles[0]).toMatchObject({ ts: 1500, dur: 2000, tid: 1 });
    expect(cycles[0]!.args).toMatchObject({ trigger: 'Cart (onAdd)', checks: 2, hookMs: 0.3 });
    expect(cycles[1]).toMatchObject({ ts: 10_000, dur: 1000 });
    const byCat = (cat: string) => complete.filter((e) => e.cat === cat).map((e) => e.name);
    expect(byCat('component')).toEqual(['Shell', 'Cart', 'Cart']);
    expect(byCat('lifecycle-hook')).toEqual(['Cart.ngDoCheck']);
    expect(byCat('after-render')).toEqual(['afterRender']);
    const output = complete.find((e) => e.cat === 'output')!;
    expect(output).toMatchObject({ name: 'Cart (onAdd)', tid: 2, ts: 1000, dur: 200 });
    // The child that ran past its parent by rounding is clamped to the parent's end.
    const shell = complete.find((e) => e.name === 'Shell')!;
    const cart = complete.find((e) => e.name === 'Cart' && e.args?.['cycle'] === 1)!;
    expect(cart.ts! + cart.dur!).toBe(shell.ts! + shell.dur!);
    expect(trace.traceEvents.filter((e) => e.ph === 'M').map((e) => e.args?.['name'])).toEqual([
      'Angular change detection (page p1)',
      'Change detection',
      'Outputs',
    ]);
    expect(trace.otherData).toMatchObject({ pageId: 'p1', cycles: 2, spans: 6, droppedSpans: 0 });
  });

  it('places cycles by wall clock when a file has no high-resolution start', () => {
    const old = recording();
    const cycles = old.cycles.map(({ t: _t, spans: _spans, ...rest }) => rest);
    const trace = cdTraceFile({ ...old, cycles, spanNames: undefined }, 'p1');
    validateTrace(trace.traceEvents);
    const ts = trace.traceEvents.filter((e) => e.ph === 'X').map((e) => e.ts);
    expect(ts).toEqual([10_000, 20_000]);
  });

  it('keeps the full duration of an output that ran inside the cycle', () => {
    const base = recording();
    const output: CdSpan = [4, 0.2, 0.7, 0, 'o'];
    const first = { ...base.cycles[0]!, spans: [output, ...base.cycles[0]!.spans!.slice(1)] };
    const trace = cdTraceFile({ ...base, cycles: [first] }, 'p1');
    validateTrace(trace.traceEvents);
    expect(trace.traceEvents.find((e) => e.cat === 'output')).toMatchObject({ ts: 1700, dur: 700 });
  });

  it('drops a start time no Date can hold, so the export does not throw', () => {
    const sanitized = sanitizeCdRecording({ ...recording(), startedAt: 1e300 }, 200);
    expect(sanitized?.startedAt).toBeNull();
    expect(() => cdTraceFile({ ...recording(), startedAt: 1e300 }, 'p1')).not.toThrow();
  });

  it('shifts every event to start at zero when an output ran before the first cycle', () => {
    const base = recording();
    const first = { ...base.cycles[0]!, t: 0 };
    const trace = cdTraceFile({ ...base, cycles: [first] }, 'p1');
    validateTrace(trace.traceEvents);
    const complete = trace.traceEvents.filter((e) => e.ph === 'X');
    expect(complete.find((e) => e.cat === 'output')).toMatchObject({ ts: 0, dur: 200 });
    expect(complete.find((e) => e.cat === 'change-detection')).toMatchObject({ ts: 500 });
  });
});
