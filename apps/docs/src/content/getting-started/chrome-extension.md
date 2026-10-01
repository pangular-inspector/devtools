---
title: Chrome extension
description: Open the devtools as a panel inside Chrome DevTools.
---

<ngmd-hero title="Chrome extension" logo="https://cdn.simpleicons.org/googlechrome/4285F4" gradient>
  An Angular DevTools panel inside Chrome DevTools. It loads the devtools UI and connects it to the dev server of the page you inspect.
</ngmd-hero>

# Chrome extension

The Chrome extension adds a panel named **Angular DevTools** to Chrome DevTools. The panel loads the devtools UI and connects it to the dev server of the page you are inspecting.

<ngmd-callout type="info" title="An extra, not a setup">
  The page still needs the devtools mounted on its server and the <a href="./overlay.md">overlay</a> loaded. The extension is one more way to open the devtools. It does not replace the setup. Start with <a href="./express.md">Angular CLI and Express</a> or <a href="./vite.md">Vite and Analog</a>.
</ngmd-callout>

## Before you start

<ngmd-card-grid columns="3">
  <ngmd-card icon="compass" title="Chrome 111 or later">
    The manifest sets <code>minimum_chrome_version</code> to 111.
  </ngmd-card>
  <ngmd-card icon="terminal" title="A clone of the repository">
    The extension lives in the <code>extension/</code> folder. You build it from source.
  </ngmd-card>
  <ngmd-card icon="box" title="Node.js 24 and pnpm">
    The repository itself needs Node.js 24 or later and pnpm 10 or later.
  </ngmd-card>
</ngmd-card-grid>

## Install

### Build and load it

<ngmd-workflow>
  <ngmd-step title="Install dependencies">
    Run <code>pnpm install</code> in the root of the repository.
  </ngmd-step>
  <ngmd-step title="Build the extension">
    Run <code>pnpm extension:build</code>. It builds the devtools UI and copies it into <code>extension/ui</code>.
  </ngmd-step>
  <ngmd-step title="Open the extensions page">
    Go to <code>chrome://extensions</code> and turn on <strong>Developer mode</strong>.
  </ngmd-step>
  <ngmd-step title="Load it unpacked">
    Click <strong>Load unpacked</strong> and select the <code>extension/</code> directory.
  </ngmd-step>
  <ngmd-step title="Open DevTools on an Angular app">
    The <strong>Angular DevTools</strong> panel appears next to the built-in panels.
  </ngmd-step>
</ngmd-workflow>

### Commands

```bash
git clone https://github.com/santoshyadavdev/angular-devtools.git
cd angular-devtools
pnpm install
pnpm extension:build
```

[Build the extension](../contributing/chrome-extension.md) covers the build and the store package in detail.

## How it works

### Angular detection

A content script checks each page for Angular: an `ng-version` attribute or a `window.ng` global. It checks once, then retries for a few seconds for apps that bootstrap late. When DevTools opens, the extension also runs the same check in the inspected page, and again after each navigation. The extension creates the panel only on Angular pages.

### Finding the server

The panel looks for the devtools server on the origin of the inspected page. It tries these paths in order:

| Path                        | Mounted by                            |
| --------------------------- | ------------------------------------- |
| `/__ng-devtools/`           | A panel mounted with `initDevframe()` |
| `/__devframes/ng-devtools/` | The Express hub or the Vite plugin    |
| `/__devframe/`              | A bare devframe mount                 |
| `/`                         | A devframe served at the root         |

Under each path it asks for `__devframe/__connection.json`, then `__connection.json`. It connects the UI to the first path that answers with a connection file. Each request times out after 1.5 seconds.

If no path answers, the panel says "No devtools server answered", lists every URL it tried and links to the setup instructions.

The panel only connects to pages served over `http` or `https`. On other pages it says so and stops.

### Other hosts

The extension can reach loopback hosts from the start. For any other host, such as a LAN IP or a tunnel, the panel shows an **Allow access** button instead of looking for the server. Click it and confirm the Chrome prompt. The panel then looks for the server again. See [Host access](#host-access) for what the button grants.

### The inspected tab

The overlay gives each page an id. The panel passes the id of the page it inspects to the UI. If several tabs run the same app, the panel shows the tab you inspect, not the one that reported last.

### Navigation

When the inspected page navigates, the panel shows "Detecting Angular app…", looks for the server again and reconnects.

### Elements panel

While the **Components** tab is open, select an element in the Chrome **Elements** panel. The Components tab selects the component that hosts that element (the element itself, or the nearest ancestor that is a component host). It expands the parent rows, clears the filter if it hides the row, and scrolls the row into view. On other tabs, the Elements selection does nothing. It also does nothing when `inspectors.components` is `false` in the [configuration](./configuration.md).

This needs the overlay on the page, since the overlay answers which component hosts the element.

## Permissions

### Host access

The manifest asks for no `permissions`. Its host permissions cover loopback hosts only, over HTTP and HTTPS:

| Host          | Covers                                                   |
| ------------- | -------------------------------------------------------- |
| `*.localhost` | `localhost` and every subdomain, such as `app.localhost` |
| `127.0.0.1`   | The IPv4 loopback address                                |
| `[::1]`       | The IPv6 loopback address                                |

Other hosts are optional host permissions. **Allow access** asks Chrome for the host of the inspected page only, on the scheme of that page (`http` or `https`) and on any port. The extension never asks for all hosts at once.

Granting the extension a host doesn't change what the devtools server accepts. The server still applies its own checks. The Vite plugin, for example, only answers requests from a loopback address. See [Access and redaction](../security.md).

The Vite plugin and the Express hub accept the extension's `chrome-extension://` origin by default. If your Express hub passes its own `allowedOrigins` list, add `chrome-extension://<id>` to it. The ID is on the extension card in `chrome://extensions`.

### Content scripts

The content scripts are wider. Two of them run on every page. They check for an `ng-version` attribute or `window.ng`, and pass the Angular version to the extension. They don't read or change anything else.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The panel does not appear" open>
    The page did not look like an Angular app within about five seconds of opening DevTools. Check that it renders an <code>ng-version</code> attribute or exposes <code>window.ng</code>, which development builds do. Then close and reopen DevTools, or reload the page.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel asks me to allow access">
    The page is not on a loopback host. Click <strong>Allow access</strong> to let the extension reach that host. Chrome asks you to confirm.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel lists the URLs it tried">
    None of them served a connection file. Check that the server of the page mounts the devtools and that the server accepts the request. See <a href="../security.md">Access and redaction</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Selecting an element does not select a component">
    Open the <strong>Components</strong> tab first, and check that the overlay is loaded. Elements outside any component select nothing.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does the floating button go away?">
    No. The overlay still adds the button to the page. Use the button or the panel, whichever you prefer.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="wrench" title="Build the extension" link="/contributing/chrome-extension" cta="Build and package">
    The build, the zip and the store package.
  </ngmd-card>
  <ngmd-card icon="shield" title="Access and redaction" link="/security" cta="Security">
    Which origins the devtools trust.
  </ngmd-card>
</ngmd-card-grid>
