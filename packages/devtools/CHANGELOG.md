# Changelog

All notable changes to `@pangular-inspector/devtools` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com).

## 1.0.0

Most setups need changes when they come from 0.0.7, so read **Upgrading from 0.0.7** first.

### Upgrading from 0.0.7

These changes can break a 0.0.7 setup without an error.

- **The Vite plugin needs Vite 6 or later.** The `vite` peer range is `>=6`, the versions its tests run against. Vite 5 apps can use the Express hub or the standalone CLI instead. npm still checks the optional peer against an installed Vite 5 and stops with `ERESOLVE`, so upgrade to Vite 6, or add `legacy-peer-deps=true` to the project's `.npmrc` (which `npm ci` needs too, and which turns off every peer check in the project) before `npm install -D @pangular-inspector/devtools`. pnpm only warns.
- **The Vite plugin asks for the one-time code, and its MCP endpoint asks for a bearer token, by default.** In 0.0.7 the code was on only when a non-loopback host or origin was allowed. An MCP client set up against `http://localhost:5173/__devframes/__mcp` gets `401`. Send the token (see "Send a token" in the MCP server docs, or run `pangular mcp --print-config`), or pass `auth: false` on a machine only you use.
- **The Express hub is off in production:** when `NODE_ENV` is `production`, or when the server is a production Angular build (`ngDevMode` is `false`). `nodeMiddleware` and `ssrMiddleware` then only call `next()`, and `/__devframes/` answers `404`. To keep the devtools on a staging server, pass `enabled: true` to `initPangularHub()`. Check `devtools.enabled` before the `app.use()` calls to skip them.
- **The Express hub answers this machine only.** It refuses requests from other addresses and requests to a non-loopback `Host` with `403`. To reach it from a phone or another machine, pass `allowLan: true` and list the device's origin in `allowedOrigins`. `allowLan` needs the one-time code on.
- **`pangular dev` runs the same request gate.** It refuses a foreign `Origin`, `Origin: null` and a non-local `Host`. For an app on another origin, pass `--allowed-origin` or `--proxy-origin`.
- **`server.allowedHosts: true` no longer turns off the origin checks.** It still lets any `Host` through, as it does for Vite, but a request with an `Origin` must come from a loopback origin, the extension, `allowedOrigins`, or the same origin as its `Host`. Another website gets `403`, and the plugin prints a warning. List your hosts instead, such as `['.ngrok-free.app']`, or add the origin to `allowedOrigins`.
- **The Vite plugin adds the overlay to the pages it serves** (`overlay`, on by default). If your `main.ts` imports `@pangular-inspector/devtools/overlay` or calls `initOverlay()` with your own options, pass `overlay: false` to the plugin, or remove the import.
- **The overlay stays off in production builds.** A static import of `@pangular-inspector/devtools/overlay` starts nothing where `ngDevMode` is `false`, but it still adds the overlay's code to the bundle. Import the overlay, and `disposeOverlay` from `/overlay-manual`, inside a development check, as the overlay docs show.
- **Three write actions are added, and they are on by default:** `components`, `tanstackQuery` and `plugins`. A config that turned actions off one by one (`actions: {forms: false, router: false, ...}`) now lets the panel and agents edit component inputs, properties and signals (`set-component-property`, `set-signal`), act on TanStack queries and run plugin actions. Add the new keys, or use `actions: false` or `agent.readOnly: true` to turn every write off.
- **Four inspectors are added, and they are on by default:** `tanstackQuery`, `capacitor`, `errors` and `plugins`. The errors inspector wraps Angular's `ErrorHandler` and taps the page's console. Turn one off with `inspectors: {errors: false}`.
- **Idle pages stop pushing.** With no panel open, a page sends updates only for `limits.idleAfterMs` (60 seconds by default) after an agent's last tool call. After that it sends only a small heartbeat until a panel opens or an agent calls a tool. An agent that only reads resources, such as `pangular:component-tree`, can see older data. Call a tool first, or set `limits.idleAfterMs: 0` to keep pushing.
- **The supported ranges changed.** The `@angular/core` and `@angular/common` peers are `>=12.2.0 <23.0.0` (was `>=20`, with no upper bound). Features that need a later Angular say so in the panel and in agent answers. Angular 23 gets a peer warning until a release raises the range. `engines.node` is `>=22.12.0` (was `>=22`): the Express hub loads its server code from `node_modules` when it starts, which needs Node.js 22.12. On an older Node.js, `initPangularHub()` prints a warning and stays off, and the app runs without it.
- **<kbd>Alt+Shift+P</kbd> opens and closes the popup by default.** If it clashes with a shortcut of your app, change it with `popup: {hotkey: '...'}` or turn it off with `popup: {hotkey: false}`.
- **`initDevframe()` hosts need `ws: false`** (or a `server`) to connect. Without it, Devframe advertises a WebSocket that `nodeMiddleware` alone does not serve, and the page never connects. Import `initDevframe` from `@pangular-inspector/devtools/devframe`. See "Mount only the panel" in the Express docs.
- **Don't install `devframe` yourself.** The 0.0.7 README said `npm install @pangular-inspector/devtools devframe`. The package depends on the Devframe version it needs, and a second copy at another version can split the panel from the definition. Remove a direct `devframe` dependency unless your own code uses it.
- **`pangular dev` asks for the MCP token.** While the one-time code is on, its `/__mcp` route needs the same bearer token as the Vite plugin and the Express hub. Send it as for those servers, or pass `--no-auth` to turn both the code and the token off.
- **Trusted browsers sign in again once.** Session tokens moved to `~/.pangular-inspector/auth/<project>/auth.json`, one folder per project, readable by you only. They expire 7 days after the code was exchanged. This release doesn't read the old files, `~/.devframes/devframe/auth.json` and `~/.pangular/devframe/auth.json`. Delete them if no other devframe tool uses them.
- **Wrong one-time codes lock the server.** After 3 wrong codes on a connection, each attempt waits longer, up to 60 seconds. All clients together get at most 10 wrong codes a minute. After 50 wrong codes since the last right one, the server accepts no code until it restarts. Pages that already connected stay connected. If you didn't type those codes, something on your machine or network is guessing. Restart the dev server to get a new code.
- **The Analog, Capacitor and TanStack Query agent tools are listed only for apps that use them:** the project's `package.json` lists the library, the project is an Analog app, or a page reports the library's data. To list them anyway, set `inspectors.<name>` or `agent.tools.<name>` to `true`.
- **Analog on pnpm needs one setting.** `@analogjs/vite-plugin-nitro` imports `h3` without declaring it, so under pnpm it can resolve to the h3 2 that this package brings in, and `vite build` fails with "does not provide an export named 'createEvent'". Declare `h3@^1` for the plugin with pnpm `packageExtensions`, as the Analog guide shows.
- **Agent tools, arguments and resource templates are renamed, and old names are refused.** Update prompts, scripts and client allowlists. See **Agent tools renamed** below.
- **Most entry points export less.** See **Removed exports** below.

### Agent tools renamed

This release renames tools and arguments so that each name follows one pattern: an optional library prefix (`ngrx-`, `redux-`, `tanstack-`, `capacitor-`, `analog-`), then a verb that says whether the tool reads source (`scan`), reads the page (`list`, `inspect`, `explain`, `lint`) or writes (`run`, `set`, `record`). There are no aliases. A call to an old tool name is an unknown tool. An old argument is refused with `isError` and the name to use instead, such as ``There is no `selector` argument; pass `component`.`` An argument that moved to another tool (`record` on `change-detection`, `overlay` on `hydration`, `routeId` and `on` on `navigate`) is refused with `isError` and the tool to use. Tool ids are `pangular:<name>` on the server and `pangular_<name>` for MCP clients; the tables leave the prefix out.

| 0.0.7                                                                                    | Now                                                                                                             |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `get-routes`, `get-components`, `get-pipes`, `get-signals`, `get-providers`              | `scan-routes`, `scan-components`, `scan-pipes`, `scan-signals`, `scan-providers`                                |
| `get-ngrx-store`, `build-meta`                                                           | `ngrx-scan`, `scan-build`                                                                                       |
| `lint-templates`, `lint-pipes`, `explain-render-mode`                                    | `scan-templates`, `scan-pipe-usage`, `scan-render-mode`                                                         |
| `inspect-signal-store`, `signal-store-history`                                           | `ngrx-inspect-store`, `ngrx-history`                                                                            |
| `dispatch-ngrx-action`, `restore-ngrx-state`                                             | `ngrx-dispatch`, `ngrx-restore`                                                                                 |
| `inspect-ngrx-entry`, `export-ngrx-session`, `import-ngrx-session`, `generate-ngrx-test` | `ngrx-inspect-entry`, `ngrx-export-session`, `ngrx-import-session`, `ngrx-generate-test`                        |
| `inspect-redux-stores`                                                                   | `redux-inspect-stores`                                                                                          |
| `list-queries`, `inspect-query`, `query-action`                                          | `tanstack-list-queries`, `tanstack-inspect-query`, `tanstack-run-query`                                         |
| `list-capacitor-calls`, `list-capacitor-plugins`                                         | `capacitor-list-calls`, `capacitor-list-plugins`                                                                |
| `analog-routes`, `analog-explain-url`, `analog-api-routes`                               | `analog-scan-routes`, `analog-scan-url`, `analog-scan-api-routes`                                               |
| `analog-server-functions`, `analog-content`, `analog-prerender-plan`                     | `analog-scan-server-functions`, `analog-scan-content`, `analog-scan-prerender`                                  |
| `analog-current-page`, `analog-server-calls`, `analog-call-api`, `analog-render-modes`   | `analog-inspect-page`, `analog-list-server-calls`, `analog-run-api`, `analog-explain-render-modes`              |
| `form-payload`, `form-history`, `form-diff`, `form-action`, `explain-form-invalid`       | `inspect-form-payload`, `list-form-changes`, `explain-form-changes`, `run-form-action`, `explain-invalid-forms` |

Some tools are merged or split:

| 0.0.7                                                                    | Now                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `wait-for-form` (`since`)                                                | `wait-for` with `condition: "form"` (`after`)                                    |
| `navigate` with `action: "navigate"`                                     | `navigate` with `action: "go"`                                                   |
| `navigate` with `action: "probe"`                                        | `probe-route` (`url`), an `action` tool that needs `actions.router`              |
| `navigate` with `action: "instrument"`                                   | `record-guards` (`on`), an `action` tool that stays with `actions.router: false` |
| `navigate` with `action: "resolve-lazy"`                                 | `list-routes` with `resolveLazy: <routeId>`, a read                              |
| `export-navigation`                                                      | `explain-navigation` with `format: "repro"`                                      |
| `http-waterfall`                                                         | `list-http-calls` with `view: "waterfall"`                                       |
| `change-detection` with `record`, `flash`, `track` or `angularProfiling` | `record-change-detection`, an `action` tool. `change-detection` is always a read |
| `hydration` with `overlay`                                               | `highlight` with `hydration`. `hydration` is always a read                       |

Arguments and resources:

| 0.0.7                                                                                               | Now                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pageId` on any tool                                                                                | `page`                                                                                                 |
| `selector` naming a component (`inspect-component`, `inspect-signals`, `inspect-route`, `wait-for`) | `component`                                                                                            |
| `selector` in `highlight` and `screenshot-component`                                                | `component` (id, class or tag) or `selector` (CSS only). A `component` that matches nothing is refused |
| `selector` naming an injector (`inspect-providers`, `explain-injection`)                            | `injector`                                                                                             |
| `signal` in `set-signal`                                                                            | `property`                                                                                             |
| `storeId` (id only)                                                                                 | `store` (id or name)                                                                                   |
| `since` as an NgRx `seq` or a forms marker                                                          | `after`. `since` in `list-console` is still a time                                                     |
| Template `pangular://page/{pageId}/<name>`                                                          | `pangular://pages/{pageId}/<name>`                                                                     |
| Template name `pangular:page:<name>`, list entry `pangular:page:<name>:<pageId>`                    | `pangular:<name>-of-page`, `pangular:<name>-of-page:<pageId>`                                          |

The `devframe://resource/…` and `devframe://state/…` URIs are unchanged. `pangular lint --format json|sarif` reports each lint's `tool` with the new names.

Answers changed too. Every tool answers with one plain text block that holds the markdown itself, instead of a text block holding JSON-escaped `{"markdown": "..."}`. No tool declares an `outputSchema` or sends `structuredContent`. The `scan-*` tools answer compact JSON as one text block. `screenshot-component` still sends a text block and an image block, and refusals are still one text block with `isError: true`.

### Removed exports

Each entry point exports only its documented API. The values below were internals, and their types are gone with them. If you used one, open an issue with the use case.

| Entry point                    | Removed                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`, `/devframe` and `/config` | `ACTION_TOOLS`, `AGENT_INSPECTOR`, `FORM_WRITE_ACTIONS`, `HTTP_RULE_STATUSES`, `PAGE_AGENT_ENTRIES`, `PANGULAR_CONFIG_KEY`, `ROUTER_WRITE_ACTIONS`, `RPC_INSPECTOR`, `actionBlockedMessage`, `agentAllowed`, `configFromConnection`, `isHttpRuleStatus`, `isPageAgentEntry`, `pangularConfigProblems`, `pangularConfigWarning`, `pickPangularConfig`, `rpcAllowed`, `summarizePangularConfig` |
| `/vite`                        | Every named export: `allowsRemoteOrigins`, `blockedOriginReporter`, `hubAuthFor`, `hubOriginRegistry`, `hubOriginRegistryFor`, `hubRequestGate`, `hubUpgradeListener`, `isAllowedHubOrigin`, `isAllowedHubRequest`, `isHubPath`, `normalizeAllowedOrigins`, `releaseServerState`. The plugin stays the default export                                                                         |
| `/hub`                         | `hubDefaultOrigins`                                                                                                                                                                                                                                                                                                                                                                           |
| `/cli`                         | `PANGULAR_CONFIG_FILE`, `checkReportOutDir`, `guardReportOutDir`, `loadCliConfig`, `looksLikeAngularProject`, `resolveCliRoot`, `startupLines`                                                                                                                                                                                                                                                |
| `/http`                        | `MAX_CALLS`, `MAX_DELAY_MS`, `MAX_RULES`, `RULES_STORAGE_KEY`, `claimTransferEntry`, `clientRules`, `decodePayload`, `httpRegistry`, `matchRule`, `pangularHttpInterceptor`, `parseBody`, `resetTransferEntries`, `ruleHasEffect`, `ruleStatus`, `sanitizeCalls`, `sanitizeRules`, `storeRules`, `transferCacheEligible`. Use `providePangularHttp()` or `withPangular()`                     |
| `/popup`                       | `registerNgrxSignals`. Import it from `/overlay` or `/overlay-manual`                                                                                                                                                                                                                                                                                                                         |

What remains: `/config` exports `DEFAULT_POPUP_HOTKEY`, `PANGULAR_ACTIONS`, `PANGULAR_INSPECTORS`, `PANGULAR_LIMITS` and `resolvePangularConfig`. `.` and `/devframe` export the same plus `createPangular`, `initDevframe` and the devframe definition as the default export. `/hub` exports `PANGULAR_HUB_BASE`, `hubEnabled` and `initPangularHub`. `/cli` exports `createPangularCli`, `buildReport` and `DEFAULT_REPORT_DIR`, and `/http` exports `providePangularHttp` and `withPangular`. The overlay, Angular Native and NativeScript entries keep their exports.

### Security

- Gate every hub request on the client address, the `Host` header and the origin, for the Express hub, the Vite plugin and `pangular dev`. With `allowLan`, a DNS rebinding name pointed at your network address is refused.
- Turn the one-time code and the MCP bearer token on by default in the Vite plugin, and require the MCP token in `pangular dev`.
- Keep the Express hub and the overlay off in production unless `enabled: true` is passed to the hub.
- Back off and lock the server after wrong one-time codes, and never compare a refused code with the real one.
- Keep trusted session tokens in a `0600` file per project, and expire them after 7 days.
- Expire a session token at the moment it turns 7 days old, not at the next hourly check, and stop trusting the connections that still use it. devframe trusts any token left in the store and kept already trusted connections after their token was dropped.
- Don't count the right one-time code sent after it expired as a wrong guess. A slow developer no longer drifts toward the backoff and the lock. Wrong codes still count, also after the code expired.
- Stop `server.allowedHosts: true` from turning off the origin checks, and warn about it.
- Mask URL passwords and `Authorization` credentials (`Basic`, `Digest`, `Token`) in everything sent to the panel and to agents.
- Mask email addresses in URLs as `[email]`, also with the `@` encoded as `%40`, in every redacted URL (router, HTTP, SSR, TransferState and the rest) and in the Analog server call log. An `@` that isn't an address, such as `/@angular/core`, and the user in a URL's authority stay (#372).
- Mask more secrets: OpenAI, Anthropic, GitLab, npm, Hugging Face and SendGrid keys, Slack webhook URLs, the `Ocp-Apim-Subscription-Key` header, secret values that run past separators, secret XML elements and attributes, and token-like positional parts of TanStack Query keys and mutation variables.
- Mark page text as untrusted in every agent tool answer.
- Refuse writes when the target tab is unclear, instead of acting on whichever tab changed last.
- Pairing tokens (`auth: {tokens}`, `--auth-token`, `PANGULAR_AUTH_TOKEN`) let an app on a device connect without typing the code. The CLI prints only a short hash of each token.
- Hide the shared state of a turned-off inspector from agents.
- Mask secret route params in named outlets, such as the token in `/(side:reset/:token)`, before the navigation is recognized and in router link targets. The route config match read only the primary path. It also follows an empty-path layout route into its named-outlet children, as the router does, so `/(side:reset/:token)` and `/home(side:reset/:token)` are masked when `reset/:token` sits under `{path: '', children: [...]}`. The active route walk also follows `firstChild` when `children` is missing, and stops after 200 routes.
- Leave the `redaction` config (`secretNames`, `unmask`) out of `__connection.json`, which answers before the one-time code. Pages get it from the server once they are trusted, and read nothing from the app until they have it. `initOverlay()` still resolves once connected, without waiting for the code. The Dashboard asks for the config the same way to list **Extra secret names** and **Unmasked names**. A static report leaves those rows out (#419).
- Mask secret Signal Forms field values in signal graphs and their history. Signal Forms keeps each field value in an unnamed signal, so a `password`, `token` or `apiKey` field showed in the graph of its component on the Signals page, in `inspect-signals` (also when it reads a component by `component` or `selector`), in the `signal-graph` resource, over WebMCP and in the static report. The page now masks the values of the component's secret fields (by name, `redaction.secretNames`, `type="password"`, a credential `autocomplete` or a mask marker, and their last 50 values) in every node, resource and history entry before the graph leaves it.
- **Redaction counts.** Where the panel shows masked data (an HTTP response preview, the TransferState payload, the NgRx state tree, a form's fields and a component's inputs and properties), a line says how many values were masked. Agent answers that hold masked values end with `_Redaction masked N values in this answer._` (#371).
- The HTTP, JSON text and Analog redaction helpers live in one module, `redaction.ts` (#371).

### Features

#### Setup and workflow

- The Vite plugin loads the overlay itself, so setup is one line in `vite.config.ts`. New plugin options: `allowLan`, `overlay`, `terminals` and `serverPlugins`.
- New hub options: `enabled`, `allowLan`, `terminals`, `serverPlugins`, `extraDevframes` and `browserDistFolder`. The Vite plugin takes `extraDevframes` too, to mount other devframes on the same hub (#373).
- Open in editor: <kbd>Alt</kbd>+click a component on the page, or a file and line in the panel.
- A command palette (<kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd>) with a command for every tab and action.
- A **Settings** page: theme, hidden, pinned and reordered tabs, passive mode, a counts launcher, and a **Browser agents** switch.
- An opt-in counts launcher: the popup's floating button becomes a pill with the render and error counts of the page while the panel is closed. Off by default, turned on in **Settings**.
- One search field, named **Filter**, on every page, with saved filter chips per view (kept in the browser's `localStorage`).
- A splitter between the **Injectors** tree and its detail, and between the **NgRx Store** change list and its entry, with the width saved per view.
- Each tab keeps its scroll position, and the Timeline, SSR & HTTP, NgRx Store, TanStack Query, Forms and Capacitor tabs keep their selected item, across tab switches and panel reloads (kept in `sessionStorage` per view and page).
- **Pause** and **Follow newest** on the live lists: the SSR & HTTP timeline, the NgRx Store change log and the router **Navigations** view. A paused list counts the entries that arrive meanwhile.
- Sortable column headers with `aria-sort` on the SSR & HTTP call table (method, URL, status, time) and the **Source route config** table.
- The router **Config** view is a tree grid: each route has its level and expanded state, and the arrow keys move, expand and collapse.
- One shared loading, error (with **Retry**), empty and no-match (with **Clear filters**) state across the pages.
- Chrome extension: an **Angular component** pane in the Elements panel that shows the selected element's component, inputs and signals, masked like the panel.
- Chrome extension: a toolbar button whose popup shows the Angular version, the build, the devtools server and the overlay of the current tab. It asks for `activeTab` and `scripting`, which add no install warning.
- Chrome extension: a site access page that lists the hosts allowed from the panel, with **Remove**.
- Chrome extension: apps inside a frame (Storybook, micro-frontend shells) are found. The panel reads that frame and looks for its server on the frame's origin.
- A splitter for the docked popup, pop-out into its own window, and the `popup.hotkey` option.
- Item links (`#tab=&id=&page=`) and the `open-in-panel` agent tool.
- A **Terminals** dock that runs the project's build and test commands (opt in with `terminals: true`).
- `ng add @pangular-inspector/devtools` wires the devtools in: the Vite plugin for a Vite or Analog app, `initPangularHub()` in an Express `server.ts`, or the standalone CLI steps otherwise, and the overlay in `main.ts` behind `ngDevMode`. It leaves files it does not recognize alone and prints the snippet, and a second run changes nothing (#373).
- The Vite plugin's `lanAddress` option (off by default) injects the dev server's LAN address as `__PANGULAR_LAN_URL__` into the app and into development builds, so a Capacitor or NativeScript app on a phone finds the devtools. It needs `allowLan` in effect and `server.host` on the network. `lanDevtoolsURL()` reads it, and the NativeScript overlay connects there when no `baseURL` is given (#373).
- Hub messages and toasts, a dock group with badges, and an **All tools** dock.
- New entry points: `/overlay-manual` (starts nothing on import), `/plugin`, `/capacitor-hook`, `/store-hook`, `/startup-hook`, `/ssr` and `/cd-data`.
- New config options: `agent.browserTools`, `limits.capacitorCalls`, `limits.idleAfterMs`, `popup`, `plugins` and `redaction.entropy`.
- `limits.cdSlowMs` (default 16 ms) sets when a change detection cycle counts as slow. The recording flags cycles over it, the `change-detection` agent tool counts and marks them, and the panel chart draws its budget line there instead of at a fixed 16.6 ms.
- `redaction.entropy`, off by default, masks long high-entropy strings that no name or shape rule catches, such as an opaque token in a harmless field. `true` masks runs of 24 characters or more; `{minLength, threshold}` sets other limits. Hex values, UUIDs, ULIDs and camelCase identifiers stay readable, and known shapes keep their prefix. It applies on every redaction path, on the page and on the devtools server, and shows as **Entropy masking** on the Dashboard.
- After pairing, focus moves to the active tab with a **Connected** note.

#### Inspectors

- **Components:** edit inputs, properties and writable signals; `@for` blocks; directive hosts; hydration status per component with an outline on the page; nested values on demand; console handles; expand all and collapse all.
- **Components:** **Copy as JSON** (the redacted values the panel shows) and **Copy host path** (a CSS selector for `document.querySelector`) in the detail header; an outline that fades over one second on a value that changed since the last refresh; **Show in Signals** for the component and for each signal property, also as a `#tab=signals&id=` deep link and through `open-in-panel`; and the `@defer` blocks of the selected component's template.
- **Components:** pick a component with the keyboard: the arrow keys move the highlight through the components on the page and Enter picks, from the panel or the page. Directives show a **Likely** source file from the source scan, matched by class name.
- **Defer blocks:** a block that hydrated before the devtools attached shows **hydrated before inspection** in the panel and in the `defer-blocks` tool. Each row opens its details: id, state and hydration times, root elements, triggers, its last state transitions, and a link to a hydration mismatch inside it, marked with a **mismatch** badge.
- **Change detection:** a recording that keeps running when the tab reloads (until **Stop recording**), a **Most often checked** table next to **Slowest components** with class names that select an instance, a per-cycle chart, a flame graph, hook timing, export and import of recordings, flash checks on the page, a Pangular track in the Chrome Performance panel, an Angular profiling toggle, and what triggered each check, with wasted checks, OnPush hints and components that need zone.js.
- **Leaks:** live subscriptions and effects per component, and components that stay alive after they are destroyed.
- **Signals:** the live signal graph drawn, watched signals, and links from components to injectors.
- **Injectors:** a page picker, a created provider's value, startup timing and the slowest providers.
- **NgRx Store:** full state for every entry still in the log, session export and import, generated tests, and NGXS, Elf and MiniRx through their Redux DevTools integration.
- **NgRx Store:** the state is a tree with search, **Copy path** and the paths of the newest change marked. Store DevTools gets **Pause recording**, **Jump to committed state**, **Commit**, **Reset…** and **Skip this action** (#368).
- **NgRx Store:** an **Action frequency** table counts each action, method and write since load, with durations and the peak per second, and flags an effect that dispatches the same action 20 times within a second (#368).
- **NgRx Store:** the opt-in `ngrx.trace` option records the redacted app frames each change log entry came from, shown as source links in the entry (#368).
- **NgRx Store:** a signal store that uses `withDevtools()` is watched through `watchState` only, without wrapping its methods or signals (#368).
- **TanStack Query:** a tab for queries and mutations, with invalidate and refetch.
- **SSR & HTTP:** the page's own `fetch()` calls next to the `HttpClient` ones (#369), a network waterfall, search and filters on the timeline, response preview format, copy and mock, TransferState keys and edits in SSR overrides, and SSR tracing for fetch handlers such as Hono, h3 and Nitro.
- **Errors:** a tab for `ErrorHandler` errors, uncaught errors, unhandled rejections and the console, with NG0xxx codes and explainers for NG0100, hydration mismatches and missing providers. **Server errors** lists SSR render errors and Vite transform and compile errors, and `list-server-errors` reads them (#372).
- **Timeline:** one time axis with layers for the router, HTTP, NgRx, change detection, forms and signals.
- **Audit:** one ranked list of findings across the inspectors, an axe pass, and before and after sessions.
- **Capacitor:** a tab for the platform, plugins, plugin calls and listeners of a Capacitor app.
- **Ionic in the Capacitor tab:** an **Ionic page stacks** section with a card per `ion-router-outlet`: the pages in its stack, the active one, the direction of the last navigation and whether it can go back, read from `@ionic/angular`'s outlet directive or from the DOM. Hovering a page outlines it in the app.
- **Forms, Router, Pipes and Analog:** filters, lint navigation, **Clear filters**, a route count, routed components in the **Components** tab, and search and a failed filter for Analog server calls.
- **Performance:** a tab for LCP, INP, CLS, FCP and TTFB with the element and component behind each, the slowest interactions and long tasks (#372).
- **Build:** a tab for the Vite dev server's module graph with its lazy boundaries, and the chunk sizes of the last production build (#372, #373).
- **Analog:** a request playground with path params, query, headers, cookies, response headers and timing, per-route history and **Copy as curl** or **Copy as fetch**; the Vite transform stack of a page file (**Transform** in **Routes**); a dev server render mode check and a build analysis with chunk sizes per page in **Render**; a frontmatter check against a JSON Schema set in the new `analog.contentSchema` option, the `injectContentFiles` and `injectContent` call sites and a markdown preview in **Content**; a **Data** view with the full `load()` value on demand and the TransferState entries the browser reused or fetched again; and a **Runtime** view with `import.meta.env`, Nitro `runtimeConfig`, the `analog()` options and Nitro plugins, storage and cache entries, with Nitro tasks to run and a cache purge behind `actions.analog` (#369).
- **Forms:** a **Schema** view of the rules a Signal Form's schema sets on each field; edit a control's value, touched and dirty state in its row of the **Fields** view (behind `actions.forms`); a WebMCP tool's input schema, and **Try this tool** to run it on its form from the panel (`try-webmcp` in `run-form-action`); a form's history exported as a Playwright test from the **Timeline** view and from `export-form` (`format: "playwright"`); timeline origins worked out per form, so typing in one form no longer tags code changes in another form as user; the `missing-autocomplete` and `submit-disabled-while-invalid` accessibility rules in the forms lint; while a WebMCP call's submit runs, only its status and submit outcome is tagged agent, not values app code writes meanwhile.
- **Plugin API:** a library can add its own tab, agent tools and shared state.
- **Pipes:** while recording, a pipe that returns an equal result 20 calls in a row is marked **churning**, in the panel and in `explain-pipe`. **Sort pipes** orders the list by calls or by time in `transform`, and **Called while recording** shows only the recorded pipes (#369).
- **Components:** a **Pipes in template** block lists the pipes the selected component's template uses on the page, and opens one in the **Pipes** tab (#369).
- Angular Native and NativeScript pages report change detection, leaks, errors, stores, TanStack Query, provider values, plugins and startup timing too (#407).
- **Tap-to-pick and a box highlight on devices.** For NativeScript and Angular Native apps, **Pick component on device** selects the component behind the next tap on the simulator or device, and the arrow keys move between components. The highlight is a box in a native view of its own instead of a border or outline on the app's view, which stays as the fallback (#371).
- Angular features are detected at runtime, and the panel says what an older version lacks.
- The server keeps at most 256 KB of JSON for each NgRx store's state. Past it, the largest slices show `[too large: N KB]`, so one huge slice can't fill the server's memory or the panel.
- `withPangular({ transferCache })` takes Angular's `HttpTransferCacheOptions` and passes them to the transfer cache that `provideClientHydration()` sets up. The SSR & HTTP tab uses them to explain each transfer cache outcome, including a new **Filter** reason.
- The Dashboard has a **Security** block: whether the one-time code is on or locked, how many trusted tokens there are and when they expire, how many pairing tokens the server accepts, and who may reach the server (reach, allowed origins and hosts). The panel reads it with the `security-status` RPC, which answers trusted clients only and never carries a token or the code.
- **Injectors:** selecting an element injector reads it again on the page, and **Refresh** in the toolbar reads every injector again. Element injectors are still cached between updates, since reading what they inject is costly.
- **Injectors:** the Environment view lists lazy route injectors the router already loaded but no rendered element uses, with an **inactive** chip. `inspect-providers` and the `injector-tree` resource mark them `inactive: true`.
- **Injectors:** a collapsed **Hint** above the live tree lists providers your source declares that nothing on the page injected so far. It is a hint, not an error.
- **Injectors:** source mode lists `provide*()` calls it can't resolve to tokens, such as your own provider functions, under a collapsed **Helpers (unresolved)** group instead of dropping them. `scan-providers` gives them `type: "helper"`.
- **Injectors:** each **Injected here** row has a **Resolution** button that draws the lookup path for that token: asked, provides it, not asked, skipped, or the null injector.
- **Injectors:** live provider rows say where the source scan declares the token, with links.
- **Injectors:** a truncated tree carries the server's `limits`, and the notice names them.
- **Signals:** a node's details link it to its declaration in the source scan, or list the candidates when the name matches several.
- **Signals:** a history entry shows what changed from the entry before, path by path.
- **Signals:** **Restore** works on writable signal fields (`signal()`, `linkedSignal()`, `model()`) of services in root and route graphs, not on computed ones.
- **Signals:** hosts with directives but no component have a graph, in the **Graph of** picker and in `inspect-signals`, which also takes an element injector id such as `inj-12`.
- **Signals:** effect run counts and times, where Angular's profiler reports effect runs. No Angular version up to 22.1 does, so the line stays hidden there.
- **Signals:** the unnamed signal hint says that the compiler names signals from Angular 20.1.

#### SSR & HTTP tools

- **Live match count in the fault rule form.** Under **URL pattern**, the SSR & HTTP tab says how many of the recorded calls the pattern matches with the chosen method and side, as you type.
- **Fault rule presets: Offline, Slow 3G and Flaky.** Each adds plain rules for every browser request: a network error, a 2000 ms delay, or a 503 for 30% of requests. Two rule fields make them possible and work on any rule: status `0` fails a request as a network error (an `HttpErrorResponse` with status 0), and `chance` (1 to 99) applies a rule to that share of matching requests. `set-http-rule` takes both.
- **HAR export.** **Export HAR** in the SSR & HTTP tab saves the timeline as a HAR 1.2 file: the SSR request that served the page, then its server and client calls, with headers and response previews. Values are masked as in the panel.
- **Copy as fetch and Copy as cURL.** The response preview copies the open call as a `fetch()` statement or a `curl` command, built from the masked copy, so values that match the redaction rules stay `[redacted]`. Check a snippet for other secrets, such as a token in a custom header, before you share it. Nothing is sent.
- **TransferState payload checks.** The payload section shows the size against a 100 KB budget, the largest entries with size bars, and URLs the transfer cache stored under more than one key. `inspect-transfer-state` adds the same warnings to its key list.
- **HTTP lint and the `lint-http` agent tool.** A new HTTP lint section flags the same GET fired again within 2000 ms, chains of 3 or more calls that ran one after another and could start together, and server calls the browser made again. `lint-http` returns the same findings with call ids.
- **Refetch the TransferState payload.** **Refetch** in the payload section, and the `refetch-transfer-state` agent tool, render the page's URL again on the server with the tab's cookies and show the payload it sends now, without reloading the tab. The payload is masked like the first one and marked **Refetched**. Both need `actions.http` (#369).
- **`set-http-rule` takes `preset`.** `offline`, `slow-3g` or `flaky` adds the same plain rules as the panel's preset buttons (#369).
- **HTTP lint in the audit and in `snapshot`.** The audit lists duplicate requests, request waterfalls and server calls the browser made again as HTTP findings, and the `snapshot` HTTP section ends with a line that counts the `lint-http` findings (#369).
- **A Server-Timing entry per server HttpClient call.** Traced renders add `fetch-1;desc="GET /api/products";dur=12` and so on, for the first 20 calls, so Chrome's Timing tab shows each call. The description is the method and the masked path, without the query.
- **Calls labeled by the API that likely started them.** The interceptor reads the call stack and tags a call **likely httpResource()**, **likely resource()** or **likely @defer** in the timeline, in `list-http-calls` and in the HAR export. It is a guess from Angular's frame names in development builds.

#### Agents and MCP

- 118 agent tools. New tools include `audit`, `suggest-pipe-migrations` (read-only pipe-to-signal suggestions, #369), `snapshot`, `wait-for`, `scan-templates` (#415), `list-errors`, `explain-error`, `list-console`, `list-server-errors`, `web-vitals`, `module-graph`, `chunk-sizes`, `refetch-transfer-state`, `find-leaks`, `diagnose-change-detection` (#395), `set-component-property`, `set-signal`, `load-defer-block` (loads one `@defer` block as if its trigger fired, behind `actions.components`), `track-subscriptions`, `watch-signal`, `hydration`, `screenshot-component`, `open-in-panel`, `startup-timing`, `read-provider-value`, `record-change-detection`, `probe-route`, `record-guards`, `ngrx-store-devtools`, `ngrx-explain-change` (#368), the TanStack Query, Capacitor, plugin and NgRx session tools, tools for HTTP fault rules and SSR overrides, and the Analog tools `analog-scan-build`, `analog-scan-nitro`, `analog-purge-nitro-cache`, `analog-run-nitro-task`, `analog-scan-runtime-config`, `analog-inspect-transform` and `analog-inspect-render-mode` (#369).
- One naming scheme for tools and arguments, and plain markdown answers. See **Agent tools renamed**.
- Tool titles, inspector tags and safety tiers (`action` and `destructive`).
- Every answer names the page it read, and one rule picks the default page for every tool.
- Per-page resource templates and `list_changed` notifications (#417).
- A `pangular:pipe-usages` resource with the pipes in the source, every template use, and the live pipe usage of the pages (#369).
- Five MCP prompts for common workflows: `inspect-page`, `debug-error`, `fix-form`, `performance-pass` and `verify-fix` (#416). Server instructions describe the tiers and the tools.
- Agent skills shipped in the package, installed with `pangular skills install`.
- Read-only tools for browser agents through WebMCP, off by default (`agent.browserTools`).
- `pangular mcp --print-config` prints the client config for Claude Code, Cursor and VS Code.

#### Router tools

- **Compare two navigations.** The Routes tab has a **Compare** view, and each navigation a **Compare** button, that list which query params, route params, route data, outlets, components, guard and resolver verdicts and phase timings changed between two recorded navigations. Agents get the same answer from `pangular:diff-navigations`. Each navigation now keeps the routes it activated, with redacted params and data.
- **Live open redirect check.** A guard, resolver or error handler redirect whose target is the value of a query param, and code that navigates to the value of a return-URL query param, are flagged as they happen: an **open redirect risk** badge in **Navigations**, a warning in the hub's **Messages** dock, a line in `pangular:explain-navigation`, and a `redirect-from-query` lint warning that names the guard or code.
- **Navigation API and error handler in the router timeline.** Each navigation shows the browser Navigation API event it came with (`push`, `replace`, `reload` or `traverse`, and whether the user started it). Navigation API events the router did not make show as **History changes outside the router** in **Navigations**, `pangular:inspect-route` and `pangular:explain-navigation`, which explains a browser URL that differs from the router's. A `withNavigationErrorHandler()` handler that throws is recorded with its message.
- **HTTP calls per navigation.** `pangular:explain-navigation` and a new **HTTP calls** button on each navigation list the `HttpClient` calls the SSR & HTTP inspector recorded for it, with status and time: the ones that started while it ran, and the ones that started within 5 seconds after it ended and before the next navigation.
- **Three router lint rules.** `always-run-parent` flags `runGuardsAndResolvers: 'always'` on a parent route with guards or resolvers. `lazy-component-eager` flags a `loadComponent` route whose component another route already imports eagerly. The `resolver-refetch` rule is a timing heuristic: from the SSR & HTTP inspector's calls, it flags a `GET` the page made while a navigation's resolvers ran and again after the navigation ended, which suggests the routed component fetches what a resolver already loaded. A guard can make the first `GET` too, so the rule does not prove the resolver made it. Turn any of them off with `lint.rules`.
- **Follow navigations from an agent.** `pangular:follow-navigations` returns the navigations that are new or changed since a cursor, across pages, and can wait up to 30 seconds for the next one, so an agent can follow a login and redirect flow without polling.
- **What happens if I go to a URL.** The **Config** view has a **What happens** button, and agents a `pangular:preview-navigation` tool, that predict a navigation from the live route config without navigating: the redirects it follows, the route chain and params, and in order the guards, lazy chunks, resolvers and components that run, with each route's source file and the render mode.
- **Several apps on one page.** A page that bootstraps more than one Angular app with its own Router, such as several `bootstrapApplication()` roots or micro-frontends, reports each app's route, navigations, config and setup under a stable app id. The Routes tab shows an **App** picker on such a page, and the router agent tools take an optional `app` argument. A page with one app reports and shows exactly what it did before (#485).

#### CLI

- `pangular lint` runs the source lints and prints JSON or SARIF (#418).
- `pangular skills` lists or installs the bundled agent skills.
- `pangular dev` takes `--proxy-origin`, `--allowed-origin` and `--auth-token`.
- `pangular dev --lan-address` prints the server's LAN URL and the `--define` that injects it into a device build. It needs `--host` on the network and changes no access setting (#373).
- `pangular build` refuses an `--outDir` that would delete files that are not a previous report, unless `--force` is passed.
- `buildReport()` from `@pangular-inspector/devtools/cli` writes the static report from a script, with the output folder checks of `pangular build`. Unlike `pangular build`, it resolves `outDir` against the working directory, and `config` takes a config object, not a file path.
- The source scan reads Nx projects.
- `pangular token --rotate` drops every trusted token of the project and prints a new one-time code from each running server (the CLI, the Vite plugin or the Express hub, several at once when they share the project), which also ends a lock after too many wrong codes. `pangular token` prints how many tokens there are.
- The CLI start-up output names the NativeScript setup view (`?view=nativescript`) next to the Angular Native one.

### Performance

- Pages push deltas instead of full snapshots, at most about once a second, and idle pages send only a small heartbeat.
- NgRx store updates no longer slow down as the store grows (#432).
- The NgRx collector serializes a signal store or the classic `Store` only when its state, computed values or method stats changed, and the overlay compares a report version instead of the serialized report, so an unchanged store costs no serialization on each check. A change made in place, without a new state object, can show late (#368).
- The forms collector skips reading and serializing the forms after change detection when nothing changed since the last read (no form event, input, DOM change, WebMCP call or panel action, and the same Signal Form values, errors and root flags), and reads again at least every 5 seconds (#368).
- Collectors schedule their work outside the Angular zone, so an app that writes a signal or logs during change detection settles again on zone.js.
- Long lists and trees in the panel render only the visible rows.
- The pipe source scan behind `scan-pipes`, `explain-pipe`, the pipe lint and the audit keeps each file's result until the file or its `templateUrl` changes, and skips the walk while the Vite watcher saw no change (#369).
- The agent tool list is much smaller: shorter descriptions, and library tools only for apps that use them.

### Fixes

- Fixes from the audit of every inspector, the panel shell, the hub, the extension and the native overlays (#361, #362, #363, #364), the follow-ups in #418, and the release blockers found by the test campaign (#432).
- One malformed component report no longer breaks the agent tools for every page. Reports are checked when they reach the server.
- Change detection counts only template runs, not skipped children or the `checkNoChanges` pass.
- The change detection answers with no recording, the audit note and the `record-change-detection` result send agents to `record-change-detection`, not to `change-detection` with `record`, which that tool refuses. With `agent.readOnly`, which leaves `record-change-detection` out, they name only **Record** in the panel.
- The panel announces **Record** and **Stop recording** once the page reports the recording on or off. If no report comes within 3 seconds, it says the page did not confirm and keeps the button state the page last reported.
- The forms tools answer with the forms of the tab they were asked about.
- Signal graph edges name their nodes instead of positions.
- `inspect-signals` reads the graph of a component the page is not showing: a `component` the component tree knows, or a component host matched by the new `selector` argument (CSS). A selector that matches no component host is refused at once (#367).
- A `Store` provided in a route is found, and the DI tools keep each signal store's name instead of `SignalStore`.
- Two DI tokens with the same name, such as two `new InjectionToken('config')`, no longer mix up provider values or which token something injected. The injector tree carries a `tokenId` for each token, `read-provider-value` and `explain-injection` list the candidates for a shared name and take `tokenId` to pick one, and `inspect-providers` takes `tokenId` to keep one (#367).
- The SSR hydration count is right, and a request is no longer reported as a transfer cache hit when it was not.
- A failed write answers with `isError: true`, and a failing call keeps its response body.
- The Express hub turns itself off with a warning on a Node.js that can't load it, instead of crashing the server.
- `@pangular-inspector/devtools/devframe` (and the package root) load Devframe from `node_modules` when imported, as the hub entry does, so an Angular 20 server bundle that imports them no longer fails with `Identifier 'createRequire' has already been declared` (#427).
- Picking works inside shadow roots and `ShadowDom` components.
- Analog server calls link only to the request they ran under (#405).
- Analog server calls no longer mix across tabs. Each call carries the `pageId` of its tab when the dev server can tell (an `x-pangular-page` header that `withPangular()` sends on same-origin requests in dev builds, the page render's id from `Server-Timing`, or a `Referer` only one open tab matches), and leaves with that tab. The **Server** tab shows its own tab's calls, with an **All tabs (including untagged)** switch, and `analog-list-server-calls` takes `page` (#369).
- The Analog source scan is kept until a file changes (the Vite watcher, or `fs.watch` outside Vite) instead of running again every 2 seconds, and an Analog report no longer waits for it: the rescan runs after the push and the open pages are checked again (#369).
- The Analog page chain includes pages in named outlets and sibling child routes, not only the first child. The primary chain comes first, and each other page names its outlet in the **Routes** tab and in `analog-inspect-page` (#369).
- Signal Forms checkboxes, radios and selects are written in user mode (#360).
- Live counts in **Timeline**, **Errors** and **Audit** speak only after a filter change, so they no longer flood screen readers.
- Control outlines and **Signals** graph edges meet 3:1 contrast in both themes, and status pills keep their contrast on selected rows.
- The extension panel retries the connection on its own.
- A tab that crashes or is killed without `pagehide` leaves `list-pages`, the forms data and the router data with the rest of its data. Every per-page store uses one expiry, 30 seconds after the page's last report or heartbeat (three heartbeat intervals), instead of 150 seconds for forms and router (#422).
- `explain-invalid-forms` no longer says no field has an error when the failing field is past the forms collector's limit of 100 fields per group. A cut group carries `truncatedInvalid` with the invalid fields it left out, `explain-invalid-forms` and `explain-submit` name them, and `inspect-forms` says which group was cut and how many fields it left out, or that a group past the 8-level depth limit was not read (#423).
- `scan-signals` and `scan-components` cap their answer at 200 items or 20,000 characters, say how many items they left out, and take `filter`, `offset` and `limit` to read the rest. A list that fits is still the JSON array alone. One item longer than the cap is cut, with a note (#429).
- The panel switches tabs when only the `#tab=` hash changes after load (#425).
- The `defer-blocks` tool and the **Defer blocks** list count how long a block sat on its placeholder on the page's clock. The component report carries the page clock (`pageNow`) and the server keeps the offset as `clockOffset`, so a page whose clock runs ahead or behind no longer reads as stuck, or never stuck (#366).
- The **Defer blocks** list shows the notes the `defer-blocks` tool prints (**failed**, **stuck** _N_ s, **waiting** _N_ s, **dehydrated**), an **&#64;error block** flag and the `@placeholder` and `@loading` times (#366). The age counts up only while a block is on its placeholder, and screen readers read the badge as **stuck** or **waiting** without the seconds, so a focused row's name does not change every second. The panel assumes its clock agrees with the server's.
- Highlighting a `@defer` block draws one box around all of its root elements instead of the first one. `request-page-highlight` takes `ids` for several elements next to `id` (#366).
- The **SSR & HTTP** hydration mismatches name the component class, such as `ProductCard`, instead of the DOM node name (#366). A class name is shown as is and a node name in angle brackets (`<app-card>`), in the panel and in the hub messages.
- The panel content is in the Tab order, with its tab name and a focus ring, so keyboard users can scroll a view that has nothing focusable in it, such as the **Forms** empty state in a short window.
- At narrow widths the **Components** toolbar fits on two rows, with its tree actions as icons, and a cut off component name shows its full text on hover and focus (#421).
- The **Forms** tab lists WebMCP tools that are not linked to a form under **Other WebMCP tools**, with the same parts as a form's **WebMCP tool** block (#368).
- The **Forms** tab shows the forms setup errors Angular logs on the page, such as `NG01203`, in a notice above the list (#368).
- Without Angular's debug info, the **Components** detail header marks the source file it found by class name as **Likely**, prefers the class whose selector is the host tag, and lists every candidate under **Not certain** when several classes share the name. **Open source** then opens the class itself instead of one of the guesses (#366).
- The **Routes** tab tells screen readers how each outlet in **Outlets** is nested, as it already did for **Active routes** (#370).
- The **Forms** timeline tags a change as **agent** only when a WebMCP call wrote it, or when it is in the call's own form while the call runs (#368). Typing in any form while a long WebMCP submit is pending is tagged **user**, not **agent**.
- The **Pipes** tab no longer marks two `| async` usages of a Promise, a Subject, an `asObservable()` view of one or an NgRx store select as duplicates, since their subscribers share one execution (#369). Any other source that two `| async` usages subscribe to shows as **possible duplicate subscription**, and `explain-pipe` says **Possible duplicate subscriptions**, because the page can't see `share()` or `shareReplay()` in a pipe.
- Recording pipe calls counts a pipe from its first call when it sits in a template branch that renders later, and patches a pipe class that a newly added view brings as soon as the page sees the view, instead of on the next report (#369).
- Browser DevTools show the app's own line as the caller of a `console` call again. The browser entries ship source maps that list the console tap in `x_google_ignoreList`, so its wrapper frame is skipped (#369).
- The Angular Native overlay gates the injector profiler like the NativeScript overlay: in a development build with no `window`, importing it defines one until Angular publishes its debug utilities, so the **Providers** lists fill (#371).
- `record-change-detection` with `record: "start"` passes on why a page that answered could not record, from its capability report: the Angular version it runs, or a profiler hook the recording could not attach to yet. It no longer waits out the 3 seconds and blames the Angular version (#366).
- `explain-ssr-request` names a hydration mismatch as a component only when the page read its class, and as an element (`<app-card>`) or text node (`#text`) otherwise (#366).
- Redaction leaks found by a corpus of fake secrets run through every redaction path are closed: a secret pair after another word and a colon (`Error: password: "…"`), the key after `Authorization: ApiKey` in an Analog server body that is not JSON, secret pairs in the fragment or matrix params of an Analog server message, headers with a camelCase secret name such as `newPassword`, and tokens used as NgRx state keys.
- The `pipe-usages` resource lists the connected page id in its size summary when only one page reports.
- The pipe scan and the pipe lint run again when a missing `templateUrl` file appears, and when a template outside the folders the Vite watcher covers changes.
- A pipe opened from the **Components** tab shows the live data, and records calls, on the page **Components** had selected, not only the page the panel belongs to.
- `preview-navigation` fills a `:name` value in the query of a `redirectTo` from the URL's query parameter, as Angular does, and keeps the fragment of a redirect that has both a query and a fragment.
- `ngrx-explain-change` keeps its `store` filter when it explains one entry by `seq`, answers a refusal with `isError`, and puts a single untrusted notice on an unknown page answer.
- During a keyboard pick on the **Components** tab, a message that repeats, such as the same component again, is read out again.
- **Show in Signals** for a page that has not reported its graph yet shows that page once it reports, and picking another component drops a signal still waiting to be selected.
- A signal store change to a key that needs quotes, such as `profile["first name"]`, is logged with the path the **NgRx Store** state tree uses, so the tree marks it and **Copy path** matches `ngrx-explain-change`.
- The forms collector reads a control inside a disabled `<fieldset>` as disabled on the page, so it no longer looks enabled in the DOM facts.
- A component report whose `detail.selector` is not text no longer passes it on to the agent tools; the server leaves it out.

### Docs

- A quick start, and a panel screenshot on every inspector page.
- Pages for the command palette, settings, terminals, the popup and hub, configuration, other servers (Hono, h3, Fastify), Capacitor, the timeline, errors, audit, TanStack Query, agent skills, browser agents and writing a plugin.
- A guide to shipping a plugin from a library, built on the example plugin package `examples/pangular-plugin-example` (a feature flag store with its own tab and agent tools), which the Analog demo uses (#404).
- A roadmap page.
- The Capacitor and NativeScript guides show the Android network security config and the iOS App Transport Security and local network settings a device needs to reach the devtools over the LAN (#373).
- The Express and other servers pages say which port the WebSocket side-car uses (the first free one from 9777), how to pin it with `ws: {port}`, and how to serve the socket on the app's own server with `attach(server)` (#426).
- A **Renamed tools** table in the agent tools page, and the public API and the supported versions in the publishing guide.
- Corrected guides and samples from the readiness review: the Vite auth default in the Analog guide and the glossary, JSON samples without a path comment, no separate devframe install in the package README, and `ws: false` for a panel-only devframe host.

### Release and CI

- The overlay reads `window.ng` through one typed `NgDebugApi` (`debug-api.ts`) with the Angular version of each function, and a test against a real app fails when Angular publishes a function the type doesn't declare (#373).
- `pnpm lint` runs oxlint with a ratchet: CI fails when a file gets more warnings of a rule than `lint-baseline.json` allows, or when a source file over 1,500 lines grows (#373).
- The `leaks-real` test expects the rows the collector really reports (#430).
- Pull requests run the security and MCP end-to-end checks, and a weekly job runs the rest.
- A CI job installs the packed package on Node.js 22.12.0, the `engines.node` floor, and loads its CLI and its `cli`, `hub`, `ssr` and `vite` entry points there (#373).
- `pnpm extension:build:firefox` builds a Firefox copy of the extension into `dist/extension-firefox`, with the add-on ID and version floor under `browser_specific_settings` and without the Chrome-only manifest keys. It is not published (#342).
- The `Commit message` check fails on a commit message that breaks the format, not only on a bad pull request title (#373).
- The packed `package.json` leaves out `devDependencies`, `scripts` and the `nx` block, and declares `sideEffects`.
- Dependencies: devframe and `@devframes/*` 1.2.6 (was 1.2.0). `@devframes/plugin-messages`, `@devframes/plugin-terminals` and `axe-core` are added. `h3` is no longer a dependency.

## 0.0.7

### Upgrade notes

- HTTP mock rules only accept statuses from the list (2xx to 5xx, plus 499 and 520 to 524). A stored rule with another status loses it.

### Features

- Renamed to Pangular Inspector: the package is `@pangular-inspector/devtools` and the CLI is `pangular`.
- Inspect Angular Native apps from a simulator, an emulator or a phone (`/overlay-angular-native`).
- Inspect NativeScript apps (`/overlay-nativescript`).
- Live NgRx Signal Store entities and events, and timings for method calls.
- A light theme for the panel that follows the DevTools or hub theme.
- The Chrome extension retries finding the server, explains a refusal and waits for the page id.

### Fixes

- HTTP mock rules offer a list of valid statuses instead of a free number.

### Dependencies

- devframe 1.2.0.

## 0.0.6

### Upgrade notes

- The MCP route requires a bearer token when auth is on.
- When a tunnel host is allowed, the Vite plugin asks for the one-time code.

### Security fixes

- Require a bearer token on the MCP route when auth is on.
- Require the one-time code when a tunnel host is allowed.
- Block the router probe when router actions are off.

### Features

- Configure inspectors, agent tools, write actions, redaction and limits.
- Detect redirect and navigation loops in the router inspector.
- Show the change detection strategy in the component tree.
- Add `disposeOverlay` and keep a single overlay per page.
- Refresh the overlay on change detection instead of polling.
- Add the Chrome extension host access flow and Elements panel selection.
- Accept the Chrome extension panel in the hub by default.

### Fixes

- Resolve the P1, P2 and P3 issues from the issue tracker.

### Documentation

- Add the documentation site.
