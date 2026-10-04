---
title: Signals
description: The live signal graph of one component or injector, with resources and a value history per signal.
---

<ngmd-hero title="Signals" gradient>
  The live signal graph of one component or injector: its signals, computeds, linked signals, effects and resources, the edges between them, and a value history per signal.
</ngmd-hero>

# Signals

The Signals tab shows the reactive graph of one component, or of the root or a route injector, at a time. Only signals that a template or an effect has read appear. A signal nothing has read yet is not part of the graph. Without a live page, the tab lists the signal declarations in your source.

## What it shows

### Graph picker

The **Graph of** picker at the top selects whose graph you see. It appears when a live component tree or an injector exists.

- **Follow the routed component** is the default. It shows the deepest component rendered by a primary `<router-outlet>`.
- **Root services** shows the effects registered on the root injector, such as an `effect()` in a `providedIn: 'root'` service, and the signals they read.
- **Route: path** entries show the effects registered on the injector of a route with `providers`, on the active route chain. Other environment injectors on that chain, such as the one of a lazy `loadChildren`, show as **Environment**.
- Pick any live component to pin the graph to it. The picker numbers duplicates, for example `#2`.
- Without a routed component, the tab shows the first component that has signals, among the first 50 on the page.

A line under the picker names the component, its host path, and why it was chosen: **picked**, **rendered by the router** or **first component with signals**. For an injector, it names the injector.

### Node cards

Filter by name, or by kind with the chips. Each card shows:

- Its kind and label. Kinds come from Angular, such as `signal`, `computed`, `linkedSignal`, `effect` and `template`. Nodes without a name show **(unnamed)**.
- The current value.
- The epoch, and the number of dependencies and consumers.
- A **N changes** badge once the value has changed. It counts every change since the overlay first saw the node, including values that went unseen.

### Node details

Expand a card to see:

- **Dependencies (producers)**: the nodes it reads.
- **Consumers**: the nodes and effects that read it.
- **Value history**: recent values, newest first, each with a time and a source tag.

Click an entry under **Dependencies (producers)** or **Consumers** to open that node's card and move focus to it. If the name or kind filter hides the node, the tab clears both filters and says so. An internal signal of a resource opens the resource card. Unnamed nodes show their id, so this is the way to reach them.

### Resources

Angular builds each `resource()`, `httpResource()` and `rxResource()` from several internal signals, labeled `Resource#name.value`, `Resource#name.state` and so on. The tab folds them into one card under **Resources**, and leaves them out of the **Signals** list. Each card shows:

| Field           | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Status**      | `idle`, `loading`, `reloading`, `resolved`, `error` or `local` (after `set()`).           |
| **Loading**     | Whether a request is in flight.                                                           |
| **HTTP status** | The status code of the last response, for `httpResource()`.                               |
| **Params**      | The value the `params` function returned. For `httpResource()`, the method, URL and body. |
| **Value**       | The current value. Hidden while the resource is in the error state.                       |
| **Error**       | The error of the last request.                                                            |

Expand a card for its **Status history**, and click **Show internal signals** to list the signals it is built from. A resource without a `debugName` shows as **resource 1**, **resource 2** and so on, in graph order.

Status, params, value and error come from the resource's own state when the component holds the resource in a field. For a resource that lives in a service, they come from the graph, and the tab leaves out what the graph doesn't hold.

### Value history

| Tag         | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| **set**     | A write set the value. This entry is exact.            |
| **sampled** | The overlay saw a changed value when it read the page. |
| **initial** | The first value the overlay saw.                       |

When values change faster than the overlay reads the page, an entry says how many earlier values were not captured. Only `signal`, `computed` and `linkedSignal` nodes, and resource statuses, have a history.

The line above the list counts the changes, for example **3 changes recorded, newest first.** The list keeps the last 50 entries. Past that, the line says **showing the last 50**, and the count keeps growing.

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

The live graph reads `ng.ɵgetSignalGraph` with the component's injector, from `ng.getInjector` and `ng.getComponent`. For the root and route injectors, it passes the environment injector found through `ng.ɵgetInjectorResolutionPath`. It needs a development build and Angular 20.1 or later. On Angular 20.0, the graph has no node ids, so the tab says the live graph needs Angular 20.1 or later and shows the source scan.

Angular doesn't send a value for `linkedSignal` nodes. The overlay takes it from a field of the component whose signal has the same name and the same version, and only when exactly one field and one node match. It reads the stored value without calling the signal, so no user computation runs. A `linkedSignal` in a service, or one that is stale, shows no value.

### Exact and sampled values

Exact **set** entries come from a hook on signal writes. The overlay matches a write to a node by its name, kind, version and value. It samples everything else each time it reads the page, as **sampled** entries.

In a development build, the Angular compiler names most signals for you. It adds a `debugName` to `signal()`, `computed()`, `linkedSignal()`, `input()`, `model()`, queries, `effect()`, `resource()` and `httpResource()` when the call initializes a class field, a `this.name =` assignment or a variable. The name is the field or variable name.

Entries are sampled instead of exact in these cases:

| Case                                                                                                   | Why                                                                                     |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A `computed()`                                                                                         | Nothing writes it, so there is no write to hook. Computeds always show sampled entries. |
| A signal created without a field or variable, such as `return signal(0)` or `{ count: signal(0) }`     | The compiler has no name to add.                                                        |
| A signal a library creates, when the library was built without the name                                | The signal has no `debugName`.                                                          |
| Several live signals with the same name, kind, version and value, such as one component rendered twice | The overlay cannot tell which node the write belongs to.                                |
| The write hook did not load                                                                            | The tab shows a notice: **The signal write hook did not load.**                         |

<ngmd-callout type="tip" title="Name signals the compiler misses">
  If a signal comes from a factory or helper that returns it directly, pass a <code>debugName</code> in its options, for example <code>signal(0, { debugName: 'count' })</code>.
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
    Click each producer to open it. The one with a change at the same time is the cause.
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

The `pangular:highlight` tool also switches the graph to the component it highlights. Calling `pangular:inspect-signals` with `root` or a route path switches it to that injector. The picker does not show either choice.

### Find a stuck effect in a root service

<ngmd-workflow>
  <ngmd-step title="Pick Root services">
    Open the <strong>Graph of</strong> picker and choose <strong>Root services</strong>, or the route whose providers hold the service.
  </ngmd-step>
  <ngmd-step title="Open the effect">
    Its producers are every signal it read on the last run. A <strong>N changes</strong> badge that keeps growing on a producer points at a loop.
  </ngmd-step>
</ngmd-workflow>

## Agent tools

| Tool or resource           | Kind     | What it does                                                                                                                       |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:get-signals`     | tool     | Signal declarations from source, with signal inputs, models and queries.                                                           |
| `pangular:inspect-signals` | tool     | The graph the page reported, with edges, resources and history. Takes a host tag, class name, instance id, `root` or a route path. |
| `pangular:highlight`       | tool     | Highlights a component and makes it the target of the graph.                                                                       |
| `pangular:signal-graph`    | resource | The live graph per page.                                                                                                           |

`inspect-signals` returns the graph of the chosen component. Call `highlight` first to switch it to another component. See [Tools](../agents/tools.md).

## Limits and gotchas

### Unread signals are missing

Signals join the graph when a template or an effect reads them. If a signal is missing, check that something reads it.

### Graph and history caps

The graph shows up to 400 nodes. When Angular reports more, a notice says **Showing 400 of N signals**, and the edges to the rest are left out. The history keeps 50 entries per signal, and the **N changes** count keeps counting past that.

### Injector graphs hold effects only

The root and route graphs start from the effects registered on that injector. A signal in a root service that no effect reads doesn't appear there. It appears in the graph of a component whose template reads it.

### Picked component is gone

When the picked component is gone or has no graph, a notice appears and the tab shows another one.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does the graph show a different component than I expected?">
    The default follows the deepest component in the primary router outlet. It skips named outlets. Pick the component yourself to pin it.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are all my history entries sampled?">
    Computeds are never written, so their entries are always sampled. For a signal, check the notice at the top of the tab: if the write hook did not load, every entry is sampled. Otherwise the signal likely has no name, because a factory or helper created it without a field or variable. Pass a <code>debugName</code> in its options. See <a href="#exact-and-sampled-values">Exact and sampled values</a>.
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
