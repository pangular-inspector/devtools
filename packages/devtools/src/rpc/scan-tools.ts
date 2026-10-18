import { getBuildMeta } from './build-meta.ts';
import { getComponents } from './get-components.ts';
import { getNgrxStore } from './get-ngrx-store.ts';
import { getPipes } from './get-pipes.ts';
import { getProviders } from './get-providers.ts';
import { getRoutes } from './get-routes.ts';
import { getSignals } from './get-signals.ts';

/**
 * The source scan agent tools (`scan-*`, `ngrx-scan`). Each runs the RPC
 * function the panel reads (`get-routes`, `build-meta` and so on) and
 * answers with its result as compact JSON, one text block. The RPC functions
 * keep their names for the panel; only the agent tool is named after the
 * scan rule (a tool that reads only the project's files starts with `scan-`).
 */

interface ScanDefinition {
  name: string;
  setup?: (ctx: never) => unknown;
}

interface ScanToolSpec {
  id: string;
  title: string;
  description: string;
  definition: ScanDefinition;
}

export const SCAN_TOOLS: readonly ScanToolSpec[] = [
  {
    id: 'pangular:scan-routes',
    title: 'Scan Angular routes',
    description:
      "Source scan of route config files as JSON: each route's full path, kind (page, group, redirect, wildcard), guards, resolvers and file:line. Use before changing navigation; pangular:list-routes reads the live config.",
    definition: getRoutes as unknown as ScanDefinition,
  },
  {
    id: 'pangular:scan-components',
    title: 'Scan Angular components',
    description:
      'Source scan of @Component and @Directive classes as JSON: class, selector (empty for routed components), `kind`, inputs, outputs, file and line. pangular:list-components reads the live instances.',
    definition: getComponents as unknown as ScanDefinition,
  },
  {
    id: 'pangular:scan-pipes',
    title: 'Scan Angular pipes',
    description:
      'Source scan of pipes as JSON: custom @Pipe classes and the @angular/common pipes templates use, with name, class, purity, standalone and where each is declared or used.',
    definition: getPipes as unknown as ScanDefinition,
  },
  {
    id: 'pangular:scan-signals',
    title: 'Scan Angular signals',
    description:
      'Source scan as JSON of signal(), computed(), linkedSignal(), effect(), toSignal(), resources, signal inputs, models and queries: name, kind, file and line. pangular:inspect-signals reads the live graph.',
    definition: getSignals as unknown as ScanDefinition,
  },
  {
    id: 'pangular:scan-providers',
    title: 'Scan Angular DI providers',
    description:
      'Source scan of DI providers as JSON: @Injectable services, inject() calls, constructor parameters of decorated classes and providers arrays, with token, file and where each is provided. pangular:inspect-providers reads the live injectors.',
    definition: getProviders as unknown as ScanDefinition,
  },
  {
    id: 'pangular:ngrx-scan',
    title: 'Scan NgRx store source',
    description:
      'Source scan as JSON of @ngrx/store (actions, reducers, effects, selectors, features) and @ngrx/signals (signalStore, signalState, signalMethod): name, kind, file, line and members.',
    definition: getNgrxStore as unknown as ScanDefinition,
  },
  {
    id: 'pangular:scan-build',
    title: 'Scan Angular build metadata',
    description:
      'Project metadata as JSON from package.json and the build files: Angular and TypeScript versions, project name and SSR status. Baked into static builds. Call this before suggesting dependency or config changes.',
    definition: getBuildMeta as unknown as ScanDefinition,
  },
];

/** The scan RPC definitions, registered for the panel without an agent tool of their own. */
export const SCAN_RPC_DEFINITIONS = SCAN_TOOLS.map((spec) => spec.definition);

/**
 * The agent tool of one scan: it sets the RPC function up with `ctx` once,
 * on the first call, and answers its result as compact JSON.
 */
export function scanTool(spec: ScanToolSpec, ctx: unknown) {
  let run: Promise<(...args: never[]) => unknown> | undefined;
  const handlerOf = async () => {
    const setup = spec.definition.setup;
    if (!setup) throw new Error(`${spec.definition.name} has no setup.`);
    const made = (await setup(ctx as never)) as { handler: (...args: never[]) => unknown };
    return made.handler;
  };
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      run ??= handlerOf().catch((error: unknown) => {
        run = undefined;
        throw error;
      });
      const result = await (await run)();
      return JSON.stringify(result);
    },
  };
}
