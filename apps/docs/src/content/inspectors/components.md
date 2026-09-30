---
title: Components
description: Every component instance on the page, with live inputs, outputs and injected services.
---

<ngmd-hero title="Components" gradient>
  Every component instance on the page, in DOM order. Hover a row to find it in the page. Select it to read its live inputs, outputs and injected services.
</ngmd-hero>

# Components

The Components tab lists each rendered component instance as a tree. It walks each app root in document order, including shadow roots, then the components outside the app root, such as overlays. When no page is connected, it lists what your source declares instead.

## What it shows

### The tree

Each row shows the class name and the host tag. Routed components get a chip with their route path. A **+N** chip means N directives sit on the same host.

- Filter by class, tag or directive name.
- The toolbar counts the instances on the page.
- **Hover or focus** a row to highlight its host element in the page.
- **Click** a row, or press Enter or Space, to select it. Click it again to clear the selection.

The tree shows up to 2000 components, and walks up to 256 levels of DOM nesting. Past either limit, a notice says the page has more components than the tree shows.

### Detail header

The header of the selected instance shows the class name, the host tag, and the source file and line. The file and line come from the source scan, matched by class name. They are missing when the scan has no match.

When a form exists in the same source file, a **Show … in Forms** button opens it in the [Forms tab](./forms.md).

### Facts

- **Change detection**: `OnPush` or `Eager`.
- **Encapsulation**: `Emulated`, `None`, `ShadowDom` or `IsolatedShadowDom`.
- **Host path**: where the host element sits in the page.
- **Routed**: for routed components, the route and the outlet that rendered it.

A fact shows **Unknown** when Angular does not report it.

### Inputs, outputs and listeners

- **Inputs** with their live values. Signal inputs are unwrapped. When a component input has an alias, the row shows both names.
- **Outputs**, each marked **listened** or **no listener**.
- **DOM listeners** on the host element. This block appears only when there are any.
- One block per directive on the host, with its inputs and outputs.

### Injected services

**Injected** lists each token the component class injects, with its flags and the injector that provided it. The block marks a token nobody provides as **not provided**. The block leaves out tokens that host directives inject. Use the [Injectors tab](./injectors.md) for those.

### Source mode

Without live data, the tab lists the `@Component` and `@Directive` classes in your source. Expand a row to see its class, file, standalone flag, change detection, inputs and outputs. Click **Refresh** to scan again.

For change detection, the scan reads the `changeDetection` key in the decorator. Without one, it uses the project's Angular version: `OnPush` from Angular 22, `Eager` before. It shows `unknown` when the value is an expression it can't read, or when the version can't be found.

A notice at the top says why you see the source list: no page is connected, or the page reported no instances.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay walks the page with Angular's debug API after change detection. It resends an unchanged tree only after 8 seconds.
  </ngmd-card>
  <ngmd-card icon="file" title="Source scan">
    The server scans your files for <code>&#64;Component</code> and <code>&#64;Directive</code> classes. It also supplies the file and line in the detail header.
  </ngmd-card>
</ngmd-card-grid>

### Debug APIs

The live tree reads `window.ng`, which only development builds expose. It uses these functions:

| Function                                                                   | Used for                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ng.getComponent`, `ng.getDirectives`                                      | Finding instances and the directives on each host.   |
| `ng.getDirectiveMetadata`                                                  | Inputs, outputs, change detection and encapsulation. |
| `ng.isSignal`                                                              | Unwrapping signal inputs.                            |
| `ng.getListeners`                                                          | Output listeners and DOM listeners.                  |
| `ng.getInjector`, `ɵgetDependenciesFromInjectable`, `ɵgetInjectorMetadata` | The **Injected** block.                              |

### Refresh rate

On Angular 20 and later, the page reads the tree about 250 ms after Angular runs change detection, and every 4 seconds as a heartbeat. On older versions, it reads the tree every 3 seconds. It also reads it at once when you select an instance. It reads the detail block only for the selected instance. The server drops a page after 15 seconds without a report.

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

### Start from the Elements panel

If you use the [Chrome extension](../getting-started/chrome-extension.md), open the **Components** tab in its panel. Then select an element in the Chrome **Elements** panel. The tab selects the component that hosts that element and scrolls its row into view.

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

| Tool or resource             | Kind     | What it does                                                                                                                      |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ng-devtools:get-components` | tool     | Lists components and directives from source, with selector, kind, inputs, outputs, change detection, file and line.               |
| `ng-devtools:highlight`      | tool     | Highlights a component in the page. Takes an instance id, class name, host tag or CSS selector. Also retargets the Signals graph. |
| `ng-devtools:component-tree` | resource | The live tree per page, with the detail of the selected instance.                                                                 |

See [Tools](../agents/tools.md) and [Resources](../agents/resources.md).

## Limits and gotchas

### Development builds only

Live data reads `window.ng`. Production builds remove it, so the tab falls back to the source list.

### Values are shortened

Input values stop at 3 levels of nesting, 30 keys or items, and 300 characters. Past that, the devtools cut the value and mark it. Each block lists up to 60 inputs, outputs or listeners.

### Secrets are redacted

The devtools replace inputs with secret-looking names with `[redacted]`. They also redact JWTs and `Bearer` values inside strings. See [what the devtools redact](../security.md).

### Instance ids change on reload

Instance ids change on every page load. Don't store them between sessions.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why do I see the source list instead of the tree?">
    No page is connected, or the connected page is a production build. Open the app in a development build with the overlay loaded.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why are the file and line missing?">
    The detail header matches the class name against the source scan. Classes outside the scanned folders, or from libraries, have no match.
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
