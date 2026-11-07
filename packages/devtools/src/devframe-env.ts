// Types the parts of the devframe server's setup (`devframe.ts`) share. Each
// `devframe-*.ts` module takes what it reads from the setup as one `env`
// object, so the setup stays the one place that wires the inspectors.

import type { DevframeNodeContext, DevframeScopedNodeContext } from 'devframe';
import type { SignalGraph } from './types.ts';

export type { DevframeNodeContext } from 'devframe';
export type { SharedState } from 'devframe/utils/shared-state';

/** A tool as `ctx.agent.registerTool` takes it. */
export type AgentToolInput = Parameters<DevframeNodeContext['agent']['registerTool']>[0];
/** A resource as `ctx.agent.registerResource` takes it. */
export type AgentResourceInput = Parameters<DevframeNodeContext['agent']['registerResource']>[0];

/**
 * The setup's `agent`: registers a tool or resource unless the config turns it
 * off, with the tier, tags and lease the setup adds.
 */
export interface AgentRegistrar {
  registerTool: (tool: AgentToolInput) => void;
  registerResource: (resource: AgentResourceInput) => void;
}

/** The setup's `pangular` scope (`ctx.scope('pangular')`). */
export type PangularScope = DevframeScopedNodeContext<'pangular'>;

/** A page's signal graph as the setup keeps it. */
export type PageGraph = SignalGraph & { pageId?: string };
