// The `@pangular-inspector/devtools/plugin` entry: the public plugin API.
//
// A library registers a page plugin with `registerPangularPlugin()`. The call
// only records it on a global registry, so it works before or after the
// overlay loads, and from a copy of this entry bundled into the library. The
// overlay runs each plugin's collector with a safe context and sends what it
// returns, a declarative `PluginView`, which the panel renders in its Plugins
// tab and agents read through `pangular:inspect-plugin`.
//
// A server plugin (`definePangularServerPlugin()`, passed to the hub or the
// Vite plugin as `serverPlugins`) adds agent tools and shared state, named
// under its plugin id so they never collide with built-in tools.
//
// Nothing here imports the overlay or the server, so the entry stays tiny.

import type { PluginView } from './plugin-view.ts';

export type {
  PluginBadge,
  PluginCell,
  PluginListSection,
  PluginSection,
  PluginStatsSection,
  PluginTableSection,
  PluginTextSection,
  PluginTone,
  PluginTreeSection,
  PluginView,
  PluginViewAction,
} from './plugin-view.ts';

/** The plugin API version this package runs. A plugin that needs a later one is not run. */
export const PANGULAR_PLUGIN_API_VERSION = 1;

/** Plugin ids and tool names: lowercase letters, digits and dashes, starting with a letter. */
const NAME = /^[a-z][a-z0-9-]{0,39}$/;

/** Limits a plugin can pass to `serialize()`. */
export interface PluginSerializeLimits {
  depth?: number;
  keys?: number;
  items?: number;
  text?: number;
}

/** What the overlay hands a page plugin. */
export interface PangularPluginContext {
  readonly apiVersion: number;
  /** The page id every report carries. */
  readonly pageId: string;
  /**
   * Whether a panel or an agent is watching. `collect` runs only while it is;
   * a `push` made meanwhile is sent once it is again.
   */
  readonly active: boolean;
  /** Angular's debug API (`window.ng`) in a development build, or `undefined`. */
  getNg(): Record<string, unknown> | undefined;
  /**
   * Reports a view without waiting for the next `collect`. It goes out about
   * 50 ms later, so a burst sends once; an unchanged view is skipped, and
   * while nobody watches it goes out once someone does.
   */
  push(view: PluginView): void;
  /**
   * Asks for a `collect`, such as after the plugin's store changed. It runs
   * while someone watches, at most once a second.
   */
  refresh(): void;
  /**
   * Makes a value safe to send: limits depth and size and masks secret-looking
   * names, JWTs and bearer tokens, like every other inspector. The overlay
   * runs it over every view too.
   */
  serialize(value: unknown, limits?: PluginSerializeLimits): unknown;
  /** Masks credentials, JWTs, bearer tokens and secret `key=value` pairs in a text. */
  redact(text: string): string;
  /** Whether a field name looks secret under the devtools config. */
  isSecretName(name: string): boolean;
}

/** A page action: runs on the page when the panel's button or a server plugin tool asks. */
export type PangularPluginAction = (args: unknown, ctx: PangularPluginContext) => unknown;

/** A plugin's page side. */
export interface PangularPagePlugin {
  /** Lowercase letters, digits and dashes, starting with a letter, such as `tanstack-query`. */
  id: string;
  /** The plugin's own version, shown in the panel. */
  version: string;
  /** The plugin API version it was written for. Defaults to 1. */
  apiVersion?: number;
  /** The name in the panel. Defaults to the id. */
  title?: string;
  description?: string;
  /** Runs once when the overlay starts the plugin; return a cleanup. */
  setup?(ctx: PangularPluginContext): void | (() => void);
  /** Returns the view to report. Called after Angular updates the page, while someone watches. */
  collect?(ctx: PangularPluginContext): PluginView | null | undefined;
  /**
   * Page actions, by name. They change the app, so `actions: false` (or
   * `plugins.<id>.actions: false`) in the devtools config blocks them.
   */
  actions?: Record<string, PangularPluginAction>;
}

/** The global registry. Its shape is part of the API, since copies of this entry share it. */
export interface PangularPluginRegistry {
  api: number;
  plugins: PangularPagePlugin[];
  listeners: Set<() => void>;
}

const REGISTRY_KEY = '__PANGULAR_PLUGINS__';

/** The registry on `target`, created on first use. */
export function pangularPluginRegistry(target: object = globalThis): PangularPluginRegistry {
  const holder = target as { [REGISTRY_KEY]?: PangularPluginRegistry };
  const existing = holder[REGISTRY_KEY];
  if (existing && Array.isArray(existing.plugins) && existing.listeners instanceof Set) {
    return existing;
  }
  const created: PangularPluginRegistry = {
    api: PANGULAR_PLUGIN_API_VERSION,
    plugins: [],
    listeners: new Set(),
  };
  holder[REGISTRY_KEY] = created;
  return created;
}

function notify(registry: PangularPluginRegistry) {
  for (const listener of [...registry.listeners]) {
    try {
      listener();
    } catch {
      continue;
    }
  }
}

/**
 * The plugin with only the actions the server accepts: names of lowercase
 * letters, digits and dashes. Warns about the others, which no button or tool
 * could run. The plugin itself is left as it is.
 */
function withValidActions(plugin: PangularPagePlugin): PangularPagePlugin {
  const actions = plugin.actions;
  if (!actions || typeof actions !== 'object') return plugin;
  const names = Object.keys(actions);
  const bad = names.filter((name) => !NAME.test(name));
  if (!bad.length) return plugin;
  console.warn(
    `[pangular] A plugin action name is lowercase letters, digits and dashes, starting with a letter. The ${plugin.id} plugin's ${bad.map((name) => JSON.stringify(name)).join(', ')} ${bad.length === 1 ? 'was' : 'were'} dropped.`,
  );
  const kept: Record<string, PangularPluginAction> = {};
  for (const name of names) if (NAME.test(name)) kept[name] = actions[name]!;
  // Inherits everything else, getters and methods included.
  return Object.assign(Object.create(plugin) as PangularPagePlugin, { actions: kept });
}

/**
 * Registers a page plugin and returns a function that removes it. Registering
 * the same id again replaces the plugin, as a hot reload does. Throws for an
 * id that is not lowercase letters, digits and dashes, and warns about and
 * drops an action whose name is not.
 */
export function registerPangularPlugin(plugin: PangularPagePlugin): () => void {
  if (!plugin || typeof plugin.id !== 'string' || !NAME.test(plugin.id)) {
    throw new Error(
      `[pangular] A plugin id is lowercase letters, digits and dashes, starting with a letter. Got ${JSON.stringify(plugin?.id)}.`,
    );
  }
  const entry = withValidActions(plugin);
  const registry = pangularPluginRegistry();
  registry.plugins = [...registry.plugins.filter((each) => each.id !== entry.id), entry];
  notify(registry);
  return () => {
    if (!registry.plugins.includes(entry)) return;
    registry.plugins = registry.plugins.filter((each) => each !== entry);
    notify(registry);
  };
}

// Server side.

/** What a plugin page reported, as a server plugin reads it. */
export interface PangularPluginPage {
  pageId: string;
  url?: string;
  title?: string;
  /** When the page last reported, in ms since the epoch. */
  reportedAt: number;
  /** The page plugin's version. */
  version: string;
  /** The last view, already masked; `null` before the first one. */
  view: PluginView | null;
}

export interface PluginActionResult {
  ok: boolean;
  /** The page that ran it. */
  pageId?: string;
  /** What the action returned, masked like other live values. */
  result?: unknown;
  error?: string;
}

/** What a server plugin's `setup` and tools get. */
export interface PangularServerPluginContext {
  readonly pluginId: string;
  /** The pages that run this plugin, newest report first. */
  pages(): PangularPluginPage[];
  /** One page by id, or the newest without one. */
  page(pageId?: string): PangularPluginPage | undefined;
  /**
   * The plugin's shared state, `pangular:plugin.<id>`. Agents read it with
   * `devframe_state_read` while the plugin's tools are on.
   */
  state: { get(): unknown; set(value: unknown): void };
  serialize(value: unknown, limits?: PluginSerializeLimits): unknown;
  redact(text: string): string;
  /** A view as markdown, the way `pangular:inspect-plugin` writes it. */
  markdown(view: PluginView): string;
}

/** What a tool's handler gets. `runPageAction` refuses in `read` tools. */
export interface PangularPluginToolContext extends PangularServerPluginContext {
  /**
   * Runs one of the page plugin's `actions` on a page (`page`, or the newest)
   * and waits for its answer, up to `timeoutMs` (default 10000, at most 30000).
   * The page gives up after the same time and answers with a timeout.
   */
  runPageAction(
    name: string,
    args?: unknown,
    options?: { page?: string; timeoutMs?: number },
  ): Promise<PluginActionResult>;
}

/**
 * How much a tool can change. `read` tools only read; `action` tools change
 * the running page until a reload; `destructive` ones can lose data.
 */
export type PangularPluginToolSafety = 'read' | 'action' | 'destructive';

export interface PangularPluginTool {
  /**
   * Lowercase letters, digits and dashes. The tool's id is
   * `pangular:plugin:<plugin id>:<name>`, which MCP clients call as
   * `pangular_plugin_<plugin id>_<name>`. That name can be at most 64
   * characters, so the plugin id and the tool name together at most 47; the
   * server skips a plugin with a longer one.
   */
  name: string;
  description: string;
  /** JSON Schema of the arguments object. */
  inputSchema?: Record<string, unknown>;
  /** Defaults to `read`. Anything else is dropped under `agent.readOnly` or with actions off. */
  safety?: PangularPluginToolSafety;
  handler(
    args: Record<string, unknown>,
    ctx: PangularPluginToolContext,
  ): string | { markdown: string } | Promise<string | { markdown: string }>;
}

/** A plugin's server side. */
export interface PangularServerPlugin {
  /** The same id as the page plugin. */
  id: string;
  version: string;
  apiVersion?: number;
  title?: string;
  description?: string;
  tools?: PangularPluginTool[];
  /** Creates the plugin's shared state with this value. */
  state?: { initialValue: unknown };
  /** Runs once when the devtools server starts; return a cleanup. */
  setup?(ctx: PangularServerPluginContext): void | (() => void);
}

/** Types a server plugin. Returns it unchanged; the server checks it when it starts. */
export function definePangularServerPlugin(plugin: PangularServerPlugin): PangularServerPlugin {
  return plugin;
}
