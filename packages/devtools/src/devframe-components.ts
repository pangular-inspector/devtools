// The Components inspector on the devframe server (`devframe.ts`): the
// `component-tree` and `change-detection` shared states, the pushes and pings
// of both, selection, picking, value reads, edits, @defer loads and
// screenshots. Its agent tools live in `devframe-component-tools.ts`.

import { PICK_KEYS } from './component-pick.ts';
import { toCdOptionsRequest } from './cd-data.ts';
import type { ResolvedPangularConfig } from './config.ts';
import { CHANGE_DETECTION_SHAPE, COMPONENT_TREE_SHAPE } from './push-delta.ts';
import { markCdPagesStopped, toCdPage, type CdPage, type CdState } from './rpc/cd-tools.ts';
import { createComponentEdits } from './rpc/component-edits.ts';
import { createComponentScreenshots } from './rpc/component-screenshots.ts';
import {
  findComponents,
  isComponentReport,
  latestComponentPage,
  toComponentPage,
} from './rpc/component-tools.ts';
import { createComponentValues } from './rpc/component-values.ts';
import { registerConsoleGlobals } from './rpc/console-globals.ts';
import { createDeferLoads } from './rpc/defer-loads.ts';
import type { OwnerBroadcast, PageOwners } from './rpc/page-owners.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { byRecency, unknownPageText } from './rpc/pages.ts';
import { createPushAcks } from './rpc/push-acks.ts';
import { createReportDeltas, deltaPush } from './rpc/report-deltas.ts';
import type { ComponentDetail, ComponentPage, LiveComponentNode } from './types.ts';
import type {
  AgentRegistrar,
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** The live component trees and change detection records, before any RPC function reads them. */
export async function createComponentState({ my }: { my: PangularScope }) {
  const componentTree = await my.rpc.sharedState('component-tree', {
    initialValue: {
      nodes: [] as LiveComponentNode[],
      pages: {} as Record<string, ComponentPage>,
      selectedId: null as string | null,
      highlightedId: null as string | null,
    },
  });
  const componentPages = new Map<string, ComponentPage>();
  // What each page's next delta builds on (`push-delta.ts`).
  const componentDeltas = createReportDeltas(COMPONENT_TREE_SHAPE);
  const cdDeltas = createReportDeltas(CHANGE_DETECTION_SHAPE);
  const applyComponentPages = () =>
    componentTree.mutate((draft) => {
      draft.pages = Object.fromEntries(componentPages);
      draft.nodes = latestComponentPage(componentPages.values())?.roots ?? [];
    });
  const componentWaiters = new Set<() => void>();
  // `console` marks a selection made in the panel, which sets `$ng0` on that page.
  const selectComponentOnPage = (
    pageId: string | undefined,
    id: string | null,
    console = false,
  ) => {
    componentTree.mutate((draft) => {
      draft.selectedId = id;
    });
    void my.rpc.broadcast({
      method: 'inspect-component-in-page',
      args: [{ pageId, id, ...(console && pageId ? { console: true } : {}) }],
      optional: true,
    });
  };
  const waitForComponentDetail = (pageId: string, id: string, timeoutMs = 3000) =>
    new Promise<ComponentDetail | null>((resolve) => {
      const done = (detail: ComponentDetail | null) => {
        clearTimeout(timer);
        componentWaiters.delete(check);
        resolve(detail);
      };
      const check = () => {
        const detail = componentPages.get(pageId)?.detail;
        if (detail?.id === id) done(detail);
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      timer.unref?.();
      componentWaiters.add(check);
      check();
    });
  // Change detection records, per page, and the pages whose connection dropped.
  const cdPages = new Map<string, CdPage>();
  const goneCdPages = new Set<string>();

  return {
    componentTree,
    componentPages,
    componentDeltas,
    cdDeltas,
    cdPages,
    goneCdPages,
    /** Writes `cdPages` into the `change-detection` state, once `registerComponentRpc` made it. */
    applyCd: (): void => {},
    applyComponentPages,
    componentWaiters,
    selectComponentOnPage,
    waitForComponentDetail,
  };
}

export type ComponentState = Awaited<ReturnType<typeof createComponentState>>;

/** What `registerComponentRpc` reads from the devframe server's setup (`devframe.ts`). */
export interface ComponentRpcEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  agent: AgentRegistrar;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  owners: PageOwners;
  state: ComponentState;
}

export async function registerComponentRpc(env: ComponentRpcEnv) {
  const { ctx, my, config, register, agent, owns, mayForget, answersFor, owners, state } = env;
  const limits = config.limits;
  const {
    componentPages,
    componentDeltas,
    cdDeltas,
    cdPages,
    goneCdPages,
    applyComponentPages,
    componentWaiters,
    selectComponentOnPage,
  } = state;
  // A tab whose connection dropped gets no change detection record request,
  // so its report goes at once and the tool does not count it as connected
  // until it reports again. Bound from the component, injector and change
  // detection reports, the ones the tool reads tabs from.
  const markCdStopped = (pageId?: string) => {
    if (markCdPagesStopped(cdPages, pageId)) state.applyCd();
  };
  const cdSessions = trackPageSessions(ctx.rpc, (pageIds) => {
    let removed = false;
    for (const pageId of pageIds) {
      goneCdPages.add(pageId);
      removed = cdPages.delete(pageId) || removed;
    }
    if (removed) state.applyCd();
  });
  const cdSeen = (pageId: string) => {
    cdSessions.bind(pageId);
    goneCdPages.delete(pageId);
  };

  register({
    name: 'push-component-tree',
    type: 'action',
    jsonSerializable: true,
    handler: deltaPush(componentDeltas, owns, (report, pageNow) => {
      if (!isComponentReport(report) || !owns(report.pageId)) return false;
      componentPages.set(report.pageId, toComponentPage(report, Date.now(), pageNow));
      cdSeen(report.pageId);
      applyComponentPages();
      for (const check of [...componentWaiters]) check();
      return true;
    }),
  });

  const cdState = await my.rpc.sharedState('change-detection', {
    initialValue: { pages: {} } as CdState,
  });
  state.applyCd = () =>
    cdState.mutate((draft) => {
      draft.pages = Object.fromEntries(cdPages);
    });
  // The pages confirm a recording request by pushing their recording again.
  const cdAcks = createPushAcks<CdPage>();
  const requestCdRecord = (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => {
    const pageId = typeof message?.pageId === 'string' ? message.pageId.slice(0, 50) : undefined;
    const on = typeof message?.on === 'boolean' ? message.on : undefined;
    // The summary must not say "Recording is on" from the last push before the stop.
    if (on === false) markCdStopped(pageId);
    void my.rpc.broadcast({
      method: 'change-detection-record',
      args: [{ pageId, on, clear: message?.clear === true }],
      optional: true,
    });
  };

  const requestCdOptions = (message: unknown) => {
    const raw = (message && typeof message === 'object' ? message : {}) as { pageId?: unknown };
    const pageId = typeof raw.pageId === 'string' ? raw.pageId.slice(0, 50) : undefined;
    void my.rpc.broadcast({
      method: 'change-detection-options',
      args: [{ pageId, ...toCdOptionsRequest(message) }],
      optional: true,
    });
  };

  register({
    name: 'push-change-detection',
    type: 'action',
    jsonSerializable: true,
    handler: deltaPush(cdDeltas, owns, (report) => {
      const page = toCdPage(report, limits.cdCycles);
      if (!page || !owns(page.pageId)) return false;
      cdPages.set(page.pageId, page);
      cdSeen(page.pageId);
      state.applyCd();
      cdAcks.notify(page.pageId, page);
      return true;
    }),
  });

  register({
    name: 'ping-change-detection',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      const page = owns(pageId) ? cdPages.get(pageId) : undefined;
      if (!page) return { known: false };
      cdPages.set(page.pageId, { ...page, reportedAt: Date.now() });
      cdSeen(page.pageId);
      return { known: true };
    },
  });

  register({
    name: 'forget-change-detection-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!mayForget(pageId)) return;
      cdDeltas.forget(pageId);
      if (cdPages.delete(pageId)) state.applyCd();
    },
  });

  register({
    name: 'request-change-detection-record',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => {
      requestCdRecord(message);
    },
  });

  register({
    name: 'request-change-detection-options',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      requestCdOptions(message);
    },
  });

  register({
    name: 'ping-component-tree',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      const page = owns(pageId) ? componentPages.get(pageId) : undefined;
      if (!page) return { known: false };
      componentPages.set(page.pageId, { ...page, reportedAt: Date.now() });
      cdSeen(page.pageId);
      return { known: true };
    },
  });

  register({
    name: 'forget-component-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!mayForget(pageId)) return;
      componentDeltas.forget(pageId);
      if (componentPages.delete(pageId)) applyComponentPages();
    },
  });

  register({
    name: 'select-component',
    type: 'action',
    jsonSerializable: true,
    handler: (target: string | { pageId?: unknown; id?: unknown; console?: unknown } | null) => {
      if (typeof target === 'string') {
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [target.slice(0, 500)],
          optional: true,
        });
        return;
      }
      const id = typeof target?.id === 'string' ? target.id.slice(0, 50) : null;
      const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
      selectComponentOnPage(pageId, id, target?.console === true);
    },
  });

  // Draws the hydration overlay on a page; it changes nothing in the app.
  const requestHydrationOverlay = (message: { pageId?: unknown; on?: unknown } | null) => {
    if (typeof message?.on !== 'boolean') return;
    const pageId = typeof message.pageId === 'string' ? message.pageId.slice(0, 50) : undefined;
    void my.rpc.broadcast({
      method: 'hydration-overlay',
      args: [{ pageId, on: message.on }],
      optional: true,
    });
  };
  register({
    name: 'request-hydration-overlay',
    type: 'action',
    jsonSerializable: true,
    handler: requestHydrationOverlay,
  });

  // Writes to component inputs, properties and signals: panel and agent tools.
  const componentEdits = createComponentEdits({
    config,
    pages: () => componentPages.values(),
    // Only the page's own connection gets the value to write, not the panel or other tabs.
    broadcast: (method, message) => {
      const pageId = (message as { pageId?: unknown } | null)?.pageId;
      void (my.rpc.broadcast as (options: OwnerBroadcast) => Promise<void>)({
        method,
        args: [message],
        optional: true,
        filter: owners.deliversTo(typeof pageId === 'string' ? pageId : undefined),
      });
    },
    answersFor,
  });
  register({
    name: 'component-edit-result',
    type: 'action',
    jsonSerializable: true,
    handler: componentEdits.answer,
  });
  register({
    name: 'request-component-edit',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown } | null) =>
      componentEdits.request(message?.pageId, message?.request),
  });
  for (const tool of componentEdits.tools) agent.registerTool(tool);

  // Loads one @defer block when an agent asks: same gate and owner check as the writes above.
  const deferLoads = createDeferLoads({
    config,
    pages: () => componentPages.values(),
    broadcast: (method, message) => {
      const pageId = (message as { pageId?: unknown } | null)?.pageId;
      void (my.rpc.broadcast as (options: OwnerBroadcast) => Promise<void>)({
        method,
        args: [message],
        optional: true,
        filter: owners.deliversTo(typeof pageId === 'string' ? pageId : undefined),
      });
    },
    answersFor,
  });
  register({
    name: 'defer-load-result',
    type: 'action',
    jsonSerializable: true,
    handler: deferLoads.answer,
  });
  agent.registerTool(deferLoads.tool);

  // Nested levels of component values: the panel opens them, inspect-component reads them.
  const componentValues = createComponentValues({
    pages: () => componentPages.values(),
    broadcast: (method, message) =>
      void my.rpc.broadcast({ method, args: [message], optional: true }),
    answersFor,
  });
  register({
    name: 'component-value-result',
    type: 'action',
    jsonSerializable: true,
    handler: componentValues.answer,
  });
  register({
    name: 'request-component-value',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown } | null) =>
      componentValues.request(message?.pageId, message?.request),
  });

  // Images of one component, drawn by its page: the screenshot-component tool.
  const componentScreenshots = createComponentScreenshots({
    pages: () => componentPages.values(),
    broadcast: (method, message) =>
      void my.rpc.broadcast({ method, args: [message], optional: true }),
    answersFor,
  });
  register({
    name: 'component-screenshot-result',
    type: 'action',
    jsonSerializable: true,
    handler: componentScreenshots.answer,
  });
  agent.registerTool(componentScreenshots.tool);

  registerConsoleGlobals({
    config,
    register,
    broadcast: (message) => void my.rpc.broadcast(message),
    answersFor,
  });

  return {
    cdSeen,
    cdAcks,
    cdState,
    requestCdRecord,
    requestCdOptions,
    requestHydrationOverlay,
    componentValues,
  };
}

/** The panel's pick mode: the page draws the picker, the panel moves and cancels it. */
export function registerComponentPick(env: {
  my: PangularScope;
  register: Register;
  answersFor: AnswersFor;
  state: ComponentState;
}): void {
  const { my, register, answersFor } = env;
  const { componentPages, componentTree } = env.state;
  const pendingPicks = new Map<
    string,
    { pageId: string; settle: (result: Record<string, unknown>) => void }
  >();
  let pickSeq = 0;

  register({
    name: 'request-component-pick',
    type: 'action',
    jsonSerializable: true,
    handler: (target: { pageId?: unknown } | null) => {
      const asked = typeof target?.pageId === 'string' ? target.pageId : undefined;
      const pageId = asked ?? latestComponentPage(componentPages.values())?.pageId;
      if (!pageId || !componentPages.has(pageId)) {
        return { ok: false, error: 'No page is connected. Open the app in a browser first.' };
      }
      return new Promise<Record<string, unknown>>((resolve) => {
        const requestId = `pick${++pickSeq}`;
        const timer = setTimeout(() => {
          pendingPicks.delete(requestId);
          resolve({
            ok: false,
            error:
              'The page did not answer. Is the app still open in a browser, or the device app in the foreground?',
          });
        }, 20_000);
        timer.unref?.();
        pendingPicks.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pendingPicks.delete(requestId);
            if (result['ok'] === true && typeof result['id'] === 'string') {
              componentTree.mutate((draft) => {
                draft.selectedId = result['id'] as string;
              });
            }
            resolve({ ...result, pageId });
          },
        });
        void my.rpc.broadcast({
          method: 'component-pick',
          args: [{ requestId, pageId }],
          optional: true,
        });
      });
    },
  });

  // A keyboard move of the running pick: the panel sends the key, the page
  // answers with the component it shows now on the pick's result channel.
  register({
    name: 'request-component-pick-move',
    type: 'action',
    jsonSerializable: true,
    handler: (target: { pageId?: unknown; key?: unknown } | null) => {
      const key = PICK_KEYS.find((k) => k === target?.key);
      if (!key) return { moved: false, error: 'Unknown key.' };
      const asked = typeof target?.pageId === 'string' ? target.pageId : undefined;
      const pageId = asked ?? latestComponentPage(componentPages.values())?.pageId;
      if (!pageId || !componentPages.has(pageId)) {
        return { moved: false, error: 'No page is connected. Open the app in a browser first.' };
      }
      return new Promise<Record<string, unknown>>((resolve) => {
        const requestId = `pick${++pickSeq}`;
        const timer = setTimeout(() => {
          pendingPicks.delete(requestId);
          resolve({ moved: false, error: 'The page did not answer.' });
        }, 5_000);
        timer.unref?.();
        pendingPicks.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pendingPicks.delete(requestId);
            resolve(result);
          },
        });
        void my.rpc.broadcast({
          method: 'component-pick',
          args: [{ requestId, pageId, move: key }],
          optional: true,
        });
      });
    },
  });

  register({
    name: 'cancel-component-pick',
    type: 'action',
    jsonSerializable: true,
    handler: (target: { pageId?: unknown } | null) => {
      const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
      void my.rpc.broadcast({
        method: 'component-pick',
        args: [{ pageId, cancel: true }],
        optional: true,
      });
    },
  });

  register({
    name: 'component-pick-result',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
      if (typeof message?.requestId !== 'string') return;
      const pending = pendingPicks.get(message.requestId);
      if (!pending || !answersFor(pending.pageId, message.pageId)) return;
      const result =
        message.result && typeof message.result === 'object'
          ? (message.result as Record<string, unknown>)
          : { ok: false, error: 'Empty answer.' };
      pending.settle(result);
    },
  });
}

/** What the component agent tools say about pages and how they find components (`devframe-component-tools.ts`). */
export function componentToolHelpers(componentPages: Map<string, ComponentPage>) {
  const noComponentTree = (outcome: string) =>
    `No component tree has been reported${outcome}. This is what a page that has never connected reports, and also what a connected page reports when its components are not readable. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`;
  const componentPageProperty = {
    type: 'string',
    description:
      'Page id, when more than one tab reports (see pangular:list-pages). Searches every page without it, newest first.',
  };
  const componentHits = (selector: string, pageId?: string) =>
    findComponents(
      byRecency(componentPages.values()).filter((page) => !pageId || page.pageId === pageId),
      selector,
    );
  const unknownComponentPage = (pageId: string | undefined) =>
    pageId && !componentPages.has(pageId)
      ? {
          markdown: unknownPageText(pageId, byRecency(componentPages.values()), 'a component tree'),
        }
      : null;

  return { noComponentTree, componentPageProperty, componentHits, unknownComponentPage };
}
