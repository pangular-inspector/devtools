---
title: Troubleshooting
description: Find the cause of a missing button, an empty tab, a refused request or a stuck connection by its symptom, in every setup.
---

<ngmd-hero title="Troubleshooting" gradient>
  Problems every setup shares, sorted by what you see. Each answer links to the page that covers it in full.
</ngmd-hero>

# Troubleshooting

Find what you see in the table, then read its section. Problems that only one setup has stay on that setup's page, in its **Troubleshooting** or **FAQ** section. The table at the end of this page lists the questions the inspector pages answer.

## Find your symptom

| What you see                                             | Read                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| No floating button on the page                           | [The button does not appear](#the-button-does-not-appear)                   |
| **No devtools server found** in the panel or the console | [No devtools server found](#no-devtools-server-found)                       |
| **Disconnected** or **Connecting…** in the panel header  | [The panel says Disconnected](#the-panel-says-disconnected)                 |
| A dialog that asks for a code                            | [The panel asks for a one-time code](#the-panel-asks-for-a-one-time-code)   |
| `403 Forbidden` from the devtools                        | [The devtools answer 403](#the-devtools-answer-403)                         |
| `401` from the MCP endpoint                              | [The MCP endpoint answers 401 or 403](#the-mcp-endpoint-answers-401-or-403) |
| The header shows **Live**, but the tabs are empty        | [The tabs stay empty](#the-tabs-stay-empty)                                 |
| A tab lists source files instead of the running app      | [A tab shows source data only](#a-tab-shows-source-data-only)               |
| **Page in background, showing the last data.**           | [The data stops changing](#the-data-stops-changing)                         |
| A tab or dock is missing                                 | [A tab is missing](#a-tab-is-missing)                                       |
| A tab or tool names an Angular version it needs          | [A feature needs a newer Angular](#a-feature-needs-a-newer-angular)         |
| The CLI prints another port than 9999                    | [Port 9999 is taken](#port-9999-is-taken)                                   |
| An app on a phone, simulator or emulator never shows     | [A device app never connects](#a-device-app-never-connects)                 |

## The button and the panel

### The button does not appear

The app is probably a production build. `ng build` uses the production configuration by default, and the overlay import in `main.ts` runs only while `ngDevMode` is on. Run `ng serve`, or build with `--configuration development`. Then check that `main.ts` imports the overlay, as [Load it in development](./overlay.md#load-it-in-development) shows.

With the [Vite plugin](./vite.md), `main.ts` needs no import: the plugin adds the overlay to the pages the dev server transforms. If your framework renders HTML without Vite's `transformIndexHtml`, [load the overlay yourself](./vite.md#load-the-overlay-yourself).

### No devtools server found

The overlay found no server part. It logs an error that starts with `[pangular] No devtools server found` and lists the paths it tried, and the panel says **No devtools server found**, with a **Troubleshooting** link to this section.

| Cause                                                               | Fix                                                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| No server part is mounted, for example plain `ng serve` without SSR | Mount `initPangularHub()` in `server.ts`, or run the [client-only setup](./installation.md#client-only-angular-cli-app). |
| The hub is mounted after `express.static` or the SSR handler        | Move `app.use(devtools.nodeMiddleware)` above them. See [Middleware order](./express.md#middleware-order).               |
| The hub runs on a custom `base`                                     | Pass `<base>pangular/` to [`initOverlay`](./overlay.md#a-custom-mount-path).                                             |

[No devtools server found](./overlay.md#no-devtools-server-found) on the overlay page lists the paths the overlay tries.

### The panel says Disconnected

The panel lost the server, or never reached it. It tries again after 1, 2, 5 and then every 10 seconds, so a dev server that restarts connects without a reload. Click **Retry now** to try at once. When the panel cannot reach the server at all, its message links here under **Troubleshooting**. If it stays disconnected, check that the server runs and that the hub is mounted before `express.static` and the SSR handler. See [Connection status](./popup-and-hub.md#connection-status).

If the panel does not connect at all with Hono, h3 or Fastify, the hub advertises a WebSocket that no upgrade reaches. Pass `ws: false`, pass `ws: {sidecar: true}`, or call `devtools.attach(server)`. See [Hono, h3 and Fastify](./other-servers.md#troubleshooting).

## Access and the one-time code

### The panel asks for a one-time code

The server has the one-time code on, which is the default for the Vite plugin, the Express hub and the CLI. Type the code the server printed in its terminal. A browser reads data only after it exchanges the code, so the tabs stay empty until you do.

If the dialog keeps coming back, the app's origin changed, its storage was cleared, or the code expired before you typed it. A code lasts 5 minutes. Type the newest code the server printed. Too many wrong codes lock the server until it restarts. See [One-time code](../security.md#one-time-code).

In a client-only Angular CLI app, start the CLI with `--proxy-origin`, so the link it prints opens on your app's origin. See [Client-only Angular CLI app](./installation.md#client-only-angular-cli-app).

### The devtools answer 403

The request did not come from this machine, was sent to a host the server doesn't trust, or came from an origin it doesn't trust. The terminal names a refused origin or host.

| Setup                   | Fix                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any                     | Open the app on `localhost` or `127.0.0.1`, not on a LAN address or another host name.                                                                                  |
| Vite plugin             | List a local host name in `server.allowedHosts`, or add the origin to `allowedOrigins`. See [Hostnames other than localhost](./vite.md#hostnames-other-than-localhost). |
| Express hub             | Add the origin to `allowedOrigins`. See [Access control](./express.md#access-control).                                                                                  |
| Another device on Wi-Fi | Pass `allowLan: true` and list the page's origin in `allowedOrigins`. Keep the one-time code on.                                                                        |
| Chrome extension        | A build with another extension ID needs its origin in `allowedOrigins`. See [Server origin](./chrome-extension.md#server-origin).                                       |

[Access and redaction](../security.md) covers every check.

### Every app route answers 404

This happens with Hono and h3: `devtools.handler` is mounted on a route that matches more than `devtools.base`. It answers 404 outside the base and doesn't fall through. Mount it on the base path only, as [Hono, h3 and Fastify](./other-servers.md#troubleshooting) shows.

## Empty or missing data

### The tabs stay empty

| Cause                                      | Fix                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| The one-time code was not exchanged        | Type the code from the terminal. The header shows **Live** once the panel is connected.                                         |
| The page is a production build             | Production builds leave out `window.ng`, which the overlay reads. Run a development build.                                      |
| No page with the overlay is open           | Open the app in a browser tab. The live tabs read the pages that report to the server.                                          |
| The tab reads another page than you expect | Pick the page in the tab's page picker, where it has one. Agents read the [default page](../agents/tools.md#the-page-argument). |

Some tabs need more than a connected page. The **SSR & HTTP** tab needs the providers in [Fill the SSR & HTTP tab](./express.md#fill-the-ssr-http-tab), and the [timeline](../inspectors/timeline.md) shows change detection only while a recording runs.

### A tab shows source data only

The **Components** and **Injectors** tabs fall back to what the source scan finds when no live tree reached them. No page is connected, or the connected page is a production build. Open the app in a development build with the overlay loaded. The [Dashboard](../inspectors/dashboard.md) fills its source cards from the scan without a page.

### The data stops changing

A browser tab in the background runs its timers about once a minute, so the page stops reading itself while it is hidden. The panel says **Page in background, showing the last data.** Switch back to the tab and it sends fresh data. The server drops a hidden tab that stops answering for 5 minutes. See [Tabs in the background](./popup-and-hub.md#tabs-in-the-background).

### A tab is missing

| Cause                                         | Fix                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The inspector is turned off with `inspectors` | Remove `false` for it. A tab you open while it is off names the option. See [Inspectors and agent tools](./configuration.md#inspectors-and-agent-tools). |
| You hid the tab in **Settings**               | Turn it back on under tab visibility. See [Settings](./settings.md).                                                                                     |
| The **Analog** tab outside an Analog app      | Without the hub, the tab appears only when `package.json` depends on `@analogjs/platform` or `@analogjs/router`.                                         |

### A feature needs a newer Angular

The overlay reads Angular's debug API, which grows with each release. A tab that needs a missing API names the Angular version it needs and the version the page runs, and agent tools answer **Unsupported on this Angular version**. [Supported Angular versions](./installation.md#supported-angular-versions) lists the minimum version of each feature.

## Servers and ports

### Port 9999 is taken

Without `--port`, the standalone CLI listens on 9999, or on a free port if 9999 is taken, and prints the port it uses. Use the URLs it prints. With `--port`, a taken port stops the server with an error. See [Dev server flags](./cli.md#dev-server-flags).

### The MCP endpoint answers 401 or 403

The HTTP endpoint needs a local `Origin` header, and a bearer token while the one-time code is on. A request without the header gets `403`, and one without the right token gets `401`. The token is in `~/.pangular-inspector/mcp-token`. See [Send an Origin header](../agents/mcp-server.md#send-an-origin-header) and [Send a token](../agents/mcp-server.md#send-a-token). The stdio server needs neither.

### vite build fails with an h3 error under pnpm

`@analogjs/vite-plugin-nitro` imports `h3` without declaring it, so pnpm can resolve the `h3` 2 this package brings instead of the `h3` 1 Analog needs. Declare it with `packageExtensions`, as [If the build fails under pnpm](./vite.md#if-the-build-fails-under-pnpm) shows.

## A device app never connects

An app on a phone, a simulator or an emulator reaches your machine over the network, and can't type the one-time code in every setup. Read the log of the app for a `[pangular]` line, then follow its setup page.

| Platform       | Read                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| NativeScript   | [Where the overlay connects](./nativescript.md#where-the-overlay-connects) and [Troubleshooting](./nativescript.md#troubleshooting)     |
| Angular Native | [Where the overlay connects](./angular-native.md#where-the-overlay-connects) and [Troubleshooting](./angular-native.md#troubleshooting) |
| Capacitor      | [Troubleshooting](../guides/capacitor.md#troubleshooting)                                                                               |

## Questions the inspector pages answer

| Question                                                        | Answer on                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| Why are the file and line of a component missing?               | [Components FAQ](../inspectors/components.md#faq)               |
| Why does the signal graph show another component?               | [Signals FAQ](../inspectors/signals.md#faq)                     |
| Why is a constructor-injected service missing from source mode? | [Injectors FAQ](../inspectors/injectors.md#faq)                 |
| Why can't I restore an NgRx entry?                              | [NgRx Store FAQ](../inspectors/ngrx-store.md#faq)               |
| Why does the Forms tab say no forms on this page?               | [Forms FAQ](../inspectors/forms.md#faq)                         |
| Why does a navigation list guards but no verdicts?              | [Router FAQ](../inspectors/router.md#faq)                       |
| Why does `explain-pipe` return no call data?                    | [Pipes FAQ](../inspectors/pipes.md#faq)                         |
| Why are there no SSR rows?                                      | [SSR & HTTP FAQ](../inspectors/ssr-http.md#faq)                 |
| Why is there no Analog tab?                                     | [Analog FAQ](../inspectors/analog.md#faq)                       |
| Why is the Capacitor call list empty on the web?                | [Capacitor FAQ](../inspectors/capacitor.md#faq)                 |
| Why does an error have no component?                            | [Errors FAQ](../inspectors/errors.md#faq)                       |
| Why is the timeline empty?                                      | [Timeline limits](../inspectors/timeline.md#limits-and-gotchas) |
| Why does the Chrome extension panel not appear?                 | [Chrome extension FAQ](./chrome-extension.md#faq)               |

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
  <ngmd-pill href="/community" title="Get involved"></ngmd-pill>
</ngmd-pill-row>
