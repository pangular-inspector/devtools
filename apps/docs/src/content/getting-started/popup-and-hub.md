---
title: Popup and hub
description: The floating button, the panel and its dock modes, the hub rail and deep links.
---

<ngmd-hero title="Popup and hub" gradient>
  A floating button on your page opens the devtools in a panel. With the hub mounted, the panel shows every tool in a side rail.
</ngmd-hero>

# Popup and hub

When the overlay loads, a floating button appears in the bottom-right corner of your page. Click it to open the devtools in a panel on top of your app. You don't need a browser extension.

## The floating button

### Where it comes from

Importing the [overlay](./overlay.md) adds the button. The first time the panel opens, it looks for the devtools server:

1. If the overlay connected, it uses that path. When the path is `<base>ng-devtools/` and a hub answers at `<base>`, it opens the hub.
2. Otherwise it checks for the hub at `/__devframes/`, then for the devtools alone at `/__ng-devtools/` and `/__devframes/ng-devtools/`.

A path counts only when it answers with JSON. If nothing answers, the panel says **No devtools server found** and looks again the next time it opens.

### Create it yourself

Most apps never call the popup API. To add the button without the overlay, call `createDevtoolsPopup()`:

```ts
// src/main.ts
import {createDevtoolsPopup} from '@santoshyadavdev/ng-devtools/popup';

createDevtoolsPopup();
```

It adds the button and returns a handle with `toggle()` and `destroy()`. The panel finds the devtools server as described above. Importing the popup module in the browser also adds the button on its own, so calling it again returns the same handle.

To open a fixed page instead, pass `src`:

```ts
// src/main.ts
import {createDevtoolsPopup} from '@santoshyadavdev/ng-devtools/popup';

createDevtoolsPopup({src: '/__my-devtools/'});
```

A `src` given to a later call replaces the one before. `showDevtools()` adds the button when it is missing, and `hideDevtools()` removes it.

<ngmd-alert severity="helpful">
  The popup alone sends no live data. Load the overlay for that.
</ngmd-alert>

### Match your app colors

The button reads CSS variables from your page. Set them on `:root` to match your app:

```css
/* src/styles.css */
:root {
  --ng-devtools-accent: #f5a524; /* button background */
  --ng-devtools-accent-ink: #1c1300; /* button icon */
  --ng-devtools-title: #f5a524; /* panel title and active dock mode */
}
```

The values above are the defaults.

## The panel

### Dock modes

<ngmd-card-grid columns="3">
  <ngmd-card icon="layers" title="Float">
    A free panel on top of your app. Drag it by the toolbar with a mouse, finger or pen, and resize it from the corner.
  </ngmd-card>
  <ngmd-card icon="box" title="Bottom">
    Full width, 40% of the viewport height. Resize it vertically.
  </ngmd-card>
  <ngmd-card icon="compass" title="Right">
    40% of the viewport width, full height. Resize it horizontally.
  </ngmd-card>
</ngmd-card-grid>

You can drag only the floating panel. Switch modes from the buttons in the panel toolbar. The floating panel always stays inside the window: when the window shrinks, the panel moves and shrinks to fit, and grows back to its saved size when there is room again.

The button and the panel sit in the browser top layer, like a `<dialog>`, a popover or a CDK overlay (MatDialog, MatMenu, MatSelect). When one of those opens, the button and the panel move back above it. A modal `<dialog>` makes the rest of the page inert, so they stay under it until it closes.

### Keyboard and mouse

| Action                    | How                                               |
| ------------------------- | ------------------------------------------------- |
| Close the panel           | <kbd>Escape</kbd>, outside a search box with text |
| Move the floating panel   | Drag its toolbar                                  |
| Reset the panel position  | Double-click its toolbar                          |
| Move the button           | Drag it, or focus it and use the arrow keys       |
| Move the button further   | Hold <kbd>Shift</kbd> with the arrow keys         |
| Reset the button position | Double-click it                                   |

In a search box that has text, <kbd>Escape</kbd> clears the box and leaves the panel open. Press it again to close the panel.

### Saved layout

The panel saves its position, size and dock mode in `localStorage` under `ng-devtools-popup`, so it keeps its layout across reloads. Clear that key to reset it.

## The hub

### Docks in the side rail

When the page's server mounts the hub (`/__devframes/`), the button opens the whole hub. A side rail shows one dock per tool:

| Dock           | Shows                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular        | Dashboard, Components, Routes, Signals, Injectors, Forms, Pipes, and SSR & HTTP                                                              |
| NgRx           | The Store tab                                                                                                                                |
| Analog         | The Analog tab, or a notice in apps that do not use Analog                                                                                   |
| Angular Native | Components, Signals, Injectors and Store for a connected [Angular Native](./angular-native.md) app, or a setup notice when none is connected |
| NativeScript   | A **Coming Soon** placeholder                                                                                                                |
| Capacitor      | A **Coming Soon** placeholder                                                                                                                |

### Full-page viewer

The full-page viewer is at `/__devframes/` on the same server. The hub is built on [`@devframes/hub`](https://github.com/devframes/devframe), so other devframe tools can join the same rail.

### Without the hub

Without the hub (for example the standalone CLI, or a panel mounted with `initDevframe()`), every tab sits in one tab bar. The Store tab is a regular tab there.

## Deep links

### Tab hashes

The URL hash selects a tab. Open `/__devframes/ng-devtools/#tab=signals` to land on the Signals tab. Switching tabs updates the hash, so you can copy the URL at any time.

| Tab        | Hash              |
| ---------- | ----------------- |
| Dashboard  | `#tab=dashboard`  |
| Components | `#tab=components` |
| Routes     | `#tab=routes`     |
| Signals    | `#tab=signals`    |
| Injectors  | `#tab=injectors`  |
| Store      | `#tab=store`      |
| Forms      | `#tab=forms`      |
| Pipes      | `#tab=pipes`      |
| SSR & HTTP | `#tab=network`    |
| Analog     | `#tab=analog`     |

### Last tab

Without a hash, the panel opens the tab you used last in this browser tab. The Chrome extension and the popup reload the panel on every navigation, and the panel keeps its tab across those reloads. It saves the tab in `sessionStorage`, so another browser tab starts on the Dashboard. A hash wins over the saved tab, and a tab that is turned off falls back to the Dashboard.

### Limits

A hash or a saved tab only works for a tab that exists when the panel opens. The Analog tab appears after the server confirms the app is an Analog app, so `#tab=analog` does not select it on load. Inside the Angular dock, the Store and Analog tabs live in their own docks.

## Connection status

The panel header shows the state of the connection:

| Label            | Meaning                                  |
| ---------------- | ---------------------------------------- |
| **Live**         | The panel is connected to the server.    |
| **Connecting…**  | The panel is trying to reach the server. |
| **Disconnected** | The server is gone.                      |

If the panel cannot reach the server, check that the dev server is running, then reload.

### Tabs in the background

A browser tab in the background runs its timers about once a minute. The app page stops reading itself while its tab is hidden and tells the server, and the server keeps its last data instead of dropping it. The panel then says **Tab in background, showing the last data.** When you switch back, the page sends fresh data. If a hidden tab stops answering for 5 minutes, the server drops it.

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="The button is in the way" open>
    Drag it somewhere else, or focus it and use the arrow keys. Double-click it to reset its position. To remove it, stop the overlay with <a href="/getting-started/overlay#stop-the-overlay"><code>disposeOverlay</code></a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Reset the panel layout">
    Remove the <code>ng-devtools-popup</code> key from <code>localStorage</code> and reload.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The button opens the panel, not the hub">
    The overlay did not find the hub at <code>/__devframes/</code>. Check that your server mounts <code>initNgDevtoolsHub()</code> or the Vite plugin on the default base. On a custom base, pass <code>&lt;base&gt;ng-devtools/</code> to <a href="./overlay.md#a-custom-mount-path"><code>initOverlay</code></a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel says No devtools server found">
    No devtools path answered with JSON. Mount the hub or the Vite plugin, before the SSR handler. See <a href="./overlay.md#no-devtools-server-found">No devtools server found</a>.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/getting-started/chrome-extension" title="Chrome extension"></ngmd-pill>
  <ngmd-pill href="/inspectors/dashboard" title="Dashboard"></ngmd-pill>
</ngmd-pill-row>
