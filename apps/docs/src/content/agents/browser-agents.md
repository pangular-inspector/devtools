---
title: Browser agents
description: The overlay registers the read-only agent tools on the page through WebMCP and Chrome DevTools for agents, so a browser agent finds them without MCP setup.
---

<ngmd-hero title="Browser agents" gradient>
  An agent that drives the browser finds the read-only devtools tools on the page itself. No MCP client config, no token.
</ngmd-hero>

# Browser agents

Turn it on with `agent: { browserTools: true }` in your [config](../getting-started/configuration.md#inspectors-and-agent-tools). It is off by default, because any script on the page could then call the tools.

When it is on and the overlay connects, it registers the `read` [agent tools](./tools.md) on the page in two ways:

| Mechanism                  | What the page does                                                                                                      | Who finds the tools                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| WebMCP                     | Calls `document.modelContext.registerTool()` for each tool, or `navigator.modelContext.registerTool()` (earlier drafts) | A browser with WebMCP, a WebMCP polyfill or extension, and in-page agents |
| Chrome DevTools for agents | Answers the `devtoolstooldiscovery` event on `window` with one tool group, **Pangular Inspector**                       | The Chrome DevTools MCP server, through `list_3p_developer_tools`         |

Each call goes from the page to the devtools server, which runs the same handler an MCP client gets. The tools are the ones the [MCP server](./mcp-server.md) lists, under the same names, such as `pangular_inspect-component`.

## Which tools the page registers

Only tools in the `read` [safety tier](./tools.md#action-tools). Action and destructive tools, such as `navigate`, `fill-form` or `clear-recordings`, never reach the page.

The config decides the rest, as for MCP clients:

| Option               | Effect on the page tools                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `inspectors.<name>`  | An inspector that is off has no tools on the page.                                                      |
| `agent.tools.<name>` | `false` leaves that inspector's tools off the page.                                                     |
| `agent.readOnly`     | `change-detection` and `hydration` join as `read` tools, without the arguments that act.                |
| `agent.browserTools` | Off by default: nothing is registered on the page. `true` turns it on. The MCP server keeps every tool. |

See [Configuration](../getting-started/configuration.md#inspectors-and-agent-tools).

## How the tools answer

- A tool that takes `page` or `pageId` answers for the page that registered it, unless the agent names another page.
- The answer is the markdown or JSON an MCP client gets. Secret names, JWTs and bearer tokens are masked, as in every answer. See [Redaction](../security.md).
- Answers over 100,000 characters are cut, with a note to narrow the call.
- A WebMCP call resolves to `{content: [{type: 'text', text}]}`. A refused or failed call rejects with the reason.

The WebMCP registration carries the `readOnlyHint`, `untrustedContentHint` and `debugging` annotations. `debugging` marks them as developer tools rather than features of your app, and the Chrome DevTools MCP server lists WebMCP tools with it under `list_3p_developer_tools`. When the browser has WebMCP of its own, the `devtoolstooldiscovery` group leaves out the tools WebMCP already registered, so Chrome DevTools for agents lists each tool once.

## Use them from Chrome DevTools for agents

<ngmd-workflow>
  <ngmd-step title="Start the app">
    Run your app in development with the overlay, and open it in the Chrome that the Chrome DevTools MCP server controls.
  </ngmd-step>
  <ngmd-step title="Turn on third-party tools">
    Start the Chrome DevTools MCP server with <code>--categoryExperimentalThirdParty=true</code>. The category is off by default.
  </ngmd-step>
  <ngmd-step title="List and call">
    Ask the agent to call <code>list_3p_developer_tools</code>. The <strong>Pangular Inspector</strong> group lists the tools. The agent runs one with <code>execute_3p_developer_tool</code>.
  </ngmd-step>
</ngmd-workflow>

## When the page registers them

| Event                                           | What happens                                         |
| ----------------------------------------------- | ---------------------------------------------------- |
| The overlay connects                            | It asks the server for the tools and registers them. |
| `pagehide`                                      | It unregisters them.                                 |
| The page comes back from the back/forward cache | It registers them again.                             |
| `disposeOverlay()` or a second `initOverlay()`  | It unregisters them.                                 |

Without WebMCP, the page only listens for `devtoolstooldiscovery`. It writes nothing to your app's DOM. The [Forms](../inspectors/forms.md) tab leaves these tools out of its WebMCP list, which shows the tools of your app.

<ngmd-callout type="warning" title="Any script on the page can call them">
  In-page agents and other scripts can list WebMCP tools and run them. The tools only read, but they read the server's view of your app, including the source scan. Leave <code>agent.browserTools</code> off if your development page loads scripts you don't trust.
</ngmd-callout>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/agents/tools" title="Tools"></ngmd-pill>
  <ngmd-pill href="/agents/skills" title="Agent skills"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
</ngmd-pill-row>
