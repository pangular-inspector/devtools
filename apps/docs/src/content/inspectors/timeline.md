---
title: Timeline
description: Navigations, HTTP calls, NgRx actions, change detection cycles, form events and signal changes of the running page on one time axis.
---

<ngmd-hero title="Timeline" gradient>
  See what happened on the page in order, across the router, HTTP, NgRx, change detection, forms and signals, and jump to any event in its own tab.
</ngmd-hero>

# Timeline

The Timeline tab puts the events that other tabs already record on one time axis. Each source is a layer with its own lane. Turn layers on and off, pick a range, and open any event in the tab that shows it in full.

## What it shows

### Layers

| Layer            | Events                                                                     | Opens in                                       | Turned off with         |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| Router           | Navigations, with their outcome, trigger and duration                      | [Routes](./router.md)                          | `inspectors.router`     |
| HTTP             | Client and SSR HTTP calls, with their status, side and duration            | [SSR & HTTP](./ssr-http.md)                    | `inspectors.http`       |
| NgRx             | Store actions, signal store changes and events, with the store and changes | [Store](./ngrx-store.md)                       | `inspectors.ngrx`       |
| Change detection | Recorded change detection cycles, with their time, checks and trigger      | [Components](./components.md#change-detection) | `inspectors.components` |
| Forms            | Form events such as value, status, submit and reset, with their origin     | [Forms](./forms.md), with the form selected    | `inspectors.forms`      |
| Signals          | Value changes of the signals in the graph the Signals tab shows            | [Signals](./signals.md#value-history)          | `inspectors.signals`    |

A layer button shows how many events of that layer are in the range. Press it to hide or show the layer. The panel remembers the hidden layers in `localStorage` under `pangular-timeline-hidden-layers`. A layer whose inspector is off in the [configuration](../getting-started/configuration.md) is not listed.

Failed navigations and HTTP calls that fail or answer 500 or more are marked as errors. Cancelled or redirected navigations, HTTP answers from 400, fault rules and change detection cycles over 16 ms are marked as warnings.

### Time axis

The chart has one lane per layer that is shown. It groups events that fall close together into one mark, so a few thousand events still draw quickly. A mark is darker when it holds more events, and it takes the colour of the worst event in it.

### Events

The **Events** list holds the same events as the chart, newest first, with their time to the millisecond, layer, name and detail. It renders the newest 200 events in the range and says how many it left out. Zoom in or filter to see older ones.

Select an event to see it under **Selected event**. **Open in** opens it in its own tab through a [deep link](../getting-started/popup-and-hub.md#deep-links). A form event selects its form on the Forms tab. Other events open their tab on the same page.

## Use it

### Pick a range

| Action                   | How                                                                         |
| ------------------------ | --------------------------------------------------------------------------- |
| Look at a range          | Drag across the chart                                                       |
| Zoom in or out           | **Zoom in** halves the range around its middle, **Zoom out** doubles it     |
| Move the range           | **Earlier** and **Later** move it by half its width                         |
| Go back to every event   | **Show all**                                                                |
| Select the nearest event | Click a lane on the chart                                                   |
| Filter by name or detail | Type in the search box. <kbd>Escape</kbd> clears it                         |
| Look at one page         | Pick it in **Page**, or **All pages**. The panel of a tab starts on its tab |

Without a range, the chart grows with each event that arrives.

### Keyboard

The **Events** list is one <kbd>Tab</kbd> stop. <kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>Home</kbd> and <kbd>End</kbd> move through it, and <kbd>Enter</kbd> selects an event. Every chart action has a button, and screen readers get a summary of the chart with the count of each layer. The list is the text version of the chart.

## Where the data comes from

The tab reads the shared state the other tabs read: `router`, `http`, `ngrx-store`, `change-detection`, `forms` and `signal-graph`. It adds no collection of its own, so each layer holds what its tab keeps:

| Layer            | What it needs                                                                                                           | Limit                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Router           | The app's router                                                                                                        | `limits.navigations`  |
| HTTP             | [HTTP setup](../getting-started/express.md) for SSR calls                                                               | `limits.httpCalls`    |
| NgRx             | NgRx in the app                                                                                                         | `limits.changeLog`    |
| Change detection | A recording, started with **Record** on the [Components](./components.md#change-detection) tab or the palette           | `limits.cdCycles`     |
| Forms            | Forms in the app                                                                                                        | `limits.formTimeline` |
| Signals          | The component whose graph the [Signals](./signals.md) tab shows. A signal without a `debugName` has sampled values only | 50 changes per signal |

Raise the limits in the [configuration](../getting-started/configuration.md#limits) to keep more. Times come from the page's clock, and SSR HTTP calls from the server's clock.

## Limits and gotchas

<ngmd-accordion>
  <ngmd-accordion-item title="The timeline is empty" open>
    Use the app with the overlay loaded. Navigations, HTTP calls, NgRx actions and form events show up as they happen. Change detection needs a recording, and signals need a component picked on the Signals tab.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="An SSR call shows only under All pages">
    A server call belongs to a page when the SSR request that rendered the page made it. Other server calls have no page.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Events from before the overlay connected are missing">
    Each layer starts when its collector starts. Navigations that started before the overlay connected have no real start time, so they are not on the axis. The Routes tab still lists them.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/router" title="Router"></ngmd-pill>
  <ngmd-pill href="/inspectors/ssr-http" title="SSR & HTTP"></ngmd-pill>
  <ngmd-pill href="/getting-started/command-palette" title="Command palette"></ngmd-pill>
</ngmd-pill-row>
