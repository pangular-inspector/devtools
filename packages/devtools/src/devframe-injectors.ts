// The Injectors inspector on the devframe server (`devframe.ts`): the
// `injector-tree` shared state with framework providers marked, its push and
// ping, provider values and refreshes.

import type { PangularInspector } from './config.ts';
import { INJECTOR_TREE_SHAPE } from './push-delta.ts';
import { defaultPage, rankPages } from './rpc/default-page.ts';
import { createFrameworkNames, markFramework } from './rpc/framework-tokens.ts';
import { requestInjectorRefresh } from './rpc/injector-refresh.ts';
import { INJECTOR_TREE_LIMITS, sanitizeInjectorTree } from './rpc/injector-report.ts';
import type { NgrxDeclaration } from './rpc/ngrx-tools.ts';
import { createProviderValues } from './rpc/provider-values.ts';
import { createReportDeltas, deltaPush } from './rpc/report-deltas.ts';
import { nameStoreTokens } from './rpc/store-tokens.ts';
import type { InjectorPage, InjectorTreeNode, ZoneMode } from './types.ts';
import { ZONE_MODES } from './zone-mode.ts';
import type {
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** The injector tree of each page, before any RPC function reads it. */
export async function createInjectorState({
  ctx,
  my,
}: {
  ctx: DevframeNodeContext;
  my: PangularScope;
}) {
  const injectorTreeState = await my.rpc.sharedState('injector-tree', {
    initialValue: {
      roots: [] as InjectorTreeNode[],
      environment: [] as InjectorTreeNode[],
      pages: {} as Record<string, InjectorPage>,
      truncated: false,
      zone: null as ZoneMode | null,
      selectedInjectorId: null as string | null,
    },
  });
  const injectorPages = new Map<string, InjectorPage>();
  // Token names from the installed @angular/* packages mark framework providers and injectors.
  const withFramework = (page: InjectorPage, names: ReadonlySet<string>): InjectorPage => ({
    ...page,
    roots: markFramework(page.roots, names),
    environment: markFramework(page.environment, names),
  });
  const frameworkNames = createFrameworkNames(
    () => [ctx.cwd, ctx.workspaceRoot],
    (names) => {
      if (!injectorPages.size) return;
      for (const [id, page] of injectorPages) injectorPages.set(id, withFramework(page, names));
      applyInjectorPages();
    },
  );
  const latestInjectorPage = () => rankPages(injectorPages.values())[0];
  const applyInjectorPages = () =>
    injectorTreeState.mutate((draft) => {
      const latest = latestInjectorPage();
      draft.pages = Object.fromEntries(injectorPages);
      draft.roots = latest?.roots ?? [];
      draft.environment = latest?.environment ?? [];
      draft.truncated = latest?.truncated === true;
      draft.zone = latest?.zone ?? null;
    });
  // What each page's next delta builds on (`push-delta.ts`).
  const injectorDeltas = createReportDeltas(INJECTOR_TREE_SHAPE);

  return {
    injectorTreeState,
    injectorPages,
    injectorDeltas,
    withFramework,
    frameworkNames,
    latestInjectorPage,
    applyInjectorPages,
  };
}

export type InjectorState = Awaited<ReturnType<typeof createInjectorState>>;

/** What `registerInjectorRpc` reads from the devframe server's setup (`devframe.ts`). */
export interface InjectorRpcEnv {
  my: PangularScope;
  register: Register;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  on: Record<PangularInspector, boolean>;
  /** The signal stores of the source, named for the NgRx tools (`devframe-ngrx.ts`). */
  ngrxNames: () => NgrxDeclaration[];
  /** Marks a page that reported, for the change detection sessions (`devframe-components.ts`). */
  cdSeen: (pageId: string) => void;
  state: InjectorState;
}

export function registerInjectorRpc(env: InjectorRpcEnv) {
  const { my, register, owns, mayForget, answersFor, on, ngrxNames, cdSeen } = env;
  const { injectorPages, injectorDeltas, withFramework, frameworkNames, applyInjectorPages } =
    env.state;
  register({
    name: 'push-injector-tree',
    type: 'action',
    jsonSerializable: true,
    handler: deltaPush(injectorDeltas, owns, (raw) => {
      const report = raw as {
        pageId?: unknown;
        roots?: unknown;
        environment?: unknown;
        truncated?: unknown;
        zone?: unknown;
      } | null;
      const pageId = report?.pageId;
      if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return false;
      if (!owns(pageId)) return false;
      const zone = ZONE_MODES.find((mode) => mode === report?.zone);
      const tree = sanitizeInjectorTree(report?.roots, report?.environment);
      const names = frameworkNames.current();
      const page: InjectorPage = {
        pageId,
        roots: tree.roots,
        environment: tree.environment,
        ...(report?.truncated === true || tree.truncated
          ? { truncated: true, limits: INJECTOR_TREE_LIMITS }
          : {}),
        ...(zone ? { zone } : {}),
        reportedAt: Date.now(),
      };
      // Signal stores get the names the NgRx tools use (rpc/store-tokens.ts).
      const named = on.ngrx ? nameStoreTokens(page, ngrxNames()) : page;
      injectorPages.set(pageId, withFramework(named, names ?? new Set()));
      cdSeen(pageId);
      applyInjectorPages();
      return true;
    }),
  });

  register({
    name: 'ping-injector-tree',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      const page = owns(pageId) ? injectorPages.get(pageId) : undefined;
      if (!page) return { known: false };
      injectorPages.set(page.pageId, { ...page, reportedAt: Date.now() });
      cdSeen(page.pageId);
      return { known: true };
    },
  });

  register({
    name: 'forget-injector-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!mayForget(pageId)) return;
      injectorDeltas.forget(pageId);
      if (injectorPages.delete(pageId)) applyInjectorPages();
    },
  });

  // The value of a provider an injector already created: the Injectors view and read-provider-value.
  const providerValues = createProviderValues({
    pages: () => injectorPages.values(),
    latest: () => defaultPage(injectorPages.values()),
    broadcast: (method, message) =>
      void my.rpc.broadcast({ method, args: [message], optional: true }),
    answersFor,
  });
  register({
    name: 'provider-value-result',
    type: 'action',
    jsonSerializable: true,
    handler: providerValues.answer,
  });
  register({
    name: 'request-provider-value',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; request?: unknown } | null) =>
      providerValues.request(message?.pageId, message?.request),
  });

  // The panel asks the page to read an element injector again (the one it
  // selected), or every injector (Refresh). The page pushes a fresh tree.
  register({
    name: 'request-injector-refresh',
    type: 'action',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; injectorId?: unknown } | null) =>
      requestInjectorRefresh(
        message,
        injectorPages.keys(),
        (method, args) => void my.rpc.broadcast({ method, args: [args], optional: true }),
      ),
  });

  return providerValues;
}
