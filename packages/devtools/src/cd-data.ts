import type {
  CdAfterRenderStat,
  CdCheck,
  CdComponentStat,
  CdCycle,
  CdHookStat,
  CdOptions,
  CdOutputStat,
  CdRecording,
  CdSpan,
  CdSpanKind,
} from './config.ts';

/** The largest time a JavaScript Date can hold, in ms. */
const MAX_DATE_MS = 8.64e15;

// Shared by the server, which checks what pages push, and the panel, which
// checks a recording file before it shows it. It imports nothing at runtime,
// so `config.ts` can re-export it to the panel.

const MAX_NAME = 200;
const MAX_TRIGGER = 300;
const MAX_HOOK = 100;
const MAX_TOP = 10;
const MAX_COMPONENTS = 100;
const MAX_HOSTS = 2000;
const MAX_CYCLES = 2000;
/** Spans a cycle keeps, the longest ones. The recorder uses the same cap. */
export const MAX_SPANS = 40;
const MAX_SPAN_NAMES = 4000;
const MAX_DEPTH = 1000;
const MAX_TIMINGS = 100;
const MAX_PAGE_ID = 50;

/** What each {@link CdSpan} kind letter means. */
export const CD_SPAN_KIND = {
  component: 'c',
  hook: 'h',
  afterRender: 'r',
  output: 'o',
} as const satisfies Record<string, CdSpanKind>;

const SPAN_KINDS: readonly string[] = Object.values(CD_SPAN_KIND);

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : '';
/** A non-negative number, or undefined so the field is left out. */
const optional = (value: unknown) => (num(value) > 0 ? num(value) : undefined);
const list = (value: unknown, max: number) =>
  Array.isArray(value) ? (value as unknown[]).slice(0, max) : [];

function check(value: unknown): CdCheck | null {
  if (!isRecord(value)) return null;
  const name = text(value['name'], MAX_NAME);
  return name ? { name, checks: num(value['checks']), ms: num(value['ms']) } : null;
}

function span(value: unknown, names: number): CdSpan | null {
  if (!Array.isArray(value) || value.length !== 5) return null;
  const [name, start, ms, depth, kind] = value as unknown[];
  if (typeof name !== 'number' || !Number.isInteger(name) || name < 0 || name >= names) return null;
  if (typeof start !== 'number' || !Number.isFinite(start) || Math.abs(start) > 1e7) return null;
  if (typeof depth !== 'number' || !Number.isInteger(depth) || depth < 0 || depth > MAX_DEPTH)
    return null;
  if (typeof kind !== 'string' || !SPAN_KINDS.includes(kind)) return null;
  return [name, start, num(ms), depth, kind as CdSpanKind];
}

function cycle(value: unknown, names: number): CdCycle | null {
  if (!isRecord(value) || typeof value['id'] !== 'number') return null;
  const components = list(value['components'], MAX_TOP)
    .map(check)
    .filter((c): c is CdCheck => !!c);
  const trigger = text(value['trigger'], MAX_TRIGGER);
  const spans = list(value['spans'], MAX_SPANS)
    .map((each) => span(each, names))
    .filter((s): s is CdSpan => !!s);
  const extraSpans = Array.isArray(value['spans'])
    ? (value['spans'] as unknown[]).length - MAX_SPANS
    : 0;
  const droppedSpans = Math.floor(num(value['droppedSpans'])) + Math.max(0, extraSpans);
  const timing = {
    t: typeof value['t'] === 'number' ? num(value['t']) : undefined,
    hookMs: optional(value['hookMs']),
    afterRenderMs: optional(value['afterRenderMs']),
    outputMs: optional(value['outputMs']),
  };
  return {
    id: num(value['id']),
    at: num(value['at']),
    ms: num(value['ms']),
    passes: num(value['passes']),
    ...(trigger ? { trigger } : {}),
    checks: num(value['checks']),
    components,
    ...Object.fromEntries(Object.entries(timing).filter(([, v]) => v !== undefined)),
    ...(spans.length ? { spans } : {}),
    ...(droppedSpans ? { droppedSpans } : {}),
  };
}

function stat(value: unknown): CdComponentStat | null {
  const base = check(value);
  if (!base || !isRecord(value)) return null;
  return { ...base, maxMs: num(value['maxMs']), cycles: num(value['cycles']) };
}

function hookStat(value: unknown): CdHookStat | null {
  if (!isRecord(value)) return null;
  const name = text(value['name'], MAX_NAME);
  const hook = text(value['hook'], MAX_HOOK);
  if (!name || !hook) return null;
  const { calls, ms, maxMs } = value;
  return { name, hook, calls: num(calls), ms: num(ms), maxMs: num(maxMs) };
}

function outputStat(value: unknown): CdOutputStat | null {
  if (!isRecord(value)) return null;
  const name = text(value['name'], MAX_NAME);
  if (!name) return null;
  const listener = text(value['listener'], MAX_NAME);
  return {
    name,
    ...(listener ? { listener } : {}),
    calls: num(value['calls']),
    ms: num(value['ms']),
    maxMs: num(value['maxMs']),
  };
}

function afterRenderStat(value: unknown): CdAfterRenderStat | undefined {
  if (!isRecord(value) || !num(value['runs'])) return undefined;
  return { runs: num(value['runs']), ms: num(value['ms']), maxMs: num(value['maxMs']) };
}

/**
 * Checks a recording from a page push or a file: known fields only, strings
 * cut, numbers finite and lists capped. Null when `value` is not an object.
 */
export function sanitizeCdRecording(value: unknown, maxCycles: number): CdRecording | null {
  if (!isRecord(value)) return null;
  const spanNames = list(value['spanNames'], MAX_SPAN_NAMES).map((name) => text(name, MAX_TRIGGER));
  const cycles = Array.isArray(value['cycles'])
    ? value['cycles']
        .slice(-Math.min(maxCycles, MAX_CYCLES))
        .map((each) => cycle(each, spanNames.length))
        .filter((c): c is CdCycle => !!c)
    : [];
  const hosts: Record<string, number> = {};
  let extraHosts = 0;
  if (isRecord(value['hosts'])) {
    const entries = Object.entries(value['hosts']);
    extraHosts = Math.max(0, entries.length - MAX_HOSTS);
    for (const [id, count] of entries.slice(0, MAX_HOSTS)) {
      if (id.length < 50 && num(count)) hosts[id] = num(count);
    }
  }
  const components = Array.isArray(value['components']) ? value['components'] : [];
  const droppedClasses =
    Math.floor(num(value['droppedClasses'])) + Math.max(0, components.length - MAX_COMPONENTS);
  const droppedHosts = Math.floor(num(value['droppedHosts'])) + extraHosts;
  const hooks = list(value['hooks'], MAX_TIMINGS)
    .map(hookStat)
    .filter((h): h is CdHookStat => !!h);
  const outputs = list(value['outputs'], MAX_TIMINGS)
    .map(outputStat)
    .filter((o): o is CdOutputStat => !!o);
  const extraTimings =
    Math.max(0, list(value['hooks'], Infinity).length - MAX_TIMINGS) +
    Math.max(0, list(value['outputs'], Infinity).length - MAX_TIMINGS);
  const droppedTimings = Math.floor(num(value['droppedTimings'])) + extraTimings;
  const afterRender = afterRenderStat(value['afterRender']);
  const used = cycles.some((c) => c.spans?.length);
  return {
    recording: value['recording'] === true,
    startedAt:
      typeof value['startedAt'] === 'number' && value['startedAt'] <= MAX_DATE_MS
        ? num(value['startedAt'])
        : null,
    dropped: num(value['dropped']),
    cycles,
    components: components
      .slice(0, MAX_COMPONENTS)
      .map(stat)
      .filter((c): c is CdComponentStat => !!c),
    ...(droppedClasses ? { droppedClasses } : {}),
    hosts,
    ...(droppedHosts ? { droppedHosts } : {}),
    ...(hooks.length ? { hooks } : {}),
    ...(outputs.length ? { outputs } : {}),
    ...(droppedTimings ? { droppedTimings } : {}),
    ...(afterRender ? { afterRender } : {}),
    ...(used ? { spanNames } : {}),
  };
}

/** The `format` of a recording file, so an import can tell it apart from other JSON. */
export const CD_EXPORT_FORMAT = 'pangular-inspector/change-detection';

export interface CdExportFile {
  format: typeof CD_EXPORT_FORMAT;
  version: 1;
  /** When the file was written, in ms since the epoch. */
  exportedAt: number;
  pageId: string;
  recording: CdRecording;
}

/**
 * A recording as a JSON file, with only the recording's own fields. Host
 * counts are left out: their element ids only mean something in the page
 * that recorded them.
 */
export function cdExportFile(
  recording: CdRecording,
  pageId: string,
  exportedAt = Date.now(),
): CdExportFile {
  const clean = sanitizeCdRecording(recording, MAX_CYCLES) ?? recording;
  return {
    format: CD_EXPORT_FORMAT,
    version: 1,
    exportedAt,
    pageId,
    recording: { ...clean, recording: false, hosts: {} },
  };
}

/** Files larger than this are not read. */
export const MAX_CD_IMPORT_BYTES = 20_000_000;

/**
 * Reads a recording file: an export from the panel or the agent tool, or a
 * bare recording. Everything in it goes through {@link sanitizeCdRecording}.
 */
export function parseCdImport(
  json: string,
  maxCycles: number,
):
  | { ok: true; pageId: string; exportedAt?: number; recording: CdRecording }
  | { ok: false; error: string } {
  // A UTF-16 unit is at most 3 UTF-8 bytes, so only a long string needs encoding.
  const tooLarge =
    json.length > MAX_CD_IMPORT_BYTES ||
    (json.length * 3 > MAX_CD_IMPORT_BYTES &&
      new TextEncoder().encode(json).byteLength > MAX_CD_IMPORT_BYTES);
  if (tooLarge) {
    return { ok: false, error: 'The file is larger than 20 MB.' };
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isRecord(value)) return { ok: false, error: 'The file is not a recording.' };
  if (value['format'] !== undefined && value['format'] !== CD_EXPORT_FORMAT) {
    return { ok: false, error: 'The file is not a change detection recording.' };
  }
  const source = isRecord(value['recording']) ? value['recording'] : value;
  if (!Array.isArray(source['cycles'])) {
    return { ok: false, error: 'The file has no change detection cycles.' };
  }
  const recording = sanitizeCdRecording(source, maxCycles);
  if (!recording) return { ok: false, error: 'The file is not a recording.' };
  const pageId = text(value['pageId'] ?? source['pageId'], MAX_PAGE_ID - 1) || 'imported';
  const exportedAt = optional(value['exportedAt']);
  return {
    ok: true,
    pageId,
    ...(exportedAt ? { exportedAt } : {}),
    recording: { ...recording, recording: false },
  };
}

/** One event of the Trace Event Format that Perfetto and `chrome://tracing` read. */
export interface CdTraceEvent {
  name: string;
  /** `X` is a complete event with `dur`, `M` a metadata event that names a process or thread. */
  ph: 'X' | 'M';
  pid: number;
  tid: number;
  /** Microseconds. */
  ts?: number;
  /** Microseconds. */
  dur?: number;
  cat?: string;
  args?: Record<string, unknown>;
}

export interface CdTraceFile {
  traceEvents: CdTraceEvent[];
  displayTimeUnit: 'ms';
  otherData: Record<string, string | number>;
}

const PID = 1;
const CD_TID = 1;
const OUTPUT_TID = 2;
const CATEGORY: Record<CdSpanKind, string> = {
  c: 'component',
  h: 'lifecycle-hook',
  r: 'after-render',
  o: 'output',
};

const us = (ms: number) => Math.round(ms * 1_000_000) / 1000;

/**
 * A recording in the Trace Event Format, for Perfetto (ui.perfetto.dev) or
 * `chrome://tracing`: one complete (`X`) event per cycle, one per kept span
 * (component check, lifecycle hook, afterRender) nested inside it, and the
 * output listeners that started cycles on a thread of their own. Times are in
 * microseconds from the first cycle.
 */
export function cdTraceFile(recording: CdRecording, pageId: string): CdTraceFile {
  const names = recording.spanNames ?? [];
  const firstAt = recording.cycles[0]?.at ?? 0;
  const base = recording.startedAt ?? firstAt;
  const events: CdTraceEvent[] = [];
  let spans = 0;
  let droppedSpans = 0;
  for (const cycle of recording.cycles) {
    // `t` comes from the high-resolution clock; files without it fall back to the wall clock.
    const start = cycle.t ?? Math.max(0, cycle.at - base);
    const end = start + cycle.ms;
    events.push({
      name: `Change detection #${cycle.id}`,
      cat: 'change-detection',
      ph: 'X',
      pid: PID,
      tid: CD_TID,
      ts: us(start),
      dur: us(cycle.ms),
      args: {
        checks: cycle.checks,
        passes: cycle.passes,
        ...(cycle.trigger ? { trigger: cycle.trigger } : {}),
        ...(cycle.hookMs ? { hookMs: cycle.hookMs } : {}),
        ...(cycle.afterRenderMs ? { afterRenderMs: cycle.afterRenderMs } : {}),
        ...(cycle.outputMs ? { outputMs: cycle.outputMs } : {}),
        slowest: cycle.components.map((c) => `${c.name} ${c.checks}x ${c.ms}ms`),
      },
    });
    droppedSpans += cycle.droppedSpans ?? 0;
    // Clamp each span into the one that contains it, so rounding never breaks the nesting.
    const open: { end: number }[] = [{ end }];
    const sorted = [...(cycle.spans ?? [])].sort((a, b) => a[1] - b[1] || b[2] - a[2]);
    for (const [name, offset, ms, depth, kind] of sorted) {
      spans++;
      const label = names[name] ?? '?';
      if (kind === CD_SPAN_KIND.output) {
        const ts = start + offset;
        events.push({
          name: label,
          cat: CATEGORY[kind],
          ph: 'X',
          pid: PID,
          tid: OUTPUT_TID,
          ts: us(ts),
          // Only an output that ran before the cycle is clamped to the cycle's start.
          dur: us(offset < 0 ? Math.max(0, Math.min(ms, -offset)) : ms),
          args: { cycle: cycle.id },
        });
        continue;
      }
      const ts = Math.max(start, start + offset);
      while (open.length > 1 && open.at(-1)!.end <= ts) open.pop();
      const parentEnd = open.at(-1)!.end;
      const spanEnd = Math.min(ts + ms, parentEnd);
      if (spanEnd < ts) continue;
      open.push({ end: spanEnd });
      events.push({
        name: label,
        cat: CATEGORY[kind],
        ph: 'X',
        pid: PID,
        tid: CD_TID,
        ts: us(ts),
        dur: us(spanEnd - ts),
        args: { cycle: cycle.id, depth },
      });
    }
  }
  // Outputs run before the first cycle, so shift everything to start at zero.
  const min = Math.min(0, ...events.map((e) => e.ts ?? 0));
  if (min < 0) for (const event of events) event.ts = us((event.ts! - min) / 1000);
  events.sort((a, b) => a.ts! - b.ts! || b.dur! - a.dur!);
  const meta = (tid: number, name: string, value: string): CdTraceEvent => ({
    name,
    ph: 'M',
    pid: PID,
    tid,
    args: { name: value },
  });
  return {
    traceEvents: [
      meta(0, 'process_name', `Angular change detection (page ${pageId})`),
      meta(CD_TID, 'thread_name', 'Change detection'),
      meta(OUTPUT_TID, 'thread_name', 'Outputs'),
      ...events,
    ],
    displayTimeUnit: 'ms',
    otherData: {
      source: 'Pangular Inspector change detection recording',
      pageId,
      cycles: recording.cycles.length,
      droppedCycles: recording.dropped,
      spans,
      droppedSpans,
      ...(recording.startedAt && recording.startedAt <= MAX_DATE_MS
        ? { startedAt: new Date(recording.startedAt).toISOString() }
        : {}),
    },
  };
}

/** A `change-detection-options` request; a missing field leaves that view as it is. */
export interface CdOptionsRequest {
  flash?: boolean;
  track?: boolean;
  /** Only `true` does anything: Angular has no way to turn its profiling off again. */
  angularProfiling?: boolean;
}

/** Reads an options request from the wire, keeping only the fields it knows. */
export function toCdOptionsRequest(value: unknown): CdOptionsRequest {
  const message = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const request: CdOptionsRequest = {};
  if (typeof message['flash'] === 'boolean') request.flash = message['flash'];
  if (typeof message['track'] === 'boolean') request.track = message['track'];
  if (message['angularProfiling'] === true) request.angularProfiling = true;
  return request;
}

/** The views a page reports it has on, with only the known boolean fields. */
export function toCdOptions(value: unknown): CdOptions | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const options = value as Record<string, unknown>;
  return {
    flash: options['flash'] === true,
    track: options['track'] === true,
    angularProfiling: options['angularProfiling'] === true,
    angularProfilingAvailable: options['angularProfilingAvailable'] === true,
  };
}
