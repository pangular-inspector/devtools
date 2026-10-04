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
git clone https://github.com/santoshyadavdev/angular-devtools.git
cd angular-devtools
pnpm install
```

`pnpm-workspace.yaml` lists `packages/*`, `examples/*` and `apps/*`, so one install covers every project.

### Git hooks

`pnpm install` sets `core.hooksPath` to `.githooks` and `commit.template` to `.gitmessage`. If you already set either one yourself, it keeps your value.

| Hook         | What it does                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | Formats the staged files with Prettier and stages the result. It skips a file that also has unstaged changes, so hunks you left out with `git add -p` stay out of the commit.                                              |
| `commit-msg` | Checks the message against the [commit message guidelines](https://github.com/santoshyadavdev/angular-devtools/blob/main/docs/contributing/commit-message-guidelines.md). It prints a warning and never blocks the commit. |

## Project structure

```text
app/                          # Devtools UI SPA (Angular + Vite)
  src/app.ts                  # Root component with tab navigation
  src/pages/                  # One component per tab
  vite.config.ts              # Vite config with the Analog Angular plugin
packages/
  devtools/                   # Publishable npm package
    src/devframe.ts           # defineDevframe(): the tool definition
    src/overlay.ts            # Client script running in the user's page
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
| `angular-devtools`             | `.` (`project.json`) | `build`, `serve`, `test`         |
| `@pangular-inspector/devtools` | `packages/devtools`  | `build`                          |
| `analog-demo`                  | `examples/analog`    | `dev`, `build`, `preview`        |
| `angular-devtools-docs`        | `apps/docs`          | `dev`, `build`, `test`, and more |

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
pnpm exec nx build angular-devtools-docs        # This site
```

```bash group="nx" name="Test"
pnpm exec nx test                        # Angular Travel
pnpm exec nx test angular-devtools-docs  # This site
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

| Command                                                                                  | Port | Notes                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm start`                                                                             | 4200 | `ng serve` with SSR and hot reload. The popup and live data work without a separate server.                                                    |
| `pnpm build --configuration development && node dist/angular-devtools/server/server.mjs` | 4000 | The demo app as an SSR server.                                                                                                                 |
| `pnpm devtools:dev`                                                                      | 5173 | The devtools UI with hot reload and its own RPC. Source-scan data only; live tabs need an app page connected, so use the SSR server for those. |

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

A separate `axe` job in the same workflow installs Chromium and runs `pnpm test:axe`.

### Pull request checks

Two more workflows run on pull requests. Both only warn. They never fail the pull request.

| Workflow         | File                                   | What it checks                                                                                                                                                  |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Commit message` | `.github/workflows/commit-message.yml` | The pull request title and every commit message. The title becomes the commit on `main` when the pull request is squash merged.                                 |
| `Docs check`     | `.github/workflows/docs-check.yml`     | That a change to `packages/devtools/src/`, `app/src/` or the top-level files in `extension/` also changes a page in `apps/docs/src/content`. Tests don't count. |

If a code change needs no docs change, add the `no-docs` label to the pull request and say why in the description. The `Docs check` workflow then skips the warning.

## Make changes

### Add an RPC function

1. Create the function in `packages/devtools/src/rpc/`.
2. Register it in `packages/devtools/src/devframe.ts`.
3. Map it to its inspector in `RPC_INSPECTOR` in `packages/devtools/src/config.ts`, so turning the inspector off removes it.
4. Call it from the UI in `app/src/pages/`.

### Add a tab

1. Create a component in `app/src/pages/`.
2. Import and add it to `app/src/app.ts` (imports array, tabs array, template switch).
3. Add a card to `app/src/pages/dashboard.ts`.

### Add an agent tool

Add `agent: { description }` to an RPC function, or call `ctx.agent.registerTool()` in the devframe setup. List the tool on the [Tools](../agents/tools.md) page.

Map a registered tool to its inspector in `AGENT_INSPECTOR` in `packages/devtools/src/config.ts`, so `inspectors` and `agent.tools` can hide it. A tool that acts on the page sets `safety: 'action'`, so `agent.readOnly` drops it. See [Configuration](../getting-started/configuration.md).

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
