# Angular DevTools

Inspect Angular component trees, signals, dependency injection, and routes — at dev time, build time, or through a coding agent. Built with [Devframe](https://devfra.me) so the same tool runs as an embedded panel, standalone CLI, static report, MCP server, or Chrome DevTools extension.

## Features

- **Component inspector** — discover components, inputs, outputs, and source files; view injected providers per component
- **Signal graph** — visualize signal, computed, linkedSignal, effect nodes and their dependency edges (Angular 19+)
- **DI inspector** — browse the injector hierarchy (element and environment) with providers at each level (Angular 17+)
- **Route inspector** — the live route, every navigation as a full story (who started it, redirects, per-phase timing, which guard or resolver decided it, errors explained), the live route config with URL testing, router setup, route lint, and actions to navigate, replay, probe and abort
- **NgRx Store inspector** — detect `@ngrx/store` (actions, reducers, effects, selectors) and `@ngrx/signals` (`signalStore`, `signalState`, `signalMethod`) patterns from source; live state & action log via Redux DevTools protocol
- **Forms inspector** — every form on the page (Signal Forms, reactive and template-driven) with each field's value, status, touched/dirty state and readable errors, plus a timeline of recent changes; hover a field to highlight its input
- **SSR & HTTP inspector** — the TransferState payload, a timeline of HTTP calls made during SSR and on the client, hydration stats and warnings, and fault injection (status, delay, mock JSON body) per URL pattern on the client, in SSR or both
- **Build metadata** — Angular version, TypeScript version, SSR status
- **In-page popup** — floating devtools panel with dock modes (float, bottom, right), drag, resize, and localStorage persistence
- **Agent-native** — all inspectors exposed as MCP tools and resources
- **Deep linking** — URL hash navigates to a specific tab (`#tab=signals`)
- **Page overlay** — highlights components in the running app

## Install

```sh
npm install @santoshyadavdev/ng-devtools devframe
```

MCP agent support (`@devframes/agentic`) is included.

## How to Use

### Embedded in an Angular app (Express SSR)

Add the devframe middleware to your Express server:

```ts
// server.ts
import { initDevframe } from 'devframe/initiate';
import ngDevtools from '@santoshyadavdev/ng-devtools/devframe';

const devtools = initDevframe(ngDevtools, { base: '/__ng-devtools/' });
app.use(devtools.nodeMiddleware);
```

Open `http://localhost:4000/__ng-devtools/` to see the devtools UI.

To fill the SSR & HTTP tab, add the interceptor and hydration hooks to your app config:

```ts
// app.config.ts
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideNgDevtoolsHttp, withNgDevtools } from '@santoshyadavdev/ng-devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch(), withNgDevtools()),
    provideNgDevtoolsHttp(),
  ],
};
```

### Standalone CLI

```sh
# Dev server with live RPC
npx @santoshyadavdev/ng-devtools dev

# Static report (offline HTML)
npx @santoshyadavdev/ng-devtools build --outDir dist-report

# MCP server for coding agents
npx @santoshyadavdev/ng-devtools mcp
```

### MCP Server for Coding Agents

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ng-devtools": {
      "command": "npx",
      "args": ["@santoshyadavdev/ng-devtools", "mcp"]
    }
  }
}
```

**VS Code** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "ng-devtools": {
      "command": "npx",
      "args": ["@santoshyadavdev/ng-devtools", "mcp"]
    }
  }
}
```

When embedded in Express, the MCP endpoint is also available over HTTP at `/__ng-devtools/__mcp`.

#### Agent Tools

MCP clients see these with an underscore, as `ng-devtools_get-routes`.

| Tool                                 | Description                                                 |
| ------------------------------------ | ----------------------------------------------------------- |
| `ng-devtools:get-routes`             | List Angular routes from source                             |
| `ng-devtools:get-components`         | Discover components and directives, with inputs and outputs |
| `ng-devtools:get-signals`            | Signal declarations from source                             |
| `ng-devtools:get-providers`          | DI providers from source                                    |
| `ng-devtools:build-meta`             | Angular/TS versions, SSR status                             |
| `ng-devtools:highlight`              | Highlight a component in the page                           |
| `ng-devtools:inspect-signals`        | Signal graph a connected page reported                      |
| `ng-devtools:inspect-providers`      | Injector tree a connected page reported                     |
| `ng-devtools:get-ngrx-store`         | Scan source for NgRx store patterns                         |
| `ng-devtools:inspect-forms`          | Forms on the page with every field's state and errors       |
| `ng-devtools:explain-form-invalid`   | Which fields make a form invalid, and why                   |
| `ng-devtools:explain-field`          | One field: error sources, skip reasons, binding, source     |
| `ng-devtools:explain-submit`         | What submit will do, and why it might do nothing            |
| `ng-devtools:form-payload`           | What the form sends: value vs raw value, unvalidated fields |
| `ng-devtools:form-history`           | Change timeline with origin (user, code, devtools)          |
| `ng-devtools:form-diff`              | Net change since a marker                                   |
| `ng-devtools:lint-forms`             | Form bugs and model-aware accessibility checks              |
| `ng-devtools:explain-custom-control` | How a field is bound, and what is wrong with the binding    |
| `ng-devtools:export-form`            | JSON snapshot or test fixture                               |
| `ng-devtools:wait-for-form`          | Wait until settled, valid, not pending or submitted         |
| `ng-devtools:form-action`            | Set, touch, revalidate, reset, submit, focus, snapshot      |
| `ng-devtools:fill-form`              | Fill several fields through the inputs                      |
| `ng-devtools:inspect-route`          | The current route with params, data, guards and resolvers   |
| `ng-devtools:explain-navigation`     | Recent navigations and why each succeeded or not            |
| `ng-devtools:list-routes`            | Live route config; match a URL; audit guard protection      |
| `ng-devtools:lint-routes`            | Route config mistakes, with fixes                           |
| `ng-devtools:router-config`          | Router options, features and strategies in effect           |
| `ng-devtools:export-navigation`      | Markdown repro of a navigation                              |
| `ng-devtools:explain-render-mode`    | ServerRoute and render mode for a URL                       |
| `ng-devtools:navigate`               | Navigate, abort, replay, probe, instrument (dev only)       |
| `ng-devtools:analog-routes`          | Analog file routes with their page, layout and server files |
| `ng-devtools:analog-explain-url`     | Which Analog files render a URL, or why nothing matches     |
| `ng-devtools:analog-current-page`    | The open page's files, load() data and hydration state      |
| `ng-devtools:analog-server-calls`    | Page renders, load(), server function and API calls         |
| `ng-devtools:analog-api-routes`      | Server routes with method, URL and file                     |
| `ng-devtools:analog-call-api`        | Send a request to a server route (non-GET needs confirm)    |
| `ng-devtools:analog-render-modes`    | SSR, prerendered or client only, per page                   |
| `ng-devtools:analog-prerender-plan`  | prerender.routes compared with pages and build output       |
| `ng-devtools:analog-content`         | Markdown content with slug and frontmatter                  |
| `ng-devtools:analog-lint`            | Analog routing, server, prerender and content mistakes      |

#### Forms

The Forms tab and the forms tools read Signal Forms, reactive forms and template-driven forms from the running page, in development builds only. Signal Forms need Angular 21 or later. The live change timeline for reactive and template-driven forms uses `control.events` (Angular 18+); on Angular 17 changes are picked up every few seconds instead, without submit and reset events.

- Each field shows its value, status, touched/dirty state and errors, plus: Signal Forms constraints (`min`, `max`, `minLength`, `maxLength`, `pattern`), a pending `debounce`, `submitting`, and disabled reasons; for reactive and template-driven forms, whether validators and async validators are attached, the value `reset()` goes back to, `updateOn`, and the bound `ControlValueAccessor`.
- `ng-devtools:explain-form-invalid` is the tool to reach for first: without arguments it lists every form that is invalid or waiting on async validation, with each failing field's current value, the validator that failed, its message and whether it was touched. Pass `form` (an id like `form-1`, or part of a label like `SignupComponent`) to explain one form.
- `ng-devtools:inspect-forms` lists the forms with their status and error counts. Pass `form` for a field tree, plus `path` (e.g. `address.city`), `onlyInvalid` or `includeValues: false` to narrow it down.
- Both tools note when the page last reported, so an agent can tell when the data is stale.
- Each error says where it comes from: a validator, a template attribute, a cross-field rule (and on which ancestor), async, parse, a server/submission error, or `setErrors()`. `explain-field` adds why validation is skipped (hidden, disabled, readonly), typed-but-uncommitted values (`updateOn`, `debounce`), stale validity after validator changes, the binding, whether the error text is visible, and the file and line of the form and its rules.
- Agents can loop: inspect, act (`form-action`, `fill-form`), `wait-for-form`, then `form-diff` from the marker they had. Writes need a development build; `reset`, `submit` and `restore` need `confirm: true`.
- The Forms tab has Fields (with filters and per-field actions), Timeline, Submit and Lint views. Pick a field on the page to select it, or open a form from its component in the Components tab.
- Timeline recording (a checkbox in the Timeline view, or `form-action` with `instrument`) adds the calling code of each change, validator changes, async validation times and component renders per keystroke. Array items are tracked by identity, so moves show as moves.

Form values leave the page: they are sent to the devtools server, shown in the Forms tab and returned to agents. Values of password fields, fields with a password, one-time-code or credit-card `autocomplete`, fields inside `.sentry-mask`, `.rr-mask`, `[data-private]` or `[data-ng-devtools="mask"]`, and fields whose name contains a secret word (password, token, card, cvv, apiKey and similar) are replaced with `[redacted]`, and those values are also removed from error messages. `[data-ng-devtools="unmask"]` opts a field back in; `window.__NG_DEVTOOLS_FORMS__ = { mask: ['iban'], unmask: ['passport'] }` does the same by key. DevTools never writes secret fields. Other values are sent as they are, so keep real credentials out of forms you inspect, and don't expose the dev server beyond localhost.

#### Router

The Routes tab and the router tools read the running app's Router, in development builds only. The Router is found through the debug helper `provideRouter()` publishes, or through the injector for `RouterModule.forRoot()` apps. Without debug utils (a production build) only navigation events are available, and the Setup view says so.

The Routes tab has five views:

- **Current**: the URL (and the browser URL when they differ), the navigation in flight with an Abort button, each active route with its component, params and data and where each value comes from (own, inherited, static or resolved), the route title and whether it is inherited, and the outlet tree with the inputs the router binds.
- **Navigations**: every navigation as one story: where it came from, who started it (a RouterLink, the code that called `navigate`, back/forward), extras, redirect chains and loops, a phase bar (recognize, guards, resolve, activate), guards and resolvers, lazy loads, reused components, HTTP requests, scroll, the title afterwards, router warnings, and the cancel or error reason. Turn on "Record each guard and resolver" to see each one's verdict and time (for example `authGuard returned UrlTree /login`). Replay a navigation, copy a markdown repro, or export the list as JSON.
- **Routes**: the live route config with lazy children merged in once they load and the active branch marked. Test a URL to predict which route matches it (or the nearest ones), probe it with the real matcher, navigate to any route (with its params), or read the routes of a lazy route that has not loaded.
- **Setup**: provideRouter or forRoot, effective options with set/default markers, enabled features, strategies, base href and hydration.
- **Lint**: route config mistakes (unreachable routes after `**`, a `:param` shadowing a literal, duplicate paths, empty-path redirects without `pathMatch: 'full'`, redirect cycles, deprecated class guards and `canLoad`, lazy chunks downloaded before a rejecting `canActivate`, missing or duplicate titles, param/input typos, `routerLinkActive` without `ariaCurrentWhenActive`, emails in URLs, return URLs taken from query params), each with a fix and whether Angular throws or stays silent.

Components rendered by the router show the route and outlet in the Components tab.

For agents:

- `ng-devtools:explain-navigation` answers "why did this navigation not work" or "why was I redirected": pass `url` or `id` to narrow it, `limit` for more than the last 5, or `perf` for the slowest navigations and preloads. NG04xxx and related errors are explained.
- `ng-devtools:inspect-route` describes the route the page is on right now; pass `selector` (a component class, tag or link text) to see which route a component was rendered for or whether a link counts as active.
- `ng-devtools:list-routes` lists the live config with source files and example URLs; `match` predicts which route a URL hits, `audit` lists the guards that protect each page.
- `ng-devtools:lint-routes`, `ng-devtools:router-config` and `ng-devtools:export-navigation` give the lint findings, the setup and a repro.
- `ng-devtools:explain-render-mode` reads the workspace's `*.routes.server.ts` and says which render mode a URL gets.
- `ng-devtools:navigate` acts on the router: `navigate` (a relative URL, or a pattern with params), `abort`, `replay`, `probe` (runs the real matcher without navigating; it runs `canMatch` and may load lazy chunks), `instrument` and `resolve-lazy`. It only accepts same-origin relative URLs.

Without instrumentation, the guards listed for a navigation are candidates (the `canDeactivate` guards of the page being left and the `canActivate`/`canActivateChild` guards of the target), because the router reports one result for all of them. Instrumentation wraps each guard and resolver in the live config to record its verdict; it is off by default and undone when turned off. A navigation that finished before the devtools connected is listed without timing or guard details.

Query, matrix and fragment keys that look secret (token, password, api key, code, sig, session, jwt and similar), including inside encoded return URLs, JWTs, bearer tokens, long opaque tokens and route params with such names are replaced with `[redacted]` in URLs, params, data and messages. A secret route param is only known once the route is recognized or found in the config, so a navigation that fails before that (for example inside a lazy route that failed to load) can still show it in its URL.

#### Analog

For [Analog](https://analogjs.org) apps, add the Vite plugin next to `analog()` and load the overlay in `main.ts`:

```ts
// vite.config.ts
import analog from '@analogjs/platform';
import ngDevtools from '@santoshyadavdev/ng-devtools/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [analog(), ngDevtools()],
});
```

```ts
// src/main.ts
bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@santoshyadavdev/ng-devtools/overlay');
});
```

The panel is then at `/__ng-devtools/` on the Vite dev server, and the MCP endpoint at `/__ng-devtools/__mcp`. The Analog tab shows:

- Routes: every page, layout and markdown file with its URL, route groups, `[param]` and catch-all segments, `.server.ts` files and routeMeta. Test a URL to see which files render it.
- Server: page renders (server rendered or client only), `load()` fetches, server functions and API calls with status, time and a redacted preview, plus a request playground for API routes. A `load()` that runs on the server and again in the browser is flagged.
- Render: SSR, prerendered or client only per page, from config, build output and the last request.
- Content and Lint: markdown files, and checks for duplicate URLs, missing default exports, layouts without `<router-outlet>`, orphan `.server.ts` files, API method suffixes, prerender entries and frontmatter.

The Analog tab appears only in Analog apps, and the Routes tab and Dashboard switch to Analog's file routes and SSR setting there. Tested with Analog 2.7 on Angular 20 (a fresh app from the official template, npm and pnpm) and Angular 22. The demo lives in `examples/analog` (`pnpm analog:dev`).

#### SSR & HTTP

The SSR & HTTP tab needs `withNgDevtools()` and `provideNgDevtoolsHttp()` (see [Embedded in an Angular app](#embedded-in-an-angular-app-express-ssr)), and SSR and the devtools middleware must run in the same Express process. It works in development builds only; in production the interceptor passes requests through untouched.

- **HTTP timeline**: every `HttpClient` request, tagged SSR or Client, with method, URL, status, time, whether the transfer cache answered it, and whether a fault rule changed it. Click a row for a response preview. Client calls are grouped by page; pick the page at the top. SSR calls are kept for the whole server, not per page, until you press Clear timeline.
- **Fault injection**: add a rule with a URL pattern (a substring, or a glob where `*` matches anything, so `/api/*` matches both relative and absolute URLs), an optional method, where it applies (SSR + client, SSR only, client only), and a status, a delay (up to 10 s) and an optional JSON body. A status of 400 or more fails the request with an `HttpErrorResponse`; a lower status returns the body as a mocked response. Client rules apply right away; SSR rules apply from the next page load.
- **Hydration**: whether hydration is on, hydrated components and nodes, skipped components, incremental defer blocks, and the hydration warnings Angular logged.
- **TransferState payload**: each entry in the page's `ng-state` script with its size, with HTTP cache entries decoded to status, URL and body.

Routes that are prerendered at build time make no requests at runtime and ignore SSR rules. Use `RenderMode.Server` in `app.routes.server.ts` for pages you want to test this way.

Response previews and TransferState values are not redacted: they are sent to the devtools server as they are, so don't expose the dev server beyond localhost.

#### Agent Resources

| Resource                     | Content                       |
| ---------------------------- | ----------------------------- |
| `ng-devtools:component-tree` | Live component hierarchy      |
| `ng-devtools:signal-graph`   | Signal dependency graph       |
| `ng-devtools:injector-tree`  | DI injector hierarchy         |
| `ng-devtools:ngrx-store`     | Live NgRx state & action log  |
| `ng-devtools:forms`          | Live forms and recent changes |
| `ng-devtools:router`         | Live route and navigations    |

### Vite DevTools Dock

Mount as a dock panel inside Vite DevTools:

```ts
// vite.config.ts
import { viteDevframeHub } from '@devframes/vite/hub';
import { createUi } from '@devframes/hub-ui';
import ngDevtools from '@santoshyadavdev/ng-devtools/devframe';

export default defineConfig({
  plugins: [
    viteDevframeHub({
      devframes: [ngDevtools],
      ui: createUi({ branding: { productName: 'Angular DevTools' } }),
    }),
  ],
});
```

### Chrome DevTools Extension

See the [Chrome Extension](#chrome-devtools-extension-1) section below for how to package this as a Chrome extension.

### Browser Overlay

The overlay runs inside the user's Angular page and collects live component, signal, DI, and NgRx data. Importing the module starts it, so in most apps that import is all that is needed:

```ts
import '@santoshyadavdev/ng-devtools/overlay';
```

It looks for the devframe connection next to the page and then at
`/__ng-devtools/`.

`initOverlay` is exported for a devtools mounted somewhere else. Importing the
module has already started an overlay on the default URLs by then, so dispose of
that one before starting another, or the page ends up with two connections and
two polling intervals:

```ts
import { initOverlay } from '@santoshyadavdev/ng-devtools/overlay';

const dispose = await initOverlay({ baseURL: '/__my-devtools/' });
```

### In-Page Popup

The devtools can appear as a floating popup directly on your page — no browser extension needed:

```ts
import { createDevtoolsPopup } from '@santoshyadavdev/ng-devtools/popup';

createDevtoolsPopup();
```

This adds a purple FAB button (bottom-right) that opens the full devtools UI in an iframe. Supports three dock modes (float, bottom, right), dragging, resizing, and persists position via localStorage. The popup is automatically loaded in development when using the demo app.

## Demo App

The repository includes a demo Angular app (`src/`) that showcases the devtools with a product catalog built using `@ngrx/signals`:

- **Home** — simple counter with `signal()`
- **Products** — product list and detail pages powered by a `signalStore` with `withState`, `withComputed`, and `withMethods`
- **About** — static page
- **Examples → SSR & HTTP** (`/examples/http`) — a product list fetched from `/api/products` during SSR and replayed from the transfer cache. The endpoint accepts `?delay=` and `?fail=` for backend scenarios; run the SSR server (`pnpm build --configuration development && node dist/angular-devtools/server/server.mjs`) to see server calls

Run `pnpm start` and click the purple FAB button to open the devtools popup and see all inspectors in action.

## Development

```sh
# Install dependencies
pnpm install

# Dev server for the devtools UI (with live RPC)
pnpm devtools:dev

# Build the devtools UI SPA
pnpm devtools:build

# Build the publishable package (library + UI in dist/)
pnpm devtools:build-pkg

# Run the Angular host app (builds the package first, includes in-page devtools popup)
pnpm start
```

## Publishing

The devtool ships as one npm package, `@santoshyadavdev/ng-devtools`: Node-side logic, RPC, CLI, overlay, popup, and the built UI in `dist/public`.

```sh
# Builds on prepack, then publishes
pnpm devtools:publish
```

## Chrome DevTools Extension

To distribute this as a Chrome DevTools extension, you need a thin Chrome extension shell that opens the devtools UI in a DevTools panel. The built SPA already works standalone — the extension just embeds it.

### 1. Create the extension scaffold

Create an `extension/` directory:

```
extension/
  manifest.json
  devtools.html
  devtools.js
  panel.html
```

### 2. `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Angular DevTools",
  "version": "0.0.1",
  "description": "Inspect Angular components, signals, DI, and routes.",
  "devtools_page": "devtools.html",
  "permissions": ["scripting"],
  "host_permissions": [
    "http://localhost/*",
    "https://localhost/*",
    "http://127.0.0.1/*",
    "https://127.0.0.1/*"
  ],
  "icons": {
    "128": "icon-128.png"
  }
}
```

### 3. `extension/devtools.html` and `extension/devtools.js`

```html
<!-- devtools.html -->
<!doctype html>
<script src="devtools.js"></script>
```

```js
// devtools.js — creates the panel in Chrome DevTools
chrome.devtools.panels.create('Angular', 'icon-128.png', 'panel.html');
```

### 4. `extension/panel.html`

This is where the built SPA loads. Copy the built assets (`dist/devtools-ui/`) into the extension and point `panel.html` at the SPA's `index.html`:

```html
<!-- panel.html — the devtools SPA loads here -->
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <iframe src="ui/index.html" style="width:100%;height:100vh;border:none;"></iframe>
  </body>
</html>
```

### 5. Build the extension

```sh
# Build the devtools SPA
pnpm devtools:build

# Copy into the extension
mkdir -p extension/ui
cp -r dist/devtools-ui/* extension/ui/
```

### 6. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` directory
4. Open DevTools on any Angular app → the **Angular** panel appears

### 7. Publish to Chrome Web Store

1. Zip the `extension/` directory
2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Click **New item** → upload the zip
4. Fill in the listing details and submit for review

### Connecting the extension to the running app

The extension panel loads the SPA in static mode by default. To connect it to a live dev server for real-time RPC, the extension's content script or background service worker needs to detect the devframe's `__connection.json` on the inspected page and pass the connection to the panel. This is the same pattern the official Angular DevTools Chrome extension uses — a content script bridges the inspected page and the DevTools panel via `chrome.runtime.connect`.

## Community

Join the conversation, ask questions, and share feedback on [Discord](https://discord.gg/YRTyJd6Qx).

## Sponsors

If Angular DevTools helps your work, please consider [sponsoring the project on GitHub](https://github.com/sponsors/santoshyadavdev). Your support keeps development going.

Thanks to our current sponsors:

<!-- sponsors -->

<a href="https://github.com/coderabbitai"><img src="https://github.com/coderabbitai.png?size=60" width="60" height="60" alt="CodeRabbit" /></a>
<a href="https://github.com/umairhm"><img src="https://github.com/umairhm.png?size=60" width="60" height="60" alt="umairhm" /></a>
<a href="https://github.com/Sonichigo"><img src="https://github.com/Sonichigo.png?size=60" width="60" height="60" alt="Sonichigo" /></a>
<!-- /sponsors -->

## License

MIT
