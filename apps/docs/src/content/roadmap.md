---
title: Roadmap
description: What Pangular Inspector covers today and the work still planned, each tracked in a GitHub issue.
---

<ngmd-hero title="Roadmap" gradient>
  What Pangular Inspector covers today, and the work still planned. Each planned item has a tracking issue.
</ngmd-hero>

# Roadmap

The work was planned in four phases, each with a GitHub issue that holds the full list of tasks. Phases 1, 2 and 4 are done, and phase 3 has a few items left. The tables on this page show the highlights.

Plans follow feedback. To ask for something, or to move an item up, comment on its issue or [open a feature request](https://github.com/pangular-inspector/devtools/issues).

## Available today

### Inspection and agents

| Feature                                   | Read more                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent tools over MCP for the live app     | [Tools](./agents/tools.md)                                                                                                                       |
| NgRx and SignalStore time travel          | [Restore an earlier state](./inspectors/ngrx-store.md#restore-an-earlier-state)                                                                  |
| Why a form is invalid, for you and agents | [Forms agent tools](./inspectors/forms.md#agent-tools)                                                                                           |
| Mobile apps                               | [Capacitor](./inspectors/capacitor.md), [NativeScript](./getting-started/nativescript.md), [Angular Native](./getting-started/angular-native.md) |

### Setup and workflow

Tracked in [#340](https://github.com/pangular-inspector/devtools/issues/340) (done).

| Feature                 | What it does                                                                                     | Read more                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Open in editor          | Alt+click a component on the page, or any file and line in the panel, to open it in your editor. | [Open a file in your editor](./inspectors/components.md#open-a-file-in-your-editor) |
| One-line Vite setup     | The Vite plugin adds the overlay to the page, so setup is one line in `vite.config.ts`.          | [Vite and Analog](./getting-started/vite.md)                                        |
| One-command agent setup | `pangular mcp --print-config` prints the MCP config for Claude Code and other agents.            | [Print the config](./agents/mcp-server.md#print-the-config)                         |
| Safe by default         | The hub stays off in production builds and checks every request by default.                      | [Security](./security.md)                                                           |

### Deeper inspection

Tracked in [#341](https://github.com/pangular-inspector/devtools/issues/341) (done).

| Feature                 | What it does                                                                                          | Read more                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Edit inputs and signals | Change inputs, properties and writable signals from the panel and from agents.                        | [Editing values](./inspectors/components.md#editing-values)       |
| Change detection flash  | Components flash on the page as change detection checks them.                                         | [Watch checks live](./inspectors/components.md#watch-checks-live) |
| Flame graph             | A flame graph and a per-cycle chart for change detection recordings, plus a Chrome Performance track. | [Change detection](./inspectors/components.md#change-detection)   |
| Hydration overlay       | Hydrated, skipped and mismatched regions marked on the page.                                          | [Hydration](./inspectors/components.md#hydration)                 |

### A shell you live in

Tracked in [#342](https://github.com/pangular-inspector/devtools/issues/342). The items below are done; the rest of the phase is under [Planned](#planned).

| Feature                 | What it does                                                                   | Read more                                               |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Command palette         | <kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd> opens any tab or action.                    | [Command palette](./getting-started/command-palette.md) |
| Settings                | Theme, tab order and visibility, and a passive mode for the popup.             | [Settings](./getting-started/settings.md)               |
| One timeline            | Router, HTTP, NgRx, change detection, forms and signals on one time axis.      | [Timeline](./inspectors/timeline.md)                    |
| NG0xxx errors explained | Runtime errors with their code, a docs link and the component that threw them. | [Errors](./inspectors/errors.md)                        |
| Terminals dock          | Runs the project's build and test commands next to the panel.                  | [Terminals](./getting-started/terminals.md)             |

### Deeper diagnosis

Tracked in [#343](https://github.com/pangular-inspector/devtools/issues/343) (done).

| Feature                     | What it does                                                                                                       | Read more                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| What triggered each check   | The event, signal, timer or request behind each run, wasted checks, OnPush hints and components that need zone.js. | [Why it ran and what it wasted](./inspectors/components.md#why-it-ran-and-what-it-wasted)                                                  |
| Leak detection              | Live subscriptions and effects per component, and components that stay alive after they are destroyed.             | [Leaks](./inspectors/components.md#leaks)                                                                                                  |
| Error explainers            | NG0100, hydration mismatches and missing providers explained, with the binding, the DOM diff or the lookup path.   | [Explainers](./inspectors/errors.md#explainers)                                                                                            |
| One audit entry point       | One list of findings across the inspectors, an axe pass, and before and after sessions.                            | [Audit](./inspectors/audit.md), [Inspect, fix and verify](./guides/inspect-fix-verify.md)                                                  |
| Tools for browser agents    | Read-only tools registered on the page through WebMCP, off by default.                                             | [Browser agents](./agents/browser-agents.md)                                                                                               |
| Agent skills                | Skills shipped in the package, installed with one command.                                                         | [Agent skills](./agents/skills.md)                                                                                                         |
| NgRx history and sessions   | Full state for every entry still in the log, export and import of a session, and generated tests.                  | [Session](./inspectors/ngrx-store.md#session)                                                                                              |
| Other stores and queries    | NGXS, Elf and MiniRx through their Redux DevTools integration, and a TanStack Query tab.                           | [Other stores](./inspectors/ngrx-store.md#other-stores), [TanStack Query](./inspectors/tanstack-query.md)                                  |
| Waterfall and SSR tracing   | A network waterfall, redacted headers, and SSR tracing for web-standard handlers such as Hono, h3 and Nitro.       | [HTTP timeline](./inspectors/ssr-http.md#http-timeline)                                                                                    |
| Provider values and startup | Peek at a created service's value, and see the time to stable and the slowest providers.                           | [Peek at a provider value](./inspectors/injectors.md#peek-at-a-provider-value), [Startup timing](./inspectors/injectors.md#startup-timing) |
| Plugin API                  | Libraries add their own tab and agent tools.                                                                       | [Write a plugin](./guides/write-a-plugin.md)                                                                                               |

## Planned

These items remain from phase 3, [#342](https://github.com/pangular-inspector/devtools/issues/342).

| Item             | What it does                                                                        | Issue                                                             |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ng add`         | One command sets up the overlay and the hub in an Angular CLI app.                  | [#342](https://github.com/pangular-inspector/devtools/issues/342) |
| Extension stores | The Chrome extension in the Chrome Web Store and Edge Add-ons, and a Firefox build. | [#342](https://github.com/pangular-inspector/devtools/issues/342) |
| Ionic support    | Ionic apps, on top of the Capacitor support.                                        | [#307](https://github.com/pangular-inspector/devtools/issues/307) |

## Fixes and improvements per inspector

Besides the phases, issues [#366](https://github.com/pangular-inspector/devtools/issues/366) through [#373](https://github.com/pangular-inspector/devtools/issues/373) track the open audit findings and proposed improvements for each inspector and the package. Pull requests for any of them are welcome. Start with [Development setup](./contributing/development.md).

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/community" title="Get involved"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
</ngmd-pill-row>
