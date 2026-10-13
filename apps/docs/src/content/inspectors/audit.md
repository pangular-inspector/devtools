---
title: Audit
description: One ranked list of what the inspectors found on the running page, an axe pass over the app, and a before and after comparison of a change.
---

<ngmd-hero title="Audit" gradient>
  Everything the inspectors found wrong on the page in one ranked list, with an accessibility pass and a way to measure a fix.
</ngmd-hero>

# Audit

The Audit tab gathers the findings of the other inspectors into one list, ranked by severity. It adds an axe-core pass over the app when you run one. Take a baseline before a change and an after audit once it is in, and the tab compares the two: what was resolved, what is new, and how the key numbers moved.

Agents get the same list from the `audit` tool. See [Agent tools](#agent-tools).

## What it shows

### Findings

Each row is one finding:

| Part           | What it shows                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity       | **error**, **warning** or **info**.                                                                                                                                             |
| Area           | The inspector it comes from, or **Accessibility** for the axe pass.                                                                                                             |
| Subject        | The component class, route, form, URL or pipe it is about.                                                                                                                      |
| Count          | How many times or places it occurs, as **3×**.                                                                                                                                  |
| Why            | One line on why it is a problem. Values are masked like other live data.                                                                                                        |
| Rule           | The check's id, such as `onpush-candidate`, `wildcard-not-last` or `image-alt`.                                                                                                 |
| Agent tool     | The tool that explains the finding in detail, with its arguments, such as `explain-error { id: "e1" }`.                                                                         |
| Show component | For errors and hydration mismatches, opens the [Components](./components.md) tab on the component. Only with the Components inspector on.                                       |
| Show in page   | For other findings that map to an element, such as an axe violation, scrolls the page to it and draws a box around. Only with the Components inspector on, which draws the box. |

Errors come first, then warnings, then info. Within a severity, accessibility comes first, then errors, hydration, change detection, leaks, router, forms, HTTP and pipes, and then the finding that occurs most often. Filter by text, **Area** or **Severity**, and press `Escape` to clear the search. Hovering a row with an element outlines that element in the app, when the Components inspector is on.

### Where the findings come from

The audit runs no check of its own. It reads what each inspector already collected and turns its results into findings.

| Area             | Findings                                                                                                                                                                                                                | Detail tool                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Accessibility    | Each axe rule the app breaks, per component, with the rule's impact as severity: critical and serious are errors, moderate a warning, minor info.                                                                       | `audit` with `area`         |
| Errors           | Each error group, with its count and owning component.                                                                                                                                                                  | `explain-error`             |
| Hydration        | Mismatches, server HTML that was not hydrated at all, and hosts that skip hydration.                                                                                                                                    | `hydration`                 |
| Change detection | The hints of the [change detection diagnosis](./components.md#change-detection): OnPush candidates, inputs mutated in place, components that depend on zone.js. Also components whose slowest check took 16 ms or more. | `diagnose-change-detection` |
| Leaks            | Components still retained after destroy, and subscriptions still open after their component went away.                                                                                                                  | `find-leaks`                |
| Router           | The findings of [Router Lint](./router.md), redirect loops included.                                                                                                                                                    | `lint-routes`               |
| Forms            | The findings of Forms Lint, and NG01xxx setup errors.                                                                                                                                                                   | `lint-forms`                |
| HTTP             | Failed `HttpClient` calls by endpoint, calls a fault rule failed, and calls the browser fetched again because the transfer cache did not keep them.                                                                     | `list-http-calls`           |
| Pipes            | The findings of the pipe lint, from the source scan.                                                                                                                                                                    | `lint-pipes`                |

### Key numbers

Under the list, the tab shows the numbers a before and after comparison reads:

| Number                           | Source                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Change detection cycles          | The cycles of the current recording.                                         |
| Mean cycle time, slowest cycle   | The duration of those cycles, in ms.                                         |
| Wasted checks                    | Refreshed checks that changed nothing, as a count and a share of all checks. |
| Retained components              | Destroyed components still in memory after enough navigations.               |
| Open subscriptions after destroy | Counted while subscription tracking is on.                                   |
| Error groups, error occurrences  | The errors the page hit since it loaded.                                     |
| axe rules broken, axe elements   | From the last axe pass.                                                      |
| Failed HTTP calls                | Failed calls the page made, cancelled calls and fault rules left out.        |
| Errors, warnings and info found  | The findings by severity.                                                    |

A number shows only when its area could be read. **Not checked** lists the areas the audit could not read and why, such as a missing change detection recording or an inspector that is turned off.

### Run axe

**Run axe** runs [axe-core](https://github.com/dequelabs/axe-core) over the app on the page. The overlay loads axe-core only then, so a page that never runs a pass doesn't download it. The pass:

- Leaves out the overlay's own elements: the popup, the change detection flash layer, the hydration outline and the highlight box.
- Skips frames, and reports violations only.
- Reads the DOM and changes nothing in the app.
- Masks selectors, attributes and axe's summaries, and leaves out text content and `value` attributes. `alt`, `title`, `aria-label` and `name` values are always replaced, since they can hold personal text.
- Names the component whose template holds each element, when the Components inspector is on.

The tab keeps the last pass of each page, and the status line says when it ran. A reload of the page drops its pass, since the elements it names are gone. A page whose overlay has no axe pass, or that takes more than 45 seconds, gets an error that says so.

### Before and after

<ngmd-workflow>
  <ngmd-step title="Take a baseline">
    Run axe and record change detection if you want their numbers, then click <strong>Take baseline</strong>.
  </ngmd-step>
  <ngmd-step title="Make the change">
    Edit the code. The page reloads with the same page id, so the baseline stays.
  </ngmd-step>
  <ngmd-step title="Take an after audit">
    Run axe and record the same interactions again, then click <strong>Take after audit</strong>.
  </ngmd-step>
</ngmd-workflow>

The comparison shows each number before and after, with the change marked **better** or **worse** (lower is better for every number). Under it, **Resolved** lists findings the after audit no longer has, **New** the ones only it has, and **Changed count** the findings whose count moved. When only one of the two audits ran axe, or both used the same axe pass, accessibility findings are left out of the comparison, and a note says so. Run axe again after the change. A baseline an agent took compares with an after audit you take here, and the other way round. Taking another baseline drops the after audit. **Clear** drops both.

### Pages

When several tabs report, **Page** picks the one to audit. The panel of a tab starts on that tab.

## Agent tools

| Tool             | What it does                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:audit` | The ranked findings with the tool to call for each, the key numbers and what could not be checked. `axe: true` runs a fresh axe pass first. `session` takes a baseline (`before`), compares (`after`) or `clear`s it. |

The tool is an `action` tool because of `axe`. With `agent.readOnly`, it has no `axe` argument, reads the last pass the panel ran, and is marked read-only. It can then take a baseline only for a page that has none, and compare with it: `session: "clear"`, and `session: "before"` over an existing baseline, are refused, so the agent never drops a baseline you took. An area whose agent tools are hidden with `agent.tools.<name>: false` is left out of the agent's answer, and **Coverage** says its agent tools are off. The panel still shows it. With the Components inspector's agent tools off, the axe findings name no component and no instance id. See [Tools](../agents/tools.md#audit) and [Inspect, fix and verify](../guides/inspect-fix-verify.md).

## Limits and gotchas

<ngmd-callout type="info" title="Values are redacted">
  Messages, routes, URLs and axe selectors are masked like other live values: secret field names, JWTs, bearer tokens and secret <code>key=value</code> pairs. See <a href="../security.md#what-is-redacted">Access and redaction</a>.
</ngmd-callout>

### Caps

| What                     | Kept                                             |
| ------------------------ | ------------------------------------------------ |
| Findings per audit       | 300, the most severe first.                      |
| axe rules per pass       | 100, the ones with the most elements first.      |
| Elements per axe rule    | 20. The count still covers all of them.          |
| Pages with a session     | 10. The one unused the longest goes first.       |
| Session and axe pass age | 30 minutes after their last use, then forgotten. |

### Numbers depend on what you did

Change detection numbers come from the current recording, and leak and error counts start again when the page reloads. To compare a change, do the same things on the page before each audit, and record change detection for both.

### Retention with DI debug data

On Angular 16.2 and later in a development build, Angular's DI debug data keeps every destroyed component in memory, so the audit, like [find-leaks](./components.md#leaks), doesn't judge retention there. Open subscriptions after destroy still count.

### On Angular Native and NativeScript

An [Angular Native](../getting-started/angular-native.md) or [NativeScript](../getting-started/nativescript.md) app reports change detection, leaks and errors, so its audit and its before and after sessions work as for a browser page. The app has no DOM, so **Run axe** and `axe: true` say so instead of running a pass, and **Coverage** lists accessibility as off with the reason.

### It needs a live page

The audit reads what connected pages report. A [static report](../getting-started/cli.md#static-report) has no page, so the tab says so.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/guides/inspect-fix-verify" title="Inspect, fix and verify"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/inspectors/errors" title="Errors"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
