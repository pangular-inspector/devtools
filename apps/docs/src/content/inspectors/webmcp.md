---
title: WebMCP
description: The WebMCP tools your page registers for browser agents, every call to them, and what each call changed in the app.
---

<ngmd-hero title="WebMCP" gradient>
  The tools your page offers to browser agents through WebMCP, each call an agent makes, and the HTTP requests, store actions, navigations, form changes and signal writes that followed.
</ngmd-hero>

# WebMCP

WebMCP lets a page offer tools to an agent that drives the browser. The page registers each tool with `modelContext.registerTool()`, and Angular Signal Forms registers one for a form that sets `experimentalWebMcpTool`. See [WebMCP](https://angular.dev/ai/webmcp) for the API itself.

The WebMCP tab lists those tools and records every call to them. For each call it traces what happened in the app: the HTTP requests, NgRx actions, navigations, form events and signal writes the call caused. Use it to check what a tool really does before you let an agent run it, and to catch a tool that claims to only read but changes data.

## What it shows

### Tools

Every tool the page registered, with:

| Part        | What it shows                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Name        | The tool name. A name another tool on the page also uses is marked as a duplicate.                                                   |
| Status      | `registering`, `registered` or `failed`, with the error for a failed registration.                                                   |
| Description | The `description` the page passed.                                                                                                   |
| Annotations | The annotations the page claims, such as `readOnlyHint`.                                                                             |
| Inputs      | Each input from the tool's input schema, with its type, and which ones are required.                                                 |
| Form        | For a Signal Forms tool, the form it submits. The [Forms](./forms.md#webmcp-tool) tab shows the same tool in the form's details too. |

The list leaves out the [browser agent tools](../agents/browser-agents.md) that Pangular Inspector registers itself, so it shows the tools of your app only.

### Calls

Every call to a tool, with its start time, duration, outcome, arguments and result. The outcome is one of:

| Outcome     | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| `running`   | `execute` has not settled yet.                         |
| `done`      | `execute` resolved.                                    |
| `submitted` | A Signal Forms tool submitted its form.                |
| `failed`    | A Signal Forms tool could not submit, with the reason. |
| `threw`     | `execute` threw or rejected, with the error message.   |

### Effects

Select a call to see its effects. An effect is something another inspector recorded while the call ran:

| Layer   | Effect                   | Changes data when                                 | Opens in                    |
| ------- | ------------------------ | ------------------------------------------------- | --------------------------- |
| HTTP    | An HTTP request          | Its method is not `GET`, `HEAD` or `OPTIONS`      | [SSR & HTTP](./ssr-http.md) |
| NgRx    | A store action or change | Always                                            | [Store](./ngrx-store.md)    |
| Router  | A navigation             | It reaches a new path                             | [Routes](./router.md)       |
| Forms   | A form event             | It is a value change, a submit or a reset         | [Forms](./forms.md)         |
| Signals | A signal write           | It is a write to a signal of your app (see below) | [Signals](./signals.md)     |

Each effect is marked with how sure the trace is:

- **caused**: a collector saw the effect start while `execute` ran, or later in the call's Zone.js zone.
- **probably caused**: the effect started between the call's start and 500 ms after it settled, and the user pressed no key or pointer in that time.

Each effect links to the tab that shows it in full.

### Read-only check

WebMCP's tool annotations define `readOnlyHint` and no other hint about writes. A tool without `readOnlyHint: true` may change data. For a tool that claims `readOnlyHint: true`, the call shows:

- A warning when the call changed data outside signals: a non-read HTTP request, a store action, a form value change, submit or reset, or a navigation to a new path.
- A note when the call only wrote your app's own signals. Signals Angular creates for itself, such as the state of a `resource`, are left out.

### Timeline lane

The [Timeline](./timeline.md) tab has a WebMCP lane with one event per tool call, so you can see calls next to the requests, actions and navigations they caused. A call that threw or failed is marked as an error. A call of a `readOnlyHint` tool that changed data outside signals is marked as a warning. Select a call and open it to land on it in the WebMCP tab.

## Where the data comes from

The overlay replaces `modelContext.registerTool()` once, when it loads, and wraps each tool's `execute`. It reads `document.modelContext`, or `navigator.modelContext` in earlier drafts. The Forms tab reads the same wrapper, so both tabs see the same tools and calls.

The page keeps a log of calls for the whole page. Arguments and results are masked like other live values, then cut to about 4 KB each. A Signal Forms tool's values also follow the masks of its form. See [Access and redaction](../security.md#what-is-redacted).

To tie an effect to a call, the HTTP, NgRx, router, forms and signals collectors note the call that is running when the effect starts:

- While `execute` runs synchronously, the call is the one running.
- When the app uses Zone.js, the overlay runs `execute` in a zone forked from the current one. Work the call starts later, after an `await` or in a timer, still belongs to the call. The fork only adds a property, and everything else goes to the parent zone. The zone ties effects to the call for up to 5 seconds after it settles.
- Without Zone.js, work after the first `await` can only be **probably caused**.

The overlay listens to `pointerdown` and `keydown` passively, to know whether the user was active during a call. If the user was active, only **caused** effects are listed, because a click could have started the rest.

If the page has no `modelContext` and registered no tool, the page sends nothing for this tab.

## How to use it

### Check what a tool does

<ngmd-workflow>
  <ngmd-step title="Call the tool">
    Let your browser agent call the tool, or call it from your own test code.
  </ngmd-step>
  <ngmd-step title="Open the call">
    Open the <strong>WebMCP</strong> tab and select the call. Check its arguments, result and outcome.
  </ngmd-step>
  <ngmd-step title="Read the effects">
    Follow the links to the requests, actions, navigations and form changes the call caused.
  </ngmd-step>
  <ngmd-step title="Fix the annotation">
    If a tool that claims <code>readOnlyHint: true</code> shows a warning, remove the hint or stop the tool from writing.
  </ngmd-step>
</ngmd-workflow>

### Try it in the demo

The [Angular Travel demo](../contributing/demo-apps.md#webmcp-stand-in) adds a stand-in `navigator.modelContext` in development when the browser has none, and its Signal Forms example registers a `sign_up` tool. Follow [Try WebMCP in the demo](./forms.md#try-webmcp-in-the-demo), then open the **WebMCP** tab to see the call and the form changes it made.

## Agent tools

| Tool                    | What it does                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pangular:webmcp-tools` | The page's WebMCP tools: name, description, status, the annotations the page claims, inputs and the form each belongs to.                                                                 |
| `pangular:webmcp-calls` | Calls newest first, with masked arguments and result, outcome and each call's effects, marked caused or probably caused. Warns when a `readOnlyHint` tool changed data. Filter by `tool`. |

Both read the page and take `page`. See [Tools](../agents/tools.md#webmcp).

## Limits and gotchas

### Calls kept

The page keeps the last 100 calls. Set [`limits.webmcpCalls`](../getting-started/configuration.md#limits) to keep between 10 and 1000. When older calls are dropped, `webmcp-calls` says how many and names the limit to raise.

### Signal writes need the Signals tab

The page sees signal writes only for the component the [Signals](./signals.md) tab inspects. Writes to the signals of other components are not listed as effects.

### Tools registered before the overlay

The overlay has no hook that runs before your app. A tool registered before the overlay loaded shows only when the browser lists its tools (`getTools()` or `listTools()`), and its calls are not recorded. Register tools after the overlay loads to see every call. See [WebMCP is best effort](./forms.md#webmcp-is-best-effort).

### Probably caused is a guess

A **probably caused** effect started in the call's time window. Other code on the page, such as a polling timer, can start work in the same window.

### Turn it off

Set `inspectors: {webmcp: false}` in the [configuration](../getting-started/configuration.md#inspectors-and-agent-tools) to remove the tab, the collector and the agent tools. The Forms tab keeps its own WebMCP block.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why is the tab empty?">
    The browser has no <code>modelContext</code>, or the page registered no tool. Use a browser with WebMCP or a WebMCP polyfill, and load the overlay before your app registers its tools.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why is a call marked probably caused when the tool made the request?">
    The request started after an <code>await</code>, and the app does not use Zone.js, so no collector could tie it to the call.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does a read-only tool get a warning?">
    It claims <code>readOnlyHint: true</code>, but a call changed data outside signals. Check the effects marked caused first.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="file" title="Forms" link="/inspectors/forms" cta="Open">
    The WebMCP block of each Signal Form.
  </ngmd-card>
  <ngmd-card icon="compass" title="Timeline" link="/inspectors/timeline" cta="Open">
    Tool calls next to the events they caused.
  </ngmd-card>
  <ngmd-card icon="sparkles" title="Browser agents" link="/agents/browser-agents" cta="Read">
    The read-only agent tools the overlay registers on the page.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Read">
    What the devtools redact, and what they don't.
  </ngmd-card>
</ngmd-card-grid>
