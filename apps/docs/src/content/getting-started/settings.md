---
title: Settings
description: Pick the panel theme, hide, pin and reorder tabs, hide the popup button until you press its shortcut, and turn the browser agent tools on or off.
---

<ngmd-hero title="Settings" gradient>
  Your own preferences for the panel (theme, tab bar and the popup on your app's page), and the dev server's browser agent tools switch.
</ngmd-hero>

# Settings

Open **Settings** with the gear button in the panel header, or with **Open settings** in the [command palette](./command-palette.md). Press the gear button again to go back to the tab you had open. The page is also at `#tab=settings`.

<ngmd-image src="/images/panel/settings.png" alt="The Settings page with the Theme choices System, Light and Dark, and the Tabs list where each tab has a Pin button, a Shown checkbox and buttons to move it up or down"></ngmd-image>

## Where settings are saved

Settings belong to you, not to the project. The panel saves them in the browser's `localStorage`, so every panel on the same address uses them, and they survive reloads. The Chrome extension and the panel on your dev server have different addresses, so each keeps its own.

| Key                     | Holds                                        |
| ----------------------- | -------------------------------------------- |
| `pangular-pref:theme`   | `light` or `dark`. Missing means **System**. |
| `pangular-pref:tabs`    | The order, hidden tabs and pinned tabs.      |
| `pangular-pref:passive` | `true` when passive mode is on.              |

If the browser blocks storage, the settings apply until the panel reloads. Remove the keys to go back to the defaults.

[Browser agents](#browser-agents) is the exception. The dev server keeps it, not the browser, so it applies to every page and panel connected to that server.

## Theme

| Choice     | The panel                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| **System** | Follows the hub, the Chrome DevTools theme in the extension, or your system color scheme. This is the default. |
| **Light**  | Stays light.                                                                                                   |
| **Dark**   | Stays dark.                                                                                                    |

The popup frame on your app's page follows the panel's theme. The command palette has the same three choices.

## Tabs

The **Tabs** list shows every tab the panel can show, in tab bar order.

| Control            | What it does                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Pin**            | Moves the tab to the start of the tab bar, with the other pinned tabs. A pinned tab is always shown.                               |
| **Shown**          | Clear it to hide the tab from the tab bar. A hidden tab stays reachable from the command palette and from links. Hiding unpins it. |
| Up and down arrows | Move the tab one place. Pinned tabs move among the pinned ones, the others among the others.                                       |
| **Reset tabs**     | Back to the default order, with every tab shown and none pinned.                                                                   |

Each row works with the keyboard: <kbd>Tab</kbd> reaches its buttons, and <kbd>Alt</kbd>+<kbd>↑</kbd> or <kbd>Alt</kbd>+<kbd>↓</kbd> on any control in the row moves the tab. After a move, focus stays on the row and a screen reader hears the new position, such as **Signals moved to position 2 of 11.** Dragging is not needed.

The tab you have open stays in the tab bar while it is open, even when it is hidden. Turning an inspector off in the [configuration](./configuration.md) removes its tab whatever the settings say.

## Passive mode

Passive mode hides the floating button on your app's page until you press the popup shortcut, `Alt+Shift+P` unless [`popup.hotkey`](./configuration.md#popup) sets another one. The button shows while the panel is open and hides again when it closes.

The popup saves passive mode with its layout, under `pangular-popup` in your app's `localStorage`, so it stays on after a reload. Turn it on or off from the panel in the popup: the panel sends the change to the popup around it, and the button hides as soon as you close the panel. A panel opened elsewhere, such as the Chrome extension, saves the setting but has no popup to change.

With `popup.hotkey: false` there is no shortcut to bring the button back, so passive mode is off and the checkbox is disabled.

## Browser agents

The **Browser agent tools** switch registers the read-only agent tools on your app's page, so an agent that drives the browser finds them through WebMCP or Chrome DevTools for agents. See [Browser agents](../agents/browser-agents.md) for what is registered and how the tools answer.

| What                 | Behavior                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default              | Off, unless [`agent.browserTools`](./configuration.md#inspectors-and-agent-tools) is `true` in the devtools config.                                            |
| Turning it on or off | Every page connected to the dev server registers or unregisters the tools right away. No reload is needed.                                                     |
| How long it lasts    | Until the dev server restarts. Then `agent.browserTools` decides again. The hint under the switch says whether the config has it on or off.                    |
| Where it is kept     | On the dev server, not in `localStorage`. Every panel connected to the server shows the same value and follows a change made in another one.                   |
| When it is disabled  | While the panel connects, in a saved report from `pangular build`, and with a devtools server that has no switch. Then set `agent.browserTools` in the config. |

If the server refuses the change, an error with **Retry** shows under the switch.

<ngmd-callout type="warning" title="Any script on the page can call them">
  In-page agents and other scripts can list WebMCP tools and run them. Leave the switch off if your development page loads scripts you don't trust.
</ngmd-callout>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/command-palette" title="Command palette"></ngmd-pill>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/agents/browser-agents" title="Browser agents"></ngmd-pill>
</ngmd-pill-row>
