---
title: Features
description: A tour of every tab in the panel and what to open it for, with screenshots of most tabs, plus what works outside the panel.
---

<ngmd-hero title="Features" gradient>
  Every tab in the panel, what it shows and when to open it. Each section links to the inspector page that covers it in full.
</ngmd-hero>

# Features

Each tab of the panel is an inspector. It reads your source files, your running app, or both. Agents read the same data through the [agent tools](../agents/tools.md). The screenshots come from the [demo apps](../contributing/demo-apps.md).

## App structure

### Dashboard

Get your bearings: the Angular and TypeScript versions, SSR, change detection mode and a count for each inspector, from the source scan and the live page. See [Dashboard](../inspectors/dashboard.md).

<ngmd-image src="/images/panel/dashboard.png" alt="The Dashboard tab for the demo app: a project block with chips for the Angular and TypeScript versions, SSR on and zoneless change detection, then one card per inspector with its count, and the Configuration block reading Defaults"></ngmd-image>

### Components

Find out what a component received and holds right now: its inputs, properties, outputs, injected services, defer blocks and `@for` blocks, with change detection recordings and leaks. See [Components](../inspectors/components.md).

<ngmd-image src="/images/panel/components.png" alt="The Components tab with the demo's ComponentsExample selected: the component tree with Hydrated chips and route chips on the left, and on the right the detail pane with its source file, change detection OnPush, the host path, the route and its signal properties with Edit buttons"></ngmd-image>

### Injectors

See why an injection resolved to the provider it did, or failed: the injector hierarchy, the lookup path of a token and the providers at each level. See [Injectors](../inspectors/injectors.md).

<ngmd-image src="/images/panel/injectors.png" alt="The Injectors tab on the Elements view with the demo's app-di-child element selected: the element injector tree on the left, and on the right its lookup path through the parent elements, Root, Platform and the Null injector, with the tokens injected there"></ngmd-image>

### Signals

Follow a value through its producers and consumers in the live signal graph of a component or injector, with resources and a value history per signal. See [Signals](../inspectors/signals.md).

<ngmd-image src="/images/panel/signals.png" alt="The Signals tab following the routed SignalsExample component: kind filters with counts, the graph of signals feeding computeds, a linkedSignal and an effect into the template, and a resource that resolved with four changes"></ngmd-image>

### Pipes

Check where custom, built-in and library pipes are used, how many instances are live, and record their calls. See [Pipes](../inspectors/pipes.md).

<ngmd-image src="/images/panel/pipes.png" alt="The Pipes tab listing the demo's custom pipes and the built-in pipes it uses, with chips for live instances, NgModule, pure and impure, and below them the async subscriptions with duplicate subscription warnings"></ngmd-image>

## State and data

### NgRx Store

Read NgRx signal stores and @ngrx/store state with their change logs and diffs, restore an earlier state and dispatch actions. NGXS, Elf and MiniRx stores show too. See [NgRx Store](../inspectors/ngrx-store.md).

<ngmd-image src="/images/panel/ngrx-store.png" alt="The Store tab with three live stores listed and the PackingStore signal store selected, showing its scope, its source file, the state as a tree of packing items, its methods with call counts, and the start of its change log"></ngmd-image>

### TanStack Query

See each query and mutation with its status, freshness, observers, error and data, then invalidate or refetch it. See [TanStack Query](../inspectors/tanstack-query.md).

### Forms

Find out why a form is invalid or did not submit: each field with its state and errors, a change timeline and a lint. See [Forms](../inspectors/forms.md).

<ngmd-image src="/images/panel/forms.png" alt="The Forms tab listing five forms from the demo, with a Signal Forms signup form selected: its invalid, pristine and untouched state, the error count, its WebMCP tool, the actions bar and the Fields view with each field's status and errors"></ngmd-image>

## Navigation and the network

### Router

Explain a navigation: the live route, each navigation with its guards and resolvers, the route config and a route lint. See [Router](../inspectors/router.md).

<ngmd-image src="/images/panel/router.png" alt="The Routes tab on the Current view after navigating to a user page: the URL and document title, the active routes with their components, params, static and resolved data and the resolver, and the outlets with Show in Components buttons"></ngmd-image>

### SSR & HTTP

Trace an HTTP call from the server render to the browser, inject faults, and read hydration stats and the TransferState payload. See [SSR & HTTP](../inspectors/ssr-http.md).

<ngmd-image src="/images/panel/ssr-http.png" alt="The SSR & HTTP tab with the server render of the HTTP example selected: the SSR requests table with status, render mode, render time and server calls, and the start of the details for that request"></ngmd-image>

### Timeline

Put navigations, HTTP calls, NgRx actions, change detection, form events and signal changes on one time axis to see what happened in what order. See [Timeline](../inspectors/timeline.md).

<ngmd-image src="/images/panel/timeline.png" alt="The Timeline tab after a few navigations, an HTTP call, NgRx actions and signal changes: layer buttons with their counts, the time axis with one lane per layer, the event list newest first, and an NgRx add action selected with an Open in Store button"></ngmd-image>

## Problems

### Errors

Read every error from the ErrorHandler, uncaught errors, unhandled rejections and the console, with the component that threw it, a docs link for NG0xxx codes and explainers for NG0100, hydration mismatches and missing providers. See [Errors](../inspectors/errors.md).

<ngmd-image src="/images/panel/errors.png" alt="The Errors tab with one error that reached the ErrorHandler twice, report service is down, with a Show component link to RoutesExample and its stack open, plus Errors and Console view buttons"></ngmd-image>

### Audit

Get one ranked list of what the inspectors found, an axe pass over the page, and a before and after comparison of a change. See [Audit](../inspectors/audit.md).

## Frameworks and platforms

### Analog

Map an Analog URL to its page, layout and server files, and list server calls, render modes, content and lint. See [Analog](../inspectors/analog.md).

<ngmd-image src="/images/panel/analog.png" alt="The Analog tab for the Analog demo: the summary strip with the Analog version and counts of pages, API routes, server calls and lint issues, a Test a URL box, and the Routes view mapping each route to its file under pages"></ngmd-image>

### Capacitor

Watch a Capacitor app's plugin calls and listeners, with the platform and the plugins its WebView reports. See [Capacitor](../inspectors/capacitor.md).

<ngmd-image src="/images/panel/capacitor.png" alt="The Capacitor tab for an Android app: the summary strip with calls, one failed and one slow call, the environment with the server URL and user agent, and the plugin calls list with a Camera.getPhoto call selected and its arguments shown" caption="Calls from a simulated Android bridge on the demo app."></ngmd-image>

## Outside the panel

| Feature               | What it does                                                                                | Read more                                     |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Agent tools over *MCP | The same data and actions for a coding agent, over HTTP or stdio.                           | [MCP server](../agents/mcp-server.md)         |
| Browser agents        | Read-only tools registered on the page through WebMCP, off by default.                      | [Browser agents](../agents/browser-agents.md) |
| Standalone CLI        | A local server, a static report, an MCP server and a lint export, without your app running. | [Standalone CLI](./cli.md)                    |
| Chrome extension      | The panel inside Chrome DevTools, following the **Elements** panel.                         | [Chrome extension](./chrome-extension.md)     |
| Command palette       | Any tab or action from the keyboard.                                                        | [Command palette](./command-palette.md)       |
| Plugins               | A library's own tab and agent tools.                                                        | [Write a plugin](../guides/write-a-plugin.md) |

## Which Angular version each feature needs

Most tabs work from Angular 12.2. Some features read debug APIs that later releases added, such as the live signal graph (20.1) and change detection recording (20.0). [Supported Angular versions](./installation.md#supported-angular-versions) lists the minimum version of each feature.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/quick-start" title="Quick start"></ngmd-pill>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
  <ngmd-pill href="/getting-started/keyboard-shortcuts" title="Keyboard shortcuts"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
