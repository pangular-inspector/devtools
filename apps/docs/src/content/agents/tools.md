---
title: Tools
description: Every agent tool the devtools expose, grouped by inspector, with what it answers and its arguments.
---

<ngmd-hero title="Tools" logo="https://cdn.simpleicons.org/modelcontextprotocol/71717A" gradient>
  Seventy-five tools, grouped by inspector. Each one answers a question you would otherwise answer by clicking through the panel.
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

Most page tools take an optional `page` argument to pick a browser tab. It defaults to the most recent one. `dispatch-ngrx-action`, `set-component-property` and `set-signal` refuse to guess when more than one tab could take the action. `form-action` and `fill-form` take the tab from the form id instead (the part after `@`, as in `Checkout.form@ab12`). `highlight` and `inspect-component` search every tab without it, newest first, and `defer-blocks`, `for-blocks` and `hydration` list every tab. `inspect-providers`, `highlight`, `inspect-component`, `defer-blocks`, `for-blocks` and `hydration` also accept `pageId`. The tables below leave `page` out.

If `page` names a tab that doesn't report that data, the tool answers `No page <id> is reporting ...` and lists the tabs that do, newest first. It never falls back to another tab. Without `page`, a class name or tag resolves on the most recent tab that has it, and `highlight` names the other tabs where it also matches.

### Older Angular versions

When the page's Angular lacks the debug API a tool needs, the tool answers **Unsupported on this Angular version** with the version the feature needs and the version the page runs, instead of an empty list. `inspect-signals`, `watch-signal`, `defer-blocks`, `for-blocks`, `change-detection` and `diagnose-change-detection` answer this way. `inspect-providers` puts the same note before a reduced tree. See [Supported Angular versions](../getting-started/installation.md#supported-angular-versions).

### list-pages

Lists the tabs, [Angular Native](../getting-started/angular-native.md) apps, [NativeScript](../getting-started/nativescript.md) apps and [Capacitor](../guides/capacitor.md) apps that report to the server, newest first: page id, URL, title, platform (`browser`, `Angular Native`, `NativeScript`, or `Capacitor (android)` and `Capacitor (ios)` for an app in a native WebView, followed by the page's Angular version when it reported one, as in `browser, Angular 15.2`), seconds since the last report, and which inspectors report. Takes no arguments. Reads: page. Use it to find the id to pass as `page`.

The URL comes from the HTTP or router report. A page that sends neither (no router, and no [HTTP setup](../getting-started/express.md)) still shows the URL its component tree reports, which also stands in when the other reports are more than 15 seconds older. A tab in the background stops reporting until it is shown again, so its last report is marked `(background)`: an old time there means the data is the last known state, not that the page is gone.

### open-in-panel

Gives the user a link that opens the panel on one tab with one item selected, and switches the panels that are open to it. Reads: page. Use it to point the user at what you found.

| Argument | Required | What it is                                                                                                                                                                                           |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tab`    | Yes      | The tab: `dashboard`, `timeline`, `components`, `routes`, `signals`, `injectors`, `store`, `forms`, `pipes`, `network` (SSR & HTTP), `errors`, `analog` or `capacitor`. Only tabs that are on count. |
| `id`     | No       | The item to select: a component id on `components`, the id of the component whose element injector to show on `injectors`, a form id on `forms`. Other tabs ignore it.                               |
| `page`   | No       | The page the item belongs to, from `list-pages`.                                                                                                                                                     |

The answer is a full URL, such as `http://localhost:4200/__devframes/pangular/#tab=components&id=12&page=k3x9`, when the hub serves the panel and a page has reported its address. Otherwise it is the hash to add to the panel's address. Each panel that is open and not in a background tab opens the link at once. The tool is `read`: it changes what the panel shows, not the app. See [Deep links](../getting-started/popup-and-hub.md#deep-links).

### Action tools

Every tool has one of three safety tiers. The server sends the tier to your client as the tool's read-only and destructive hints.

| Tier          | What the tool can do                                                                                              | Tools                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`        | Reads your source, the page or the server. `highlight` only shows and selects a component.                        | Every other tool, and every resource                                                                                                                                                                                                   |
| `action`      | Changes the running page, the server's fault rules or what the page records. A reload or the next call undoes it. | `navigate`, `dispatch-ngrx-action`, `form-action`, `fill-form`, `set-http-rule`, `remove-http-rule`, `set-component-property`, `set-signal`, `watch-signal`, `record-pipes`, `track-subscriptions`, `change-detection` and `hydration` |
| `destructive` | Can lose data: it erases recordings, or sends writes to your own API routes.                                      | `clear-recordings` and `analog-call-api`                                                                                                                                                                                               |

<ngmd-alert severity="important">
  The fifteen <code>action</code> and <code>destructive</code> tools act on the app. Your client can ask you before it runs them.
</ngmd-alert>

When the hub is mounted, each finished call of an `action` or `destructive` tool posts an `Agent ran <tool>` message to the hub, so you can see what the agent changed. `change-detection` posts only when it starts, stops or clears a recording, or turns a live view on or off, and `hydration` only when it turns the overlay on or off. See [Messages and badges](../getting-started/popup-and-hub.md#messages-and-badges).

### Turn tools off

The server decides which tools exist. Set `agent.readOnly` to keep only the `read` tools. `change-detection` stays as a `read` tool without its `record`, `flash`, `track` and `angularProfiling` arguments, so it reads a recording the panel started. `hydration` stays as a `read` tool without its `overlay` argument. Set `agent.tools.<inspector>` to `false` to hide one inspector's tools and resources, and keep its tab. Turning an inspector off with `inspectors`, or blocking an action with `actions`, drops the matching tools too. `actions.router` is the exception: `navigate` stays for `instrument` and `resolve-lazy`, and refuses `navigate`, `abort`, `replay` and `probe`. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

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

### highlight

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
| `path`     | no       | One value to read instead of the whole detail, such as `user.address`.       |
| `depth`    | no       | With `path`: levels to read below it, 1 to 5. Defaults to 1.                 |
| `limit`    | no       | With `path`: most entries per object or list, 1 to 1000. Defaults to 30.     |
| `pageId`   | no       | Same as `page`.                                                              |

A class name or tag that matches several instances answers for the first and lists the ids of all of them. A class name or tag only finds components. The id of a directive host from `list-components` answers with the directives on that element, since it has no component detail. When nothing matches and the page's tree stopped at a [limit](../inspectors/components.md#selection), `inspect-component` and `highlight` say which one, since the instance can be past it. Secret-looking values are redacted.

Each value in the detail shows its first level. A nested object, array, `Map` or `Set` reads `{"$collapsed": type, "size": n}`, and a list cut at 30 entries ends with a `$more` count. Pass `path` to read that value: an input or property name, then keys and indexes, as in `user.address` or `items[0]`. An index into a `Map` or `Set` counts its entries. With `path`, the tool reads the value without changing the selection. It reads own data properties only, so getters never run, and it refuses a path through a redacted name. Each input and property carries `editInside` when a path inside it can be written with `set-component-property` or `set-signal`.

The answer stops at 20,000 characters. Past that, each value longer than 1,000 characters shows only the start of its JSON, then each list (inputs, outputs, properties, listeners, directives, injected services, and the inputs and outputs of each directive) keeps fewer entries. A note names the cut values and says how many entries are not shown. The `detail` of the `component-tree` resource has every value in full.

### list-components

The live component tree of one page as an indented outline, one line per instance: class name, host tag and instance id, as in `ProductCard <app-card> c12`. An element that hosts directives but no component gets a line too, as in `<a> [routerLink] c14 [directive host: RouterLink]`. Reads: page.

| Argument         | Required | Value                                                                                                                                                                                                          |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filter`         | no       | A search, as in the [Components](../inspectors/components.md#search-syntax) filter: plain text, `<tag>` and `[directive]`, such as `<button> [matTooltip]`. The outline keeps the matches and their ancestors. |
| `depth`          | no       | The most levels to list, `1` for the roots only. Unlimited by default.                                                                                                                                         |
| `directiveHosts` | no       | `false` leaves out the elements that host directives but no component. They are listed by default.                                                                                                             |

Markers follow the id:

| Marker                                | Meaning                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `[routed route /products]`            | A router outlet shows this instance. A named outlet adds `outlet <name>`. It needs the Router inspector on. |
| `[directives: RouterLinkActive, ...]` | The other directives on the host.                                                                           |
| `[directive host: RouterLink]`        | The element hosts these directives and no component.                                                        |
| `[hydration: skipped]`                | In a page rendered on the server, the host was `skipped`, `mismatched` or created on the `client`.          |
| `(+3 below)`                          | `depth` hides 3 instances under this one.                                                                   |

Without `page`, it lists the most recent tab that has a component tree and names the other tabs that have one. The outline carries no input or property values. Pass an id to `inspect-component` for those, or to `highlight` to show the instance. The answer stops at 20,000 characters and says how to narrow it, and it says when the page's tree stopped at a [limit](../inspectors/components.md#selection).

### defer-blocks

The `@defer` blocks of each page: the component that holds each one, its state, its incremental hydration state, its triggers and whether it has `@loading`, `@placeholder` and `@error` blocks. A **Needs attention** list names blocks that failed to load and blocks still on their placeholder after 10 seconds. A block whose triggers only wait for the user (`on viewport`, `on interaction` or `on hover`) is not listed there: its row notes that it is waiting for its trigger. Reads: page.

| Argument | Required | Value           |
| -------- | -------- | --------------- |
| `pageId` | no       | Same as `page`. |

Without a development build, the page has no util to read defer blocks, and the answer says so.

Each page lists at most 50 blocks in the table and 50 under **Needs attention**, with a note on how many more are not shown. The whole answer stops at 20,000 characters. If several tabs report, pass `page` to read one. The **Defer blocks** list on the [Components](../inspectors/components.md#defer-blocks) page has every block the page reported. A page reports its first 500 blocks. When it has more, the answer says so.

### for-blocks

The `@for` blocks of each page: the component that holds each one, its item count, what its `track` expression tracks by and whether it has an `@empty` block and shows it. A block with no items and no `@empty` block gets a note that it renders nothing. Reads: page.

| Argument | Required | Value           |
| -------- | -------- | --------------- |
| `pageId` | no       | Same as `page`. |

Angular reports the `track` expression as one of three kinds, not as its source text:

| Tracks by       | Template                                      |
| --------------- | --------------------------------------------- |
| `$index`        | `track $index`                                |
| the item itself | `track item`, where `item` is the loop item   |
| an expression   | Any other expression, such as `track trip.id` |

The page reads the blocks with `ng.ɵgetControlFlowBlocks`, which Angular 22.0 added for development builds. On an older Angular or a production build, the answer says the page cannot list them. The page sends the item count only, never the items.

Each page lists at most 50 blocks, with a note on how many more are not shown, and says when the page has more than the 500 blocks it reports. The whole answer stops at 20,000 characters. If several tabs report, pass `page` to read one. The **&#64;for blocks** list on the [Components](../inspectors/components.md#for-blocks) page has every block.

### hydration <ngmd-badge variant="alpha">Action</ngmd-badge>

Hydration of each page that was rendered on the server: how many component hosts were hydrated, skipped with `ngSkipHydration`, mismatched or created on the client, and how many `@defer` blocks are still dehydrated. It names the skipped and client-created hosts and the dehydrated blocks, at most 30 of each, and each mismatch with a line diff of the server HTML Angular expected (`-`) and the client DOM it found (`+`). Reads: page.

| Argument  | Required | Value                                                                                                                       |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pageId`  | no       | Same as `page`.                                                                                                             |
| `overlay` | no       | `true` outlines the regions on the page, with a label on each and a legend. `false` removes the outline. Leave out to read. |

A page that was not rendered on the server gets an answer that says so. A page with server HTML but no hydrated host gets a note that client hydration is off or the build is a production build. The overlay draws in its own layer over the page, ignores the pointer and changes nothing in the app. It is the **Outline on page** button of the [Hydration](../inspectors/components.md#hydration) section. With `agent.readOnly`, the tool has no `overlay` argument and is marked read-only. The whole answer stops at 20,000 characters.

### change-detection <ngmd-badge variant="alpha">Action</ngmd-badge>

Change detection cycles recorded with Angular's profiler: the slowest components by self time, the most often checked components, lifecycle hook time per class and hook, output listener time, `afterRender` callback time, and the latest cycles with their duration, component checks, sync passes, hook and afterRender time and the output that ran before each one. Reads: page. Needs Angular 20 or later.

| Argument           | Required | Value                                                                                                                                                                            |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `record`           | no       | `start` starts a fresh recording on a page that is not recording and leaves a running one as it is, `stop` stops it and keeps the cycles, `clear` empties it. Leave out to read. |
| `limit`            | no       | Rows per list. Default 10, at most 50.                                                                                                                                           |
| `export`           | no       | `json` returns the recording as the file the panel's **Import** reads. `trace` returns it in the Trace Event Format for Perfetto. Can't be combined with `record`.               |
| `flash`            | no       | `true` turns the flash overlay on: a fading box with the class name and check count over each component Angular checks. `false` turns it off.                                    |
| `track`            | no       | `true` writes each component check, lifecycle hook and output listener to a **Pangular** track in the Chrome Performance panel. `false` turns it off.                            |
| `angularProfiling` | no       | `true` calls `ng.enableProfiling()` for Angular's own Performance panel track. It stays on until the page reloads, so `false` is refused.                                        |

Without `page`, it reads the page that is recording, and `record` goes to every connected page. A `page` that names no connected tab gets the list of connected tabs. A connected tab that has not recorded yet gets a hint to start a recording there. The answer starts with the change detection mode of the page it reports on: zoneless, zone.js, or zoneless with zone.js still loaded. Recording is off until the panel or this tool starts it. Call it with `record: "start"`, use the app, then call it again without `record`. With `agent.readOnly`, the tool has no `record` argument and is marked read-only, so start the recording from the panel. When older cycles were dropped at [`limits.cdCycles`](../getting-started/configuration.md#limits), the answer says how many. A recording lists at most 100 component classes and counts checks for up to 2000 instances. When it checked more, the answer says how many were left out.

`flash`, `track` and `angularProfiling` go to the page in `page`, or to every connected page, and can be combined with `record`, but not with `export`. They are the **Live views** toggles of the panel; see [Watch checks live](../inspectors/components.md#watch-checks-live). Once a page reports them, the answer ends with a line that says which views are on. With `agent.readOnly`, the tool has none of these three arguments.

`export` only reads, so it stays available with `agent.readOnly`. The file is masked like other answers (JWTs, bearer tokens and secret names), has no instance check counts, and comes in a `json` code block to save as a `.json` file. An export over 100,000 characters is not returned, because cut JSON doesn't parse. The answer gives its size and the counts of cycles, timed spans, component classes, hook rows and output rows instead. Export it from the panel then, or clear the recording and record a shorter session. See [Export and import a recording](../inspectors/components.md#export-and-import-a-recording).

Each cycle line also names what started the cycle and how many of its refreshed checks changed nothing, when the page reports them. See [diagnose-change-detection](#diagnose-change-detection).

### diagnose-change-detection

Why change detection ran and what it wasted, from the recording that `change-detection` or the panel started. Reads: page. Needs Angular 20 or later.

| Argument | Required | Value                                  |
| -------- | -------- | -------------------------------------- |
| `limit`  | no       | Rows per list. Default 10, at most 50. |

Without `page`, it reads the page that is recording, like `change-detection`. The answer starts with the page's change detection mode, then has these parts:

| Part                                  | What it lists                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What started the cycles**           | Cycles per cause, then the latest causes: a DOM event with its type, target and listener component, a signal write with the signal's `debugName`, an HTTP response, a timer, `markForCheck`, `setInput`, an effect, a view change, `ApplicationRef.tick()` from app code, or a zone.js tick that nothing in Angular asked for. Causes from app code carry its first app frames. |
| **Components that depend on zone.js** | Components that changed in ticks only zone.js started, with the zone.js tasks behind them, such as `setTimeout`. Without zone.js these components would not update.                                                                                                                                                                                                             |
| **Wasted checks**                     | Per component class, the refreshed checks where nothing it renders changed, and its change detection strategy.                                                                                                                                                                                                                                                                  |
| **Inputs that break OnPush**          | Inputs mutated in place (same reference, other contents) and inputs given a new reference with the same contents, with the component that set them.                                                                                                                                                                                                                             |
| **Hints**                             | OnPush for a class refreshed at least 10 times that changed something in under 20% of them, or a note that it is already OnPush, plus a line per input and per zone.js dependent above.                                                                                                                                                                                         |

It only reads, so it stays with `agent.readOnly`. With no recording yet, it says to start one with `change-detection`. See [Why it ran and what it wasted](../inspectors/components.md#why-it-ran-and-what-it-wasted) for how the page finds causes and wasted checks.

### Edit a component <ngmd-badge variant="alpha">Action</ngmd-badge>

`set-component-property` and `set-signal` write a JSON value to one live component instance, in development only, and answer with the value it now holds, redacted like the component detail. Reads: page.

| Tool                     | Writes                                                                                          | How                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `set-component-property` | An input or another property. Signals are refused; use `set-signal`.                            | Assigns the value, then runs change detection with `ng.applyChanges`. |
| `set-signal`             | A writable signal the component holds as a property: `signal()`, `linkedSignal()` or `model()`. | Calls `.set()`.                                                       |

| Argument    | Tool                     | Value                                                                                                                           |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `component` | both                     | An instance id from the `component-tree` resource, or a class name or host tag that matches one instance.                       |
| `property`  | `set-component-property` | The class property or public input name, or a path inside its value, like `user.name` or `items[0].title`.                      |
| `signal`    | `set-signal`             | The signal property, or a path inside its value, like `filters.query`. The signal is set to a copy with that one value changed. |
| `value`     | both                     | The new value as JSON.                                                                                                          |

Both tools refuse, and write nothing, when:

- the target is a signal input (`input()` or `input.required()`), a `computed()` or an `asReadonly()` signal, a getter without a setter, a method or an output
- the value is not JSON, or the target holds a class instance, `Map`, `Date` or function
- a name on the path is redacted, or the target holds a redacted value (see [What is redacted](../security.md#what-is-redacted))
- a class name or tag matches several instances, or more than one tab reports components and `page` is missing

A parent binding sets a bound input again the next time its own value changes. Only signals held as component properties can be set; the signals that `inspect-signals` lists elsewhere cannot. Set [`actions.components`](../getting-started/configuration.md#actions) to `false` to drop both tools.

### find-leaks

Leak hints for one page, in three parts. Reads: page.

| Part                                 | What it lists                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Still retained**                   | Component instances destroyed but still in memory after at least 2 navigations and 10 seconds: class, instance id, the route they lived on, age, navigations since and open subscriptions. When the page has `ng.ɵgetInjectorProviders` (a development build of Angular 16.2 or later), Angular's DI debug data keeps every destroyed component in memory, so this part lists no instances and says so, pointing to the Chrome Memory panel. Detached views are named apart. |
| **Open subscriptions after destroy** | Subscriptions still open after the component that made them went away, grouped by class, instance and call site, with why each is flagged. Only while subscription tracking is on.                                                                                                                                                                                                                                                                                           |
| **Live effects and subscriptions**   | Components with live effects (from `ng.ɵgetSignalGraph`, Angular 20.1 and later) or tracked open subscriptions, with instance ids for `inspect-component`.                                                                                                                                                                                                                                                                                                                   |

| Argument    | Required | Value                                                    |
| ----------- | -------- | -------------------------------------------------------- |
| `component` | no       | Only classes whose name contains this text, in any case. |
| `limit`     | no       | Rows per table, 1 to 200. Defaults to 20.                |

Garbage collection runs when the browser decides, so the answer says "still retained" and points to the retainers in the Chrome Memory panel rather than calling it a leak. It also says what the page can't report: no `WeakRef` or debug API, no signal graph, or tracking off. Routes and call sites are masked like other live values. See [Leaks](../inspectors/components.md#leaks).

### Track subscriptions <ngmd-badge variant="alpha">Action</ngmd-badge>

`track-subscriptions` starts or stops subscription tracking on a page, the same switch as **Track subscriptions** in the Components panel. Reads: page.

| Argument | Required | Value                                                                                      |
| -------- | -------- | ------------------------------------------------------------------------------------------ |
| `action` | yes      | `start` or `stop`.                                                                         |
| `page`   | no       | The tab to track. Defaults to the most recent page for `start`, and every page for `stop`. |

While on, the overlay wraps `Observable.prototype.subscribe` and records which component made each subscription. `stop` puts `subscribe` back. Subscriptions made before tracking started are not seen, so reload the tab or go to the screen again after `start`, then call `find-leaks`. Tracking patches the page, so `track-subscriptions` is an `action` tool and `agent.readOnly` drops it. No action covers it, so `actions` leaves it in place. `agent.tools.components: false` hides both tools.

### inspect-signals

The signal graph the page reported: nodes (`signal`, `computed`, `linkedSignal`, `effect`), dependency edges, the component or injector they belong to, and recent value history per node. Reads: page.

| Argument    | Required | Value                                                                                                                                                        |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `selector`  | yes      | Host tag, class name or instance id of the component, like `app-root`. Or `root`, or a route path like `/admin` or `Route: admin`.                           |
| `node`      | no       | A node id or label. The answer holds only that node, or every node with that label, with its direct producers and consumers and their resources and history. |
| `history`   | no       | `false` leaves out the value history. Defaults to `true`.                                                                                                    |
| `framework` | no       | `false` leaves out the nodes Angular itself created (`framework: true`). Defaults to `true`.                                                                 |

The answer also holds:

| Field            | Value                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `resources`      | One entry per `resource()`, `httpResource()` or `rxResource()`: `status`, `isLoading`, `params`, `value`, `error`, `nodeIds`.            |
| `environments`   | The root and route injectors the page can report, with `id` and `name`.                                                                  |
| `changes`        | On a node or resource, every change since the page first saw it. The history keeps the last 50.                                          |
| `nodeCount`      | Set when Angular reported more than the 400 nodes the page keeps.                                                                        |
| `unnamedSignals` | Set when signals, computeds or linkedSignals in the graph have no `debugName`. Their history holds sampled values only.                  |
| `framework`      | `true` on a node that Angular's router, forms or HTTP code created. See [Framework signals](../inspectors/signals.md#framework-signals). |
| `watch`          | The node ids the page watches (`ids`) and whether write stacks are on (`stacks`). Set only while one of them is on.                      |
| `stack`          | On a `write` history entry while write stacks are on: the first 3 app frames of the code that set the signal.                            |

The answer is cut at 20,000 characters. A graph that is too long first keeps fewer history entries per node, then keeps the first nodes that fit. A note under the JSON says how many history entries and nodes it left out. Pass `node` or `history: false` to see the rest.

With `root` or a route path, the tool asks the page for the effects of that injector and waits up to 1.5 seconds for the answer. It reads that graph once and leaves the Signals page on the target it shows. If no injector matches, the answer lists the ones the page knows. On Angular 20.0, the answer says the live graph needs Angular 20.1 or later.

<ngmd-callout type="tip" title="One graph per page">
  The page reports one graph: the component picked on the Signals page or with <code>highlight</code>, otherwise the deepest component in the primary router outlet. Call <code>highlight</code> first to switch the graph to another component. Only signals a template or an effect has read appear.
</ngmd-callout>

### watch-signal <ngmd-badge variant="alpha">Action</ngmd-badge>

Watches a signal on the page, and turns write stacks on or off, the same switches as **Watch** and **Record write stacks** on the Signals page. Acts on: page.

| Argument | Required | Value                                                                                    |
| -------- | -------- | ---------------------------------------------------------------------------------------- |
| `node`   | no       | A node id or label from `inspect-signals`. A label watches every node with it, up to 20. |
| `watch`  | no       | `false` stops watching `node`. Defaults to `true`.                                       |
| `stacks` | no       | `true` records write stacks on the page, `false` stops.                                  |

Pass `node`, `stacks` or both. A watched signal logs each change to the page console and shows under **Watched** on the Signals page. With write stacks on, each `write` entry in the `inspect-signals` history carries `stack`: the first 3 app frames of the code that set the signal, without Angular, packages, zone.js and the overlay. Taking a stack slows every signal write, so turn it off when you are done. Both reset when the page reloads.

Watching changes what the page records, so `watch-signal` is an `action` tool and `agent.readOnly` drops it. No action covers signals, so `actions` leaves it in place. `agent.tools.signals: false` hides it.

### inspect-providers

The injectors a page reported. Element injectors list what each component injected and which injector supplied it. Environment injectors run from the platform down to the root and route injectors, and list what the services they already created inject. Reads: page.

| Argument   | Required | Value                                                                                                                                                                                                                |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selector` | no       | A tag name, a component or directive class name, an environment injector name like `Root`, `Platform` or `Route: admin`, an injector id, or a component instance id like `c12`. Returns only the matching injectors. |
| `token`    | no       | A token name, like `HttpClient`. Returns the injectors that provide it and the components or services that inject it.                                                                                                |
| `pageId`   | no       | Same as `page`.                                                                                                                                                                                                      |

A `selector` that names an element injector returns it with its lookup path resolved to names and provided tokens. One that names an environment injector, in any case, returns that injector's providers, what the services it already created inject, and its parent injectors. When nothing matches, the answer lists the tags and environment injector names on the page to retry with.

An element injector that belongs to a component carries `componentId`, the instance id that `inspect-component`, `list-components` and the `component-tree` resource use. `framework: true` marks the injectors and providers that come from the installed `@angular/*` packages; see [Framework injectors](../inspectors/injectors.md#framework-injectors).

Without `selector` or `token`, the answer is the whole tree and says which change detection mode the page runs. The answer stays within 20,000 characters and its JSON always parses. A larger tree shows element injectors as an outline (id, name, type, component, and provider and dependency counts), and when that is still too long it leaves out the deepest injectors and says how many. The environment injectors are always there, as an outline when they are large, and without their deepest injectors when even that outline is too long. A `selector` or `token` answer that is too long keeps whole entries and says how many it shows. `selector` and `token` take at most 500 characters each. When the page reported only part of its injector tree (it keeps at most 2000 element injectors and 2500 in all, and leaves out injectors nested more than 1000 levels deep), the answer says so.

### explain-injection

How Angular resolves one token for one component, element or environment injector: each injector on the lookup path in order, whether it provides the token and why the lookup stops. It reads the injector tree the page reported, so nothing is created or injected. See [Explain a lookup with flags](../inspectors/injectors.md#explain-a-lookup-with-flags). Reads: page.

| Argument   | Required | Value                                                                                                                                                                                                 |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selector` | yes      | Where the injection happens: a component or directive class name, a tag, a component instance id like `c12` (an error's owner id works), an injector id, or an environment injector name like `Root`. |
| `token`    | yes      | The token as the Injectors tab names it: a class name like `HttpClient` or an `InjectionToken` description like `API_URL`.                                                                            |
| `self`     | no       | `true` asks only the first injector.                                                                                                                                                                  |
| `skipSelf` | no       | `true` starts at the parent injector.                                                                                                                                                                 |
| `host`     | no       | `true` stops at the host element of the component that declares the start, where only its `viewProviders` and the component count.                                                                    |
| `optional` | no       | `true` ends in `null` instead of NG0201.                                                                                                                                                              |

The answer is a table of steps: **provides it**, **not provided**, **hidden** (a `viewProviders` entry the lookup can't see), **skipped**, **not asked** or **unknown**. A `providedIn: 'root'` service counts as provided once something on the page got it. When a selector matches several injectors, the answer uses the first and lists the others. Before Angular 16.2 the path is rebuilt from the rendered tree and providers are unknown, and the answer says so. `selector` and `token` take at most 500 characters each.

## NgRx

Two tools read the live `@ngrx/signals` and `@ngrx/store` state a page reported. Reads: page.

### inspect-signal-store

With `storeId`, the full state of one store: state, computed values, `withEntities()` collections (a summary of state and computed already there), methods with call counts, scope, where it is provided, and which components or injectors reference it. Without it, every store discovered so far, and the classic `@ngrx/store` state if present.

| Argument  | Required | Value                                                                                                   |
| --------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `page`    | no       | The tab to read. Defaults to every connected page.                                                      |
| `storeId` | no       | A store id from a previous call, or the id shown on the [NgRx Store](../inspectors/ngrx-store.md) page. |

### signal-store-history

The change log for a page's stores, oldest first: `@ngrx/signals` state diffs (method calls and `patchState` writes, each with a per-key diff), classic `@ngrx/store` actions, and `@ngrx/signals/events` dispatched events. A method-call entry carries a duration in milliseconds. With `watchState` registered, it is the time from the start of the method to that patch; without it, the time the whole call took. A signal-store entry carries the event that caused it when the change happened while that event was being dispatched. Each entry lists up to 50 changes; when there were more, it ends with how many were left out, such as `12 more changes not shown`.

| Argument  | Required | Value                                                                                                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`    | no       | The tab to read. Defaults to every connected page.                                                                                                               |
| `storeId` | no       | Only that store's entries. Without it, every store, action and event.                                                                                            |
| `since`   | no       | A `seq` from a previous call. Returns only entries after it. Requires `page` when more than one page is connected, since each page has its own sequence numbers. |

## Router

All router tools read the page, except `explain-render-mode`, which also reads your `*.routes.server.ts` files.

### Read the current route

| Tool                 | What it answers                                                                                                                                                                                                                                                                                      | Arguments                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `inspect-route`      | The current route: URL, query params, fragment, title, the navigation in flight, the active route tree (component, params, data, guards, resolvers) and the outlet tree with each outlet's `routerOutletData`. With `selector`, the route a component was rendered for, or whether a link is active. | `selector`: component class, element tag or link text               |
| `explain-navigation` | Recent navigations, newest first: who started each one, redirects and loops with the cause of each hop, per-phase timing, guard and resolver verdicts, lazy loads, and the cancel or error reason in plain language.                                                                                 | `url`, `id`, `limit` (1 to `limits.navigations`, default 5), `perf` |
| `export-navigation`  | A markdown repro of one navigation, with router options, any loop it is part of and the relevant slice of the route config. Defaults to the latest one that did not succeed.                                                                                                                         | `id`                                                                |

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

The page's result comes back as a JSON block cut at 15,000 characters. A cut result ends with a note saying so.

`action` is required. Only same-origin URLs that start with `/` are accepted. With `actions.router` set to `false`, `navigate`, `abort`, `replay` and `probe` answer **Navigating and clearing navigations is turned off in the devtools config (actions.router).** `instrument` and `resolve-lazy` still work. `navigate` is an `action` tool, so `agent.readOnly` drops the whole tool.

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

Without `page`, the tool uses the one page that has an `@ngrx/store` Store. If more than one page has a Store, it dispatches nothing and lists those pages with their URLs, so you can call it again with `page`. While a restore holds Store DevTools on a past state, the action is logged but does not change the state, and the answer says so. Set [`actions.ngrx`](../getting-started/configuration.md#actions) to `false` to drop the tool. Read the live state and log with the [`ngrx-store` resource](./resources.md#ngrx-store).

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
| `explain-form-invalid`   | Which fields make a form invalid, and why: the failing validator, its message, the value and whether it was touched. Without `form`, every invalid or pending form.                                                                                                                                                     | `form`, `path`                                 |
| `explain-field`          | One field: where each error comes from, why validation is skipped, the binding and DOM facts like the label and visible error text.                                                                                                                                                                                     | `form`, `path`, or `selector` (a CSS selector) |
| `explain-submit`         | What submit does, and why it might do nothing.                                                                                                                                                                                                                                                                          | `form`                                         |
| `form-payload`           | What the form sends: `value` against `getRawValue()`, fields that are sent without validation, and which fields the user changed.                                                                                                                                                                                       | `form`, `path`                                 |
| `explain-custom-control` | How a field is bound to its element, and what is wrong with the binding, such as value drift or a missing `setDisabledState`.                                                                                                                                                                                           | `form`, `path`                                 |

For "why is this form invalid", call `explain-form-invalid` first. The tools redact passwords and other secret-looking values.

Answers about large forms are cut to keep an agent's context small. Each cut ends with a note on what was left out and how to narrow the answer:

| Tool                   | Cap                                                                                                                                                                                                                                                                                                                         | Narrow with                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `inspect-forms`        | As many fields per form as fit in 20,000 characters, at most 200, taken level by level from the start of the tree. A group that lost fields carries `notShown` with the count. Values, error messages and metadata over 300 characters are cut. If not even one field fits, each form shows only its status and `notShown`. | `path`, `form` or `onlyInvalid`               |
| `explain-form-invalid` | 100 problems per form, then `… and N more not shown`.                                                                                                                                                                                                                                                                       | `path`                                        |
| `form-payload`         | 8,000 characters per value.                                                                                                                                                                                                                                                                                                 | `path`                                        |
| `export-form`          | The same field cap as `inspect-forms` for a snapshot. A fixture, header included, fits in 20,000 characters, and its header lists at most 20 failing fields.                                                                                                                                                                | `inspect-forms` or `form-payload` with `path` |
| `lint-forms`           | 100 findings.                                                                                                                                                                                                                                                                                                               | `form`                                        |
| `form-diff`            | 100 changed fields.                                                                                                                                                                                                                                                                                                         | `form` or a later `since` marker              |

With `path`, `inspect-forms`, `explain-form-invalid` and `form-payload` start at that group or field, so a cut part of the form can be read one group at a time.

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

`form-action` and `fill-form` always act on the form `form` names. `store-as-global` does not overwrite a `$form` or `$control` that the page defined itself, unless you pass `force`.

`snapshot` keeps a copy of the form value, so it refuses a form whose value cannot be cloned, such as a control that holds a function. `inspect-forms` with `includeValues: false` also leaves out uncommitted input, model drift and metadata.

<ngmd-callout type="warning" title="Some actions need confirm">
  <code>reset</code>, <code>submit</code> and <code>restore</code> need <code>confirm: true</code>, and so does <code>fill-form</code> with <code>submit</code>. Disabled reactive fields need <code>force</code>.
</ngmd-callout>

## Pipes

### Lint pipes

`lint-pipes` checks the pipes in your source. Reads: source. No arguments.

It finds impure pipes used inside `@for`, `| json` left in templates, pure pipes whose `transform()` reads a signal, and method calls piped to `| async`. See [Lint](../inspectors/pipes.md#lint).

### Explain a pipe

`explain-pipe` explains one pipe: where it is declared or used, whether it is pure, live instance and call counts, the time spent in `transform` and the errors it threw, the last input and output, a stale-value warning, `| async` usages that resubscribe on every check or subscribe to the same source as another usage, and lint findings. Reads: source, plus the page for live counts.

| Argument | Required | Value                                              |
| -------- | -------- | -------------------------------------------------- |
| `name`   | yes      | The pipe name as used after `\|` in a template.    |
| `page`   | no       | The tab to read. Defaults to the most recent page. |

Live data comes from one tab: the one `page` names, or the most recent. When more than one tab reports pipes, the answer starts with the tab it read. Live counts, times, errors, input and output appear while recording is on. Start it with [`record-pipes`](#record-pipe-calls) or with **Record calls** in the [Pipes inspector](../inspectors/pipes.md).

The **Live** line tells these cases apart:

| Case                                | What the tool says                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| No page is connected                | There is no live data. The stdio server always reports this.       |
| A page is connected, pipe not used  | No rendered component on the page uses the pipe.                   |
| Pipe in use, recording off          | Instance count and components, plus a hint to start recording.     |
| Pipe in use, recording on, no calls | Instance count and components, and that no calls are recorded yet. |

### Record pipe calls <ngmd-badge variant="alpha">Action</ngmd-badge>

`record-pipes` starts or stops call recording on a page, the same switch as **Record calls** in the panel. Reads: page.

| Argument | Required | Value                                                                                          |
| -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `action` | yes      | `start` or `stop`.                                                                             |
| `page`   | no       | The tab to record on. Defaults to the most recent page for `start`, and every page for `stop`. |

`start` records on the tab `page` names, or on the most recent tab. Other tabs stay unpatched. `stop` stops that tab, or every tab without `page`. Each recording starts from zero, and the calls recorded so far stay after a stop. Call `record-pipes` with `action: "start"`, use the app, then call `explain-pipe`. Recording patches the page, so `record-pipes` is an `action` tool and `agent.readOnly` drops it. No action covers pipes, so `actions` leaves it in place. `agent.tools.pipes: false` hides it.

## SSR & HTTP

These tools read the HttpClient calls that `withPangular()` recorded and the SSR requests that `ssrMiddleware` traced in your server. See [SSR & HTTP](../inspectors/ssr-http.md). Reads: page.

| Tool                  | What it answers                                                                                                                                                                                                                        | Arguments                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `list-ssr-requests`   | Recent traced SSR requests: id, URL, status, render mode, render time, server calls, and whether a connected page loaded the response.                                                                                                 | `limit`                             |
| `explain-ssr-request` | One request end to end: timings, kept response headers, the router's guard and resolver times, each server call with its transfer cache outcome, then the browser page with its hydration result and the calls the browser made again. | `id`, `url`                         |
| `list-http-calls`     | The app's HttpClient calls, newest first: side (SSR or client), method, URL, status, duration, and flags for mocked, faulted, cancelled, transfer cache hit and the matched rule.                                                      | `url`, `failed`, `limit`, `preview` |

`explain-ssr-request` picks the request by `id`, else the newest one for `url`, else the newest one.

`list-http-calls` lists every tab and the server when you leave out `page`. With `page`, it lists that tab and the server calls of the SSR request that served it. `url` keeps calls whose URL contains the text. `failed` keeps calls with a status of 400 or more, no response, an error, or a cancel. `limit` defaults to 30 (at most 200). `preview` adds each call's response preview. Secrets in URLs, errors and previews are masked, and `url` matches the masked URL.

### Fault rules <ngmd-badge variant="alpha">Action</ngmd-badge>

These tools read and change the rules of [Fault injection](../inspectors/ssr-http.md#fault-injection), the same rules the panel shows. Rules live on the devtools server and apply to every connected tab, so the tools take no `page`. Reads: page.

| Tool               | What it does                                                                                                                                          | Arguments                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `list-http-rules`  | Lists the rules in match order: id, on or off, method, URL pattern, where it applies (client, SSR or both) and its effect (status, delay, mock body). | none                                                                                   |
| `set-http-rule`    | Adds a rule, or replaces the rule with `id`, and returns the saved rules.                                                                             | `pattern` (required), `id`, `method`, `target`, `status`, `delayMs`, `body`, `enabled` |
| `remove-http-rule` | Removes the rule with `id` and returns the rules left.                                                                                                | `id` (required)                                                                        |

`set-http-rule` checks its input the way the panel's form does. `pattern` is a substring or a glob where `*` matches anything, up to 500 characters. A leading `^` anchors it at the start of the URL path. `target` is `client`, `server` or `both` (the default). `status` is one of the statuses the panel lists. `delayMs` runs from 0 to 10000. `body` is JSON text or a JSON value, up to 100,000 characters. A rule needs a `status`, a `delayMs` or a `body`, and there can be at most 50 rules. A rule that breaks one of these is refused with the reason, and nothing changes. A rule that applies to SSR takes effect on the next page load. Patterns and bodies in the answers are masked like recorded calls.

With [`actions.http`](../getting-started/configuration.md#actions) set to `false`, `set-http-rule` and `remove-http-rule` are dropped, and `list-http-rules` says that no rule applies.

### Clear recordings <ngmd-badge variant="alpha">Destructive</ngmd-badge>

Resets recorded data between reproduction runs: recorded HTTP calls, router navigations, and Analog server calls. Reads: page.

| Tool               | What it does                                                                                                   | Arguments                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `clear-recordings` | Clears recorded HTTP calls, router navigations, or Analog server calls, and broadcasts the reset to the panel. | `target` (required), `page` |

`target` is one of `http`, `router`, `analog`, or `all`. With `router`, `page` clears navigations for that browser tab only; when left out, it clears navigations for every reporting page. A `page` that sends no router data gets an answer that lists the pages that do, and nothing is cleared.

Each target needs three settings turned on: its write action ([`actions.http`](../getting-started/configuration.md#actions), `actions.router` or `actions.analog`), its agent tools (`agent.tools.<target>`) and its inspector (`inspectors.<target>`). A single target with one of them off is refused. With `all`, the targets that pass are cleared and the others are reported as skipped. When no target passes, the tool is not listed.

## Capacitor

These tools read what a Capacitor app reported: its platform, its plugins and the plugin calls it made. See [Capacitor](../inspectors/capacitor.md). Reads: page.

| Tool                     | What it answers                                                                                                                                                                                                                                                                            | Arguments                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `list-capacitor-calls`   | Plugin calls, newest first: plugin and method, `native` or `web`, arguments, the result or the error with its code, and the duration. Marks **not implemented** calls and streams, and ends with the active listeners, their event counts and the masked payload of each one's last event. | `plugin`, `failed`, `slowMs`, `limit` |
| `list-capacitor-plugins` | The platform, the server URL, whether CapacitorHttp and native logging are on, the WebView user agent, and each plugin: available, imported, installed natively, its native methods, and a hint when they disagree.                                                                        | none                                  |

`plugin` keeps calls to one plugin, ignoring case. `failed` keeps calls that failed. `slowMs` keeps calls that took at least that many milliseconds, counting a pending call's time so far. `limit` defaults to 30 (at most 200). Without `page`, both tools answer for the most recent page with a native bridge, so a desktop tab of the same app doesn't hide the device, and they name the other pages that report. A long answer is cut at about 20,000 characters with a note on how to narrow it, and a plugin lists its first 20 methods. Native calls are logged on iOS and Android. Calls a web implementation answers are logged only when the app loads `@pangular-inspector/devtools/capacitor-hook` before `@capacitor/core`, and the answer says so when it doesn't. Arguments, results and errors are masked with the server's redaction too.

## Errors

These tools read what a page captured: errors from Angular's `ErrorHandler`, uncaught errors, unhandled promise rejections and console calls. See [Errors](../inspectors/errors.md). Reads: page.

| Tool            | What it answers                                                                                                                                                                                                                                                                                                           | Arguments                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `list-errors`   | Error groups, most recent first: id, count, when last seen, the Angular error code linked to its reference page, the message, the owning component with its instance id, and the source (`handler`, `window` or `promise`).                                                                                               | `code`, `limit`            |
| `explain-error` | One error by `id`: message, count, sources, the owning component, the stack of the first occurrence, and for an Angular code its reference page and a short known cause. With `code` instead, the reference entry and the errors that carry it. An NG0100, a hydration mismatch or a missing provider adds its explainer. | `id`, `code`               |
| `list-console`  | Console calls, newest first: when, level, the text of the arguments and the Angular code it mentions. Calls repeated in a row show once with a count.                                                                                                                                                                     | `level`, `search`, `limit` |

The explainers are the ones the [Errors](../inspectors/errors.md#explainers) tab shows. For NG0100: the binding, the template function, the previous and current value, the component fields that hold the new value, and the named signals written with it just before the check, with the code that wrote them when write stacks are on. For NG0500 to NG0503: a diff of the server HTML Angular expected and the client DOM it found. For NG0201 and `NullInjectorError`: the token and Angular's dependency path, to pass to `explain-injection`.

`code` accepts `NG0100`, `ng100` or `NG01203`. `explain-error` says so when Angular's error reference has no page for a code, and gives no known cause then. Pass the owner's instance id to `inspect-component` for its inputs and state. `list-errors` takes `limit` up to 100 (default 30), and `list-console` up to 200 (default 50). Messages, stacks and console text are masked like other live values.

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

### Call a server route <ngmd-badge variant="alpha">Destructive</ngmd-badge>

`analog-call-api` sends a request to a route on the running dev server, like `GET /api/v1/hello`, and returns the status, time and body. `path` is a path on the dev server that starts with a single `/`, not a full URL. `POST`, `PUT`, `PATCH` and `DELETE` need `confirm: true`. Secret keys, tokens and `Bearer` values in the body are masked. Reads: Vite plugin.

`path` must be an API route (under the API prefix, or any route in `src/server/routes`), an `/_analog` URL or a page of the app. The tool refuses Vite internals such as `/@fs/` and `/@id/`, Vite query flags such as `?raw`, `?url` and `?import`, `.` and `..` segments, and any path that names a file or folder in the project, so it can't read your source or files outside the app.

| Argument  | Required | Value                                                         |
| --------- | -------- | ------------------------------------------------------------- |
| `path`    | yes      | An API route, an `/_analog` URL or a page path.               |
| `method`  | no       | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`. |
| `body`    | no       | A JSON body.                                                  |
| `confirm` | no       | Required for methods other than `GET`, `HEAD` and `OPTIONS`.  |

### Lint

`analog-lint` finds Analog mistakes: two files for one URL, a missing default export, a layout without `router-outlet`, bad API method suffixes, prerender entries that match nothing, and frontmatter errors. It also reports live problems, like a `load()` fetched twice, a server function read that runs again after hydration, or a restart needed. Hydration errors and restart hints come from one page: pass `page` to pick it, or leave it out for the most recent. If no page with that id sends Analog data, the answer says so and lists the pages that do.

<ngmd-alert severity="helpful">
  <code>analog-server-calls</code> and <code>analog-call-api</code> need the <a href="../getting-started/vite.md">Vite plugin</a>. The plugin records the calls and knows the dev server address.
</ngmd-alert>

## Shared state

`devframe_state_read` reads the devtools' live shared state. Call it without arguments to list the keys, then with `key` to read a value as JSON. Over HTTP, it leaves out the keys of an inspector whose agent tools are hidden (`agent.tools.<name>: false`).

Use it for data that has no dedicated tool, such as hydration data and TransferState payloads (`pangular:http`, `pangular:http-payloads`) or live pipe usage (`pangular:pipe-usage`). See [Resources](./resources.md) for every key.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/agents/resources" title="Resources"></ngmd-pill>
  <ngmd-pill href="/security" title="Security"></ngmd-pill>
</ngmd-pill-row>
