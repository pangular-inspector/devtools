---
title: Analog
description: File routes, server calls, render modes, content and lint for Analog apps.
---

<ngmd-hero title="Analog" logo="https://analogjs.org/img/logos/analog-logo.svg" gradient>
  How an Analog app is put together and what its dev server does. File routes, server calls, render modes, content files and a lint.
</ngmd-hero>

# Analog

The Analog tab reads an *Analog app from three sides: its files, its dev server, and the page open in the browser. With the hub mounted, it lives in the **Analog** dock.

The Analog dock is always in the rail. In other apps it shows a **This app doesn’t use Analog** page. Its tooltip in the rail then reads **Analog: not an Analog app**. Without the hub, the Analog tab appears only in Analog apps.

<ngmd-image src="/images/panel/analog.png" alt="The Analog tab for the Analog demo: the summary strip with the Analog version and counts of pages, API routes, server calls and lint issues, a Test a URL box, and the Routes view mapping each route to its file under pages"></ngmd-image>

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

The pages that render the URL open in the browser show an **open** pill. A page in a named outlet, such as `<router-outlet name="sidebar">`, shows the outlet name too, like **open in sidebar**.

Type a URL into **Test a URL** and click **Explain** to see which files render it: the layout chain, the page and its params. A URL that matches nothing gets the closest candidates. The result names the URL it explains, so it stays correct while you type the next one. If the devtools server does not answer, the result says so.

Click **Transform** on a page or layout to open its **Vite transform stack**. The dev server transforms the file again and the card lists each plugin that changed the code, in order, with its time and the code it returned. This shows the `.analog`/`.ag` compile and the server function id rewrite. Tick **Server build (SSR)** for the server transform. **Server function ids** says whether each `serverFn` id of the file is in the output, and **Code Vite serves** shows the final code. With `vite-plugin-inspect` installed, a link opens the file there. The stack needs the Vite plugin.

### Server

Page renders (server rendered or client only), `load()` fetches, form actions, server functions and API calls, newest first. Each row shows the status, the time, who called it, and a redacted response preview.

| Control                                 | What it does                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Kind filter                             | Show one kind of call. Each choice counts the tab's calls of that kind, before the search and **Failed only**.       |
| **Find a URL, path or function** search | Keeps calls whose URL, route path, server function name or file contains the text. `Escape` clears it.               |
| **Failed only**                         | Keeps calls with a status of 400 or more, no status, or a form action that failed.                                   |
| **All tabs (including untagged)**       | Shows the calls of every tab, and calls the dev server could not tie to a tab. Off by default.                       |
| **Clear calls**                         | Empties the list on the dev server, for every tab. The tab says **Calls cleared.** or **Could not clear the calls.** |

The list shows the calls of the tab the panel belongs to (with no page id, the tab that reported last). **All tabs (including untagged)** appears while a page reports. See [Which tab a call belongs to](#which-tab-a-call-belongs-to).

The filters combine, and the count next to them reads like **12 of 80**. If nothing matches, click **Clear filters** to reset the search, **Failed only** and the kind.

The list renders the newest 150 matching calls. If more match, a note says **Showing the newest 150 of** the matching total. Once the dev server holds 200 calls, the note also says that it drops older ones.

- **Actions** are form submissions to a page's `action` (any method other than GET on the page endpoint). Each one shows its outcome: **succeeded**, **redirected** (with the target), **validation errors** (a `fail()` response, with the redacted errors) or **failed**.
- **Server fn** rows show the function name and file instead of the opaque `/_analog/fn/<id>` URL. During server rendering, server functions run in-process and skip HTTP. The tab shows the reads that seeded TransferState as **ran during server rendering**, with the method `SSR`.

The tab flags a `load()` that runs during server rendering and again in the browser right after. It means TransferState did not serve the server result. It also flags a server function read seeded during server rendering and called again in the browser right after hydration.

The **API routes** table lists your server routes. Click **Try**, or pick a route in **Route**, to open it in the **Request playground**, which sends real requests to your dev server.

| Playground part                     | What it does                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Path                                | Write `:name` or `**` in it to get a field per param under **Path params**. Values are URL-encoded.          |
| **Query**                           | Name and value pairs added to the URL.                                                                       |
| **Headers**                         | Extra request headers. `host`, `content-length` and other headers the dev server or fetch owns are refused.  |
| **Cookies**                         | Sent as one `cookie` header.                                                                                 |
| **Copy as curl**, **Copy as fetch** | Copy the request as a command, with the dev server origin.                                                   |
| Response                            | Status, total time, time to the headers, size, content type, the **Response headers** (masked) and the body. |
| **History for** the route           | The last 10 requests of that route pattern while you stay on **Server**. **Load** puts one back in the form. |

While a request runs, **Send** is off and the old response is cleared. For POST, PUT, PATCH and DELETE, **Send** stays off until you tick **This request can change data on the dev server**. The tick covers one request. It clears after you send, when you change the method or URL, and when you click **Try** on another route.

The **Server functions** table lists every `serverFn` export in a `.server.ts` file under `src`, with its method, file and call count.

### Render

How each page is rendered: **SSR**, **Prerendered**, **Cached**, **Client only** or **Redirect**, with the rule that decides it. It reads the config, the build output and the last request to the page, dynamic and catch-all URLs included. It marks a page whose last request differs from its config.

Click **Check** in the **Dev server check** column to request the page from the dev server with `Accept: text/html`. The tab compares `cache-control`, `x-nitro-prerender`, `x-analog-no-ssr` and the HTML with the configured mode, and says **fits the config** or **differs from config**. Dynamic segments get a sample value (`1`). The dev server renders prerendered pages per request, so a prerendered page that answers as SSR still fits.

The **Prerender plan** compares `prerender.routes` and the `routeRules` with `prerender: true` with your pages and the build output. It lists static pages left out, dynamic pages that need explicit entries, and listed routes missing from `dist`.

**Build analysis** reads the last client build in `dist/analog/public` after `analog build`: total JavaScript and CSS with gzip sizes, the entry chunk, and for each page its chunk, what it loads beyond the entry and the lazy chunks it can pull in. Pages are matched to chunks through the Vite manifest when `build.manifest` is on, and by chunk name otherwise. Pages that share a name, such as several `index.page.ts`, need the manifest. Click **Read again** after a new build.

### Content

Markdown files under `src/content`, with title, URL, slug, date and file. The tab marks files with frontmatter errors and, with a content schema, files whose frontmatter does not match it.

Below the table, **Schema** names the file set in [`analog.contentSchema`](../getting-started/configuration.md#analog) and **Read by** lists the `injectContentFiles`, `injectContent` and `contentFilesSource` calls under `src`. Click **Preview** on a file to see its frontmatter with YAML types, the schema problems and its markdown rendered as text (links keep their text only, HTML is dropped).

The schema is a JSON Schema file inside the project. The check reads `type`, `required`, `properties`, `additionalProperties`, `enum`, `const`, `pattern`, `format` (`date`, `date-time`, `email`, `uri`), `minLength`, `maxLength`, `minimum`, `maximum`, `items`, `minItems` and `maxItems`. It lists other keywords, such as `$ref`, as skipped.

```json
{
  "type": "object",
  "required": ["title", "date"],
  "properties": {
    "title": {"type": "string"},
    "date": {"type": "string", "format": "date"},
    "tags": {"type": "array", "items": {"type": "string"}}
  }
}
```

### Data

**load() data of the open page** shows the size, the keys and the 1000-character preview of what the page's `load()` returned. Click **Load the full value** to ask the page for the whole value, masked and up to 200 KB, as a tree you open key by key.

**TransferState payload** lists the entries of the page's payload: the `load()` route or server function each one belongs to, its size, and whether the browser **reused** it or **fetched again** (the duplicate `load()` and repeated server function findings). It needs the SSR & HTTP inspector on.

### Runtime

| Section               | What it shows                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `import.meta.env`     | The env Vite resolved for the app, or the `VITE_` and `ANALOG_` keys of the `.env` files without the Vite plugin.                    |
| Nitro `runtimeConfig` | The keys in `nitro.runtimeConfig` of `vite.config`, nested keys joined with dots. A `NITRO_` env override wins and names its source. |
| `analog()` options    | `ssr`, `static`, `apiPrefix`, `prerender.routes`, the number of route rules and the content schema.                                  |
| Nitro                 | Server plugins, tasks, storage mounts, the routes cached by `isr`, `swr` or `cache` rules, and the cache entries on disk.            |

Secret names, tokens and the names in `redaction.secretNames` are masked. Values `vite.config` computes show as **code**.

Click **Run** on a task, optionally give a JSON payload, then **Run task** to run it on the dev server through Nitro's task route, which needs `nitro.experimental.tasks`. The task's answer shows below it, masked, and the run stops waiting after 30 seconds.

Click **Purge** on a cache entry, or **Purge all**, then **Delete**, to delete cache entry files so the next request renders the route again. Running tasks and purging need `actions.analog`. Only `fs` cache storage is on disk: the tab looks in `.nitro/cache`, `node_modules/.nitro/cache`, `node_modules/.cache/nitro`, `dist/.nitro/cache`, `.data/cache` and the `base` of a `cache` mount with the `fs` or `fs-lite` driver.

### Lint

Checks grouped by rule, each with a fix. The count on the tab adds up errors and warnings and turns red when there is an error. Info findings, like a route outside the API prefix, are not counted. Hydration errors and restart hints come from the page the panel is open on. Each card lists where the rule fired and the detail for that spot, like the hydration error text, the failing request or both files of a duplicate URL:

- Two files for one URL, and sibling `[param]` files.
- Missing default exports, and layouts without `<router-outlet>`.
- `.server.ts` files without `load`, `action` or server functions, or without a page. A file that only exports server functions needs no page.
- Redirect mistakes.
- API method suffixes, duplicate API routes, and routes outside the API prefix.
- Prerender entries that match nothing.
- A `vite.config` the scan could not read in full (rule `config-partial`). See [Config the scan cannot read](#config-the-scan-cannot-read).
- Frontmatter errors, duplicate slugs, and content that shadows a page.
- Frontmatter that does not match the content schema (`content-schema`), and a schema file that can't be used (`content-schema-unreadable`).
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

### Which tab a call belongs to

The dev server ties each call to a tab from the best source it has:

| Source                   | Calls it covers                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `x-pangular-page` header | Browser `HttpClient` calls, such as `load()` fetches on navigation and server functions. With `providePangularHttp()` or `withPangular()`, a dev build sends the tab's page id on requests to its own origin only.                         |
| Render id                | Page renders, and the `load()` and server function requests a render makes over HTTP. The Vite plugin sends the render an id in `Server-Timing` (`pangular-analog`), and the page reports it. Needs a secure context, such as `localhost`. |
| `Referer`                | Other requests, such as form actions sent with `fetch()`, when exactly one open tab shows that path.                                                                                                                                       |

A call none of these covers stays untagged, and shows only with **All tabs (including untagged)** or in `analog-list-server-calls` without `page`. A tab's calls leave with the tab: when it closes or reloads, or 30 seconds after its last report or heartbeat.

### Supported layouts

- **Single app**: `package.json`, `vite.config.ts` and `src/app/pages` in one folder. The build output is read from `dist/analog/public`.
- **Nx workspace**: the app lives in `apps/<name>` and `package.json` sits at the workspace root. The scan uses the Vite root, or the first folder under `apps/` whose `vite.config` calls `analog()` when the tools run from the workspace root. The **Routes** tab, `scan-routes` and the **SSR** and **Analog** fields on the **Dashboard** read the same app, so they match this tab. `package.json` is looked up from the app folder upward, and the build output is read from `dist/apps/<name>/analog/public`.

### Render mode rules

The tab reads every `routeRules` entry in `vite.config`. A rule like `/blog/**` covers `/blog` and every page below it, and `*` matches one segment. When several rules match, the most specific one wins, as in Nitro. The first match in this table decides the mode:

| Mode        | When                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Redirect    | A rule has `redirect`.                                                                                     |
| Client only | A rule has `ssr: false`, or the `ssr` option is `false`.                                                   |
| Prerendered | The page is in the build output, a rule has `prerender: true`, or the page is in `prerender.routes`.       |
| Cached      | A rule has `isr`, `swr` or `cache`, or a `Cache-Control` header with a `max-age` or `s-maxage` above zero. |
| SSR         | None of the above.                                                                                         |

### Config the scan cannot read

The scan reads the `analog()` options as written in `vite.config`. It does not run the file. It reads `ssr`, `static`, `apiPrefix`, `prerender.routes` and `routeRules` only when they are literals.

If an option comes from a variable, a spread (`...`), a template string or a computed key, the scan can't know its value. In that case the **Render** view shows a note with the reasons. The lint reports `config-partial`, and `analog-explain-render-modes` and `analog-scan-prerender` add a **Config read in part** line. The modes and the plan may be missing what the scan could not read.

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

| Tool                                    | Inputs                                                               | What it does                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pangular:analog-scan-routes`           | `filter`                                                             | File routes in match order, with page, layout and server files.                                                    |
| `pangular:analog-scan-url`              | `url` (required)                                                     | Which files render a URL, or the closest candidates.                                                               |
| `pangular:analog-inspect-page`          | `page`, `data`                                                       | The open page: its files, `load()` data, rendering and hydration state. `data: true` adds the full `load()` value. |
| `pangular:analog-list-server-calls`     | `kind`, `route`, `limit`, `page`                                     | Recent server calls, with server function names and action outcomes.                                               |
| `pangular:analog-scan-api-routes`       |                                                                      | Server routes with method, URL and file, plus middleware.                                                          |
| `pangular:analog-scan-server-functions` |                                                                      | Server functions with name, method, file, id and call counts.                                                      |
| `pangular:analog-run-api`               | `path` (required), `method`, `body`, `confirm`, `headers`, `cookies` | Sends a real request to the dev server.                                                                            |
| `pangular:analog-explain-render-modes`  |                                                                      | The render mode of each page, and what the last request did.                                                       |
| `pangular:analog-scan-prerender`        |                                                                      | The prerender plan.                                                                                                |
| `pangular:analog-scan-content`          | `filter`                                                             | Markdown files with slug, frontmatter, route and parse errors.                                                     |
| `pangular:analog-lint`                  | `page`                                                               | The Analog checks.                                                                                                 |
| `pangular:analog-scan-build`            |                                                                      | The build analysis: chunk sizes per page and lazy chunks.                                                          |
| `pangular:analog-scan-nitro`            |                                                                      | Nitro plugins, tasks, storage mounts, cached routes and cache entries.                                             |
| `pangular:analog-run-nitro-task`        | `name` (required), `confirm` (required), `payload`                   | Runs a Nitro task on the dev server. Needs `actions.analog`.                                                       |
| `pangular:analog-purge-nitro-cache`     | `confirm` (required), `files`                                        | Deletes Nitro cache entry files. Needs `actions.analog`.                                                           |
| `pangular:analog-scan-runtime-config`   |                                                                      | `import.meta.env`, Nitro `runtimeConfig` and the `analog()` options, masked.                                       |
| `pangular:analog-inspect-transform`     | `file` (required), `ssr`                                             | The Vite transform stack of a page, layout or `.server.ts` file.                                                   |
| `pangular:analog-inspect-render-mode`   | `path` (required)                                                    | Requests a page and compares its headers with the configured mode.                                                 |

`analog-inspect-page` is the only tool that shows the `load()` data a page received. See [Tools](../agents/tools.md).

## Limits and gotchas

### `analog-run-api` changes real data

It sends a real request to your dev server. Methods other than GET, HEAD and OPTIONS need `confirm: true`. It works only through the Vite plugin. It only reaches API routes, `/_analog` URLs and pages, and refuses Vite file requests such as `/@fs/` or `?raw`. See [Call a server route](../agents/tools.md#call-a-server-route).

### Redaction

Response previews and `load()` data redact secret-looking keys, tokens, `Bearer` values and secret query parameters. Bodies over 16 KB are cut before the preview, and secret keys in the cut JSON are still redacted. Objects nested too deep to read are shown as `[Truncated]`. See [what the devtools redact](../security.md).

### Call history size

The server keeps the last 200 calls of all tabs, and the **Server** tab renders the newest 150 that match its filters. The server cuts previews to 1000 characters, and page renders have no preview.

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
