---
title: Tools
description: Every agent tool the devtools expose, grouped by inspector, with what it answers and its arguments.
---

<ngmd-hero title="Tools" logo="https://cdn.simpleicons.org/modelcontextprotocol/71717A" gradient>
  Fifty-one tools, grouped by inspector. Each one answers a question you would otherwise answer by clicking through the panel.
</ngmd-hero>

# Tools

This page lists every tool the [MCP server](./mcp-server.md) exposes. Each group matches an inspector in the panel.

## Before you call a tool

### Names

Tool ids use a colon, as `pangular:get-routes`. MCP clients see them with an underscore, as `pangular_get-routes`. The tables below drop the `pangular:` prefix.

### Source and live tools

Each tool reads from one of three places. The stdio server registers only the tools that read your source, because no page reaches it.

<ngmd-card-grid columns="3">
  <ngmd-card icon="file" title="Source">
    Reads your files. Works over stdio and HTTP, with or without a browser.
  </ngmd-card>
  <ngmd-card icon="zap" title="Page">
    Reads what a connected page reported. Needs the HTTP endpoint and the app open in a browser.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Vite plugin">
    Reads what the Vite dev server recorded. Needs the Vite plugin.
  </ngmd-card>
</ngmd-card-grid>

### The page argument

Most page tools take an optional `page` argument to pick a browser tab. It defaults to the most recent one. `form-action` and `fill-form` take the tab from the form id instead (the part after `@`, as in `Checkout.form@ab12`). `highlight` and `inspect-component` search every tab without it, newest first, and `defer-blocks` lists every tab. `inspect-providers`, `highlight`, `inspect-component` and `defer-blocks` also accept `pageId`. The tables below leave `page` out.

If `page` names a tab that doesn't report that data, the tool answers `No page <id> is reporting ...` and lists the tabs that do, newest first. It never falls back to another tab. Without `page`, a class name or tag resolves on the most recent tab that has it, and `highlight` names the other tabs where it also matches.

### list-pages

Lists the tabs and [Angular Native](../getting-started/angular-native.md) apps that report to the server, newest first: page id, URL, platform (`browser` or `Angular Native`), seconds since the last report, and which inspectors report. Takes no arguments. Reads: page. Use it to find the id to pass as `page`.

### Action tools

<ngmd-alert severity="important">
  <code>highlight</code>, <code>navigate</code>, <code>dispatch-ngrx-action</code>, <code>form-action</code>, <code>fill-form</code> and <code>analog-call-api</code> act on the app. Every other tool is marked read-only for your client.
</ngmd-alert>

### Turn tools off

The server decides which tools exist. Set `agent.readOnly` to drop the six action tools. Set `agent.tools.<inspector>` to `false` to hide one inspector's tools and resources, and keep its tab. Turning an inspector off with `inspectors`, or blocking an action with `actions`, drops the matching tools too. `actions.router` is the exception: `navigate` stays and refuses `navigate`, `abort`, `replay` and `probe`. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

## Source scan

These seven tools take no arguments. They all read your source.

| Tool             | What it answers                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get-routes`     | Angular routes from your route files, with full URL path (parents and `loadChildren` prefixes included), kind (page, group, redirect or wildcard), guards, resolvers, and file and line.                                       |
| `get-components` | Components and directives from `@Component` and `@Directive` classes, with class name, selector, kind, inputs, outputs, change detection (components only), and file and line.                                                 |
| `get-signals`    | `signal()`, `computed()`, `linkedSignal()`, `effect()`, `toSignal()` and resource declarations (`resource`, `httpResource`, `rxResource`), plus signal inputs, models and queries.                                             |
| `get-providers`  | DI providers: `@Injectable` services, `inject()` calls, constructor parameters and `providers` arrays, with token, file and where each one is provided.                                                                        |
| `get-ngrx-store` | NgRx declarations: `@ngrx/store` actions (with their type strings in `types`), reducers, effects, selectors, features and store setup, and `@ngrx/signals` `signalStore` (with its members), `signalState` and `signalMethod`. |
| `get-pipes`      | Custom `@Pipe` classes, and built-in pipes from `@angular/common` in use in templates, with purity, standalone status, and where each is declared or used.                                                                     |
| `build-meta`     | The project name, the Angular and TypeScript versions, SSR status, the Analog version in Analog apps, and a `builtAt` timestamp.                                                                                               |

## Components, signals and DI

### highlight <ngmd-badge variant="alpha">Action</ngmd-badge>

Highlights a component in the page, scrolls it into view, selects it and makes it the target of `inspect-signals`. The `component-tree` resource then carries its live `detail`, and the Components tab selects it too. Reads: page.

| Argument   | Required | Value                                                                                                         |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `selector` | yes      | An instance id from the `component-tree` resource (like `c12`), a class name, a host tag or any CSS selector. |
| `pageId`   | no       | Same as `page`.                                                                                               |

An instance id targets that exact instance, for example the second card of a list. A class name or tag that matches several instances picks the first and lists the ids of all of them. A CSS selector highlights but doesn't change the selection. With `page`, a CSS selector goes to that tab only.

### inspect-component

The live detail of one component instance: inputs, outputs and whether a parent listens, other own properties (signals and resources unwrapped), DOM listeners, host directives, change detection, encapsulation, host path and injected services. It selects the instance on its page and waits up to 3 seconds for the page to report it. Reads: page.

| Argument   | Required | Value                                                                        |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| `selector` | yes      | An instance id from the `component-tree` resource, a class name or host tag. |
| `pageId`   | no       | Same as `page`.                                                              |

A class name or tag that matches several instances answers for the first and lists the ids of all of them. When nothing matches and the page's tree stopped at a [limit](../inspectors/components.md#selection), `inspect-component` and `highlight` say which one, since the instance can be past it. Secret-looking values are redacted.

### defer-blocks

The `@defer` blocks of each page: the component that holds each one, its state, its incremental hydration state, its triggers and whether it has `@loading`, `@placeholder` and `@error` blocks. A **Needs attention** list names blocks that failed to load and blocks still on their placeholder after 10 seconds. Reads: page.

| Argument | Required | Value           |
| -------- | -------- | --------------- |
| `pageId` | no       | Same as `page`. |

Without a development build, the page has no util to read defer blocks, and the answer says so.

### change-detection

Change detection cycles recorded with Angular's profiler: the slowest components by self time, the most often checked components, and the latest cycles with their duration, component checks, sync passes and the output that ran before each one. Reads: page. Needs Angular 20 or later.

| Argument | Required | Value                                                                                                          |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `record` | no       | `start` starts a fresh recording, `stop` stops it and keeps the cycles, `clear` empties it. Leave out to read. |
| `limit`  | no       | Rows per list. Default 10, at most 50.                                                                         |

Without `page`, it reads the page that is recording, and `record` goes to every connected page. The answer starts with the change detection mode of the page that last reported its injectors: zoneless, zone.js, or zoneless with zone.js still loaded. Recording is off until the panel or this tool starts it. Call it with `record: "start"`, use the app, then call it again without `record`. When older cycles were dropped at [`limits.cdCycles`](../getting-started/configuration.md#limits), the answer says how many.

### inspect-signals

The signal graph the page reported: nodes (`signal`, `computed`, `linkedSignal`, `effect`), dependency edges, the component or injector they belong to, and recent value history per node. Reads: page.

| Argument   | Required | Value                                                                                                                              |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `selector` | yes      | Host tag, class name or instance id of the component, like `app-root`. Or `root`, or a route path like `/admin` or `Route: admin`. |

The answer also holds:

| Field          | Value                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `resources`    | One entry per `resource()`, `httpResource()` or `rxResource()`: `status`, `isLoading`, `params`, `value`, `error`, `nodeIds`. |
| `environments` | The root and route injectors the page can report, with `id` and `name`.                                                       |
| `changes`      | On a node or resource, every change since the page first saw it. The history keeps the last 50.                               |
| `nodeCount`    | Set when Angular reported more than the 400 nodes the page keeps.                                                             |

With `root` or a route path, the tool switches the page's graph to the effects of that injector and waits up to 1.5 seconds for it. If no injector matches, the answer lists the ones the page knows. On Angular 20.0, the answer says the live graph needs Angular 20.1 or later.

<ngmd-callout type="tip" title="One graph per page">
  The page reports one graph: the component picked on the Signals page or with <code>highlight</code>, otherwise the deepest component in the primary router outlet. Call <code>highlight</code> first to switch the graph to another component. Only signals a template or an effect has read appear.
</ngmd-callout>

### inspect-providers

The injectors a page reported. Element injectors list what each component injected and which injector supplied it. Environment injectors run from the platform down to the root and route injectors, and list what the services they already created inject. Reads: page.

| Argument   | Required | Value                                                                                                                                                |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selector` | no       | A tag name, a component or directive class name, or an injector id. Returns only the matching element injectors, each with its lookup path resolved. |
| `token`    | no       | A token name, like `HttpClient`. Returns the injectors that provide it and the components or services that inject it.                                |
| `pageId`   | no       | Same as `page`.                                                                                                                                      |

Without `selector` or `token`, the answer is the whole tree, cut off at 20,000 characters, and says which change detection mode the page runs. When the page has more than 2000 element injectors, the answer says that it holds only the first 2000.

## NgRx

Two tools read the live `@ngrx/signals` and `@ngrx/store` state a page reported. Reads: page.

### inspect-signal-store

With `storeId`, the full state of one store: state, computed values, `withEntities()` collections (a summary of state and computed already there), methods with call counts, scope, where it is provided, and which components or injectors reference it. Without it, every store discovered so far, and the classic `@ngrx/store` state if present.

| Argument  | Required | Value                                                                                                   |
| --------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `page`    | no       | The tab to read. Defaults to every connected page.                                                      |
| `storeId` | no       | A store id from a previous call, or the id shown on the [NgRx Store](../inspectors/ngrx-store.md) page. |

### signal-store-history

The change log for a page's stores, oldest first: `@ngrx/signals` state diffs (method calls and `patchState` writes, each with a per-key diff), classic `@ngrx/store` actions, and `@ngrx/signals/events` dispatched events. A method-call entry carries a duration in milliseconds. With `watchState` registered, it is the time from the start of the method to that patch; without it, the time the whole call took. A signal-store entry carries the event that caused it when the change happened while that event was being dispatched.

| Argument  | Required | Value                                                                                                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`    | no       | The tab to read. Defaults to every connected page.                                                                                                               |
| `storeId` | no       | Only that store's entries. Without it, every store, action and event.                                                                                            |
| `since`   | no       | A `seq` from a previous call. Returns only entries after it. Requires `page` when more than one page is connected, since each page has its own sequence numbers. |

## Router

All router tools read the page, except `explain-render-mode`, which also reads your `*.routes.server.ts` files.

### Read the current route

| Tool                 | What it answers                                                                                                                                                                                                                                                                                      | Arguments                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `inspect-route`      | The current route: URL, query params, fragment, title, the navigation in flight, the active route tree (component, params, data, guards, resolvers) and the outlet tree with each outlet's `routerOutletData`. With `selector`, the route a component was rendered for, or whether a link is active. | `selector`: component class, element tag or link text |
| `explain-navigation` | Recent navigations, newest first: who started each one, redirects and loops with the cause of each hop, per-phase timing, guard and resolver verdicts, lazy loads, and the cancel or error reason in plain language.                                                                                 | `url`, `id`, `limit` (1 to 50, default 5), `perf`     |
| `export-navigation`  | A markdown repro of one navigation, with router options, any loop it is part of and the relevant slice of the route config. Defaults to the latest one that did not succeed.                                                                                                                         | `id`                                                  |

Use `explain-navigation` for "why was I redirected". Pass `perf: true` for "why is navigation slow": it lists the slowest navigations and preloads.

### Read the route config

| Tool                  | What it answers                                                                                                                                                                                                     | Arguments                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `list-routes`         | The live route config: every route with its full path, component or redirect, lazy state, guards, resolvers, title, source file and an example URL.                                                                 | `match`, `audit`, `filter`      |
| `lint-routes`         | Route config mistakes, such as routes after `**`, redirect cycles, redirect loops seen at runtime, deprecated class guards, missing titles and param typos. Each finding says how Angular reacts and how to fix it. | none                            |
| `router-config`       | How the router is set up (`provideRouter`, `forRoot or other` or `unknown`), effective options, enabled features, strategies, base href and hydration.                                                              | none                            |
| `explain-render-mode` | The `ServerRoute` and render mode (Server, Client, Prerender) a URL gets, plus server entries that match no client route.                                                                                           | `url`, defaults to the page URL |

`list-routes` takes three optional arguments:

| Argument | Value                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| `match`  | A URL such as `/users/42`. The tool predicts which route it hits, or the nearest routes when it hits none. |
| `audit`  | Set to `true` to list the guards that protect each page.                                                   |
| `filter` | Only routes whose path or component contains this text.                                                    |

### Act on the router <ngmd-badge variant="alpha">Action</ngmd-badge>

`navigate` acts on the running app's router, in development only. Reads: page.

| Action         | What it does                                                                                     | Arguments                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `navigate`     | Goes to `url`, or to `pattern` with `params`, and waits for the outcome.                         | `url` or `pattern` + `params`, `replaceUrl`, `skipLocationChange`, `waitFor` (`navigation` or `stable`) |
| `abort`        | Stops the navigation in flight.                                                                  | none                                                                                                    |
| `replay`       | Runs navigation `id` again and compares the outcome.                                             | `id`                                                                                                    |
| `probe`        | Runs the real matcher for `url` without navigating. It runs `canMatch` and may load lazy chunks. | `url`                                                                                                   |
| `instrument`   | Turns per-guard and per-resolver recording on or off.                                            | `on`                                                                                                    |
| `resolve-lazy` | Reads the routes of an unloaded lazy route without registering them.                             | `routeId`, from `list-routes`                                                                           |

`action` is required. Only same-origin URLs that start with `/` are accepted. With `actions.router` set to `false`, `navigate`, `abort`, `replay` and `probe` answer **Navigating is turned off in the devtools config (actions.router).** `instrument` and `resolve-lazy` still work. `agent.readOnly` drops the whole tool.

`waitFor` sets when `navigate` answers:

| Value        | When the tool answers                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigation` | When the navigation ends. The default.                                                                                                                                                                                                                |
| `stable`     | When the navigation ends and the app has no pending tasks, such as HTTP requests or `httpResource` loads (the signal behind `ApplicationRef.whenStable()`). The result has `stable: true`, or `stable: false` with a note when 10 seconds pass first. |

If a `canMatch` guard or the navigation error handler redirects a `probe`, the probe stops the redirected navigation before it matches or renders anything, and the result names the target in `redirectedTo`.

## NgRx

### Dispatch an action <ngmd-badge variant="alpha">Action</ngmd-badge>

`dispatch-ngrx-action` dispatches an action to the `@ngrx/store` Store of the running app, in development only, and returns the new log entry: the action, its origin and the state diff. Reads: page.

| Argument  | Value                                                                                         |
| --------- | --------------------------------------------------------------------------------------------- |
| `type`    | The action type, like `[Cart] Add Item`. `get-ngrx-store` lists the types it finds in source. |
| `payload` | The action props as a JSON object, like `{"id": 7}`. It cannot have a `type` key.             |
| `seq`     | The number of an action in the log, to dispatch that action again. Use it instead of `type`.  |

Without `page`, the tool picks the most recent page that has an `@ngrx/store` Store. While a restore holds Store DevTools on a past state, the action is logged but does not change the state, and the answer says so. Set [`actions.ngrx`](../getting-started/configuration.md#actions) to `false` to drop the tool. Read the live state and log with the [`ngrx-store` resource](./resources.md#ngrx-store).

## Forms

All forms tools read the page. They cover Signal Forms, reactive forms and template-driven forms.

Two arguments come up in almost every tool:

| Argument | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| `form`   | A form id (like `Checkout.form@ab12`) or part of its label (`Component.property`).    |
| `path`   | A dotted field path, like `address.city` or `items.0.qty`. Empty for the form itself. |

### Read form state

| Tool                     | What it answers                                                                                                                                                                                                                                                                                                         | Arguments                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `inspect-forms`          | Without arguments, each form with its status and error count, plus WebMCP tool state for Signal Forms that set `experimentalWebMcpTool`. With `form`, its field tree: value, status, touched, dirty and errors, and a `webMcp` entry with the tool name, inputs, registration status, blocking fields and recent calls. | `form`, `path`, `onlyInvalid`, `includeValues` |
| `explain-form-invalid`   | Which fields make a form invalid, and why: the failing validator, its message, the value and whether it was touched. Without `form`, every invalid or pending form.                                                                                                                                                     | `form`                                         |
| `explain-field`          | One field: where each error comes from, why validation is skipped, the binding and DOM facts like the label and visible error text.                                                                                                                                                                                     | `form`, `path`, or `selector` (a CSS selector) |
| `explain-submit`         | What submit does, and why it might do nothing.                                                                                                                                                                                                                                                                          | `form`                                         |
| `form-payload`           | What the form sends: `value` against `getRawValue()`, fields that are sent without validation, and which fields the user changed.                                                                                                                                                                                       | `form`                                         |
| `explain-custom-control` | How a field is bound to its element, and what is wrong with the binding, such as value drift or a missing `setDisabledState`.                                                                                                                                                                                           | `form`, `path`                                 |

For "why is this form invalid", call `explain-form-invalid` first. The tools redact passwords and other secret-looking values.

### Track changes

| Tool            | What it answers                                                                                                                  | Arguments                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `form-history`  | A timeline of changes, each tagged with its origin (`user`, `code`, `devtools`, `binding`, `agent`). Returns the current marker. | `form`, `path`, `type`, `origin`, `since`, `limit` (default 50, at most 200)                                           |
| `form-diff`     | The net change since a marker: each field whose value or status ended up different.                                              | `form`, `since`                                                                                                        |
| `wait-for-form` | Waits until a condition holds, or reports the state on timeout.                                                                  | `form`, `until` (`settled`, `valid`, `not-pending` or `submitted`), `since`, `timeoutMs` (default 5000, at most 30000) |
| `export-form`   | A JSON snapshot, or a test fixture with the expected status. Secret values stay redacted.                                        | `form`, `format` (`snapshot` or `fixture`)                                                                             |
| `lint-forms`    | Form bugs, NG01xxx setup errors and model-aware accessibility checks, like a missing label or error text that is not linked.     | `form`                                                                                                                 |

Markers let an agent check its own work: read the marker, act, then call `form-diff` with `since` set to it. A marker counts events across every open page and keeps counting after a page reloads, so it stays valid when the agent works in another tab.

### Act on a form

Both tools are action tools and need a development build. They don't write secret fields unless you unmask them. See [Opt fields in or out](../security.md#opt-fields-in-or-out). For Signal Forms, they don't write hidden, readonly or disabled fields either.

| Tool          | What it does                                                                                       | Arguments                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `form-action` | One action on a form or field.                                                                     | `action` (required), `form` (required, the full id), `path`, `value`, `mode` (`code` or `user`), `confirm`, `force`, `snapshot` |
| `fill-form`   | Fills several fields by path, through the inputs like a user would. Optionally submits afterwards. | `form` (required), `values` (required, a map of path to value), `mode`, `submit`, `confirm`                                     |

When a write goes through a native `<select>` (`mode: user`, the default for `fill-form`, or any write to a template-driven form), the value must equal the value of one of its options (`[ngValue]` or `value`). A multiple select takes an array. If no option matches, the field is not written and the result says `has no option with the value ...`. A `mode: code` write to a reactive form or Signal Form sets the model directly and does not check the options.

`form-action` accepts these actions: `set-value`, `mark-touched`, `mark-untouched`, `mark-dirty`, `mark-pristine`, `touch-all`, `revalidate`, `reset`, `enable`, `disable`, `submit`, `focus`, `focus-first-invalid`, `store-as-global`, `snapshot`, `restore` and `instrument`.

`snapshot` keeps a copy of the form value, so it refuses a form whose value cannot be cloned, such as a control that holds a function. `inspect-forms` with `includeValues: false` also leaves out uncommitted input, model drift and metadata.

<ngmd-callout type="warning" title="Some actions need confirm">
  <code>reset</code>, <code>submit</code> and <code>restore</code> need <code>confirm: true</code>, and so does <code>fill-form</code> with <code>submit</code>. Disabled reactive fields need <code>force</code>.
</ngmd-callout>

## Pipes

### Lint pipes

`lint-pipes` checks the pipes in your source. Reads: source. No arguments.

It finds impure pipes used inside `@for`, `| json` left in templates, pure pipes whose `transform()` reads a signal, and method calls piped to `| async`. See [Lint](../inspectors/pipes.md#lint).

### Explain a pipe

`explain-pipe` explains one pipe: where it is declared or used, whether it is pure, live instance and call counts, the last input and output, a stale-value warning, `| async` usages that resubscribe on every check, and lint findings. Reads: source, plus the page for live counts.

| Argument | Required | Value                                           |
| -------- | -------- | ----------------------------------------------- |
| `name`   | yes      | The pipe name as used after `\|` in a template. |

Live counts, input and output appear when recording is on in the [Pipes inspector](../inspectors/pipes.md).

## Analog

These tools cover *Analog apps. Most read your source. Some also read what the Vite plugin recorded.

### Routes and files

| Tool                      | What it answers                                                                                                                                                                                               | Arguments        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `analog-routes`           | File routes in match order: URL pattern, page or layout file, route groups, params, the sibling `.server.ts`, and route meta.                                                                                 | `filter`         |
| `analog-explain-url`      | Which files render a URL (layouts, page, `.server.ts` load), the params, or why nothing matches.                                                                                                              | `url` (required) |
| `analog-api-routes`       | Server routes under `src/server/routes` with method, URL and file, plus server middleware.                                                                                                                    | none             |
| `analog-server-functions` | Server functions (`serverFn` exports in any `.server.ts` under `src`) with name, method, file and id, how often each ran over HTTP and during server rendering, and reads called again right after hydration. | none             |
| `analog-content`          | Markdown content files with slug, frontmatter, the route that serves them and parse errors.                                                                                                                   | `filter`         |

### The running page

| Tool                  | What it answers                                                                                                                                                                                                              | Reads       | Arguments                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `analog-current-page` | The open page: its files, the `load()` data it received, server rendering and hydration state, and hydration errors.                                                                                                         | page        | none                                                               |
| `analog-server-calls` | Recent page renders, `load()` fetches, form actions (with their outcome), server functions by name and API calls, with status, time and size. Flags a `load()` fetched twice and a seeded server function read called again. | Vite plugin | `kind` (`page`, `load`, `action`, `fn` or `api`), `route`, `limit` |

### Rendering

| Tool                    | What it answers                                                                                                                                                   | Arguments |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `analog-render-modes`   | For each page: server rendered, prerendered, cached, redirected or client only, the route rule or config that decides it, and what the last request actually did. | none      |
| `analog-prerender-plan` | `prerender.routes` and `routeRules` with `prerender: true`, compared with the page files and the build output.                                                    | none      |

### Call a server route <ngmd-badge variant="alpha">Action</ngmd-badge>

`analog-call-api` sends a request to a route on the running dev server, like `GET /api/v1/hello`, and returns the status, time and body. Secret keys, tokens and `Bearer` values in the body are masked. Reads: Vite plugin.

| Argument  | Required | Value                                                         |
| --------- | -------- | ------------------------------------------------------------- |
| `path`    | yes      | The route path.                                               |
| `method`  | no       | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`. |
| `body`    | no       | A JSON body.                                                  |
| `confirm` | no       | Required for methods other than `GET`, `HEAD` and `OPTIONS`.  |

### Lint

`analog-lint` finds Analog mistakes: two files for one URL, a missing default export, a layout without `router-outlet`, bad API method suffixes, prerender entries that match nothing, and frontmatter errors. It also reports live problems, like a `load()` fetched twice, a server function read that runs again after hydration, or a restart needed. No arguments.

<ngmd-alert severity="helpful">
  <code>analog-server-calls</code> and <code>analog-call-api</code> need the <a href="../getting-started/vite.md">Vite plugin</a>. The plugin records the calls and knows the dev server address.
</ngmd-alert>

## Shared state

`devframe_state_read` reads the devtools' live shared state. Call it without arguments to list the keys, then with `key` to read a value as JSON.

Use it for data that has no dedicated tool, such as the SSR & HTTP timeline (`pangular:http`) or live pipe usage (`pangular:pipe-usage`). See [Resources](./resources.md) for every key.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/agents/resources" title="Resources"></ngmd-pill>
  <ngmd-pill href="/security" title="Security"></ngmd-pill>
</ngmd-pill-row>
