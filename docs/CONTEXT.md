# Angular DevTools

Angular DevTools inspects a running Angular app and serves what it finds to a panel and to AI agents over MCP. This glossary fixes the words the project uses for its own concepts, so that a name means one thing in the code, the docs, issues and commit messages. Each entry gives the term, what it means here, and the words to avoid for it.

## Language

**Page**:
One browser tab running the inspected app with the overlay loaded. Several pages can report to the same server at once, and each one's data is kept apart.
_Avoid_: tab (a tab is a view in the panel), client, window

**pageId**:
The short id a page claims when the overlay starts, kept in `sessionStorage` so a reload keeps it, and replaced when a duplicated tab already holds it. Everything the page reports carries it, and the server expires a page's data when its reports stop.
_Avoid_: tab id, session id, client id

**Overlay**:
The script the app imports in `main.ts` in development only (`@santoshyadavdev/ng-devtools/overlay`). It finds the server, starts the collectors and adds the floating button. It reads the page; it never changes it on its own.
_Avoid_: content script, agent, injected script

**Collector**:
One inspector's page-side code inside the overlay, such as `forms-collector.ts` or `pipes-collector.ts`. It reads the app through Angular's debug APIs, gives objects stable ids through a `WeakMap`, and pushes a report tagged with the `pageId`.
_Avoid_: scraper, probe, watcher

**Push**:
A report a collector sends to the server over RPC, such as `push-component-tree`. A collector sends one when something changed, and a keepalive at intervals so the server knows the page is still there. Pushes stay cheap.
_Avoid_: sync, upload, post

**Inspector**:
One area the devtools can look at: `components`, `injectors`, `signals`, `ngrx`, `forms`, `router`, `pipes`, `http` and `analog` (`NG_DEVTOOLS_INSPECTORS` in `config.ts`). An inspector owns a collector, its RPC functions, its agent tools and its view in the panel, and `inspectors` in the config turns all of them off together.
_Avoid_: plugin, module, feature

**Devframe**:
The framework the devtools are built on (`devframe`). One definition, `packages/ng-devtools/src/devframe.ts`, declares the RPC functions, shared state and agent tools, and Devframe serves it as the embedded panel, the standalone CLI, the static report and the MCP server.
_Avoid_: framework, runtime, backend

**Hub**:
The server part an app mounts: `initNgDevtoolsHub()` for Express, or the Vite plugin. It is built on `@devframes/hub`, serves the panel and the connection file under `/__devframes/`, and lets other Devframe tools join the same dock.
_Avoid_: server (too broad), middleware, proxy

**Dock**:
The rail of entries the hub shows (Angular, NgRx, Analog, and the Coming Soon placeholders), each opening a view of the panel (`hub-docks.ts`).
_Avoid_: sidebar, menu, tab bar

**Panel**:
The devtools UI, the Angular app in `app/`. The hub serves it, the popup frames it on the page, the static report bundles it, and the Chrome extension ships a committed build of it in `extension/ui`.
_Avoid_: dashboard (the Dashboard is one of its views), UI app, client

**Popup**:
The floating button the overlay adds to the page, and the panel it opens in a frame beside the app (`popup.ts`).
_Avoid_: launcher, widget, modal

**Tab**:
One view in the panel, such as Components or Router. Most tabs belong to one inspector; the Dashboard summarises all of them.
_Avoid_: page (a page is a browser tab), screen

**RPC function**:
A server function the panel or an agent calls over Devframe RPC, listed in `RPC_INSPECTOR` in `config.ts` so it disappears with its inspector.
_Avoid_: endpoint, API, handler

**Agent tool**:
An RPC function marked for agents, which Devframe exposes as an MCP tool. It is listed in `AGENT_INSPECTOR`, and in `ACTION_TOOLS` too when it writes.
_Avoid_: MCP command, function, skill

**Action**:
Anything that changes the app or the server rather than reading it: setting a form value, navigating, restoring store state, HTTP fault rules. `actions` in the config blocks them, and `agent.readOnly` drops the agent tools that perform them.
_Avoid_: mutation, command, write tool

**Resource**:
Live state an agent reads as JSON over MCP, such as `ng-devtools:component-tree`. It holds what the connected pages reported, so it is empty when no page is connected.
_Avoid_: snapshot, feed, state dump

**Source scan**:
What the devtools read from the project's source files rather than the running page: components, routes, signals, providers, NgRx declarations and pipes. It is all the standalone CLI and the static report have.
_Avoid_: static analysis, AST pass, crawl

**Static report**:
An offline HTML build of the panel over the source scan, written by `ng-devtools build --outDir <dir>`. No page connects to it.
_Avoid_: export, snapshot, static site

**Redaction**:
Masking values before they reach the panel or an agent: field names that look secret (plus `redaction.secretNames`), JWTs and bearer tokens. It runs in `serialize` and the redaction helpers, and `redaction.unmask` lists the names to show anyway.
_Avoid_: sanitizing, scrubbing, hiding

**One-time code**:
The code the server prints in the terminal, which a browser exchanges before it can read any data. It is on by default for the Express hub and turned on by the Vite plugin when a non-loopback host or origin is allowed. `auth: false` turns it off.
_Avoid_: token (the MCP endpoint's bearer token is a different thing), password, PIN

**Lint**:
A check an inspector runs over what it collected and reports as findings in its tab and through an agent tool, such as Router Lint or Forms Lint (`lint-routes`, `lint-forms`).
_Avoid_: audit, validation, analysis
