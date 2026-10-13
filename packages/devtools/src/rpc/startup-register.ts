import { createSharedState } from 'devframe/utils/shared-state';
import { redactMessage, redactUrl } from '../router.ts';
import type {
  ProviderTiming,
  ProviderTimingStatus,
  StartupReport,
  StartupTiming,
} from '../startup-timing.ts';
import { code, untrusted } from './forms-tools.ts';
import { PAGE_ARGUMENT, byRecency, pageArgument, unknownPageText } from './pages.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';

type AnyRecord = Record<string, any>;

export interface StartupPage extends StartupReport {
  reportedAt: number;
}

/** The `startup` shared state. */
export interface StartupState {
  pages: Record<string, StartupPage>;
}

const STATUSES: readonly ProviderTimingStatus[] = [
  'measured',
  'recording',
  'needs-hook',
  'unavailable',
];
const MAX_MS = 24 * 3600_000;

function ms(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < MAX_MS
    ? Math.round(value * 10) / 10
    : undefined;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value ? redactMessage(value).slice(0, max) : undefined;
}

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

/** Reads a `push-startup` report; `null` when it is not one. */
export function toStartupPage(message: unknown, now = Date.now()): StartupPage | null {
  const report = record(message);
  const pageId = report['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const overlayStart = ms(report['overlayStart']);
  if (overlayStart === undefined) return null;
  const nav = record(report['navigation']);
  const navigation: StartupTiming['navigation'] = {};
  for (const key of ['domContentLoaded', 'load', 'firstContentfulPaint'] as const) {
    const value = ms(nav[key]);
    if (value !== undefined) navigation[key] = value;
  }
  const start = record(report['angularStart']);
  const startAt = ms(start['at']);
  const component = record(report['bootstrapComponent']);
  const componentStart = ms(component['start']);
  const componentEnd = ms(component['end']);
  const stable = record(report['firstStable']);
  const stableAt = ms(stable['at']);
  const providers = record(report['providers']);
  const status = STATUSES.includes(providers['status'])
    ? (providers['status'] as ProviderTimingStatus)
    : 'unavailable';
  const slowest: ProviderTiming[] = (
    Array.isArray(providers['slowest']) ? providers['slowest'] : []
  )
    .slice(0, 50)
    .flatMap((item: unknown) => {
      const entry = record(item);
      const name = text(entry['name'], 200);
      const total = ms(entry['ms']);
      const self = ms(entry['selfMs']);
      const firstAt = ms(entry['firstAt']);
      const count = entry['count'];
      if (!name || total === undefined || self === undefined || firstAt === undefined) return [];
      return [
        {
          name,
          count: typeof count === 'number' && Number.isInteger(count) && count > 0 ? count : 1,
          ms: total,
          selfMs: self,
          firstAt,
        },
      ];
    });
  const version = text(report['angularVersion'], 40);
  const note = text(providers['note'], 300);
  const url = typeof report['url'] === 'string' ? redactUrl(report['url'].slice(0, 2000)) : '';
  const title = text(report['title'], 200);
  return {
    pageId,
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(version ? { angularVersion: version } : {}),
    navigation,
    ...(startAt !== undefined
      ? {
          angularStart: {
            at: startAt,
            source: start['source'] === 'hook' ? 'hook' : 'feature-mark',
          },
        }
      : {}),
    ...(componentStart !== undefined && componentEnd !== undefined
      ? { bootstrapComponent: { start: componentStart, end: componentEnd } }
      : {}),
    ...(stableAt !== undefined
      ? { firstStable: { at: stableAt, exact: stable['exact'] === true } }
      : {}),
    overlayStart,
    hook: report['hook'] === true,
    providers: {
      status,
      ...(note ? { note } : {}),
      count: Number.isInteger(providers['count']) ? Math.max(0, providers['count']) : 0,
      totalSelfMs: ms(providers['totalSelfMs']) ?? 0,
      slowest,
    },
    reportedAt: now,
  };
}

function format(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(1)} ms`;
}

/** The `startup-timing` answer. */
export function startupTimingText(
  state: StartupState,
  args: { page?: string; limit?: unknown } = {},
): string {
  const pages = byRecency(Object.values(state.pages));
  if (!pages.length) {
    return 'No page reports its startup timing. Open the app with the overlay loaded. For provider construction times, load `@pangular-inspector/devtools/startup-hook` from the polyfills of the development build.';
  }
  const page = args.page ? pages.find((p) => p.pageId === args.page) : pages[0];
  if (!page) return unknownPageText(args.page!, pages, 'startup timing');
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.round(args.limit)))
      : 10;
  const lines = [
    `Startup of page ${code(page.pageId)}${page.url ? ` (${code(page.url)})` : ''}${page.angularVersion ? `, Angular ${page.angularVersion}` : ''}. Times are from navigation start.`,
    '',
    '| Milestone | At | Source |',
    '| --- | --- | --- |',
  ];
  const row = (label: string, at: number | undefined, source: string) => {
    if (at !== undefined) lines.push(`| ${label} | ${format(at)} | ${source} |`);
  };
  row('DOM content loaded', page.navigation.domContentLoaded, 'navigation timing');
  row('First contentful paint', page.navigation.firstContentfulPaint, 'paint timing');
  row(
    'Angular started',
    page.angularStart?.at,
    page.angularStart?.source === 'hook'
      ? 'startup hook (ng published)'
      : 'first Angular feature mark',
  );
  if (page.bootstrapComponent) {
    lines.push(
      `| Root component created | ${format(page.bootstrapComponent.end)} (took ${format(page.bootstrapComponent.end - page.bootstrapComponent.start)}) | Angular profiler |`,
    );
  }
  row(
    page.firstStable?.exact === false ? 'First stable (at or before)' : 'First stable',
    page.firstStable?.at,
    page.firstStable?.exact === false
      ? 'ApplicationRef.isStable, already stable when the overlay looked'
      : 'ApplicationRef.isStable',
  );
  row('Load event', page.navigation.load, 'navigation timing');
  row('Overlay started', page.overlayStart, 'overlay');
  if (page.angularStart && page.firstStable) {
    lines.push(
      '',
      `Angular start to first stable: ${page.firstStable.exact ? '' : 'at most '}${format(Math.max(0, page.firstStable.at - page.angularStart.at))}.`,
    );
  } else if (!page.firstStable) {
    lines.push(
      '',
      'The app has not been stable yet, or its ApplicationRef could not be found (it is looked up through ng.ɵgetInjectorProviders, Angular 16.2+).',
    );
  }
  const providers = page.providers;
  lines.push('', '### Provider construction', '');
  if (providers.status === 'needs-hook' || providers.status === 'unavailable') {
    lines.push(providers.note ?? 'Provider timing is unavailable on this page.');
  } else {
    if (providers.status === 'recording') {
      lines.push('Still recording: the hook stops one second after the app is first stable.', '');
    }
    lines.push(
      `${providers.count} provider instances, ${format(providers.totalSelfMs)} of construction in all, from Angular's own profiling (ng.enableProfiling) between the platform's creation and the first stable state. Providers created by environment initializers before the root injector's first lookups can be missing. Own time leaves out the providers each one created while it ran. Components and directives appear too, since Angular creates them through injectors.`,
    );
    if (providers.note) lines.push('', providers.note);
    if (providers.slowest.length) {
      lines.push(
        '',
        '| Provider | Own time | Total | Instances | First at |',
        '| --- | --- | --- | --- | --- |',
      );
      for (const entry of providers.slowest.slice(0, limit)) {
        lines.push(
          `| ${code(entry.name)} | ${format(entry.selfMs)} | ${format(entry.ms)} | ${entry.count} | ${format(entry.firstAt)} |`,
        );
      }
    }
  }
  if (pages.length > 1 && !args.page) {
    lines.push(
      '',
      `Other pages report startup timing too: ${pages
        .slice(1)
        .map((p) => code(p.pageId))
        .join(', ')}. Pass one as \`page\`.`,
    );
  }
  // Provider names and the URL come from the page.
  return untrusted(lines.join('\n'));
}

interface Scoped {
  rpc: { sharedState(name: string, options: AnyRecord): Promise<AnyRecord> };
}

export interface StartupHost {
  my: Scoped;
  rpcHost: unknown;
  register(definition: AnyRecord): void;
  agent: { registerTool(tool: AnyRecord): void };
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
}

export interface StartupRegistration {
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  expire(now?: number): void;
}

/**
 * Startup timing on the server, part of the Injectors inspector: the
 * `startup` shared state, the `push-startup` and `forget-startup-page` RPC
 * functions and the `startup-timing` agent tool.
 */
export async function registerStartup(host: StartupHost): Promise<StartupRegistration> {
  const shared = await host.my.rpc.sharedState('startup', {
    sharedState: createSharedState<StartupState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const state = () => shared['value']() as StartupState;
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared['mutate']((draft: StartupState) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-startup',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const page = toStartupPage(message);
      if (!page || !host.owns(page.pageId)) return;
      sessions.bind(page.pageId);
      shared['mutate']((draft: StartupState) => {
        draft.pages[page.pageId] = page;
      });
    },
  });

  host.register({
    name: 'forget-startup-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  host.agent.registerTool({
    id: 'pangular:startup-timing',
    description:
      "How the running app started, from navigation start: DOM content loaded, first contentful paint, when Angular started, the root component's creation (Angular 20+), and the first time `ApplicationRef.isStable` was true (an upper bound unless it was watched), then the slowest providers to construct with own and total time and instance count (`limit`, default 10). Root component and provider timing need `@pangular-inspector/devtools/startup-hook` loaded from the polyfills of an Angular 20+ dev build; the answer says when it is not. Uses `page` or the most recent page. Only reads.",
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        limit: { type: 'integer', description: 'Providers to list (1-50, default 10).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: startupTimingText(state(), { page: pageArgument(args), limit: args?.['limit'] }),
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
    expire: (now = Date.now()) =>
      drop(
        Object.values(state().pages)
          .filter((page) => now - page.reportedAt > host.ttl(page.pageId))
          .map((page) => page.pageId),
      ),
  };
}
