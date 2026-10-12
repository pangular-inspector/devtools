---
title: Components
description: Every component instance on the page, with live inputs, properties, outputs, injected services, defer blocks and @for blocks.
---

<ngmd-hero title="Components" gradient>
  Every component instance on the page, in DOM order. Hover a row to find it in the page. Select it to read its live inputs, properties, outputs and injected services.
</ngmd-hero>

# Components

The Components tab lists each rendered component instance as a tree. It walks each app root in document order, including shadow roots, then the components outside the app root, such as overlays. When no page is connected, it lists what your source declares instead.

## What it shows

### The tree

Each row shows the class name and the host tag. Routed components get a chip with their route path. A **+N** chip means N directives sit on the same host.

- Filter by class, tag or directive name.
- The toolbar counts the instances on the page. While you filter, it shows how many instances match, like **2 of 40**. Ancestors kept to show where a match sits don't count.
- **Hover or focus** a row to highlight its host element in the page.
- **Click** a row, or press Enter or Space, to select it. Click it again to clear the selection.
- **Expand all** opens every row and **Collapse all** closes them down to the top level. Both are off while you filter, because the filter already opens every row that leads to a match.
- **Pick component on page** selects the component behind an element you click in the app. See [Pick a component on the page](#pick-a-component-on-the-page).

Screen readers hear the match count when the filter changes, and a short message after **Expand all** or **Collapse all**. Components that the app adds or removes are not announced.

### Pages

When more than one tab reports, a **Page** menu picks the tab to show. The tab stays on the page you are looking at while other tabs report, and moves to another page only when yours closes. Opened from the popup or the Chrome extension, the tab starts on the page it belongs to.

### Selection

The page keeps the selection, so the panel, the page and the agent tools share it. When [`highlight` or `inspect-component`](#agent-tools) selects an instance, the panel selects it too. Each page keeps its own selection, and switching pages shows the selection of that page.

If the selected component is destroyed, for example by a route change or an item leaving a list, the detail pane says **The selected component was destroyed** and the selection clears. If the row had keyboard focus, focus moves to the next row, or to the row before it when the removed row was last.

The tree shows up to 2000 component instances, and walks up to 256 levels of DOM nesting. Past either limit, a notice names the limit, for example **Showing the first 2000 component instances. Others are not listed or searchable.**, and the count reads **2000+ instances**. The filter only searches the listed instances, so a component past the limit shows **No components match**. The [`inspect-component` and `highlight` tools](#agent-tools) say the same when they find no match on a cut-off tree.

### Detail header

The header of the selected instance shows the class name, the host tag, and the source file and line. In a development build, the file and line come from the debug info Angular's compiler attaches to the component, so they point at the exact class. Without it, they come from the source scan, matched by class name. They are missing when neither has them. With a live devtools server, the file and line are a button that opens the file in your editor. See [Open a file in your editor](#open-a-file-in-your-editor).

In the [Chrome extension](../getting-started/chrome-extension.md), the header also has two buttons:

| Button                 | What it does                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reveal in Elements** | Selects the host element of the instance in the Chrome **Elements** panel.                                                                                                                |
| **Open source**        | Opens the file in the Chrome **Sources** panel at the class line, if the source maps list that file. Otherwise it opens the compiled class. If neither works, it shows the file and line. |

The buttons only work for the tab that DevTools inspects. They don't appear in the hub, the popup or a static report. They don't change the app, so the [`actions`](../getting-started/configuration.md) option doesn't turn them off.

When a form exists in the same source file, a **Show … in Forms** button opens it in the [Forms tab](./forms.md).

**Show in Injectors** opens the [Injectors tab](./injectors.md#links-to-the-components-tab) with the element injector of the selected instance selected and scrolled into view. The button appears when the Injectors inspector is on.

**Store as global** stores the selected instance in the page console as `temp1`, then `temp2` and so on, and shows the name it used, for example **Stored as temp1.** See [Console handles](#console-handles).

### Facts

- **Change detection**: `OnPush` or `Eager`.
- **Encapsulation**: `Emulated`, `None`, `ShadowDom` or `IsolatedShadowDom`.
- **Host path**: where the host element sits in the page, as the chain of component hosts from the root. When a component renders several hosts with the same tag, for example cards in a `@for` list wrapped in `<li>`, each one gets its position among them, like `app-list > app-card[2]`.
- **Routed**: for routed components, the route and the outlet that rendered it.

A fact shows **Unknown** when Angular does not report it.

### Inputs, outputs and listeners

- **Inputs** with their live values. Signal inputs are unwrapped. When a component input has an alias, the row shows both names.
- **Outputs**, each marked **listened** or **no listener**.
- **DOM listeners** on the host element. This block appears only when there are any.
- One block per directive on the host, with its inputs and outputs.

### Properties

**Properties** lists the component's other own fields: plain fields, state objects, signals and resources. It leaves out inputs, outputs, methods and injected services. Signals show their current value and a **signal** flag. A field that holds a `resource()` or `httpResource()` shows its status, value and error, with a **resource** flag.

### Editing values

On a live browser page, each input, property and writable signal of the selected component has an **Edit** button. **Edit** opens a field with the value as JSON. Type a new JSON value, such as `"Paris"`, `42`, `true` or `{"page": 2}`. Press Enter or **Apply** to write it, or Escape or **Cancel** to leave it. If the page refuses the write, the reason shows under the field.

| Value                                                           | How the page writes it                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `signal()`, `linkedSignal()` or `model()`                       | Calls `.set()`. A `model()` also emits its change, so a two-way binding follows. |
| A decorator input or a plain field                              | Assigns the value, then runs change detection with `ng.applyChanges`.            |
| A signal input, `computed()`, `asReadonly()` signal or resource | No **Edit**. The row says why, for example that a parent binding sets the input. |

A row also has no **Edit** when its value is not JSON (a class instance, `Map` or `Date`), when it is redacted, or when the panel shows it shortened. A parent binding sets a bound input again the next time its own value changes, so the edit lasts until then. Directive inputs are read-only.

Set [`actions.components`](../getting-started/configuration.md#actions) to `false` to turn editing off. Agents write the same values with [`set-component-property` and `set-signal`](../agents/tools.md#edit-a-component).

### Injected services

**Injected** lists each token the component class injects, with its flags and the injector that provided it. The block marks a token nobody provides as **not provided**. The block leaves out tokens that host directives inject. Use the [Injectors tab](./injectors.md) for those.

### Defer blocks

When the page renders `@defer` blocks, a **Defer blocks** list follows the tree. Each row shows the component whose template holds the block, its state (`placeholder`, `loading`, `complete` or `error`) and its triggers. With [incremental hydration](https://angular.dev/guide/incremental-hydration), a row also shows `dehydrated` or `hydrated`, and a **hydrate never** flag marks a block that stays as server HTML.

Hover or focus a row to highlight the block in the page. Click it to select the component that holds it. The list is hidden when the page renders no defer blocks, or when its Angular version has no util to read them.

The list holds the first 500 blocks of a page. When the page has more, the count reads **500+**.

### For blocks

When the page renders `@for` blocks, an **&#64;for blocks** list follows the defer blocks. Each row shows the component whose template holds the block, its item count, whether it has an `@empty` block (**&#64;empty showing** when it shows) and what its `track` expression tracks by:

| Label              | Template                                      |
| ------------------ | --------------------------------------------- |
| `track $index`     | `track $index`                                |
| `track item`       | `track item`, where `item` is the loop item   |
| `track expression` | Any other expression, such as `track trip.id` |

A block with no items and no `@empty` block is marked **renders nothing**. Hover or focus a row to highlight the block in the page. Click it to select the component that holds it. The page lists up to 500 blocks, and the count reads **500+** past that.

The list needs Angular 22.0 or later in a development build. On an older Angular, the section says that the page does not report `@for` blocks.

### Change detection

Below the tree and the defer blocks, the **Change detection** section records change detection cycles with Angular's profiler. Click **Record**, use the app, then click **Stop recording**. **Clear** empties the recording. Each new recording starts empty, but a start sent while the page records, such as an agent's `record: "start"`, keeps the cycles recorded so far.

- **Cycles**: a bar chart with one bar per recorded cycle, its height the cycle's duration. A line marks the 16.6 ms frame budget (one frame at 60 frames per second). A cycle over the budget has a striped bar, a triangle under it, and says "over budget" in its tooltip and in the table. Hover or focus a bar to see the cycle number, duration, output trigger, checks and its three slowest components.
- **Spans in the picked cycles**: when the page reports timed spans, a flame graph of the picked cycles. Time runs left to right, cycle after cycle with the idle time between them left out, and a span nested in another sits one row lower. Each span is a component check (solid), a lifecycle hook (stripes), an `afterRender` callback (dots) or the output listener that triggered the cycle (lines, drawn before the cycle's start), with a key under the graph. Hover or focus a span to read its total and self time. The arrow keys move along a row, **Up** goes to the enclosing span and **Down** to the first nested one. **Enter** or a click on a component, hook or output selects that component in the tree. **Show the spans as a table** lists the same spans. The graph shows at most 30 cycles; pick a smaller range when more are picked.
- **Self time by component**: a treemap of each component class's self time in the picked cycles, largest first. The recording has no parent links between components, so the cells are not nested. Click a cell, or press **Enter** on it, to select an instance of that class in the tree (the one checked most often).
- **Slowest components**: each component class with its check count, its self time (its own template and hooks, children excluded) and its slowest single check.
- **Latest cycles**, newest first: the start time, the duration, how many components Angular checked, how many sync passes it ran, the output listener that ran just before the cycle (an output that ended more than 50 ms before the cycle is not counted), the time in lifecycle hooks and in `afterRender` callbacks, and the slowest component in it.
- **Lifecycle hooks**: time per class and hook (`ngOnChanges`, `ngOnInit`, `ngDoCheck`, `ngAfterContentChecked`, `ngAfterViewChecked` and the others Angular calls), with call count and slowest call. A hook's time is also part of the self time of the component whose view runs it.
- **Output listeners**: time per class and listener, without the time of outputs the listener emitted, with call count and slowest call.
- A line with how often Angular ran the `afterEveryRender` and `afterNextRender` callbacks, and how long they took.
- Tree rows show how many times each instance was checked while recording.

**Lifecycle hooks** and **Output listeners** show their 10 slowest rows. A recording keeps the 100 slowest of each among the first 1000 it times, and a note says how many it left out.

**Slowest components** shows the 100 component classes with the most self time among the first 1000 classes a recording checks. A class first checked after those 1000 has no totals, so it isn't ranked. Tree rows count checks for up to 2000 instances. When a recording checks more classes or instances, a note in the section says how many were left out.

Each cycle keeps its 40 longest timed spans, and the flame graph says how many shorter spans it left out. A recording without spans, such as a file saved by an older version, has no flame graph. The section says so and shows the treemap.

Recording is off by default. While it is off, the page registers no profiler for it. The page keeps the last 200 cycles, set with [`limits.cdCycles`](../getting-started/configuration.md#limits). Recording needs Angular 20 or later. On older versions, the section says so. Times come from a development build, so they are higher than in production.

#### Pick a range of cycles

Drag across the bars to pick a range of cycles, or type cycle numbers in **Start** and **End**. With the chart focused, the arrow keys move between cycles, **Shift** with an arrow key extends the range, **Enter** picks one cycle and **Escape** shows all cycles again. **Show all cycles** does the same. The flame graph, the treemap and **Slowest components** then cover only the picked cycles. Each cycle lists its 10 slowest components, so totals for a range leave out the components a cycle did not list. **Show the cycles as a table** lists the picked cycles with their duration, budget, checks, passes, trigger and slowest component.

#### Export and import a recording

| Button                      | What it does                                                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Export JSON**             | Saves the recording on screen as `change-detection-<page>.json`. Instance check counts are left out, since their ids only mean something in the page that recorded them.                                                          |
| **Export trace (Perfetto)** | Saves it in the Trace Event Format as `change-detection-<page>.trace.json`. Open it in [Perfetto](https://ui.perfetto.dev) or `chrome://tracing`.                                                                                 |
| **Import**                  | Loads a recording file, from this panel or from the `change-detection` agent tool, and shows it marked **Imported recording** with its file name. **Record** and **Clear** are hidden until you click **Back to live recording**. |

An import goes through the same checks as a report from the page: unknown fields are dropped, text is cut to length and lists are capped, so a hand-edited file shows only recording data. Files over 20 MB, or with no cycles, are refused with a message that says why.

The trace has one complete event per cycle on a **Change detection** thread, with the component checks, lifecycle hooks and `afterRender` callbacks nested inside it, and the output listener that started each cycle on an **Outputs** thread. Times are in microseconds from the start of the recording. Each cycle keeps its 40 longest timed spans, so a large app's trace shows the slowest checks of each cycle, not all of them.

#### Watch checks live

The **Live views** toggles below **Record** show change detection as it happens, without a recording. Each one is per page, off by default, and registers no profiler while it is off. They need Angular 20 or later.

| Toggle                | What it does                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Flash checks**      | Draws a box over the host of each component Angular checks, labeled with its class name and `×N`, the number of checks since the box appeared. The box fades out over about a second. With reduced motion, it shows a still outline for 0.4 seconds instead.                                                       |
| **Performance track** | Adds a **Pangular** track to the Chrome DevTools Performance panel, with one entry per component check, lifecycle hook and output listener. Record a profile in the Performance panel to see it. Browsers without `console.timeStamp` show nothing.                                                                |
| **Angular profiling** | Calls `ng.enableProfiling()`, so Angular adds its own track to the Performance panel. Angular has no way to turn it off, so it stays on until the page reloads and the toggle stays pressed. If the page has no `ng.enableProfiling`, such as a production build, the toggle does nothing and the section says so. |

The flash boxes are drawn on a canvas in a shadow root that the overlay adds to the page. It doesn't take clicks, and the overlay never changes the app's own elements. The page measures the checked hosts once per animation frame and draws at most 150 boxes at a time.

### Source mode

Without live data, the tab lists the `@Component` and `@Directive` classes in your source. Expand a row to see its class, file, standalone flag, change detection, inputs and outputs. Click **Refresh** to scan again.

For change detection, the scan reads the `changeDetection` key in the decorator. Without one, it uses the project's Angular version: `OnPush` from Angular 22, `Eager` before. It shows `unknown` when the value is an expression it can't read, or when the version can't be found.

A notice at the top says why you see the source list: no page is connected, or the page reported no instances.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay walks the page with Angular's debug API after change detection. It doesn't resend an unchanged tree. After 8 seconds without a change, it sends a short ping so the server keeps the page.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server scans your files for <code>&#64;Component</code> and <code>&#64;Directive</code> classes. It also supplies the file and line in the detail header.
  </ngmd-card>
</ngmd-card-grid>

### Debug APIs

The live tree reads `window.ng`, which only development builds expose. It uses these functions:

| Function                                                                   | Used for                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ng.getComponent`, `ng.getDirectives`                                      | Finding instances and the directives on each host.                           |
| `ng.getDirectiveMetadata`                                                  | Inputs, outputs, change detection and encapsulation.                         |
| `ɵcmp.debugInfo` on the component class                                    | The source file and line in the detail header.                               |
| `ng.isSignal`                                                              | Unwrapping signal inputs.                                                    |
| `ng.getListeners`                                                          | Output listeners and DOM listeners.                                          |
| `ng.applyChanges`                                                          | Refreshing the view after an edit to an input or a plain field.              |
| `ng.getInjector`, `ɵgetDependenciesFromInjectable`, `ɵgetInjectorMetadata` | The **Injected** block, and the services **Properties** leaves out.          |
| `ng.ɵgetControlFlowBlocks`, or `ng.ɵgetDeferBlocks` before Angular 22      | The **Defer blocks** list, and from Angular 22 the **&#64;for blocks** list. |

### Refresh rate

On Angular 20 and later, the page reads the tree about 250 ms after Angular runs change detection, and every 4 seconds as a heartbeat. Until the app bootstraps, it reads the tree every 3 seconds. It also reads it at once when you select an instance. It reads the detail block only for the selected instance. The server drops a page after 15 seconds without a report, unless its tab is in the background. See [Tabs in the background](../getting-started/popup-and-hub.md#tabs-in-the-background).

## How to use it

### Find a component in the page

<ngmd-workflow>
  <ngmd-step title="Filter the tree">
    Type part of the class, tag or directive name.
  </ngmd-step>
  <ngmd-step title="Hover the rows">
    The page highlights each host element as you move over it.
  </ngmd-step>
  <ngmd-step title="Select the match">
    Click the row to open its details.
  </ngmd-step>
</ngmd-workflow>

### Pick a component on the page

<ngmd-workflow>
  <ngmd-step title="Start picking">
    Click <strong>Pick component on page</strong>. The floating panel fades so it doesn't cover the app.
  </ngmd-step>
  <ngmd-step title="Point at the app">
    The page highlights the component under the pointer.
  </ngmd-step>
  <ngmd-step title="Click it">
    The tab selects the component that hosts the element you clicked, and opens its details. On a touch screen, tap it.
  </ngmd-step>
</ngmd-workflow>

While picking, presses and clicks in the app don't reach it, so menus and drag handles stay as they are.

Press Escape, in the app or in the panel, or click **Cancel pick** to stop. Picking also stops after 15 seconds.

Hold Alt (Option on macOS) while you click to also open the file of the picked component in your editor, at its class line. The tab still selects the component. This needs the debug info of a development build. Without it, the click only picks.

### Open a file in your editor

With a live devtools server, the source file and line of a component, provider, signal, store, pipe, route or Analog file is a button. Click it, or focus it and press Enter, to open the file at that line in your editor. In a list row that is itself a button, select the row and use the file in its details. In a static report, and in the Chrome extension without a devtools server, the file and line stay plain text.

The server launches the editor on the machine it runs on. It picks the editor in this order:

| Source                    | Example                                  |
| ------------------------- | ---------------------------------------- |
| `LAUNCH_EDITOR`           | `LAUNCH_EDITOR=code pnpm start`          |
| An editor already running | VS Code, Cursor, WebStorm and other IDEs |
| `VISUAL`, then `EDITOR`   | `EDITOR=vim`                             |

If the host installs the `@devframes/service-open` service (the Messages devframe in the hub brings it in), the server tries it first so its `editor` option applies. That service only opens files under the workspace root, so when it refuses a file, such as one in a served app outside the workspace, the server opens it the way the table above describes.

The server only opens regular files inside the project. Paths outside the workspace root and the served app, symlinks that point outside them, folders and missing files are refused, and the button says why. See [Open in editor](../security.md#open-in-editor).

### Start from the Elements panel

If you use the [Chrome extension](../getting-started/chrome-extension.md), open the **Components** tab in its panel. Then select an element in the Chrome **Elements** panel. The tab selects the component that hosts that element and scrolls its row into view.

To go the other way, select a component and click **Reveal in Elements** in its header.

### Check why an output does nothing

<ngmd-workflow>
  <ngmd-step title="Select the child component">
    Pick the component that declares the output.
  </ngmd-step>
  <ngmd-step title="Read the Outputs block">
    An output marked <strong>no listener</strong> has no parent binding. Check the parent template.
  </ngmd-step>
</ngmd-workflow>

### Track down a missing provider

<ngmd-workflow>
  <ngmd-step title="Select the component">
    Open the component that throws.
  </ngmd-step>
  <ngmd-step title="Read the Injected block">
    A token marked <strong>not provided</strong> is the one to fix.
  </ngmd-step>
  <ngmd-step title="Follow the lookup path">
    Open the Injectors tab to see where Angular searched.
  </ngmd-step>
</ngmd-workflow>

### Console handles

When you select a component in the panel, the page sets `$ng0` in its console to that instance. The previous selections move to `$ng1` through `$ng4`, newest first, so the last five stay at hand. Selecting the same instance again keeps the order, and an earlier one moves back to `$ng0`. **Pick component on page** sets `$ng0` too. Selections made by an agent tool don't.

**Store as global** in the detail header, in the provider rows of the [Injectors tab](./injectors.md#store-a-provider-as-a-global) and next to the state on the [NgRx tab](./ngrx-store.md#store-the-state-as-a-global) stores a value as `temp1`, then the first free `tempN`.

| Rule                    | Detail                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One page                | Only the tab that owns the selection writes the globals. Other tabs of the app don't change.                                                                                                              |
| Page globals stay       | The overlay never overwrites a `$ngN` or `tempN` the page set itself. It skips that name.                                                                                                                 |
| Nothing leaves the page | The value stays in the page. Only the variable name comes back to the panel.                                                                                                                              |
| Cleanup                 | When the overlay stops, it removes the globals it still owns.                                                                                                                                             |
| Components inspector    | `$ng0` and **Store as global** for a component need the Components inspector on. They don't change the app, so the [`actions`](../getting-started/configuration.md#actions) option doesn't turn them off. |

`$ng0` and a stored component hold the live instance, the same object `ng.getComponent($0)` returns in the console. Read a signal input with `$ng0.title()`.

The console handles need the browser overlay. The Angular Native and NativeScript overlays don't set them.

### Keyboard

Use the arrow keys, Home and End to move through the tree. The right arrow expands a row or moves to its first child. The left arrow collapses a row or moves to its parent. The `*` key expands the focused row and every row at the same level under the same parent.

After **Collapse all**, the row you return to with Tab is the closest visible parent of the row you were on.

Press Escape in the filter box to clear it. When the filter matches nothing, **Clear filter** clears it and moves focus back to the filter box.

## Agent tools

| Tool or resource                  | Kind     | What it does                                                                                                                                                                                                         |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:get-components`         | tool     | Lists components and directives from source, with selector, kind, inputs, outputs, change detection, file and line.                                                                                                  |
| `pangular:highlight`              | tool     | Highlights a component in the page and selects it. Takes an instance id, class name, host tag or CSS selector. Also retargets the Signals graph. Lists every instance a name matches.                                |
| `pangular:inspect-component`      | tool     | Selects one instance and returns its live detail: inputs, outputs, properties, listeners, directives and injected services.                                                                                          |
| `pangular:list-components`        | tool     | Returns the live tree of one page as an indented outline with routed and directive markers. Takes a `filter` and a `depth`.                                                                                          |
| `pangular:defer-blocks`           | tool     | Lists the `@defer` blocks of each page, and flags blocks that failed, blocks stuck on their placeholder and blocks still dehydrated.                                                                                 |
| `pangular:for-blocks`             | tool     | Lists the `@for` blocks of each page with their item count, track kind and `@empty` block.                                                                                                                           |
| `pangular:change-detection`       | tool     | Starts, stops or clears a change detection recording, turns the live views on or off, and returns the slowest and most often checked components, hook, output and afterRender time, the latest cycles, or an export. |
| `pangular:set-component-property` | tool     | Writes an input or property of one instance and runs change detection. An action.                                                                                                                                    |
| `pangular:set-signal`             | tool     | Sets a writable signal that one instance holds as a property. An action.                                                                                                                                             |
| `pangular:component-tree`         | resource | The live tree per page, with the detail of the selected instance and the defer blocks.                                                                                                                               |

See [Tools](../agents/tools.md) and [Resources](../agents/resources.md).

## Limits and gotchas

### Development builds only

Live data reads `window.ng`. Production builds remove it, so the tab falls back to the source list.

### Values are shortened

Input and property values stop at 3 levels of nesting, 30 keys or items, and 300 characters. Past that, the devtools cut the value and mark it. Each block lists up to 60 inputs, outputs, properties or listeners.

### No `@let` values

`@let` values live in the template's view, not on the component, and Angular's debug API does not expose them. **Properties** doesn't list them. To see one, move it into a `computed()` on the component.

### Secrets are redacted

The devtools replace inputs and properties with secret-looking names with `[redacted]`. They also redact JWTs and `Bearer` values inside strings. See [what the devtools redact](../security.md).

### Instance ids change on reload

Instance ids change on every page load. Don't store them between sessions.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why do I see the source list instead of the tree?">
    No page is connected, or the connected page is a production build. Open the app in a development build with the overlay loaded.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are the file and line missing?">
    Production builds drop Angular's debug info. The detail header then matches the class name against the source scan, and classes outside the scanned folders, or from libraries, have no match.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does a component show +2?">
    Two directives sit on its host element. Select it to see one block per directive.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Injectors" link="/inspectors/injectors" cta="Open">
    The injector tree and the lookup path of each token.
  </ngmd-card>
  <ngmd-card icon="zap" title="Signals" link="/inspectors/signals" cta="Open">
    The live signal graph of one component.
  </ngmd-card>
  <ngmd-card icon="file" title="Forms" link="/inspectors/forms" cta="Open">
    Every form on the page, with field state and errors.
  </ngmd-card>
  <ngmd-card icon="compass" title="Browser overlay" link="/getting-started/overlay" cta="Set up">
    The script that reports the live page.
  </ngmd-card>
</ngmd-card-grid>
