---
title: Keyboard shortcuts
description: Every keyboard shortcut of the popup, the panel, the command palette and the inspector tabs, on one page.
---

<ngmd-hero title="Keyboard shortcuts" gradient>
  The keys that open the popup and the command palette, and the keys each tab answers. Each table links to the page that describes it.
</ngmd-hero>

# Keyboard shortcuts

Use <kbd>Cmd</kbd> on macOS where a shortcut says <kbd>Ctrl</kbd>. Every control the shortcuts reach also has a button or a link, so the mouse and a screen reader get the same actions.

## On your app's page

| Keys                                         | What it does                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Opens or closes the popup anywhere on the page. [`popup.hotkey`](./configuration.md#popup) sets another shortcut, or `false` turns it off. |
| <kbd>Enter</kbd> or <kbd>Space</kbd>         | Opens the panel from the focused floating button, and moves focus into the panel.                                                          |
| Arrow keys on the floating button            | Move the button. Hold <kbd>Shift</kbd> to move it further.                                                                                 |
| <kbd>Alt</kbd>+click while picking           | Picks the component and also opens its file in your editor, in a development build. <kbd>Option</kbd>+click on macOS.                      |
| <kbd>Escape</kbd>                            | Stops picking a component or a form field, in the app or in the panel.                                                                     |

See [Keyboard and mouse](./popup-and-hub.md#keyboard-and-mouse) and [Pick a component on the page](../inspectors/components.md#pick-a-component-on-the-page).

## In the panel

| Keys                                                          | What it does                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>K</kbd>                                  | Opens the [command palette](./command-palette.md).                                                                                       |
| Arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> in the tab bar | Move between tabs. <kbd>Enter</kbd> opens one.                                                                                           |
| <kbd>Escape</kbd>                                             | Closes the panel. In a search box with text, it clears the box first.                                                                    |
| Arrow keys on the splitter                                    | Resize a docked panel by 16 pixels, or 64 with <kbd>Shift</kbd>. <kbd>Home</kbd> and <kbd>End</kbd> go to the smallest and largest size. |
| <kbd>Enter</kbd> on a file and line                           | Opens the file at that line in your editor, with a live devtools server.                                                                 |

See [Resize a docked panel](./popup-and-hub.md#resize-a-docked-panel).

## In the command palette

| Keys                                        | What it does                                  |
| ------------------------------------------- | --------------------------------------------- |
| <kbd>↑</kbd> and <kbd>↓</kbd>               | Move through the list. It wraps at both ends. |
| <kbd>Page Up</kbd> and <kbd>Page Down</kbd> | Jump to the first or the last command.        |
| <kbd>Enter</kbd>                            | Run the highlighted command.                  |
| <kbd>Escape</kbd>                           | Close the palette without running anything.   |

See [Filter and run](./command-palette.md#filter-and-run).

## In the tabs

Long lists are one <kbd>Tab</kbd> stop. Move inside them with the keys below.

| Where                                    | Keys                                                                                                                                                                                                        | Read more                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Components** tree                      | Arrow keys, <kbd>Home</kbd> and <kbd>End</kbd>. <kbd>→</kbd> expands a row or moves to its first child, <kbd>←</kbd> collapses it or moves to its parent. <kbd>*</kbd> expands every row at the same level. | [Keyboard](../inspectors/components.md#keyboard)                             |
| **Components** change detection chart    | Arrow keys move between cycles, <kbd>Shift</kbd> with an arrow extends the range, <kbd>Enter</kbd> picks one cycle and <kbd>Escape</kbd> shows all.                                                         | [Pick a range of cycles](../inspectors/components.md#pick-a-range-of-cycles) |
| **Signals** graph                        | Arrow keys move up and down a column, left to a producer and right to a consumer. <kbd>Home</kbd> and <kbd>End</kbd> go to the ends, <kbd>Enter</kbd> or <kbd>Space</kbd> selects.                          | [Graph](../inspectors/signals.md#graph)                                      |
| **Timeline** events                      | <kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>Home</kbd> and <kbd>End</kbd> move, <kbd>Enter</kbd> selects.                                                                                                              | [Keyboard](../inspectors/timeline.md#keyboard)                               |
| **SSR & HTTP** timeline, **Store** lists | <kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>Home</kbd> and <kbd>End</kbd> move through the rows.                                                                                                                       | [Keyboard and mouse](./popup-and-hub.md#keyboard-and-mouse)                  |
| **Capacitor** calls                      | Arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> move, <kbd>Enter</kbd> selects. The same keys move between the tabs of a call.                                                                               | [Plugin calls](../inspectors/capacitor.md#plugin-calls)                      |
| **Settings** tab list                    | <kbd>Alt</kbd>+<kbd>↑</kbd> or <kbd>Alt</kbd>+<kbd>↓</kbd> on a row moves the tab.                                                                                                                          | [Tabs](./settings.md#tabs)                                                   |
| Search and filter boxes                  | <kbd>Escape</kbd> clears the box.                                                                                                                                                                           | The page of each tab                                                         |

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/getting-started/command-palette" title="Command palette"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
</ngmd-pill-row>
