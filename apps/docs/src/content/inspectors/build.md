---
title: Build
description: The Vite dev server's module graph with its lazy boundaries, and the chunk sizes of the last production build.
---

<ngmd-hero title="Build" gradient>
  What the app loads: the modules Vite serves, what each lazy route pulls in, and how big the production chunks are.
</ngmd-hero>

# Build

The Build tab answers what the app loads and how much of it. The **Module graph** comes from the Vite dev server that serves the app. **Chunks** come from the last production build on disk.

## What it shows

### Module graph

The modules the Vite dev server served, with their transformed size (unminified, and only for modules the browser requested), how many modules import each one and how many it imports. The summary gives the total and the size that loads from the entries, such as `main.ts`, without `import()`.

**Lazy boundaries** lists each module loaded with `import()`, such as a route's `loadComponent`, with who imports it and the modules and size it pulls in that the entries don't already load. A boundary shows up once the browser loaded it, so visit a lazy route first. The module list starts with the 25 biggest; **Show all** lists every module, and the filter keeps modules whose file or URL contains the text.

### Chunks

The JavaScript and CSS files of the browser build, initial ones first: **Initial** for what `index.html` loads up front (a script, a module preload or a stylesheet), **Lazy** for the rest, with the size on disk and the gzip size. The summary adds them up. Build with `ng build --stats-json` and each chunk also shows its entry point, the source file it starts from, which names the route behind a lazy chunk.

The tab looks for the build in the `outputPath` of the first application in `angular.json` (its `browser` folder), then `dist/browser`, then `dist`. **Refresh** reads both again, for example after a rebuild.

## Where the data comes from

The [Vite plugin](../getting-started/vite.md) hands the server Vite's client module graph. Nothing is read until the tab or an agent asks, and reading it changes nothing in Vite. Without the Vite plugin, the module graph says so, and the chunks still work. Module URLs are masked like other URLs.

## Agent tools

| Tool                    | What it does                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pangular:module-graph` | The lazy boundaries and the biggest modules. `search` finds modules with their importers, imports and `import()` calls. |
| `pangular:chunk-sizes`  | The chunks of the last production build, initial or lazy, with sizes and entry points.                                  |

See [Tools](../agents/tools.md#build).

## Limits and gotchas

- Dev sizes are transformed, unminified code, so they are larger than production chunks. Use them to compare modules, and **Chunks** for real sizes.
- The module graph has no transform timings: Vite does not record them.
- `inspectors: {build: false}` removes the tab and both tools.

## Where to next

- [Performance](./performance.md): how the loaded page performs in the browser.
- [Vite plugin](../getting-started/vite.md): set up the plugin the module graph needs.
