---
title: Inspect, fix and verify
description: Let an agent audit the running app, fix what it finds and prove the fix with a before and after comparison.
---

<ngmd-hero title="Inspect, fix and verify" gradient>
  Audit the live page, change the code, audit again and compare. The agent sees what it fixed, and what it broke.
</ngmd-hero>

# Inspect, fix and verify

This guide walks an agent through one loop with the `audit` tool: take a baseline of the running page, fix a finding in the code, and compare the page after the change with the baseline. You can run the same loop by hand on the [Audit](../inspectors/audit.md) tab.

## Before you start

<ngmd-card-grid columns="3">
  <ngmd-card icon="terminal" title="MCP over HTTP" link="/agents/mcp-server">
    The agent connects to the MCP endpoint of the server that runs the app. The stdio server has no page.
  </ngmd-card>
  <ngmd-card icon="zap" title="A page in a browser" link="/getting-started/overlay">
    The app is open with the overlay loaded, in a development build.
  </ngmd-card>
  <ngmd-card icon="shield" title="Action tools allowed" link="/getting-started/configuration">
    <code>agent.readOnly</code> is off, so the agent can run axe and record change detection.
  </ngmd-card>
</ngmd-card-grid>

## The loop

<ngmd-workflow>
  <ngmd-step title="Pick the page">
    Find the page id with <code>list-pages</code>.
  </ngmd-step>
  <ngmd-step title="Record what you measure">
    Start a change detection recording and use the app the way the user does.
  </ngmd-step>
  <ngmd-step title="Take the baseline">
    Call <code>audit</code> with <code>session: "before"</code> and <code>axe: true</code>.
  </ngmd-step>
  <ngmd-step title="Read the detail and fix">
    Call the detail tool each finding names, then change the code.
  </ngmd-step>
  <ngmd-step title="Repeat the same steps">
    Wait for the reload, record again and use the app the same way.
  </ngmd-step>
  <ngmd-step title="Compare">
    Call <code>audit</code> with <code>session: "after"</code> and <code>axe: true</code>.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Pick the page

Call `list-pages`. If more than one tab reports, pass its id as `page` to every call below. Without `page`, each tool uses the most recent page, which can change when you open another tab.

## Step 2: Record what you measure

The audit reads what the inspectors already hold. Errors, hydration, router, form and HTTP findings are there as soon as the page reports. Change detection numbers need a recording:

```json
{"tool": "pangular:change-detection", "arguments": {"record": "start", "page": "k3x9"}}
```

Then use the app: open the screens and click what the change is about. Subscriptions after destroy need tracking, so call `track-subscriptions` with `action: "start"` too if leaks matter to the change.

## Step 3: Take the baseline

```json
{"tool": "pangular:audit", "arguments": {"session": "before", "axe": true, "page": "k3x9"}}
```

The answer is the ranked list of findings, the key numbers and what the audit could not check. It saves the audit as the page's baseline for 30 minutes after its last use. A reload keeps the page id, so the baseline survives the rebuild after your change.

## Step 4: Read the detail and fix

Each finding names the tool that explains it, with the arguments to pass, such as `explain-error { id: "e1" }` or `diagnose-change-detection`. For accessibility findings, call `audit` with `area: "accessibility"`: it lists the elements that break each axe rule, their component and instance id, and a link to the rule. Pass an instance id to `inspect-component`, or to `highlight` to show the user where it is.

Fix one area at a time, so the comparison says what each change did.

## Step 5: Repeat the same steps

After the reload, the recording, the leak data and the error list start again. Start a change detection recording and use the app the same way as before the change. The numbers only compare when the page did the same work.

## Step 6: Compare

```json
{"tool": "pangular:audit", "arguments": {"session": "after", "axe": true, "page": "k3x9"}}
```

The answer adds a **Before and after** section:

| Part        | What it shows                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Numbers     | Each number before and after, with the difference marked better or worse. Lower is better for every number. |
| Resolved    | Findings the baseline had and the after audit doesn't.                                                      |
| New         | Findings only the after audit has. Look at these before you call the change done.                           |
| Still there | Findings in both. When a count moved, it lists those findings, otherwise the first five.                    |

When only one of the two audits ran axe, or both used the same pass, accessibility findings are not compared, and a note says so. A reload drops the page's last axe pass, so pass `axe: true` again after the change. Call `audit` with `session: "after"` again after another fix: it compares with the same baseline. Call it with `session: "before"` to start over from the current state, or `session: "clear"` to drop the baseline.

## Show the user

Call `open-in-panel` with `tab: "audit"` to give the user a link to the same list and comparison in the panel.

## Gotchas

<ngmd-callout type="warning" title="Read-only agents">
  With <code>agent.readOnly</code>, <code>audit</code> has no <code>axe</code> argument and <code>change-detection</code> can't record. Run axe and the recording from the panel, and the agent's audit reads them.
</ngmd-callout>

- Findings are matched by area, rule and subject, not by position. A renamed component or route counts as one finding resolved and one new.
- An area whose inspector or agent tools are off is left out, and **Coverage** names it.
- Pipe findings come from the source scan, so they change only when the source does.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/audit" title="Audit"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
