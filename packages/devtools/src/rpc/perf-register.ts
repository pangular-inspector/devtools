import { createSharedState } from 'devframe/utils/shared-state';
import {
  MAX_INTERACTIONS,
  MAX_LONG_TASKS,
  PERF_THRESHOLDS,
  perfRating,
  type PerfInteraction,
  type PerfLongTask,
  type PerfMetric,
  type PerfMetricName,
  type PerfOwner,
  type PerfReport,
} from '../perf-collector.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { defaultPage } from './default-page.ts';
import { code, untrusted } from './forms-tools.ts';
import { PAGE_ARGUMENT, byRecency, pageArgument, unknownPageText } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';

export interface PerfPage extends PerfReport {
  reportedAt: number;
}

/** The `performance` shared state. */
export interface PerfState {
  pages: Record<string, PerfPage>;
}

const METRICS = Object.keys(PERF_THRESHOLDS) as PerfMetricName[];
const MAX_MS = 24 * 3600_000;
const ENTRY_TYPES = [
  'largest-contentful-paint',
  'paint',
  'layout-shift',
  'event',
  'longtask',
  'long-animation-frame',
];

type Loose = Record<string, unknown>;

const obj = (value: unknown): Loose =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : {};
const ms = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < MAX_MS
    ? Math.round(value * 10) / 10
    : undefined;
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value
    ? redactMessage(value.slice(0, max * 2)).slice(0, max)
    : undefined;

function owner(value: unknown): PerfOwner | undefined {
  const o = obj(value);
  const id = typeof o['id'] === 'string' && o['id'].length < 60 ? o['id'] : undefined;
  const name = text(o['name'], 200);
  return id && name ? { id, name } : undefined;
}

function metric(name: PerfMetricName, value: unknown): PerfMetric | undefined {
  const m = obj(value);
  const raw = m['value'];
  const number =
    name === 'CLS'
      ? typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw < 1000
        ? Math.round(raw * 10_000) / 10_000
        : undefined
      : ms(raw);
  if (number === undefined) return undefined;
  const target = text(m['target'], 120);
  const who = owner(m['owner']);
  const event = text(m['event'], 40);
  const at = ms(m['at']);
  return {
    value: number,
    // Rated here, so a page can't claim a poor value is good.
    rating: perfRating(name, number),
    ...(target ? { target } : {}),
    ...(who ? { owner: who } : {}),
    ...(event ? { event } : {}),
    ...(at !== undefined ? { at } : {}),
  };
}

/** Reads a `push-performance` report; `null` when it is not one. */
export function toPerfPage(message: unknown, now = Date.now()): PerfPage | null {
  const report = obj(message);
  const pageId = report['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const metrics: PerfReport['metrics'] = {};
  const rawMetrics = obj(report['metrics']);
  for (const name of METRICS) {
    const value = metric(name, rawMetrics[name]);
    if (value) metrics[name] = value;
  }
  const interactions: PerfInteraction[] = (
    Array.isArray(report['interactions']) ? report['interactions'] : []
  )
    .slice(0, MAX_INTERACTIONS)
    .flatMap((item: unknown) => {
      const i = obj(item);
      const durationMs = ms(i['durationMs']);
      const at = ms(i['at']);
      if (durationMs === undefined || at === undefined) return [];
      const target = text(i['target'], 120);
      const who = owner(i['owner']);
      return [
        {
          event: text(i['event'], 40) ?? 'event',
          durationMs,
          at,
          ...(target ? { target } : {}),
          ...(who ? { owner: who } : {}),
        },
      ];
    });
  const longTasks: PerfLongTask[] = (Array.isArray(report['longTasks']) ? report['longTasks'] : [])
    .slice(-MAX_LONG_TASKS)
    .flatMap((item: unknown) => {
      const t = obj(item);
      const durationMs = ms(t['durationMs']);
      const at = ms(t['at']);
      if (durationMs === undefined || at === undefined) return [];
      const source =
        typeof t['source'] === 'string' && t['source']
          ? redactUrl(t['source'].slice(0, 300))
          : undefined;
      return [
        {
          at,
          durationMs,
          kind: t['kind'] === 'long-animation-frame' ? 'long-animation-frame' : 'longtask',
          ...(source ? { source } : {}),
        },
      ];
    });
  const count = report['longTaskCount'];
  const url = typeof report['url'] === 'string' ? redactUrl(report['url'].slice(0, 2000)) : '';
  const title = text(report['title'], 200);
  return {
    pageId,
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    metrics,
    interactions,
    longTasks,
    longTaskCount:
      typeof count === 'number' && Number.isInteger(count) && count >= 0
        ? Math.min(count, 1_000_000)
        : longTasks.length,
    totalBlockingMs: ms(report['totalBlockingMs']) ?? 0,
    supported: (Array.isArray(report['supported']) ? report['supported'] : []).filter(
      (type: unknown): type is string => typeof type === 'string' && ENTRY_TYPES.includes(type),
    ),
    reportedAt: now,
  };
}

/** Pages with no report or heartbeat for longer than their TTL. */
export function stalePerfPages(state: PerfState, now: number, ttl: PageTtl): string[] {
  return Object.values(state.pages)
    .filter((page) => now - page.reportedAt > ttl(page.pageId))
    .map((page) => page.pageId);
}

const LABELS: Record<PerfMetricName, string> = {
  LCP: 'Largest Contentful Paint',
  CLS: 'Cumulative Layout Shift',
  INP: 'Interaction to Next Paint',
  FCP: 'First Contentful Paint',
  TTFB: 'Time to First Byte',
};

export function formatMetric(name: PerfMetricName, value: number): string {
  if (name === 'CLS') return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

const RATING_TEXT = { good: 'good', 'needs-improvement': 'needs improvement', poor: 'poor' };

/** The `web-vitals` answer. */
export function webVitalsText(state: PerfState, args: { page?: string } = {}): string {
  const pages = byRecency(Object.values(state.pages));
  if (!pages.length) {
    return 'No page reports web vitals. Open the app with the overlay loaded, in a browser that has PerformanceObserver (LCP, CLS and INP need a Chromium-based browser).';
  }
  const page = args.page ? pages.find((p) => p.pageId === args.page) : defaultPage(pages);
  if (!page) return unknownPageText(args.page!, pages, 'web vitals');
  const lines = [
    `Web vitals of page ${code(page.pageId)}${page.url ? ` (${code(page.url)})` : ''}, measured by the browser since the page loaded. Ratings use the web.dev thresholds.`,
    '',
    '| Metric | Value | Rating | Where |',
    '| --- | --- | --- | --- |',
  ];
  for (const name of METRICS) {
    const m = page.metrics[name];
    if (!m) {
      lines.push(`| ${LABELS[name]} (${name}) | none yet | | |`);
      continue;
    }
    const where = [
      m.event ? code(m.event) : '',
      m.target ? code(m.target) : '',
      m.owner ? `in ${code(m.owner.name)} (${code(m.owner.id)})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(
      `| ${LABELS[name]} (${name}) | ${formatMetric(name, m.value)} | ${RATING_TEXT[m.rating]} | ${where} |`,
    );
  }
  lines.push(
    '',
    `Long tasks: ${page.longTaskCount}, total blocking time ${formatMetric('TTFB', page.totalBlockingMs)}.`,
  );
  if (page.interactions.length) {
    lines.push(
      '',
      '### Slowest interactions',
      '',
      '| Event | Duration | At | Target |',
      '| --- | --- | --- | --- |',
    );
    for (const i of page.interactions) {
      lines.push(
        `| ${code(i.event)} | ${Math.round(i.durationMs)} ms | ${formatMetric('TTFB', i.at)} | ${i.target ? code(i.target) : ''}${i.owner ? ` in ${code(i.owner.name)}` : ''} |`,
      );
    }
  }
  if (page.longTasks.length) {
    lines.push(
      '',
      '### Latest long tasks',
      '',
      '| At | Duration | Source |',
      '| --- | --- | --- |',
    );
    for (const t of page.longTasks.slice(-10).reverse()) {
      lines.push(
        `| ${formatMetric('TTFB', t.at)} | ${Math.round(t.durationMs)} ms | ${t.source ? code(t.source) : t.kind} |`,
      );
    }
  }
  const missing = ['largest-contentful-paint', 'layout-shift', 'event'].filter(
    (type) => !page.supported.includes(type),
  );
  if (missing.length) {
    lines.push(
      '',
      `This browser does not observe ${missing.map(code).join(', ')}, so the matching metrics stay empty.`,
    );
  }
  if (pages.length > 1 && !args.page) {
    lines.push(
      '',
      `Other pages report web vitals too: ${pages
        .slice(1)
        .map((p) => code(p.pageId))
        .join(', ')}. Pass one as \`page\`.`,
    );
  }
  return untrusted(lines.join('\n'));
}

interface Scoped {
  rpc: { sharedState(name: string, options: Loose): Promise<unknown> };
}

/** devframe's RPC and agent definitions, as loose as the other inspectors take them. */
// oxlint-disable-next-line typescript/no-explicit-any
type Definition = Record<string, any>;

interface PerfShared {
  value(): PerfState;
  mutate(recipe: (draft: PerfState) => void): void;
}

export interface PerfHost {
  my: Scoped;
  rpcHost: unknown;
  register(definition: Definition): void;
  agent: { registerTool(tool: Definition): void };
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
}

export interface PerfRegistration {
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  expire(now?: number): void;
  state(): PerfState;
}

/**
 * The Performance inspector on the server: the `performance` shared state,
 * the `push-performance` and `forget-performance-page` RPC functions and the
 * `web-vitals` agent tool.
 */
export async function registerPerformance(host: PerfHost): Promise<PerfRegistration> {
  const shared = (await host.my.rpc.sharedState('performance', {
    sharedState: createSharedState<PerfState>({ initialValue: { pages: {} }, enablePatches: true }),
  })) as unknown as PerfShared;
  const state = () => shared.value();
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared.mutate((draft) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-performance',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const page = toPerfPage(message);
      if (!page || !host.owns(page.pageId)) return;
      sessions.bind(page.pageId);
      shared.mutate((draft) => {
        draft.pages[page.pageId] = page;
      });
    },
  });

  host.register({
    name: 'forget-performance-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  host.agent.registerTool({
    id: 'pangular:web-vitals',
    title: 'Show web vitals',
    description:
      "The page's web vitals as the browser measured them: LCP with its element and component, CLS, INP with the slowest interactions, FCP, TTFB, long tasks and total blocking time, each rated by the web.dev thresholds. Empty without a page.",
    inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
    handler: async (args: Definition) => ({
      markdown: webVitalsText(state(), { page: pageArgument(args) }),
    }),
  });

  return {
    pages: () =>
      Object.values(state().pages).map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.url,
        title: page.title,
      })),
    state,
    expire: (now = Date.now()) => drop(stalePerfPages(state(), now, host.ttl)),
  };
}
