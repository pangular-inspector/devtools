---
title: '@pangular-inspector/devtools/plugin'
description: 'Every symbol the @pangular-inspector/devtools/plugin entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="plugin" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/plugin</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/plugin

Import from `@pangular-inspector/devtools/plugin`. This page is generated from [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## definePangularServerPlugin

Function. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

Types a server plugin. Returns it unchanged; the server checks it when it starts.

```ts
function definePangularServerPlugin(plugin: PangularServerPlugin): PangularServerPlugin;
```

## PANGULAR_PLUGIN_API_VERSION

Constant. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

The plugin API version this package runs. A plugin that needs a later one is not run.

```ts
const PANGULAR_PLUGIN_API_VERSION: 1;
```

## PangularPagePlugin

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

A plugin's page side.

```ts
interface PangularPagePlugin {
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
```

## PangularPluginAction

Type. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

A page action: runs on the page when the panel's button or a server plugin tool asks.

```ts
type PangularPluginAction = (args: unknown, ctx: PangularPluginContext) => unknown;
```

## PangularPluginContext

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

What the overlay hands a page plugin.

```ts
interface PangularPluginContext {
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
```

## PangularPluginPage

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

What a plugin page reported, as a server plugin reads it.

```ts
interface PangularPluginPage {
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
```

## pangularPluginRegistry

Function. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

The registry on `target`, created on first use.

```ts
function pangularPluginRegistry(target: object = globalThis): PangularPluginRegistry;
```

## PangularPluginRegistry

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

The global registry. Its shape is part of the API, since copies of this entry share it.

```ts
interface PangularPluginRegistry {
  api: number;
  plugins: PangularPagePlugin[];
  listeners: Set<() => void>;
}
```

## PangularPluginTool

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

```ts
interface PangularPluginTool {
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
  ): string | {markdown: string} | Promise<string | {markdown: string}>;
}
```

## PangularPluginToolContext

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

What a tool's handler gets. `runPageAction` refuses in `read` tools.

```ts
interface PangularPluginToolContext extends PangularServerPluginContext {
  /**
   * Runs one of the page plugin's `actions` on a page (`page`, or the newest)
   * and waits for its answer, up to `timeoutMs` (default 10000, at most 30000).
   * The page gives up after the same time and answers with a timeout.
   */
  runPageAction(
    name: string,
    args?: unknown,
    options?: {page?: string; timeoutMs?: number},
  ): Promise<PluginActionResult>;
}
```

## PangularPluginToolSafety

Type. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

How much a tool can change. `read` tools only read; `action` tools change
the running page until a reload; `destructive` ones can lose data.

```ts
type PangularPluginToolSafety = 'read' | 'action' | 'destructive';
```

## PangularServerPlugin

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

A plugin's server side.

```ts
interface PangularServerPlugin {
  /** The same id as the page plugin. */
  id: string;
  version: string;
  apiVersion?: number;
  title?: string;
  description?: string;
  tools?: PangularPluginTool[];
  /** Creates the plugin's shared state with this value. */
  state?: {initialValue: unknown};
  /** Runs once when the devtools server starts; return a cleanup. */
  setup?(ctx: PangularServerPluginContext): void | (() => void);
}
```

## PangularServerPluginContext

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

What a server plugin's `setup` and tools get.

```ts
interface PangularServerPluginContext {
  readonly pluginId: string;
  /** The pages that run this plugin, newest report first. */
  pages(): PangularPluginPage[];
  /** One page by id, or the newest without one. */
  page(pageId?: string): PangularPluginPage | undefined;
  /**
   * The plugin's shared state, `pangular:plugin.<id>`. Agents read it with
   * `devframe_state_read` while the plugin's tools are on.
   */
  state: {get(): unknown; set(value: unknown): void};
  serialize(value: unknown, limits?: PluginSerializeLimits): unknown;
  redact(text: string): string;
  /** A view as markdown, the way `pangular:inspect-plugin` writes it. */
  markdown(view: PluginView): string;
}
```

## PluginActionResult

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

```ts
interface PluginActionResult {
  ok: boolean;
  /** The page that ran it. */
  pageId?: string;
  /** What the action returned, masked like other live values. */
  result?: unknown;
  error?: string;
}
```

## PluginBadge

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
interface PluginBadge {
  label: string;
  tone?: PluginTone;
}
```

## PluginCell

Type. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

A table cell: plain text or a number, or text with a tone.

```ts
type PluginCell = string | number | boolean | null | {text: string; tone?: PluginTone};
```

## PluginListSection

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
interface PluginListSection {
  kind: 'list';
  title: string;
  items: {label: string; detail?: string; badge?: PluginBadge}[];
  empty?: string;
}
```

## PluginSection

Type. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
type PluginSection =
  | PluginTableSection
  | PluginTreeSection
  | PluginListSection
  | PluginStatsSection
  | PluginTextSection;
```

## PluginSerializeLimits

Interface. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

Limits a plugin can pass to `serialize()`.

```ts
interface PluginSerializeLimits {
  depth?: number;
  keys?: number;
  items?: number;
  text?: number;
}
```

## PluginStatsSection

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
interface PluginStatsSection {
  kind: 'stats';
  title: string;
  items: {label: string; value: string | number; tone?: PluginTone}[];
}
```

## PluginTableSection

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
interface PluginTableSection {
  kind: 'table';
  title: string;
  columns: {key: string; label: string}[];
  rows: Record<string, PluginCell>[];
  /** Shown when `rows` is empty. */
  empty?: string;
}
```

## PluginTextSection

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

```ts
interface PluginTextSection {
  kind: 'text';
  title: string;
  text: string;
}
```

## PluginTone

Type. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

The tone of a badge, a stat or a table cell.

```ts
type PluginTone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';
```

## PluginTreeSection

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

A value shown as a tree of keys and values, folded past the first level.

```ts
interface PluginTreeSection {
  kind: 'tree';
  title: string;
  value: unknown;
}
```

## PluginView

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

What a plugin reports for one page.

```ts
interface PluginView {
  /** One line under the plugin's title. */
  summary?: string;
  badges?: PluginBadge[];
  sections: PluginSection[];
  actions?: PluginViewAction[];
}
```

## PluginViewAction

Interface. Source: [`packages/devtools/src/plugin-view.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin-view.ts).

A button the panel shows for one of the plugin's page actions.

```ts
interface PluginViewAction {
  /** A key of the plugin's `actions`. */
  name: string;
  label: string;
  /** Asks before running, for actions that lose data. */
  confirm?: string;
}
```

## registerPangularPlugin

Function. Source: [`packages/devtools/src/plugin.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/plugin.ts).

Registers a page plugin and returns a function that removes it. Registering
the same id again replaces the plugin, as a hot reload does. Throws for an
id that is not lowercase letters, digits and dashes, and warns about and
drops an action whose name is not.

```ts
function registerPangularPlugin(plugin: PangularPagePlugin): () => void;
```
