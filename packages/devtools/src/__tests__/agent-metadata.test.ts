import { readFileSync } from 'node:fs';
import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import {
  AGENT_ENTRIES,
  ACTION_TOOLS,
  ACTION_TOOL_FREE_MODES,
  AGENT_INSPECTOR,
  AGENT_SAFETY,
  PAGE_AGENT_ENTRIES,
  PANGULAR_ACTIONS,
  READ_ONLY_VARIANTS,
  RPC_INSPECTOR,
  agentInspector,
  agentTags,
  type AgentEntryKind,
  type PangularConfig,
} from '../config.ts';
import { PAGE_RESOURCE_NAMES } from '../agent-page-resources.ts';
import { createPangular, type PangularHostOptions } from '../devframe.ts';
import { travelServerPlugin } from '../../../../src/app/devtools/travel-plugin.server.ts';

/**
 * The lists `config.ts` kept by hand before `AGENT_ENTRIES`, sorted. The
 * derived lists must stay the same until a tool is added, changed or removed.
 */
const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/agent-metadata-derived.json', import.meta.url), 'utf8'),
) as {
  AGENT_INSPECTOR: Record<string, string>;
  ACTION_TOOLS: Record<string, string[]>;
  ACTION_TOOL_FREE_MODES: Record<string, string[]>;
  AGENT_SAFETY: Record<string, string>;
  READ_ONLY_VARIANTS: string[];
  PAGE_AGENT_ENTRIES: string[];
  agentTags: Record<string, string[] | null>;
};

const sorted = (list: readonly string[]) => [...list].sort();
const sortedValues = (record: Record<string, readonly string[]>) =>
  Object.fromEntries(Object.entries(record).map(([key, list]) => [key, sorted(list)]));

/** What the devframe setup registers for agents, by `AGENT_ENTRIES` kind, without the prefix. */
async function registered(config: PangularConfig = {}, host: PangularHostOptions = {}) {
  const ctx = await createHostContext({
    cwd: process.cwd(),
    mode: 'dev',
    host: {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    } as never,
  });
  // The demo project uses none of the library inspectors, so they are turned on here.
  const libraries = { analog: true, capacitor: true, tanstackQuery: true };
  await createPangular(
    { ...config, inspectors: { ...libraries, ...config?.inspectors } },
    host,
  ).setup(ctx as never);
  const definitions = (ctx.rpc as unknown as { definitions: Map<string, { agent?: unknown }> })
    .definitions;
  const rpc = new Set(
    [...definitions].filter(([, definition]) => definition.agent).map(([name]) => name),
  );
  const strip = (id: string) => id.replace(/^pangular:/, '');
  const manifest = ctx.agent.list();
  const kinds = new Map<string, AgentEntryKind>();
  const tools = manifest.tools.filter((tool) => tool.id.startsWith('pangular:'));
  for (const tool of tools) kinds.set(strip(tool.id), rpc.has(tool.id) ? 'rpc' : 'tool');
  for (const resource of manifest.resources.filter((r) => r.id.startsWith('pangular:'))) {
    kinds.set(strip(resource.id), 'resource');
  }
  return { kinds, tools };
}

describe('agent metadata', () => {
  it('derives the same lists config.ts kept by hand', () => {
    expect(AGENT_INSPECTOR).toEqual(FIXTURE.AGENT_INSPECTOR);
    expect(sortedValues(ACTION_TOOLS)).toEqual(FIXTURE.ACTION_TOOLS);
    expect(Object.keys(ACTION_TOOLS)).toEqual([...PANGULAR_ACTIONS]);
    expect(sortedValues(ACTION_TOOL_FREE_MODES)).toEqual(FIXTURE.ACTION_TOOL_FREE_MODES);
    expect(AGENT_SAFETY).toEqual(FIXTURE.AGENT_SAFETY);
    expect(sorted(READ_ONLY_VARIANTS)).toEqual(FIXTURE.READ_ONLY_VARIANTS);
    expect(sorted(PAGE_AGENT_ENTRIES)).toEqual(FIXTURE.PAGE_AGENT_ENTRIES);
    for (const [name, tags] of Object.entries(FIXTURE.agentTags)) {
      expect(agentTags(`pangular:${name}`) ?? null, name).toEqual(tags);
    }
  });

  it('has an entry for every registered tool and resource, and nothing else', async () => {
    // Every built-in entry registers under the default config. Plugin tools
    // come from `serverPlugins` and are left out of the table on purpose.
    const { kinds } = await registered({}, { serverPlugins: [travelServerPlugin] });
    const plugin = [...kinds.keys()].filter((name) => name.startsWith('plugin:'));
    expect(plugin.length).toBeGreaterThan(0);
    for (const name of plugin) kinds.delete(name);

    const missing = [...kinds.keys()].filter((name) => !Object.hasOwn(AGENT_ENTRIES, name));
    expect(missing, 'registered without an entry in AGENT_ENTRIES (config.ts)').toEqual([]);
    const unregistered = Object.keys(AGENT_ENTRIES).filter((name) => !kinds.has(name));
    expect(unregistered, 'in AGENT_ENTRIES but never registered').toEqual([]);
    for (const [name, kind] of kinds) expect(AGENT_ENTRIES[name]?.kind, name).toBe(kind);
  });

  it('registers each tool with the tier and tags of its entry', async () => {
    const { tools } = await registered();
    for (const tool of tools) {
      const name = tool.id.replace(/^pangular:/, '');
      expect(tool.safety, name).toBe(AGENT_ENTRIES[name]?.safety ?? 'read');
      expect(tool.tags, name).toEqual(AGENT_ENTRIES[name]?.inspectors);
    }
  });

  it('leaves the page entries out of the stdio MCP server', async () => {
    const { kinds } = await registered({}, { pageTools: false });
    const page = Object.keys(AGENT_ENTRIES).filter((name) => AGENT_ENTRIES[name]?.page);
    expect(page.filter((name) => kinds.has(name))).toEqual([]);
    expect(Object.keys(AGENT_ENTRIES).filter((name) => !kinds.has(name))).toEqual(page);
  });

  // Per-page MCP resource templates are route options, not agent registrations,
  // so they have no entry of their own: each one follows its page resource's entry.
  it('maps each per-page resource template to a page resource entry', () => {
    for (const name of PAGE_RESOURCE_NAMES) {
      expect(AGENT_ENTRIES[name], name).toMatchObject({ kind: 'resource', page: true });
    }
    const pageResources = Object.keys(AGENT_ENTRIES).filter(
      (name) => AGENT_ENTRIES[name]?.kind === 'resource' && AGENT_ENTRIES[name]?.page,
    );
    expect(sorted(pageResources)).toEqual(sorted(PAGE_RESOURCE_NAMES));
  });

  it('keeps each entry consistent', () => {
    for (const [name, entry] of Object.entries(AGENT_ENTRIES)) {
      expect(name, name).not.toMatch(/^(pangular|plugin):/);
      if (entry.kind === 'rpc' && entry.inspectors) {
        expect(entry.inspectors, name).toEqual([RPC_INSPECTOR[name]]);
      }
      // A tool that writes for an action has a tier and an inspector to turn it off with.
      if (entry.actions || entry.readOnlyVariant) expect(entry.safety, name).toBeDefined();
      if (entry.actions) expect(entry.inspectors, name).toBeDefined();
      if (entry.freeModes) expect(entry.actions, name).toBeDefined();
      expect(agentInspector(`pangular:${name}`), name).toBe(entry.inspectors?.[0]);
    }
  });
});
