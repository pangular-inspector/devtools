// The live agent resources of the devframe server (`devframe.ts`), whole and
// one page at a time.

import { createPageResourceSource, providePageResources } from './agent-page-resources.ts';
import type { ComponentState } from './devframe-components.ts';
import type { FormsStateHolder } from './devframe-forms.ts';
import type { InjectorState } from './devframe-injectors.ts';
import type { NgrxStateHolder } from './devframe-ngrx.ts';
import type { SignalState } from './devframe-signals.ts';
import { scanPipes } from './rpc/get-pipes.ts';
import { formsResourceText, type FormsState } from './rpc/forms-tools.ts';
import { injectorResourceText } from './rpc/injector-resource.ts';
import type { PageInterest } from './rpc/page-interest.ts';
import { currentPipes, type PipePageReport } from './rpc/pipes-tools.ts';
import { LIVE_RESOURCE_NOTE, liveResourceText } from './rpc/resource-text.ts';
import { routerResourceText, type RouterState } from './rpc/router-tools.ts';
import { signalStateForAgents } from './rpc/signal-tools.ts';
import type { AgentRegistrar, DevframeNodeContext, SharedState } from './devframe-env.ts';

/** What `registerLiveResources` reads from the devframe server's setup (`devframe.ts`). */
export interface LiveResourcesEnv {
  ctx: DevframeNodeContext;
  agent: AgentRegistrar;
  interest: PageInterest;
  componentTree: ComponentState['componentTree'];
  signalGraphState: SignalState['signalGraphState'];
  injectorTreeState: InjectorState['injectorTreeState'];
  injectorPages: InjectorState['injectorPages'];
  ngrxStoreState: NgrxStateHolder['ngrxStoreState'];
  formsState: FormsStateHolder['formsState'];
  routerState: SharedState<RouterState>;
  pipePages: Map<string, PipePageReport & { reportedAt: number }>;
}

export function registerLiveResources(env: LiveResourcesEnv): void {
  const {
    ctx,
    agent,
    interest,
    componentTree,
    signalGraphState,
    injectorTreeState,
    injectorPages,
    ngrxStoreState,
    formsState,
    routerState,
    pipePages,
  } = env;
  agent.registerResource({
    id: 'pangular:component-tree',
    name: 'Angular Component Tree',
    description:
      'Live component instances per page as JSON: rendered instances, directive hosts, counts and the selected instance detail. Empty when no page is connected. ' +
      LIVE_RESOURCE_NOTE,
    mimeType: 'application/json',
    read: () => ({
      text: liveResourceText(
        componentTree.value(),
        'pangular:list-components and pangular:inspect-component',
      ),
    }),
  });

  agent.registerResource({
    id: 'pangular:signal-graph',
    name: 'Angular Signal Graph',
    description:
      'Live signal graph per page as JSON: nodes, edges (`consumer` reads `producer`, by node id), contexts, resources, value history. Empty with no page. ' +
      LIVE_RESOURCE_NOTE,
    mimeType: 'application/json',
    read: () => ({
      text: liveResourceText(
        signalStateForAgents(signalGraphState.value()),
        'pangular:inspect-signals',
      ),
    }),
  });

  agent.registerResource({
    id: 'pangular:injector-tree',
    name: 'Angular Injector Tree',
    description:
      'DI injectors per page as JSON: element and environment injectors with providers and dependencies, and the zone mode. Empty when no page is connected. Past 100,000 characters an outline with provider counts.',
    mimeType: 'application/json',
    read: () => ({
      text: injectorResourceText(injectorTreeState.value(), Object.fromEntries(injectorPages)),
    }),
  });

  agent.registerResource({
    id: 'pangular:ngrx-store',
    name: 'NgRx Store State',
    description:
      'Live NgRx state per page as JSON: signal stores, classic Store state and the change log with diffs and action origins. Empty when no page is connected. ' +
      LIVE_RESOURCE_NOTE,
    mimeType: 'application/json',
    read: () => ({
      text: liveResourceText(
        ngrxStoreState.value(),
        'pangular:ngrx-inspect-store and pangular:ngrx-history',
      ),
    }),
  });

  agent.registerResource({
    id: 'pangular:forms',
    name: 'Angular Forms',
    description:
      "Every form a connected page last reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes. The JSON starts with an `_untrusted` notice. Empty when no page is connected.",
    mimeType: 'application/json',
    read: () => ({ text: formsResourceText(formsState.value() as FormsState) }),
  });

  agent.registerResource({
    id: 'pangular:router',
    name: 'Angular Router',
    description:
      'The active route tree (params, data, guards, resolvers) and recent navigations of each connected page. The JSON starts with an `_untrusted` notice. Empty when no page is connected.',
    mimeType: 'application/json',
    read: () => ({ text: routerResourceText(routerState.value() as RouterState) }),
  });

  agent.registerResource({
    id: 'pangular:pipe-usages',
    name: 'Angular Pipe Usages',
    description:
      'Pipes as JSON: `source` has each pipe with purity and template uses; `pipes`/`async` the live page usage, with churn and stale findings while recording. ' +
      LIVE_RESOURCE_NOTE,
    mimeType: 'application/json',
    read: () => ({
      text: liveResourceText(
        { source: scanPipes(ctx.cwd), ...currentPipes(pipePages) },
        'pangular:scan-pipes and pangular:explain-pipe',
        [...pipePages.keys()],
      ),
    }),
  });

  // The same states one page at a time, for the MCP resource templates (`agent-mcp.ts`).
  providePageResources(
    ctx,
    createPageResourceSource({
      states: {
        'component-tree': componentTree,
        'signal-graph': signalGraphState,
        'injector-tree': injectorTreeState,
        'ngrx-store': ngrxStoreState,
        forms: formsState,
        router: routerState,
      },
      touch: () => interest.touch(),
    }),
  );
}
