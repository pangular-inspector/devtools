---
title: Introduction
description: What the devtools inspect, and the ways you can run them.
---

<ngmd-hero title="Angular DevTools" logo="/logo-mark.svg" gradient>
  Inspect components, signals, injectors, routes, forms, pipes, NgRx stores and HTTP calls. In the page, from the command line, or through a coding agent.
</ngmd-hero>

# Introduction

The devtools inspect a running *Angular app. They read components, signals, injectors, routes, forms, pipes, NgRx stores, HTTP calls and hydration. They also scan your source files, so they can answer questions before the app even runs.

The same tool runs in several places. It is built with *Devframe, so one definition powers every mode.

<ngmd-callout type="info" title="One package">
  Everything ships in <code>&#64;santoshyadavdev/ng-devtools</code>: the server side, the browser overlay, the in-page popup, the CLI and the built UI. See <a href="./installation.md">Installation</a>.
</ngmd-callout>

## What it inspects

### Live inspectors

These tabs read the running page through Angular's debug API. They need a development build.

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Components">
    Every component instance on the page, with live inputs, outputs, change detection, encapsulation, DOM listeners, host directives and injected services. Hover a row to highlight the element.
  </ngmd-card>
  <ngmd-card icon="zap" title="Signals" link="/inspectors/signals" cta="Signals">
    The live signal graph of one component (signal, computed, linkedSignal and effect nodes with their edges), plus a value history per signal.
  </ngmd-card>
  <ngmd-card icon="box" title="Injectors" link="/inspectors/injectors" cta="Injectors">
    The element and environment injector hierarchy, the lookup path for a token, and the providers at each level.
  </ngmd-card>
  <ngmd-card icon="compass" title="Router" link="/inspectors/router" cta="Router">
    The live route, every navigation as a full story, the live route config with URL testing, the router setup and a route lint.
  </ngmd-card>
  <ngmd-card icon="file" title="Forms" link="/inspectors/forms" cta="Forms">
    Every Signal Form, reactive form and template-driven form, with values, status, readable errors, a change timeline and a lint.
  </ngmd-card>
  <ngmd-card icon="wrench" title="Pipes" link="/inspectors/pipes" cta="Pipes">
    Custom and built-in pipes, where they are used, live instances, call recording, async subscriptions and a pipe lint.
  </ngmd-card>
  <ngmd-card icon="settings" title="NgRx Store" link="/inspectors/ngrx-store" cta="NgRx Store">
    Live <code>&#64;ngrx/signals</code> stores with a change log, diffs and state restore, plus the <code>&#64;ngrx/store</code> state and action log.
  </ngmd-card>
  <ngmd-card icon="search" title="SSR & HTTP" link="/inspectors/ssr-http" cta="SSR & HTTP">
    An HTTP timeline for SSR and client calls, fault injection, hydration stats and the TransferState payload.
  </ngmd-card>
</ngmd-card-grid>

### Project overview

| Tab                                     | What it shows                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| [Dashboard](../inspectors/dashboard.md) | The Angular and TypeScript versions, SSR status and a count for each inspector. |
| [Analog](../inspectors/analog.md)       | File routes, server calls, render modes, content and lint for *Analog apps.     |

### Source scan

The devtools also read your source files. Components, routes, signals, providers, NgRx declarations and pipes show up even with no page connected. The [standalone CLI](./cli.md) and the static report run on the source scan alone.

### Agent tools

The inspectors are exposed as *MCP tools and resources, so a coding agent can read and act on the running app. See [MCP server](../agents/mcp-server.md).

## Ways to run it

### Inside your app

Your app's server hosts the devtools, and a script in the page sends live data to it. A floating button on the page opens the panel next to your app.

| Setup                   | Server part                 | Guide                                     |
| ----------------------- | --------------------------- | ----------------------------------------- |
| Angular CLI with SSR    | `initNgDevtoolsHub()`       | [Angular CLI and Express](./express.md)   |
| Analog                  | The Vite plugin             | [Vite and Analog](./vite.md)              |
| Chrome DevTools (extra) | One of the two setups above | [Chrome extension](./chrome-extension.md) |

### Outside your app

| Mode           | What you get                                                     |
| -------------- | ---------------------------------------------------------------- |
| Standalone CLI | A local server that serves the devtools UI over the source scan. |
| Static report  | An offline HTML build of the source scan.                        |
| MCP server     | Every inspector exposed to coding agents over stdio.             |

All three come from the `ng-devtools` binary. See [Standalone CLI](./cli.md).

## Built on Devframe

The devtools are a <a href="https://devfra.me" target="_blank" rel="noopener noreferrer">Devframe</a> tool. Devframe lets one tool definition run in many places, so the inspectors, the RPC functions and the agent tools are written once.

### What Devframe provides

<ngmd-card-grid columns="2">
  <ngmd-card image="/logos/devframe.svg" title="One definition, every mode">
    The same definition serves the embedded panel, the standalone CLI, the static report, the MCP server and the Chrome extension.
  </ngmd-card>
  <ngmd-card icon="layers" title="The hub and dock">
    The hub comes from <code>&#64;devframes/hub</code>, so other Devframe tools can join the same dock next to the devtools.
  </ngmd-card>
  <ngmd-card icon="zap" title="RPC and shared state">
    The UI talks to the server over Devframe RPC, and live data sits in shared state that the UI and agents both read.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools from RPC functions">
    An RPC function marked for agents becomes an MCP tool, and shared state is exposed as MCP resources.
  </ngmd-card>
</ngmd-card-grid>

## Requirements

<ngmd-card-grid columns="3">
  <ngmd-card icon="code" title="Angular 20 or later">
    The package declares Angular 20 and later as its peer range.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Node.js 22 or later">
    The package runs on Node.js 22 and newer.
  </ngmd-card>
  <ngmd-card icon="rocket" title="A development build">
    Live data comes from <code>window.ng</code>, which production builds remove.
  </ngmd-card>
</ngmd-card-grid>

<ngmd-alert severity="important">
  The devtools read Angular's debug API. In a production build the overlay has nothing to read, so the live tabs stay empty. The source scan still works.
</ngmd-alert>

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need a browser extension?" open>
    No. The overlay adds a floating button to your page and opens the devtools in a panel. The <a href="./chrome-extension.md">Chrome extension</a> is optional. It adds the same UI as a panel in Chrome DevTools.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it work without SSR?">
    The devtools need a server part. An Angular CLI app mounts it in its Express <code>server.ts</code>. An Analog app gets it from the Vite plugin. Without either, the <a href="./cli.md">standalone CLI</a> serves the source scan.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it ship in my production bundle?">
    Not if you follow the setup guides. They load the overlay with a dynamic import that only runs in development builds.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Can other people on my network reach it?">
    By default, no. The Vite plugin only answers requests from your machine, and the Express hub asks for a one-time code. See <a href="../security.md">Access and redaction</a>.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="box" title="Install" link="/getting-started/installation" cta="Install the package">
    Add the package and pick how you want to run it.
  </ngmd-card>
  <ngmd-card icon="layers" title="Angular CLI and Express" link="/getting-started/express" cta="Set it up">
    Mount the devtools in the Express server of an SSR app.
  </ngmd-card>
  <ngmd-card icon="zap" title="Vite and Analog" link="/getting-started/vite" cta="Add the plugin">
    Add the Vite plugin next to <code>analog()</code>.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/mcp-server" cta="Connect an agent">
    Give your coding agent access to the inspectors.
  </ngmd-card>
</ngmd-card-grid>
