// Web vitals and long tasks of the page, read from the browser's own
// PerformanceObserver entries: Largest Contentful Paint, Cumulative Layout
// Shift, Interaction to Next Paint, First Contentful Paint, Time to First
// Byte, and long tasks (or long animation frames where the browser has them).
// It only observes: nothing runs on a timer, and the report goes out with the
// overlay's regular pushes, skipped while it is unchanged.

import { keepaliveDue } from './change-detection.ts';
import { elementId } from './element-id.ts';
import { className } from './injector-tree.ts';
import { outsideAngular } from './outside-angular.ts';
import { redactMessage, redactUrl } from './router.ts';

export type PerfRating = 'good' | 'needs-improvement' | 'poor';
export type PerfMetricName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';

/** Thresholds from web.dev: at or under the first is good, over the second is poor. */
export const PERF_THRESHOLDS: Record<PerfMetricName, readonly [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export function perfRating(name: PerfMetricName, value: number): PerfRating {
  const [good, poor] = PERF_THRESHOLDS[name];
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

/** The component an element belongs to, by the ids the Components tab uses. */
export interface PerfOwner {
  id: string;
  name: string;
}

export interface PerfMetric {
  /** Milliseconds, or a unitless score for CLS. */
  value: number;
  rating: PerfRating;
  /** LCP: the element; INP: the event target. A tag with its id or first class. */
  target?: string;
  owner?: PerfOwner;
  /** INP: the event type, such as `click`. */
  event?: string;
  /** When it happened, ms from navigation start. */
  at?: number;
}

export interface PerfInteraction {
  event: string;
  durationMs: number;
  at: number;
  target?: string;
  owner?: PerfOwner;
}

export interface PerfLongTask {
  at: number;
  durationMs: number;
  /** `longtask` or `long-animation-frame`. */
  kind: string;
  /** The script that ran longest in a long animation frame, when the browser names it. */
  source?: string;
}

export interface PerfReport {
  pageId: string;
  url?: string;
  title?: string;
  metrics: Partial<Record<PerfMetricName, PerfMetric>>;
  /** The slowest interactions, slowest first. */
  interactions: PerfInteraction[];
  /** The latest long tasks, newest last. */
  longTasks: PerfLongTask[];
  longTaskCount: number;
  /** Sum of each long task's time over 50 ms. */
  totalBlockingMs: number;
  /** Entry types this browser observes; a missing one explains a missing metric. */
  supported: string[];
}

export const MAX_INTERACTIONS = 10;
export const MAX_LONG_TASKS = 20;

/** The part of `ng` the owner lookup reads. */
export interface PerfDebugNg {
  getOwningComponent?(el: Element): unknown;
  getHostElement?(component: object): Element | null;
}

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

/** What a PerformanceObserver entry has; jsdom and older browsers lack most types. */
export interface PerfEntry {
  entryType: string;
  name?: string;
  startTime: number;
  duration: number;
  value?: number;
  hadRecentInput?: boolean;
  interactionId?: number;
  element?: Element | null;
  target?: Node | null;
  renderTime?: number;
  loadTime?: number;
  responseStart?: number;
  scripts?: { sourceURL?: string; invoker?: string; duration?: number }[];
}

export interface PerfEnv {
  /** Subscribes to entries of one type; returns the stop function, or null when unsupported. */
  observe(type: string, onEntries: (entries: PerfEntry[]) => void): (() => void) | null;
  /** Entries the browser already has, such as the navigation entry. */
  entries(type: string): PerfEntry[];
}

const round = (value: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

function browserEnv(): PerfEnv {
  return {
    observe(type, onEntries) {
      if (typeof PerformanceObserver === 'undefined') return null;
      const types = (PerformanceObserver as { supportedEntryTypes?: readonly string[] })
        .supportedEntryTypes;
      if (!types?.includes(type)) return null;
      try {
        // Created outside the Angular zone, so an entry never makes a zone.js app tick.
        const observer = outsideAngular(
          () =>
            new PerformanceObserver((list) =>
              onEntries(list.getEntries() as unknown as PerfEntry[]),
            ),
        );
        const options: PerformanceObserverInit & { durationThreshold?: number } = {
          type,
          buffered: true,
        };
        // Interactions of 40 ms and more, the floor the spec allows; INP is about slow ones.
        if (type === 'event') options.durationThreshold = 40;
        observer.observe(options);
        return () => observer.disconnect();
      } catch {
        return null;
      }
    },
    entries(type) {
      try {
        return performance.getEntriesByType(type) as unknown as PerfEntry[];
      } catch {
        return [];
      }
    },
  };
}

/** A short label for an element: its tag with the id, else the first class. */
export function describeElement(el: unknown): string | undefined {
  if (!el || typeof el !== 'object' || !('tagName' in el)) return undefined;
  const element = el as Element;
  const tag = String(element.tagName).toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const cls = !id && element.classList?.length ? `.${element.classList[0]}` : '';
  return redactMessage(`${tag}${id}${cls}`).slice(0, 120);
}

/**
 * Collects the page's web vitals. Each `push()` sends the report when it
 * changed (or the page heartbeat says the server lost it).
 */
export function attachPerformance(
  my: Rpc,
  pageId: string,
  getNg: () => PerfDebugNg | undefined,
  options: { tickMs?: () => number; now?: () => number; env?: PerfEnv } = {},
) {
  const env = options.env ?? browserEnv();
  const tickMs = options.tickMs ?? (() => 0);
  const now = options.now ?? Date.now;
  let lcp: PerfMetric | undefined;
  let fcp: number | undefined;
  // CLS: the largest session window of shifts less than 1 s apart and at most 5 s long.
  let cls = 0;
  let session = 0;
  let sessionStart = -Infinity;
  let lastShift = -Infinity;
  const interactions = new Map<number, PerfInteraction>();
  const longTasks: PerfLongTask[] = [];
  let longTaskCount = 0;
  let totalBlockingMs = 0;
  const supported: string[] = [];
  let lastJson = '';
  let sentAt = 0;
  let left = false;

  const ownerOf = (el: unknown): PerfOwner | undefined => {
    const ng = getNg();
    if (!ng?.getOwningComponent || !ng.getHostElement || !el || typeof el !== 'object') {
      return undefined;
    }
    try {
      const component = ng.getOwningComponent(el as Element);
      if (!component || typeof component !== 'object') return undefined;
      const host = ng.getHostElement(component);
      if (!host) return undefined;
      return { id: elementId(host), name: className((component as object).constructor) };
    } catch {
      return undefined;
    }
  };

  const handlers: Record<string, (entries: PerfEntry[]) => void> = {
    'largest-contentful-paint': (entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      const value = round(entry.renderTime || entry.loadTime || entry.startTime);
      const target = describeElement(entry.element);
      const owner = ownerOf(entry.element);
      lcp = {
        value,
        rating: perfRating('LCP', value),
        at: value,
        ...(target ? { target } : {}),
        ...(owner ? { owner } : {}),
      };
    },
    paint: (entries) => {
      const entry = entries.find((e) => e.name === 'first-contentful-paint');
      if (entry) fcp = round(entry.startTime);
    },
    'layout-shift': (entries) => {
      for (const entry of entries) {
        if (entry.hadRecentInput || typeof entry.value !== 'number') continue;
        const at = entry.startTime;
        if (at - lastShift < 1000 && at - sessionStart < 5000) session += entry.value;
        else {
          session = entry.value;
          sessionStart = at;
        }
        lastShift = at;
        cls = Math.max(cls, session);
      }
    },
    event: (entries) => {
      for (const entry of entries) {
        if (!entry.interactionId) continue;
        const known = interactions.get(entry.interactionId);
        if (known && known.durationMs >= entry.duration) continue;
        const target = describeElement(entry.target);
        const owner = ownerOf(entry.target);
        interactions.set(entry.interactionId, {
          event: String(entry.name ?? 'event').slice(0, 40),
          durationMs: round(entry.duration),
          at: round(entry.startTime),
          ...(target ? { target } : {}),
          ...(owner ? { owner } : {}),
        });
      }
      // Keeps the map small: only the slowest interactions can be INP.
      if (interactions.size > 200) {
        const keep = [...interactions].sort((a, b) => b[1].durationMs - a[1].durationMs);
        interactions.clear();
        for (const [id, value] of keep.slice(0, 100)) interactions.set(id, value);
      }
    },
    // Before `longtask`, so a browser with both reports frames only.
    'long-animation-frame': (entries) => addLongTasks(entries, 'long-animation-frame'),
    longtask: (entries) => addLongTasks(entries, 'longtask'),
  };

  function addLongTasks(entries: PerfEntry[], kind: string) {
    for (const entry of entries) {
      longTaskCount++;
      totalBlockingMs += Math.max(0, entry.duration - 50);
      const script = entry.scripts
        ?.slice()
        .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
      const source = script?.sourceURL || script?.invoker;
      longTasks.push({
        at: round(entry.startTime),
        durationMs: round(entry.duration),
        kind,
        ...(source ? { source: redactUrl(String(source)).slice(0, 300) } : {}),
      });
      if (longTasks.length > MAX_LONG_TASKS) longTasks.shift();
    }
  }

  const stops: (() => void)[] = [];
  for (const [type, handler] of Object.entries(handlers)) {
    // Long animation frames say more than long tasks; with both, only frames count.
    if (type === 'longtask' && supported.includes('long-animation-frame')) continue;
    const stop = env.observe(type, (entries) => {
      try {
        handler(entries);
      } catch {
        // A malformed entry never breaks the page.
      }
    });
    if (stop) {
      stops.push(stop);
      supported.push(type);
    }
  }

  const ttfb = (): number | undefined => {
    const nav = env.entries('navigation')[0];
    const value = nav?.responseStart;
    return typeof value === 'number' && value > 0 ? round(value) : undefined;
  };

  const inp = (): PerfMetric | undefined => {
    const all = [...interactions.values()].sort((a, b) => b.durationMs - a.durationMs);
    if (!all.length) return undefined;
    // The 98th percentile: skip one of the slowest per 50 interactions.
    const worst = all[Math.min(all.length - 1, Math.floor(interactions.size / 50))]!;
    return {
      value: worst.durationMs,
      rating: perfRating('INP', worst.durationMs),
      event: worst.event,
      at: worst.at,
      ...(worst.target ? { target: worst.target } : {}),
      ...(worst.owner ? { owner: worst.owner } : {}),
    };
  };

  const report = (): PerfReport => {
    const metrics: PerfReport['metrics'] = {};
    if (lcp) metrics.LCP = lcp;
    if (supported.includes('layout-shift')) {
      metrics.CLS = { value: round(cls, 4), rating: perfRating('CLS', cls) };
    }
    const interaction = inp();
    if (interaction) metrics.INP = interaction;
    if (fcp !== undefined) metrics.FCP = { value: fcp, rating: perfRating('FCP', fcp), at: fcp };
    const firstByte = ttfb();
    if (firstByte !== undefined) {
      metrics.TTFB = { value: firstByte, rating: perfRating('TTFB', firstByte), at: firstByte };
    }
    return {
      pageId,
      ...(typeof location === 'undefined'
        ? {}
        : { url: redactUrl(location.pathname + location.search) }),
      ...(typeof document === 'undefined' ? {} : { title: redactMessage(document.title) }),
      metrics,
      interactions: [...interactions.values()]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, MAX_INTERACTIONS),
      longTasks: [...longTasks],
      longTaskCount,
      totalBlockingMs: round(totalBlockingMs),
      supported: [...supported],
    };
  };

  const push = async () => {
    if (left) return;
    const next = report();
    const json = JSON.stringify(next);
    if (json === lastJson && !keepaliveDue(sentAt, tickMs(), now())) return;
    lastJson = json;
    sentAt = now();
    try {
      await my.rpc.call('push-performance', next);
    } catch (error) {
      lastJson = '';
      throw error;
    }
  };

  return {
    push,
    /** The report as it would go out, for tests. */
    report,
    leave() {
      if (left) return;
      left = true;
      lastJson = '';
      void my.rpc.call('forget-performance-page', pageId).catch(() => {});
    },
    resume() {
      left = false;
      lastJson = '';
    },
    stop() {
      for (const stop of stops.splice(0)) stop();
    },
  };
}
