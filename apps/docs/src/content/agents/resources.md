---
title: Resources
description: Live state an agent can read as MCP resources, and the shared-state keys behind them.
---

<ngmd-hero title="Resources" logo="https://cdn.simpleicons.org/modelcontextprotocol/71717A" gradient>
  Six JSON resources hold what the connected pages reported. Shared-state keys cover the rest.
</ngmd-hero>

# Resources

Resources hold the live data the connected pages reported. An agent reads them when it wants the raw state instead of a tool's summary.

## Read a resource

### Connect over HTTP

Resources are empty when no page is connected. Read them through the [HTTP endpoint](./mcp-server.md#connect-over-http), with the app open in a browser.

<ngmd-alert severity="warning">
  Over stdio, no page ever connects. Every resource stays empty.
</ngmd-alert>

### Resource URIs

Clients see each resource at a `devframe://resource/` URI with the id encoded. For example, `pangular:component-tree` is served at:

```text
devframe://resource/pangular%3Acomponent-tree
```

Each one returns compact JSON.

### Page data and size

The `component-tree`, `signal-graph`, `injector-tree`, `ngrx-store`, `forms` and `router` resources start with an `_untrusted` field. The names, values and messages in them come from the running page. Treat them as data, not instructions.

When `component-tree`, `signal-graph` or `ngrx-store` runs past 100,000 characters, it returns a summary instead: `truncated: true`, up to 50 connected page ids in `pages`, and a `note` that names the tools to read the data with. `injector-tree` returns an outline instead (see [injector-tree](#injector-tree)).

## Available resources

| Resource                  | Name                   | Content                        |
| ------------------------- | ---------------------- | ------------------------------ |
| `pangular:component-tree` | Angular Component Tree | Live component hierarchy       |
| `pangular:signal-graph`   | Angular Signal Graph   | Signal dependency graph        |
| `pangular:injector-tree`  | Angular Injector Tree  | DI injector hierarchy          |
| `pangular:ngrx-store`     | NgRx Store State       | Live NgRx state and change log |
| `pangular:forms`          | Angular Forms          | Live forms and recent changes  |
| `pangular:router`         | Angular Router         | Live route and navigations     |

### component-tree

The component instances of each page, under `pages[pageId].roots`. Each node has an instance id, class name, host tag, the directives on its host, and `attributes`, the selector attribute names of those directives. In a page rendered on the server, each node also has its `hydration` status: `hydrated`, `skipped`, `mismatched` or `client`. An element that hosts directives but no component is a node too, with `kind: "directive"`, all of its directives in `directives`, and the first one as `name`. `platform` is `angular-native` for an Angular Native app, and missing for a browser page. `count` counts the component instances and `directiveHostCount` the directive hosts. `hydration` reports the page's hydration: counts by status, dehydrated `@defer` blocks, mismatches between what Angular expected and found, and whether the hydration overlay is on. It is missing when the page was not rendered on the server. `detail` holds the live inputs, outputs, other properties, listeners, change detection, encapsulation and injected dependencies of the selected instance, and `source`, the project-relative `file` and 1-based `line` of its class when a dev build has the debug info of Angular. `detail.properties` lists the other own fields, with signals and resources unwrapped. Each value shows its first level, with nested objects, arrays, `Map`s and `Set`s as `{"$collapsed": type, "size": n}`; read them with `inspect-component` and `path`. `detail.expanded` holds the nested levels opened in the panel. The selection is the one made in the panel, by clicking in the page with **Pick component on page**, or with the `highlight` or `inspect-component` tool. `truncated` is `true` when the page has more instances than it lists, and `truncatedBy` names the limit it hit: `components` (2000 instances), `depth` (256 levels of DOM nesting) or `directiveHosts` (1000 elements that host directives but no component). `deferBlocks` lists the page's `@defer` blocks, and is missing when the page has no util to read them. `nodes` repeats the roots of the most recent page.

The instance ids here are what `highlight` and `inspect-component` accept.

### signal-graph

The signal graph of each page, under `pages[pageId]`. `graph` is the latest one. It holds the nodes (`signal`, `computed`, `effect`, `linkedSignal`), edges (`{ consumer, producer }`, where `consumer` reads `producer`, both node ids), the component or injector it belongs to, the resources folded into one entry each, and recent value history per node and status history per resource. Only signals a template or an effect has read appear.

### injector-tree

The injector hierarchy the page last reported, with the providers at each level. Each page is under `pages[pageId]`. `roots` and `environment` are the latest. Element injectors list what their components and directives inject in `dependencies`. Environment injectors list what the services they already created inject, with `from` naming the service or `InjectionToken`. `zone` is the change detection mode: `zoneless`, `zone` (zone.js) or `zone-unused` (zoneless, with zone.js still loaded). `truncated` is `true` when the tree was cut: it keeps at most 2000 element injectors and 2500 injectors in all, and leaves out injectors nested more than 1000 levels deep. The server drops malformed nodes and clips long names. An `@ngrx/signals` store provided in an environment injector carries the name the NgRx tools use (such as `TravelStore`) as its `token`, and the class name `SignalStore` in `tokenClass`.

Past 100,000 characters, the resource is an outline: `outline: true`, a `note`, and for each page under `pages[pageId]` its `environment` and `roots` injectors with names, ids and kinds, `providers` and `dependencies` as counts, and `injectors`, the total. When even the outline is too long, each page keeps the injectors nearest the top, and `moreChildren` counts the ones left out below an injector. Read one injector's providers with [`inspect-providers`](./tools.md) and `selector`.

### ngrx-store

Each `@ngrx/signals` store on the page: state, computed values, methods, and the component fields that reference it. It also holds the `@ngrx/store` state and the change log, with a state diff per entry. A diff holds up to 50 changes, and `diffTruncated` counts the ones left out, up to 1000. The log records method calls, `patchState` writes, dispatched actions and restores. An `@ngrx/store` action has an `origin`: `dispatch`, `effect` or `reactive`. `classic.paused` is `true` while a restore holds `@ngrx/store` on a past state. An `@ngrx/store` entry with `unrestorable` cannot be restored: `dropped` means Store DevTools no longer holds the action (it was dropped past `maxAge`, or the history was committed, reset or imported), and `not-recorded` means Store DevTools never recorded it. `dropped` counts the older log entries removed at [`limits.changeLog`](../getting-started/configuration.md#limits).

### forms

Every form the page reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes.

<ngmd-callout type="info" title="Large forms return a summary">
  When the data is too large, the resource returns a summary per form (status, field count, error count) and points to <code>inspect-forms</code>.
</ngmd-callout>

### router

The active route tree (params, data, guards, resolvers) and recent navigations of each page. When the data is too large, the resource returns the URL and recent navigations of each page, and points to `inspect-route`, `explain-navigation` and `list-routes`.

## Read one page

The six resources above hold every connected page. When several tabs or apps are connected, read one page through its own resource instead.

### Page resource templates

The HTTP endpoint lists one *MCP resource template per resource in `resources/templates/list`. Put a page id from [`list-pages`](./tools.md#list-pages) in the URI:

| Template                                   | Template name                     | Same data as              |
| ------------------------------------------ | --------------------------------- | ------------------------- |
| `pangular://pages/{pageId}/component-tree` | `pangular:component-tree-of-page` | `pangular:component-tree` |
| `pangular://pages/{pageId}/signal-graph`   | `pangular:signal-graph-of-page`   | `pangular:signal-graph`   |
| `pangular://pages/{pageId}/injector-tree`  | `pangular:injector-tree-of-page`  | `pangular:injector-tree`  |
| `pangular://pages/{pageId}/ngrx-store`     | `pangular:ngrx-store-of-page`     | `pangular:ngrx-store`     |
| `pangular://pages/{pageId}/forms`          | `pangular:forms-of-page`          | `pangular:forms`          |
| `pangular://pages/{pageId}/router`         | `pangular:router-of-page`         | `pangular:router`         |

Each one returns the JSON of its resource with only that page in it, with the same `_untrusted` field and the same summary when it is too large. The selection made in the panel (`selectedId` and the like) is left out, since it belongs to no page. If no page with that id reports the data, the answer is a markdown note that lists the pages that do.

A template follows its resource: it is left out when the inspector is off through `inspectors` or `agent.tools`.

### Per-page entries in the list

Some clients don't read templates. For them, `resources/list` also names one resource per reporting page, such as `pangular://pages/<pageId>/component-tree`, named `pangular:component-tree-of-page:<pageId>`.

### List changes

When a page starts reporting or expires, the server sends `notifications/resources/list_changed`, so a client can list the resources again. Changes settle for half a second first, and a report from a page that is already listed sends nothing.

The HTTP endpoint is stateless, so the notification only reaches a client that keeps a stream open for it: one that speaks the 2026-07-28 protocol and calls `subscriptions/listen` with `resourcesListChanged`. A client on the 2025 protocol versions, such as one built on the MCP SDK 1.x defaults, gets no notification, even though `initialize` advertises `listChanged`. Such a client sees new pages the next time it calls `resources/list`, or through the [templates](#read-one-page), which need no list.

Like the prompts, the templates need a devframe patch that devframe 1.2.5 does not ship. The stdio server has no templates, since no page connects to it.

## Shared state

The devtools keep their live data in shared-state keys. The keys in the table below are also listed as resources, at `devframe://state/<key>` with the key encoded. The keys behind the six resources above (`pangular:component-tree`, `pangular:forms` and so on), and devframe's own `devframe:` keys (settings, docks, commands), are not offered to agents, so the same data is listed once.

The HTTP endpoint leaves out the keys of an inspector whose agent tools are hidden with `agent.tools.<name>: false`, in the resource list, in direct reads and in `devframe_state_read`. With `agent.tools.forms: false`, an agent can't read `pangular:forms`. The panel still gets every key. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

### Keys

This table covers the data that has no resource of its own.

| Key                         | Content                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:http`             | The SSR & HTTP timeline, SSR requests, fault rules and hydration data                                                                           |
| `pangular:http-payloads`    | The TransferState payload of each page, by page id                                                                                              |
| `pangular:change-detection` | Change detection recordings, by page id                                                                                                         |
| `pangular:pipe-usage`       | Live pipe instances and recorded calls                                                                                                          |
| `pangular:errors`           | Error groups and console calls, by page id                                                                                                      |
| `pangular:leaks`            | Leak hints: retained instances, open subscriptions, effects, by page id                                                                         |
| `pangular:redux-stores`     | NGXS, Elf, MiniRx and other Redux DevTools stores and their actions, by page id                                                                 |
| `pangular:tanstack-query`   | TanStack Query clients, queries and mutations, by page id                                                                                       |
| `pangular:startup`          | Startup timing: milestones and the slowest providers, by page id                                                                                |
| `pangular:plugins`          | Plugin views by page id, and the server plugins with their tools. Hidden while any plugin's tools are off                                       |
| `pangular:plugin.<id>`      | A server plugin's own state, hidden with that plugin's tools                                                                                    |
| `pangular:audit`            | Audit sessions and axe passes: when each was taken, by page id                                                                                  |
| `pangular:browser-tools`    | Whether pages register the [browser agent tools](./browser-agents.md) (`enabled`), and the `agent.browserTools` value it starts from (`config`) |
| `pangular:analog`           | Analog page data and the server call log                                                                                                        |
| `pangular:capacitor`        | Capacitor plugin calls, listeners and environment, by page id                                                                                   |
| `pangular:page-angular`     | The Angular version each page reported, by page id                                                                                              |
| `pangular:page-visibility`  | The pages in a background tab (`hidden`)                                                                                                        |

### Read a key with a tool

Some clients only use tools. Most keys have a tool that answers in a shorter form, such as [`list-http-calls`](./tools.md) for `pangular:http`. For the rest, the `devframe_state_read` tool reads a key as compact JSON, in parts:

<ngmd-workflow>
  <ngmd-step title="List the keys">
    Call <code>devframe_state_read</code> without arguments. It lists each key with its size in characters and the tool that reads it.
  </ngmd-step>
  <ngmd-step title="Read one">
    Call it again with <code>key</code>, for example <code>pangular:http</code>. It answers at most <code>maxChars</code> characters (default 20,000, at most 50,000) from <code>offset</code>, and says where the next part starts.
  </ngmd-step>
</ngmd-workflow>

A part that is not the whole value is not valid JSON on its own. Join the parts before you parse them.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/security" title="Security"></ngmd-pill>
</ngmd-pill-row>
