---
title: Roadmap
description: What Pangular Inspector covers today and the planned work, in four phases, each tracked in a GitHub issue.
---

<ngmd-hero title="Roadmap" gradient>
  What Pangular Inspector covers today, and the planned work in the order it happens. Each phase has a tracking issue with the full checklist.
</ngmd-hero>

# Roadmap

The planned work is grouped into four phases. Each phase starts when the one before it is done, and each one has a GitHub issue with the full list of tasks. The tables on this page show the highlights.

Plans follow feedback. To ask for something, or to move an item up, comment on its issue or [open a feature request](https://github.com/pangular-inspector/devtools/issues).

## Available today

| Feature                                   | Read more                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent tools over MCP for the live app     | [Tools](./agents/tools.md)                                                                                                                       |
| NgRx and SignalStore time travel          | [Restore an earlier state](./inspectors/ngrx-store.md#restore-an-earlier-state)                                                                  |
| Why a form is invalid, for you and agents | [Forms agent tools](./inspectors/forms.md#agent-tools)                                                                                           |
| Mobile apps                               | [Capacitor](./inspectors/capacitor.md), [NativeScript](./getting-started/nativescript.md), [Angular Native](./getting-started/angular-native.md) |

## Phase 1: wired into your workflow

Tracked in [#340](https://github.com/pangular-inspector/devtools/issues/340).

| Item                    | What it does                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Open in editor          | Alt+click a component on the page, or any file and line in the panel, to open it in your editor. |
| One-line Vite setup     | The Vite plugin adds the overlay to the page, so setup is one line in `vite.config.ts`.          |
| One-command agent setup | One command prints the MCP config for Claude Code and other agents.                              |
| Safe by default         | The hub stays off in production builds and checks every request by default.                      |

## Phase 2: deeper inspection

Tracked in [#341](https://github.com/pangular-inspector/devtools/issues/341).

| Item                    | What it does                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Edit inputs and signals | Change inputs, properties and writable signals from the panel and from agents.                        |
| Change detection flash  | Components flash on the page as change detection checks them.                                         |
| Flame graph             | A flame graph and a per-cycle chart for change detection recordings, plus a Chrome Performance track. |
| Hydration overlay       | Hydrated, skipped and mismatched regions marked on the page.                                          |

## Phase 3: a shell you live in

Tracked in [#342](https://github.com/pangular-inspector/devtools/issues/342). Ionic support is tracked in [#307](https://github.com/pangular-inspector/devtools/issues/307).

| Item                    | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| Command palette         | <kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd> opens any tab or action.                    |
| NG0xxx errors explained | Runtime errors with their code, a docs link and the component that threw them. |
| `ng add`                | One command sets up the overlay and the hub in an Angular CLI app.             |
| Ionic support           | Ionic apps, on top of the Capacitor support.                                   |

## Phase 4: deeper diagnosis

Tracked in [#343](https://github.com/pangular-inspector/devtools/issues/343). Every item below is available. The phase stays open until a third-party library ships its own Pangular tab.

| Item                        | What it does                                                                                                       | Read more                                                                                                                                  |
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

## Fixes and improvements per inspector

Besides the phases, issues [#366](https://github.com/pangular-inspector/devtools/issues/366) through [#373](https://github.com/pangular-inspector/devtools/issues/373) track the open audit findings and proposed improvements for each inspector and the package. Pull requests for any of them are welcome. Start with [Development setup](./contributing/development.md).

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/community" title="Get involved"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
</ngmd-pill-row>
