// The page registry of the devframe server's setup (`devframe.ts`): which
// connection owns each page id, which pages beat, which are in the background,
// which a panel or an agent watches, and the URL, title and inspectors of every
// page that reports.

import {
  BROWSER_TOOLS_CHANGED,
  BROWSER_TOOLS_STATE,
  createBrowserToolsSwitch,
  registerBrowserTools,
  type BrowserToolHost,
} from './rpc/browser-tools.ts';
import type { ResolvedPangularConfig } from './config.ts';
import { REDACTION_CONFIG_RPC } from './overlay-redaction.ts';
import { createAngularPages, sanitizeAngularReport } from './rpc/angular-pages.ts';
import { analogPages } from './rpc/analog-register.ts';
import { createPageOrder, setPageOrder } from './rpc/default-page.ts';
import { createPageHeartbeats } from './rpc/page-heartbeats.ts';
import { pageHighlightTarget } from './rpc/page-highlight-target.ts';
import { INTEREST_TICK_MS, createPageInterest } from './rpc/page-interest.ts';
import { createPageOwners } from './rpc/page-owners.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { createPageVisibility } from './rpc/page-ttl.ts';
import { matchForms, type FormsState } from './rpc/forms-tools.ts';
import type { FieldArgs } from './rpc/forms-explain.ts';
import { pageDetails, summarizePages } from './rpc/pages.ts';
import type { CapacitorPage } from './rpc/capacitor-tools.ts';
import type { NgrxPages } from './rpc/ngrx-tools.ts';
import type { PipePageReport } from './rpc/pipes-tools.ts';
import type { PageReport } from './rpc/forms-tools.ts';
import type { RouterPage } from './rpc/router-tools.ts';
import type { ComponentPage, HttpPage, InjectorPage } from './types.ts';
import type { Inspectors } from './devframe-inspectors.ts';
import type { DevframeNodeContext, PageGraph, PangularScope, Register } from './devframe-env.ts';

/** What `registerPageRegistry` reads from the devframe server's setup (`devframe.ts`). */
export interface PageRegistryEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  /** A beat from a page with forms counts as its forms report (`devframe-forms.ts`). */
  touchFormsPage: (pageId: string, now?: number) => boolean;
  /** A beat from a page with a router counts as its router report (`devframe-router.ts`). */
  touchRouter: (pageId: string, now?: number) => boolean;
}

/**
 * The pages themselves: heartbeats, background marks, owners, the default page
 * order and the lease, with the RPC functions the overlay claims, beats and
 * reports its Angular version through, and the browser tools switch.
 */
export async function registerPageRegistry(env: PageRegistryEnv) {
  const { ctx, my, config, register, touchFormsPage, touchRouter } = env;
  const limits = config.limits;
  // Tabs in the background stop reporting, so their last data stays until
  // they come back or close.
  // Pages that beat keep all their reports, so they send only what changed.
  const heartbeats = createPageHeartbeats();
  const visibility = createPageVisibility((pageId) => heartbeats.alive(pageId));
  const liveTtl = visibility.ttl();
  const visibilityState = await my.rpc.sharedState('page-visibility', {
    initialValue: { hidden: [] as string[] },
  });
  const applyVisibility = () =>
    visibilityState.mutate((draft) => {
      draft.hidden = visibility.list();
    });
  // One connection owns each page id, so one tab (or a stray client) can't
  // overwrite or forget the pages another one reports.
  const owners = createPageOwners(ctx.rpc, liveTtl);
  // The default page of every tool: foreground first, then the newest connection.
  const pageOrder = createPageOrder(() => visibility.list());
  setPageOrder(pageOrder.rank);
  const owns = (pageId: unknown): pageId is string => {
    if (typeof pageId !== 'string' || !owners.write(pageId)) return false;
    pageOrder.seen(pageId);
    return true;
  };
  // A request is settled only by the page it was sent to, from the connection
  // that owns that page, so another client can't answer for it.
  const answersFor = (target: string | undefined, pageId: unknown) =>
    (target === undefined || pageId === target) && owns(pageId);

  // Pages push their heavy reports only while a panel or an agent watches.
  const interest = createPageInterest({
    rpcHost: ctx.rpc,
    leaseMs: limits.idleAfterMs,
    hidden: (pageId) => visibility.has(pageId),
    broadcast: (message) =>
      void my.rpc
        .broadcast({ method: 'page-interest-changed', args: [message], optional: true })
        ?.catch?.(() => {}),
  });
  register({
    name: 'page-interest',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => interest.handle(message),
  });
  register({
    name: 'page-heartbeat',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown } | null) => {
      const pageId = message?.pageId;
      if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return undefined;
      if (!owners.write(pageId)) return undefined;
      // The forms and router tools call a page stale by its last report, so
      // a beat counts as their report, in the shared states too.
      const now = Date.now();
      touchFormsPage(pageId, now);
      touchRouter(pageId, now);
      const known = heartbeats.beat(pageId, now, visibility.has);
      return { known, ...interest.handle({ pageId }) };
    },
  });
  const interestTick = setInterval(() => interest.tick(), INTEREST_TICK_MS);
  interestTick.unref?.();
  // A page that left is not waited for when an agent wakes the pages.
  const mayForget = (pageId: unknown): pageId is string => {
    if (typeof pageId !== 'string' || !owners.forget(pageId)) return false;
    interest.forget(pageId);
    pageOrder.forget(pageId);
    return true;
  };

  // The `read` agent tools, for the page to register with browser agents.
  // `agent.browserTools` sets where the switch starts; the panel's Settings
  // flips it for every page until the server restarts.
  const browserToolsState = await my.rpc.sharedState(BROWSER_TOOLS_STATE, {
    initialValue: { enabled: config.agent.browserTools, config: config.agent.browserTools },
  });
  const browserToolsSwitch = createBrowserToolsSwitch(config.agent.browserTools, (state) => {
    browserToolsState.mutate((draft) => {
      draft.enabled = state.enabled;
      draft.config = state.config;
    });
    void my.rpc
      .broadcast({ method: BROWSER_TOOLS_CHANGED, args: [state], optional: true })
      ?.catch?.(() => {});
  });
  registerBrowserTools(register, ctx as unknown as BrowserToolHost, {
    enabled: browserToolsSwitch.enabled,
    owns,
    switch: browserToolsSwitch,
  });

  // Not in `__connection.json`: only a trusted page learns which names are secret.
  register({
    name: REDACTION_CONFIG_RPC,
    type: 'query',
    jsonSerializable: true,
    handler: () => config.redaction,
  });

  let onPageClaimed = (_pageId: string) => {};
  register({
    name: 'claim-page',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; key?: unknown } | null) => {
      const pageId = message?.pageId;
      if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return { ok: false };
      const ok = owners.claim(pageId, message?.key);
      // A claim comes before the page sends everything, so its first beat finds it known.
      if (ok) heartbeats.beat(pageId);
      // The overlay claims once per load: what the audit holds of the old document is stale.
      if (ok) onPageClaimed(pageId);
      return { ok };
    },
  });

  register({
    name: 'report-page-visibility',
    type: 'action',
    jsonSerializable: true,
    handler: (report: { pageId?: unknown; hidden?: unknown } | null) => {
      const pageId = report?.pageId;
      if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return;
      if (!owners.write(pageId)) return;
      heartbeats.touch(pageId);
      if (visibility.set(pageId, report?.hidden === true)) applyVisibility();
    },
  });

  // Each page's Angular version and debug API parts, so a view can say why it is empty.
  const angularPages = createAngularPages();
  const pageAngularState = await my.rpc.sharedState('page-angular', {
    initialValue: angularPages.snapshot(),
  });
  const applyAngularPages = () =>
    pageAngularState.mutate((draft) => {
      draft.pages = angularPages.snapshot().pages;
    });
  register({
    name: 'report-page-angular',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      const info = sanitizeAngularReport(report);
      if (!info || !owns(info.pageId)) return;
      if (angularPages.set(info)) applyAngularPages();
    },
  });
  register({
    name: 'forget-page-angular',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (mayForget(pageId) && angularPages.forget(pageId)) applyAngularPages();
    },
  });

  return {
    heartbeats,
    visibility,
    liveTtl,
    applyVisibility,
    owners,
    owns,
    answersFor,
    interest,
    interestTick,
    mayForget,
    angularPages,
    applyAngularPages,
    /** What a claim also does, once the audit exists. */
    onPageClaimed: (claimed: (pageId: string) => void) => {
      onPageClaimed = claimed;
    },
  };
}

export type PageRegistry = Awaited<ReturnType<typeof registerPageRegistry>>;

/** The form field and page highlights the panel asks for; a closed panel takes its highlight with it. */
export function registerHighlights(env: {
  ctx: DevframeNodeContext;
  my: PangularScope;
  register: Register;
}): void {
  const { ctx, my, register } = env;
  const highlightSessions = trackPageSessions(ctx.rpc, (kinds) => {
    for (const method of kinds) void my.rpc.broadcast({ method, args: [null], optional: true });
  });

  register({
    name: 'request-form-highlight',
    type: 'action',
    jsonSerializable: true,
    handler: (target: { formId: string; path: string } | null) => {
      if (target) highlightSessions.bind('highlight-form-field');
      else highlightSessions.unbind('highlight-form-field');
      void my.rpc.broadcast({
        method: 'highlight-form-field',
        args: [target],
        optional: true,
      });
    },
  });

  register({
    name: 'request-page-highlight',
    type: 'action',
    jsonSerializable: true,
    handler: (selector: unknown) => {
      const target = pageHighlightTarget(selector);
      if (target) highlightSessions.bind('highlight-in-page');
      else highlightSessions.unbind('highlight-in-page');
      void my.rpc.broadcast({ method: 'highlight-in-page', args: [target], optional: true });
    },
  });
}

/** What `createPageDirectory` reads from the devframe server's setup (`devframe.ts`). */
export interface PageDirectoryEnv {
  config: ResolvedPangularConfig;
  pages: PageRegistry;
  inspectors: Inspectors;
  componentPages: Map<string, ComponentPage>;
  signalPages: Map<string, { graph: PageGraph; reportedAt: number }>;
  injectorPages: Map<string, InjectorPage>;
  ngrxPages: NgrxPages;
  formPages: Map<string, PageReport & { reportedAt: number }>;
  pipePages: Map<string, PipePageReport & { reportedAt: number }>;
  capacitorPages: Map<string, CapacitorPage>;
  routerPages: Map<string, RouterPage>;
  httpPages: Map<string, HttpPage>;
}

/** Every reporting page with its URL and title, merged across the inspectors. */
export function createPageDirectory(env: PageDirectoryEnv) {
  const {
    componentPages,
    signalPages,
    injectorPages,
    ngrxPages,
    formPages,
    pipePages,
    capacitorPages,
    routerPages,
    httpPages,
  } = env;
  const { heartbeats, angularPages, visibility } = env.pages;
  const {
    reduxStores,
    tanstackQuery,
    errorsInspector,
    startupInspector,
    ionicInspector,
    pluginsInspector,
  } = env.inspectors;
  const on = env.config.inspectors;
  // The URL and title of each page, from its router, HTTP or component report.
  const livePageDetails = () =>
    pageDetails({
      router: [...routerPages.values()].map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.snapshot?.url,
      })),
      http: httpPages.values(),
      components: componentPages.values(),
    });
  /** The address of the page a form is on, for the Playwright test export. */
  function formPageUrl(state: FormsState, args: FieldArgs): string | undefined {
    const forms = matchForms(state.forms, args.form, args.page);
    const pageId = (forms[0]?.id ?? '').split('@')[1] ?? args.page;
    return pageId ? livePageDetails().get(pageId)?.url : undefined;
  }
  const withPageUrls = <T extends { pageId: string; reportedAt: number }>(pages: T[]) => {
    const details = livePageDetails();
    return pages.map((page) => {
      const detail = details.get(page.pageId);
      return {
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: detail?.url,
        // The Audit page picker names a page by its title before its URL.
        ...(detail?.title ? { title: detail.title } : {}),
      };
    });
  };

  // Every reporting page, merged across inspectors, newest first.
  const livePages = () => {
    const details = livePageDetails();
    const platforms = new Map<string, string>();
    for (const page of componentPages.values()) {
      if (page.platform) platforms.set(page.pageId, page.platform);
    }
    for (const page of capacitorPages.values()) {
      if (page.info.bridge && !platforms.has(page.pageId)) {
        platforms.set(page.pageId, `capacitor-${page.info.platform}`);
      }
    }
    const withUrl = <
      T extends { pageId: string; reportedAt: number; url?: string; title?: string },
    >(
      pages: Iterable<T>,
    ) =>
      [...pages].map((page) => ({
        pageId: page.pageId,
        // An idle page sends only its heartbeat, which counts as a report here.
        reportedAt: Math.max(page.reportedAt, heartbeats.seenAt(page.pageId) ?? 0),
        // A page only one inspector reports, such as Ionic, still names its own URL and title.
        ...(page.url !== undefined ? { url: page.url } : {}),
        ...(page.title !== undefined ? { title: page.title } : {}),
        ...details.get(page.pageId),
        platform: platforms.get(page.pageId),
        angular: angularPages.get(page.pageId)?.version,
      }));
    return summarizePages(
      {
        components: withUrl(componentPages.values()),
        signals: withUrl([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry }))),
        injectors: withUrl(injectorPages.values()),
        ngrx: withUrl([...ngrxPages.values(), ...(reduxStores?.pages() ?? [])]),
        tanstackQuery: withUrl(tanstackQuery?.pages() ?? []),
        forms: withUrl(formPages.values()),
        router: withUrl(routerPages.values()),
        pipes: withUrl(pipePages.values()),
        http: withUrl(httpPages.values()),
        capacitor: withUrl(capacitorPages.values()),
        errors: withUrl(errorsInspector?.pages() ?? []),
        startup: withUrl(startupInspector?.pages() ?? []),
        ionic: withUrl(ionicInspector?.pages() ?? []),
        plugins: withUrl(pluginsInspector?.pages() ?? []),
        analog: withUrl(on.analog ? analogPages() : []),
      },
      visibility.list(),
    );
  };

  return { livePageDetails, formPageUrl, withPageUrls, livePages };
}

export type PageDirectory = ReturnType<typeof createPageDirectory>;
