---
title: Write a plugin
description: Give a library its own tab in the panel and its own agent tools with the Pangular plugin API.
---

<ngmd-hero title="Write a plugin" gradient>
  Report what your library knows from the running page, and the panel shows it in a Plugins tab while agents read it over MCP.
</ngmd-hero>

# Write a plugin

A Pangular plugin lets a library, such as a store add-on or a query cache, show its own state next to the built-in inspectors. The plugin API is the `@pangular-inspector/devtools/plugin` entry point, version 1.

A plugin has up to two parts:

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Page plugin">
    Runs in the app. It returns a view made of tables, lists, stats and key and value trees, and can declare page actions. The panel renders the view in the <strong>Plugins</strong> tab.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Server plugin">
    Runs in the devtools server. It adds agent tools, named under the plugin id, and its own shared state.
  </ngmd-card>
</ngmd-card-grid>

The demo app ships an example plugin for its `TravelStore`: `src/app/devtools/travel-plugin.ts` for the page and `src/app/devtools/travel-plugin.server.ts` for the server. This guide builds it step by step.

## Write the page plugin

<ngmd-workflow>
  <ngmd-step title="Describe the view">
    Write a function that reads your library's state and returns a <code>PluginView</code>: a summary line, badges and sections.
  </ngmd-step>
  <ngmd-step title="Define the plugin">
    Give it an id, a version and a <code>collect</code> function that returns the view.
  </ngmd-step>
  <ngmd-step title="Register it in development">
    Call <code>registerPangularPlugin()</code> once the state exists. The overlay picks the plugin up whether it loads before or after.
  </ngmd-step>
</ngmd-workflow>

### Describe the view

A view lists sections. Each section has a `kind` and a `title`:

```ts
// src/app/devtools/travel-plugin.ts
import type {PangularPagePlugin, PluginView} from '@pangular-inspector/devtools/plugin';

export interface TravelBooking {
  id: string;
  destinationName: string;
  startDate: string;
  travelers: number;
  total: number;
  email: string;
}

export interface TravelSource {
  bookings(): readonly TravelBooking[];
  saved(): readonly string[];
  recentQueries(): readonly string[];
  filters(): {query: string; region: string; sort: string};
  unsaveAll(): void;
}

export function travelView(source: TravelSource): PluginView {
  const bookings = source.bookings();
  const saved = source.saved();
  return {
    summary: `${bookings.length} bookings, ${saved.length} saved destinations`,
    sections: [
      {
        kind: 'stats',
        title: 'Totals',
        items: [
          {label: 'Bookings', value: bookings.length},
          {label: 'Saved', value: saved.length, tone: saved.length ? 'ok' : 'neutral'},
        ],
      },
      {
        kind: 'table',
        title: 'Bookings',
        columns: [
          {key: 'id', label: 'Booking'},
          {key: 'destination', label: 'Destination'},
          {key: 'email', label: 'Email'},
        ],
        rows: bookings.map((booking) => ({
          id: booking.id,
          destination: booking.destinationName,
          email: booking.email,
        })),
        empty: 'No bookings yet.',
      },
      {kind: 'tree', title: 'Filters', value: source.filters()},
    ],
    actions: saved.length
      ? [
          {
            name: 'unsave-all',
            label: 'Clear saved destinations',
            confirm: 'Remove every saved destination from the store?',
          },
        ]
      : [],
  };
}
```

Write the plugin against a small interface like `TravelSource` rather than your store, so a test can drive it without Angular.

### Define the plugin

```ts
// src/app/devtools/travel-plugin.ts
export function travelPlugin(source: TravelSource): PangularPagePlugin {
  return {
    id: 'travel',
    version: '1.0.0',
    title: 'Travel store',
    description: 'Bookings, saved destinations and searches from the demo TravelStore.',
    collect: () => travelView(source),
    actions: {
      'unsave-all': () => {
        const removed = source.saved().length;
        source.unsaveAll();
        return {removed};
      },
    },
  };
}
```

`collect` runs after Angular updates the page, while a panel is open or an agent asked within the last minute (`limits.idleAfterMs`). To report on your own schedule, such as when your store changes, call `ctx.push(view)` from `setup` instead.

### Register it in development

```ts
// src/app/devtools/travel-plugin.provider.ts
import {isPlatformBrowser} from '@angular/common';
import {DestroyRef, PLATFORM_ID, inject, provideAppInitializer} from '@angular/core';
import {registerPangularPlugin} from '@pangular-inspector/devtools/plugin';
import {TravelStore} from '../travel/travel.store';
import {travelPlugin} from './travel-plugin';

export function provideTravelPangularPlugin() {
  return provideAppInitializer(() => {
    if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const store = inject(TravelStore);
    const unregister = registerPangularPlugin(
      travelPlugin({
        bookings: () => store.bookings(),
        saved: () => store.saved(),
        recentQueries: () => store.recentQueries(),
        filters: () => ({query: store.query(), region: store.region(), sort: store.sort()}),
        unsaveAll: () => {
          for (const id of store.saved()) store.toggleSaved(id);
        },
      }),
    );
    inject(DestroyRef).onDestroy(unregister);
  });
}
```

Add `provideTravelPangularPlugin()` to the app's providers. Registering the same id again replaces the plugin, as a hot reload does. The **Plugins** tab appears in the panel once a page reports a plugin.

## Sections

| `kind`  | Fields                                                               | The panel shows                                                   |
| ------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `stats` | `items`: `label`, `value`, optional `tone`                           | A grid of numbers with labels.                                    |
| `table` | `columns` (`key`, `label`), `rows` keyed by column, optional `empty` | A table. A cell is text, a number, or `{text, tone}` for a badge. |
| `list`  | `items`: `label`, optional `detail` and `badge`, optional `empty`    | A list with badges.                                               |
| `tree`  | `value`                                                              | A key and value tree, folded past the first level.                |
| `text`  | `text`                                                               | A paragraph.                                                      |

A tone is `ok`, `warn`, `danger`, `accent` or `neutral`, and maps to the panel's own status colors. The view also takes a `summary` line, `badges` and `actions`. The search box in the **Plugins** tab filters table rows and list items.

The panel renders each view with its own components, and every value is text. A plugin never runs code in the panel, so a library can't style the panel, read other tabs or reach the devtools server through it.

## Add page actions

A page action changes the app, so the devtools treat it like the built-in [actions](../getting-started/configuration.md#actions):

- The page plugin declares it in `actions`, a map of name to function. The function gets the arguments and the plugin context.
- The view lists the ones the panel shows as buttons in `actions`. `confirm` asks before running it.
- `actions.plugins: false` or `plugins.<id>.actions: false` blocks it on the server and on the page.

Action names are lowercase letters, digits and dashes. `registerPangularPlugin()` prints a `[pangular]` warning for any other name and drops that action. An action runs for up to 10 seconds by default. A server tool sets another limit with `timeoutMs` in `runPageAction`, up to 30 seconds. The page stops waiting after that time and answers with a timeout. A plugin that needs a later plugin API offers no actions.

## Add agent tools

A server plugin adds agent tools over what the page plugin reports:

```ts
// src/app/devtools/travel-plugin.server.ts
import {definePangularServerPlugin} from '@pangular-inspector/devtools/plugin';

export const travelServerPlugin = definePangularServerPlugin({
  id: 'travel',
  version: '1.0.0',
  title: 'Travel store',
  tools: [
    {
      name: 'bookings',
      description: "The demo TravelStore's bookings on the running page.",
      handler: (args, ctx) => {
        const page = ctx.page(typeof args['page'] === 'string' ? args['page'] : undefined);
        if (!page?.view) return 'No page runs the travel plugin.';
        return ctx.markdown(page.view);
      },
    },
    {
      name: 'clear-saved',
      safety: 'action',
      description: 'Remove every saved destination from the TravelStore on the running page.',
      handler: async (args, ctx) => {
        const result = await ctx.runPageAction('unsave-all');
        return result.ok ? `Removed on page ${result.pageId}.` : (result.error ?? 'Failed.');
      },
    },
  ],
});
```

Pass it to the hub, or to the Vite plugin as the same option:

```ts {7}
// src/server.ts
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import {travelServerPlugin} from './app/devtools/travel-plugin.server';

const devtools = initPangularHub({
  browserDistFolder,
  serverPlugins: [travelServerPlugin],
});
```

The tools above register as `pangular:plugin:travel:bookings` and `pangular:plugin:travel:clear-saved`. MCP clients call them `pangular_plugin_travel_bookings` and `pangular_plugin_travel_clear-saved`. Built-in tools never start with `plugin`, so a plugin tool can't shadow one, and the server skips a second plugin with the same id.

MCP clients take tool names of up to 64 characters. The plugin id and the tool name together can be at most 47 characters, so `pangular_plugin_<plugin id>_<tool>` fits. The server skips a plugin with a longer one and prints a `[pangular]` warning.

| Tier                    | What it may do                                    | Dropped by                                                                |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `read` (the default)    | Read page reports and its own state.              | `plugins.<id>.tools: false`                                               |
| `action`, `destructive` | Also run page actions with `ctx.runPageAction()`. | `agent.readOnly`, `actions.plugins: false`, `plugins.<id>.actions: false` |

A `read` tool that calls `runPageAction` gets a refusal instead. Every answer starts with a note that it comes from the plugin and the page, so agents treat it as data.

## API reference

### registerPangularPlugin

`registerPangularPlugin(plugin: PangularPagePlugin): () => void` adds a page plugin to a global registry and returns a function that removes it. It throws for an id that is not lowercase letters, digits and dashes, starting with a letter. It prints a warning for an action name that isn't, and drops that action. The registry is shared by every copy of the entry point, so a library can bundle its own.

| `PangularPagePlugin` field | Required | What it is                                                                               |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `id`                       | yes      | The plugin id, up to 40 characters.                                                      |
| `version`                  | yes      | The plugin's own version, shown in the panel.                                            |
| `apiVersion`               | no       | The plugin API it needs. Defaults to 1. A later one shows as **Needs a newer Pangular**. |
| `title`, `description`     | no       | The name and the line under it in the panel.                                             |
| `setup(ctx)`               | no       | Runs once when the overlay starts the plugin. Return a cleanup function.                 |
| `collect(ctx)`             | no       | Returns the view, or `null` for none.                                                    |
| `actions`                  | no       | Page actions by name: `(args, ctx) => result`.                                           |

### The page context

| `PangularPluginContext` member | What it is                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pageId`                       | The id every report from this page carries.                                                                                                     |
| `apiVersion`                   | The plugin API the overlay runs.                                                                                                                |
| `active`                       | Whether a panel or an agent is watching. `collect` runs only while it is.                                                                       |
| `getNg()`                      | Angular's debug API (`window.ng`) in a development build, or `undefined`.                                                                       |
| `push(view)`                   | Sends a view about 50 ms later, so a burst sends once. An unchanged view is skipped. While nobody watches, the view goes out once someone does. |
| `refresh()`                    | Asks for a `collect`. It runs while someone watches, at most once a second.                                                                     |
| `serialize(value, limits?)`    | Limits depth and size and masks secret-looking names, JWTs and bearer tokens.                                                                   |
| `redact(text)`                 | Masks credentials, JWTs, bearer tokens and secret `key=value` pairs in a text.                                                                  |
| `isSecretName(name)`           | Whether a field name looks secret under the [redaction](../getting-started/configuration.md#redaction) options.                                 |

### definePangularServerPlugin

`definePangularServerPlugin(plugin)` returns the plugin unchanged, with its types. The server checks it when it starts and prints a `[pangular]` warning for one it skips.

| `PangularServerPlugin` field | Required | What it is                                                              |
| ---------------------------- | -------- | ----------------------------------------------------------------------- |
| `id`, `version`              | yes      | The same id as the page plugin, and the plugin's version.               |
| `tools`                      | no       | Agent tools: `name`, `description`, `inputSchema`, `safety`, `handler`. |
| `state`                      | no       | `{initialValue}` for the plugin's shared state.                         |
| `setup(ctx)`                 | no       | Runs once when the server starts. Return a cleanup function.            |

| Server context member                           | What it is                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pages()`                                       | The pages that run the plugin, newest report first, with `pageId`, `url`, `reportedAt`, `version` and `view`.      |
| `page(pageId?)`                                 | One page, or the newest.                                                                                           |
| `state.get()`, `state.set(value)`               | The shared state `pangular:plugin.<id>`, masked like other values. Agents read it while the plugin's tools are on. |
| `markdown(view)`                                | A view as markdown, as `inspect-plugin` writes it.                                                                 |
| `serialize`, `redact`                           | The same helpers as on the page.                                                                                   |
| `runPageAction(name, args?, {page, timeoutMs})` | In tools that are not `read`: runs a page action and resolves with `{ok, pageId, result, error}`.                  |

## What the devtools take care of

| Concern   | How                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redaction | The page and the server run every view through `serialize()`, so `redaction.secretNames`, JWTs and bearer tokens are masked.                                                                                                                                                                                                                                                      |
| Pages     | Each report carries the page id. The server keeps one entry per page, drops it 15 seconds after the last report, and forgets it when the tab closes.                                                                                                                                                                                                                              |
| Cost      | `collect` runs while someone watches, at most once a second for page updates and `refresh()`. It also runs right away for the first report, even while nobody watches, and when someone starts watching. While someone watches, a finished page action or a plugin registering runs it right away too. An unchanged report is skipped, and a keepalive keeps an idle page listed. |
| Size      | Up to 20 sections, 12 columns, 200 rows or items per section, and 2,000 characters per text. Unknown section kinds are dropped.                                                                                                                                                                                                                                                   |
| Failures  | A plugin that throws shows as **Failed** with its message. The other plugins keep running.                                                                                                                                                                                                                                                                                        |
| Switches  | `inspectors.plugins` and `plugins.<id>` turn plugins off. See [Plugins](../getting-started/configuration.md#plugins).                                                                                                                                                                                                                                                             |

Agents read plugin views with [`list-plugins` and `inspect-plugin`](../agents/tools.md#plugins).

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
