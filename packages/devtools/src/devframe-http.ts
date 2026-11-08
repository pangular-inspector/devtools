// The HTTP inspector on the devframe server (`devframe.ts`): the `http` and
// `http-payloads` shared states, the server calls and SSR requests of this
// process, the pages' pushes, mock rules and SSR overrides. Its agent tools
// live in `devframe-http-tools.ts` and `devframe-refetch-tools.ts`.

import { actionBlockedMessage, type ResolvedPangularConfig } from './config.ts';
import type { HubFeed } from './hub-messages.ts';
import { sanitizeHydration, sanitizePayload, type PayloadSummary } from './http-payload.ts';
import {
  httpRegistry,
  sanitizeCalls,
  sanitizeRules,
  type HttpCall,
  type HttpRule,
} from './http-rules.ts';
import { redactCall } from './redaction.ts';
import { redactMessage, redactUrl } from './router.ts';
import { nameServerFns } from './rpc/analog-register.ts';
import { ssrOverrideTools } from './rpc/ssr-override-tools.ts';
import { sanitizeSsrRequest } from './rpc/ssr-tools.ts';
import { sanitizeSsrOverrides, type SsrOverride } from './ssr-overrides.ts';
import { isSsrRequestId, ssrRegistry } from './ssr-registry.ts';
import type { HttpPage, HttpPayloadState, HttpReport, HttpState } from './types.ts';
import { registerRefetchTools } from './devframe-refetch-tools.ts';
import type { AgentRegistrar, AnswersFor, Owns, PangularScope, Register } from './devframe-env.ts';

/** What `registerHttp` reads from the devframe server's setup (`devframe.ts`). */
export interface HttpEnv {
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  agent: AgentRegistrar;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  feed: HubFeed;
}

export async function registerHttp(env: HttpEnv) {
  const { my, config, register, agent, owns, mayForget, answersFor, feed } = env;
  const on = config.inspectors;
  const limits = config.limits;
  const httpPages = new Map<string, HttpPage>();
  const registry = httpRegistry();
  registry.dispose?.();
  registry.rules = on.http && config.actions.http ? (registry.rules ?? []) : [];
  const httpState = await my.rpc.sharedState('http', {
    initialValue: {
      serverCalls: [],
      requests: [],
      pages: [],
      rules: [...registry.rules],
      ssrOverrides: [],
    } as HttpState,
  });
  // Overrides change server responses, so they live only while this server runs.
  ssrRegistry().overrides = [];
  const httpPayloadState = await my.rpc.sharedState('http-payloads', {
    initialValue: { pages: {} } as HttpPayloadState,
  });
  const httpPayloads = new Map<string, PayloadSummary>();
  let pendingServerCalls: HttpCall[] = [];
  let pendingDropped = 0;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const flushServerCalls = () => {
    flushTimer = undefined;
    const batch = pendingServerCalls;
    pendingServerCalls = [];
    let dropped = pendingDropped;
    pendingDropped = 0;
    httpState.mutate((draft) => {
      draft.serverCalls.push(...batch);
      const extra = draft.serverCalls.length - limits.httpCalls;
      if (extra > 0) {
        draft.serverCalls.splice(0, extra);
        dropped += extra;
      }
      if (dropped) draft.serverDropped = (draft.serverDropped ?? 0) + dropped;
    });
  };
  const ssr = ssrRegistry();
  ssr.record = on.http
    ? (raw) => {
        const request = sanitizeSsrRequest(raw);
        if (!request) return;
        // Server calls are batched, so flush them first to keep their order.
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushServerCalls();
        }
        httpState.mutate((draft) => {
          draft.requests.push(request);
          const extra = draft.requests.length - limits.httpCalls;
          if (extra > 0) draft.requests.splice(0, extra);
        });
      }
    : undefined;
  registry.record = on.http
    ? (call) => {
        pendingServerCalls.push(redactCall(call));
        if (pendingServerCalls.length > limits.httpCalls) {
          pendingServerCalls.shift();
          pendingDropped++;
        }
        flushTimer ??= setTimeout(flushServerCalls, 100);
      }
    : () => {};
  const applyHttpPages = () =>
    httpState.mutate((draft) => {
      draft.pages = [...httpPages.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt);
    });
  const forgetHttpPages = (pageIds: string[]) => {
    for (const id of pageIds) httpPages.delete(id);
    applyHttpPages();
    if (!pageIds.filter((id) => httpPayloads.delete(id)).length) return;
    httpPayloadState.mutate((draft) => {
      for (const id of pageIds) delete draft.pages[id];
    });
  };
  const setHttpRules = (rules: HttpRule[]) => {
    registry.rules = rules;
    httpState.mutate((draft) => {
      draft.rules = rules;
    });
    void my.rpc.broadcast({ method: 'http-rules', args: [rules], optional: true });
    return rules;
  };

  register({
    name: 'push-http',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      const page = report as (Partial<HttpReport> & { payload?: unknown }) | null;
      if (!page || typeof page.pageId !== 'string' || typeof page.url !== 'string') return;
      if (page.pageId.length >= 50 || !owns(page.pageId)) return;
      const known = httpPages.get(page.pageId);
      const url = redactUrl(page.url);
      const hasPayload = page.payload !== undefined;
      if (!hasPayload && !known) return { needPayload: true };
      const calls = sanitizeCalls(page.calls, limits.httpCalls).map(redactCall);
      httpPages.set(page.pageId, {
        pageId: page.pageId,
        url,
        initialUrl: typeof page.initialUrl === 'string' ? redactUrl(page.initialUrl) : url,
        title:
          typeof page.title === 'string'
            ? redactMessage(page.title.slice(0, 2000)).slice(0, 200)
            : '',
        hydration: sanitizeHydration(page.hydration),
        calls:
          page.full === false && known
            ? [...known.calls, ...calls].slice(-limits.httpCalls)
            : calls,
        dropped:
          typeof page.dropped === 'number' && page.dropped > 0 ? Math.floor(page.dropped) : 0,
        ...(isSsrRequestId(page.ssrRequestId)
          ? { ssrRequestId: page.ssrRequestId }
          : known?.ssrRequestId
            ? { ssrRequestId: known.ssrRequestId }
            : {}),
        firstSeenAt: known?.firstSeenAt ?? Date.now(),
        reportedAt: Date.now(),
      });
      applyHttpPages();
      feed.hydration(page.pageId, httpPages.get(page.pageId)?.hydration);
      if (hasPayload) {
        const payload = nameServerFns(sanitizePayload(page.payload));
        httpPayloads.set(page.pageId, payload);
        httpPayloadState.mutate((draft) => {
          draft.pages[page.pageId!] = payload;
        });
      }
      return { needPayload: false };
    },
  });

  register({
    name: 'ping-http',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      const page = owns(pageId) ? httpPages.get(pageId) : undefined;
      if (!page) return { known: false };
      httpPages.set(page.pageId, { ...page, reportedAt: Date.now() });
      return { known: true };
    },
  });

  register({
    name: 'forget-http-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (mayForget(pageId) && httpPages.has(pageId)) forgetHttpPages([pageId]);
    },
  });

  register({
    name: 'get-http-rules',
    type: 'query',
    jsonSerializable: true,
    handler: () => registry.rules ?? [],
  });

  register({
    name: 'set-http-rules',
    type: 'action',
    jsonSerializable: true,
    handler: (rules: unknown) => {
      if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
      return setHttpRules(sanitizeRules(rules));
    },
  });

  const saveSsrOverrides = (overrides: SsrOverride[]) => {
    ssrRegistry().overrides = overrides;
    httpState.mutate((draft) => {
      draft.ssrOverrides = overrides;
    });
    return overrides;
  };
  register({
    name: 'set-ssr-overrides',
    type: 'action',
    jsonSerializable: true,
    handler: (input: unknown) => {
      if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
      return saveSsrOverrides(sanitizeSsrOverrides(input));
    },
  });
  registerRefetchTools({
    agent,
    answersFor,
    config,
    httpPages,
    httpPayloadState,
    httpPayloads,
    my,
    register,
  });

  // The panel's TransferState payload and SSR overrides, for agents.
  for (const tool of ssrOverrideTools({
    config,
    overrides: () => ssrRegistry().overrides ?? [],
    save: saveSsrOverrides,
    payloads: () => httpPayloads,
    pages: () => httpPages.values(),
  }))
    agent.registerTool(tool);

  const clearHttpCalls = () => {
    if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
    pendingServerCalls = [];
    pendingDropped = 0;
    for (const [id, page] of httpPages) httpPages.set(id, { ...page, calls: [], dropped: 0 });
    httpState.mutate((draft) => {
      draft.serverCalls = [];
      draft.serverDropped = 0;
      draft.requests = [];
      draft.pages = [...httpPages.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt);
    });
    void my.rpc.broadcast({ method: 'http-clear', args: [], optional: true });
  };

  register({
    name: 'clear-http-calls',
    type: 'action',
    jsonSerializable: true,
    handler: clearHttpCalls,
  });

  return {
    httpPages,
    registry,
    httpState,
    httpPayloadState,
    httpPayloads,
    ssr,
    forgetHttpPages,
    setHttpRules,
    clearHttpCalls,
    /** Drops the server calls waiting for their batch. */
    stopFlush: () => clearTimeout(flushTimer),
  };
}
