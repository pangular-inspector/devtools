---
title: Signals
description: The live signal graph of one component or injector, drawn with its producer and consumer chains, with resources, watched signals and a value history per signal.
---

<ngmd-hero title="Signals" gradient>
  The live signal graph of one component or injector: its signals, computeds, linked signals, effects and resources, the edges between them, and a value history per signal.
</ngmd-hero>

# Signals

The Signals tab shows the reactive graph of one component, or of the root or a route injector, at a time. Only signals that a template or an effect has read appear. A signal nothing has read yet is not part of the graph. Without a live page, the tab lists the signal declarations in your source.

<ngmd-image src="/images/panel/signals.png" alt="The Signals tab following the routed SignalsExample component: kind filters with counts, the graph of signals feeding computeds, a linkedSignal and an effect into the template, and a resource that resolved with four changes"></ngmd-image>

## What it shows

### Page picker

When more than one open page reports a signal graph, a **Page** picker appears in the toolbar. It lists each page by title, or by URL when the page has no title. The tab starts on the first page that reports, and stays on the page you choose when another page reports later. The **Graph of** options follow the chosen page, and each page keeps its own **Graph of** choice.

If the chosen page closes, the tab moves to the page that reported last and announces the change to screen readers. When the panel opens framed by a page, such as the popup on that page, the tab shows that page only and has no **Page** picker.

### Graph picker

The **Graph of** picker at the top selects whose graph you see. It appears when a live component tree or an injector exists.

- **Follow the routed component** is the default. It shows the deepest component rendered by a primary `<router-outlet>`.
- **Root services** shows the effects registered on the root injector, such as an `effect()` in a `providedIn: 'root'` service, and the signals they read.
- **Route: path** entries show the effects registered on the injector of a route with `providers`, on the active route chain. Other environment injectors on that chain, such as the one of a lazy `loadChildren`, show as **Environment**.
- Pick any live component to pin the graph to it. The picker numbers duplicates, for example `#2`.
- Without a routed component, the tab shows the first component that has signals, among the first 50 on the page.

A line under the picker names the component, its host path, and why it was chosen: **picked**, **rendered by the router** or **first component with signals**. For an injector, it names the injector.

### Graph

The **Graph** section draws the signals, computeds, effects and templates of the graph as linked boxes. Producers sit on the left and the nodes that read them on the right, one column further than their furthest producer.

Select a node to highlight its chain. The selected node has an accent fill, its producers (upstream, every node it reads directly or not) have an accent border and solid links, and its consumers (downstream) have a dashed border and dashed links. Other nodes and links fade. The line under the graph names the selected node and its producer and consumer counts, and **Show details** opens its card in the list below.

The graph is one Tab stop. Use the arrow keys to move between nodes: up and down inside a column, left to a producer and right to a consumer. **Home** and **End** go to the first and last node, and **Enter** or **Space** selects. Each node's label names its kind, name and link counts, and the list below has the same nodes as cards.

**Hide graph** collapses the drawing and keeps the list. The kind chips and the name filter apply to the list only.

### Framework signals

Angular's router, forms and HTTP code create signals of their own in a development build, such as `reactiveHref` behind a `routerLink`. They often end up in a component's graph. The tab hides them by default, and **Show framework signals** brings them back, with a count of how many it hides. A shown framework node carries a **framework** tag in the list.

A node counts as framework code when it is not a template, not a signal field of the component, and either:

- its debug name is one that `@angular/router`, `@angular/forms` or `@angular/common/http` gives its own signals, and it is a `computed`, `linkedSignal` or `effect`, or a `signal` that only framework nodes read; or
- it has no debug name, it is not an effect, and only framework nodes read it.

A writable signal with a name such as `status` that your template, an effect or one of your computeds reads stays visible. A `computed` of a service with a framework name, such as `valid`, is hidden; show framework signals to see it. Internal signals of a resource are folded into its card instead, see [Resources](#resources).

### Node cards

Filter by name, or by kind with the chips. Typing `res` or more of the word `resource` lists every resource. If you pick another component or injector and its graph has no node of the chosen kind, the filter goes back to **All**. If the chosen kind runs out of nodes in the same graph, its chip stays pressed with a count of 0. Each card shows:

- Its kind and label. Kinds come from Angular, such as `signal`, `computed`, `linkedSignal`, `effect` and `template`. Nodes without a name show **(unnamed)**.
- The current value.
- The epoch, and the number of dependencies and consumers.
- A **N changes** badge once the value has changed. It counts every change since the overlay first saw the node, including values that went unseen.
- A **watching** tag when the page watches the signal.

### Node details

Expand a card to see:

- **Dependencies (producers)**: the nodes it reads.
- **Consumers**: the nodes and effects that read it.
- **Value history**: recent values, newest first, each with a time and a source tag.

A `signal`, `computed` or `linkedSignal` card also has a **Watch** button. See [Watched signals](#watched-signals).

When a signal or linkedSignal has no exact **set** entries, the card says why: the signal has no name, or every change was sampled because another live signal shares its name and value.

Click an entry under **Dependencies (producers)** or **Consumers** to open that node's card and move focus to it. If the name or kind filter hides the node, the tab clears both filters and says so. An internal signal of a resource opens the resource card. Unnamed nodes show their id, so this is the way to reach them.

### Resources

Angular builds each `resource()`, `httpResource()` and `rxResource()` from several internal signals, labeled `Resource#name.value`, `Resource#name.state` and so on. The tab folds them into one card under **Resources**, and leaves them out of the **Signals** list. Angular labels these signals from 21.0.1. On earlier versions they have no names, so the tab shows no **Resources** cards and lists them as unnamed nodes. Each card shows:

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

While write stacks are on, a **set** entry also lists the code that wrote it. See [Write stacks](#write-stacks).

When values change faster than the overlay reads the page, an entry says how many earlier values were not captured. Only `signal`, `computed` and `linkedSignal` nodes, and resource statuses, have a history.

The line above the list counts the changes, for example **3 changes recorded, newest first.** The list keeps the last 50 entries. Past that, the line says **showing the last 50**, and the count keeps growing.

### Restore a past value

Each entry but the newest has a **Restore** button when the signal is a `signal()`, `linkedSignal()` or `model()` field of the shown component. The page ties a graph node to a field only when the field's own reactive node is that node, and checks it again on every read, so a service signal with the same name and value as a field never gets the field's button. Click it to set the signal back to that entry's value with `.set()`, the same write `pangular:set-signal` makes. A line above the list says what was restored, or why the page refused.

The page writes the value it kept when it recorded the entry, not the copy the panel shows. A value the history cut to fit, or showed with masked secrets, comes back whole, and the value never leaves the page.

| Case                                                                   | What happens                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `computed()`, a signal input, or a signal of a service                 | No **Restore** button.                                           |
| A field that neither the template nor an effect of the component reads | No **Restore** button: the graph doesn't hold the field.         |
| Entry past the last 50, or the page reloaded                           | The page refuses: the entry is no longer in its history.         |
| The app changed the value in place after it was recorded               | The page refuses, because the value no longer matches the entry. |
| `actions.components` is `false`, a saved report or a native app        | No **Restore** button, and a note says why.                      |

See [`actions`](../getting-started/configuration.md#actions) for the option.

### Watched signals

Click **Watch** on a card to watch that signal. The page then logs each of its changes to the browser console, as `[pangular] Signal count set to 3`, and the **Watched** section above the list shows it with its value, its change count and a **Stop watching** button. **Recent changes** lists the last 20 changes of every watched signal in the graph, newest first.

The page keeps watching a signal when you pick another component, and keeps logging its writes to the console. **Watched** then says how many watched signals are not in the graph shown. A page watches up to 20 signals; watching another stops the oldest. Watches reset when the page reloads.

### Write stacks

**Record write stacks** is one switch for the page. While it is on, every exact write of a named signal records the stack of the code that set it, and the entry keeps the first 3 frames of your app's code. Frames from Angular, `node_modules`, prebundled dependencies, zone.js and the overlay are skipped. A frame reads as `Counter.increment (src/app/counter.ts:12:5)`, or as a compiled template listener such as `Counter_Template_button_click_0_listener` when a template event wrote the signal.

The frames show under **Written from** in the value history, in **Recent changes** and in the console log of a watched signal. Taking a stack slows every signal write, so the switch starts off, and the page takes no stack while it is off. Sampled entries have no stack, because the overlay did not see the write. Frames point at the code your browser runs, so a bundled build shows bundle file names and positions.

### Source mode

Without a live graph, the tab lists `signal()`, `computed()`, `linkedSignal()`, `effect()`, `toSignal()` and resource declarations found in your files. It also lists signal inputs, models and queries. Each card shows the file and line, and the component when the scan finds one.

If the devtools server does not answer, the tab says **Couldn't load signals** with a **Retry** button instead of an empty list.

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

Exact **set** entries come from a hook on signal writes, which the overlay loads from `@angular/core/primitives/signals`. A webpack build (the `browser` builder) leaves that import to run time, where it fails, so there every entry is **sampled**. The overlay matches a write to a node by its name, kind, version and value. It samples everything else each time it reads the page, as **sampled** entries.

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

### Find the code that writes a signal

<ngmd-workflow>
  <ngmd-step title="Turn on write stacks">
    Click <strong>Record write stacks</strong> above the graph.
  </ngmd-step>
  <ngmd-step title="Watch the signal">
    Open its card and click <strong>Watch</strong>.
  </ngmd-step>
  <ngmd-step title="Use the app">
    Each write lists the three app frames that set it under <strong>Recent changes</strong>, and in the page console.
  </ngmd-step>
  <ngmd-step title="Turn it off">
    Click <strong>Record write stacks</strong> again when you are done.
  </ngmd-step>
</ngmd-workflow>

### Switch the graph from an agent

The `pangular:highlight` tool also switches the graph to the component it highlights. The picker does not show that choice. Calling `pangular:inspect-signals` with `root` or a route path reads that injector's graph once and does not change what the Signals page shows.

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
| `pangular:watch-signal`    | tool     | Watches a signal and turns write stacks on or off on a page.                                                                       |
| `pangular:highlight`       | tool     | Highlights a component and makes it the target of the graph.                                                                       |
| `pangular:signal-graph`    | resource | The live graph per page.                                                                                                           |

`inspect-signals` returns the graph of the chosen component. Call `highlight` first to switch it to another component. See [Tools](../agents/tools.md).

## Limits and gotchas

### On older Angular

The live graph needs Angular 20.1 or later. On an older page the tab shows the source scan with a note that names the page's version, and `inspect-signals` and `watch-signal` answer **Unsupported on this Angular version**. See [Supported Angular versions](../getting-started/installation.md#supported-angular-versions).

### Unread signals are missing

Signals join the graph when a template or an effect reads them. If a signal is missing, check that something reads it.

### Graph and history caps

The graph shows up to 400 nodes. When Angular reports more, a notice says **Showing 400 of N signals**, and the edges to the rest are left out. The drawing holds up to 120 nodes. Past that, it draws the selected node and as much of its chain as fits, or the first 120 nodes when none is selected, and says **Drawing N of M signals**. The history keeps 50 entries per signal, and the **N changes** count keeps counting past that.

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
