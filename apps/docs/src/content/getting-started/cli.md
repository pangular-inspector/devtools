---
title: Standalone CLI
description: Run the devtools from the command line, build a static report, or start an MCP server.
---

<ngmd-hero title="Standalone CLI" gradient>
  Three commands from one binary. A local devtools server, an offline report, and an MCP server for coding agents.
</ngmd-hero>

# Standalone CLI

The package installs an `ng-devtools` binary. Run it from the root of your Angular workspace. It scans the source files in the current directory, so it works without starting your app.

## Commands

| Command | What it does                                        |
| ------- | --------------------------------------------------- |
| `dev`   | Starts a local server with the devtools UI.         |
| `build` | Writes a static copy of the devtools with the scan. |
| `mcp`   | Starts an MCP server over stdio for coding agents.  |

### Run it without installing

```bash group="run" name="npx" image="https://cdn.simpleicons.org/npm/CB3837" active
npx @santoshyadavdev/ng-devtools dev
```

```bash group="run" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220"
pnpm dlx @santoshyadavdev/ng-devtools dev
```

```bash group="run" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn dlx @santoshyadavdev/ng-devtools dev
```

```bash group="run" name="bun" image="https://bun.sh/logo.svg"
bunx @santoshyadavdev/ng-devtools dev
```

### Run the installed binary

With the package installed in your project, call the binary through your package manager:

```bash
npx ng-devtools dev
npx ng-devtools build --outDir dist-report
npx ng-devtools mcp
```

## Dev server

### Start it

The default command starts a local server with the devtools UI. `dev` is optional: `npx @santoshyadavdev/ng-devtools` does the same.

```bash
npx @santoshyadavdev/ng-devtools dev --port 9999 --open
```

### Dev server flags

| Flag                  | What it does                                                                        |
| --------------------- | ----------------------------------------------------------------------------------- |
| `--port <port>`       | Port to listen on. The default is 9999. If it is taken, a random free port is used. |
| `--host <host>`       | Host to bind to. The default is `localhost`.                                        |
| `--open`, `--no-open` | Open the browser on start, or not.                                                  |
| `--no-auth`           | Turn off the one-time code the server asks for.                                     |
| `--mcp`, `--no-mcp`   | Mount the MCP endpoint at `/__mcp`, or not. It is on by default.                    |

<ngmd-callout type="warning" title="Keep it on localhost">
  The server binds to <code>localhost</code> by default and asks for a one-time code. Changing <code>--host</code> or passing <code>--no-auth</code> widens who can reach it. See <a href="../security.md">Access and redaction</a>.
</ngmd-callout>

### What it shows

No page is connected to the CLI server. The tabs show what your source declares:

- [Components](../inspectors/components.md)
- [Routes](../inspectors/router.md)
- [Signals](../inspectors/signals.md)
- [Providers](../inspectors/injectors.md)
- [NgRx declarations](../inspectors/ngrx-store.md)
- [Pipes](../inspectors/pipes.md)

<ngmd-alert severity="helpful">
  For live data, mount the devtools in your app's own server. See <a href="./express.md">Angular CLI and Express</a> or <a href="./vite.md">Vite and Analog</a>.
</ngmd-alert>

## Static report

### Build it

`build` writes a self-contained static copy of the devtools with the source scan baked in.

```bash
npx @santoshyadavdev/ng-devtools build --outDir dist-report
```

### Report flags

| Flag             | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `--outDir <dir>` | Output directory. The default is `dist-static`.       |
| `--pretty`       | Pretty-print the data files. They get larger on disk. |

### Open or host it

The output is static files. Open it offline or host it on any static file server. It is a snapshot of your source at build time, so rebuild it after code changes.

## MCP server

### Start it over stdio

`mcp` starts an *MCP server over stdio for coding agents:

```bash
npx @santoshyadavdev/ng-devtools mcp
```

Your agent client runs this command for you. [MCP server](../agents/mcp-server.md) covers client setup.

### Source scan only

The stdio server has no page connected, so only the source scan tools return data. For live data, point your agent at the HTTP endpoint of a running app instead. On a hub it lives at `/__devframes/__mcp`.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need to run my app first?" open>
    No. All three commands read your source files. Only live data needs a running app with the overlay loaded.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Which directory should I run it from?">
    The root of your Angular workspace. The scan starts from the current directory.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Port 9999 is taken">
    Without <code>--port</code>, the server picks a random free port. Pass <code>--port</code> to choose one yourself.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="sparkles" title="MCP server" link="/agents/mcp-server" cta="Connect an agent">
    Client setup for stdio, and the HTTP endpoint for live data.
  </ngmd-card>
  <ngmd-card icon="layers" title="Angular CLI and Express" link="/getting-started/express" cta="Live data">
    Mount the hub in your app for live inspectors.
  </ngmd-card>
</ngmd-card-grid>
