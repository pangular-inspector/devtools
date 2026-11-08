import { createSharedState } from 'devframe/utils/shared-state';
import {
  MAX_OUTLETS,
  MAX_PAGES,
  type IonicDirection,
  type IonicOutlet,
  type IonicReport,
  type IonicStackPage,
} from '../ionic-collector.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';
import type { AnyRecord } from '../router.ts';

export interface IonicPage extends IonicReport {
  reportedAt: number;
}

/** The `ionic` shared state, part of the Capacitor inspector. */
export interface IonicState {
  pages: Record<string, IonicPage>;
}

const DIRECTIONS: readonly string[] = ['forward', 'back', 'root'];

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value ? redactMessage(value).slice(0, max) : undefined;
}

function id(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w-]{1,60}$/.test(value) ? value : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function toStackPage(value: unknown): IonicStackPage | null {
  const page = record(value);
  const elementId = id(page['elementId']);
  const tag = text(page['tag'], 100);
  if (!elementId || !tag) return null;
  const out: IonicStackPage = {
    component: text(page['component'], 200) ?? tag,
    tag,
    active: page['active'] === true,
    elementId,
  };
  if (typeof page['url'] === 'string') out.url = redactUrl(page['url'].slice(0, 2000));
  return out;
}

function toOutlet(value: unknown): IonicOutlet | null {
  const outlet = record(value);
  const outletId = id(outlet['id']);
  if (!outletId) return null;
  const pages = (Array.isArray(outlet['pages']) ? outlet['pages'] : [])
    .slice(0, MAX_PAGES)
    .map(toStackPage)
    .filter((page): page is IonicStackPage => page !== null);
  const out: IonicOutlet = {
    id: outletId,
    name: text(outlet['name'], 100) ?? 'primary',
    source: outlet['source'] === 'dom' ? 'dom' : 'angular',
    pages,
  };
  if (typeof outlet['tabs'] === 'string' && outlet['tabs']) {
    out.tabs = redactUrl(outlet['tabs'].slice(0, 2000));
  }
  const truncated = count(outlet['truncated']);
  if (truncated) out.truncated = truncated;
  if (typeof outlet['canGoBack'] === 'boolean') out.canGoBack = outlet['canGoBack'];
  if (DIRECTIONS.includes(outlet['direction'])) {
    out.direction = outlet['direction'] as IonicDirection;
    if (outlet['directionSource'] === 'event' || outlet['directionSource'] === 'inferred') {
      out.directionSource = outlet['directionSource'];
    }
    if (typeof outlet['animated'] === 'boolean') out.animated = outlet['animated'];
    if (outlet['tabSwitch'] === true) out.tabSwitch = true;
  }
  return out;
}

/** Reads a `push-ionic` report; `null` when it is not one. Every string is redacted again. */
export function toIonicPage(message: unknown, now = Date.now()): IonicPage | null {
  const report = record(message);
  const pageId = report['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  if (!Array.isArray(report['outlets'])) return null;
  const outlets = report['outlets']
    .slice(0, MAX_OUTLETS)
    .map(toOutlet)
    .filter((outlet): outlet is IonicOutlet => outlet !== null);
  const page: IonicPage = {
    pageId,
    url: typeof report['url'] === 'string' ? redactUrl(report['url'].slice(0, 2000)) : '',
    title: text(report['title'], 200) ?? '',
    framework: report['framework'] === '@ionic/angular' ? '@ionic/angular' : '@ionic/core',
    outlets,
    reportedAt: now,
  };
  const mode = text(report['mode'], 20);
  if (mode) page.mode = mode;
  const truncated = count(report['truncatedOutlets']);
  if (truncated) page.truncatedOutlets = truncated;
  return page;
}

interface Scoped {
  rpc: { sharedState(name: string, options: AnyRecord): Promise<AnyRecord> };
}

export interface IonicHost {
  my: Scoped;
  rpcHost: unknown;
  register(definition: AnyRecord): void;
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
}

export interface IonicRegistration {
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  expire(now?: number): void;
}

/**
 * Ionic page stacks on the server, part of the Capacitor inspector: the
 * `ionic` shared state and the `push-ionic` and `forget-ionic-page` RPC
 * functions. One entry per page, dropped after the page TTL.
 */
export async function registerIonic(host: IonicHost): Promise<IonicRegistration> {
  const shared = await host.my.rpc.sharedState('ionic', {
    sharedState: createSharedState<IonicState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as IonicState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((pageId) => state().pages[pageId]);
    if (!present.length) return;
    shared['mutate']((draft: IonicState) => {
      for (const pageId of present) delete draft.pages[pageId];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-ionic',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const page = toIonicPage(message);
      if (!page || !host.owns(page.pageId)) return;
      sessions.bind(page.pageId);
      shared['mutate']((draft: IonicState) => {
        draft.pages[page.pageId] = page;
      });
    },
  });

  host.register({
    name: 'forget-ionic-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  return {
    pages: () =>
      Object.values(state().pages).map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.url,
        title: page.title,
      })),
    expire: (now = Date.now()) =>
      drop(
        Object.values(state().pages)
          .filter((page) => now - page.reportedAt > host.ttl(page.pageId))
          .map((page) => page.pageId),
      ),
  };
}
