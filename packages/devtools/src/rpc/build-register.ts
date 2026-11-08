import { readBuildGraph, type BuildGraph } from '../build-graph.ts';
import { redactUrl } from '../router.ts';
import { code } from './forms-tools.ts';

/** `1234` as `1.2 kB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

const limitOf = (value: unknown, fallback: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.round(value)))
    : fallback;

/** URLs and paths can carry query secrets; they are masked like router URLs. */
function masked(graph: BuildGraph): BuildGraph {
  if (!graph.vite) return graph;
  const vite = graph.vite;
  return {
    ...graph,
    vite: {
      ...vite,
      modules: vite.modules.map((mod) => ({
        ...mod,
        url: redactUrl(mod.url),
        dynamicImports: mod.dynamicImports.map((url) => redactUrl(url)),
      })),
      entries: vite.entries.map((url) => redactUrl(url)),
      lazy: vite.lazy.map((boundary) => ({ ...boundary, url: redactUrl(boundary.url) })),
    },
  };
}

/** `12.34` as `12.3 ms`; empty for a module that was not timed. */
export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** The `module-graph` answer. */
export function moduleGraphText(
  graph: BuildGraph,
  args: { search?: unknown; limit?: unknown } = {},
): string {
  const vite = graph.vite;
  if (!vite) return graph.viteNote ?? 'No module graph.';
  const limit = limitOf(args.limit, 20, 200);
  const search = typeof args.search === 'string' ? args.search.trim().toLowerCase() : '';
  const lines = [
    `Vite dev server module graph: ${vite.modules.length} modules, ${formatBytes(vite.totalSize)} transformed (unminified, only modules the browser requested). Entries: ${vite.entries.map(code).join(', ') || 'none'}; ${formatBytes(vite.initialSize)} reachable from them without import().`,
  ];
  if (search) {
    const hits = vite.modules.filter((mod) =>
      `${mod.url} ${mod.file ?? ''}`.toLowerCase().includes(search),
    );
    lines.push('', `Modules matching ${code(search)}: ${hits.length}.`);
    if (hits.length) {
      lines.push(
        '',
        '| Module | Size | Time | Importers | Imports | import() |',
        '| --- | --- | --- | --- | --- | --- |',
      );
      for (const mod of hits.slice(0, limit)) {
        lines.push(
          `| ${code(mod.file ?? mod.url)} | ${formatBytes(mod.size)} | ${formatMs(mod.time?.total)} | ${mod.importers} | ${mod.imports} | ${mod.dynamicImports.map(code).join(', ')} |`,
        );
      }
    }
    return lines.join('\n');
  }
  lines.push('', '### Lazy boundaries (import())', '');
  if (!vite.lazy.length) {
    lines.push('No module is loaded with import() yet, or no lazy route was visited.');
  } else {
    lines.push('| Module | Imported by | Own modules | Own size |', '| --- | --- | --- | --- |');
    for (const boundary of vite.lazy.slice(0, limit)) {
      lines.push(
        `| ${code(boundary.file ?? boundary.url)} | ${boundary.importers.map(code).join(', ')} | ${boundary.modules} | ${formatBytes(boundary.size)} |`,
      );
    }
  }
  lines.push('', '### Biggest modules', '', '| Module | Size | Importers |', '| --- | --- | --- |');
  for (const mod of vite.modules.slice(0, limit)) {
    lines.push(`| ${code(mod.file ?? mod.url)} | ${formatBytes(mod.size)} | ${mod.importers} |`);
  }
  lines.push('', ...slowestModules(vite, limit));
  return lines.join('\n');
}

/** The modules the dev server spent the most time on, or why there are no timings. */
function slowestModules(vite: NonNullable<BuildGraph['vite']>, limit: number): string[] {
  const lines = ['### Slowest modules', ''];
  if (!vite.timings) {
    return [...lines, 'No timings: this Vite dev server does not expose its plugin container.'];
  }
  const timed = vite.modules
    .filter((mod) => mod.time)
    .sort((a, b) => b.time!.total - a.time!.total)
    .slice(0, limit);
  if (!timed.length) return [...lines, 'No module was timed yet. Load the app in the browser.'];
  lines.push(
    `Wall-clock milliseconds the dev server spent on each module: resolve adds up every import resolved to it, load and transform are the last run through all plugins.${vite.timings.capped ? ' The oldest timings were dropped past the cap.' : ''}`,
    '',
    '| Module | Total | Resolve | Load | Transform |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const mod of timed) {
    const time = mod.time!;
    lines.push(
      `| ${code(mod.file ?? mod.url)} | ${formatMs(time.total)} | ${formatMs(time.resolve)} | ${formatMs(time.load)} | ${formatMs(time.transform)} |`,
    );
  }
  return lines;
}

/** The `chunk-sizes` answer. */
export function chunkSizesText(graph: BuildGraph, args: { limit?: unknown } = {}): string {
  const output = graph.output;
  if (!output) return graph.outputNote ?? 'No build output.';
  const limit = limitOf(args.limit, 30, 500);
  const lines = [
    `Production build in ${code(output.dir)}, built ${new Date(output.builtAt).toISOString()}: initial ${formatBytes(output.initialBytes)} (${formatBytes(output.initialGzip)} gzip), lazy ${formatBytes(output.lazyBytes)} across ${output.chunks.filter((c) => !c.initial).length} chunks. Initial chunks are the ones index.html loads up front.`,
    '',
    '| Chunk | Initial | Size | Gzip | Entry point |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const chunk of output.chunks.slice(0, limit)) {
    lines.push(
      `| ${code(chunk.file)} | ${chunk.initial ? 'yes' : 'lazy'} | ${formatBytes(chunk.bytes)} | ${formatBytes(chunk.gzip)} | ${chunk.entryPoint ? code(chunk.entryPoint) : ''} |`,
    );
  }
  if (output.chunks.length > limit) {
    lines.push('', `${output.chunks.length - limit} more; raise \`limit\` to see them.`);
  }
  if (!output.stats) {
    lines.push(
      '',
      'No stats.json next to the output, so chunks are not linked to their source. Build with `ng build --stats-json` to see the entry point and biggest inputs of each chunk.',
    );
  }
  return lines.join('\n');
}

/** devframe's RPC and agent definitions, as loose as the other inspectors take them. */
// oxlint-disable-next-line typescript/no-explicit-any
type Definition = Record<string, any>;

export interface BuildHost {
  register(definition: Definition): void;
  agent: { registerTool(tool: Definition): void };
  /** The project root. */
  root: string;
  /** The browser build folder, when the hub was given `browserDistFolder`. */
  outputDir?: string;
}

/**
 * The Build inspector on the server: the `get-build-graph` RPC function and
 * the `module-graph` and `chunk-sizes` agent tools. Nothing is read until
 * one of them is called.
 */
export function registerBuild(host: BuildHost): void {
  const read = () => masked(readBuildGraph(host.root, { outputDir: host.outputDir }));

  host.register({
    name: 'get-build-graph',
    type: 'query',
    jsonSerializable: true,
    // A static report keeps the chunks of the build it was made next to.
    snapshot: true,
    args: [],
    handler: () => read(),
  });

  host.agent.registerTool({
    id: 'pangular:module-graph',
    title: 'Show the module graph',
    description:
      "The Vite dev server's module graph: lazy boundaries (import()) with what each pulls in, the biggest modules, and the slowest with resolve, load and transform times. `search` finds modules with size, time, importers and imports. Sizes are transformed, unminified. Needs the Vite plugin.",
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Only modules whose URL or file contains this.' },
        limit: { type: 'integer', description: 'Rows per table (1-200, default 20).' },
      },
    },
    handler: async (args: Definition) => ({ markdown: moduleGraphText(read(), args ?? {}) }),
  });

  host.agent.registerTool({
    id: 'pangular:chunk-sizes',
    title: 'Show chunk sizes',
    description:
      'Chunks of the last production build on disk: initial or lazy (from index.html), size and gzip size, and with stats.json the entry point of each. Empty until the app was built.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Chunks to list (1-500, default 30).' },
      },
    },
    handler: async (args: Definition) => ({ markdown: chunkSizesText(read(), args ?? {}) }),
  });
}
