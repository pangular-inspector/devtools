---
title: Errors
description: Errors from Angular's ErrorHandler, uncaught errors, unhandled promise rejections and the console log of the running page.
---

<ngmd-hero title="Errors" gradient>
  The errors your page hit, grouped by message, with their Angular error code, the component they came from and the page's console log.
</ngmd-hero>

# Errors

The Errors tab collects what goes wrong on the running page: errors that reach Angular's `ErrorHandler`, uncaught errors and unhandled promise rejections. It groups them by message, links Angular error codes to their reference page, and points at the component that threw when it can find it. A second view shows the page's console calls.

<ngmd-image src="/images/panel/errors.png" alt="The Errors tab with one error that reached the ErrorHandler twice, report service is down, with a Show component link to RoutesExample and its stack open, plus Errors and Console view buttons"></ngmd-image>

## What it shows

### Errors

Each row is one message with:

| Part               | What it shows                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Count              | How many times the page hit this message, as **3×**.                                                                                                |
| Message            | The error name and message, masked and cut to 500 characters.                                                                                       |
| Code chip          | The Angular error code, such as **NG0100**. It links to the code's page in [Angular's error reference](https://angular.dev/errors) when it has one. |
| Source             | **ErrorHandler**, **Uncaught** (a `window` error) or **Unhandled rejection**.                                                                       |
| Time               | When the page last hit it.                                                                                                                          |
| **Show component** | Opens the [Components](./components.md) tab with the owning component selected.                                                                     |
| **Stack**          | The stack of the first occurrence, collapsed until you open it.                                                                                     |
| Explainer          | For NG0100, hydration mismatches and missing providers, what the page read about the error. See [Explainers](#explainers).                          |

The list is newest first. Search by message, code or component name, and press `Escape` to clear the search.

### Explainers

Three kinds of Angular error get a box under the message with what the overlay read about them.

#### What changed (NG0100)

For `ExpressionChangedAfterItHasBeenCheckedError`, the box shows:

| Row          | What it shows                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Binding**  | The property Angular names, such as `title`, and the compiled template function on the stack, such as `TripList_Template`. A text interpolation has no name. |
| **Previous** | The value of the first check, as Angular prints it.                                                                                                          |
| **Current**  | The value of the second check.                                                                                                                               |
| **Held by**  | The fields of the component that hold the current value now, signals included. Getters and `computed` signals don't run.                                     |

**Written by** lists the named signals written with the current value in the 2 seconds before the error. Values are compared the way Angular prints them, from the value as it was written, so dates and objects match too. When some of those signals are named like the binding or a field under **Held by**, only those are listed. With write stacks on (see [Signals](./signals.md)), each one shows the app frames that wrote it. Without a match, the box says where to look instead. The overlay hears signal writes only while the Signals inspector is on, on Angular 17.0 or later, and only for signals with a `debugName`.

When the binding or a field that holds the value has a secret-looking name, both values show as `[redacted]`.

#### Server vs client DOM (NG0500 to NG0503)

For a hydration mismatch, the box shows Angular's first sentence and a line diff of the server HTML Angular expected (`−`) and the client DOM it found (`+`). Angular marks the node it means with `<-- AT THIS LOCATION`. The diff comes from the error message. When the message has no DOM, it comes from what Angular recorded on the component host instead, the same data as the [Hydration](./components.md#hydration) section. When Angular suspects a browser extension or a third-party script, the box says so.

Hydration errors are raised once, while the app hydrates. The page catches them only if the overlay is already running when hydration finishes. If the app imports the overlay itself after bootstrap, such as after `whenStable()`, the hydration errors of that page load are not in the list. Read them in the browser console instead, or start the overlay before the app bootstraps. See [Capture starts with the overlay](#capture-starts-with-the-overlay).

#### Missing provider (NG0201)

For `NullInjectorError` and NG0201, the box shows the token, Angular's dependency path and the source injector. **Explain lookup** walks the lookup of that token from the component that asked for it: each injector Angular asks, in order, whether it provides the token, and why the lookup stops. It reads the tree the [Injectors](./injectors.md) tab shows, so it needs that tab on, and it assumes no `self`, `skipSelf`, `host` or `optional` flag. The `explain-injection` agent tool takes those flags.

### Console

Click **Console** to see the page's `console.log`, `info`, `warn`, `error` and `debug` calls, newest first. Pick a level in **Console level**, or search the text. A call repeated in a row shows once with a count. A call that mentions an Angular code gets a code chip too.

### Pages

When several tabs report, **Page** picks one, or **All pages** to see them together. The panel of a tab starts on that tab.

## Where the data comes from

<ngmd-card-grid columns="3">
  <ngmd-card icon="shield" title="ErrorHandler">
    The overlay wraps the <code>handleError</code> method of the app's <code>ErrorHandler</code>, your own or Angular's. Your handler still runs, with the same arguments, after the overlay records the error. Before Angular 16.2 the overlay can't find the handler, so it records what Angular's default handler logs.
  </ngmd-card>
  <ngmd-card icon="zap" title="Window">
    Listeners for <code>error</code> and <code>unhandledrejection</code> on <code>window</code>. They only listen, so the browser and Angular handle the event as before.
  </ngmd-card>
  <ngmd-card icon="terminal" title="Console">
    One shared tap on <code>console</code>, the same one the Forms, Analog and SSR & HTTP inspectors read their messages from. Every call still prints.
  </ngmd-card>
</ngmd-card-grid>

Angular forwards `window` errors to its `ErrorHandler` when the app uses `provideBrowserGlobalErrorListeners()`. The overlay counts that error once.

### The owning component

The tab looks for the component in this order:

1. The element whose event listener threw, through `ng.getOwningComponent`. This covers template listeners such as `(click)`.
2. A component Angular names in the message, as in `used in the 'TripCard' component template`.
3. A component class in the stack, such as `_TripCard.book` or a compiled template function such as `TripList_Template`.

A name from the message or the stack counts only when a component with that class name is on the page. The tab uses the same component ids as the Components tab, so **Show component** selects that instance.

### Angular error codes

A `RuntimeError` carries its code, and other errors carry it in the message. The tab reads `NG0` codes (runtime, such as `NG0100` and `NG01203`) and compiler codes (such as `NG8001`).

## Agent tools

| Tool                         | What it does                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pangular:list-errors`       | The error groups, with count, code link, owning component and source.                                                                                                                            |
| `pangular:explain-error`     | One error by `id`, or an Angular `code`: the message, the owning component, the stack, the reference page and cause, and the explainer of an NG0100, a hydration mismatch or a missing provider. |
| `pangular:list-console`      | The console calls, by `level` or `search`.                                                                                                                                                       |
| `pangular:explain-injection` | Walks the lookup of a token from a component, with `self`, `skipSelf`, `host` and `optional`. Belongs to the [Injectors](./injectors.md#agent-tools) inspector.                                  |

The known causes come from Angular's error reference, in a sentence or two. For a code without a reference page, `explain-error` says so. See [Tools](../agents/tools.md#errors).

## Limits and gotchas

<ngmd-callout type="info" title="Values are redacted">
  Messages, stacks and console text are masked like other live values: secret field names, JWTs, bearer tokens and secret <code>key=value</code> pairs. See <a href="../security.md#what-is-redacted">Access and redaction</a>.
</ngmd-callout>

### Caps

| What                  | Kept per page                         |
| --------------------- | ------------------------------------- |
| Error groups          | 100. The least recent one goes first. |
| Console calls         | 200. The oldest one goes first.       |
| Message, console text | 500 characters.                       |
| Explainer values      | 200 characters each.                  |
| Explainer DOM         | 3,000 characters and 80 lines a side. |
| Stack                 | 40 lines and 4,000 characters.        |

The tab says how many groups or calls a page dropped.

### Capture starts with the overlay

The overlay starts after the page claims its page id, so errors and console calls from before it connects are not in the list. The `ErrorHandler` is wrapped as soon as the app has bootstrapped. Until then, the tab counts the `ERROR` lines Angular's default handler logs, and says the handler isn't wrapped yet.

### It needs a development build

Finding the `ErrorHandler` and the owning component uses Angular's debug APIs, which only development builds have.

### Turn it off

Set `inspectors: {errors: false}` to drop the tab, the collector and the agent tools. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why does an error have no component?">
    It did not come from a template listener, and no component on the page matches a class name in its message or stack. Errors from services, timers and promises often have none.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does a code chip have no link?">
    Angular's error reference has no page for that code.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does the overlay change how my ErrorHandler behaves?">
    No. Your handler gets every error, with the same arguments, and its return value is passed back. Stopping the overlay puts the method back.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Components" link="/inspectors/components" cta="Open">
    The component an error points at.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Agent tools" link="/agents/tools" cta="Browse">
    Every tool a coding agent can call.
  </ngmd-card>
</ngmd-card-grid>
