---
title: Build
description: The Vite dev server's module graph with its lazy boundaries and module timings, and the chunk sizes of the last production build.
---

<ngmd-hero title="Build" gradient>
  What the app loads: the modules Vite serves and the time each one costs, what each lazy route pulls in, and how big the production chunks are.
</ngmd-hero>

# Build

The Build tab answers what the app loads and how much of it. The **Module graph** comes from the Vite dev server that serves the app. **Chunks** come from the last production build on disk.

## What it shows

### Module graph

The modules the Vite dev server served, with their transformed size (unminified, and only for modules the browser requested), the time the dev server spent on each, how many modules import each one and how many it imports. The summary gives the total and the size that loads from the entries, such as `main.ts`, without `import()`.

**Lazy boundaries** lists each module loaded with `import()`, such as a route's `loadComponent`, with who imports it and the modules and size it pulls in that the entries don't already load. A boundary shows up once the browser loaded it, so visit a lazy route first. The module list starts with the 25 biggest; **Show all** lists every module, and the filter keeps modules whose file or URL contains the text. Click a column header (**Module**, **Size**, **Time**, **Importers** or **Imports**) to sort by it, ascending, then descending, then back to biggest first.

### Module timings

**Time** is how long the dev server spent on a module, in wall-clock milliseconds, through all of its plugins. Hover a time to see its parts:

| Part      | What it measures                                                                           |
| --------- | ------------------------------------------------------------------------------------------ |
| Resolve   | Every resolution of an import to this module, added up since the server started.           |
| Load      | The last time the module was read, from disk or from a plugin.                             |
| Transform | The last transform, every plugin's `transform` hook together, such as the Angular compile. |

Load and transform are the last run, so an edit that Vite transforms again replaces them. Sort by **Time**, descending, to find the modules that slow the dev server down. A module without a time, such as one dropped past the cap, sorts last.

### Chunks

The JavaScript and CSS files of the browser build, initial ones first: **Initial** for what `index.html` loads up front (a script, a module preload or a stylesheet), **Lazy** for the rest, with the size on disk and the gzip size. The summary adds them up. Build with `ng build --stats-json` and each chunk also shows its entry point, the source file it starts from, which names the route behind a lazy chunk.

The tab looks for the build in the `outputPath` of the first application in `angular.json` (its `browser` folder), then `dist/browser`, then `dist`. **Refresh** reads both again, for example after a rebuild.

## Where the data comes from

The [Vite plugin](../getting-started/vite.md) hands the server Vite's client module graph. Nothing is read until the tab or an agent asks, and reading it changes nothing in Vite. Without the Vite plugin, the module graph says so, and the chunks still work. Module URLs are masked like other URLs.

For the timings, the plugin wraps the `resolveId`, `load` and `transform` calls of the dev server's client plugin container when the server starts, and keeps the durations per module id. It only runs in the dev server, keeps at most 5,000 modules (the oldest go first), and stops when the server closes. `inspectors: {build: false}` turns it off with the tab.

## Agent tools

| Tool                    | What it does                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:module-graph` | The lazy boundaries, the biggest modules and the slowest modules with their resolve, load and transform times. `search` finds modules with their time, importers, imports and `import()` calls. |
| `pangular:chunk-sizes`  | The chunks of the last production build, initial or lazy, with sizes and entry points.                                                                                                          |

See [Tools](../agents/tools.md#build).

## Limits and gotchas

- Dev sizes are transformed, unminified code, so they are larger than production chunks. Use them to compare modules, and **Chunks** for real sizes.
- Times are wall clock. Vite resolves, loads and transforms many modules at once, so a module's time includes waiting for others, and the times add up to more than the startup took. Compare modules with each other rather than reading a time as CPU time.
- Timings need the Vite plugin. The `@pangular-inspector/devtools:dev-server` builder and the Express hub have no Vite module graph, so they show no timings.
- `inspectors: {build: false}` removes the tab and both tools.

## Where to next

- [Performance](./performance.md): how the loaded page performs in the browser.
- [Vite plugin](../getting-started/vite.md): set up the plugin the module graph needs.
