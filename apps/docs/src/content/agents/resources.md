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

Each one returns JSON.

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

The component instances of each page, under `pages[pageId].roots`. Each node has an instance id, class name, host tag and the directives on its host. `detail` holds the live inputs, outputs, other properties, listeners, change detection, encapsulation and injected dependencies of the selected instance. The selection is the one made in the panel, by clicking in the page with **Pick component on page**, or with the `highlight` or `inspect-component` tool. `truncated` is `true` when the page has more instances than it lists, and `truncatedBy` names the limit it hit: `components` (2000 instances) or `depth` (256 levels of DOM nesting). `deferBlocks` lists the page's `@defer` blocks, and is missing when the page has no util to read them. `nodes` repeats the roots of the most recent page.

The instance ids here are what `highlight` and `inspect-component` accept.

### signal-graph

The signal graph of each page, under `pages[pageId]`. `graph` is the latest one. It holds the nodes (`signal`, `computed`, `effect`, `linkedSignal`), producer to consumer edges, the component or injector it belongs to, the resources folded into one entry each, and recent value history per node and status history per resource. Only signals a template or an effect has read appear.

### injector-tree

The injector hierarchy the page last reported, with the providers at each level. Each page is under `pages[pageId]`. `roots` and `environment` are the latest. Element injectors list what their components and directives inject in `dependencies`. Environment injectors list what the services they already created inject, with `from` naming the service. `zone` is the change detection mode: `zoneless`, `zone` (zone.js) or `zone-unused` (zoneless, with zone.js still loaded). `truncated` is `true` when the page has more than 2000 element injectors and reported only the first 2000.

### ngrx-store

Each `@ngrx/signals` store on the page: state, computed values, methods, and the component fields that reference it. It also holds the `@ngrx/store` state and the change log, with a state diff per entry. The log records method calls, `patchState` writes, dispatched actions and restores. An `@ngrx/store` action has an `origin`: `dispatch`, `effect` or `reactive`. `classic.paused` is `true` while a restore holds `@ngrx/store` on a past state. An `@ngrx/store` entry with `unrestorable` cannot be restored: `dropped` means Store DevTools no longer holds the action (it was dropped past `maxAge`, or the history was committed, reset or imported), and `not-recorded` means Store DevTools never recorded it. `dropped` counts the older log entries removed at [`limits.changeLog`](../getting-started/configuration.md#limits).

### forms

Every form the page reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes.

<ngmd-callout type="info" title="Large forms return a summary">
  When the data is too large, the resource returns a summary per form (status, field count, error count) and points to <code>inspect-forms</code>.
</ngmd-callout>

### router

The active route tree (params, data, guards, resolvers) and recent navigations of each page. When the data is too large, the resource returns the URL and recent navigations of each page, and points to `inspect-route`, `explain-navigation` and `list-routes`.

## Shared state

The devtools keep their live data in shared-state keys. Every key is also listed as a resource, at `devframe://state/<key>` with the key encoded.

### Keys

This table covers the data that has no resource of its own.

| Key                         | Content                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `pangular:http`             | The SSR & HTTP timeline, fault rules and hydration data             |
| `pangular:http-payloads`    | The TransferState payload of each page, by page id                  |
| `pangular:change-detection` | Change detection recordings, by page id                             |
| `pangular:pipe-usage`       | Live pipe instances and recorded calls                              |
| `pangular:analog`           | Analog page data and the server call log                            |
| `pangular:routes`           | Declared but not filled. Use `get-routes` or `list-routes` instead. |

The list also includes the keys behind the six resources above (`pangular:component-tree`, `pangular:forms`, and so on).

### Read a key with a tool

Some clients only use tools. The `devframe_state_read` tool reads the same keys:

<ngmd-workflow>
  <ngmd-step title="List the keys">
    Call <code>devframe_state_read</code> without arguments. It returns every key.
  </ngmd-step>
  <ngmd-step title="Read one">
    Call it again with <code>key</code>, for example <code>pangular:http</code>. It returns the value as JSON.
  </ngmd-step>
</ngmd-workflow>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/security" title="Security"></ngmd-pill>
</ngmd-pill-row>
