---
title: Performance
description: Web vitals and long tasks of the running page, as the browser measured them, with the element and component behind each one.
---

<ngmd-hero title="Performance" gradient>
  How fast the running page feels: Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift and the tasks that blocked the main thread, tied to the components on the page.
</ngmd-hero>

# Performance

The Performance tab shows the web vitals the browser measured for the running page since it loaded, rated by the [web.dev](https://web.dev/articles/vitals) thresholds, and the long tasks that blocked the main thread. When a metric has an element behind it, the tab names the element and the component that owns it.

## What it shows

### Web vitals

One card per metric, with its value and rating (**Good**, **Needs improvement** or **Poor**):

| Metric                             | Good at or under | Poor over | Where it comes from                                                               |
| ---------------------------------- | ---------------- | --------- | --------------------------------------------------------------------------------- |
| **LCP**, Largest Contentful Paint  | 2.5 s            | 4 s       | The last `largest-contentful-paint` entry, with its element and component.        |
| **INP**, Interaction to Next Paint | 200 ms           | 500 ms    | The slowest interaction (98th percentile past 50), with its event and target.     |
| **CLS**, Cumulative Layout Shift   | 0.1              | 0.25      | The largest session window of `layout-shift` entries, without shifts after input. |
| **FCP**, First Contentful Paint    | 1.8 s            | 3 s       | The `first-contentful-paint` paint entry.                                         |
| **TTFB**, Time to First Byte       | 800 ms           | 1.8 s     | `responseStart` of the navigation entry.                                          |

A metric the browser doesn't measure says **Not measured by this browser**. LCP, INP and CLS need a Chromium-based browser. A metric it measures but has no entry for yet says **Not measured yet**, such as INP before the first click. When the element belongs to a component and the Components tab is on, **Show component** selects it there.

### Slowest interactions

The ten slowest interactions of 40 ms or more, slowest first: the event, such as `click` or `keydown`, its target and owning component, the duration and when it started. Each interaction counts once, by its slowest event.

### Long tasks

How many long tasks the page had and the total blocking time, the sum of each task's time over 50 ms, then the latest 20, newest first. Where the browser reports long animation frames, the tab uses those instead of long tasks and names the script that ran longest in each.

### Pages

When several tabs report, **Page** picks one. The panel of a tab starts on that tab.

## Where the data comes from

The overlay subscribes to the browser's `PerformanceObserver` with `buffered: true`, so entries from before it loaded count too. It only observes: nothing runs on a timer, and the observers are created outside the Angular zone, so an entry never makes the app tick. The report goes out with the overlay's regular pushes, only when it changed, and the server forgets the page when it closes or stops reporting. Element labels and URLs are masked like other live data.

## Agent tools

| Tool                  | What it does                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pangular:web-vitals` | Each metric with its value, rating, element and component, then the slowest interactions and the latest long tasks. |

See [Tools](../agents/tools.md#performance).

## Limits and gotchas

### Values are for this load

The values cover the page since it loaded. A client navigation keeps them; reload the page to measure a route on its own. Development builds are slower than production ones, so read the ratings as relative, and compare before and after a change.

### Turn it off

`inspectors: {performance: false}` removes the tab, the page collector and the tool. See [Configuration](../getting-started/configuration.md#inspectors-and-agent-tools).

## Where to next

- [Build](./build.md): the module graph and chunk sizes behind a slow load.
- [Timeline](./timeline.md): change detection, HTTP and router events on one time axis.
