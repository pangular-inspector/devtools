import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {AGENT_ENTRIES, type AgentEntry} from '../../packages/devtools/src/config.ts';
import {createSlugger, headingText, slugify} from './src/app/utils/heading-slug.ts';

/**
 * Builds `src/content/agents/tool-index.md` from `AGENT_ENTRIES` in
 * `packages/devtools/src/config.ts`, the list the server registers its agent
 * tools and resources from. `scripts/docs-agent-tools.mjs` writes the page,
 * and `agent-tool-index.spec.ts` fails when the committed page is stale or a
 * tool has no place in `tools.md` or `resources.md`.
 */

export const TOOL_INDEX_PATH = 'src/content/agents/tool-index.md';

const INSPECTOR_LABELS: Record<string, string> = {
  components: 'Components',
  signals: 'Signals',
  injectors: 'Injectors',
  ngrx: 'NgRx Store',
  tanstackQuery: 'TanStack Query',
  forms: 'Forms',
  router: 'Router',
  pipes: 'Pipes',
  http: 'SSR & HTTP',
  analog: 'Analog',
  capacitor: 'Capacitor',
  errors: 'Errors',
  plugins: 'Plugins',
};

/** Sections that mention every tool in passing, so they are not where a tool is described. */
const PASSING_SECTIONS = new Set(['before-you-call-a-tool', 'renamed-tools', 'shared-state']);

interface Heading {
  slug: string;
  text: string;
  section: string;
}

/** Each line's heading, with slugs computed the way the link guard and the TOC do. */
function headingsByLine(markdown: string): (Heading | null)[] {
  const slug = createSlugger();
  const out: (Heading | null)[] = [];
  let current: Heading | null = null;
  let section = '';
  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && (fence === null || marker.startsWith(fence))) {
      fence = fence === null ? marker : null;
    } else if (fence === null) {
      const m = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (m) {
        const text = headingText(m[2]);
        const id = m[1].length === 1 ? slugify(text) : slug(text);
        if (m[1].length <= 2) section = id;
        current = {slug: id, text, section};
      }
    }
    out.push(current);
  }
  return out;
}

/** The heading a name is described under: its own heading, or the first section that names it. */
export function findSection(markdown: string, name: string): Heading | null {
  const lines = markdown.split(/\r?\n/);
  const headings = headingsByLine(markdown);
  const own = headings.find((h) => h?.text === name);
  if (own) return own;
  const needle = '`' + name + '`';
  // The header row of the table each line is in, so a row in a table of limits doesn't count.
  const tableHeaders: string[] = [];
  lines.forEach((line, i) => {
    const inTable = line.startsWith('|');
    tableHeaders.push(!inTable ? '' : lines[i - 1]?.startsWith('|') ? tableHeaders[i - 1] : line);
  });
  const isLimits = (i: number) => /^\|\s*\S+\s*\|\s*(Cap|Limit)\s*\|/.test(tableHeaders[i]);
  // A table row that defines it, then a paragraph that starts with it, then any mention.
  const tests = [
    (line: string, i: number) => line.startsWith(`| ${needle} `) && !isLimits(i),
    (line: string) => line.startsWith(needle),
    (line: string) => line.includes(needle),
  ];
  for (const test of tests) {
    for (let i = 0; i < lines.length; i++) {
      const heading = headings[i];
      if (!heading || PASSING_SECTIONS.has(heading.section)) continue;
      if (test(lines[i], i)) return heading;
    }
  }
  return null;
}

function tier(entry: AgentEntry): string {
  const base = entry.safety ?? 'read';
  return entry.readOnlyVariant ? `${base} (read under \`agent.readOnly\`)` : base;
}

function inspectorOf(entry: AgentEntry): string {
  const first = entry.inspectors?.[0];
  if (!first) return 'Shared';
  return entry.anyInspector ? `${INSPECTOR_LABELS[first]} and others` : INSPECTOR_LABELS[first];
}

function turnedOffBy(entry: AgentEntry): string {
  if (!entry.inspectors?.length) return 'None';
  const keys = entry.anyInspector ? entry.inspectors : entry.inspectors.slice(0, 1);
  const parts = keys.map((key) => `\`inspectors.${key}\``);
  const joined = entry.anyInspector ? `${parts.join(', ')} (all of them)` : parts[0];
  return entry.actions?.length
    ? `${joined}, or blocking ${entry.actions.map((a) => `\`actions.${a}\``).join(' and ')}`
    : joined;
}

export interface IndexProblem {
  name: string;
  problem: string;
}

/** The markdown of the page, and the entries that have no place in the docs. */
export function renderToolIndex(docsRoot: string): {markdown: string; problems: IndexProblem[]} {
  const tools = readFileSync(join(docsRoot, 'src/content/agents/tools.md'), 'utf8');
  const resources = readFileSync(join(docsRoot, 'src/content/agents/resources.md'), 'utf8');
  const problems: IndexProblem[] = [];
  const toolRows: string[] = [];
  const resourceRows: string[] = [];

  const order = ['Shared', ...Object.values(INSPECTOR_LABELS)];
  const entries = Object.entries(AGENT_ENTRIES).sort(
    ([a, x], [b, y]) =>
      order.indexOf(inspectorOf(x).replace(/ and others$/, '')) -
        order.indexOf(inspectorOf(y).replace(/ and others$/, '')) || a.localeCompare(b),
  );

  for (const [name, entry] of entries) {
    const isResource = entry.kind === 'resource';
    const page = isResource ? './resources.md' : './tools.md';
    const section = findSection(isResource ? resources : tools, name);
    if (!section) {
      problems.push({name, problem: `not named in ${isResource ? 'resources.md' : 'tools.md'}`});
      continue;
    }
    const link = `[${section.text}](${page}#${section.slug})`;
    const stdio = entry.page ? 'No' : 'Yes';
    if (isResource) {
      resourceRows.push(`| \`pangular:${name}\` | ${inspectorOf(entry)} | ${stdio} | ${link} |`);
    } else {
      toolRows.push(
        `| \`${name}\` | ${inspectorOf(entry)} | ${tier(entry)} | ${stdio} | ${turnedOffBy(entry)} | ${link} |`,
      );
    }
  }

  const markdown = `---
title: Tool index
description: Every built-in agent tool and resource with its inspector, safety tier, transports and the option that turns it off, generated from the server's own list.
---

<ngmd-hero title="Tool index" gradient>
  Every built-in agent tool and resource on one page, generated from the list the server registers them from.
</ngmd-hero>

# Tool index

This page is generated from \`AGENT_ENTRIES\` in \`packages/devtools/src/config.ts\`, the list the server registers its tools and resources from, so it can't drift from the code. [Tools](./tools.md) and [Resources](./resources.md) describe the arguments and answers of each one. Run \`pnpm docs:agent-tools\` after you add or change an entry.

Clients see each tool as \`pangular_<name>\`. See [Names](./tools.md#names). Plugin tools, \`pangular:plugin:<id>:<tool>\`, come from the plugins and are not listed here. See [A plugin's own tools](./tools.md#a-plugin-s-own-tools).

## Columns

| Column        | Meaning                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspector     | The inspector the entry belongs to. Shared entries belong to none.                                                                              |
| Tier          | \`read\`, \`action\` or \`destructive\`. See [Action tools](./tools.md#action-tools).                                                               |
| Over stdio    | Whether the stdio server offers it. Entries that need a connected page, the app's dev server or the panel are HTTP only.                        |
| Turned off by | The [configuration](../getting-started/configuration.md#inspectors-and-agent-tools) that removes it. \`agent.tools.<inspector>: false\` also hides an inspector's entries, and \`agent.readOnly\` drops the \`action\` and \`destructive\` tools. |

## Tools

| Tool | Inspector | Tier | Over stdio | Turned off by | Described in |
| ---- | --------- | ---- | ---------- | ------------- | ------------ |
${toolRows.join('\n')}

## Resources

| Resource | Inspector | Over stdio | Described in |
| -------- | --------- | ---------- | ------------ |
${resourceRows.join('\n')}

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/agents/resources" title="Resources"></ngmd-pill>
  <ngmd-pill href="/agents/recipes" title="Recipes for agents"></ngmd-pill>
</ngmd-pill-row>
`;
  return {markdown, problems};
}
