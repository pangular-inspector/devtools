---
title: Build the extension
description: Build, load and package the Chrome DevTools extension.
---

<ngmd-hero title="Build the extension" logo="https://cdn.simpleicons.org/googlechrome/4285F4" gradient>
  A thin Manifest V3 shell around the devtools UI. Build it, load it unpacked, and zip it for the Chrome Web Store.
</ngmd-hero>

# Build the extension

The Chrome extension lives in `extension/`. It detects Angular pages, creates the panel, and loads the devtools UI from `extension/ui`.

## Files

```text
extension/
  manifest.json          # Manifest V3, loopback host permissions, optional access to other hosts
  background.js          # Tracks which tabs run Angular
  content-script.js      # Relays the detection result to the background worker
  detect-angular.js      # Runs in the page, looks for ng-version or window.ng
  devtools.html
  devtools.js            # Creates the panel on Angular pages
  panel.html             # The panel page and its status view
  panel-actions.js       # Answers the UI's reveal and open-source requests
  panel-bridge.js        # Asks for host access, finds the dev server, connects the UI to it
  icons/
  ui/                    # The built devtools UI (committed)
```

### What the manifest asks for

| Key                         | Value                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `permissions`               | Empty.                                                                                                       |
| `host_permissions`          | `*.localhost`, `127.0.0.1` and `[::1]`, over HTTP and HTTPS. `*.localhost` also matches `localhost`.         |
| `optional_host_permissions` | `http://*/*` and `https://*/*`. The panel requests one host at a time, only when you click **Allow access**. |
| `content_scripts`           | `content-script.js` and `detect-angular.js`, on every page.                                                  |
| `minimum_chrome_version`    | `111`.                                                                                                       |
| `key`                       | The public key that fixes the extension ID to `dcogniffeelebaolkkfbopmjcblhblfk`.                            |

### Extension ID

Chrome derives the ID of an extension from its public key. The `key` in `manifest.json` gives every build the ID `dcogniffeelebaolkkfbopmjcblhblfk`, whether you load it unpacked or install it from the store. The Vite plugin and the Express hub trust `chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk` by default, through `PANGULAR_EXTENSION_IDS` in `packages/devtools/src/extension-origin.ts`.

The maintainers keep the matching private key for the Chrome Web Store upload. It is not in the repository, and you never need it to build or load the extension. If you change the `key`, the ID changes too, and the server refuses the extension until its origin is in `allowedOrigins` or its ID is in `PANGULAR_EXTENSION_IDS`.

## Build

```bash
pnpm extension:build
```

This builds the devtools UI (`pnpm devtools:build`), then replaces `extension/ui` with a copy of `dist/devtools-ui`.

<ngmd-callout type="warning" title="Commit extension/ui">
  <code>extension/ui</code> is committed. If you change <code>app/</code>, run <code>pnpm extension:build</code> and commit the result. CI builds the extension and fails when <code>extension/ui</code> is stale.
</ngmd-callout>

## Load in Chrome

<ngmd-workflow>
  <ngmd-step title="Open the extensions page">
    Go to <code>chrome://extensions</code>.
  </ngmd-step>
  <ngmd-step title="Turn on Developer mode">
    Turn on the <strong>Developer mode</strong> toggle in the top right corner.
  </ngmd-step>
  <ngmd-step title="Load it unpacked">
    Click <strong>Load unpacked</strong> and select the <code>extension/</code> directory.
  </ngmd-step>
  <ngmd-step title="Open DevTools on an Angular app">
    Start a demo app and open DevTools. The <strong>Pangular Inspector</strong> panel appears once the extension detects Angular on the page.
  </ngmd-step>
</ngmd-workflow>

After a rebuild, click the reload icon on the extension card, then reopen DevTools.

## Package for the Chrome Web Store

```bash
pnpm extension:zip
```

This runs `extension:build`, then writes `dist/pangular-inspector-extension.zip`. The zip leaves out `.DS_Store` files and drops `key` from the manifest, because the Chrome Web Store refuses a manifest with a `key`.

For the first upload of a new store item, give the script the private key so the store keeps the ID `dcogniffeelebaolkkfbopmjcblhblfk`:

```bash
PANGULAR_EXTENSION_KEY=/path/to/pangular-inspector-extension-key.pem pnpm extension:zip
```

The key goes into the zip as `key.pem`, and the script stops if it doesn't match the `key` in the manifest. Later updates don't need it.

### Upload

1. Bump `version` in `extension/manifest.json`.
2. Go to the <a href="https://chrome.google.com/webstore/devconsole" target="_blank" rel="noopener noreferrer">Chrome Developer Dashboard</a>.
3. Click **New item** (or open the existing item) and upload the zip. For **New item**, build the zip with `PANGULAR_EXTENSION_KEY` set, as above.
4. Fill in the listing details and submit for review.

<ngmd-alert severity="helpful">
  The privacy policy for the listing is in <code>docs/privacy-policy.html</code>.
</ngmd-alert>

## How the panel connects

### Host access

`panel-bridge.js` reads the origin of the inspected page. If the page is not served over `http` or `https`, it stops and says so.

It then calls `chrome.permissions.contains()` for `<scheme>://<hostname>/*` of the page. Loopback hosts pass, since the manifest grants them. For any other host it shows the **Allow access** button. The button calls `chrome.permissions.request()` for that one pattern and, if Chrome grants it, starts over.

### Finding the server

With access granted, it looks for the devtools server under these paths, in order:

1. `/__pangular/`
2. `/__devframes/pangular/`
3. `/__devframe/`
4. `/`

Under each path it fetches `__devframe/__connection.json`, then `__connection.json`, with no credentials, no cache, no redirects and a 1.5 second timeout. The first response that is OK and parses as JSON wins.

It records the status of each request, or "no answer" when the request fails or times out. If none answers, the status view lists every URL it tried with its status and links to the setup section of the README. If any request got `401` or `403`, the status view says the server refused the request, shows up to 200 characters of the response text and links to the 403 notes on the Vite page instead. Both views have a **Try again** button that starts the search over.

### Waiting for the page id

The overlay sets `window.__pangularPageId` once it claims the page id, and removes it when it is disposed. After it finds the server, the panel evaluates that global every 250 milliseconds for up to five seconds. If the global never appears, it reads the `pangular-page-id` value from `sessionStorage` once, for overlays that do not set the global, and loads the UI with whatever it got.

### Loading the UI

The panel loads `ui/index.html` with three query parameters:

| Parameter | Value                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| `baseURL` | The path that served the connection file, on the origin of the page.                     |
| `pageId`  | The page id from [Waiting for the page id](#waiting-for-the-page-id), when there is one. |
| `theme`   | The DevTools theme name, `dark` or `default`.                                            |

Outside the extension, the UI accepts a `baseURL` only on its own origin. Inside the extension, it accepts any `http` or `https` URL. The panel only passes hosts the extension can reach.

On each navigation of the inspected page, the panel shows its status view again and repeats the whole search.

### Theme

The panel follows the DevTools theme. `panel-bridge.js` reads `chrome.devtools.panels.themeName` at startup, sets `data-theme` on `panel.html` so the status view matches, and passes the name to the UI as the `theme` parameter (`dark` or `default`, which is light). Its `setThemeChangeHandler` updates `panel.html` and posts a `pangular:theme-change` message to the UI frame when DevTools switches theme. `ThemeService` in the panel sets `data-theme` on `<html>`, and the CSS tokens in `app/src/styles/_theme.scss` follow it.

### Elements panel selection

The overlay defines `window.__pangularComponentOf` on the page. It takes an element and returns the id of the nearest component host, through shadow roots, or `null`.

When the Elements panel selection changes, `panel-bridge.js` evaluates it with `$0`. If it gets an id, it posts a `pangular:inspect-component` message to the UI frame. The UI accepts the message only from its parent window and its own origin, and only while the **Components** tab is open. The tab then expands the parent rows, clears the filter if needed, selects the row and scrolls it into view.

### Reveal and open source

The overlay also defines `window.__pangularHostOf(pageId, id)` and `window.__pangularClassOf(pageId, id)`. They return the host element or the component class of an instance id, and `null` when the id belongs to another page.

Inside the extension (a `chrome-extension:` frame), the **Components** detail header shows **Reveal in Elements** and **Open source**. The UI posts `pangular:reveal-element` or `pangular:open-source` with a `requestId`, the `pageId` and the instance `id` to its parent. `panel-bridge.js` accepts them only from the UI frame and its own origin, and `panel-actions.js` handles them:

| Request                   | What the extension does                                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:reveal-element` | Evaluates `inspect()` on the host element in the inspected page.                                                                                                                                                                                              |
| `pangular:open-source`    | Looks up the `file` among the scripts in `chrome.devtools.inspectedWindow.getResources()` by path suffix, skipping style sheets and calls `chrome.devtools.panels.openResource` at `line - 1`. If no resource matches, it evaluates `inspect()` on the class. |

It answers with `pangular:panel-action-result`, carrying the same `requestId` and `ok`. The UI gives up after 6 seconds.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/chrome-extension" title="Use the extension"></ngmd-pill>
  <ngmd-pill href="/contributing/publishing" title="Publishing"></ngmd-pill>
  <ngmd-pill href="/contributing/development" title="Development setup"></ngmd-pill>
</ngmd-pill-row>
