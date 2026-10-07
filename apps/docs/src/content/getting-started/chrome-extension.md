---
title: Chrome extension
description: Open the devtools as a panel inside Chrome DevTools.
---

<ngmd-hero title="Chrome extension" logo="https://cdn.simpleicons.org/googlechrome/4285F4" gradient>
  A Pangular Inspector panel inside Chrome DevTools. It loads the devtools UI and connects it to the dev server of the page you inspect.
</ngmd-hero>

# Chrome extension

The Chrome extension adds a panel named **Pangular Inspector** to Chrome DevTools. The panel loads the devtools UI and connects it to the dev server of the page you are inspecting.

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
    The <strong>Pangular Inspector</strong> panel appears next to the built-in panels.
  </ngmd-step>
</ngmd-workflow>

### Commands

```bash
git clone https://github.com/pangular-inspector/devtools.git
cd devtools
pnpm install
pnpm extension:build
```

[Build the extension](../contributing/chrome-extension.md) covers the build and the store package in detail.

## How it works

### Angular detection

A content script checks each page for Angular: an `ng-version` attribute or a `window.ng` global. It checks once, then retries for a few seconds for apps that bootstrap late. When DevTools opens, the extension also runs the same check in the inspected page, and again after each navigation. The extension creates the panel only on Angular pages.

### Finding the server

The panel looks for the devtools server on the origin of the inspected page. It tries these paths in order:

| Path                     | Mounted by                            |
| ------------------------ | ------------------------------------- |
| `/__pangular/`           | A panel mounted with `initDevframe()` |
| `/__devframes/pangular/` | The Express hub or the Vite plugin    |
| `/__devframe/`           | A bare devframe mount                 |
| `/`                      | A devframe served at the root         |

Under each path it asks for `__devframe/__connection.json`, then `__connection.json`. It connects the UI to the first path that answers with a connection file. Each request times out after 1.5 seconds.

If no path answers, the panel says "No devtools server answered" and lists every URL it tried, each with the HTTP status it got or "no answer". It links to the setup instructions.

If any URL got `401` or `403`, the panel says the server refused the request instead, and shows the start of the response text. The Vite plugin answers `403` to requests that do not come from your machine, for example when you open the app by its LAN IP. The panel then links to [Answers only your machine](./vite.md#answers-only-your-machine).

Both messages have a **Try again** button. Click it after you start or fix the server, and the panel looks for the server again without a page reload.

The panel only connects to pages served over `http` or `https`. On other pages it says so and stops.

### Other hosts

The extension can reach loopback hosts from the start. For any other host, such as a LAN IP or a tunnel, the panel shows an **Allow access** button instead of looking for the server. Click it and confirm the Chrome prompt. The panel then looks for the server again. See [Host access](#host-access) for what the button grants.

### The inspected tab

The overlay gives each page an id and exposes it on the page as `window.__pangularPageId`. The panel passes the id of the page it inspects to the UI. If several tabs run the same app, the panel shows the tab you inspect, not the one that reported last.

The overlay claims the id after it connects to the server, so it can come later than the server answers. The panel waits up to five seconds for the id. If no id appears in that time, it uses the id the tab kept from an earlier load, if there is one. Without any id, it loads the UI and shows the page that reported last.

### Navigation

When the inspected page navigates, the panel shows "Detecting Angular app…", looks for the server again and reconnects.

### Theme

The panel follows the DevTools theme. If you switch DevTools between light and dark (**Settings** > **Preferences** > **Theme**), the panel switches with it.

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

### Server origin

The panel sends requests from its own origin, `chrome-extension://<id>`. Any installed extension can send requests to a loopback host, so the Vite plugin and the Express hub trust only the extension IDs they know.

The `key` in `extension/manifest.json` fixes the ID of this extension to `dcogniffeelebaolkkfbopmjcblhblfk`, wherever you load it from. The Vite plugin and the Express hub trust `chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk` by default, so the panel works with no `allowedOrigins` setting. They refuse every other extension origin.

If you build the extension with another `key`, or without one, Chrome gives it another ID. Copy that ID from the extension card in `chrome://extensions` and add its origin to `allowedOrigins`:

```ts
// vite.config.ts
pangular({allowedOrigins: ['chrome-extension://<id>']});
```

```ts
// src/server.ts
const devtools = initPangularHub({
  allowedOrigins: ['chrome-extension://<id>'],
});
```

In the Vite plugin, an extension entry does not turn the one-time code on. If the server refuses a build with another ID, the panel names its own origin in the message. See [Access and redaction](../security.md#chrome-extension).

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
    None of them served a connection file. The status next to each URL shows what the server answered. Check that the server of the page mounts the devtools and that the server accepts the request, then click <strong>Try again</strong>. See <a href="../security.md">Access and redaction</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel says the server refused the request">
    The server answered <code>401</code> or <code>403</code>. If you built the extension with another ID, the server refuses its origin until you add it to <code>allowedOrigins</code>. On <code>403</code>, the message names the origin to add. See <a href="#server-origin">Server origin</a>. The Vite plugin also refuses requests that do not come from your machine. Open the app on <code>localhost</code>, or see <a href="./vite.md#answers-only-your-machine">Answers only your machine</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel shows another tab">
    The overlay on the inspected page did not report its page id within five seconds, so the panel loaded without it. Check that the overlay starts on that page, then close and reopen DevTools.
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
