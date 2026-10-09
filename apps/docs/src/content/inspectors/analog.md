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
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [analog(), pangular()],
});
```

The plugin runs on the dev server only. The app counts as Analog when its `package.json` depends on `@analogjs/platform` or `@analogjs/router`.

### Try the demo

The demo lives in `examples/analog`. It uses Analog 2.7 on Angular 22. Run it with `pnpm analog:dev`.

## What it shows

### Summary

The summary at the top shows the Analog version, and the number of pages, API routes, server calls and issues. It also shows the page open in the browser. When several app tabs are open, it follows the tab the panel belongs to.

### Routes

Every page (`.page.ts`, `.page.analog` or `.page.ag`), layout and markdown file with its URL, route groups, `[param]` and catch-all segments, `.server.ts` files and `routeMeta`.

Type a URL into **Test a URL** and click **Explain** to see which files render it: the layout chain, the page and its params. A URL that matches nothing gets the closest candidates. The result names the URL it explains, so it stays correct while you type the next one. If the devtools server does not answer, the result says so.

### Server

Page renders (server rendered or client only), `load()` fetches, form actions, server functions and API calls. Each row shows the status, the time, who called it, and a redacted response preview. Filter by kind, and click **Clear calls** to empty the list.

- **Actions** are form submissions to a page's `action` (any method other than GET on the page endpoint). Each one shows its outcome: **succeeded**, **redirected** (with the target), **validation errors** (a `fail()` response, with the redacted errors) or **failed**.
- **Server fn** rows show the function name and file instead of the opaque `/_analog/fn/<id>` URL. During server rendering, server functions run in-process and skip HTTP. The tab shows the reads that seeded TransferState as **ran during server rendering**, with the method `SSR`.

The tab flags a `load()` that runs during server rendering and again in the browser right after. It means TransferState did not serve the server result. It also flags a server function read seeded during server rendering and called again in the browser right after hydration.

The **API routes** table lists your server routes. Click **Try** to open one in the **Request playground**, which sends real requests to your dev server. While a request runs, **Send** is off and the old response is cleared. For POST, PUT, PATCH and DELETE, **Send** stays off until you tick **This request can change data on the dev server**.

The **Server functions** table lists every `serverFn` export in a `.server.ts` file under `src`, with its method, file and call count.

### Render

How each page is rendered: **SSR**, **Prerendered**, **Cached**, **Client only** or **Redirect**, with the rule that decides it. It reads the config, the build output and the last request to the page, dynamic and catch-all URLs included. It marks a page whose last request differs from its config.

The **Prerender plan** compares `prerender.routes` and the `routeRules` with `prerender: true` with your pages and the build output. It lists static pages left out, dynamic pages that need explicit entries, and listed routes missing from `dist`.

### Content

Markdown files under `src/content`, with title, URL, slug, date and file. The tab marks files with frontmatter errors.

### Lint

Checks grouped by rule, each with a fix. Each card lists where the rule fired and the detail for that spot, like the hydration error text, the failing request or both files of a duplicate URL:

- Two files for one URL, and sibling `[param]` files.
- Missing default exports, and layouts without `<router-outlet>`.
- `.server.ts` files without `load`, `action` or server functions, or without a page. A file that only exports server functions needs no page.
- Redirect mistakes.
- API method suffixes, duplicate API routes, and routes outside the API prefix.
- Prerender entries that match nothing.
- Frontmatter errors, duplicate slugs, and content that shadows a page.
- From the live page: `load()` fetched twice, server function reads called again after hydration, hydration errors, API routes not found, and added pages that need a restart. To catch hydration errors from the first load, add `providePangularHttp()` (see [Set up Analog](../guides/analog.md#catch-hydration-errors-from-the-first-load)).

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

### Supported layouts

- **Single app**: `package.json`, `vite.config.ts` and `src/app/pages` in one folder. The build output is read from `dist/analog/public`.
- **Nx workspace**: the app lives in `apps/<name>` and `package.json` sits at the workspace root. The scan uses the Vite root, or the first folder under `apps/` whose `vite.config` calls `analog()` when the tools run from the workspace root. The **Routes** tab, `get-routes` and the **SSR** and **Analog** fields on the **Dashboard** read the same app, so they match this tab. `package.json` is looked up from the app folder upward, and the build output is read from `dist/apps/<name>/analog/public`.

### Render mode rules

The tab reads every `routeRules` entry in `vite.config`. A rule like `/blog/**` covers `/blog` and every page below it, and `*` matches one segment. When several rules match, the most specific one wins, as in Nitro. The first match in this table decides the mode:

| Mode        | When                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Redirect    | A rule has `redirect`.                                                                                     |
| Client only | A rule has `ssr: false`, or the `ssr` option is `false`.                                                   |
| Prerendered | The page is in the build output, a rule has `prerender: true`, or the page is in `prerender.routes`.       |
| Cached      | A rule has `isr`, `swr` or `cache`, or a `Cache-Control` header with a `max-age` or `s-maxage` above zero. |
| SSR         | None of the above.                                                                                         |

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

| Tool                               | Inputs                                         | What it does                                                            |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `pangular:analog-routes`           | `filter`                                       | File routes in match order, with page, layout and server files.         |
| `pangular:analog-explain-url`      | `url` (required)                               | Which files render a URL, or the closest candidates.                    |
| `pangular:analog-current-page`     | `page`                                         | The open page: its files, `load()` data, rendering and hydration state. |
| `pangular:analog-server-calls`     | `kind`, `route`, `limit`                       | Recent server calls, with server function names and action outcomes.    |
| `pangular:analog-api-routes`       |                                                | Server routes with method, URL and file, plus middleware.               |
| `pangular:analog-server-functions` |                                                | Server functions with name, method, file, id and call counts.           |
| `pangular:analog-call-api`         | `path` (required), `method`, `body`, `confirm` | Sends a real request to the dev server.                                 |
| `pangular:analog-render-modes`     |                                                | The render mode of each page, and what the last request did.            |
| `pangular:analog-prerender-plan`   |                                                | The prerender plan.                                                     |
| `pangular:analog-content`          | `filter`                                       | Markdown files with slug, frontmatter, route and parse errors.          |
| `pangular:analog-lint`             |                                                | The Analog checks.                                                      |

`analog-current-page` is the only place that shows the `load()` data a page received. See [Tools](../agents/tools.md).

## Limits and gotchas

### `analog-call-api` changes real data

It sends a real request to your dev server. Methods other than GET, HEAD and OPTIONS need `confirm: true`. It works only through the Vite plugin.

### Redaction

Response previews and `load()` data redact secret-looking keys, tokens, `Bearer` values and secret query parameters. Bodies over 16 KB are cut before the preview, and secret keys in the cut JSON are still redacted. Objects nested too deep to read are shown as `[Truncated]`. See [what the devtools redact](../security.md).

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
