// The page side of startup timing, part of the Injectors inspector: how long
// the app took from navigation to its first stable state, and which providers
// were slowest to construct.
//
// What the browser and Angular keep can be read at any time: navigation and
// paint timing, and Angular's `mark_feature_usage` performance marks, the
// first of which falls in `bootstrapApplication()`. The rest needs the
// `startup-hook` entry loaded before Angular (`startup-recorder.ts`). When the
// overlay starts before the app is stable, it watches `ApplicationRef.isStable`
// itself; otherwise it can only say the app was stable by the time it looked.

import { keepaliveDue } from './change-detection.ts';
import { angularVersionOf } from './ng-capabilities.ts';
import { redactMessage, redactUrl } from './router.ts';
import {
  applicationRefOf,
  startupBuffer,
  watchFirstStable,
  type ProviderSpan,
  type StartupBuffer,
} from './startup-recorder.ts';

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

/** Providers listed at most, slowest first. */
export const SLOWEST_PROVIDERS = 25;

export interface ProviderTiming {
  name: string;
  /** Instances created (a provider can be created once per component). */
  count: number;
  ms: number;
  /** Without the providers it created while it ran. */
  selfMs: number;
  /** When the first one was created, in ms since navigation start. */
  firstAt: number;
}

export type ProviderTimingStatus = 'measured' | 'recording' | 'needs-hook' | 'unavailable';

/** All times are in ms since navigation start. */
export interface StartupTiming {
  angularVersion?: string;
  navigation: { domContentLoaded?: number; load?: number; firstContentfulPaint?: number };
  /** When Angular started: when it published `ng` (hook), or its first feature mark. */
  angularStart?: { at: number; source: 'hook' | 'feature-mark' };
  /** The root component's creation (hook, Angular 20+). */
  bootstrapComponent?: { start: number; end: number };
  /** `exact` is false when the app already was stable at the first look. */
  firstStable?: { at: number; exact: boolean };
  overlayStart: number;
  hook: boolean;
  providers: {
    status: ProviderTimingStatus;
    note?: string;
    count: number;
    totalSelfMs: number;
    slowest: ProviderTiming[];
  };
}

export interface StartupReport extends StartupTiming {
  pageId: string;
  url?: string;
  title?: string;
}

const NEEDS_HOOK =
  'Load @pangular-inspector/devtools/startup-hook from the polyfills of the development build to time provider construction.';

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Groups spans by provider, slowest own time first. */
export function slowestProviders(
  spans: readonly ProviderSpan[],
  limit = SLOWEST_PROVIDERS,
): ProviderTiming[] {
  const byName = new Map<string, ProviderTiming>();
  for (const span of spans) {
    const name = redactMessage(span.name.replace(/^_(?=[A-Z])/, '')).slice(0, 200);
    const entry = byName.get(name);
    if (entry) {
      entry.count++;
      entry.ms += span.ms;
      entry.selfMs += span.selfMs;
      entry.firstAt = Math.min(entry.firstAt, span.at);
    } else {
      byName.set(name, { name, count: 1, ms: span.ms, selfMs: span.selfMs, firstAt: span.at });
    }
  }
  return [...byName.values()]
    .map((entry) => ({ ...entry, ms: round(entry.ms), selfMs: round(entry.selfMs) }))
    .sort((a, b) => b.selfMs - a.selfMs || b.ms - a.ms || a.firstAt - b.firstAt)
    .slice(0, limit);
}

/**
 * The last summary of each buffer, by what it depends on. Once recording is
 * done the spans stop changing, so each push reuses it instead of grouping
 * and sorting up to `MAX_PROVIDER_SPANS` spans again.
 */
const summaries = new WeakMap<StartupBuffer, { key: string; value: StartupTiming['providers'] }>();

function providerSummary(
  buffer: StartupBuffer | undefined,
  version: string | undefined,
  started: boolean,
): StartupTiming['providers'] {
  if (!buffer) return computeProviderSummary(buffer, version, started);
  const key = JSON.stringify([
    buffer.providers.length,
    buffer.providerRecording,
    buffer.providerNote ?? '',
    version ?? '',
    started,
  ]);
  const cached = summaries.get(buffer);
  if (cached?.key === key) return cached.value;
  const value = computeProviderSummary(buffer, version, started);
  summaries.set(buffer, { key, value });
  return value;
}

function computeProviderSummary(
  buffer: StartupBuffer | undefined,
  version: string | undefined,
  started: boolean,
): StartupTiming['providers'] {
  const spans = buffer?.providers ?? [];
  const totals = {
    count: spans.length,
    totalSelfMs: round(spans.reduce((sum, span) => sum + span.selfMs, 0)),
    slowest: slowestProviders(spans),
  };
  if (!buffer) return { status: 'needs-hook', note: NEEDS_HOOK, ...totals };
  const major = Number.parseInt(version ?? '', 10);
  switch (buffer.providerRecording) {
    case 'done':
      return {
        status: 'measured',
        ...(spans.length ? {} : { note: 'Angular reported no provider construction.' }),
        ...totals,
      };
    case 'recording':
      return { status: 'recording', ...totals };
    case 'unavailable':
      return { status: 'unavailable', note: buffer.providerNote, ...totals };
    default:
      // Angular started without publishing `ng.enableProfiling`.
      if (started && (!Number.isFinite(major) || major < 20)) {
        return {
          status: 'unavailable',
          note: 'Provider timing needs Angular 20 or later in a development build.',
          ...totals,
        };
      }
      return { status: 'recording', ...totals };
  }
}

export interface StartupEnv {
  doc?: Document;
  performance?: Pick<Performance, 'getEntriesByType' | 'getEntriesByName'>;
  buffer?: StartupBuffer;
}

/** What can be read about the startup right now. */
export function readStartupTiming(
  overlayStart: number,
  stable: StartupTiming['firstStable'],
  env: StartupEnv = {},
): StartupTiming {
  const doc = env.doc ?? (typeof document === 'undefined' ? undefined : document);
  const perf = env.performance ?? (typeof performance === 'undefined' ? undefined : performance);
  const buffer = env.buffer;
  const version = angularVersionOf(doc);
  const nav = read(
    () => perf?.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined,
    undefined,
  );
  const paint = read(
    () => perf?.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint'),
    undefined,
  );
  const feature = read(() => perf?.getEntriesByName('mark_feature_usage', 'mark')[0], undefined);
  const navigation: StartupTiming['navigation'] = {};
  if (nav?.domContentLoadedEventEnd) {
    navigation.domContentLoaded = round(nav.domContentLoadedEventEnd);
  }
  if (nav?.loadEventEnd) navigation.load = round(nav.loadEventEnd);
  if (paint) navigation.firstContentfulPaint = round(paint.startTime);
  const angularStart: StartupTiming['angularStart'] =
    buffer?.ngAt !== undefined
      ? { at: buffer.ngAt, source: 'hook' }
      : feature
        ? { at: round(feature.startTime), source: 'feature-mark' }
        : undefined;
  const component = buffer?.bootstrapComponent;
  const firstStable = buffer?.stable ?? stable;
  return {
    ...(version ? { angularVersion: version } : {}),
    navigation,
    ...(angularStart ? { angularStart } : {}),
    ...(component?.start !== undefined && component.end !== undefined
      ? { bootstrapComponent: { start: component.start, end: component.end } }
      : {}),
    ...(firstStable ? { firstStable } : {}),
    overlayStart,
    hook: !!buffer,
    providers: providerSummary(buffer, version, !!version),
  };
}

export interface StartupCollector {
  push(force?: boolean): Promise<void>;
  leave(): void;
  resume(): void;
  stop(): void;
}

export interface StartupOptions {
  tickMs?: () => number;
  target?: object;
  now?: () => number;
  env?: StartupEnv;
}

/** Reports the page's startup timing as `push-startup`. */
export function attachStartup(
  my: Rpc,
  pageId: string,
  getNg: () => unknown,
  options: StartupOptions = {},
): StartupCollector {
  const tickMs = options.tickMs ?? (() => 0);
  const now = options.now ?? Date.now;
  const clock = () => (typeof performance === 'undefined' ? 0 : performance.now());
  const overlayStart = round(clock());
  let stable: StartupTiming['firstStable'];
  let stopStable: (() => void) | null = null;
  let lastJson = '';
  let sentAt = 0;
  let left = false;
  let stopped = false;

  /** Watches for the first stable state until the app reports one. */
  const lookForStable = (buffer: StartupBuffer | undefined) => {
    if (stable || stopStable || buffer?.stable) return;
    const doc = options.env?.doc ?? (typeof document === 'undefined' ? undefined : document);
    const root = read(() => doc?.querySelector('[ng-version]') ?? null, null);
    const appRef = root ? applicationRefOf(getNg(), root) : null;
    if (!appRef) return;
    stopStable = watchFirstStable(
      appRef,
      (seen) => {
        stable = seen;
        void push(true).catch(() => {});
      },
      clock,
    );
  };

  const push = async (force = false) => {
    if (stopped || left) return;
    const buffer = options.env?.buffer ?? startupBuffer(options.target);
    lookForStable(buffer);
    const report: StartupReport = {
      pageId,
      ...(typeof location === 'undefined' ? {} : { url: redactUrl(location.href) }),
      ...(typeof document === 'undefined' ? {} : { title: redactMessage(document.title) }),
      ...readStartupTiming(overlayStart, stable, { ...options.env, buffer }),
    };
    const json = JSON.stringify(report);
    if (!force && json === lastJson && !keepaliveDue(sentAt, tickMs(), now())) return;
    lastJson = json;
    sentAt = now();
    try {
      await my.rpc.call('push-startup', report);
    } catch (error) {
      lastJson = '';
      throw error;
    }
  };

  return {
    push,
    leave() {
      if (left) return;
      left = true;
      lastJson = '';
      void my.rpc.call('forget-startup-page', pageId).catch(() => {});
    },
    resume() {
      left = false;
      lastJson = '';
    },
    stop() {
      stopped = true;
      stopStable?.();
      stopStable = null;
    },
  };
}
