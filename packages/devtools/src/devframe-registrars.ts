// The setup's two registrars (`devframe.ts`): `register` for RPC functions and
// `agent` for agent tools and resources. Both skip what the config turns off;
// `agent` adds the tier, the tags and the page lease every tool gets.

import {
  agentAllowed,
  agentSafety,
  agentTags,
  autoLibraries,
  isPageAgentEntry,
  rpcAllowed,
  type PangularInspector,
  type ResolvedPangularConfig,
} from './config.ts';
import type { HubFeed } from './hub-messages.ts';
import { answeringText } from './rpc/agent-output.ts';
import { analogPages } from './rpc/analog-register.ts';
import { isAnalogProject } from './rpc/analog-scan.ts';
import { createLibraryGate, usedLibraries } from './rpc/library-tools.ts';
import { leased, type PageInterest } from './rpc/page-interest.ts';
import { namingPageRead } from './rpc/page-read-scope.ts';
import { readsSource, refusingTool } from './rpc/project-root.ts';
import { ToolRefusal } from './rpc/refusal.ts';
import { guardHandler } from './rpc/tool-input.ts';
import type {
  AgentRegistrar,
  AgentToolInput,
  DevframeNodeContext,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** What `createRegistrars` reads from the devframe server's setup (`devframe.ts`). */
export interface RegistrarsEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  /** Register the tools that need a connected page; off for the stdio MCP server. */
  pageTools: boolean;
  /** Why the source scans refuse, when the folder holds no Angular project. */
  rootRefusal: string | undefined;
  feed: HubFeed;
  /** Library inspectors the config leaves to the project (`autoLibraries`). */
  autoLibraries: readonly PangularInspector[] | undefined;
  /** The page URL lookup as it stands when a tool registers. */
  pageUrl: () => (pageId: string) => string | undefined;
  /** The page lease, which exists once the page registry does. */
  interest: () => PageInterest | undefined;
  /** Whether a page reports Capacitor or TanStack Query data now. */
  reporting: { capacitor: () => boolean; tanstackQuery: () => boolean };
}

export function createRegistrars(env: RegistrarsEnv): {
  register: Register;
  agent: AgentRegistrar;
} {
  const { ctx, my, config, pageTools, rootRefusal, feed } = env;
  const on = config.inspectors;
  const agentExposed = (entry: { id: string }) =>
    agentAllowed(entry, config) && (pageTools || !isPageAgentEntry(entry.id));
  const register: typeof my.rpc.register = (definition) => {
    if (!rpcAllowed(definition.name, config)) return;
    // A source scan of a folder without an Angular project refuses and names the folder.
    if (rootRefusal && definition.agent) {
      definition = {
        ...definition,
        handler: () => {
          throw new ToolRefusal(rootRefusal);
        },
      } as typeof definition;
    }
    const exposed = !definition.agent || agentAllowed({ id: definition.name }, config);
    if (!exposed) return my.rpc.register({ ...definition, agent: undefined });
    const agent = definition.agent && { ...definition.agent, tags: agentTags(definition.name) };
    my.rpc.register(agent ? { ...definition, agent } : definition);
  };
  // Analog, Capacitor and TanStack Query tools wait until the app uses the library.
  const libraryGate = createLibraryGate<AgentToolInput>({
    auto: env.autoLibraries ?? autoLibraries(),
    used: usedLibraries(env.autoLibraries ?? autoLibraries(), [ctx.cwd, ctx.workspaceRoot], () =>
      isAnalogProject(ctx.cwd),
    ),
    reporting: {
      analog: () => on.analog && analogPages().length > 0,
      capacitor: env.reporting.capacitor,
      tanstackQuery: env.reporting.tanstackQuery,
    },
    register: (tool) => registerAgentTool(tool),
  });
  const agent = {
    registerTool: (tool: AgentToolInput) => {
      if (agentExposed(tool) && !libraryGate.hold(tool)) registerAgentTool(tool);
    },
    registerResource: (resource: Parameters<typeof ctx.agent.registerResource>[0]) => {
      if (agentExposed(resource))
        ctx.agent.registerResource({ ...resource, read: leased(env.interest, resource.read) });
    },
  };
  function registerAgentTool(input: AgentToolInput) {
    const tool = rootRefusal && readsSource(input.id) ? refusingTool(input, rootRefusal) : input;
    // The tier and the tags come from the tool's entry in AGENT_ENTRIES, so
    // the config is the one place that sets them.
    ctx.agent.registerTool(
      feed.wrapTool({
        ...tool,
        // Every answer is one plain text block (rpc/agent-output.ts).
        outputSchema: undefined,
        safety: agentSafety(tool.id, config),
        tags: agentTags(tool.id),
        // Arguments are checked against `inputSchema` before the lease
        // wakes any page, and refusals go out with `isError`.
        handler: answeringText(
          guardHandler(
            tool.inputSchema,
            // A live tool's answer names the page it read.
            isPageAgentEntry(tool.id)
              ? namingPageRead(leased(env.interest, tool.handler), env.pageUrl())
              : leased(env.interest, tool.handler),
            tool.id,
          ),
        ),
      }),
    );
  }

  return { register, agent };
}
