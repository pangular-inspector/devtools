---
title: Analog
description: File routes, server calls, render modes, content and lint for Analog apps.
---

<ngmd-hero title="Analog" logo="https://analogjs.org/img/logos/analog-logo.svg" gradient>
  How an Analog app is put together and what its dev server does. File routes, server calls, render modes, content files and a lint.
</ngmd-hero>

# Analog

The Analog tab reads an *Analog app from three sides: its files, its dev server, and the page open in the browser. With the hub mounted, it lives in the **Analog** dock.

The Analog dock is always in the rail. In other apps it shows a **This app doesn’t use Analog** page. Without the hub, the Analog tab appears only in Analog apps.

## Setup

### Add the plugin

Add the Vite plugin next to `analog()` and load the overlay. See [Vite and Analog](../getting-started/vite.md) and the [Analog guide](../guides/analog.md).

```ts {3,7}
// vite.config.ts
import analog from '@analogjs/platform';
import ngDevtools from '@santoshyadavdev/ng-devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [analog(), ngDevtools()],
});
```

The plugin runs on the dev server only. The app counts as Analog when its `package.json` depends on `@analogjs/platform` or `@analogjs/router`.

### Try the demo

The demo lives in `examples/analog`. It uses Analog 2.7 on Angular 22. Run it with `pnpm analog:dev`.

## What it shows

### Summary

The summary at the top shows the Analog version, and the number of pages, API routes, server calls and issues. It also shows the page open in the browser.

### Routes

Every page, layout and markdown file with its URL, route groups, `[param]` and catch-all segments, `.server.ts` files and `routeMeta`.

Type a URL into **Test a URL** and click **Explain** to see which files render it: the layout chain, the page and its params. A URL that matches nothing gets the closest candidates.

### Server

Page renders (server rendered or client only), `load()` fetches, server functions and API calls. Each row shows the status, the time, who called it, and a redacted response preview. Filter by kind, and click **Clear calls** to empty the list.

The tab flags a `load()` that runs during server rendering and again in the browser right after. It means TransferState did not serve the server result.

The **API routes** table lists your server routes. Click **Try** to open one in the **Request playground**, which sends real requests to your dev server.

### Render

How each page is rendered: **SSR**, **Prerendered** or **Client only**. It reads the config, the build output and the last request, and marks a page whose last request differs from its config.

The **Prerender plan** compares `prerender.routes` with your pages and the build output. It lists static pages left out, dynamic pages that need explicit entries, and listed routes missing from `dist`.

### Content

Markdown files under `src/content`, with title, URL, slug, date and file. The tab marks files with frontmatter errors.

### Lint

Checks grouped by rule, each with a fix:

- Two files for one URL, and sibling `[param]` files.
- Missing default exports, and layouts without `<router-outlet>`.
- `.server.ts` files without `load` or without a page.
- Redirect mistakes.
- API method suffixes, duplicate API routes, and routes outside the API prefix.
- Prerender entries that match nothing.
- Frontmatter errors, duplicate slugs, and content that shadows a page.
- From the live page: `load()` fetched twice, hydration errors, API routes not found, and added pages that need a restart.

## Where the data comes from

<ngmd-card-grid columns="3">
  <ngmd-card icon="file" title="Source">
    The server scans your pages, layouts, <code>.server.ts</code> files, server routes, middleware, content files, <code>vite.config</code> and the build output.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Dev server">
    The Vite plugin records page renders, <code>load()</code> fetches, server functions and API calls.
  </ngmd-card>
  <ngmd-card icon="zap" title="Live">
    The overlay reports the open page, the <code>load()</code> data it received, and its hydration state.
  </ngmd-card>
</ngmd-card-grid>

### Render mode rules

A page is **Client only** when `routeRules` or the `ssr` option turns SSR off for it. It is **Prerendered** when it is in the build output or in `prerender.routes`. Otherwise it is **SSR**.

### Other tabs in Analog apps

- The Routes tab adds the Analog file routes in front of the routes from route config files.
- The Dashboard SSR chip follows the `ssr` option of `analog()`.

## How to use it

### Find which file renders a URL

<ngmd-workflow>
  <ngmd-step title="Open Routes">
    Type the URL into <strong>Test a URL</strong>.
  </ngmd-step>
  <ngmd-step title="Explain">
    Click <strong>Explain</strong>. The result lists the layouts, the page and the params.
  </ngmd-step>
</ngmd-workflow>

### Fix a `load()` that runs twice

<ngmd-workflow>
  <ngmd-step title="Open Server">
    A warning at the top names the route.
  </ngmd-step>
  <ngmd-step title="Check TransferState">
    Open the <a href="./ssr-http.md">SSR & HTTP tab</a> and look for the Analog entry in the payload.
  </ngmd-step>
  <ngmd-step title="Reload and compare">
    After the fix, the browser should not fetch the route's <code>load()</code> again.
  </ngmd-step>
</ngmd-workflow>

### Call an API route

<ngmd-workflow>
  <ngmd-step title="Pick the route">
    Click <strong>Try</strong> in the <strong>API routes</strong> table.
  </ngmd-step>
  <ngmd-step title="Send the request">
    For methods other than GET, add a JSON body and check <strong>This request can change data on the dev server</strong>.
  </ngmd-step>
  <ngmd-step title="Read the response">
    The status, the time and the body appear below. The call also shows in the list.
  </ngmd-step>
</ngmd-workflow>

## Agent tools

| Tool                                | Inputs                                         | What it does                                                            |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `ng-devtools:analog-routes`         | `filter`                                       | File routes in match order, with page, layout and server files.         |
| `ng-devtools:analog-explain-url`    | `url` (required)                               | Which files render a URL, or the closest candidates.                    |
| `ng-devtools:analog-current-page`   | `page`                                         | The open page: its files, `load()` data, rendering and hydration state. |
| `ng-devtools:analog-server-calls`   | `kind`, `route`, `limit`                       | Recent server calls. Flags `load()` fetched twice.                      |
| `ng-devtools:analog-api-routes`     |                                                | Server routes with method, URL and file, plus middleware.               |
| `ng-devtools:analog-call-api`       | `path` (required), `method`, `body`, `confirm` | Sends a real request to the dev server.                                 |
| `ng-devtools:analog-render-modes`   |                                                | The render mode of each page, and what the last request did.            |
| `ng-devtools:analog-prerender-plan` |                                                | The prerender plan.                                                     |
| `ng-devtools:analog-content`        | `filter`                                       | Markdown files with slug, frontmatter, route and parse errors.          |
| `ng-devtools:analog-lint`           |                                                | The Analog checks.                                                      |

`analog-current-page` is the only place that shows the `load()` data a page received. See [Tools](../agents/tools.md).

## Limits and gotchas

### `analog-call-api` changes real data

It sends a real request to your dev server. Methods other than GET, HEAD and OPTIONS need `confirm: true`. It works only through the Vite plugin.

### Redaction

Response previews and `load()` data redact secret-looking keys, tokens, `Bearer` values and secret query parameters. See [what the devtools redact](../security.md).

### Call history size

The server keeps the last 200 calls. It cuts previews to 1000 characters, and page renders have no preview.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why doesn't the router know a page I added?">
    The running router does not know page files added after the dev server started. The lint flags them. Restart the dev server.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is there no Analog tab?">
    Without the hub, the Analog tab appears only in Analog apps. The app counts as Analog when its <code>package.json</code> depends on <code>&#64;analogjs/platform</code> or <code>&#64;analogjs/router</code>.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="wrench" title="Set up Analog" link="/guides/analog" cta="Guide">
    Install, add the plugin and load the overlay.
  </ngmd-card>
  <ngmd-card icon="rocket" title="Vite and Analog" link="/getting-started/vite" cta="Set up">
    The Vite plugin and its options.
  </ngmd-card>
  <ngmd-card icon="layers" title="SSR & HTTP" link="/inspectors/ssr-http" cta="Open">
    The TransferState payload, with Analog entries decoded.
  </ngmd-card>
  <ngmd-card icon="compass" title="Router" link="/inspectors/router" cta="Open">
    The live router of the Analog app.
  </ngmd-card>
</ngmd-card-grid>
