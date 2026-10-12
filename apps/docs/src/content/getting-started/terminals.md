---
title: Terminals
description: Run your project's build and test commands from the hub and read their output in a terminals dock.
---

<ngmd-hero title="Terminals" gradient>
  Turn on <code>terminals</code> to run your project's build and test commands from the hub, and read their output in a <strong>Terminals</strong> dock next to the Pangular docks.
</ngmd-hero>

# Terminals

The terminals dock runs two commands of your project, build and test, on the server that mounts the hub. It shows their output as it arrives, and lets you stop and restart them. It is off by default.

## Turn it on

Pass `terminals: true` to the Express hub or the Vite plugin:

```ts {6}
// src/server.ts
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const devtools = initPangularHub({
  ws: false,
  terminals: true,
});
```

```ts {9}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [analog(), pangular({terminals: true})],
});
```

`createPangular()`, the standalone CLI and the [Chrome extension](./chrome-extension.md) have no terminals: the dock needs the [hub](./popup-and-hub.md#the-hub). `terminals` is not part of the shared options or the CLI config file. See [Configuration](./configuration.md#terminals).

## The commands

The hub looks for the commands once, when it starts, in the folder it runs in (`cwd`):

| Command | Runs                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build   | The `build` script of `package.json`, such as `pnpm run build`. Without one, `ng build` when `angular.json` has a `build` target and `@angular/cli` is installed. |
| Test    | The `test` script of `package.json`. Without one, `ng test` when `angular.json` has a `test` target and `@angular/cli` is installed.                              |

The commands run with your project's package manager: the `packageManager` field of `package.json`, else the nearest lockfile in the project or up to five folders above it (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `package-lock.json`), else npm. `ng` runs through it too, such as `pnpm exec ng build`. The `test` script that `npm init` writes ("no test specified") doesn't count.

If the project has neither command, the hub prints a `[pangular]` warning and adds no dock. The dock runs these commands and nothing else. It has no shell, and a request for any other command, arguments, working directory or environment variables is refused.

## Run, stop and restart

| Where                                                        | How                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| The **Terminals** dock                                       | Pick the command among the dock's presets. Select a session to see its output, and use its stop and restart buttons.                        |
| The hub's [command palette](./command-palette.md#in-the-hub) | **Pangular: run &lt;command&gt;** runs it, or runs it again, and opens the dock on its output. **Pangular: stop &lt;command&gt;** stops it. |

Each command has one session in the dock. Running it again stops a run in progress first, then starts over in the same session, under the output of the earlier run. A run ends with `[exited with code <n>]`, or `[stopped]` when you stopped it. A command that exits with another code than 0 shows as failed.

The output is read-only. JWTs, bearer tokens, passwords in URLs, `Authorization` values and well-known API key shapes are masked line by line before they reach the dock, like the rest of the [redacted values](../security.md#what-is-redacted).

Stopping a command sends `SIGTERM` to its process group, so the CLI under the package manager stops too, then `SIGKILL` after 3 seconds if they are still running. On Windows the hub ends the process tree with `taskkill`. The commands also stop when the hub closes and when the server process exits or gets `SIGINT`, `SIGTERM` or `SIGHUP`.

## When the dock stays off

`terminals: true` adds the dock only when all of these hold. Otherwise the hub prints a `[pangular] The terminals dock is off` warning with the reason.

| Condition                      | Why                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `NODE_ENV` is not `production` | The commands are for development. The Vite plugin runs only with `vite dev`.          |
| The origin check is on         | With `allowedOrigins: false`, any web page could reach the hub and start a command.   |
| `allowLan` is off              | Only clients on this machine may run commands. With `allowLan`, other machines could. |
| A command was found            | See [The commands](#the-commands).                                                    |

The dock goes through the same request gate and one-time code as the rest of the hub. See [Access and redaction](../security.md#terminals).

<ngmd-alert severity="important">
  Agents can't run the commands: the terminal functions are not MCP tools.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
