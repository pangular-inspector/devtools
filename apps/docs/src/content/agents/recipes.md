---
title: Recipes for agents
description: Prompts to paste into Claude Code, Cursor or Copilot for common debugging tasks, with the agent tools each one leads to and what to check in the answer.
---

<ngmd-hero title="Recipes for agents" gradient>
  Prompts for the questions developers ask most, with the tools an agent calls to answer them.
</ngmd-hero>

# Recipes for agents

Each recipe is a prompt you paste into your coding agent, the agent tools it leads to, and what to check in the answer. The prompts work in any client that is connected to the HTTP endpoint of the [MCP server](./mcp-server.md), such as Claude Code, Cursor or VS Code with Copilot. The stdio server leaves out the tools that read the running app, so these recipes need HTTP. See [What stdio can answer](./mcp-server.md#what-stdio-can-answer). Clients see the tools as `pangular_<name>`. See [Names](./tools.md#names).

Keep the app open in a development build with the overlay loaded while the agent works. The live tools read the pages that report to the server. If several tabs are open, ask the agent to call `list-pages` first and name the tab.

<ngmd-callout type="tip" title="Ready-made prompts">
  The HTTP endpoint also offers MCP prompts, such as <code>fix-form</code> and <code>debug-error</code>, which clients that support them show as slash commands. See <a href="./mcp-server.md#prompts">Prompts</a>.
</ngmd-callout>

## Debug an invalid form

```text
The checkout form won't submit. Use the Pangular tools to find which fields make it
invalid and why, fix the cause in the code, then show me the form is valid.
```

| Step                        | Tool                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Record the starting point   | `inspect-forms` with `form` for its status, `list-form-changes` for a marker                                        |
| Find the invalid fields     | `explain-invalid-forms`                                                                                             |
| Look at one field           | `explain-field` with `form` and `path`                                                                              |
| See why submit does nothing | `explain-submit`                                                                                                    |
| Reproduce after the fix     | Enter the original input again and leave the field (or submit), then `wait-for` with `condition: "form"` and `form` |
| See what changed            | `explain-form-changes` with `form` and the marker as `after`                                                        |
| Prove the form is valid     | `inspect-forms` with `form`, compared with the status recorded first                                                |

A code change can reload the page and reset the form, so enter the same input as before the fix and wait until the form is settled before you compare. Leave the field before you wait, since a control with `updateOn: 'blur'` keeps its old value and validity until then. For a control with `updateOn: 'submit'`, submit the form first: leaving the field does not update it. `explain-form-changes` reads the change events recorded since the marker, not a saved copy of the form, so the status from `inspect-forms` is the proof. Check that the answer names the failing validator and its message for each field, not only that the form is invalid. Values that look secret stay redacted. See [Forms](./tools.md#forms).

## Explain a failed navigation

```text
Clicking "My trips" sends me back to the home page. Use the Pangular tools to explain
the last navigations: who started them, which guard or redirect changed the URL, and why.
```

| Step                         | Tool                                        |
| ---------------------------- | ------------------------------------------- |
| Read the recent navigations  | `explain-navigation`                        |
| Read the current route       | `inspect-route`                             |
| Time each guard and resolver | `record-guards`, then navigate again        |
| Get a repro to keep          | `explain-navigation` with `format: "repro"` |

`record-guards` is an action tool, and the server tells agents to call action tools only when you ask for the change. Add "record the guards" to the prompt for the timing. Check that the answer names the guard verdict or the redirect behind each hop. See [Router](./tools.md#router).

## Find a missing provider

```text
The trip details page throws NG0201 for TripService. Use the Pangular tools to show where
Angular looked for it and why no injector provided it, then fix the providers.
```

| Step                          | Tool                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Find the error and its owner  | `list-errors`, then `explain-error` with its `id`                                                                              |
| Walk the lookup path          | `explain-injection` with the injector that made the failing request as `injector`, the token and the failing injection's flags |
| Read the providers at a level | `inspect-providers`                                                                                                            |

`explain-error` adds the missing provider explainer. Start the lookup from the injector that made the failing request. The error message and stack name the class that injects the token. If that class is a component or directive, pass its class name, or the owner id from `explain-error` when the owner is that class. If it is a service, its class name is not an injector: find the injector that provides the service, such as `Root`, `Route: admin` or the component that lists it in `providers`, and pass that. Pass the flags the failing injection used, such as `self: true`, `skipSelf`, `host` or `optional`, so the lookup follows the same path. If it says **Component: not found**, no component owns the error, but the requesting injector can still be on the page: a service that fails in `Root` has no owner, and `explain-injection` can still start at `Root`. Only when the requesting injector is missing from the tree, for example when a routed component fails before it is in the tree, does `explain-injection` answer **No injector on page**. Then read the stack of the error for the class that injects the token, then call `scan-providers` to see where the source provides the token. A lookup from an injector that is on the page, such as the parent route's component or `Root`, is a separate lookup, not part of the failing one: it can resolve differently, for example when the failing injection used `self`. When an owner is found, check that the answer marks each injector on the path as **provides it**, **not provided**, **hidden**, **skipped**, **not asked** or **unknown**. See [explain-injection](./tools.md#explain-injection).

## Find wasted change detection

```text
Typing in the search box feels slow. Record change detection while I type, then use the
Pangular tools to tell me what triggered each check and which components ran for nothing.
```

| Step                       | Tool                        |
| -------------------------- | --------------------------- |
| Start and stop a recording | `record-change-detection`   |
| Read the cycles            | `change-detection`          |
| Find the waste             | `diagnose-change-detection` |

The recording needs Angular 20 or later. Check that the answer names the trigger of each cycle and the checks that changed nothing. See [diagnose-change-detection](./tools.md#diagnose-change-detection).

## Check that a fix worked

```text
Before you change anything, take a Pangular audit of this page as a baseline. After the
fix, repeat the same steps, run the audit again and compare the two.
```

The agent calls `audit` with `session: "before"`, makes the change, repeats the same steps in the app and calls `audit` with `session: "after"`, which compares the two. [Inspect, fix and verify](../guides/inspect-fix-verify.md) walks through the loop. The `verify-fix` prompt is a lighter check without the audit: it repeats the calls that showed the problem, compares the answers and looks for new errors.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/agents/skills" title="Agent skills"></ngmd-pill>
  <ngmd-pill href="/guides/inspect-fix-verify" title="Inspect, fix and verify"></ngmd-pill>
</ngmd-pill-row>
