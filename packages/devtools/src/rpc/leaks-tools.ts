import { defaultPage } from './default-page.ts';
import { RETAINED_AFTER_MS, RETAINED_AFTER_NAVIGATIONS } from '../config.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import { code, untrusted } from './forms-tools.ts';
import { byRecency, unknownPageText } from './pages.ts';

export { RETAINED_AFTER_MS, RETAINED_AFTER_NAVIGATIONS };

/** Live components a report lists, those with the most effects and subscriptions first. */
export const MAX_LEAK_COMPONENTS = 200;
/** Destroyed instances a report lists, oldest first. */
export const MAX_LEAK_DESTROYED = 100;
/** Open subscriptions after destroy a report lists. */
export const MAX_LEAK_SUBSCRIPTIONS = 100;
const MAX_NAME = 120;
const MAX_ROUTE = 300;
const MAX_SOURCE = 300;
const MAX_ID = 40;

/** Whether subscription tracking runs on the page. */
export type SubscriptionTracking = 'off' | 'on' | 'unavailable';

/**
 * Whether retained instances can be listed. `true`: `WeakRef`,
 * `FinalizationRegistry` and `ng.getComponent` are there. `false`: one is
 * missing. `'dev-di-debug'`: the page's Angular (16.2+ development build, seen
 * by `ng.ɵgetInjectorProviders`) keeps DI debug data that holds every
 * destroyed component, so a retained instance says nothing; only detached
 * views are listed.
 */
export type LeakRetention = boolean | 'dev-di-debug';

/** One component on the page with its live effects and tracked open subscriptions. */
export interface LeakComponent {
  /** The host element id, the same one the Components tab and `inspect-component` use. */
  id: string;
  name: string;
  /** Effects Angular's signal graph lists for this component only. */
  effects: number;
  /**
   * Effects Angular files under the view the host sits in, which components
   * side by side in one template share, so they can't be told apart.
   */
  sharedEffects?: number;
  /** Open subscriptions made by this instance while tracking was on. */
  subscriptions: number;
}

/** A component instance that left the page and was not garbage collected yet. */
export interface LeakDestroyed {
  id: string;
  name: string;
  /** The page's path and query when the instance was destroyed, masked. */
  route: string;
  /** The page clock when it was destroyed. */
  destroyedAt: number;
  /** Navigations on the page since then. */
  navigations: number;
  /**
   * Angular still holds the view, so it was detached rather than destroyed,
   * as a `RouteReuseStrategy` or a portal does on purpose.
   */
  detached?: boolean;
  /** Subscriptions it made that are still open. */
  subscriptions?: number;
}

/** A subscription a component made that is still open after the component went away. */
export interface LeakSubscription {
  /** The component class whose code made it, from the call stack. */
  name: string;
  /** The instance, when the subscription was made inside its hooks, template or listeners. */
  instanceId?: string;
  /** How many open subscriptions share this class, instance and call site. */
  count: number;
  /** The first call site in the component, masked. */
  source?: string;
  route: string;
  openedAt: number;
  /**
   * `instance-destroyed`: its instance is gone; `no-live-instance`: the class
   * has no instance on the page any more, and one was destroyed since it opened.
   */
  reason: 'instance-destroyed' | 'no-live-instance';
}

/** What a page pushes, in full each time. */
export interface LeaksReport {
  pageId: string;
  url: string;
  title: string;
  /** The page clock when the report was made, to turn its times into ages. */
  at: number;
  support: {
    retention: LeakRetention;
    /** `ng.ɵgetSignalGraph` is there, so effects can be counted. */
    effects: boolean;
    subscriptions: SubscriptionTracking;
    /** Subscriptions are tied to instances through Angular's profiler (20.0+), not only to classes. */
    instances?: boolean;
    /** Destroyed and detached views can be told apart (Angular 14+). */
    detached?: boolean;
  };
  /** Navigations the page saw since the overlay started. */
  navigations: number;
  totals: {
    components: number;
    effects: number;
    /** Open subscriptions tied to a component, tracked while tracking was on. */
    subscriptions: number;
    /** Destroyed instances the page still tracks (not collected yet), listed or not. */
    destroyed: number;
    /** Destroyed instances the garbage collector freed since the overlay started. */
    collected: number;
    /** Destroyed instances the page stopped tracking to stay under its cap. */
    dropped: number;
  };
  components: LeakComponent[];
  destroyed: LeakDestroyed[];
  subscriptions: LeakSubscription[];
}

export interface LeaksPageView extends LeaksReport {
  reportedAt: number;
}

export interface LeaksState {
  pages: Record<string, LeaksPageView>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const count = (value: unknown) => Math.max(0, Math.floor(num(value)));
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? clip(redactText(value), max) : '';
const id = (value: unknown) => (typeof value === 'string' ? clip(value, MAX_ID) : '');

function list<T>(value: unknown, map: (item: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, max)
    .map(map)
    .filter((item): item is T => item !== null);
}

function toComponent(value: unknown): LeakComponent | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  return {
    id: id(value['id']),
    name: text(value['name'], MAX_NAME) || '?',
    effects: count(value['effects']),
    subscriptions: count(value['subscriptions']),
    ...(count(value['sharedEffects']) ? { sharedEffects: count(value['sharedEffects']) } : {}),
  };
}

const toRetention = (value: unknown): LeakRetention =>
  value === true ? true : value === 'dev-di-debug' ? 'dev-di-debug' : false;

function toDestroyed(value: unknown): LeakDestroyed | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  const subscriptions = count(value['subscriptions']);
  return {
    id: id(value['id']),
    name: text(value['name'], MAX_NAME) || '?',
    route: typeof value['route'] === 'string' ? clip(redactUrl(value['route']), MAX_ROUTE) : '',
    destroyedAt: num(value['destroyedAt']),
    navigations: count(value['navigations']),
    ...(value['detached'] === true ? { detached: true } : {}),
    ...(subscriptions ? { subscriptions } : {}),
  };
}

function toSubscription(value: unknown): LeakSubscription | null {
  if (!isRecord(value) || typeof value['name'] !== 'string') return null;
  const reason =
    value['reason'] === 'instance-destroyed' ? 'instance-destroyed' : 'no-live-instance';
  const instanceId = id(value['instanceId']);
  const source = text(value['source'], MAX_SOURCE);
  return {
    name: text(value['name'], MAX_NAME) || '?',
    count: Math.max(1, count(value['count'])),
    route: typeof value['route'] === 'string' ? clip(redactUrl(value['route']), MAX_ROUTE) : '',
    openedAt: num(value['openedAt']),
    reason,
    ...(instanceId ? { instanceId } : {}),
    ...(source ? { source } : {}),
  };
}

/** Checks and masks a pushed report again on the server; `null` when it is not one. */
export function toLeaksReport(message: unknown): LeaksReport | null {
  if (!isRecord(message) || typeof message['pageId'] !== 'string' || !message['pageId']) {
    return null;
  }
  if (message['pageId'].length > 64) return null;
  const support = isRecord(message['support']) ? message['support'] : {};
  const totals = isRecord(message['totals']) ? message['totals'] : {};
  const tracking = support['subscriptions'];
  const retention = toRetention(support['retention']);
  const destroyed = list(message['destroyed'], toDestroyed, MAX_LEAK_DESTROYED);
  return {
    pageId: message['pageId'],
    url: typeof message['url'] === 'string' ? redactUrl(message['url']) : '',
    title: typeof message['title'] === 'string' ? redactMessage(message['title']) : '',
    at: num(message['at'], Date.now()),
    support: {
      retention,
      effects: support['effects'] === true,
      subscriptions: tracking === 'on' || tracking === 'unavailable' ? tracking : 'off',
      ...(support['instances'] === true ? { instances: true } : {}),
      ...(support['detached'] === true ? { detached: true } : {}),
    },
    navigations: count(message['navigations']),
    totals: {
      components: count(totals['components']),
      effects: count(totals['effects']),
      subscriptions: count(totals['subscriptions']),
      destroyed: count(totals['destroyed']),
      collected: count(totals['collected']),
      dropped: count(totals['dropped']),
    },
    components: list(message['components'], toComponent, MAX_LEAK_COMPONENTS),
    // Instances Angular's DI debug data keeps prove nothing; detached views still do.
    destroyed: retention === 'dev-di-debug' ? destroyed.filter((item) => item.detached) : destroyed,
    subscriptions: list(message['subscriptions'], toSubscription, MAX_LEAK_SUBSCRIPTIONS),
  };
}

/** The pages that stopped reporting, to drop. */
export function staleLeakPages(
  state: LeaksState,
  now: number,
  ttl: (pageId: string) => number,
): string[] {
  return Object.values(state.pages)
    .filter((page) => now - page.reportedAt > ttl(page.pageId))
    .map((page) => page.pageId);
}

/** How long ago a destroyed instance went, on the server's clock. */
export function destroyedAge(page: LeaksPageView, item: LeakDestroyed, now = Date.now()): number {
  return Math.max(0, now - page.reportedAt + (page.at - item.destroyedAt));
}

/** Destroyed, not collected, and outlived enough navigations and time to be worth a look. */
export function isRetained(page: LeaksPageView, item: LeakDestroyed, now = Date.now()): boolean {
  return (
    !item.detached &&
    item.navigations >= RETAINED_AFTER_NAVIGATIONS &&
    destroyedAge(page, item, now) >= RETAINED_AFTER_MS
  );
}

/** Which page a `page` argument names, or `pageId` as it is when the request names one. */
export function leakTrackingRequest(
  message: unknown,
  pages: Iterable<{ pageId: string; reportedAt: number }>,
): { pageId?: string; on: boolean } {
  const record = isRecord(message) ? message : undefined;
  const on = record ? record['on'] !== false : message !== false;
  const asked = record?.['pageId'];
  if (typeof asked === 'string' && asked.length > 0 && asked.length < 64) {
    return { pageId: asked, on };
  }
  if (!on) return { on };
  const latest = defaultPage(pages);
  return latest ? { pageId: latest.pageId, on } : { on };
}

const NO_PAGE =
  'No page reports leak data. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser and the overlay loaded.';

/** Why `find-leaks` lists no retained instance on a page whose Angular keeps them all. */
const DEV_DI_DEBUG =
  "Not available on this page. In a development build Angular's DI debug data (the injector profiler records behind `ng.ɵgetInjectorProviders`, Angular 16.2 and later) keeps every destroyed component in memory, and its children through its view, so Pangular can't tell a leak from that. Check retainers in the Chrome DevTools Memory panel: take a heap snapshot after a few navigations, search for the class, and look for a retainer other than Angular's DI debug records. Open subscriptions after destroy, detached views and live effects are still reported below.";

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 120) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function trackingNote(page: LeaksPageView): string {
  if (page.support.subscriptions === 'on') {
    return page.support.instances
      ? 'Subscription tracking is on.'
      : 'Subscription tracking is on; without Angular 20 profiler hooks subscriptions are tied to component classes only.';
  }
  if (page.support.subscriptions === 'unavailable') {
    return 'Subscription tracking could not start: the page has no RxJS the overlay can load.';
  }
  return 'Subscription tracking is off, so subscriptions are not counted. Turn it on with pangular:track-subscriptions or the Track subscriptions button in the Components panel; it wraps `Observable.prototype.subscribe` until it is turned off.';
}

/** `find-leaks`: retained instances, open subscriptions after destroy, and live effects and subscriptions per component. */
export function findLeaksText(
  state: LeaksState,
  args: { page?: string; component?: string; limit?: unknown } = {},
  now = Date.now(),
): string {
  const pages = byRecency(Object.values(state.pages));
  if (args.page && !state.pages[args.page]) {
    return unknownPageText(args.page, pages, 'leak data');
  }
  const page = args.page ? state.pages[args.page]! : defaultPage(pages);
  if (!page) return NO_PAGE;
  const limit = Math.min(Math.max(Math.floor(num(args.limit, 20)), 1), MAX_LEAK_COMPONENTS);
  const wanted = args.component?.trim().toLowerCase();
  const match = (name: string) => !wanted || name.toLowerCase().includes(wanted);
  const out: string[] = [];
  if (pages.length > 1 && !args.page) {
    out.push(
      `Page ${code(page.pageId)}; ${pages.length} pages report leak data, pass \`page\` to pick another.`,
    );
  }
  const destroyed = page.destroyed.filter((item) => match(item.name));
  const detached = destroyed.filter((item) => item.detached);
  if (page.support.retention === 'dev-di-debug') {
    out.push(`## Still retained\n\n${DEV_DI_DEBUG}`);
  } else {
    if (!page.support.retention) {
      out.push(
        'This page cannot track destroyed components: it needs `WeakRef`, `FinalizationRegistry` and the Angular debug API (a development build).',
      );
    }
    const retained = destroyed.filter((item) => isRetained(page, item, now));
    const recent = destroyed.filter((item) => !item.detached && !isRetained(page, item, now));
    out.push(
      `## Still retained\n\n${page.navigations} navigations on this page so far. ${page.totals.collected} destroyed instances were garbage collected since the overlay started. Garbage collection runs when the browser decides, so an instance listed here is not proof of a leak: it is still in memory after at least ${RETAINED_AFTER_NAVIGATIONS} navigations and ${RETAINED_AFTER_MS / 1000} seconds. Take a heap snapshot in the Chrome DevTools Memory panel, search for the class, and read its retainers to see what holds it.`,
    );
    if (retained.length) {
      const rows = retained.slice(0, limit).map((item) => {
        const subs = item.subscriptions ? String(item.subscriptions) : '';
        return `| ${code(item.name)} | ${code(item.id)} | ${code(item.route || '/')} | ${duration(destroyedAge(page, item, now))} | ${item.navigations} | ${subs} |`;
      });
      out.push(
        `| Class | Instance | Route when destroyed | Age | Navigations since | Open subscriptions |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}${retained.length > limit ? `\n\n${retained.length - limit} more; raise \`limit\`.` : ''}`,
      );
    } else {
      out.push('No destroyed component is still retained after enough navigations.');
    }
    if (recent.length) {
      out.push(
        `${plural(recent.length, 'instance was', 'instances were')} destroyed recently and not collected yet: ${recent
          .slice(0, 10)
          .map((item) => code(item.name))
          .join(', ')}. Navigate a few times and ask again.`,
      );
    }
  }
  if (detached.length) {
    out.push(
      `${plural(detached.length, 'instance is', 'instances are')} off the page but not destroyed (detached views, such as a \`RouteReuseStrategy\` cache): ${detached
        .slice(0, 10)
        .map((item) => code(item.name))
        .join(', ')}.`,
    );
  }
  if (page.totals.dropped && page.support.retention !== 'dev-di-debug') {
    out.push(
      `${page.totals.dropped} older destroyed instances are no longer tracked, to stay under the page's cap.`,
    );
  }

  out.push(`## Open subscriptions after destroy\n\n${trackingNote(page)}`);
  const subs = page.subscriptions.filter((item) => match(item.name));
  if (subs.length) {
    const rows = subs.slice(0, limit).map((item) => {
      const reason =
        item.reason === 'instance-destroyed' ? 'its instance is destroyed' : 'no instance left';
      return `| ${code(item.name)} | ${item.instanceId ? code(item.instanceId) : ''} | ${item.count} | ${reason} | ${item.source ? cell(code(item.source)) : ''} |`;
    });
    out.push(
      `These subscriptions are still open although the component that made them is gone. Each one keeps its callback, and what the callback uses, alive until the source completes. Tear them down with \`takeUntilDestroyed()\`, \`DestroyRef.onDestroy\` or the \`async\` pipe.\n\n| Class | Instance | Open | Why flagged | Made at |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`,
    );
  } else if (page.support.subscriptions === 'on') {
    out.push('No subscription is still open after its component went away.');
  }

  const live = page.components
    .filter(
      (item) => match(item.name) && (item.effects || item.sharedEffects || item.subscriptions),
    )
    .slice(0, limit);
  const effectsNote = page.support.effects
    ? ''
    : ' Effects are not counted: the page has no `ng.ɵgetSignalGraph` (Angular 19.1+ development builds).';
  out.push(
    `## Live effects and subscriptions\n\n${page.totals.components} components on the page with ${plural(page.totals.effects, 'live effect')} and ${plural(page.totals.subscriptions, 'tracked open subscription')}.${effectsNote}`,
  );
  if (live.length) {
    const rows = live.map(
      (item) =>
        `| ${code(item.name)} | ${code(item.id)} | ${item.effects}${item.sharedEffects ? ` (+${item.sharedEffects} shared)` : ''} | ${page.support.subscriptions === 'on' ? item.subscriptions : ''} |`,
    );
    out.push(
      `Pass an instance id to pangular:inspect-component for its details. Angular files a component's effects under the template its host sits in, so effects of components side by side in one template are counted as shared.\n\n| Component | Instance | Effects | Subscriptions |\n| --- | --- | --- | --- |\n${rows.join('\n')}`,
    );
  }
  return untrusted(out.join('\n\n'));
}

/** The answer of `track-subscriptions`. */
export function trackSubscriptionsText(
  request: { pageId?: string; on: boolean },
  pages: number,
): string {
  if (request.on && !pages) {
    return 'No page reports leak data, so there is nothing to track. Open the app with the overlay loaded and try again.';
  }
  if (request.on) {
    return `Tracking subscriptions on page ${code(request.pageId ?? '?')}. The overlay wraps \`Observable.prototype.subscribe\` and records which component makes each subscription, until tracking is turned off. Subscriptions made before now are not seen, so reload the page or navigate to the screen again, then call pangular:find-leaks.`;
  }
  return request.pageId
    ? `Stopped tracking subscriptions on page ${code(request.pageId)}; \`Observable.prototype.subscribe\` is restored.`
    : 'Stopped tracking subscriptions on every page; `Observable.prototype.subscribe` is restored.';
}
