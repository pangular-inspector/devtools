import type {
  CdAfterRenderStat,
  CdCheck,
  CdComponentStat,
  CdCycle,
  CdHookStat,
  CdOutputStat,
  CdRecording,
  CdSpan,
  CdSpanKind,
} from './config.ts';

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
    startedAt: typeof value['startedAt'] === 'number' ? num(value['startedAt']) : null,
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
