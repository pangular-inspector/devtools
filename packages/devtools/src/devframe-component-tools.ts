import { forBlocksText } from './rpc/for-blocks-tools.ts';
import {
  HYDRATION_DESCRIPTION,
  hydrationOverlayText,
  hydrationText,
} from './rpc/hydration-tools.ts';
import { inspectProvidersText } from './rpc/injector-tools.ts';
import { TOKEN_ID_ARGUMENT } from './rpc/token-match.ts';
import { registerInjectionExplain } from './rpc/injection-explain.ts';
import { templateLintTool } from './rpc/template-lint-tool.ts';
import { SIGNAL_TOOL_MAX, signalGraphText, type InspectSignalsArgs } from './rpc/signal-tools.ts';
import { noSelectorMatchText, signalPeekFor } from './rpc/signal-peeks.ts';
import { injectorMatches, isEnvironmentRequest } from './signal-graph.ts';
import type {
  ComponentDetail,
  ComponentPage,
  InjectorPage,
  LiveComponentNode,
  SignalGraph,
} from './types.ts';
import { zoneModeText } from './zone-mode.ts';
import {
  deferBlocksText,
  directiveHostText,
  otherMatchesText,
  truncationText,
} from './rpc/component-tools.ts';
import { LIST_COMPONENTS_DESCRIPTION, listComponentsText } from './rpc/component-outline.ts';
import { inspectComponentText } from './rpc/component-detail-text.ts';
import { valueResultText } from './rpc/component-values.ts';
import { parsePath } from './component-edit.ts';
import { UNTRUSTED, untrusted } from './rpc/forms-tools.ts';
import { type RouterPage } from './rpc/router-tools.ts';
import {
  cdOptionsText,
  cdUnknownPageText,
  cdViewsAsked,
  cdViewsText,
  changeDetectionText,
  pickCdPage,
  type CdPage,
  type CdState,
} from './rpc/cd-tools.ts';
import { cdExportText } from './rpc/cd-export-tools.ts';
import { cdDiagnosisText } from './rpc/cd-diagnosis-tools.ts';
import { unsupportedToolText } from './rpc/angular-pages.ts';
import {
  PAGE_ARGUMENT,
  byRecency,
  pageArgument,
  nativeAppName,
  needsDomText,
  unknownPageText,
} from './rpc/pages.ts';
import { clip } from './text.ts';
import { agentToolOffered, angularUnavailableText, type ResolvedPangularConfig } from './config.ts';
import { defaultPage, rankPages } from './rpc/default-page.ts';
import { cdRecordAnswer } from './rpc/cd-record-tool.ts';
import { refusal, refusedAnswer } from './rpc/refusal.ts';
import type {
  AgentRegistrar,
  DevframeNodeContext,
  PageGraph,
  PangularScope,
  SharedState,
} from './devframe-env.ts';

import type { AngularPageInfo } from './config.ts';
import type { AngularPage } from './rpc/angular-pages.ts';
import type { AngularPagesState } from './rpc/angular-pages.ts';
import type { PushAcks } from './rpc/push-acks.ts';
import type { ComponentValueResult } from './component-values.ts';
import type { ProviderValueResult } from './provider-values.ts';
import type { SignalPeekTarget } from './signal-peek.ts';

const ENV_WAIT_MS = 1500;
const AGENT_HIGHLIGHT_MS = 2000;
/** What `registerComponentAgentTools` reads from the devframe server's setup (`devframe.ts`). */
export interface RegisterComponentAgentToolsEnv {
  agent: AgentRegistrar;
  angularPages: {
    set(report: AngularPageInfo & { pageId: string }): boolean;
    forget(pageId: string): boolean;
    expire(ttl: (pageId: string) => number): boolean;
    get(pageId: string | undefined): AngularPage | undefined;
    pick(pageId?: string): AngularPage | undefined;
    snapshot(): AngularPagesState;
  };
  cdAcks: PushAcks<CdPage>;
  cdState: SharedState<CdState>;
  componentHits: (
    selector: string,
    pageId?: string,
  ) => { pageId: string; node: LiveComponentNode }[];
  componentPageProperty: { type: string; description: string };
  componentPages: Map<string, ComponentPage>;
  componentValues: {
    answer: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => void;
    request: (page: unknown, message: unknown) => Promise<ComponentValueResult>;
    pendingCount: () => number;
  };
  config: ResolvedPangularConfig;
  ctx: DevframeNodeContext;
  goneCdPages: Set<string>;
  injectorPages: Map<string, InjectorPage>;
  latestInjectorPage: () => InjectorPage;
  my: PangularScope;
  noComponentTree: (outcome: string) => string;
  providerValues: {
    answer: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => void;
    request: (page: unknown, message: unknown) => Promise<ProviderValueResult>;
    tool: {
      id: string;
      title: string;
      description: string;
      inputSchema: {
        type: string;
        properties: {
          token: { type: string; description: string };
          tokenId: {
            readonly type: 'string';
            readonly description: 'Optional. The `tokenId` of the token (`tok-3`), from the injector tree or from an answer that lists several tokens with the same name. Pass it when two tokens share a name, such as two `InjectionToken` with the description `config`.';
          };
          injector: { type: string; description: string };
          path: { type: string; description: string };
          depth: { type: string; description: string };
          limit: { type: string; description: string };
          page: {
            readonly type: 'string';
            readonly description: 'Page id, when more than one tab reports (see pangular:list-pages). Defaults to its first row.';
          };
        };
        required: string[];
      };
      handler: (args: Record<string, unknown>) => Promise<{ markdown: string }>;
    };
    pendingCount: () => number;
  };
  register: PangularScope['rpc']['register'];
  requestCdOptions: (message: unknown) => void;
  requestCdRecord: (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => void;
  requestHydrationOverlay: (message: { pageId?: unknown; on?: unknown } | null) => void;
  routerPages: Map<string, RouterPage>;
  selectComponentOnPage: (pageId: string | undefined, id: string | null, console?: boolean) => void;
  signalGraphState: SharedState<{
    graph: SignalGraph | null;
    pages: Record<string, SignalGraph>;
    selectedNodeId: string | null;
  }>;
  signalPages: Map<string, { graph: PageGraph; reportedAt: number }>;
  signalPeeks: {
    request: (
      send: (message: SignalPeekTarget & { requestId: string; pageId?: string }) => void,
      target: SignalPeekTarget,
      pageId: string | undefined,
      pages: readonly string[],
      timeoutMs: number,
    ) => Promise<PageGraph | null>;
    answer: (message: unknown) => void;
  };
  unknownComponentPage: (pageId: string | undefined) => { markdown: string } | null;
  waitForComponentDetail: (
    pageId: string,
    id: string,
    timeoutMs?: number,
  ) => Promise<ComponentDetail | null>;
}

export function registerComponentAgentTools(env: RegisterComponentAgentToolsEnv) {
  const {
    agent,
    angularPages,
    cdAcks,
    cdState,
    componentHits,
    componentPageProperty,
    componentPages,
    componentValues,
    config,
    ctx,
    goneCdPages,
    injectorPages,
    latestInjectorPage,
    my,
    noComponentTree,
    providerValues,
    register,
    requestCdOptions,
    requestCdRecord,
    requestHydrationOverlay,
    routerPages,
    selectComponentOnPage,
    signalGraphState,
    signalPages,
    signalPeeks,
    unknownComponentPage,
    waitForComponentDetail,
  } = env;
  agent.registerTool({
    id: 'pangular:highlight',
    title: 'Highlight a component',
    description:
      'Outline a component in the page and select it, so component-tree and inspect-signals follow it: `component` (instance id, class or tag; the first of several matches) or `selector` (CSS). `hydration: true` outlines the hydration regions instead, `false` removes them.',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description:
            'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag (e.g. app-root).',
        },
        selector: { type: 'string', description: 'A CSS selector, such as .card > h2.' },
        hydration: {
          type: 'boolean',
          description:
            'Outline the hydration regions on the page (true), or remove the outline (false).',
        },
        page: componentPageProperty,
      },
    },
    handler: async (args: {
      component?: string;
      selector?: string;
      hydration?: boolean;
      page?: string;
    }) => {
      const page = pageArgument(args);
      const all = byRecency(componentPages.values());
      if (page && !componentPages.has(page)) {
        return { markdown: unknownPageText(page, all, 'a component tree') };
      }
      const pages = page ? all.filter((entry) => entry.pageId === page) : all;
      const given = (['component', 'selector', 'hydration'] as const).filter(
        (key) => args[key] !== undefined,
      );
      if (given.length !== 1) {
        return {
          markdown: refusal(
            'Pass one of `component` (an instance id, class name or host tag), `selector` (a CSS selector) or `hydration` (true or false).',
          ),
        };
      }
      if (args.hydration !== undefined) {
        const done = hydrationOverlayText(args.hydration, pages);
        const sent = args.hydration ? pages.some((entry) => entry.hydration) : pages.length > 0;
        // Nothing to send the request to is a refusal, not a request sent.
        if (!sent) return { markdown: refusal(`${done}\n\n${hydrationText(pages)}`) };
        requestHydrationOverlay({ pageId: page, on: args.hydration });
        return { markdown: `${done}\n\n${hydrationText(pages)}` };
      }
      if (!pages.some((entry) => entry.roots.length)) {
        return refusedAnswer(noComponentTree(', so nothing was highlighted'));
      }
      const wanted = args.component ?? args.selector;
      if (typeof wanted !== 'string' || !wanted.trim()) {
        return {
          markdown: refusal(
            args.component !== undefined
              ? 'Pass `component`: an instance id, class name or host tag.'
              : 'Pass `selector`: a CSS selector.',
          ),
        };
      }
      if (args.selector !== undefined) {
        const target = page ? { pageId: page, selector: wanted } : wanted;
        const shown = typeof target === 'string' ? { selector: target } : target;
        void my.rpc.broadcast({
          method: 'highlight-in-page',
          args: [{ ...shown, reveal: true, durationMs: AGENT_HIGHLIGHT_MS }],
          optional: true,
        });
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [target],
          optional: true,
        });
        return {
          markdown: `Sent the CSS selector \`${wanted}\` to ${page ? `page \`${page}\`` : `every page (${pages.map((entry) => `\`${entry.pageId}\``).join(', ')})`}; the page outlines it only if an element matches, which the page does not confirm.`,
        };
      }
      const hits = componentHits(wanted, page);
      const [hit] = hits;
      if (!hit) {
        const cut = truncationText(pages);
        return {
          markdown: refusal(
            `No component instance matches \`${wanted}\`${page ? ` on page \`${page}\`` : ''}, so nothing was highlighted. Pass an instance id, class name or host tag from pangular:list-components, or a CSS selector as \`selector\`.${cut ? ` ${cut}` : ''}`,
          ),
        };
      }
      const target = { pageId: hit.pageId, id: hit.node.id };
      void my.rpc.broadcast({
        method: 'highlight-in-page',
        args: [{ ...target, reveal: true, durationMs: AGENT_HIGHLIGHT_MS }],
        optional: true,
      });
      void my.rpc.broadcast({
        method: 'select-signal-component',
        args: [target],
        optional: true,
      });
      selectComponentOnPage(hit.pageId, hit.node.id);
      const others = otherMatchesText(hits, wanted);
      const otherPages = [
        ...new Set(hits.map((entry) => entry.pageId).filter((id) => id !== hit.pageId)),
      ];
      const also = otherPages.length
        ? ` It also matches on ${otherPages.map((id) => `\`${id}\``).join(', ')}. Pass \`page\` to pick another tab.`
        : '';
      return {
        markdown: `Sent a highlight request for \`${hit.node.name}\` (\`<${hit.node.tag}>\`, instance \`${hit.node.id}\` on page \`${hit.pageId}\`) and selected it.${also}${others ? `\n\n${others}` : ''}`,
      };
    },
  });

  agent.registerTool({
    id: 'pangular:inspect-component',
    title: 'Inspect a component',
    description:
      'Live details of a component instance (`component`: id, class or tag): inputs, outputs, properties, listeners, host directives, DI dependencies, change detection and source. Fields say `edit` or `locked`. `path` reads a nested value. Masked; cut at 20,000 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: 'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag.',
        },
        path: {
          type: 'string',
          description:
            'Read one value instead of the whole detail: an input or property name, then keys and indexes, such as `user.address` or `items[0]` (an index counts the entries of a Map or Set).',
        },
        depth: {
          type: 'number',
          description: 'With `path`: levels to read below it, 1 to 5. Defaults to 1.',
        },
        limit: {
          type: 'number',
          description: 'With `path`: most entries per object or list, 1 to 1000. Defaults to 30.',
        },
        page: componentPageProperty,
      },
      required: ['component'],
    },
    handler: async (args: {
      component: string;
      path?: unknown;
      depth?: unknown;
      limit?: unknown;
      page?: string;
    }) => {
      const page = pageArgument(args);
      const valuePath = args.path === undefined || args.path === '' ? null : parsePath(args.path);
      if (args.path !== undefined && args.path !== '' && !valuePath) {
        return {
          markdown:
            'Pass `path` as a property name, or a path such as `user.address` or `items[0]`.',
        };
      }
      const unknown = unknownComponentPage(page);
      if (unknown) return unknown;
      if (![...componentPages.values()].some((entry) => entry.roots.length)) {
        return { markdown: noComponentTree('') };
      }
      if (typeof args.component !== 'string' || !args.component.trim()) {
        return { markdown: 'Pass `component`: an instance id, class name or host tag.' };
      }
      const hits = componentHits(args.component, page);
      const [hit] = hits;
      if (!hit) {
        return {
          markdown: [
            `No component instance matches \`${args.component}\`. Pass an instance id, class name or host tag from the pangular:component-tree resource.`,
            truncationText(
              [...componentPages.values()].filter((entry) => !page || entry.pageId === page),
            ),
          ]
            .filter(Boolean)
            .join(' '),
        };
      }
      if (hit.node.kind === 'directive') {
        return { markdown: untrusted(directiveHostText(hit.node, hit.pageId)) };
      }
      const others = otherMatchesText(hits, args.component);
      if (valuePath) {
        const whole = (value: unknown) =>
          typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
        const result = await componentValues.request(hit.pageId, {
          id: hit.node.id,
          path: valuePath,
          depth: whole(args.depth),
          limit: whole(args.limit),
        });
        const text = valueResultText(result, { ...hit.node, pageId: hit.pageId }, valuePath);
        return { markdown: others ? `${text}\n\n${others}` : text };
      }
      selectComponentOnPage(hit.pageId, hit.node.id);
      const detail = await waitForComponentDetail(hit.pageId, hit.node.id);
      if (!detail) {
        return {
          markdown: `Selected \`${hit.node.name}\` (instance \`${hit.node.id}\` on page \`${hit.pageId}\`), but the page did not report its detail within 3 seconds. The instance may have been destroyed, or the tab may be in the background. Try again, or read the pangular:component-tree resource later.${others ? `\n\n${others}` : ''}`,
        };
      }
      return {
        // The notice is part of the heading, so the cap counts it too.
        markdown: inspectComponentText(
          detail,
          untrusted(
            `Live detail of \`${detail.name}\` (\`<${detail.tag}>\`, instance \`${detail.id}\` on page \`${hit.pageId}\`), read from the running page.${others ? `\n\n${others}` : ''}`,
          ),
        ),
      };
    },
  });

  agent.registerTool({
    id: 'pangular:list-components',
    title: 'List live components',
    description: LIST_COMPONENTS_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        filter: {
          type: 'string',
          description:
            'Search: plain text found in a class name, host tag or host directive (case-insensitive), `<tag>` for a host tag and `[dir]` for a directive, as in `<button> [matTooltip]`. Every part must match. Matches keep their ancestors.',
        },
        depth: {
          type: 'number',
          description: 'Most levels to list, 1 for the roots only. Unlimited without it.',
        },
        directiveHosts: {
          type: 'boolean',
          description:
            'False leaves out the elements that host directives but no component. Listed by default.',
        },
      },
    },
    handler: async (args: {
      page?: string;
      filter?: string;
      depth?: number;
      directiveHosts?: boolean;
    }) => ({
      markdown: listComponentsText(
        componentPages.values(),
        (pageId) => routerPages.get(pageId)?.outlets,
        {
          page: pageArgument(args),
          filter: typeof args?.filter === 'string' ? args.filter : undefined,
          depth: typeof args?.depth === 'number' ? args.depth : undefined,
          directiveHosts: args?.directiveHosts !== false,
        },
      ),
    }),
  });

  agent.registerTool({
    id: 'pangular:defer-blocks',
    title: 'List @defer blocks',
    description:
      'Live @defer blocks: owning component, state, triggers and incremental hydration, flagging failed loads, stuck placeholders and dehydrated blocks. Every page unless `page` names one.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
        },
      },
    },
    handler: async (args: { page?: string }) => {
      const page = pageArgument(args);
      return (
        unknownComponentPage(page) ?? {
          markdown: deferBlocksText(
            byRecency(componentPages.values()).filter((entry) => !page || entry.pageId === page),
            Date.now(),
            angularPages.get,
          ),
        }
      );
    },
  });

  agent.registerTool(templateLintTool(ctx.cwd, { rules: config.lint.rules }));

  agent.registerTool({
    id: 'pangular:for-blocks',
    title: 'List @for blocks',
    description:
      'Live @for blocks (Angular 22+ dev builds): owning component, item count, what `track` uses, and @empty status. Every page unless `page` names one. Up to 50 blocks per page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
        },
      },
    },
    handler: async (args: { page?: string }) => {
      const page = pageArgument(args);
      return (
        unknownComponentPage(page) ?? {
          markdown: forBlocksText(
            byRecency(componentPages.values()).filter((entry) => !page || entry.pageId === page),
            angularPages.get,
          ),
        }
      );
    },
  });

  agent.registerTool({
    id: 'pangular:hydration',
    title: 'Check hydration',
    description: `${HYDRATION_DESCRIPTION} pangular:highlight with \`hydration: true\` outlines the regions on the page.`,
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description:
            'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
        },
      },
    },
    handler: async (args: { page?: string }) => {
      const page = pageArgument(args);
      const unknown = unknownComponentPage(page);
      if (unknown) return unknown;
      const pages = byRecency(componentPages.values()).filter(
        (entry) => !page || entry.pageId === page,
      );
      return { markdown: hydrationText(pages) };
    },
  });

  const cdUnknown = (page: string | undefined) =>
    page &&
    cdUnknownPageText(
      page,
      cdState.value() as CdState,
      [...componentPages.values(), ...injectorPages.values()].filter(
        (entry) => !goneCdPages.has(entry.pageId),
      ),
    );

  // `agent.readOnly` leaves `record-change-detection` out: answers then name only the panel.
  const canRecordCd = agentToolOffered('record-change-detection', config);
  agent.registerTool({
    id: 'pangular:change-detection',
    title: 'Read change detection',
    description: `Change detection cycles from Angular's profiler (Angular 20+ dev builds): slowest components, checks, durations and the zone mode. ${canRecordCd ? 'pangular:record-change-detection starts a recording' : 'Record in the panel starts a recording'}. \`export\`: json or trace.`,
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
        limit: { type: 'number', description: 'Rows per list (default 10, max 50).' },
        export: {
          type: 'string',
          enum: ['json', 'trace'],
          description:
            'Return the recording as JSON instead of a summary: `json` for the panel file, `trace` for Perfetto.',
        },
      },
    },
    handler: async (args: { page?: string; limit?: number; export?: string }) => {
      const unknown = cdUnknown(args?.page);
      if (unknown) return { markdown: unknown };
      if (args?.export !== undefined) {
        if (args.export !== 'json' && args.export !== 'trace') {
          return { markdown: refusal('`export` must be `json` or `trace`.') };
        }
        return {
          markdown: cdExportText(
            cdState.value() as CdState,
            { page: args.page, export: args.export },
            undefined,
            angularPages.get,
            canRecordCd,
          ),
        };
      }
      const cd = cdState.value() as CdState;
      const text = changeDetectionText(cd, args ?? {}, angularPages.get, canRecordCd);
      // The zone mode comes from the same page as the recording, not the latest tab.
      const zonePage = args?.page ?? pickCdPage(cd)?.pageId;
      const injectors = zonePage ? injectorPages.get(zonePage) : latestInjectorPage();
      const mode = injectors ? zoneModeText(injectors.zone, injectors.pageId) : '';
      const options = cdOptionsText(pickCdPage(cd, args?.page)?.options);
      const parts = [mode, text, options].filter(Boolean);
      return { markdown: parts.join('\n\n') };
    },
  });

  agent.registerTool({
    id: 'pangular:record-change-detection',
    title: 'Record change detection',
    description:
      'Start, stop or clear a change detection recording (`record`), and turn the live views on or off: `flash` boxes each checked component, `track` adds a Chrome Performance panel track, `angularProfiling` calls ng.enableProfiling(). Read the result with pangular:change-detection.',
    inputSchema: {
      type: 'object',
      properties: {
        record: { type: 'string', enum: ['start', 'stop', 'clear'] },
        flash: {
          type: 'boolean',
          description:
            'Turn the flash overlay on or off: a box over each component as it is checked.',
        },
        track: {
          type: 'boolean',
          description: 'Turn the "Pangular" track in the Chrome Performance panel on or off.',
        },
        angularProfiling: {
          type: 'boolean',
          enum: [true],
          description:
            "Call `ng.enableProfiling()` for Angular's own Performance panel track. It cannot be turned off until the page reloads.",
        },
        page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
      },
    },
    handler: async (args: {
      record?: string;
      page?: string;
      flash?: boolean;
      track?: boolean;
      angularProfiling?: boolean;
    }) => {
      const unknown = cdUnknown(args?.page);
      if (unknown) return { markdown: unknown };
      if (args?.record === undefined && !cdViewsAsked(args)) {
        return {
          markdown: refusal(
            'Pass `record` (start, stop or clear), or `flash`, `track` or `angularProfiling`.',
          ),
        };
      }
      if (
        args.record !== undefined &&
        args.record !== 'start' &&
        args.record !== 'stop' &&
        args.record !== 'clear'
      ) {
        return { markdown: refusal('`record` must be `start`, `stop` or `clear`.') };
      }
      // The live views draw on a DOM or into the browser's Performance panel.
      const liveViews = 'the flash overlay, the Performance panel track and Angular profiling';
      const reporting = [...componentPages.values()];
      const noViews = !cdViewsAsked(args)
        ? undefined
        : args?.page
          ? needsDomText(args.page, componentPages.get(args.page)?.platform, liveViews)
          : reporting.length > 0 && reporting.every((page) => nativeAppName(page.platform))
            ? `Every page that reports is an Angular Native or NativeScript app, which renders native views and has no DOM, so ${liveViews} need a page in a browser. pangular:list-pages lists each page's platform.`
            : undefined;
      // A native page skips the live views, but a `record` in the same call still runs.
      const views = noViews
        ? `${noViews} Recording with \`record\` works there.`
        : cdViewsAsked(args)
          ? cdViewsText(args)
          : '';
      if (noViews && args.record === undefined) return { markdown: views };
      if (views && !noViews) {
        requestCdOptions({
          pageId: args.page,
          flash: args.flash,
          track: args.track,
          angularProfiling: args.angularProfiling,
        });
        if (args.record === undefined) return { markdown: views };
      }
      const record = args.record as 'start' | 'stop' | 'clear';
      const cdNow = cdState.value() as CdState;
      const answer = await cdRecordAnswer({
        record,
        page: args.page,
        connected: rankPages(
          [...componentPages.values(), ...injectorPages.values(), ...Object.values(cdNow.pages)]
            .filter((page) => !goneCdPages.has(page.pageId))
            .filter((page, i, all) => all.findIndex((p) => p.pageId === page.pageId) === i),
        ).map((page) => page.pageId),
        recording: Object.values(cdNow.pages)
          .filter((page) => page.recording && !goneCdPages.has(page.pageId))
          .map((page) => page.pageId),
        send: () =>
          requestCdRecord({
            pageId: args.page,
            on: record === 'clear' ? undefined : record === 'start',
            clear: record === 'clear',
          }),
        acks: cdAcks,
        angularOf: angularPages.get,
      });
      if ('refused' in answer) return answer;
      const next = answer.markdown;
      if (noViews) return { markdown: `${noViews}\n\n${next}` };
      return { markdown: views ? `${next}\n\n${views}` : next };
    },
  });

  agent.registerTool({
    id: 'pangular:diagnose-change-detection',
    title: 'Diagnose change detection',
    description:
      'Why change detection ran and what it wasted, from a recording: what started each cycle, components changed only in zone ticks, checks that changed nothing, mutated or same-value inputs, and OnPush hints. Empty until a recording ran.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
        limit: { type: 'number', description: 'Rows per list (default 10, max 50).' },
      },
    },
    handler: async (args: { page?: string; limit?: number }) => {
      const unknown =
        args?.page &&
        cdUnknownPageText(
          args.page,
          cdState.value() as CdState,
          [...componentPages.values(), ...injectorPages.values()].filter(
            (page) => !goneCdPages.has(page.pageId),
          ),
        );
      if (unknown) return { markdown: unknown };
      const cd = cdState.value() as CdState;
      const zonePage = args?.page ?? pickCdPage(cd)?.pageId;
      const injectors = zonePage ? injectorPages.get(zonePage) : latestInjectorPage();
      const mode = injectors ? zoneModeText(injectors.zone, injectors.pageId) : '';
      const text = cdDiagnosisText(cd, args ?? {}, angularPages.get, canRecordCd);
      return { markdown: [mode, text].filter(Boolean).join('\n\n') };
    },
  });

  agent.registerTool({
    id: 'pangular:inspect-signals',
    title: 'Inspect signals',
    description:
      'Live signal graph: nodes, edges (`consumer` reads `producer`, by node id), resources and value history. `component` names a component, `root` or a route; `selector` a component host by CSS; `node` narrows to one node. Only signals something read appear.',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description:
            'Host tag, class name or instance id of the component (e.g. app-root), `root`, or a route path (e.g. /admin).',
        },
        selector: {
          type: 'string',
          maxLength: 500,
          description:
            'Instead of `component`: a CSS selector for a component host (e.g. app-card.featured). The first match on the page is read.',
        },
        node: {
          type: 'string',
          description:
            'Node id or label. Returns only that node (every node with that label) and its direct producers and consumers, with their resources and history.',
        },
        history: {
          type: 'boolean',
          description: 'False leaves out the value history of every node. Defaults to true.',
        },
        framework: {
          type: 'boolean',
          description:
            'False leaves out the nodes Angular itself created (`framework: true`). Defaults to true.',
        },
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (
      args: { component?: string; selector?: string; page?: string } & InspectSignalsArgs,
    ) => {
      const bySelector = args?.selector !== undefined;
      const wanted = bySelector ? args.selector : args?.component;
      if (
        (bySelector && args.component !== undefined) ||
        typeof wanted !== 'string' ||
        !wanted.trim()
      ) {
        return {
          markdown: refusal(
            'Pass one of `component` (a host tag, class name or instance id such as app-root, `root` for root service effects, or a route path such as /admin) or `selector` (a CSS selector for a component host).',
          ),
        };
      }
      // `broadcast` resolves with nothing, so the page cannot answer a
      // question. Read the graph the overlay pushes into shared state.
      const page = pageArgument(args);
      const all = byRecency([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry })));
      if (page && !signalPages.has(page)) {
        return { markdown: unknownPageText(page, all, 'a signal graph') };
      }
      const matches = (g: PageGraph) =>
        !bySelector &&
        ([
          g.componentSelector,
          g.component?.name,
          g.component?.id,
          g.element?.id,
          g.element?.injectorId,
        ].includes(wanted) ||
          (!!g.element && g.element.directives.includes(wanted)) ||
          (!!g.injector && injectorMatches(g.injector, wanted)));
      const latestMatch = () =>
        byRecency(
          [...signalPages]
            .map(([pageId, entry]) => ({ pageId, ...entry }))
            .filter((entry) => !page || entry.pageId === page),
        ).find((entry) => matches(entry.graph))?.graph;
      let matched = latestMatch();
      // Ask for this injector's graph once. The page answers without
      // changing its selected target, so the Signals page keeps its view.
      const peek =
        matched || !signalPages.size
          ? null
          : signalPeekFor(
              args,
              bySelector || isEnvironmentRequest(wanted) ? [] : componentHits(wanted, page),
            );
      const peekPage = peek?.pageId ?? page;
      if (peek && (!peekPage || signalPages.has(peekPage))) {
        const peeked = await signalPeeks.request(
          (request) =>
            void my.rpc.broadcast({
              method: 'peek-signal-graph',
              args: [request],
              optional: true,
            }),
          peek.target,
          peekPage,
          peekPage ? [peekPage] : [...signalPages.keys()],
          ENV_WAIT_MS,
        );
        if (peeked && (bySelector || matches(peeked))) matched = peeked;
      }
      if (bySelector && !matched && signalPages.size) {
        return { markdown: refusal(noSelectorMatchText(wanted, page)) };
      }
      const graph =
        matched ??
        (page
          ? all.find((entry) => entry.pageId === page)?.graph
          : (signalGraphState.value().graph as PageGraph | null));
      const signalSupport = unsupportedToolText(
        angularPages.pick(page),
        'signalGraph',
        'The scan-signals source scan still lists the signals in the source.',
      );
      if (!graph && signalSupport) return { markdown: signalSupport };
      if (!graph) {
        return {
          markdown: `No signal graph available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`,
        };
      }
      if (graph.unsupported) {
        // Angular 19.1 to 20.0 have `ɵgetSignalGraph`, but without node ids.
        const version = angularPages.get(page ?? graph.pageId)?.version;
        return {
          markdown: `**Unsupported on this Angular version.** The page's signal graph has no node ids, so there is no live graph. ${angularUnavailableText('signalGraph', version)} The scan-signals source scan still works.`,
        };
      }
      const view = { node: args.node, history: args.history, framework: args.framework };
      // Signal values come from the page, so the graph sits behind the notice, inside the cap.
      const budget = SIGNAL_TOOL_MAX - UNTRUSTED.length - 2;
      if (graph !== matched && !matches(graph)) {
        const known = (graph.environments ?? []).map((e) => `\`${e.name}\``).join(', ');
        const covers = graph.componentSelector ?? graph.injector?.name ?? 'another target';
        const hint = isEnvironmentRequest(wanted)
          ? ` No environment injector on the page matches it${known ? `; the page knows ${known}` : ''}.`
          : '';
        const head = `No signal graph for \`${clip(wanted, 200)}\`.${hint} The live graph covers \`${covers}\`:\n\n`;
        return {
          markdown: untrusted(
            (head + signalGraphText(graph, view, Math.max(0, budget - head.length))).slice(
              0,
              budget,
            ),
          ),
        };
      }
      return { markdown: untrusted(signalGraphText(graph, view, budget)) };
    },
  });

  agent.registerTool({
    id: 'pangular:inspect-providers',
    title: 'Inspect injectors and providers',
    description:
      'DI injectors on the page: without arguments the injector tree with providers; `injector` narrows to one injector (component, Root, Platform, Route: x); `token` finds where a token is provided and injected. `inactive: true` marks a lazy route injector off the rendered path.',
    inputSchema: {
      type: 'object',
      properties: {
        injector: {
          type: 'string',
          description:
            'Optional. A tag name (app-card), a component or directive class name (CardComponent), an environment injector name (Root, Platform, Route: admin; case-insensitive), an injector id, or a component id from the component tree (c12). Returns only the matching injectors. At most 500 characters.',
        },
        token: {
          type: 'string',
          description:
            'Optional. A token name, such as a service class or InjectionToken description (HttpClient, API_URL). Returns where it is provided and injected. With `injector`, only injections by the matching injectors are listed. At most 500 characters.',
        },
        tokenId: TOKEN_ID_ARGUMENT,
        page: PAGE_ARGUMENT,
      },
    },
    handler: async (args: {
      injector?: string;
      token?: string;
      tokenId?: string;
      page?: string;
    }) => {
      const requested = pageArgument(args);
      if (requested && !injectorPages.has(requested)) {
        return {
          markdown: unknownPageText(requested, [...injectorPages.values()], 'an injector tree'),
        };
      }
      const page = requested ? injectorPages.get(requested) : defaultPage(injectorPages.values());
      const angular = angularPages.pick(page?.pageId ?? requested);
      const noTree = unsupportedToolText(angular, 'debugApi');
      if (noTree && !page?.roots.length) return { markdown: noTree };
      // Before Angular 17.0 the page sends only the element injectors it can see.
      const reduced =
        unsupportedToolText(angular, 'injectorMetadata') ??
        unsupportedToolText(angular, 'injectorProviders');
      const text = inspectProvidersText(page, args);
      return {
        markdown: reduced
          ? `${reduced} The page reports a reduced tree: element injectors with their components and directives, and providers and environment injectors only where its Angular exposes them.\n\n${text}`
          : text,
      };
    },
  });

  agent.registerTool(providerValues.tool);

  registerInjectionExplain({
    register,
    agent,
    page: (requested) => {
      if (requested && !injectorPages.has(requested)) {
        return {
          error: unknownPageText(requested, [...injectorPages.values()], 'an injector tree'),
        };
      }
      const page = requested ? injectorPages.get(requested) : defaultPage(injectorPages.values());
      const angular = angularPages.pick(page?.pageId ?? requested);
      return { page, reduced: angular?.capabilities.injectorProviders === false };
    },
  });
}
