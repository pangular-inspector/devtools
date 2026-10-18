---
title: Development setup
description: Set up the repository, run the devtools UI and the demo apps, and run the same checks as CI.
---

<ngmd-hero title="Development setup" logo="https://cdn.simpleicons.org/nx/71717A" gradient>
  Clone, install, and run the devtools against a real Angular app. The same checks CI runs, on your machine.
</ngmd-hero>

# Development setup

The repository is an Nx workspace with pnpm. It holds the npm package, the devtools UI, the Chrome extension, two demo apps and this docs site.

## Prerequisites

<ngmd-card-grid columns="2">
  <ngmd-card icon="terminal" title="Node.js 24 or later">
    <code>.nvmrc</code> pins 24, and the root <code>package.json</code> requires <code>&gt;=24</code>.
  </ngmd-card>
  <ngmd-card icon="box" title="pnpm 10 or later">
    The root <code>package.json</code> sets <code>packageManager</code> to <code>pnpm&#64;10.33.4</code>.
  </ngmd-card>
</ngmd-card-grid>

## Set up the repository

```bash
git clone https://github.com/pangular-inspector/devtools.git
cd devtools
pnpm install
```

`pnpm-workspace.yaml` lists `packages/*`, `examples/*` and `apps/*`, so one install covers every project.

### Git hooks

`pnpm install` sets `core.hooksPath` to `.githooks` and `commit.template` to `.gitmessage`. If you already set either one yourself, it keeps your value.

| Hook         | What it does                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | Formats the staged files with Prettier and stages the result. It skips a file that also has unstaged changes, so hunks you left out with `git add -p` stay out of the commit.                                         |
| `commit-msg` | Checks the message against the [commit message guidelines](https://github.com/pangular-inspector/devtools/blob/main/docs/contributing/commit-message-guidelines.md). It prints a warning and never blocks the commit. |

### Patched dependencies

`patches/` holds `pnpm patch` changes to the built files of `devframe`, `@devframes/agentic` and `@devframes/hub` 1.2.5, listed under `patchedDependencies` in `pnpm-workspace.yaml`. They add what devframe doesn't ship:

| Patch                | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Used by                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `instructions`       | An MCP route option, sent as `instructions` in the `initialize` result. Patched in `devframe`, `@devframes/hub` and `@devframes/agentic`.                                                                                                                                                                                                                                                                                                                                | `pangularMcp()` in `packages/devtools/src/agent-mcp.ts`                                                                                      |
| `prompts`            | An MCP route option with prompt templates. `@devframes/agentic` declares the `prompts` capability and answers `prompts/list` and `prompts/get` (invalid params for an unknown prompt or a missing required argument). Patched in `devframe`, `@devframes/hub` and `@devframes/agentic`.                                                                                                                                                                                  | `pangularMcpPrompts()` in `packages/devtools/src/agent-prompts.ts`, through `pangularMcp()`                                                  |
| `resourceTemplates`  | MCP route options for resource templates and a host hook for resource list changes. `@devframes/agentic` answers `resources/templates/list`, reads a URI through the first template that matches it (`{name}` variables only, one URI segment each), adds each template's `list()` entries to `resources/list`, and sends `notifications/resources/list_changed` when `onResourcesChanged` calls back. Patched in `devframe`, `@devframes/hub` and `@devframes/agentic`. | `pangularMcpResourceTemplates()` and `pangularMcpPagesChanged()` in `packages/devtools/src/agent-page-resources.ts`, through `pangularMcp()` |
| `mcpContent` answers | `@devframes/agentic` sends a tool result's `mcpContent` blocks (`text` and `image`) as the MCP content, instead of the result as JSON.                                                                                                                                                                                                                                                                                                                                   | `screenshot-component`, through `withMcpContent()` in `rpc/component-screenshots.ts`                                                         |

The `exposeSharedState` filter, which hides the shared-state keys of an inspector with `agent.tools.<name>: false`, is part of devframe since 1.2.4 and needs no patch.

The patches apply only inside this repository. An app that installs the published package gets no server `instructions`, no prompts and no page resource templates, and `screenshot-component` answers with its text note only, until devframe ships them. Each patch names an exact version and file names with build hashes, so a devframe upgrade needs the patches redone with `pnpm patch`, or removed once devframe has the feature.

## Project structure

```text
app/                          # Devtools UI SPA (Angular + Vite)
  src/app.ts                  # Root component with tab navigation
  src/pages/                  # One component per tab
  vite.config.ts              # Vite config with the Analog Angular plugin
packages/
  devtools/                   # Publishable npm package
    src/devframe.ts           # defineDevframe(): the tool definition
    src/overlay.ts            # Client script running in the user's page (the overlay-manual entry)
    src/overlay-auto.ts       # The overlay entry: starts the overlay and the floating button on import
    src/rpc/                  # Node-side RPC functions and agent tools
extension/                    # Chrome DevTools extension
examples/analog/              # Analog demo app
examples/angular-native/      # Angular Native demo app (outside the pnpm workspace)
apps/docs/                    # This documentation site
src/                          # Angular Travel, the host demo app
```

### Nx projects

| Project                        | Root                 | Targets                          |
| ------------------------------ | -------------------- | -------------------------------- |
| `pangular-inspector`           | `.` (`project.json`) | `build`, `serve`, `test`         |
| `@pangular-inspector/devtools` | `packages/devtools`  | `build`                          |
| `analog-demo`                  | `examples/analog`    | `dev`, `build`, `preview`        |
| `pangular-inspector-docs`      | `apps/docs`          | `dev`, `build`, `test`, and more |

Run `pnpm exec nx show projects` to list them. Package projects get their targets from their `package.json` scripts.

## Run things

### Root scripts

Most work goes through the root `package.json` scripts:

```bash
pnpm devtools:dev        # Devtools UI with hot reload and live RPC
pnpm devtools:build      # Build the devtools UI SPA into dist/devtools-ui
pnpm devtools:build-pkg  # Build the npm package (library + UI in dist/)
pnpm start               # Build the package, then serve Angular Travel
```

### Nx targets

The scripts call Nx. You can also run a target on a project directly:

```bash group="nx" name="Build" active
pnpm exec nx build                              # Angular Travel
pnpm exec nx build @pangular-inspector/devtools # The npm package
pnpm exec nx build pangular-inspector-docs        # This site
```

```bash group="nx" name="Test"
pnpm exec nx test                        # Angular Travel
pnpm exec nx test pangular-inspector-docs  # This site
```

```bash group="nx" name="Serve"
pnpm exec nx serve         # Angular Travel on port 4200
pnpm exec nx dev analog-demo
```

```bash group="nx" name="Affected"
pnpm exec nx affected -t test build
```

`build` and `test` are cached. `build` runs the `build` of its dependencies first, so building a demo also builds the package.

<ngmd-alert severity="helpful">
  The package's <code>build</code> target lists <code>app/**</code> as an input. A change to the devtools UI invalidates the package build.
</ngmd-alert>

### Ports

| Command                                                                                    | Port | Notes                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm start`                                                                               | 4200 | `ng serve` with SSR and hot reload. The popup and live data work without a separate server.                                                    |
| `pnpm build --configuration development && node dist/pangular-inspector/server/server.mjs` | 4000 | The demo app as an SSR server.                                                                                                                 |
| `pnpm devtools:dev`                                                                        | 5173 | The devtools UI with hot reload and its own RPC. Source-scan data only; live tabs need an app page connected, so use the SSR server for those. |

<ngmd-callout type="warning" title="Refresh the bundled UI">
  The SSR server serves the UI built into <code>packages/devtools/dist/public</code>. Run <code>pnpm devtools:build-pkg</code> to refresh it after you change <code>app/</code>.
</ngmd-callout>

## Run the checks

Run the same checks as CI before you open a PR:

```bash
pnpm format:check                   # Prettier
pnpm typecheck                      # Host app + specs, devtools UI and Analog demo (with templates), devtools package + its tests
pnpm exec nx affected -t test build # Test and build affected projects
pnpm test:devtools                  # Devtools package tests (Vitest)
pnpm test:panel                     # Devtools UI tests (Vitest)
pnpm test:axe                       # axe check of every panel page (needs Chromium)
pnpm extension:build                # Chrome extension
pnpm skills:check                   # Agent skills and roles in .claude/
pnpm commit:check                   # Commit messages on your branch
```

`pnpm typecheck` runs `ngc` on `app/tsconfig.json` and `examples/analog/tsconfig.app.json`, so template errors fail it. `app/tsconfig.json` turns on `strictTemplates`.

`pnpm test:panel` runs the tests in `app/src/__tests__` in jsdom, with the Analog Angular plugin compiling the components. `pnpm test:axe` builds the package, writes a static report of Angular Travel to `dist/panel-axe`, serves it, and runs axe on every tab and on each hub view (`?view=ngrx`, `analog`, `nativescript`, `capacitor`) in both dark and light color schemes. It fails on any violation or page error. Run `pnpm exec playwright install chromium` once before the first run.

`pnpm skills:check` validates the frontmatter of every skill and role and checks that the files and links they mention exist. `pnpm commit:check` checks every commit on your branch that is not on `main` (it compares with `upstream/main`, then `origin/main`, then `main`).

### What CI runs

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`, in this order:

<ngmd-workflow>
  <ngmd-step title="Install">
    <code>pnpm install --frozen-lockfile</code> on the Node version from <code>.nvmrc</code>.
  </ngmd-step>
  <ngmd-step title="Check formatting, skills and types">
    <code>pnpm format:check</code>, <code>pnpm skills:check</code>, then <code>pnpm typecheck</code>.
  </ngmd-step>
  <ngmd-step title="Test and build affected projects">
    <code>nx affected -t test build</code>, compared against the last green commit on <code>main</code>.
  </ngmd-step>
  <ngmd-step title="Test the devtools package and UI">
    <code>pnpm test:devtools</code>, then <code>pnpm test:panel</code>.
  </ngmd-step>
  <ngmd-step title="Build the extension and check it is committed">
    <code>pnpm extension:build</code>. The job fails when <code>extension/ui</code> differs from the committed copy.
  </ngmd-step>
  <ngmd-step title="Smoke-test the CLI">
    <code>node bin.mjs --help</code>.
  </ngmd-step>
</ngmd-workflow>

A separate `axe` job in the same workflow installs Chromium and runs `pnpm test:axe`. A `node-22` job runs `pnpm test:devtools` on the newest Node.js 22, the oldest major `engines.node` (`>=22.12.0`) allows.

Two more jobs run when a pull request or push changes `packages/devtools`, `app`, `e2e`, the lockfile or their scripts. `Security e2e` builds the package and runs `pnpm e2e:security`, the redaction and access checks. `MCP e2e` runs `pnpm e2e:mcp`, which builds the package and the SSR demo, then calls every agent tool, resource and prompt and compares the list with the agent tools page.

### End-to-end scripts

The `e2e:*` scripts drive real apps in Playwright's Chromium. Run `pnpm exec playwright install chromium` once first.

| Script                | What it checks                                                                                                     | Needs                                                                                                                    | Runs                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `pnpm e2e:security`   | Secrets planted in a fixture app never reach the panel, agents, logs or the static report; the access gates hold.  | `pnpm devtools:build-pkg`. Ports 5231 to 5236.                                                                           | Pull requests                            |
| `pnpm e2e:mcp`        | Every agent tool, resource and prompt over HTTP and stdio, with bad arguments and config variants.                 | Builds what it needs. Ports 5150 to 5154.                                                                                | Pull requests                            |
| `pnpm e2e:panel`      | Every panel view in both themes at 1280 and 360 px: axe, overflow and page errors.                                 | A running app, such as the SSR demo on 4000 (`--base`) started with `PANGULAR_AUTH=false`, or `--auth-log` with its log. | Weekly                                   |
| `pnpm e2e:resilience` | `multitab`, `expiry`, `lifecycle` and `stress`: tabs that close, crash or hide, server restarts and a large app.   | `pnpm devtools:build-pkg` and the development build. Port 5401.                                                          | Weekly                                   |
| `pnpm e2e:install`    | A packed tarball installed into fresh apps per setup, package manager and Angular version, plus the package audit. | Network for npm. A local registry on 4873 and the ports after it.                                                        | Weekly, and a few cells on every release |

`.github/workflows/e2e.yml` runs the weekly ones on Mondays and opens an issue when one fails. In `e2e:resilience`, a check that fails on an open issue is marked as a known failure with the issue number: it prints `XFAIL` and does not fail the run, and it prints `XPASS` once it passes, so the mark can go. The `soak` check of `e2e:resilience` runs by hand only.

### Angular compatibility

`.github/workflows/compat.yml` runs the page-side tests on the oldest Angular version the peer range allows, the last minor of 15, 17 and 19, the first and last minor of 20, each later major, and the `next` prerelease. It runs on pushes to `main`, every Monday at 06:00 UTC, and on demand from the **Actions** tab. It doesn't run on pull requests.

| Job          | Angular range | Node.js |
| ------------ | ------------- | ------- |
| Angular 12.2 | `~12.2.0`     | 22      |
| Angular 15.2 | `~15.2.0`     | 22      |
| Angular 17.3 | `~17.3.0`     | 22      |
| Angular 19.2 | `~19.2.0`     | 22      |
| Angular 20.0 | `~20.0.0`     | 22      |
| Angular 20.3 | `~20.3.0`     | 22      |
| Angular 21   | `^21.0.0`     | 22      |
| Angular 22   | `^22.0.0`     | 22      |
| Angular next | `next`        | 22      |

The `next` job installs the `next` dist-tag, so a renamed `ɵ` API shows up before the next major ships. It runs with `continue-on-error`: a failure marks the job red but not the workflow.

Each job appends `overrides` for the `@angular/*` runtime packages to `pnpm-workspace.yaml`, reinstalls, and runs `vitest` with `packages/devtools/vitest.compat.config.ts`. That config picks the tests that render a real Angular app or read Angular's private debug APIs, including the `*-real` tests that boot a real app where the main tests use fakes, and leaves out the panel tests and most server tests. It adds the Signal Forms tests on Angular 22 and later, and loads `zone.js` before Angular 21, where `TestBed` still expects it. Before Angular 17 it also points `@angular/core/primitives/signals` at the stub the Vite plugin uses. The Angular 12 job then compiles the View Engine packages for Ivy with ngcc from `@angular/compiler-cli` 12, after a copying install, since ngcc rewrites the installed files.

`src/__tests__/angular-version.ts` has the helpers that make a test run on every version: `initAngularTestBed()`, `bootstrapRoot()` (an NgModule before 14.1), `zonelessProviders()`, `STANDALONE`, `writableSignal()` and `testModuleFor()`. `router-testing.ts` gives `provideRouter` or `RouterModule.forRoot`. A test of a feature that a version's debug API lacks checks the unavailable result there with `angularAtLeast()`. It is skipped only when the Angular API the test builds on doesn't exist yet, such as `@defer` before 17.0.

To reproduce a job, add the same `overrides` block to `pnpm-workspace.yaml`, run `pnpm install --no-frozen-lockfile`, then `pnpm exec vitest run --root packages/devtools --config vitest.compat.config.ts`. For Angular 12, run the ngcc step from the workflow before the tests. Do this in a copy of the repository, and don't commit the changed lockfile.

### Pull request checks

Two more workflows run on pull requests. Only a pull request title that breaks the commit format fails one; everything else they find is a warning.

| Workflow         | File                                   | What it checks                                                                                                                                                  |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Commit message` | `.github/workflows/commit-message.yml` | The pull request title and every commit message. The title becomes the commit on `main` when the pull request is squash merged, so a bad title fails the check. |
| `Docs check`     | `.github/workflows/docs-check.yml`     | That a change to `packages/devtools/src/`, `app/src/` or the top-level files in `extension/` also changes a page in `apps/docs/src/content`. Tests don't count. |

If a code change needs no docs change, add the `no-docs` label to the pull request and say why in the description. The `Docs check` workflow then skips the warning.

## Make changes

### Add an RPC function

1. Create the function in `packages/devtools/src/rpc/`.
2. Register it in `packages/devtools/src/devframe.ts`.
3. Map it to its inspector in `RPC_INSPECTOR` in `packages/devtools/src/config.ts`, so turning the inspector off removes it.
4. Call it from the UI in `app/src/pages/`.

The panel's devframe client caches the functions listed in `PANEL_CACHED_RPC` in `packages/devtools/src/config.ts`, and only those. A cached call is answered from the client until the connection drops, so a restarted server is asked again. Add a function there only when its answer can't change while the server runs, and give it `type: 'static'` or `cacheable: true`. Live page data and source scans never qualify.

### Add a tab

1. Create a component in `app/src/pages/`.
2. Import and add it to `app/src/app.ts` (imports array, tabs array, template switch).
3. Add a card to `app/src/pages/dashboard.ts`.

### Add an agent tool

Add `agent: { description }` to an RPC function, or call `ctx.agent.registerTool()` in the devframe setup. List the tool on the [Tools](../agents/tools.md) page.

Give every registered tool and resource an entry in `AGENT_ENTRIES` in `packages/devtools/src/config.ts`. `AGENT_INSPECTOR`, `AGENT_SAFETY`, `ACTION_TOOLS`, `PAGE_AGENT_ENTRIES` and the tool's tags derive from it, so the entry is the only list to edit.

| Field             | Set it to                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `kind`            | `tool` for `ctx.agent.registerTool()`, `resource` for `ctx.agent.registerResource()`, `rpc` for an RPC function with `agent` |
| `inspectors`      | The inspector that `inspectors` and `agent.tools` hide it with. More than one adds tags. Leave it out for a shared tool      |
| `safety`          | `action` when it acts on the page or the server, `destructive` when it can lose data. Left out, the tool is `read`           |
| `readOnlyVariant` | `true` when `agent.readOnly` keeps it as a `read` tool and its handler refuses the arguments that act                        |
| `actions`         | The `actions` keys it writes for, so blocking them drops it                                                                  |
| `freeModes`       | The modes that still work while those actions are blocked                                                                    |
| `page`            | `true` when it needs a connected page, the app's dev server or the panel, so the stdio MCP server leaves it out              |
| `anyInspector`    | `true` when it stays while any of its `inspectors` is on, not only the first                                                 |

`packages/devtools/src/__tests__/agent-metadata.test.ts` boots the server and fails when a registered tool has no entry, or an entry has no registered tool. It also compares the derived lists with `packages/devtools/src/__tests__/fixtures/agent-metadata-derived.json`, so update that file with the tool and the reviewer sees what changed. See [Configuration](../getting-started/configuration.md).

<ngmd-callout type="tip" title="Changed app/?">
  Run <code>pnpm extension:build</code> and commit <code>extension/ui</code>. CI fails when it is stale. See <a href="./chrome-extension.md">Build the extension</a>.
</ngmd-callout>

## Work on the docs

This site lives in `apps/docs`. It is built with [NgMd](https://github.com/erkamyaman/ngmd) on *Analog.

```bash
pnpm docs:dev     # Dev server
pnpm docs:build   # Production build
```

Pages are markdown files under `apps/docs/src/content`. The sidebar comes from `apps/docs/src/ngmd.config.ts`.

<ngmd-alert severity="important">
  The build fails on broken internal links and on raw external anchors without <code>target="_blank"</code>. Run <code>pnpm docs:build</code> before you open a PR.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/contributing/demo-apps" title="Demo apps"></ngmd-pill>
  <ngmd-pill href="/contributing/chrome-extension" title="Build the extension"></ngmd-pill>
  <ngmd-pill href="/contributing/publishing" title="Publishing"></ngmd-pill>
</ngmd-pill-row>
