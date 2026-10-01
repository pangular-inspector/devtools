---
title: Pipes
description: Custom and built-in pipes, where they are used, live instances, call recording and a pipe lint.
---

<ngmd-hero title="Pipes" gradient>
  Your own pipes and the built-in ones in use. Where they live, which components use them on the page, what they last returned, and what to fix.
</ngmd-hero>

# Pipes

The Pipes tab lists your `@Pipe` classes and the built-in pipes from `@angular/common` that your templates use. It shows the live instances on the page, and records calls when you ask it to.

## What it shows

### Pipe list

Search by pipe name, class or file. Narrow the list with **Show pipes**: **All pipes**, **Custom**, **Built-in**, **Impure** or **On the page**.

Each row shows the pipe name, its class, and chips:

- **N live**: instances on the page.
- **built-in**, and **NgModule** for pipes that are not standalone.
- **pure** or **impure**.
- **stale?** when recording caught a possible stale value.

Hover or focus a row to highlight the first component that uses it.

### Declaration

Select a pipe to see its class, whether it comes from `@angular/common` or your project, its file, and whether it is standalone and pure. A pure pipe reruns only when an argument changes. An impure pipe reruns on every check.

### Used in templates

For built-in pipes, every template that uses it, with file and line. The scan reads interpolations, bound attributes, `@if`, `@else if`, `@for`, `@switch` and `@case` conditions, `@defer` triggers and `@let` values.

### Live on the page

The number of instances and the components that use them. Click, hover or focus a component chip to highlight it. With recording on, this block adds the call count, the last input and output, a per-instance breakdown and the last caller.

### Async subscriptions

When templates use `| async`, the tab lists each subscription with its component and latest value. This needs no recording. Each `| async` subscribes on its own. Two on the same source run the work twice, so the tab marks those rows **duplicate subscription**.

A source that changes on three reports in a row, like `getData() | async` returning a new Observable on each check, is marked **resubscribing**. `AsyncPipe` unsubscribes and subscribes again every time the source changes, so with `HttpClient` each check sends a request. A method that returns the same Observable each time is not marked.

### Lint

| Rule                       | Severity      | Finds                                                                                                                                                                                                                                                  |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `impure-pipe-in-for`       | warning       | An impure pipe inside an `@for` block. It runs on every check, possibly once per row.                                                                                                                                                                  |
| `json-pipe-in-template`    | info          | `\| json` left in a template. It is a debugging aid.                                                                                                                                                                                                   |
| `signal-read-in-pure-pipe` | warning, info | A pure pipe whose `transform()` reads a `signal`, `input`, `computed`, `linkedSignal`, `toSignal` or `model` field of the pipe (warning). A call with no arguments on an injected service, like `this.rates.current()`, might be a signal read (info). |
| `async-on-call`            | info          | A method call piped to `\| async`, like `getUsers() \| async`. If the method builds a new Observable each time, `AsyncPipe` resubscribes on every check. Signal, `input`, `computed` and `toSignal` fields of the component are skipped.               |

## Where the data comes from

<ngmd-card-grid columns="3">
  <ngmd-card icon="file" title="Source scan">
    <code>&#64;Pipe</code> classes with name, class, file, standalone and pure flags. Built-in pipes with every usage site.
  </ngmd-card>
  <ngmd-card icon="zap" title="Live page">
    The overlay finds pipe instances in the rendered views. It is read-only until you record.
  </ngmd-card>
  <ngmd-card icon="search" title="Lint">
    The server checks your source for the four rules above.
  </ngmd-card>
</ngmd-card-grid>

### Built-in pipes

The built-in list covers the `@angular/common` pipes: `async`, `currency`, `date`, `number`, `i18nPlural`, `i18nSelect`, `json`, `keyvalue`, `lowercase`, `percent`, `slice`, `titlecase` and `uppercase`. Pipes from other packages are not listed as built-in.

### Live instances

Live discovery walks the rendered views with `ng.getComponent` and related debug helpers. It needs a development build.

### Recording

Click **Record calls** to count calls and keep the last input and output of each pipe. Recording patches each pipe's `transform` in the inspected page, on every connected tab. It covers the pipes found on the page. Click **Stop recording** when you are done.

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
    A pipe with a high call count reruns on every check. Make it pure, or move the work into a <code>computed()</code>.
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

| Tool                       | Live   | What it does                                                                                                                                                            |
| -------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ng-devtools:get-pipes`    | no     | Custom pipes and the built-in pipes in use.                                                                                                                             |
| `ng-devtools:lint-pipes`   | no     | Runs the lint rules above.                                                                                                                                              |
| `ng-devtools:explain-pipe` | partly | One pipe by `name`: where it is declared or used, purity, live counts, last input and output, the stale warning, resubscribing `\| async` usages and the lint findings. |

Agents can't turn recording on. To give `explain-pipe` call data, click **Record calls** in the panel first. See [Tools](../agents/tools.md).

## Limits and gotchas

<ngmd-callout type="info" title="Values are redacted">
  Pipe inputs, outputs and async values are redacted like component inputs, then cut to 200 characters. A string that holds JSON, such as the output of the <code>json</code> pipe, is parsed and redacted too, and shown without its line breaks. See <a href="../security.md#what-is-redacted">Access and redaction</a>.
</ngmd-callout>

### The stale warning is experimental

It runs only while recording. It reads the template source, so it needs an unminified development build. When it can't read the template, it stays quiet. It compares the first two levels of an argument and up to 50 items per level.

### Signal reads on services are a guess

`signal-read-in-pure-pipe` can't tell a signal on an injected service from a method with no arguments, so it reports those calls at info level.

### Recording ends on reload

Recording is off by default. Reload the page and it is off again.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does explain-pipe return no call data?">
    Recording is off. Agents can't turn it on. Click <strong>Record calls</strong> in the panel first.
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
