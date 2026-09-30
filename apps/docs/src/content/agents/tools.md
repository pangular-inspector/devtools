---
title: Tools
description: Every agent tool the devtools expose, grouped by inspector, with what it answers and its arguments.
---

<ngmd-hero title="Tools" logo="https://cdn.simpleicons.org/modelcontextprotocol/71717A" gradient>
  Forty-four tools, grouped by inspector. Each one answers a question you would otherwise answer by clicking through the panel.
</ngmd-hero>

# Tools

This page lists every tool the [MCP server](./mcp-server.md) exposes. Each group matches an inspector in the panel.

## Before you call a tool

### Names

Tool ids use a colon, as `ng-devtools:get-routes`. MCP clients see them with an underscore, as `ng-devtools_get-routes`. The tables below drop the `ng-devtools:` prefix.

### Source and live tools

Each tool reads from one of three places.

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

Most page tools take an optional `page` argument to pick a browser tab. It defaults to the most recent one. `inspect-providers` calls it `pageId`. The tables below leave `page` out.

### Action tools

<ngmd-alert severity="important">
  <code>highlight</code>, <code>navigate</code>, <code>form-action</code>, <code>fill-form</code> and <code>analog-call-api</code> act on the app. Every other tool is marked read-only for your client.
</ngmd-alert>

### Turn tools off

The server decides which tools exist. Set `agent.readOnly` to drop the five action tools. Set `agent.tools.<inspector>` to `false` to hide one inspector's tools and resources, and keep its tab. Turning an inspector off with `inspectors`, or blocking an action with `actions`, drops the matching tools too. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

## Source scan

These seven tools take no arguments. They all read your source.

| Tool             | What it answers                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get-routes`     | Angular routes from your route files, with full URL path (parents and `loadChildren` prefixes included), kind (page, group, redirect or wildcard), guards, resolvers, and file and line.  |
| `get-components` | Components and directives from `@Component` and `@Directive` classes, with class name, selector, kind, inputs, outputs, change detection (components only), and file and line.            |
| `get-signals`    | `signal()`, `computed()`, `linkedSignal()`, `effect()`, `toSignal()` and resource declarations (`resource`, `httpResource`, `rxResource`), plus signal inputs, models and queries.        |
| `get-providers`  | DI providers: `@Injectable` services, `inject()` calls and `providers` arrays, with token, file and where each one is provided.                                                           |
| `get-ngrx-store` | NgRx declarations: `@ngrx/store` actions, reducers, effects, selectors, features and store setup, and `@ngrx/signals` `signalStore` (with its members), `signalState` and `signalMethod`. |
| `get-pipes`      | Custom `@Pipe` classes, and built-in pipes from `@angular/common` in use in templates, with purity, standalone status, and where each is declared or used.                                |
| `build-meta`     | The project name, the Angular and TypeScript versions, SSR status, the Analog version in Analog apps, and a `builtAt` timestamp.                                                          |

## Components, signals and DI

### highlight <ngmd-badge variant="alpha">Action</ngmd-badge>

Highlights a component in the page and makes it the target of `inspect-signals`. Reads: page.

| Argument   | Required | Value                                                                                                         |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `selector` | yes      | An instance id from the `component-tree` resource (like `c12`), a class name, a host tag or any CSS selector. |

An instance id targets that exact instance, for example the second card of a list.

### inspect-signals

The signal graph the page reported: nodes (`signal`, `computed`, `linkedSignal`, `effect`), dependency edges, the component they belong to, and recent value history per node. Reads: page.

| Argument   | Required | Value                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------- |
| `selector` | yes      | Host tag, class name or instance id of the component, like `app-root`. |

<ngmd-callout type="tip" title="One graph per page">
  The page reports one graph: the component picked on the Signals page or with <code>highlight</code>, otherwise the deepest component in the primary router outlet. Call <code>highlight</code> first to switch the graph to another component. Only signals a template or an effect has read appear.
</ngmd-callout>

### inspect-providers

The injector hierarchy a page reported, with the providers at each level. Element injectors list what each component injected and which injector supplied it. Environment injectors run from the platform down to the root and route injectors. Reads: page.

| Argument   | Required | Value                                                           |
| ---------- | -------- | --------------------------------------------------------------- |
| `selector` | no       | Only labels the answer. The page always reports the whole tree. |
| `pageId`   | no       | The tab to read. Defaults to the most recent.                   |

## Router

All router tools read the page, except `explain-render-mode`, which also reads your `*.routes.server.ts` files.

### Read the current route

| Tool                 | What it answers                                                                                                                                                                                                                                                | Arguments                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `inspect-route`      | The current route: URL, query params, fragment, title, the navigation in flight, the active route tree (component, params, data, guards, resolvers) and the outlet tree. With `selector`, the route a component was rendered for, or whether a link is active. | `selector`: component class, element tag or link text |
| `explain-navigation` | Recent navigations, newest first: who started each one, redirects and loops with the cause of each hop, per-phase timing, guard and resolver verdicts, lazy loads, and the cancel or error reason in plain language.                                           | `url`, `id`, `limit` (1 to 50, default 5), `perf`     |
| `export-navigation`  | A markdown repro of one navigation, with router options, any loop it is part of and the relevant slice of the route config. Defaults to the latest one that did not succeed.                                                                                   | `id`                                                  |

Use `explain-navigation` for "why was I redirected". Pass `perf: true` for "why is navigation slow": it lists the slowest navigations and preloads.

### Read the route config

| Tool                  | What it answers                                                                                                                                                                                                     | Arguments                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `list-routes`         | The live route config: every route with its full path, component or redirect, lazy state, guards, resolvers, title, source file and an example URL.                                                                 | `match`, `audit`, `filter`      |
| `lint-routes`         | Route config mistakes, such as routes after `**`, redirect cycles, redirect loops seen at runtime, deprecated class guards, missing titles and param typos. Each finding says how Angular reacts and how to fix it. | none                            |
| `router-config`       | How the router is set up: `provideRouter` or `forRoot`, effective options, enabled features, strategies, base href and hydration.                                                                                   | none                            |
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

`action` is required. Only same-origin URLs that start with `/` are accepted.

## Forms

All forms tools read the page. They cover Signal Forms, reactive forms and template-driven forms.

Two arguments come up in almost every tool:

| Argument | Value                                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| `form`   | A form id (like `Checkout.form@ab12`) or part of its label (`Component.property`).    |
| `path`   | A dotted field path, like `address.city` or `items.0.qty`. Empty for the form itself. |

### Read form state

| Tool                     | What it answers                                                                                                                                                     | Arguments                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `inspect-forms`          | Without arguments, each form with its status and error count. With `form`, its field tree: value, status, touched, dirty and errors.                                | `form`, `path`, `onlyInvalid`, `includeValues` |
| `explain-form-invalid`   | Which fields make a form invalid, and why: the failing validator, its message, the value and whether it was touched. Without `form`, every invalid or pending form. | `form`                                         |
| `explain-field`          | One field: where each error comes from, why validation is skipped, the binding and DOM facts like the label and visible error text.                                 | `form`, `path`, or `selector` (a CSS selector) |
| `explain-submit`         | What submit does, and why it might do nothing.                                                                                                                      | `form`                                         |
| `form-payload`           | What the form sends: `value` against `getRawValue()`, fields that are sent without validation, and which fields the user changed.                                   | `form`                                         |
| `explain-custom-control` | How a field is bound to its element, and what is wrong with the binding, such as value drift or a missing `setDisabledState`.                                       | `form`, `path`                                 |

For "why is this form invalid", call `explain-form-invalid` first. The tools redact passwords and other secret-looking values.

### Track changes

| Tool            | What it answers                                                                                                              | Arguments                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `form-history`  | A timeline of changes, each tagged with its origin (`user`, `code`, `devtools`, `binding`). Returns the current marker.      | `form`, `path`, `type`, `origin`, `since`, `limit` (default 50, at most 200)                                           |
| `form-diff`     | The net change since a marker: each field whose value or status ended up different.                                          | `form`, `since`                                                                                                        |
| `wait-for-form` | Waits until a condition holds, or reports the state on timeout.                                                              | `form`, `until` (`settled`, `valid`, `not-pending` or `submitted`), `since`, `timeoutMs` (default 5000, at most 30000) |
| `export-form`   | A JSON snapshot, or a test fixture with the expected status. Secret values stay redacted.                                    | `form`, `format` (`snapshot` or `fixture`)                                                                             |
| `lint-forms`    | Form bugs, NG01xxx setup errors and model-aware accessibility checks, like a missing label or error text that is not linked. | `form`                                                                                                                 |

Markers let an agent check its own work: read the marker, act, then call `form-diff` with `since` set to it.

### Act on a form

Both tools are action tools and need a development build. They don't write secret fields unless you unmask them. See [Opt fields in or out](../security.md#opt-fields-in-or-out). For Signal Forms, they don't write hidden, readonly or disabled fields either.

| Tool          | What it does                                                                                       | Arguments                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `form-action` | One action on a form or field.                                                                     | `action` (required), `form` (required, the full id), `path`, `value`, `mode` (`code` or `user`), `confirm`, `force`, `snapshot` |
| `fill-form`   | Fills several fields by path, through the inputs like a user would. Optionally submits afterwards. | `form` (required), `values` (required, a map of path to value), `mode`, `submit`, `confirm`                                     |

`form-action` accepts these actions: `set-value`, `mark-touched`, `mark-untouched`, `mark-dirty`, `mark-pristine`, `touch-all`, `revalidate`, `reset`, `enable`, `disable`, `submit`, `focus`, `focus-first-invalid`, `store-as-global`, `snapshot`, `restore` and `instrument`.

<ngmd-callout type="warning" title="Some actions need confirm">
  <code>reset</code>, <code>submit</code> and <code>restore</code> need <code>confirm: true</code>, and so does <code>fill-form</code> with <code>submit</code>. Disabled reactive fields need <code>force</code>.
</ngmd-callout>

## Pipes

### Lint pipes

`lint-pipes` checks the pipes in your source. Reads: source. No arguments.

It finds impure pipes used inside `@for`, `| json` left in templates, and pure pipes whose `transform()` reads a signal.

### Explain a pipe

`explain-pipe` explains one pipe: where it is declared or used, whether it is pure, live instance and call counts, the last input and output, a stale-value warning and lint findings. Reads: source, plus the page for live counts.

| Argument | Required | Value                                           |
| -------- | -------- | ----------------------------------------------- |
| `name`   | yes      | The pipe name as used after `\|` in a template. |

Live counts, input and output appear when recording is on in the [Pipes inspector](../inspectors/pipes.md).

## Analog

These tools cover *Analog apps. Most read your source. Two read what the Vite plugin recorded.

### Routes and files

| Tool                 | What it answers                                                                                                               | Arguments        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `analog-routes`      | File routes in match order: URL pattern, page or layout file, route groups, params, the sibling `.server.ts`, and route meta. | `filter`         |
| `analog-explain-url` | Which files render a URL (layouts, page, `.server.ts` load), the params, or why nothing matches.                              | `url` (required) |
| `analog-api-routes`  | Server routes under `src/server/routes` with method, URL and file, plus server middleware.                                    | none             |
| `analog-content`     | Markdown content files with slug, frontmatter, the route that serves them and parse errors.                                   | `filter`         |

### The running page

| Tool                  | What it answers                                                                                                                    | Reads       | Arguments                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------- |
| `analog-current-page` | The open page: its files, the `load()` data it received, server rendering and hydration state, and hydration errors.               | page        | none                                                     |
| `analog-server-calls` | Recent page renders, `load()` fetches, server functions and API calls, with status, time and size. Flags a `load()` fetched twice. | Vite plugin | `kind` (`page`, `load`, `fn` or `api`), `route`, `limit` |

### Rendering

| Tool                    | What it answers                                                                                      | Arguments |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| `analog-render-modes`   | For each page: server rendered, prerendered, or client only, and what the last request actually did. | none      |
| `analog-prerender-plan` | `prerender.routes` compared with the page files and the build output.                                | none      |

### Call a server route <ngmd-badge variant="alpha">Action</ngmd-badge>

`analog-call-api` sends a request to a route on the running dev server, like `GET /api/v1/hello`, and returns the status, time and body. Reads: Vite plugin.

| Argument  | Required | Value                                                         |
| --------- | -------- | ------------------------------------------------------------- |
| `path`    | yes      | The route path.                                               |
| `method`  | no       | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`. |
| `body`    | no       | A JSON body.                                                  |
| `confirm` | no       | Required for methods other than `GET`, `HEAD` and `OPTIONS`.  |

### Lint

`analog-lint` finds Analog mistakes: two files for one URL, a missing default export, a layout without `router-outlet`, bad API method suffixes, prerender entries that match nothing, and frontmatter errors. It also reports live problems, like a `load()` fetched twice or a restart needed. No arguments.

<ngmd-alert severity="helpful">
  <code>analog-server-calls</code> and <code>analog-call-api</code> need the <a href="../getting-started/vite.md">Vite plugin</a>. The plugin records the calls and knows the dev server address.
</ngmd-alert>

## Shared state

`devframe_state_read` reads the devtools' live shared state. Call it without arguments to list the keys, then with `key` to read a value as JSON.

Use it for data that has no dedicated tool, such as the SSR & HTTP timeline (`ng-devtools:http`) or live pipe usage (`ng-devtools:pipe-usage`). See [Resources](./resources.md) for every key.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/agents/resources" title="Resources"></ngmd-pill>
  <ngmd-pill href="/security" title="Security"></ngmd-pill>
</ngmd-pill-row>
