---
title: Pipes
description: Custom, built-in and library pipes, where they are used, live instances, call recording and a pipe lint.
---

<ngmd-hero title="Pipes" gradient>
  Your own pipes, the built-in ones in use and library pipes on the page. Where they live, which components use them on the page, what they last returned, and what to fix.
</ngmd-hero>

# Pipes

The Pipes tab lists your `@Pipe` classes, the built-in pipes from `@angular/common` that your templates use, and pipes from libraries that the page uses. It shows the live instances on the page, and records calls when you ask it to.

<ngmd-image src="/images/panel/pipes.png" alt="The Pipes tab listing the demo's custom pipes and the built-in pipes it uses, with chips for live instances, NgModule, pure and impure, and below them the async subscriptions with duplicate subscription warnings"></ngmd-image>

## What it shows

### Pipe list

Search by pipe name, class or file. Narrow the list with **Show pipes**: **All pipes**, **Custom**, **Built-in**, **Runtime only**, **Impure** or **On the page**.

Each row shows the pipe name, its class, and chips:

- **N live**: instances on the page.
- **built-in**, and **NgModule** for pipes that are not standalone.
- **runtime only** for a pipe the source scan did not find, such as `translate` or `ngrxPush` from a library. Its row says **No source location**.
- **pure** or **impure**.
- **stale?** when recording caught a possible stale value.

The row also counts usages: **+N more** for a built-in pipe, and **N uses** for your own pipes.

Hover or focus a row to highlight the first component that uses it.

A runtime-only pipe is listed while the page uses it, and leaves the list when the page stops using it. If the source scan fails while the page reports pipes, the list keeps the runtime-only pipes and says **Couldn't scan the source** with a **Try again** button. If an earlier scan worked, the list also keeps the pipes that scan found and says so.

### Declaration

Select a pipe to see its class, whether it comes from `@angular/common` or your project or was only seen on the page, its file, and whether it is standalone and pure. A runtime-only pipe has no file, and the page does not say whether it is standalone, so those rows are left out. A pure pipe reruns only when an argument changes. An impure pipe reruns on every check.

### Used in templates

Every template that uses the pipe, with file and line, for your own pipes and the built-in ones. The scan reads interpolations, bound attributes, `@if`, `@else if`, `@for`, `@switch` and `@case` conditions, `@defer` triggers and `@let` values.

### Live on the page

The number of instances and the components that use them. Click, hover or focus a component chip to highlight it. With recording on, this block adds the call count, the time spent in `transform` (total, average and slowest call), the errors it threw with the last message, the last input and output, and the last caller. When several instances were called, **Per instance** lists each one with its component, values, call count, time and caller. Click a component there to highlight it. The list is capped and says how many instances there are when it has more.

When several tabs report pipes, the panel of a tab shows that tab's pipes and `| async` rows only. Without a tab of its own, the panel shows every tab together.

### Async subscriptions

When templates use `| async`, the tab lists each subscription with its component and latest value. This needs no recording. Each `| async` subscribes on its own. Two on the same source run the work twice, so the tab marks those rows **duplicate subscription**.

The list keeps 200 rows per tab. When a page has more, the section says how many it shows out of the total.

A source that changes on three reports in a row, like `getData() | async` returning a new Observable on each check, is marked **resubscribing**. `AsyncPipe` unsubscribes and subscribes again every time the source changes, so with `HttpClient` each check sends a request. A method that returns the same Observable each time is not marked.

### Lint

| Rule                       | Severity      | Finds                                                                                                                                                                                                                                                  |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `impure-pipe-in-for`       | warning       | An impure pipe inside an `@for` block or an `*ngFor` element. It runs on every check, possibly once per row. `async` is skipped because it is cheap there, and `json` has its own rule.                                                                |
| `json-pipe-in-template`    | info          | `\| json` left in a template. It is a debugging aid.                                                                                                                                                                                                   |
| `signal-read-in-pure-pipe` | warning, info | A pure pipe whose `transform()` reads a `signal`, `input`, `computed`, `linkedSignal`, `toSignal` or `model` field of the pipe (warning). A call with no arguments on an injected service, like `this.rates.current()`, might be a signal read (info). |
| `async-on-call`            | info          | A method call piped to `\| async`, like `getUsers() \| async`. If the method builds a new Observable each time, `AsyncPipe` resubscribes on every check. Signal, `input`, `computed` and `toSignal` fields of the component are skipped.               |

If the pipe in a finding is in the pipe list, its name is a button. Click it to select that pipe and open its details. A search or **Show pipes** filter that hides the pipe is cleared first; filters that already show it stay. A pipe that is not in the list, like a library pipe the page does not use, stays plain text.

## Where the data comes from

<ngmd-card-grid columns="3">
  <ngmd-card icon="file" title="Source scan">
    <code>&#64;Pipe</code> classes with name, class, file, standalone and pure flags. Built-in pipes with every usage site.
  </ngmd-card>
  <ngmd-card icon="zap" title="Live page">
    The overlay finds pipe instances in the rendered views, library pipes included. It is read-only until you record.
  </ngmd-card>
  <ngmd-card icon="search" title="Lint">
    The server checks your source for the four rules above.
  </ngmd-card>
</ngmd-card-grid>

### Built-in pipes

The built-in list covers the `@angular/common` pipes: `async`, `currency`, `date`, `number`, `i18nPlural`, `i18nSelect`, `json`, `keyvalue`, `lowercase`, `percent`, `slice`, `titlecase` and `uppercase`. Pipes from other packages are not listed as built-in. They show as **runtime only** while the page uses them.

### Live instances

Live discovery walks the rendered views with `ng.getComponent` and related debug helpers. It needs a development build.

### Recording

Click **Record calls** to count and time calls, count the calls that throw, and keep the last input and output of each pipe. A `transform` that throws still throws in your app. Recording patches each pipe's `transform` in one tab: the page the panel belongs to, or the page that reported last when the panel runs on its own. Other open tabs stay unpatched. It covers the pipes found on the page. A pipe class that first appears while recording, such as one in a view you open, is patched on the next report, so its first calls can be missed. **Stop recording** stops every tab that records. Click **Stop recording** when you are done.

Each recording starts from zero, so a second recording measures one interaction on its own. The button switches to **Stop recording** once a page confirms that it is recording. If no page is connected, the tab says so and stays on **Record calls**.

## How to use it

### Find a slow pipe

<ngmd-workflow>
  <ngmd-step title="Show impure pipes">
    Pick <strong>Impure</strong> in <strong>Show pipes</strong>.
  </ngmd-step>
  <ngmd-step title="Record calls">
    Click <strong>Record calls</strong>, then use the page for a moment.
  </ngmd-step>
  <ngmd-step title="Read the counts">
    A pipe with a high call count reruns on every check. A high total or slowest time points at a costly <code>transform</code>. Make it pure, or move the work into a <code>computed()</code>.
  </ngmd-step>
  <ngmd-step title="Stop recording">
    Click <strong>Stop recording</strong>.
  </ngmd-step>
</ngmd-workflow>

### Find a stale value

<ngmd-workflow>
  <ngmd-step title="Record calls">
    Recording turns on the stale check.
  </ngmd-step>
  <ngmd-step title="Look for the stale? chip">
    It marks a pure pipe that got an argument whose contents changed while its reference stayed the same, and did not rerun. Arrays, objects, <code>Date</code>, <code>Map</code> and <code>Set</code> values are compared. The chip clears once the pipe reruns.
  </ngmd-step>
  <ngmd-step title="Replace the reference">
    Replace the object or array instead of mutating it, so the pipe reruns.
  </ngmd-step>
</ngmd-workflow>

### Remove duplicate subscriptions

Open **Async subscriptions** and look for **duplicate subscription** rows. Subscribe once with `@let`, or turn the observable into a signal with `toSignal()`.

### Stop resubscribing

Look for **resubscribing** rows in **Async subscriptions**, and for `async-on-call` in **Lint**. Keep the Observable in a field, or read it with `toSignal()` or `httpResource()`.

## Agent tools

| Tool                       | Live   | What it does                                                                                                                                                                                         |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:scan-pipes`      | no     | Custom pipes and the built-in pipes in use.                                                                                                                                                          |
| `pangular:scan-pipe-usage` | no     | Runs the lint rules above.                                                                                                                                                                           |
| `pangular:explain-pipe`    | partly | One pipe by `name`: where it is declared or used, purity, live counts, time in `transform`, errors, last input and output, the stale warning, resubscribing `\| async` usages and the lint findings. |
| `pangular:record-pipes`    | yes    | Starts or stops call recording with `action`, like **Record calls**.                                                                                                                                 |

`explain-pipe` and `record-pipes` take `page` to pick a tab, and default to the most recent one, except that `record-pipes` with `action: "stop"` and no `page` stops recording on every tab. To give `explain-pipe` call data, call `record-pipes` with `action: "start"` or click **Record calls** in the panel, then use the app. See [Tools](../agents/tools.md#pipes).

## Limits and gotchas

<ngmd-callout type="info" title="Values are redacted">
  Pipe inputs, outputs and async values are redacted like component inputs, then cut to 200 characters. A string that holds JSON, such as the output of the <code>json</code> pipe, is parsed and redacted too, and shown without its line breaks. See <a href="../security.md#what-is-redacted">Access and redaction</a>.
</ngmd-callout>

### The stale warning is experimental

It runs only while recording. It reads the template source, so it needs an unminified development build. When it can't read the template, the pipe's details say the check is off, and so does `explain-pipe`. It compares the first two levels of an argument and up to 50 items per level.

### Signal reads on services are a guess

`signal-read-in-pure-pipe` can't tell a signal on an injected service from a method with no arguments, so it reports those calls at info level.

### Highlighting keeps 10 hosts per component

A component chip keeps up to 10 host elements per page to highlight. When a component has more, `pangular:pipe-usage` gives the number of distinct host elements in `targetTotal`. A report that combines pages keeps at most 10 host elements per component across all pages, and its `targetTotal` adds up the host elements of every page.

### Recording ends on reload

Recording is off by default. Reload the page and it is off again.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does explain-pipe return no call data?">
    Recording is off. Call <code>pangular:record-pipes</code> with <code>action: "start"</code>, or click <strong>Record calls</strong> in the panel, then use the app.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why isn't a pipe from another package listed as built-in?">
    The built-in list covers the <code>&#64;angular/common</code> pipes only.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    The components that use each pipe.
  </ngmd-card>
  <ngmd-card icon="zap" title="Signals" link="/inspectors/signals" cta="Open">
    Signals a pure pipe should not read.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Read">
    What the devtools redact, and what they don't.
  </ngmd-card>
</ngmd-card-grid>
