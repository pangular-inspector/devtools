import type { RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { getRoutes } from './rpc/get-routes.ts';
import { getComponents } from './rpc/get-components.ts';
import { getBuildMeta } from './rpc/build-meta.ts';
import { getSignals } from './rpc/get-signals.ts';
import { getProviders } from './rpc/get-providers.ts';
import { getNgrxStore } from './rpc/get-ngrx-store.ts';
import type { NgrxRuntimeAction, SignalGraph } from './types.ts';
import {
  explainFormsText,
  formsResourceText,
  currentForms,
  expirePages,
  inspectFormsText,
  isPageReport,
  mergePageReport,
  type PageReport,
  type FormsState,
  type InspectFormsArgs,
} from './rpc/forms-tools.ts';

import pkg from '../package.json' with { type: 'json' };

type PageGraph = SignalGraph & { pageId?: string };

const clientAssets: RemoteAssets = {
  package: pkg.name,
  version: pkg.version,
  path: 'dist/public',
  resolveFrom: import.meta.url,
};

const ngDevtools = defineDevframe({
  id: 'ng-devtools',
  name: 'Angular DevTools',
  version: pkg.version,
  packageName: pkg.name,
  description: 'Inspect Angular component trees, signals, and routes at dev and build time.',
  homepage: 'https://github.com/santoshyadavdev/angular-devtools',
  icon: 'ph:angular-logo-duotone',
  importMetaUrl: import.meta.url,
  clientAssets,

  async setup(ctx) {
    const my = ctx.scope('ng-devtools');

    my.rpc.register(getRoutes);
    my.rpc.register(getComponents);
    my.rpc.register(getSignals);
    my.rpc.register(getProviders);
    my.rpc.register(getNgrxStore);
    my.rpc.register(getBuildMeta);

    const componentTree = await my.rpc.sharedState('component-tree', {
      initialValue: {
        nodes: [],
        selectedId: null,
        highlightedId: null,
      },
    });

    await my.rpc.sharedState('routes', {
      initialValue: {
        routes: [],
        activeRoute: null,
      },
    });

    const signalGraphState = await my.rpc.sharedState('signal-graph', {
      initialValue: {
        graph: null as PageGraph | null,
        pages: {} as Record<string, PageGraph>,
        selectedNodeId: null as string | null,
      },
    });
    const signalPages = new Map<string, { graph: PageGraph; reportedAt: number }>();

    const injectorTreeState = await my.rpc.sharedState('injector-tree', {
      initialValue: {
        roots: [] as any[],
        selectedInjectorId: null as string | null,
      },
    });

    const ngrxStoreState = await my.rpc.sharedState('ngrx-store', {
      initialValue: {
        state: null as unknown,
        actions: [] as NgrxRuntimeAction[],
        connected: false,
      },
    });

    const formPages = new Map<string, PageReport & { reportedAt: number }>();
    const formsState = await my.rpc.sharedState('forms', {
      initialValue: { forms: [], events: [], reportedAt: 0 } as FormsState,
    });

    const applyForms = (next: FormsState) =>
      formsState.mutate((draft) => {
        draft.forms = next.forms;
        draft.events = next.events;
        draft.reportedAt = next.reportedAt;
      });

    my.rpc.register({
      name: 'push-forms',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isPageReport(report)) return;
        applyForms(mergePageReport(formPages, report));
      },
    });

    const expiry = setInterval(() => {
      const stale = [...signalPages].filter(([, p]) => Date.now() - p.reportedAt > 15_000);
      if (stale.length) {
        for (const [id] of stale) signalPages.delete(id);
        signalGraphState.mutate((draft) => {
          for (const [id] of stale) delete draft.pages[id];
          const ownerId = draft.graph?.pageId;
          if (ownerId && stale.some(([id]) => id === ownerId)) {
            const latest = [...signalPages.values()].sort((a, b) => b.reportedAt - a.reportedAt)[0];
            draft.graph = latest?.graph ?? null;
          }
        });
      }
      const next = expirePages(formPages);
      if (next) applyForms(next);
    }, 5000);
    expiry.unref?.();

    my.rpc.register({
      name: 'forget-forms-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (typeof pageId === 'string' && formPages.delete(pageId)) {
          applyForms(currentForms(formPages));
        }
      },
    });

    my.rpc.register({
      name: 'request-form-highlight',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { formId: string; path: string } | null) => {
        void my.rpc.broadcast({
          method: 'highlight-form-field',
          args: [target],
          optional: true,
        });
      },
    });

    my.rpc.register({
      name: 'push-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (nodes: unknown[]) => {
        componentTree.mutate((draft) => {
          draft.nodes = nodes as any;
        });
      },
    });

    my.rpc.register({
      name: 'select-component',
      type: 'action',
      jsonSerializable: true,
      handler: (id: string | null) => {
        componentTree.mutate((draft) => {
          draft.selectedId = id;
        });
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [id],
          optional: true,
        });
      },
    });

    my.rpc.register({
      name: 'push-signal-graph',
      type: 'action',
      jsonSerializable: true,
      handler: (graph: PageGraph) => {
        const pageId = graph?.pageId;
        if (typeof pageId === 'string' && pageId.length < 50) {
          signalPages.set(pageId, { graph, reportedAt: Date.now() });
        }
        signalGraphState.mutate((draft) => {
          draft.graph = graph;
          // Every open page pushes, so one shared graph would flip between them.
          draft.pages = Object.fromEntries([...signalPages].map(([id, page]) => [id, page.graph]));
        });
      },
    });

    my.rpc.register({
      name: 'push-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (roots: unknown[]) => {
        injectorTreeState.mutate((draft) => {
          draft.roots = roots as any;
        });
      },
    });

    my.rpc.register({
      name: 'push-ngrx-state',
      type: 'action',
      jsonSerializable: true,
      handler: (data: { state: unknown; actions: NgrxRuntimeAction[]; connected: boolean }) => {
        ngrxStoreState.mutate((draft) => {
          draft.state = data.state;
          draft.actions = data.actions;
          draft.connected = data.connected;
        });
      },
    });

    // Agent resources
    ctx.agent.registerResource({
      id: 'ng-devtools:component-tree',
      name: 'Angular Component Tree',
      description:
        'Component hierarchy last reported by a connected page, as JSON. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(componentTree.value(), null, 2) }),
    });

    ctx.agent.registerResource({
      id: 'ng-devtools:signal-graph',
      name: 'Angular Signal Graph',
      description:
        'Live signal dependency graph: nodes (signal, computed, effect, linkedSignal), edges (producer→consumer) and recent value history per node. Read this to understand reactive data flow.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(signalGraphState.value(), null, 2) }),
    });

    ctx.agent.registerResource({
      id: 'ng-devtools:injector-tree',
      name: 'Angular Injector Tree',
      description:
        'DI injector hierarchy last reported by a connected page, with providers at each level. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(injectorTreeState.value(), null, 2) }),
    });

    ctx.agent.registerResource({
      id: 'ng-devtools:ngrx-store',
      name: 'NgRx Store State',
      description:
        'NgRx store state and recent actions last reported by a connected page. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(ngrxStoreState.value(), null, 2) }),
    });

    ctx.agent.registerResource({
      id: 'ng-devtools:forms',
      name: 'Angular Forms',
      description:
        "Every form a connected page last reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes. Empty when no page is connected.",
      mimeType: 'application/json',
      read: () => ({ text: formsResourceText(formsState.value() as FormsState) }),
    });

    // Agent tools
    ctx.agent.registerTool({
      id: 'ng-devtools:highlight',
      description: 'Highlight a component in the running Angular app by its selector.',
      safety: 'action',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the component to highlight, e.g. app-root.',
          },
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string }) => {
        if (!componentTree.value().nodes.length) {
          return {
            markdown: `No component tree has been reported, so nothing was highlighted. This is what a page that has never connected reports, and also what a connected page reports when its components are not readable. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`,
          };
        }
        await ctx.rpc.invokeLocal('ng-devtools:select-component' as any, args.selector);
        void my.rpc.broadcast({
          method: 'highlight-in-page',
          args: [args.selector],
          optional: true,
        });
        return {
          markdown: `Sent a highlight request for \`${args.selector}\`. It only shows if the selector matches an element on the page.`,
        };
      },
    });

    ctx.agent.registerTool({
      id: 'ng-devtools:inspect-signals',
      description:
        'Get the signal graph the running page last reported: signal nodes (signal, computed, linkedSignal, effect), their dependency edges, and `history` (recent value changes per node id; `write` entries are exact, `sample` entries come from polling and `missed` counts values that went unseen). The page reports one graph: the component selected in the Components tab (or via ng-devtools:highlight), otherwise the component rendered by the deepest router outlet, otherwise the root. A selector that does not match it returns what is available instead; call ng-devtools:highlight with the selector first to switch the graph to it.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the component to inspect, e.g. app-root.',
          },
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string }) => {
        // `broadcast` resolves with nothing, so the page cannot answer a
        // question. Read the graph the overlay pushes into shared state.
        const graph = signalGraphState.value().graph;
        if (!graph) {
          return {
            markdown: `No signal graph available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`,
          };
        }
        const json = JSON.stringify(graph, null, 2);
        if (graph.componentSelector && graph.componentSelector !== args.selector) {
          return {
            markdown: `No signal graph for \`${args.selector}\`. The live graph covers \`${graph.componentSelector}\`:\n\n${json}`,
          };
        }
        return { markdown: json };
      },
    });

    ctx.agent.registerTool({
      id: 'ng-devtools:inspect-providers',
      description:
        'Get the DI injector hierarchy the running page last reported, with the providers at each level. The page reports the whole tree rather than one component, so the selector only labels the answer.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Optional CSS selector, e.g. app-root. It only labels the answer: the page reports the whole tree either way.',
          },
        },
      },
      handler: async (args: { selector?: string }) => {
        const roots = injectorTreeState.value().roots;
        if (!roots.length) {
          return {
            markdown: `No injector data available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`,
          };
        }
        const scope = args.selector ? `, not filtered to \`${args.selector}\`` : '';
        return {
          markdown: `This is the injector tree for the whole page${scope}:\n\n${JSON.stringify(roots, null, 2)}`,
        };
      },
    });

    const noForms = `No forms have been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser, on a page that renders a form. The stdio server has no page attached and only ever reports this.`;
    const formProperty = {
      type: 'string',
      description: 'Form id (form-1) or part of its label (Component.property).',
    };

    ctx.agent.registerTool({
      id: 'ng-devtools:inspect-forms',
      description:
        'Inspect the forms on the running page (Signal Forms, reactive and template-driven). Without arguments it lists each form with its status and error count. Pass `form` for its field tree (value, status, touched, dirty, errors per field). Password and other secret-looking values are redacted. For "why is this form invalid", call explain-form-invalid first.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          path: {
            type: 'string',
            description:
              'Dotted field path to start the tree at, e.g. address.city or tags.1. Applies to every matched form.',
          },
          onlyInvalid: {
            type: 'boolean',
            description: 'Only include invalid or pending fields and their parents.',
          },
          includeValues: {
            type: 'boolean',
            description:
              "Include field values in this tool's output (default true). When false, values and value-bearing error params are left out; a custom error message that quotes the value is still returned as is.",
          },
        },
      },
      handler: async (args: InspectFormsArgs) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        return { markdown: inspectFormsText(state, args) };
      },
    });

    ctx.agent.registerTool({
      id: 'ng-devtools:explain-form-invalid',
      description:
        'Explain why forms on the running page are invalid: each failing field with its current value, the validator that failed, its message and whether it was touched, plus fields waiting on async validators and disabled reasons. Without `form` it covers every form that is invalid or waiting on async validation.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: { form: formProperty },
      },
      handler: async (args: { form?: string }) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        return { markdown: explainFormsText(state, args) };
      },
    });
  },
});

export default ngDevtools;
