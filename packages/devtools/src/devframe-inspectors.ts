// The inspectors that register themselves (`rpc/<area>-register.ts`), each
// only when the config turns it on.

import { agentTags, actionBlockedMessage, type ResolvedPangularConfig } from './config.ts';
import type { HubFeed } from './hub-messages.ts';
import type { PangularServerPlugin } from './plugin.ts';
import { answeringText } from './rpc/agent-output.ts';
import { registerErrors } from './rpc/errors-register.ts';
import { registerIonic } from './rpc/ionic-register.ts';
import { registerLeaks } from './rpc/leaks-register.ts';
import { leased, type PageInterest } from './rpc/page-interest.ts';
import type { PageTtl } from './rpc/page-ttl.ts';
import { registerPerformance } from './rpc/perf-register.ts';
import { registerPlugins } from './rpc/plugins-register.ts';
import { registerTanstackQuery } from './rpc/query-register.ts';
import { registerReduxStores } from './rpc/redux-stores-register.ts';
import { registerServerErrors } from './rpc/server-errors-register.ts';
import { registerStartup } from './rpc/startup-register.ts';
import { registerBuild } from './rpc/build-register.ts';
import { guardHandler } from './rpc/tool-input.ts';
import type {
  AgentRegistrar,
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** What `registerInspectors` reads from the devframe server's setup (`devframe.ts`). */
export interface InspectorsEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  agent: AgentRegistrar;
  feed: HubFeed;
  interest: PageInterest;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  liveTtl: PageTtl;
  pageTools: boolean;
  /** When a page last beat (`rpc/page-heartbeats.ts`). */
  seenAt: (pageId: string) => number | undefined;
  serverPlugins: readonly PangularServerPlugin[] | undefined;
}

/** Errors, performance, build, leaks, startup, Ionic, plugins, Redux stores and TanStack Query. */
export async function registerInspectors(env: InspectorsEnv) {
  const {
    ctx,
    my,
    config,
    register,
    agent,
    feed,
    interest,
    owns,
    mayForget,
    answersFor,
    liveTtl,
    pageTools,
    seenAt,
    serverPlugins,
  } = env;
  const on = config.inspectors;
  const limits = config.limits;
  const errorsInspector = on.errors
    ? await registerErrors({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        ttl: liveTtl,
      })
    : null;
  // SSR and Vite errors of this process (`server-errors.ts`); no page reports them.
  const serverErrors = on.errors
    ? await registerServerErrors({ my, register, agent, capture: pageTools })
    : null;
  const perfInspector = on.performance
    ? await registerPerformance({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        ttl: liveTtl,
      })
    : null;
  if (on.build) registerBuild({ register, agent, root: ctx.cwd });
  const leaksInspector = on.components
    ? await registerLeaks({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        ttl: liveTtl,
      })
    : null;
  const startupInspector = on.injectors
    ? await registerStartup({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        ttl: liveTtl,
      })
    : null;
  // The `ion-router-outlet` stacks of Ionic pages, shown in the Capacitor tab.
  const ionicInspector = on.capacitor
    ? await registerIonic({ my, rpcHost: ctx.rpc, register, owns, mayForget, ttl: liveTtl })
    : null;
  // A plugin tool's tier comes from the plugin; `pluginToolAllowed` checks it against the config.
  const pluginsInspector = on.plugins
    ? await registerPlugins({
        my,
        rpcHost: ctx.rpc,
        config,
        register,
        agent,
        registerPluginTool: (tool, safety) =>
          ctx.agent.registerTool(
            feed.wrapTool({
              ...(tool as Parameters<typeof ctx.agent.registerTool>[0]),
              outputSchema: undefined,
              safety,
              tags: agentTags(String(tool['id'])),
              handler: answeringText(
                guardHandler(
                  tool['inputSchema'],
                  leased(() => interest, tool['handler']),
                ),
              ),
            }),
          ),
        pageTools,
        owns,
        mayForget,
        ttl: liveTtl,
        seenAt,
        serverPlugins,
      })
    : null;

  const reduxStores = on.ngrx
    ? await registerReduxStores({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        ttl: liveTtl,
        maxLog: limits.changeLog,
      })
    : null;
  const tanstackQuery = on.tanstackQuery
    ? await registerTanstackQuery({
        my,
        rpcHost: ctx.rpc,
        register,
        agent,
        owns,
        mayForget,
        answersFor,
        ttl: liveTtl,
        writes: config.actions.tanstackQuery,
        blocked: actionBlockedMessage('tanstackQuery'),
      })
    : null;

  return {
    errorsInspector,
    serverErrors,
    perfInspector,
    leaksInspector,
    startupInspector,
    ionicInspector,
    pluginsInspector,
    reduxStores,
    tanstackQuery,
  };
}

export type Inspectors = Awaited<ReturnType<typeof registerInspectors>>;
