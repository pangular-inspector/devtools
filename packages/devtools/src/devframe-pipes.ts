// The Pipes inspector on the devframe server (`devframe.ts`): the
// `pipe-usage` shared state, its push and forget, recording requests and the
// pipe lint. Its agent tools live in `devframe-forms-tools.ts`.

import type { ResolvedPangularConfig } from './config.ts';
import { lintPipes } from './rpc/pipe-lint.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import type { PageTtl } from './rpc/page-ttl.ts';
import {
  currentPipes,
  isPipePageReport,
  mergePipePageReport,
  pipeInstrumentRequest,
  type PipePageReport,
  type PipesState,
} from './rpc/pipes-tools.ts';
import { createPushAcks } from './rpc/push-acks.ts';
import type { DevframeNodeContext, Owns, PangularScope, Register } from './devframe-env.ts';

/** What `registerPipes` reads from the devframe server's setup (`devframe.ts`). */
export interface PipesEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  mayForget: Owns;
  liveTtl: PageTtl;
}

export async function registerPipes(env: PipesEnv) {
  const { ctx, my, config, register, owns, mayForget, liveTtl } = env;
  const pipePages = new Map<string, PipePageReport & { reportedAt: number }>();
  const pipesState = await my.rpc.sharedState('pipe-usage', {
    initialValue: { pipes: [], async: [], reportedAt: 0, instrumented: [] } as PipesState,
  });

  const applyPipes = (next: PipesState) =>
    pipesState.mutate((draft) => {
      draft.pipes = next.pipes;
      draft.async = next.async;
      draft.reportedAt = next.reportedAt;
      draft.instrumented = next.instrumented;
      if (next.asyncTotal === undefined) delete draft.asyncTotal;
      else draft.asyncTotal = next.asyncTotal;
      if (next.pages === undefined) delete draft.pages;
      else draft.pages = next.pages;
    });

  // A closed tab drops its connection at once, so its entries go with it
  // instead of lingering until they expire.
  const pipeSessions = trackPageSessions(ctx.rpc, (pageIds) => {
    let removed = false;
    for (const pageId of pageIds) removed = pipePages.delete(pageId) || removed;
    if (removed) applyPipes(currentPipes(pipePages));
  });

  register({
    name: 'push-pipes',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      if (!isPipePageReport(report) || !owns(report.pageId)) return;
      pipeSessions.bind(report.pageId);
      applyPipes(mergePipePageReport(pipePages, report, Date.now(), liveTtl));
      pipeAcks.notify(report.pageId, report);
    },
  });

  register({
    name: 'forget-pipes-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: string) => {
      if (!mayForget(pageId)) return;
      pipeSessions.unbind(pageId);
      if (pipePages.delete(pageId)) {
        applyPipes(currentPipes(pipePages));
      }
    },
  });

  // Shared by the panel's Record calls button and the record-pipes agent tool.
  // A page confirms a recording request by pushing its pipe report again.
  const pipeAcks = createPushAcks<PipePageReport>();
  const requestPipeRecording = (message: unknown) => {
    const request = pipeInstrumentRequest(message, pipePages);
    // No page has reported yet: starting now would patch every connected tab.
    if (request.on && !request.pageId) return { request, pages: { pages: 0 } };
    void my.rpc.broadcast({ method: 'instrument-pipes', args: [request], optional: true });
    if (!request.pageId) return { request, pages: { pages: pipePages.size } };
    return { request, pages: { pages: pipePages.has(request.pageId) ? 1 : 0 } };
  };

  register({
    name: 'request-instrument-pipes',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => requestPipeRecording(message).pages,
  });

  register({
    name: 'pipe-lint',
    type: 'query',
    jsonSerializable: true,
    // A source scan like scan-pipes, so a static report bakes it in too.
    snapshot: true,
    handler: () => lintPipes(ctx.cwd, { rules: config.lint.rules }),
  });

  return { pipePages, applyPipes, pipeAcks, requestPipeRecording };
}
