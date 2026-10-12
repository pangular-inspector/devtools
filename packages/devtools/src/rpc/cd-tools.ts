import type { CdReport } from '../cd-overlay.ts';
import type { CdCheck, CdComponentStat, CdCycle } from '../cd-recorder.ts';
import { droppedNote } from '../timeline-limits.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import { PAGE_TTL_MS, fixedTtl, type PageTtl } from './page-ttl.ts';
import { unknownPageText, type ReportingPage } from './pages.ts';

export interface CdPage extends CdReport {
  reportedAt: number;
}

export interface CdState {
  pages: Record<string, CdPage>;
}

const MAX_NAME = 200;
const MAX_TRIGGER = 300;
const MAX_TOP = 10;
const MAX_COMPONENTS = 100;
const MAX_HOSTS = 2000;
const MAX_CYCLES = 2000;
export const CD_PAGE_TTL = PAGE_TTL_MS;

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : '';

function check(value: unknown): CdCheck | null {
  if (!isRecord(value)) return null;
  const name = text(value['name'], MAX_NAME);
  return name ? { name, checks: num(value['checks']), ms: num(value['ms']) } : null;
}

function cycle(value: unknown): CdCycle | null {
  if (!isRecord(value) || typeof value['id'] !== 'number') return null;
  const components = Array.isArray(value['components'])
    ? value['components']
        .slice(0, MAX_TOP)
        .map(check)
        .filter((c): c is CdCheck => !!c)
    : [];
  const trigger = text(value['trigger'], MAX_TRIGGER);
  return {
    id: num(value['id']),
    at: num(value['at']),
    ms: num(value['ms']),
    passes: num(value['passes']),
    ...(trigger ? { trigger } : {}),
    checks: num(value['checks']),
    components,
  };
}

function stat(value: unknown): CdComponentStat | null {
  const base = check(value);
  if (!base || !isRecord(value)) return null;
  return { ...base, maxMs: num(value['maxMs']), cycles: num(value['cycles']) };
}

/** Validates a `push-change-detection` report; null when it is not one. */
export function toCdPage(value: unknown, maxCycles: number, now = Date.now()): CdPage | null {
  if (!isRecord(value)) return null;
  const pageId = value['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const cycles = Array.isArray(value['cycles'])
    ? value['cycles']
        .slice(-Math.min(maxCycles, MAX_CYCLES))
        .map(cycle)
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
  return {
    pageId,
    supported: value['supported'] !== false,
    recording: value['recording'] === true,
    startedAt: typeof value['startedAt'] === 'number' ? value['startedAt'] : null,
    dropped: num(value['dropped']),
    cycles,
    components: components
      .slice(0, MAX_COMPONENTS)
      .map(stat)
      .filter((c): c is CdComponentStat => !!c),
    ...(droppedClasses ? { droppedClasses } : {}),
    hosts,
    ...(droppedHosts ? { droppedHosts } : {}),
    reportedAt: now,
  };
}

export function expireCdPages(
  pages: Map<string, CdPage>,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(CD_PAGE_TTL),
): boolean {
  let changed = false;
  for (const [id, page] of pages) {
    if (now - page.reportedAt > ttl(id)) {
      pages.delete(id);
      changed = true;
    }
  }
  return changed;
}

/**
 * The answer when `page` names a tab that is not connected: the shared
 * unknown-page text, listing the connected tabs. A connected tab that has not
 * recorded yet is not unknown, since `record` can start a recording there.
 * Undefined when the page is known.
 */
export function cdUnknownPageText(
  pageId: string,
  state: CdState,
  connected: Iterable<ReportingPage>,
): string | undefined {
  const pages = new Map<string, ReportingPage>();
  const all: ReportingPage[] = [...connected, ...Object.values(state.pages)];
  for (const page of all) {
    const seen = pages.get(page.pageId);
    pages.set(page.pageId, {
      pageId: page.pageId,
      url: seen?.url ?? page.url,
      reportedAt: Math.max(seen?.reportedAt ?? 0, page.reportedAt ?? 0),
    });
  }
  return pages.has(pageId)
    ? undefined
    : unknownPageText(pageId, [...pages.values()], 'change detection');
}

/** The page the change-detection tool reports: the one asked for, else recording, else latest. */
export function pickCdPage(state: CdState, pageId?: string): CdPage | undefined {
  const pages = Object.values(state.pages);
  if (pageId) return state.pages[pageId];
  return pages.find((p) => p.recording) ?? pages.sort((a, b) => b.reportedAt - a.reportedAt)[0];
}

/**
 * Agent tool note for the component classes and instances a recording checked
 * past its fixed caps, so the totals do not read as complete.
 */
export function cdCapsNote(page: Pick<CdPage, 'droppedClasses' | 'droppedHosts'>): string {
  const notes: string[] = [];
  const classes = page.droppedClasses ?? 0;
  const hosts = page.droppedHosts ?? 0;
  if (classes > 0) {
    notes.push(
      `${classes} more component ${classes === 1 ? 'class was' : 'classes were'} checked but ${classes === 1 ? 'is' : 'are'} not listed: a recording lists at most ${MAX_COMPONENTS} classes, by self time.`,
    );
  }
  if (hosts > 0) {
    notes.push(
      `${hosts} component ${hosts === 1 ? 'instance was' : 'instances were'} checked past the ${MAX_HOSTS} instances a recording counts, so ${hosts === 1 ? 'it has' : 'they have'} no check count in the component tree.`,
    );
  }
  return notes.length ? `\n\n_${notes.join(' ')}_` : '';
}

const ms = (value: number) => `${Math.round(value * 100) / 100}ms`;

/** Markdown for the `change-detection` agent tool. */
export function changeDetectionText(
  state: CdState,
  args: { page?: string; limit?: number } = {},
): string {
  const page = pickCdPage(state, args.page);
  if (!page) {
    return args.page
      ? `Page ${code(args.page)} has no change detection recording yet. Call this tool with \`record: "start"\` and this \`page\`, use the app, then call it again.`
      : 'No change detection recording yet. Call this tool with `record: "start"`, use the app, then call it again.';
  }
  if (!page.supported) {
    return `Page ${code(page.pageId)} can't record change detection: it needs Angular 20 or later in a development build.`;
  }
  // Agents send strings, NaN and null too: anything that is not a finite number is the default.
  const asked = Number(args.limit ?? 10);
  const limit = Math.max(1, Math.min(Math.floor(Number.isFinite(asked) ? asked : 10), 50));
  const status = page.recording ? 'Recording is on.' : 'Recording is off.';
  if (!page.cycles.length && !page.components.length) {
    return `${status} No change detection cycle was recorded on page ${code(page.pageId)} yet. Use the app, then call this tool again.`;
  }
  const slowest = [...page.components].sort((a, b) => b.ms - a.ms).slice(0, limit);
  const busiest = [...page.components].sort((a, b) => b.checks - a.checks).slice(0, limit);
  const totalMs = page.cycles.reduce((sum, c) => sum + c.ms, 0);
  const recent = page.cycles.slice(-limit).reverse();
  const line = (c: CdComponentStat) =>
    `- ${code(c.name)}: ${c.checks} check(s) in ${c.cycles} cycle(s), ${ms(c.ms)} in its own template and hooks (slowest ${ms(c.maxMs)})`;
  const cycleLine = (c: CdCycle) =>
    `- #${c.id}: ${ms(c.ms)}, ${c.checks} component check(s), ${c.passes} pass(es)${c.trigger ? `, after output in ${code(c.trigger)}` : ''}${
      c.components.length
        ? `; slowest ${c.components
            .slice(0, 3)
            .map((x) => `${code(x.name)} ${ms(x.ms)}`)
            .join(', ')}`
        : ''
    }`;
  return `${UNTRUSTED}\n\n${status} Page ${code(page.pageId)}: ${page.cycles.length} cycle(s) kept, ${ms(totalMs)} in total. Times are self times from Angular's profiler in a development build, so they are higher than in production.\n\n**Slowest components**\n${slowest.map(line).join('\n')}\n\n**Most often checked**\n${busiest.map(line).join('\n')}\n\n**Latest cycles**, newest first\n${recent.map(cycleLine).join('\n')}${droppedNote(page.dropped, 'cycles', 'cdCycles')}${cdCapsNote(page)}`;
}
