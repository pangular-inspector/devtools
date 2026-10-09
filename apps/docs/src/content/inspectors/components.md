---
title: Components
description: Every component instance on the page, with live inputs, properties, outputs, injected services and defer blocks.
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
- **Pick component on page** selects the component behind an element you click in the app. See [Pick a component on the page](#pick-a-component-on-the-page).

Screen readers hear the match count when the filter changes. Components that the app adds or removes are not announced.

### Pages

When more than one tab reports, a **Page** menu picks the tab to show. The tab stays on the page you are looking at while other tabs report, and moves to another page only when yours closes. Opened from the popup or the Chrome extension, the tab starts on the page it belongs to.

### Selection

The page keeps the selection, so the panel, the page and the agent tools share it. When [`highlight` or `inspect-component`](#agent-tools) selects an instance, the panel selects it too. Each page keeps its own selection, and switching pages shows the selection of that page.

If the selected component is destroyed, for example by a route change or an item leaving a list, the detail pane says **The selected component was destroyed** and the selection clears. If the row had keyboard focus, focus moves to the next row, or to the row before it when the removed row was last.

The tree shows up to 2000 component instances, and walks up to 256 levels of DOM nesting. Past either limit, a notice names the limit, for example **Showing the first 2000 component instances. Others are not listed or searchable.**, and the count reads **2000+ instances**. The filter only searches the listed instances, so a component past the limit shows **No components match**. The [`inspect-component` and `highlight` tools](#agent-tools) say the same when they find no match on a cut-off tree.

### Detail header

The header of the selected instance shows the class name, the host tag, and the source file and line. In a development build, the file and line come from the debug info Angular's compiler attaches to the component, so they point at the exact class. Without it, they come from the source scan, matched by class name. They are missing when neither has them.

In the [Chrome extension](../getting-started/chrome-extension.md), the header also has two buttons:

| Button                 | What it does                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reveal in Elements** | Selects the host element of the instance in the Chrome **Elements** panel.                                                                                                                |
| **Open source**        | Opens the file in the Chrome **Sources** panel at the class line, if the source maps list that file. Otherwise it opens the compiled class. If neither works, it shows the file and line. |

The buttons only work for the tab that DevTools inspects. They don't appear in the hub, the popup or a static report. They don't change the app, so the [`actions`](../getting-started/configuration.md) option doesn't turn them off.

When a form exists in the same source file, a **Show … in Forms** button opens it in the [Forms tab](./forms.md).

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

### Injected services

**Injected** lists each token the component class injects, with its flags and the injector that provided it. The block marks a token nobody provides as **not provided**. The block leaves out tokens that host directives inject. Use the [Injectors tab](./injectors.md) for those.

### Defer blocks

When the page renders `@defer` blocks, a **Defer blocks** list follows the tree. Each row shows the component whose template holds the block, its state (`placeholder`, `loading`, `complete` or `error`) and its triggers. With [incremental hydration](https://angular.dev/guide/incremental-hydration), a row also shows `dehydrated` or `hydrated`, and a **hydrate never** flag marks a block that stays as server HTML.

Hover or focus a row to highlight the block in the page. Click it to select the component that holds it. The list is hidden when the page renders no defer blocks, or when its Angular version has no util to read them.

### Change detection

Below the tree and the defer blocks, the **Change detection** section records change detection cycles with Angular's profiler. Click **Record**, use the app, then click **Stop recording**. **Clear** empties the recording.

- **Slowest components**: each component class with its check count, its self time (its own template and hooks, children excluded) and its slowest single check.
- **Latest cycles**, newest first: the start time, the duration, how many components Angular checked, how many sync passes it ran, the output listener that ran before the cycle, and the slowest component in it.
- Tree rows show how many times each instance was checked while recording.

Recording is off by default. While it is off, the page registers no profiler for it. The page keeps the last 200 cycles, set with [`limits.cdCycles`](../getting-started/configuration.md#limits). Recording needs Angular 20 or later. On older versions, the section says so. Times come from a development build, so they are higher than in production.

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

| Function                                                                   | Used for                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ng.getComponent`, `ng.getDirectives`                                      | Finding instances and the directives on each host.                  |
| `ng.getDirectiveMetadata`                                                  | Inputs, outputs, change detection and encapsulation.                |
| `ɵcmp.debugInfo` on the component class                                    | The source file and line in the detail header.                      |
| `ng.isSignal`                                                              | Unwrapping signal inputs.                                           |
| `ng.getListeners`                                                          | Output listeners and DOM listeners.                                 |
| `ng.getInjector`, `ɵgetDependenciesFromInjectable`, `ɵgetInjectorMetadata` | The **Injected** block, and the services **Properties** leaves out. |
| `ng.ɵgetControlFlowBlocks`, or `ng.ɵgetDeferBlocks` before Angular 22      | The **Defer blocks** list.                                          |

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
    The tab selects the component that hosts the element you clicked, and opens its details.
  </ngmd-step>
</ngmd-workflow>

Press Escape, in the app or in the panel, or click **Cancel pick** to stop. Picking also stops after 15 seconds.

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

### Keyboard

Use the arrow keys, Home and End to move through the tree. The right arrow expands a row or moves to its first child. The left arrow collapses a row or moves to its parent.

## Agent tools

| Tool or resource             | Kind     | What it does                                                                                                                                                                          |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:get-components`    | tool     | Lists components and directives from source, with selector, kind, inputs, outputs, change detection, file and line.                                                                   |
| `pangular:highlight`         | tool     | Highlights a component in the page and selects it. Takes an instance id, class name, host tag or CSS selector. Also retargets the Signals graph. Lists every instance a name matches. |
| `pangular:inspect-component` | tool     | Selects one instance and returns its live detail: inputs, outputs, properties, listeners, directives and injected services.                                                           |
| `pangular:defer-blocks`      | tool     | Lists the `@defer` blocks of each page, and flags blocks that failed, blocks stuck on their placeholder and blocks still dehydrated.                                                  |
| `pangular:change-detection`  | tool     | Starts, stops or clears a change detection recording, and returns the slowest and most often checked components and the latest cycles.                                                |
| `pangular:component-tree`    | resource | The live tree per page, with the detail of the selected instance and the defer blocks.                                                                                                |

See [Tools](../agents/tools.md) and [Resources](../agents/resources.md).

## Limits and gotchas

### Development builds only

Live data reads `window.ng`. Production builds remove it, so the tab falls back to the source list.

### Values are shortened

Input and property values stop at 3 levels of nesting, 30 keys or items, and 300 characters. Past that, the devtools cut the value and mark it. Each block lists up to 60 inputs, outputs, properties or listeners.

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
