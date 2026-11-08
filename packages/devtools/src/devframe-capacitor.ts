// The Capacitor inspector on the devframe server (`devframe.ts`): the
// `capacitor` shared state with patches, and its push and forget.

import { createSharedState } from 'devframe/utils/shared-state';
import type { ResolvedPangularConfig } from './config.ts';
import {
  mergeCapacitorReport,
  patchCapacitorState,
  syncCapacitorState,
  toCapacitorReport,
  type CapacitorPage,
  type CapacitorState,
} from './rpc/capacitor-tools.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import type { DevframeNodeContext, Owns, PangularScope, Register } from './devframe-env.ts';

export async function registerCapacitor(env: {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  mayForget: Owns;
}) {
  const { ctx, my, config, register, owns, mayForget } = env;
  const limits = config.limits;
  const capacitorPages = new Map<string, CapacitorPage>();
  // With patches on, a push sends the panel what changed, not every page:
  // devframe's own shared states send the whole value on each change.
  const capacitorShared = await my.rpc.sharedState('capacitor', {
    sharedState: createSharedState<CapacitorState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  });
  const applyCapacitor = () =>
    capacitorShared.mutate((draft) => syncCapacitorState(draft, capacitorPages));
  const capacitorSessions = trackPageSessions(ctx.rpc, (pageIds) => {
    let removed = false;
    for (const pageId of pageIds) removed = capacitorPages.delete(pageId) || removed;
    if (removed) applyCapacitor();
  });

  register({
    name: 'push-capacitor',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const report = toCapacitorReport(message);
      if (!report || !owns(report.pageId)) return { known: true };
      capacitorSessions.bind(report.pageId);
      const answer = mergeCapacitorReport(capacitorPages, report, limits.capacitorCalls);
      if (answer.known) {
        capacitorShared.mutate((draft) => patchCapacitorState(draft, capacitorPages, report));
      }
      return answer;
    },
  });

  register({
    name: 'forget-capacitor-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: string) => {
      if (!mayForget(pageId)) return;
      capacitorSessions.unbind(pageId);
      if (capacitorPages.delete(pageId)) applyCapacitor();
    },
  });

  return { capacitorPages, capacitorShared, applyCapacitor };
}
