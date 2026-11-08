import { lintHttpText } from './rpc/http-lint.ts';
import type { NavigationStream } from './rpc/router-stream.ts';
import {
  capacitorCallsText,
  capacitorPluginsText,
  type CapacitorPage,
} from './rpc/capacitor-tools.ts';
import {
  clearRouterNavigations,
  currentRouter,
  type RouterPage,
  type RouterState,
} from './rpc/router-tools.ts';
import { MAX_DELAY_MS, type HttpRule } from './http-rules.ts';
import { explainSsrRequestText, listSsrRequestsText } from './rpc/ssr-tools.ts';
import { listHttpCallsText } from './rpc/http-tools.ts';
import { httpWaterfallText } from './rpc/http-waterfall.ts';
import {
  addHttpRulePreset,
  HTTP_RULE_PRESET_IDS,
  httpRulesText,
  presetChangeText,
  removeHttpRule,
  ruleChangeText,
  upsertHttpRule,
  type RuleChange,
  type SetHttpRuleArgs,
} from './rpc/http-rule-tools.ts';
import type { HttpState } from './types.ts';
import { clearCalls } from './analog-server-log.ts';
import { PAGE_ARGUMENT, byRecency, pageArgument, unknownPageText } from './rpc/pages.ts';
import {
  actionBlockedMessage,
  clearRecordingTargets,
  type ResolvedPangularConfig,
} from './config.ts';
import { defaultPage } from './rpc/default-page.ts';
import { refusal } from './rpc/refusal.ts';
import type { AgentRegistrar, PangularScope, SharedState } from './devframe-env.ts';

import type { HttpRegistry } from './http-rules.ts';

type CapacitorToolArgs = {
  page?: string;
  plugin?: string;
  failed?: boolean;
  slowMs?: number;
  limit?: number;
};
/** What `registerHttpAgentTools` reads from the devframe server's setup (`devframe.ts`). */
export interface RegisterHttpAgentToolsEnv {
  agent: AgentRegistrar;
  applyRouter: (next: RouterState) => void;
  capacitorPages: Map<string, CapacitorPage>;
  clearHttpCalls: () => void;
  config: ResolvedPangularConfig;
  httpState: SharedState<HttpState>;
  my: PangularScope;
  registry: HttpRegistry;
  routerPages: Map<string, RouterPage>;
  setHttpRules: (rules: HttpRule[]) => HttpRule[];
  navigationStream: NavigationStream;
}

export function registerHttpAgentTools(env: RegisterHttpAgentToolsEnv) {
  const {
    agent,
    applyRouter,
    capacitorPages,
    clearHttpCalls,
    config,
    httpState,
    my,
    registry,
    routerPages,
    setHttpRules,
    navigationStream,
  } = env;
  const httpSnapshot = () => httpState.value() as HttpState;
  agent.registerTool({
    id: 'pangular:list-ssr-requests',
    title: 'List SSR requests',
    description:
      'Recent document requests the SSR server answered: id, URL, status, render mode, render time, server HttpClient calls and whether a page loaded the response. Needs ssrMiddleware or withPangularSsr(); empty otherwise.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many requests to list (1-100, default 20).' },
      },
    },
    handler: async (args: { limit?: number }) => {
      const state = httpSnapshot();
      return { markdown: listSsrRequestsText(state.requests, state.pages, args) };
    },
  });

  agent.registerTool({
    id: 'pangular:explain-ssr-request',
    title: 'Explain an SSR request',
    description:
      "One SSR request end to end (`id`, else newest for `url`, else newest): status, render mode, timings, headers, server HttpClient calls, then the page's hydration and any call it repeated instead of using the transfer cache.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Request id from list-ssr-requests.' },
        url: {
          type: 'string',
          description: 'Path and query of the page, such as /destinations.',
        },
      },
    },
    handler: async (args: { id?: string; url?: string }) => {
      const state = httpSnapshot();
      return {
        markdown: explainSsrRequestText(state.requests, state.serverCalls, state.pages, args),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:list-http-calls',
    title: 'List HTTP calls',
    description:
      'HttpClient calls from withPangular() and native fetch() calls, newest first: side, method, URL, status, duration, flags and response preview. `view: "waterfall"` draws a page\'s client calls per navigation. `headers` adds headers. Masked. Empty without the interceptor or a page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        url: { type: 'string', description: 'Only calls whose URL contains this text.' },
        failed: {
          type: 'boolean',
          description:
            'Only failed calls: status 400 or more, no response, an error, or cancelled.',
        },
        limit: {
          type: 'integer',
          description:
            'How many calls to list (1-200, default 30); with `view: "waterfall"`, how many navigations to draw (1-50, default 5).',
        },
        preview: {
          type: 'boolean',
          description: 'Add the masked response preview of each listed call.',
        },
        headers: {
          type: 'boolean',
          description: 'Add the masked request and response headers of each listed call.',
        },
        view: {
          type: 'string',
          enum: ['list', 'waterfall'],
          description:
            '`list` (default), or `waterfall`: start offset, duration and status of each client call, grouped by navigation. `url`, `failed` and `preview` apply to the list only.',
        },
      },
    },
    handler: async (args: {
      page?: string;
      url?: string;
      failed?: boolean;
      limit?: number;
      preview?: boolean;
      headers?: boolean;
      view?: 'list' | 'waterfall';
    }) => {
      if (args.view === 'waterfall') {
        const listOnly = (['url', 'failed', 'preview'] as const).filter(
          (key) => args[key] !== undefined,
        );
        if (listOnly.length) {
          return {
            markdown: refusal(
              `${listOnly.map((key) => `\`${key}\``).join(', ')} apply to the list, not to \`view: "waterfall"\`.`,
            ),
          };
        }
        return {
          markdown: httpWaterfallText(httpSnapshot(), {
            page: pageArgument(args),
            limit: args.limit,
            headers: args.headers,
          }),
        };
      }
      const snapshot = httpSnapshot();
      // Without `page`, the default page and the server render that served it, like every live tool.
      const page = pageArgument(args) ?? defaultPage(snapshot.pages ?? [])?.pageId;
      return { markdown: listHttpCallsText(snapshot, { ...args, page }) };
    },
  });

  agent.registerTool({
    id: 'pangular:lint-http',
    title: 'Lint HTTP calls',
    description:
      "Checks a page's recorded HttpClient calls for duplicate GETs, waterfalls (calls run one after another that could start together) and server calls the browser repeated. Each finding lists call ids and a fix. Masked.",
    inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
    handler: async (args: { page?: string }) => ({
      markdown: lintHttpText(httpSnapshot(), { page: pageArgument(args) }),
    }),
  });

  agent.registerTool({
    id: 'pangular:capacitor-list-calls',
    title: 'List Capacitor plugin calls',
    description:
      'Capacitor plugin calls, newest first: plugin, method, native or web target, arguments, result or error and duration, plus listeners. Filter by `plugin`, `failed` or `slowMs`. Masked.',
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        plugin: { type: 'string', description: 'Only calls to this plugin, such as Camera.' },
        failed: { type: 'boolean', description: 'Only calls that failed.' },
        slowMs: {
          type: 'integer',
          description: 'Only calls that took at least this many milliseconds.',
        },
        limit: { type: 'integer', description: 'How many calls to list (1-200, default 30).' },
      },
    },
    handler: async (args: CapacitorToolArgs) => ({
      markdown: capacitorCallsText(capacitorPages, { ...args, page: pageArgument(args) }),
    }),
  });

  agent.registerTool({
    id: 'pangular:capacitor-list-plugins',
    title: 'List Capacitor plugins',
    description:
      'The Capacitor environment (platform, server URL, CapacitorHttp, user agent) and each plugin: available, imported, installed natively, methods. Flags imported plugins that are missing natively.',
    inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
    handler: async (args: { page?: string }) => ({
      markdown: capacitorPluginsText(capacitorPages, { page: pageArgument(args) }),
    }),
  });

  const ruleInput = {
    id: { type: 'string', description: 'Rule id from list-http-rules. Leave out to add a rule.' },
    pattern: {
      type: 'string',
      description:
        'Part of the request URL, where `*` matches anything, such as /api/orders*. A leading `^` anchors it at the start of the path, such as ^/api/.',
    },
    method: { type: 'string', description: 'Only this method, such as GET. Any when left out.' },
    target: {
      type: 'string',
      enum: ['client', 'server', 'both'],
      description: 'Browser calls, SSR calls, or both (default).',
    },
    status: {
      type: 'integer',
      description:
        'Status to answer with: 400 or more fails the request, 0 fails it as a network error, others return `body`.',
    },
    delayMs: { type: 'integer', description: `Hold the request back (0-${MAX_DELAY_MS} ms).` },
    chance: {
      type: 'integer',
      description:
        'Apply to this percent of matching requests (1-99), rolled per request; the rest go on to the next rule. Every request when left out.',
    },
    body: { description: 'Mock response body: JSON text or a JSON value. Alone it answers 200.' },
    enabled: { type: 'boolean', description: 'Default true.' },
    preset: {
      type: 'string',
      enum: [...HTTP_RULE_PRESET_IDS],
      description:
        'Instead of the other arguments: add the plain rules of a built-in preset for every browser request. `offline` fails them with a network error, `slow-3g` holds them back 2000 ms, `flaky` fails 30% with 503.',
    },
  };
  const newRuleId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const httpRuleChange = (change: RuleChange, verb: 'Added' | 'Updated' | 'Removed') => {
    if (!config.actions.http) return { markdown: refusal(actionBlockedMessage('http')) };
    if ('error' in change) return { markdown: refusal(change.error) };
    setHttpRules(change.rules);
    return { markdown: ruleChangeText(verb, change.rule, change.rules) };
  };

  agent.registerTool({
    id: 'pangular:list-http-rules',
    title: 'List HTTP mock rules',
    description:
      'The HTTP fault and mock rules, in match order: id, on or off, method, URL pattern, browser or SSR scope and effect. Empty when no rule is set.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => ({
      markdown: httpRulesText(registry.rules ?? [], config.actions.http),
    }),
  });

  agent.registerTool({
    id: 'pangular:set-http-rule',
    title: 'Set an HTTP mock rule',
    description:
      'Add or replace (`id`) an HTTP fault or mock rule (dev only): `pattern` plus `status`, `delayMs` or `body`, or `preset` alone to add the Offline, Slow 3G or Flaky rules. Applies to every tab now and to SSR on the next load. Needs actions.http.',
    inputSchema: { type: 'object', properties: ruleInput },
    handler: async (args: SetHttpRuleArgs) => {
      const rules = registry.rules ?? [];
      if (args.pattern === undefined && args.preset === undefined) {
        return {
          markdown: refusal(
            `Pass \`pattern\` with \`status\`, \`delayMs\` or \`body\`, or \`preset\` alone (${HTTP_RULE_PRESET_IDS.map((id) => `\`${id}\``).join(', ')}).`,
          ),
        };
      }
      if (args.preset !== undefined) {
        if (!config.actions.http) return { markdown: refusal(actionBlockedMessage('http')) };
        const change = addHttpRulePreset(rules, args, newRuleId);
        if ('error' in change) return { markdown: refusal(change.error) };
        setHttpRules(change.rules);
        return { markdown: presetChangeText(change) };
      }
      const verb = typeof args.id === 'string' && args.id ? 'Updated' : 'Added';
      return httpRuleChange(upsertHttpRule(rules, args, newRuleId), verb);
    },
  });

  agent.registerTool({
    id: 'pangular:remove-http-rule',
    title: 'Remove an HTTP mock rule',
    description:
      'Removes the HTTP fault or mock rule with `id` (from list-http-rules) and returns the rules left. Needs the HTTP write action (actions.http).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Rule id from list-http-rules.' } },
      required: ['id'],
    },
    handler: async (args: { id?: unknown }) =>
      httpRuleChange(removeHttpRule(registry.rules ?? [], args.id), 'Removed'),
  });

  // Only the recordings this config lets an agent clear are offered as targets.
  const clearTargets: string[] = [...clearRecordingTargets(config), 'all'];
  const clearTargetList = clearTargets.map((target) => `\`${target}\``).join(', ');
  agent.registerTool({
    id: 'pangular:clear-recordings',
    title: 'Clear recordings',
    description: `Clear recorded HTTP calls, router navigations or Analog server calls between runs (\`target\`: ${clearTargetList}). \`page\` clears one page's navigations only.`,
    inputSchema: {
      type: 'object',
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          enum: clearTargets,
          description: `Which recordings to clear: ${clearTargetList}.`,
        },
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (args: { target?: unknown; page?: string }) => {
      const target = typeof args?.target === 'string' ? args.target : undefined;
      if (!target || !clearTargets.includes(target)) {
        return { markdown: refusal(`Pass \`target\`: one of ${clearTargetList}.`) };
      }

      const pageId = pageArgument(args as Record<string, unknown> | undefined);
      if (pageId && (target === 'router' || target === 'all') && !routerPages.has(pageId)) {
        return {
          markdown: unknownPageText(pageId, byRecency(routerPages.values()), 'a router report'),
        };
      }

      const cleared: string[] = [];
      const skipped: string[] = [];

      const httpEligible = config.actions.http && config.agent.tools.http && config.inspectors.http;
      if (target === 'http' || target === 'all') {
        if (!httpEligible) {
          const reason = !config.actions.http
            ? 'actions.http is turned off'
            : !config.agent.tools.http
              ? 'agent.tools.http is turned off'
              : 'inspectors.http is turned off';
          if (target === 'http') {
            if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
            throw new Error(`HTTP recording is disabled in the devtools config (${reason}).`);
          }
          skipped.push(`HTTP calls (${reason})`);
        } else {
          clearHttpCalls();
          cleared.push('recorded HTTP calls');
        }
      }

      const routerEligible =
        config.actions.router && config.agent.tools.router && config.inspectors.router;
      if (target === 'router' || target === 'all') {
        if (!routerEligible) {
          const reason = !config.actions.router
            ? 'actions.router is turned off'
            : !config.agent.tools.router
              ? 'agent.tools.router is turned off'
              : 'inspectors.router is turned off';
          if (target === 'router') {
            if (!config.actions.router) throw new Error(actionBlockedMessage('router'));
            throw new Error(`Router recording is disabled in the devtools config (${reason}).`);
          }
          skipped.push(`router navigations (${reason})`);
        } else {
          if (pageId) {
            if (clearRouterNavigations(routerPages, pageId)) {
              applyRouter(currentRouter(routerPages));
            }
            navigationStream.clear(pageId);
            void my.rpc.broadcast({ method: 'router-clear', args: [{ pageId }], optional: true });
            cleared.push(`router navigations for page "${pageId}"`);
          } else {
            for (const id of routerPages.keys()) {
              clearRouterNavigations(routerPages, id);
              void my.rpc.broadcast({
                method: 'router-clear',
                args: [{ pageId: id }],
                optional: true,
              });
            }
            applyRouter(currentRouter(routerPages));
            navigationStream.clear();
            cleared.push('router navigations');
          }
        }
      }

      const analogEligible =
        config.actions.analog && config.agent.tools.analog && config.inspectors.analog;
      if (target === 'analog' || target === 'all') {
        if (!analogEligible) {
          const reason = !config.actions.analog
            ? 'actions.analog is turned off'
            : !config.agent.tools.analog
              ? 'agent.tools.analog is turned off'
              : 'inspectors.analog is turned off';
          if (target === 'analog') {
            if (!config.actions.analog) throw new Error(actionBlockedMessage('analog'));
            throw new Error(`Analog recording is disabled in the devtools config (${reason}).`);
          }
          skipped.push(`Analog calls (${reason})`);
        } else {
          clearCalls();
          cleared.push('Analog server calls');
        }
      }

      if (cleared.length === 0) {
        return { markdown: `No recordings were cleared. Skipped: ${skipped.join(', ')}.` };
      }

      let message = `Cleared ${cleared.join(', ')}.`;
      if (skipped.length > 0) {
        message += ` Skipped: ${skipped.join(', ')}.`;
      }
      return { markdown: message };
    },
  });
}
