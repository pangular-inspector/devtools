---
title: MCP server
description: Connect a coding agent to the devtools over stdio or HTTP, in Claude Code, Cursor or VS Code.
---

<ngmd-hero title="MCP server" logo="https://cdn.simpleicons.org/modelcontextprotocol/71717A" gradient>
  Give your coding agent the same view of the app that you have. Routes, components, forms, stores and the live page, as MCP tools and resources.
</ngmd-hero>

# MCP server

The devtools expose their inspectors to coding agents as *MCP tools and resources. An agent can list your routes, read the live component tree, explain why a form is invalid, or navigate the app.

There are two ways to connect. Pick one based on the data your agent needs.

## Pick a transport

<ngmd-card-grid columns="2">
  <ngmd-card icon="terminal" title="stdio" cta="Source only">
    Your client starts <code>ng-devtools mcp</code> for your project folder. The server scans your source. No page ever connects to it.
  </ngmd-card>
  <ngmd-card icon="zap" title="HTTP" cta="Source and live page">
    Your client calls <code>/__devframes/__mcp</code> on the server that runs your app. Pages open in a browser report to it, so the live tools work.
  </ngmd-card>
</ngmd-card-grid>

| Transport                   | Live page data                       | Setup                                |
| --------------------------- | ------------------------------------ | ------------------------------------ |
| stdio (`ng-devtools mcp`)   | No. Source scan tools only.          | A command in your MCP client config. |
| HTTP (`/__devframes/__mcp`) | Yes, with the app open in a browser. | A URL on your app's dev server.      |

## Connect over stdio

The package ships an `ng-devtools` binary. Its `mcp` command starts an MCP server on stdin and stdout.

### Add the stdio server to your client

```bash group="stdio" name="Claude Code" active
claude mcp add ng-devtools -- npx @santoshyadavdev/ng-devtools mcp --root /path/to/your-app
```

```json group="stdio" name="Cursor"
// .cursor/mcp.json
{
  "mcpServers": {
    "ng-devtools": {
      "command": "npx",
      "args": ["@santoshyadavdev/ng-devtools", "mcp", "--root", "${workspaceFolder}"]
    }
  }
}
```

```json group="stdio" name="VS Code"
// .vscode/mcp.json
{
  "servers": {
    "ng-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": ["@santoshyadavdev/ng-devtools", "mcp", "--root", "${workspaceFolder}"]
    }
  }
}
```

### Point it at the project folder

The server scans the folder it starts in, and your client picks that folder. Some clients start servers in `/`. Pass `--root` with the root of your Angular or Analog project, the folder with `package.json` and `angular.json`, or set `NG_DEVTOOLS_ROOT`. Cursor and VS Code expand `${workspaceFolder}` to the open folder.

If the folder has no `angular.json` and no `package.json` that depends on `@angular/core`, the server prints a warning on stderr. Your client shows it in the MCP server log.

### Configure the stdio server

The stdio server reads the [devtools options](../getting-started/configuration.md) from `ng-devtools.config.json` in the project folder, from the file you pass with `--config`, or from `NG_DEVTOOLS_CONFIG`. `--read-only` sets `agent.readOnly`. See [Flags for every command](../getting-started/cli.md#flags-for-every-command).

<ngmd-alert severity="helpful">
  Inside this repository, <code>pnpm devtools:mcp</code> runs the same server against the demo app.
</ngmd-alert>

### What stdio can answer

Over stdio, the source scan tools work: `get-routes`, `get-components`, `get-signals`, `get-providers`, `get-ngrx-store`, `get-pipes` and `build-meta`. So do the tools that read files only, like `lint-pipes`, `explain-pipe`, `explain-render-mode`, `analog-routes` and `analog-lint`.

The stdio server leaves out the tools and resources that need the running app, such as `highlight`, `navigate`, `form-action`, `fill-form`, the forms and router tools, `analog-current-page`, `analog-server-calls` and `analog-call-api`. Use HTTP for those.

## Connect over HTTP

When the devtools are embedded in your app's server, the same tools are served over HTTP. This endpoint sees the pages that connect to that server.

### Find your endpoint

The path depends on how you mount the devtools. Use the port your server actually runs on.

| Setup                                        | Endpoint                                  |
| -------------------------------------------- | ----------------------------------------- |
| [Express hub](../getting-started/express.md) | `http://localhost:4000/__devframes/__mcp` |
| [Vite plugin](../getting-started/vite.md)    | `http://localhost:5173/__devframes/__mcp` |
| [Standalone CLI](../getting-started/cli.md)  | `http://localhost:9999/__mcp`             |

The standalone CLI uses port 9999 by default. If that port is taken and you did not pass `--port`, it picks a free port. Use the URL it prints.

If you mount the devtools panel without the hub, at `/__ng-devtools/`, the endpoint is `/__ng-devtools/__mcp`.

### Send an Origin header

<ngmd-callout type="warning" title="Requests without an Origin header get 403">
  The HTTP endpoint only answers requests that carry a local <code>Origin</code> header, such as <code>http://localhost:4000</code>. Requests without one get <code>403 Forbidden</code>. With the Vite plugin, the request must also come from a loopback address. If your MCP client does not send an <code>Origin</code> header, add it in the client config.
</ngmd-callout>

The header value is the origin of your dev server. Every example below sets it.

### Send a token

If the hub asks for the one-time code, the HTTP endpoint also asks for a bearer token. Requests without the right token get `401`.

| Setup                                        | Token required                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Express hub](../getting-started/express.md) | Yes, unless you pass `auth: false` or your own `mcp` option.                                          |
| [Vite plugin](../getting-started/vite.md)    | Only when the one-time code is on. See the plugin's [`auth` option](../getting-started/vite.md#auth). |

The hub prints a generated token in the terminal when it starts. The token changes when the server process restarts, but not when `ng serve` rebuilds `server.ts`. To keep the same token across restarts, set `NG_DEVTOOLS_MCP_TOKEN` in the environment of the server. The hub then uses that value and prints nothing.

Send the token in an `Authorization: Bearer <token>` header, next to the `Origin` header. If your setup needs no token, leave the `Authorization` header out.

The stdio server never needs a token.

### Add the HTTP endpoint to your client

```json group="http" name="Claude Code" active
// .mcp.json
{
  "mcpServers": {
    "ng-devtools": {
      "type": "http",
      "url": "http://localhost:4000/__devframes/__mcp",
      "headers": {
        "Authorization": "Bearer ${NG_DEVTOOLS_MCP_TOKEN}",
        "Origin": "http://localhost:4000"
      }
    }
  }
}
```

```json group="http" name="Cursor"
// .cursor/mcp.json
{
  "mcpServers": {
    "ng-devtools": {
      "url": "http://localhost:4000/__devframes/__mcp",
      "headers": {
        "Authorization": "Bearer ${env:NG_DEVTOOLS_MCP_TOKEN}",
        "Origin": "http://localhost:4000"
      }
    }
  }
}
```

```json group="http" name="VS Code"
// .vscode/mcp.json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "ng-devtools-token",
      "description": "ng-devtools MCP token",
      "password": true
    }
  ],
  "servers": {
    "ng-devtools": {
      "type": "http",
      "url": "http://localhost:4000/__devframes/__mcp",
      "headers": {
        "Authorization": "Bearer ${input:ng-devtools-token}",
        "Origin": "http://localhost:4000"
      }
    }
  }
}
```

The Claude Code and Cursor examples read the token from `NG_DEVTOOLS_MCP_TOKEN`, so set the same value for the server and the client. VS Code asks for the token the first time it starts the server.

### Open the app in a browser

The live tools read what the page reports. Without an open page, they have nothing to answer with.

<ngmd-workflow>
  <ngmd-step title="Start your app">
    Run the server that mounts the devtools: your Express SSR server, the Vite dev server, or <code>ng-devtools dev</code>.
  </ngmd-step>
  <ngmd-step title="Open it in a browser">
    Load the app with the <a href="../getting-started/overlay.md">overlay</a>. The page connects to the devtools and starts reporting.
  </ngmd-step>
  <ngmd-step title="Call a tool">
    Ask your agent something the page knows, like "why is the checkout form invalid?". It calls <code>explain-form-invalid</code> on the connected page.
  </ngmd-step>
</ngmd-workflow>

## How tools behave

### Tool names

The server registers tools with a colon, as `ng-devtools:get-routes`. MCP clients see them with an underscore, as `ng-devtools_get-routes`. Calls with either form work.

### Read and action tools

The server marks read-only tools as read-only for your client. Six tools act on the app, so the server does not mark them:

| Tool                   | Reference                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| `highlight`            | [Components, signals and DI](./tools.md#components-signals-and-di) |
| `navigate`             | [Act on the router](./tools.md#act-on-the-router)                  |
| `dispatch-ngrx-action` | [Dispatch an action](./tools.md#dispatch-an-action)                |
| `form-action`          | [Act on a form](./tools.md#act-on-a-form)                          |
| `fill-form`            | [Act on a form](./tools.md#act-on-a-form)                          |
| `analog-call-api`      | [Call a server route](./tools.md#call-a-server-route)              |

Your client can ask you before it runs them. To drop them from the server, set `agent.readOnly`. See [Inspectors and agent tools](../getting-started/configuration.md#inspectors-and-agent-tools).

### Pages and tabs

Each browser tab reports on its own and gets a page id, and so does an [Angular Native](../getting-started/angular-native.md) app. `list-pages` lists them with their platform. Tools that read live data use the most recent page by default. Pass `page` to pick another tab (`inspect-providers`, `highlight`, `inspect-component` and `defer-blocks` also accept `pageId`). An id that no tab reports gets an answer that lists the tabs that do, instead of data from another tab. The server drops pages that stop reporting after a short time.

## Where to next

<ngmd-card-grid columns="3">
  <ngmd-card icon="wrench" title="Tools" link="/agents/tools" cta="Every tool">
    Each tool grouped by inspector, with what it answers and its arguments.
  </ngmd-card>
  <ngmd-card icon="layers" title="Resources" link="/agents/resources" cta="Live state">
    The live state an agent can read as JSON.
  </ngmd-card>
  <ngmd-card icon="shield" title="Security" link="/security" cta="Redaction">
    What leaves the page and what is redacted.
  </ngmd-card>
</ngmd-card-grid>
