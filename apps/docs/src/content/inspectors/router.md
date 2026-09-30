---
title: Router
description: The live route, every navigation as a story, the live route config, router setup and a route lint.
---

<ngmd-hero title="Router" gradient>
  The live route, every navigation as one story, the live route config, the router setup and a route lint. Plus the routes your source declares.
</ngmd-hero>

# Router

The Routes tab reads the running app's Router. The top section, **Live router**, has five views. The bottom section, **Source route config**, lists the routes your files declare. When more than one page is connected, a **Page** picker chooses which one you see.

## What it shows

### Current

The route the page is on:

- The URL, and the browser URL when the two differ.
- The navigation in flight, with an **Abort** button.
- The document title, query params and fragment.
- **Active routes**: each active route with its component, params, data, and guards and resolvers. Tags mark lazy routes, inherited params, and whether a data value is static, resolved or inherited. The title row says when the title is inherited.
- **Outlets**: the outlet tree, with the inputs the router binds to each component.

### Navigations

Every navigation as one story:

- Where it came from, and who started it: a `RouterLink`, the code that called `navigate`, or back and forward.
- The extras, redirect chains and loops.
- A phase bar: recognize, guards, resolve, activate.
- Guards and resolvers, lazy loads, reused components, HTTP requests, scroll, and the title afterwards.
- Router warnings, and the cancel or error reason. The tab explains NG04xxx errors.

Filter by URL, or check **Only problems** to keep the navigations that did not succeed and the ones in a loop. Each row has **Replay** and **Copy repro** (a markdown repro). **Export JSON** saves the list.

### Loop detection

The **Navigations** view looks for loops in the recorded navigations. A loop is a chain that comes back to a URL it already visited:

| Loop                          | What the view detects                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **redirect loop**             | A chain of redirects returns to an earlier URL. The chain follows `canMatch`, guard, resolver and error handler redirects from one navigation to the next, plus the `redirectTo` inside each navigation. |
| **navigation loop**           | Your code calls `navigate` or `navigateByUrl` within 500 ms of the previous navigation ending, and the chain returns to an earlier URL.                                                                  |
| **redirect loop** (`NG04016`) | Angular stops a navigation with `NG04016` because `redirectTo` entries of the config form a cycle.                                                                                                       |

When the view finds a loop, a **Loop detected** section appears above the list. It shows the cycle of URLs, such as `/account → /login → /account`. Under it, each hop names its cause: the guard, the `redirectTo` entry or the `navigate` call. A last line lists the navigation ids, how many times the chain came back, how it ended and the guards involved.

Each navigation in a loop gets a **loop** badge and a red edge. Its details gain a **Loop** row with the cycle and the hop this navigation caused.

### Routes

The live route config. The tab merges lazy children in once they load, and marks the active branch.

- **Test a URL** and click **Predict** to see which route matches it, or the nearest ones.
- **Probe in app** runs the real matcher without navigating.
- Fill in the params of a route and click **Go** to navigate to it.
- **Read lazy** reads the routes of a lazy route that has not loaded.

### Setup

How the router is set up: `provideRouter` or `forRoot`, the effective options with **set** or **default** badges, the enabled features, the strategies, the base href and hydration.

### Lint

Route config mistakes, each with a fix:

- Unreachable routes after `**`, and duplicate paths.
- A `:param` that shadows a literal path.
- Empty-path redirects without `pathMatch: 'full'`, and redirect cycles.
- Redirect loops seen at runtime (rule `redirect-loop`), with the hops and the guards involved.
- Deprecated class guards and `canLoad`.
- Lazy chunks downloaded before a rejecting `canActivate`.
- Missing or duplicate titles, and param or input typos.
- `routerLinkActive` without `ariaCurrentWhenActive`.
- Emails in URLs, and return URLs taken from query params.

Each finding says whether Angular throws, warns or does not warn. The lint skips lazy routes that have not loaded. Click **Check again** to rerun it.

### Source route config

The routes declared in your files: `*.routes.ts` and `*routing.module.ts` files, the files they lazy load, and Analog pages. Each row shows the path, the component or target, guards and resolvers, the title and the declaring file. Once the live config is available, the tab collapses this table. **Show table** opens it.

Components rendered by the router show their route and outlet in the [Components tab](./components.md).

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay finds the Router through Angular's debug API and reports the route, navigations, config and setup.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server reads your route files for the source table, and <code>*.routes.server.ts</code> for render modes.
  </ngmd-card>
</ngmd-card-grid>

### Finding the Router

The overlay reads the helper `provideRouter()` publishes (`ng.ɵgetRouterInstance`). For `RouterModule.forRoot()` apps, it looks for the `Router` token in the injectors instead. With several app roots, the router that has routes or has navigated wins.

### Development builds

The live views need `window.ng`, so they need a development build. In a production build the overlay finds no Router, and **Current** says **This page reports no Router**.

When the debug API exists but lacks the provider helpers, the tab runs in events-only mode. The **Setup** view says so, and the config, lint and actions are limited.

### Guard verdicts

The router reports one result for all the guards of a navigation. To see each guard's verdict and time, the devtools wrap every guard and resolver in the live config. Each row shows the guard, the route, its result (such as `UrlTree /login`) and its time.

Without that recording, the guards listed for a navigation are candidates: the `canDeactivate` guards of the page being left, and the `canActivate` and `canActivateChild` guards of the target.

## How to use it

### Find out why a navigation failed

<ngmd-workflow>
  <ngmd-step title="Open Navigations">
    Check <strong>Only problems</strong> to hide the navigations that succeeded outside a loop.
  </ngmd-step>
  <ngmd-step title="Read the story">
    The phase bar shows where it stopped. The guard rows show which guard returned <code>false</code> or a <code>UrlTree</code>.
  </ngmd-step>
  <ngmd-step title="Replay it">
    Fix the code, then click <strong>Replay</strong> to run the same navigation again.
  </ngmd-step>
  <ngmd-step title="Share it">
    Click <strong>Copy repro</strong> to paste a markdown repro into an issue.
  </ngmd-step>
</ngmd-workflow>

### Check which route a URL hits

<ngmd-workflow>
  <ngmd-step title="Open Routes">
    Type the URL into <strong>Test a URL</strong>.
  </ngmd-step>
  <ngmd-step title="Predict">
    Click <strong>Predict</strong>. A miss lists the nearest routes.
  </ngmd-step>
  <ngmd-step title="Probe">
    Click <strong>Probe in app</strong> to confirm with the real matcher. It runs <code>canMatch</code> and may load lazy chunks.
  </ngmd-step>
</ngmd-workflow>

### Clean up the config

<ngmd-workflow>
  <ngmd-step title="Open Lint">
    Read the findings, most severe first.
  </ngmd-step>
  <ngmd-step title="Apply the fix">
    Each finding comes with a fix. Start with the ones where Angular stays silent.
  </ngmd-step>
  <ngmd-step title="Check again">
    Click <strong>Check again</strong> after the app reloads.
  </ngmd-step>
</ngmd-workflow>

## Agent tools

| Tool or resource                  | What it does                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ng-devtools:explain-navigation`  | Why a navigation failed or redirected, with any loop and the cause of each hop. Pass `url` or `id` to narrow it, `limit` for more than the last 5, or `perf` for the slowest ones. |
| `ng-devtools:inspect-route`       | The route the page is on. Pass `selector` (a component class, tag or link text) for the route a component was rendered for, or a link state.                                       |
| `ng-devtools:list-routes`         | The live config with source files and example URLs. `match` predicts a URL, `audit` lists the guards of each page.                                                                 |
| `ng-devtools:lint-routes`         | The lint findings, including redirect loops seen at runtime.                                                                                                                       |
| `ng-devtools:router-config`       | The setup, including whether guard recording is on.                                                                                                                                |
| `ng-devtools:export-navigation`   | A markdown repro, with any loop the navigation is part of. Defaults to the latest navigation that did not succeed.                                                                 |
| `ng-devtools:explain-render-mode` | Which render mode a URL gets, from `*.routes.server.ts`.                                                                                                                           |
| `ng-devtools:get-routes`          | Routes from your source files.                                                                                                                                                     |
| `ng-devtools:navigate`            | Acts on the router: `navigate`, `abort`, `replay`, `probe`, `instrument` and `resolve-lazy`.                                                                                       |
| `ng-devtools:router` (resource)   | The active route tree and recent navigations of each page.                                                                                                                         |

`navigate` only accepts same-origin relative URLs that start with `/`. `resolve-lazy` needs a `routeId`. See [Tools](../agents/tools.md).

## Limits and gotchas

### Guard recording is on by default

**Record each guard and resolver** in the **Navigations** view starts checked. Uncheck it to stop. Turning it off puts every original guard and resolver back. The page keeps the choice per browser tab, in `sessionStorage`, so it survives a reload. Agents use `navigate` with `action: "instrument"` and `on`.

### Abort and probe need Angular 20.2

Aborting and probing use the `currentNavigation` signal and `Navigation.abort()`, which older versions lack. On those versions the action returns an error.

### Navigations before the devtools connected

The tab lists only the last one, marked **before DevTools connected**, without timing or guard details. It also lists a navigation still running at that moment.

### Redaction

The devtools replace query, matrix and fragment values with secret-looking keys with `[redacted]`. They also redact tokens, `Bearer` values, and route params with secret-looking names such as `:token`. You can't replay a navigation with a redacted URL. See [what the devtools redact](../security.md).

### History and config caps

The page keeps the last 50 navigations and 50 preloads. The live config stops at 1000 routes.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does a navigation list several guards but no verdicts?">
    Guard recording is off for that tab. Check <strong>Record each guard and resolver</strong> and run the navigation again.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does Probe in app change the URL?">
    No. It runs the real matcher with <code>skipLocationChange</code> and stops after recognition. <code>canActivate</code>, <code>canDeactivate</code> and resolvers do not run.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is the source table collapsed?">
    The live config is available, so it is the better source. Click <strong>Show table</strong> to open the source list.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    Routed components show their route and outlet.
  </ngmd-card>
  <ngmd-card icon="rocket" title="Analog" link="/inspectors/analog" cta="Open">
    File routes, server calls and render modes for Analog apps.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Read">
    What is redacted, and how access is limited.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
</ngmd-card-grid>
