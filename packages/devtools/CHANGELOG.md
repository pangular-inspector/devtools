# Changelog

All notable changes to `@pangular-inspector/devtools` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com).

## Unreleased

Most setups need changes when they come from 0.0.7, so read **Upgrading from 0.0.7** first.

### Upgrading from 0.0.7

These changes can break a 0.0.7 setup without an error.

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
- **MCP prompts, server instructions and the `screenshot-component` image need a devframe release after 1.2.5.** With devframe 1.2.5 from npm, the HTTP endpoint sends no prompts or instructions, and the screenshot tool answers with a note and no image. The per-page resource templates and `list_changed` notifications come from the same devframe patch. The workspace runs a patched devframe, so this only affects installed packages.

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

What remains: `/config` exports `DEFAULT_POPUP_HOTKEY`, `PANGULAR_ACTIONS`, `PANGULAR_INSPECTORS`, `PANGULAR_LIMITS` and `resolvePangularConfig`. `.` and `/devframe` export the same plus `createPangular`, `initDevframe` and the devframe definition as the default export. `/hub` exports `PANGULAR_HUB_BASE`, `hubEnabled` and `initPangularHub`. `/cli` exports `createPangularCli`, and `/http` exports `providePangularHttp` and `withPangular`. The overlay, Angular Native and NativeScript entries keep their exports.

### Security

- Gate every hub request on the client address, the `Host` header and the origin, for the Express hub, the Vite plugin and `pangular dev`. With `allowLan`, a DNS rebinding name pointed at your network address is refused.
- Turn the one-time code and the MCP bearer token on by default in the Vite plugin, and require the MCP token in `pangular dev`.
- Keep the Express hub and the overlay off in production unless `enabled: true` is passed to the hub.
- Back off and lock the server after wrong one-time codes, and never compare a refused code with the real one.
- Keep trusted session tokens in a `0600` file per project, and expire them after 7 days.
- Stop `server.allowedHosts: true` from turning off the origin checks, and warn about it.
- Mask URL passwords and `Authorization` credentials (`Basic`, `Digest`, `Token`) in everything sent to the panel and to agents.
- Mask more secrets: OpenAI, Anthropic, GitLab, npm, Hugging Face and SendGrid keys, Slack webhook URLs, the `Ocp-Apim-Subscription-Key` header, secret values that run past separators, secret XML elements and attributes, and token-like positional parts of TanStack Query keys and mutation variables.
- Mark page text as untrusted in every agent tool answer.
- Refuse writes when the target tab is unclear, instead of acting on whichever tab changed last.
- Pairing tokens (`auth: {tokens}`, `--auth-token`, `PANGULAR_AUTH_TOKEN`) let an app on a device connect without typing the code. The CLI prints only a short hash of each token.
- Hide the shared state of a turned-off inspector from agents.

### Features

#### Setup and workflow

- The Vite plugin loads the overlay itself, so setup is one line in `vite.config.ts`. New plugin options: `allowLan`, `overlay`, `terminals` and `serverPlugins`.
- New hub options: `enabled`, `allowLan`, `terminals`, `serverPlugins` and `browserDistFolder`.
- Open in editor: <kbd>Alt</kbd>+click a component on the page, or a file and line in the panel.
- A command palette (<kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd>) with a command for every tab and action.
- A **Settings** page: theme, hidden, pinned and reordered tabs, passive mode, and a **Browser agents** switch.
- A splitter for the docked popup, pop-out into its own window, and the `popup.hotkey` option.
- Item links (`#tab=&id=&page=`) and the `open-in-panel` agent tool.
- A **Terminals** dock that runs the project's build and test commands (opt in with `terminals: true`).
- Hub messages and toasts, a dock group with badges, and an **All tools** dock.
- New entry points: `/overlay-manual` (starts nothing on import), `/plugin`, `/capacitor-hook`, `/store-hook`, `/startup-hook`, `/ssr` and `/cd-data`.
- New config options: `agent.browserTools`, `limits.capacitorCalls`, `limits.idleAfterMs`, `popup` and `plugins`.
- After pairing, focus moves to the active tab with a **Connected** note.

#### Inspectors

- **Components:** edit inputs, properties and writable signals; `@for` blocks; directive hosts; hydration status per component with an outline on the page; nested values on demand; console handles; expand all and collapse all.
- **Change detection:** a per-cycle chart, a flame graph, hook timing, export and import of recordings, flash checks on the page, a Pangular track in the Chrome Performance panel, an Angular profiling toggle, and what triggered each check, with wasted checks, OnPush hints and components that need zone.js.
- **Leaks:** live subscriptions and effects per component, and components that stay alive after they are destroyed.
- **Signals:** the live signal graph drawn, watched signals, and links from components to injectors.
- **Injectors:** a page picker, a created provider's value, startup timing and the slowest providers.
- **NgRx Store:** full state for every entry still in the log, session export and import, generated tests, and NGXS, Elf and MiniRx through their Redux DevTools integration.
- **TanStack Query:** a tab for queries and mutations, with invalidate and refetch.
- **SSR & HTTP:** a network waterfall, search and filters on the timeline, response preview format, copy and mock, TransferState keys and edits in SSR overrides, and SSR tracing for fetch handlers such as Hono, h3 and Nitro.
- **Errors:** a tab for `ErrorHandler` errors, uncaught errors, unhandled rejections and the console, with NG0xxx codes and explainers for NG0100, hydration mismatches and missing providers.
- **Timeline:** one time axis with layers for the router, HTTP, NgRx, change detection, forms and signals.
- **Audit:** one ranked list of findings across the inspectors, an axe pass, and before and after sessions.
- **Capacitor:** a tab for the platform, plugins, plugin calls and listeners of a Capacitor app.
- **Forms, Router, Pipes and Analog:** filters, lint navigation, **Clear filters**, a route count, routed components in the **Components** tab, and search and a failed filter for Analog server calls.
- **Plugin API:** a library can add its own tab, agent tools and shared state.
- Angular Native and NativeScript pages report change detection, leaks, errors, stores, TanStack Query, provider values, plugins and startup timing too (#407).
- Angular features are detected at runtime, and the panel says what an older version lacks.

#### Agents and MCP

- 98 agent tools. New tools include `audit`, `snapshot`, `wait-for`, `scan-templates` (#415), `list-errors`, `explain-error`, `list-console`, `find-leaks`, `diagnose-change-detection` (#395), `set-component-property`, `set-signal`, `track-subscriptions`, `watch-signal`, `hydration`, `screenshot-component`, `open-in-panel`, `startup-timing`, `read-provider-value`, `record-change-detection`, `probe-route`, `record-guards`, the TanStack Query, Capacitor, plugin and NgRx session tools, and tools for HTTP fault rules and SSR overrides.
- One naming scheme for tools and arguments, and plain markdown answers. See **Agent tools renamed**.
- Tool titles, inspector tags and safety tiers (`action` and `destructive`).
- Every answer names the page it read, and one rule picks the default page for every tool.
- Per-page resource templates and `list_changed` notifications (#417).
- Five MCP prompts for common workflows: `inspect-page`, `debug-error`, `fix-form`, `performance-pass` and `verify-fix` (#416). Server instructions describe the tiers and the tools. Both need the patched devframe (see **Upgrading from 0.0.7**).
- Agent skills shipped in the package, installed with `pangular skills install`.
- Read-only tools for browser agents through WebMCP, off by default (`agent.browserTools`).
- `pangular mcp --print-config` prints the client config for Claude Code, Cursor and VS Code.

#### CLI

- `pangular lint` runs the source lints and prints JSON or SARIF (#418).
- `pangular skills` lists or installs the bundled agent skills.
- `pangular dev` takes `--proxy-origin`, `--allowed-origin` and `--auth-token`.
- `pangular build` refuses an `--outDir` that would delete files that are not a previous report, unless `--force` is passed.
- The source scan reads Nx projects.

### Performance

- Pages push deltas instead of full snapshots, at most about once a second, and idle pages send only a small heartbeat.
- NgRx store updates no longer slow down as the store grows (#432).
- Collectors schedule their work outside the Angular zone, so an app that writes a signal or logs during change detection settles again on zone.js.
- Long lists and trees in the panel render only the visible rows.
- The agent tool list is much smaller: shorter descriptions, and library tools only for apps that use them.

### Fixes

- Fixes from the audit of every inspector, the panel shell, the hub, the extension and the native overlays (#361, #362, #363, #364), the follow-ups in #418, and the release blockers found by the test campaign (#432).
- One malformed component report no longer breaks the agent tools for every page. Reports are checked when they reach the server.
- Change detection counts only template runs, not skipped children or the `checkNoChanges` pass.
- The forms tools answer with the forms of the tab they were asked about.
- Signal graph edges name their nodes instead of positions.
- A `Store` provided in a route is found, and the DI tools keep each signal store's name instead of `SignalStore`.
- The SSR hydration count is right, and a request is no longer reported as a transfer cache hit when it was not.
- A failed write answers with `isError: true`, and a failing call keeps its response body.
- The Express hub turns itself off with a warning on a Node.js that can't load it, instead of crashing the server.
- Picking works inside shadow roots and `ShadowDom` components.
- Analog server calls link only to the request they ran under (#405).
- Signal Forms checkboxes, radios and selects are written in user mode (#360).
- Live counts in **Timeline**, **Errors** and **Audit** speak only after a filter change, so they no longer flood screen readers.
- Control outlines and **Signals** graph edges meet 3:1 contrast in both themes, and status pills keep their contrast on selected rows.
- The extension panel retries the connection on its own.

### Docs

- A quick start, and a panel screenshot on every inspector page.
- Pages for the command palette, settings, terminals, the popup and hub, configuration, other servers (Hono, h3, Fastify), Capacitor, the timeline, errors, audit, TanStack Query, agent skills, browser agents and writing a plugin.
- A roadmap page.
- A **Renamed tools** table in the agent tools page, and the public API and the supported versions in the publishing guide.
- Corrected guides and samples from the readiness review: the Vite auth default in the Analog guide and the glossary, JSON samples without a path comment, no separate devframe install in the package README, and `ws: false` for a panel-only devframe host.

### Release and CI

- The `leaks-real` test expects the rows the collector really reports (#430).
- Pull requests run the security and MCP end-to-end checks, and a weekly job runs the rest.
- The packed `package.json` leaves out `devDependencies`, `scripts` and the `nx` block, and declares `sideEffects`.
- Dependencies: devframe and `@devframes/*` 1.2.5 (was 1.2.0). `@devframes/plugin-messages`, `@devframes/plugin-terminals` and `axe-core` are added. `h3` is no longer a dependency.

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
