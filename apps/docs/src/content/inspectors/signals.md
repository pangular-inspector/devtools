---
title: Signals
description: The live signal graph of one component, with a value history per signal.
---

<ngmd-hero title="Signals" gradient>
  The live signal graph of one component: its signals, computeds, linked signals and effects, the edges between them, and a value history per signal.
</ngmd-hero>

# Signals

The Signals tab shows the reactive graph of one component at a time. Only signals that a template or an effect has read appear. A signal nothing has read yet is not part of the graph. Without a live page, the tab lists the signal declarations in your source.

## What it shows

### Component picker

The **Component** picker at the top selects whose graph you see. It appears when a live component tree exists.

- **Follow the routed component** is the default. It shows the deepest component rendered by a primary `<router-outlet>`.
- Pick any live component to pin the graph to it. The picker numbers duplicates, for example `#2`.
- Without a routed component, the tab shows the first component that has signals, among the first 50 on the page.

A line under the picker names the component, its host path, and why it was chosen: **picked**, **rendered by the router** or **first component with signals**.

### Node cards

Filter by name, or by kind with the chips. Each card shows:

- Its kind and label. Kinds come from Angular, such as `signal`, `computed`, `linkedSignal`, `effect` and `template`. Nodes without a name show **(unnamed)**.
- The current value.
- The epoch, and the number of dependencies and consumers.
- A **N changes** badge once the value has changed.

### Node details

Expand a card to see:

- **Dependencies (producers)**: the nodes it reads.
- **Consumers**: the nodes and effects that read it.
- **Value history**: recent values, newest first, each with a time and a source tag.

### Value history

| Tag         | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| **set**     | A write set the value. This entry is exact.            |
| **sampled** | The overlay saw a changed value when it read the page. |
| **initial** | The first value the overlay saw.                       |

When values change faster than the overlay reads the page, an entry says how many earlier values were not captured. Only `signal`, `computed` and `linkedSignal` nodes have a history.

### Source mode

Without a live graph, the tab lists `signal()`, `computed()`, `linkedSignal()`, `effect()`, `toSignal()` and resource declarations found in your files. It also lists signal inputs, models and queries. Each card shows the file and line, and the component when the scan finds one.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay reads the graph of the chosen component after change detection and pushes it when it changes.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server scans your files for signal declarations.
  </ngmd-card>
</ngmd-card-grid>

### Debug APIs

The live graph reads `ng.ɵgetSignalGraph` with the component's injector, from `ng.getInjector` and `ng.getComponent`. It needs a development build. The empty state asks for Angular 19 or later.

### Exact and sampled values

Exact **set** entries come from a hook on signal writes. The overlay matches a write to a node by its label, so only signals with a `debugName` get exact entries. It samples everything else each time it reads the page, as **sampled** entries.

<ngmd-callout type="tip" title="Name your signals">
  Pass a <code>debugName</code> to <code>signal()</code> to get exact history entries and a readable label on the card.
</ngmd-callout>

## How to use it

### See why a computed changed

<ngmd-workflow>
  <ngmd-step title="Pick the component">
    Leave the picker on the routed component, or pick the one you care about.
  </ngmd-step>
  <ngmd-step title="Open the computed">
    Expand its card and read <strong>Dependencies (producers)</strong>.
  </ngmd-step>
  <ngmd-step title="Compare the histories">
    Open each producer. The one with a change at the same time is the cause.
  </ngmd-step>
</ngmd-workflow>

### Find what reruns an effect

<ngmd-workflow>
  <ngmd-step title="Filter by kind">
    Click the <code>effect</code> chip.
  </ngmd-step>
  <ngmd-step title="Open the effect">
    Its producers are every signal it read on the last run.
  </ngmd-step>
  <ngmd-step title="Trim the reads">
    Wrap reads that should not rerun it in <code>untracked()</code>, then check the graph again.
  </ngmd-step>
</ngmd-workflow>

### Switch the graph from an agent

The `ng-devtools:highlight` tool also switches the graph to the component it highlights. The picker does not show that choice.

## Agent tools

| Tool or resource              | Kind     | What it does                                                                                      |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `ng-devtools:get-signals`     | tool     | Signal declarations from source, with signal inputs, models and queries.                          |
| `ng-devtools:inspect-signals` | tool     | The graph the page reported, with edges and history. Takes a host tag, class name or instance id. |
| `ng-devtools:highlight`       | tool     | Highlights a component and makes it the target of the graph.                                      |
| `ng-devtools:signal-graph`    | resource | The live graph per page.                                                                          |

`inspect-signals` returns the graph of the chosen component. Call `highlight` first to switch it. See [Tools](../agents/tools.md).

## Limits and gotchas

### Unread signals are missing

Signals join the graph when a template or an effect reads them. If a signal is missing, check that something reads it.

### Graph and history caps

The graph shows up to 400 nodes, and drops extra nodes without a notice. The history keeps 50 changes per signal.

### Picked component is gone

When the picked component is gone or has no graph, a notice appears and the tab shows another one.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does the graph show a different component than I expected?">
    The default follows the deepest component in the primary router outlet. It skips named outlets. Pick the component yourself to pin it.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are all my history entries sampled?">
    Exact entries need a <code>debugName</code> on the signal. Without one, the overlay samples values each time it reads the page.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is a value marked as not computed yet?">
    A computed that nothing has read yet has no value. It fills in after its first read.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    Each instance, with its live inputs.
  </ngmd-card>
  <ngmd-card icon="box" title="NgRx Store" link="/inspectors/ngrx-store" cta="Open">
    Signal store state, computeds and methods.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
  <ngmd-card icon="compass" title="Browser overlay" link="/getting-started/overlay" cta="Set up">
    The script that reports the live page.
  </ngmd-card>
</ngmd-card-grid>
