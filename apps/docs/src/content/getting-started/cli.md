---
title: Standalone CLI
description: Run the devtools from the command line, build a static report, start an MCP server, or export lint findings for CI.
---

<ngmd-hero title="Standalone CLI" gradient>
  One binary for a local devtools server, an offline report, an MCP server for coding agents and lint findings for CI.
</ngmd-hero>

# Standalone CLI

The package installs a `pangular` binary. Run it from the root of your Angular workspace, or point it there with `--root`. It scans the source files in that folder, so it works without starting your app.

## Commands

| Command  | What it does                                                       |
| -------- | ------------------------------------------------------------------ |
| `dev`    | Starts a local server with the devtools UI.                        |
| `build`  | Writes a static copy of the devtools with the scan.                |
| `mcp`    | Starts an MCP server over stdio for coding agents.                 |
| `skills` | Lists or installs the bundled [agent skills](../agents/skills.md). |
| `lint`   | Runs the source lints and prints the findings as JSON or SARIF.    |

`pangular --version` prints the package version. An unknown command or flag prints one error line and exits with code 1. `pangular --help` lists the commands and flags.

### Flags for every command

| Flag              | What it does                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--root <dir>`    | The project folder to scan. The default is `PANGULAR_ROOT`, then the working directory.                                                                         |
| `--config <file>` | A JSON file with the [devtools options](./configuration.md). The default is `PANGULAR_CONFIG`, then `pangular.config.json` in the project folder, if it exists. |
| `--read-only`     | Sets `agent.readOnly`: keeps only the agent tools that read. See [Inspectors and agent tools](./configuration.md#inspectors-and-agent-tools).                   |

If the project folder has no `angular.json` and no `package.json` that depends on `@angular/core`, the CLI prints a warning on stderr, because the scans find nothing there.

### Config file

The file holds the same options as `createPangular()`, as JSON:

```json
// pangular.config.json
{
  "inspectors": {"analog": false},
  "agent": {"readOnly": true},
  "redaction": {"secretNames": ["passport"]}
}
```

A missing `--config` file or invalid JSON stops the command with an error.

The file can also list `allowedOrigins` for `pangular dev`, like `--allowed-origin`. They stay on the server and are not part of the config pages receive:

```json
// pangular.config.json
{
  "allowedOrigins": ["http://192.168.1.20:8100"]
}
```

### Run it without installing

```bash group="run" name="npx" image="https://cdn.simpleicons.org/npm/CB3837" active
npx @pangular-inspector/devtools dev
```

```bash group="run" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220"
pnpm dlx @pangular-inspector/devtools dev
```

```bash group="run" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
# Yarn 2 or later
yarn dlx -p @pangular-inspector/devtools pangular dev
# Yarn 1 has no dlx: npx works with any package manager
npx @pangular-inspector/devtools dev
```

```bash group="run" name="bun" image="https://bun.sh/logo.svg"
bunx --package @pangular-inspector/devtools pangular dev
```

### Run the installed binary

With the package installed in your project, call the binary through your package manager:

```bash
npx pangular dev
npx pangular build --outDir dist-report
npx pangular mcp
```

## Dev server

### Start it

The default command starts a local server with the devtools UI. `dev` is optional: `npx @pangular-inspector/devtools` does the same.

```bash
npx @pangular-inspector/devtools dev --port 9999 --open
```

When the server is ready, it prints the version, the panel URL, the panel URL for [Angular Native](./angular-native.md) apps and the MCP endpoint:

```text
  pangular v0.0.7
  Panel: http://localhost:9999/
  Angular Native apps: http://localhost:9999/?view=angular-native
  MCP:   http://localhost:9999/__mcp
```

With `--proxy-origin`, it also prints **Panel on your app**, the panel URL on your app's origin. If you pass no `--port` and port 9999 is taken, it also prints the port it uses instead. It also lists the extra allowed origins and a short hash of each pairing token, never the token.

When the server listens on your network (`--host 0.0.0.0` or a network address), it also prints the network URLs and an `initOverlay()` call to paste into an app on a device, with the server's whole connection info, its config included. See [Set up Capacitor](../guides/capacitor.md).

### Dev server flags

| Flag                        | What it does                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--port <port>`             | Port to listen on. The default is 9999. If it is taken, a random free port is used.                                                                                                                                                                                                                                          |
| `--host <host>`             | Host to bind to. The default is `localhost`.                                                                                                                                                                                                                                                                                 |
| `--open`, `--no-open`       | Open the browser on start, or not.                                                                                                                                                                                                                                                                                           |
| `--no-auth`                 | Turn off the one-time code the server asks for.                                                                                                                                                                                                                                                                              |
| `--mcp`, `--no-mcp`         | Mount the MCP endpoint at `/__mcp`, or not. It is on by default.                                                                                                                                                                                                                                                             |
| `--allowed-origin <origin>` | An extra origin allowed to reach the server, such as `http://192.168.1.20:8100`. Repeat it for more.                                                                                                                                                                                                                         |
| `--proxy-origin <origin>`   | The origin of your app's dev server when it proxies `/__pangular/` to this server, such as `http://localhost:4200`. The panel URL on that origin and the one-time code link point there, and the server accepts requests from that origin. See [Client-only Angular CLI app](./installation.md#client-only-angular-cli-app). |
| `--auth-token <token>`      | A [pairing token](../security.md#pairing-tokens) a client may send instead of the one-time code. Repeat it for more. Prefer the `PANGULAR_AUTH_TOKEN` environment variable.                                                                                                                                                  |

<ngmd-callout type="warning" title="Keep it on localhost">
  The server binds to <code>localhost</code> by default and asks for a one-time code. Changing <code>--host</code> or passing <code>--no-auth</code> widens who can reach it. See <a href="../security.md">Access and redaction</a>.
</ngmd-callout>

### What it shows

When no app is connected, the tabs show what your source declares. An [Angular Native](./angular-native.md) app connects through the **Angular Native apps** URL above and shows live data there:

- [Components](../inspectors/components.md)
- [Routes](../inspectors/router.md)
- [Signals](../inspectors/signals.md)
- [Providers](../inspectors/injectors.md)
- [NgRx declarations](../inspectors/ngrx-store.md)
- [Pipes](../inspectors/pipes.md)

<ngmd-alert severity="helpful">
  For live data, mount the devtools in your app's own server. See <a href="./express.md">Angular CLI and Express</a> or <a href="./vite.md">Vite and Analog</a>. A client-only Angular CLI app can proxy <code>ng serve</code> to this server instead. See <a href="./installation.md#client-only-angular-cli-app">Client-only Angular CLI app</a>.
</ngmd-alert>

## Static report

### Build it

`build` writes a self-contained static copy of the devtools with the source scan baked in: components, routes, signals, providers, pipes, NgRx declarations and build metadata.

```bash
npx @pangular-inspector/devtools build --outDir dist-report
```

### Report flags

| Flag             | What it does                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| `--outDir <dir>` | Output directory. The default is `dist-static`. It is emptied first.      |
| `--pretty`       | Pretty-print the data files. They get larger on disk.                     |
| `--force`        | Empty `--outDir` even when it holds files that are not a previous report. |

### Output folder checks

The build deletes everything in `--outDir` before it writes the report. To protect your files, it stops with an error when `--outDir` is:

- the working directory or one of its parents, even with `--force`. With `--root`, this covers both the folder you ran the command from and the `--root` folder,
- a file, or a folder that is not empty and has no `__connection.json` (so it is not a previous report), unless you pass `--force`.

### Open or host it

The output is static files. Open it offline or host it on any static file server. It is a snapshot of your source at build time, so rebuild it after code changes.

## MCP server

### Start it over stdio

`mcp` starts an *MCP server over stdio for coding agents:

```bash
npx @pangular-inspector/devtools mcp
```

Your agent client runs this command for you. [MCP server](../agents/mcp-server.md) covers client setup.

### Print the client config

`mcp --print-config` prints the config for Claude Code, Cursor and VS Code, then exits without starting a server. It covers the stdio server for the project folder and the HTTP endpoint of a running server. It never prints the MCP token. See [Print the config](../agents/mcp-server.md#print-the-config).

```bash
npx @pangular-inspector/devtools mcp --print-config --port 4000 --base /__devframes/
```

| Flag             | What it does                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--print-config` | Print the client config and exit.                                                                                            |
| `--host <host>`  | Host of the server that runs your app, for the HTTP config. The default is `localhost`.                                      |
| `--port <port>`  | Port of that server, from 1 to 65535. The default is 9999, the standalone CLI.                                               |
| `--base <path>`  | The hub base, such as `/__devframes/` for the Express hub and the Vite plugin. With it, the HTTP config sends the MCP token. |
| `--https`        | The server is behind TLS, so the HTTP config uses `https://`.                                                                |

`--root`, `--config` and `--read-only` go into the printed stdio command, with absolute paths. The stdio server is named `pangular` and the HTTP server `pangular-live`, so a client can hold both. With `--base` and a `--host` that is not a loopback address, the output warns that the token travels in clear text over `http`; pass `--https` when the server is behind TLS.

### Source scan only

The stdio server has no page connected, so it registers only the tools that read your source files. The tools that need a page, such as `highlight`, `navigate`, `form-action` and the forms and router tools, are left out. For live data, point your agent at the HTTP endpoint of a running app instead. On a hub it lives at `/__devframes/__mcp`.

## Agent skills

`pangular skills install` copies the [agent skills](../agents/skills.md) the package ships into your agent's skill folder, `.claude/skills` by default. It never replaces a skill that you changed unless you pass `--force`, and `--dry-run` prints what would change without writing.

```bash
pangular skills install --agent agents --dry-run
```

`--agent` takes `claude`, `agents` or `github`. See [Install them](../agents/skills.md#install-them) for every flag.

## Lint export

### Run the source lints

`lint` runs the lints that read only your source files and prints their findings as JSON on stdout. No app or server needs to run, so it fits a CI job.

```bash
npx pangular lint --format sarif --output reports/pangular.sarif --fail-on error
```

| Lint        | Agent tool                                            | What it checks                                                                                        |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `templates` | [`lint-templates`](../agents/tools.md#lint-templates) | Component templates, parsed with your project's own `@angular/compiler`. Skipped when it is missing.  |
| `pipes`     | [`lint-pipes`](../agents/tools.md#lint-pipes)         | Pipe use in templates and pipe declarations.                                                          |
| `analog`    | [`analog-lint`](../agents/tools.md#lint)              | The static Analog checks: routes, API routes, server files, content and prerender. Skipped elsewhere. |

`lint-forms`, `lint-routes` and the live checks of `analog-lint` read the running page, so `lint` leaves them out. When a lint is skipped, the command says why on stderr and the JSON lists it with `ran: false`.

### Lint flags

| Flag                   | What it does                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `--format <format>`    | `json` (the default) or `sarif`.                                                                                                     |
| `--output <file>`      | Write the findings to this file instead of stdout. Missing folders are created.                                                      |
| `--only <lints>`       | Only these lints, comma separated, such as `templates,pipes`.                                                                        |
| `--fail-on <severity>` | Exit with code 1 when a finding of this severity or worse is found: `error`, `warning` or `info`. The default, `none`, exits with 0. |

### Output formats

The JSON has the package version under `tool`, each lint with `ran` and its finding count under `lints`, counts per severity under `counts`, and the `findings`. Each finding has `lint`, `rule`, `severity`, `file` and `line` relative to the project folder (or `path` for a route), `message` and `fix`.

The SARIF output is a SARIF 2.1.0 log with one run. Rule ids are the lint and the rule, such as `templates/track-by-index`. `error`, `warning` and `info` become the SARIF levels `error`, `warning` and `note`. File paths are relative to `%SRCROOT%`, the project folder. A finding about a whole file points at line 1, and a finding about a route has no location. Upload the file to a code scanning tool, such as GitHub code scanning. The tool then shows each finding on the line it is about.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need to run my app first?" open>
    No. <code>dev</code>, <code>build</code>, <code>mcp</code> and <code>lint</code> read your source files. Only live data needs a running app with the overlay loaded.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Which directory should I run it from?">
    The root of your Angular workspace. The scan starts from the current directory, or from the folder you pass with <code>--root</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Port 9999 is taken">
    Without <code>--port</code>, the server listens on 9999, or on a random free port if 9999 is taken, and prints it. Pass <code>--port</code> to choose one yourself.
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
