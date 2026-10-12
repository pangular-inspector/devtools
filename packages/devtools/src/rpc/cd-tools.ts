import type { CdReport } from '../cd-overlay.ts';
import type { CdOptions } from '../config.ts';
import { sanitizeCdRecording, toCdOptions } from '../cd-data.ts';
import type { CdComponentStat, CdCycle } from '../cd-recorder.ts';
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

const MAX_COMPONENTS = 100;
const MAX_HOSTS = 2000;
export const CD_PAGE_TTL = PAGE_TTL_MS;

/** Validates a `push-change-detection` report; null when it is not one. */
export function toCdPage(value: unknown, maxCycles: number, now = Date.now()): CdPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  const pageId = report['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const recording = sanitizeCdRecording(report, maxCycles);
  if (!recording) return null;
  const options = toCdOptions(report['options']);
  return {
    pageId,
    supported: report['supported'] !== false,
    ...recording,
    ...(options ? { options } : {}),
    reportedAt: now,
  };
}

/** Whether a `change-detection` call asks to turn a view on or off. */
export function cdViewsAsked(
  args: { flash?: unknown; track?: unknown; angularProfiling?: unknown } | undefined,
): boolean {
  return (
    args?.flash !== undefined || args?.track !== undefined || args?.angularProfiling !== undefined
  );
}

/** The answer to a `change-detection` call that turns views on or off. */
export function cdViewsText(args: {
  page?: string;
  flash?: unknown;
  track?: unknown;
  angularProfiling?: unknown;
}): string {
  const where = args.page ? `for page ${code(args.page)}` : 'for every connected page';
  const lines: string[] = [];
  if (typeof args.flash === 'boolean') {
    lines.push(
      args.flash
        ? `Flash overlay turned on ${where}: each component Angular checks gets a box with its class name and how often it was checked, fading over a second.`
        : `Flash overlay turned off ${where}.`,
    );
  }
  if (typeof args.track === 'boolean') {
    lines.push(
      args.track
        ? `Performance panel track turned on ${where}: record in the Chrome DevTools Performance panel and look for the "Pangular" track. Browsers without \`console.timeStamp\` draw nothing.`
        : `Performance panel track turned off ${where}.`,
    );
  }
  if (args.angularProfiling === true) {
    lines.push(
      `Angular profiling (\`ng.enableProfiling()\`) requested ${where}. It stays on until the page reloads. Call this tool without arguments to see whether the page has it: it needs Angular 20 or later in a development build.`,
    );
  } else if (args.angularProfiling !== undefined) {
    lines.push(
      'Angular profiling cannot be turned off once it is on; reload the page to turn it off. Only `angularProfiling: true` is accepted.',
    );
  }
  if (args.flash !== undefined && typeof args.flash !== 'boolean') {
    lines.push('`flash` must be true or false.');
  }
  if (args.track !== undefined && typeof args.track !== 'boolean') {
    lines.push('`track` must be true or false.');
  }
  return lines.join('\n\n');
}

/**
 * One line on the views a page has on, for the `change-detection` answer;
 * empty when the page reported none.
 */
export function cdOptionsText(options: CdOptions | undefined): string {
  if (!options) return '';
  const on = (value: boolean) => (value ? 'on' : 'off');
  const profiling = options.angularProfiling
    ? 'on until the page reloads'
    : options.angularProfilingAvailable
      ? 'off'
      : 'not available on this page (it needs Angular 20 or later in a development build)';
  return `Live views: flash overlay ${on(options.flash)}, Performance panel track ${on(options.track)}, Angular profiling ${profiling}.`;
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

/**
 * The lifecycle hook, output listener and afterRender sections of the
 * `change-detection` answer, empty for a recording without them.
 */
export function cdTimingText(
  page: Pick<CdPage, 'hooks' | 'outputs' | 'afterRender' | 'droppedTimings'>,
  limit: number,
): string {
  const parts: string[] = [];
  if (page.hooks?.length) {
    parts.push(
      `**Lifecycle hooks**, by time (also part of the self time of the component whose view runs them)\n${page.hooks
        .slice(0, limit)
        .map(
          (h) =>
            `- ${code(`${h.name}.${h.hook}`)}: ${h.calls} call(s), ${ms(h.ms)} (slowest ${ms(h.maxMs)})`,
        )
        .join('\n')}`,
    );
  }
  if (page.outputs?.length) {
    parts.push(
      `**Output listeners**, by time\n${page.outputs
        .slice(0, limit)
        .map(
          (o) =>
            `- ${code(o.listener ? `${o.name} (${o.listener})` : o.name)}: ${o.calls} call(s), ${ms(o.ms)} (slowest ${ms(o.maxMs)})`,
        )
        .join('\n')}`,
    );
  }
  if (page.afterRender?.runs) {
    const a = page.afterRender;
    parts.push(
      `**afterRender**: ${a.runs} run(s) of the afterRender and afterNextRender callbacks, ${ms(a.ms)} in total (slowest ${ms(a.maxMs)})`,
    );
  }
  const dropped = page.droppedTimings ?? 0;
  if (dropped > 0) {
    parts.push(
      `_${dropped} more hook or output ${dropped === 1 ? 'row is' : 'rows are'} left out: a recording lists at most 100 of each, by time._`,
    );
  }
  return parts.length ? `\n\n${parts.join('\n\n')}` : '';
}

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
    `- #${c.id}: ${ms(c.ms)}, ${c.checks} component check(s), ${c.passes} pass(es)${c.trigger ? `, after output in ${code(c.trigger)}${c.outputMs ? ` (${ms(c.outputMs)})` : ''}` : ''}${c.hookMs ? `, hooks ${ms(c.hookMs)}` : ''}${c.afterRenderMs ? `, afterRender ${ms(c.afterRenderMs)}` : ''}${
      c.components.length
        ? `; slowest ${c.components
            .slice(0, 3)
            .map((x) => `${code(x.name)} ${ms(x.ms)}`)
            .join(', ')}`
        : ''
    }`;
  return `${UNTRUSTED}\n\n${status} Page ${code(page.pageId)}: ${page.cycles.length} cycle(s) kept, ${ms(totalMs)} in total. Times are self times from Angular's profiler in a development build, so they are higher than in production.\n\n**Slowest components**\n${slowest.map(line).join('\n')}\n\n**Most often checked**\n${busiest.map(line).join('\n')}${cdTimingText(page, limit)}\n\n**Latest cycles**, newest first\n${recent.map(cycleLine).join('\n')}${droppedNote(page.dropped, 'cycles', 'cdCycles')}${cdCapsNote(page)}`;
}
