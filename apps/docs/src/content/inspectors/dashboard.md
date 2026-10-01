---
title: Dashboard
description: Project metadata and a count for each inspector.
---

<ngmd-hero title="Dashboard" gradient>
  The first tab. It shows what the project is built with and how much each inspector found.
</ngmd-hero>

# Dashboard

The Dashboard opens by default. The top block describes your workspace. The cards below count what each inspector found, and each card opens its tab.

## What it shows

### Project block

The top block shows the project name and a chip for each of these:

| Chip                 | Shows                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Angular**          | The installed Angular version.                                                                                                                        |
| **TypeScript**       | The installed TypeScript version.                                                                                                                     |
| **SSR**              | **On** or **Off**.                                                                                                                                    |
| **Analog**           | The Analog version. Shown in Analog apps only.                                                                                                        |
| **Change detection** | **Zoneless**, **zone.js**, or **Zoneless, zone.js loaded** when the app is zoneless but still loads zone.js. Shown once a page reports its injectors. |

### Inspector cards

Each card counts what one inspector found. Click a card to open its tab. When the hub is mounted, the NgRx card opens the **NgRx** dock.

| Card                                 | Counts                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| [Components](./components.md)        | Components in source, plus the number of directives.                                                         |
| [Routes](./router.md)                | Navigable page paths in source, plus the number of redirects.                                                |
| [Signals](./signals.md)              | Nodes in the live signal graph, plus the declarations in source. Without a page, the declarations in source. |
| [Injectors](./injectors.md)          | Live injectors on the page, plus their providers. Without a page, the provider declarations in source.       |
| [NgRx declarations](./ngrx-store.md) | NgRx declarations in source, broken down by kind.                                                            |
| [Pipes](./pipes.md)                  | Custom pipes in source, plus the built-in pipes in use.                                                      |

Cards of inspectors turned off in the [configuration](../getting-started/configuration.md) are hidden.

### Card states

A card shows **Counting…** while it loads. It shows **Count unavailable** when the tab can't read its data.

### Configuration block

Below the cards, the **Configuration** block lists the devtools options that differ from the defaults, such as **Inspectors off**, **Blocked actions** and **Limits**. It says **Defaults** when nothing is changed. Until the panel connects, the block says **Loading…**, the stat cards stay hidden and the tab strip shows only **Dashboard** and the open tab, since the panel doesn't know yet which inspectors are on. See [Configuration](../getting-started/configuration.md#check-the-active-configuration).

## Where the data comes from

Most of the Dashboard reads your workspace, not the running page. It works before the app loads in a browser.

### Versions and project name

The server reads versions from the installed packages in `node_modules`. When a package is not installed, it falls back to the range in `package.json`.

The project name comes from `angular.json`. The devtools pick `defaultProject` when it is set, then the project whose `root` is the workspace folder, then the first `application` project. In an Nx workspace without `angular.json`, the name comes from `project.json`. When neither file names a project, it comes from `package.json`.

### SSR status

SSR is **On** when the build options of that project set `ssr` or `server`, or when it has a `server` target (Angular Universal). The devtools read `architect` in `angular.json` and `targets` in `project.json`. For *Analog apps, SSR follows the `ssr` option of `analog()`.

### Change detection mode

The **Change detection** chip reads the running page, not the workspace. The page checks the `NgZone` its root injector created: Angular provides a no-op zone for zoneless apps and a real one with `provideZoneChangeDetection`. It also checks whether `Zone` is defined on the page. The chip comes from the [Injectors](./injectors.md) inspector, so it is hidden when that inspector is off. See [Zoneless](https://angular.dev/guide/zoneless) on angular.dev.

### Counts

The Components, Routes, NgRx and Pipes cards count the source scan. The Signals and Injectors cards use the live page when one is connected, and the source scan otherwise. Opened from the popup or the Chrome extension, they count the page the Dashboard belongs to, like the Signals and Injectors tabs. Opened on its own, they count the page that reported last. The live Signals count covers the graph of the one component the [Signals tab](./signals.md) shows, and counts its signals, computeds, linked signals and effects.

## How to use it

<ngmd-workflow>
  <ngmd-step title="Check the versions">
    Confirm the Angular and TypeScript chips match what you expect. A mismatch usually means a stale install.
  </ngmd-step>
  <ngmd-step title="Open the app in a browser">
    The Signals and Injectors cards switch to live counts once a page connects.
  </ngmd-step>
  <ngmd-step title="Jump to an inspector">
    Click the card for the area you want to look at. It opens that tab.
  </ngmd-step>
</ngmd-workflow>

## Agent tools

| Tool                     | What it returns                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `ng-devtools:build-meta` | Angular and TypeScript versions, the project name, SSR status and, in Analog apps, the Analog version. |

[Static reports](../getting-started/cli.md) include the same data. See [Tools](../agents/tools.md) for every tool.

## Limits and gotchas

If the project block says **Project details unavailable**, check that the dev server is running, then reload the panel.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do the cards need the app open in a browser?">
    No. The source-based cards fill in from the workspace scan. Only the Signals and Injectors cards change when a page connects.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    Every component instance on the page, with live inputs and outputs.
  </ngmd-card>
  <ngmd-card icon="compass" title="Router" link="/inspectors/router" cta="Open">
    The live route, every navigation, and a route lint.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Standalone CLI" link="/getting-started/cli" cta="Run">
    Serve the devtools or build a static report.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
</ngmd-card-grid>
