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

1. If the overlay connected, it uses that path. When the path is `<base>pangular/` and a hub answers at `<base>`, it opens the hub.
2. Otherwise it checks for the hub at `/__devframes/`, then for the devtools alone in the places the overlay looks: next to the page, `/__pangular/`, `/__devframes/pangular/` and `/__devframe/`.

A path counts only when it answers with JSON. If nothing answers, the panel says **No devtools server found** with a **Try again** button, and looks again the next time it opens.

### Create it yourself

Most apps never call the popup API. To add the button without the overlay, call `createDevtoolsPopup()`:

```ts
// src/main.ts
import {createDevtoolsPopup} from '@pangular-inspector/devtools/popup';

createDevtoolsPopup();
```

It adds the button and returns a handle with `toggle()` and `destroy()`. The panel finds the devtools server as described above. Importing the popup module in the browser also adds the button on its own, so calling it again returns the same handle.

To open a fixed page instead, pass `src`:

```ts
// src/main.ts
import {createDevtoolsPopup} from '@pangular-inspector/devtools/popup';

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
  --pangular-accent: #f5a524; /* button background */
  --pangular-accent-ink: #1c1300; /* button icon */
  --pangular-title: #f5a524; /* panel title and active dock mode */
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

| Action                    | How                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open the panel            | Click the button, or focus it and press <kbd>Enter</kbd> or <kbd>Space</kbd>; from the keyboard, focus moves into the panel                                                         |
| Open or close the panel   | Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> anywhere on the page, or the shortcut in [`popup.hotkey`](./configuration.md#popup). Closing gives focus back to where it was    |
| Run a command             | <kbd>Cmd</kbd>+<kbd>K</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> in the panel opens the [command palette](./command-palette.md)                                                          |
| Move between tabs         | Arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> in the tab bar, then <kbd>Enter</kbd> to open a tab                                                                                  |
| Move through a long list  | <kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>Home</kbd> and <kbd>End</kbd> in the SSR & HTTP timeline, the Store changes and events, and the Signals list. Each list is one <kbd>Tab</kbd> stop |
| Close the panel           | <kbd>Escape</kbd>, outside a search box with text                                                                                                                                   |
| Move the floating panel   | Drag its toolbar                                                                                                                                                                    |
| Reset the panel position  | Double-click its toolbar                                                                                                                                                            |
| Move the button           | Drag it, or focus it and use the arrow keys                                                                                                                                         |
| Move the button further   | Hold <kbd>Shift</kbd> with the arrow keys                                                                                                                                           |
| Reset the button position | Double-click it                                                                                                                                                                     |

In a search box that has text, <kbd>Escape</kbd> clears the box and leaves the panel open. Press it again to close the panel.

### Saved layout

The panel saves its position, size, dock mode and [passive mode](./settings.md#passive-mode) in `localStorage` under `pangular-popup`, so it keeps its layout across reloads. Clear that key to reset it.

### Passive mode

In passive mode the floating button stays hidden until you press the popup shortcut. Turn it on in [Settings](./settings.md#passive-mode).

### Theme

The panel follows the color scheme of the hub, which follows your system unless you pick light or dark in the hub. Without the hub, the panel follows your system. To keep the panel light or dark whatever the hub does, pick it in [Settings](./settings.md#theme). The popup frame around the panel switches with it and saves the last theme with the layout. It takes the theme only from the panel's own frame, so other frames on your page cannot change it.

## The hub

### Docks in the side rail

When the page's server mounts the hub (`/__devframes/`), the button opens the whole hub. The side rail holds every Pangular dock in one **Pangular** group. Pick the group to see its docks: **All tools** first, then one dock per tool. The group opens **All tools** the first time, then the dock you picked last.

| Dock           | Shows                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| All tools      | The full panel, with every tab in one tab bar (`/__devframes/pangular/`)                                                                     |
| Angular        | Dashboard, Components, Routes, Signals, Injectors, Forms, Pipes, and SSR & HTTP                                                              |
| NgRx           | The Store tab                                                                                                                                |
| Analog         | The Analog tab, or a notice in apps that do not use Analog                                                                                   |
| Angular Native | Components, Signals, Injectors and Store for a connected [Angular Native](./angular-native.md) app, or a setup notice when none is connected |
| NativeScript   | Setup steps for [NativeScript apps](../guides/nativescript.md)                                                                               |
| Capacitor      | Plugin calls of a connected [Capacitor app](../inspectors/capacitor.md), or setup steps when none is connected                               |

### The full panel

**All tools** opens the whole panel, the same as `/__devframes/pangular/`: the Dashboard and every tab in one tab bar, including the Store, Analog and Capacitor tabs. The rail keeps **All tools** when you turn inspectors off.

A single dock has an **Open full panel** link in its header. It opens the full panel in the same frame and selects **All tools** in the rail. From the NgRx, Analog and Capacitor docks it lands on the matching tab (`#tab=store`, `#tab=analog`, `#tab=capacitor`). From the Angular and Angular Native docks it lands on the tab you had open, and from a dock that shows setup steps it lands on the Dashboard. The link shows only on a single view (a URL with `?view=`), so the full panel, the Chrome extension and the popup without the hub don't have it. Outside the hub, it loads the full panel in place of the view.

### Docks with nothing to show

The Analog, Angular Native and Capacitor docks open setup steps when their tool has nothing to show. Their rail entry then says why in its tooltip:

| Dock           | Tooltip                            | Back to the plain name when          |
| -------------- | ---------------------------------- | ------------------------------------ |
| Analog         | `Analog: not an Analog app`        | The server restarts in an Analog app |
| Angular Native | `Angular Native: no app connected` | An Angular Native app reports        |
| Capacitor      | `Capacitor: no app connected`      | A Capacitor app reports              |

The tooltip comes back when the app stops reporting and its data expires. The Angular and NgRx docks always have data. The NativeScript dock always shows setup steps, because a NativeScript app's data shows in the Angular dock, so its tooltip stays **NativeScript**.

### Messages and badges

The hub keeps a list of messages, which the **Messages** dock lists and filters. Pangular Inspector posts to it when something happens in the app:

| Message                                      | Level | Category    | Posted when                                                                                              |
| -------------------------------------------- | ----- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `Agent ran <tool>`                           | info  | `agent`     | An [action tool](../agents/tools.md#action-tools) changes the app or the server, such as `set-http-rule` |
| The NG error, such as `NG01203: ...`         | error | `runtime`   | A page reports a forms setup error (`NG01xxx`)                                                           |
| `Navigation failed (NG04002): ...`           | error | `runtime`   | A page reports a failed navigation                                                                       |
| `Hydration mismatch at <app-cart>`           | error | `hydration` | A page reports a node that failed to hydrate, with the expected and actual node                          |
| The hydration message, such as `NG0505: ...` | warn  | `hydration` | A page logs an `NG05xx` hydration message                                                                |

Each message names the pages it came from (also as `page:<pageId>` labels) and has an **Open in Pangular** action that opens the dock that shows it. An error opens a toast the first time it shows up. When the same item comes back, from the same page after a reload or from another tab, the first message counts it (`(3 times)`) instead of posting it again. A call that only reads, like `change-detection` without `record`, posts nothing, and neither does a call that changed nothing: no page to act on, a refusal from the page or the config, or an argument to fix, such as `navigate` answering `No router state has been reported`. Text in messages is masked like the rest of the panel. An agent message shows the first line of the tool's answer that says what happened, past the untrusted-data notice, and the `page` argument, not the other arguments.

A dock shows how many items it has that you have not seen yet: NgRx writes on **NgRx**, Analog writes on **Analog**, and everything else on **Angular**. The **Pangular** group shows the total. The badge is red while one of them is an error or a warning. Opening a dock clears its count, and opening **All tools** clears every count. The tools sidebar of the open group shows the same counts, in the same colours. The count is also part of the dock name that screen readers and the tooltip use, for example `Angular (2 new, with errors)`. When the unseen items hold warnings, such as an NG05xx hydration message, but no error, the name ends in `with warnings` instead.

Messages follow the config. An inspector that is off posts nothing (forms errors need `inspectors.forms`, failed navigations `inspectors.router`, hydration messages `inspectors.http`), and an agent tool turned off with `agent.tools`, `agent.readOnly` or `actions` posts nothing either. See [Configuration](./configuration.md).

### Full-page viewer

The full-page viewer is at `/__devframes/` on the same server. The hub is built on [`@devframes/hub`](https://github.com/devframes/devframe), so other devframe tools can join the same rail.

### Without the hub

Without the hub (for example the standalone CLI, or a panel mounted with `initDevframe()`), every tab sits in one tab bar. The Store tab is a regular tab there.

## Deep links

### Tab hashes

The URL hash selects a tab. Open `/__devframes/pangular/#tab=signals` to land on the Signals tab. Switching tabs updates the hash, so you can copy the URL at any time.

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
| Errors     | `#tab=errors`     |
| Analog     | `#tab=analog`     |
| Capacitor  | `#tab=capacitor`  |
| Settings   | `#tab=settings`   |

### Link to an item

A link can also select an item on its tab, on one page: `#tab=<tab>&id=<id>&page=<pageId>`. Open `/__devframes/pangular/#tab=components&id=12&page=k3x9` to land on Components with that component instance selected.

| Tab        | `id` selects                                               |
| ---------- | ---------------------------------------------------------- |
| Components | A component instance, by its id in the component tree      |
| Injectors  | The element injector of a component, by the component's id |
| Forms      | A form, by its id                                          |

On other tabs, `id` is ignored and the link opens the tab. `page` is the page id from `list-pages`. Without it, the tab looks on the page it shows. If the item is not on the page, the tab says so. The [`open-in-panel`](../agents/tools.md#open-in-panel) agent tool builds these links and switches the panels that are open to them.

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

If the panel cannot reach the server when it opens, it says so and tries again after 1, 2, 5 and then every 10 seconds, so a dev server that starts slowly or restarts connects without a reload. Click **Retry now** to try at once.

### Tabs in the background

A browser tab in the background runs its timers about once a minute. The app page stops reading itself while its tab is hidden and tells the server, and the server keeps its last data instead of dropping it. The panel then says **Tab in background, showing the last data.** When you switch back, the page sends fresh data. If a hidden tab stops answering for 5 minutes, the server drops it.

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="The button is in the way" open>
    Drag it somewhere else, or focus it and use the arrow keys. Double-click it to reset its position. To remove it, stop the overlay with <a href="/getting-started/overlay#stop-the-overlay"><code>disposeOverlay</code></a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Reset the panel layout">
    Remove the <code>pangular-popup</code> key from <code>localStorage</code> and reload.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The button opens the panel, not the hub">
    The overlay did not find the hub at <code>/__devframes/</code>. Check that your server mounts <code>initPangularHub()</code> or the Vite plugin on the default base. On a custom base, pass <code>&lt;base&gt;pangular/</code> to <a href="./overlay.md#a-custom-mount-path"><code>initOverlay</code></a>.
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
