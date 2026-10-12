---
title: Command palette
description: Open any tab and run the main panel actions from the keyboard with the command palette.
---

<ngmd-hero title="Command palette" gradient>
  Press Cmd+K or Ctrl+K in the panel to jump to a tab or run an action without the mouse.
</ngmd-hero>

# Command palette

The command palette lists a command for every tab and for the main actions of the panel. Type a few letters to filter it, then press <kbd>Enter</kbd>.

## Open it

| Where you are                                                                                                    | What <kbd>Cmd</kbd>+<kbd>K</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> opens                   |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| The panel in the [hub](./popup-and-hub.md#the-hub), in the popup or at `/__devframes/`                           | The hub's palette, which lists the Pangular commands next to the commands of other tools |
| The panel without the hub: the standalone CLI, `initDevframe()` or the [Chrome extension](./chrome-extension.md) | The panel's own palette                                                                  |

Use <kbd>Cmd</kbd> on macOS and <kbd>Ctrl</kbd> elsewhere. The palette button in the panel header opens it too.

## Commands

| Command                                                                       | What it does                                                                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Go to** a tab                                                               | Opens the tab. Hidden tabs are listed too. Tabs that are turned off or have nothing to show are not. |
| **Open settings**                                                             | Opens [Settings](./settings.md).                                                                     |
| **Pick component on page**                                                    | Opens **Components** and starts **Pick component on page**.                                          |
| **Start recording change detection**                                          | Opens **Components** and starts the change detection recording.                                      |
| **Stop recording change detection**                                           | Opens **Components** and stops the recording.                                                        |
| **Clear change detection recording**                                          | Opens **Components** and clears the recorded cycles.                                                 |
| **Theme: follow the system**, **Theme: light**, **Theme: dark**               | Sets the panel theme, like the [Settings](./settings.md#theme) page.                                 |
| **Popup: float**, **Popup: dock to the bottom**, **Popup: dock to the right** | Changes the [dock mode](./popup-and-hub.md#dock-modes). Only in the popup's own palette.             |
| **Popup: reset the docked size**                                              | Puts a [resized](./popup-and-hub.md#resize-a-docked-panel) bottom or right dock back to 40%.         |
| **Popup: open in its own window**                                             | Opens the panel in [its own window](./popup-and-hub.md#open-in-its-own-window) and closes it here.   |
| **Popup: back into the page**                                                 | Closes that window and opens the panel on the page again. Only in the window's palette.              |

The **Components** commands need the Components inspector on and a page connected. Without a live page the tab shows why, and the command does nothing.

## Filter and run

The filter matches the letters you type in order, anywhere in the title, so `gtsig` finds **Go to Signals**. Letters at the start of a word and letters next to each other rank higher. It also matches the group (**Go to**, **Actions**, **Theme**, **Popup**) and a few extra words, such as `profiler` for the recording commands.

| Key                                         | Action                                        |
| ------------------------------------------- | --------------------------------------------- |
| <kbd>↑</kbd> and <kbd>↓</kbd>               | Move through the list. It wraps at both ends. |
| <kbd>Page Up</kbd> and <kbd>Page Down</kbd> | Jump to the first or the last command.        |
| <kbd>Enter</kbd>                            | Run the highlighted command.                  |
| <kbd>Escape</kbd>                           | Close the palette without running anything.   |

The palette is a modal dialog. The filter box is a combobox that controls the list, and screen readers hear the highlighted command and how many commands match. When the palette closes, focus goes back to where it was, then the command runs.

## In the hub

In the hub, the Pangular commands are in the hub's command palette, in the **Pangular Inspector** category. **Pangular: open a tab** groups the tab commands. A **Go to** or **Components** command first opens the **All tools** dock, so the panel is on screen.

The server registers the commands through Devframe's command registry when the hub starts, and each one asks the open panels to run it. A panel in a background browser tab ignores it. If you have the hub open in two windows, both run the command. The **Popup** commands stay out of the hub's palette, because the hub has its own dock modes.

With the [terminals dock](./terminals.md) on, the hub's palette also has **Pangular: run &lt;command&gt;** and **Pangular: stop &lt;command&gt;** for the build and test commands, such as **Pangular: run pnpm run build**. The server runs these itself, so they work without a panel open. They are not in the panel's own palette.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/settings" title="Settings"></ngmd-pill>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
</ngmd-pill-row>
