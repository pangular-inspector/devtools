---
title: Publishing
description: Bump the version, build, and publish the npm package. Ship the Chrome extension with a fresh UI.
---

<ngmd-hero title="Publishing" gradient>
  One npm package and one Chrome extension, each with its own version. Bump, build, publish.
</ngmd-hero>

# Publishing

The devtools ship as one npm package, `@santoshyadavdev/ng-devtools`, from `packages/ng-devtools`. It holds the Node-side logic, RPC, CLI, overlay, popup, and the built UI in `dist/public`.

## What ships

The package publishes `dist/` and `bin.mjs`. On publish, `publishConfig.exports` points every entry point at the built files:

| Import                                  | Published file      |
| --------------------------------------- | ------------------- |
| `@santoshyadavdev/ng-devtools`          | `dist/devframe.mjs` |
| `@santoshyadavdev/ng-devtools/devframe` | `dist/devframe.mjs` |
| `@santoshyadavdev/ng-devtools/config`   | `dist/config.mjs`   |
| `@santoshyadavdev/ng-devtools/overlay`  | `dist/overlay.mjs`  |
| `@santoshyadavdev/ng-devtools/popup`    | `dist/popup.mjs`    |
| `@santoshyadavdev/ng-devtools/http`     | `dist/http.mjs`     |
| `@santoshyadavdev/ng-devtools/hub`      | `dist/hub.mjs`      |
| `@santoshyadavdev/ng-devtools/vite`     | `dist/vite.mjs`     |

The `ng-devtools` binary is `bin.mjs`. In the workspace, the exports point at the TypeScript sources instead.

### How the package builds

The package's `build` script runs two steps:

<ngmd-workflow>
  <ngmd-step title="Bundle the library">
    <code>tsdown</code> builds the entry points into <code>dist/</code>.
  </ngmd-step>
  <ngmd-step title="Build the UI">
    <code>vite build</code> with <code>app/vite.config.ts</code> writes the devtools UI to <code>dist/public</code>.
  </ngmd-step>
</ngmd-workflow>

`prepack` runs `pnpm build`, so every publish builds first.

## Publish the npm package

### 1. Bump the version

Update `version` in `packages/ng-devtools/package.json`. In the same commit, add a section for the version to `packages/ng-devtools/CHANGELOG.md`. The changelog follows [Keep a Changelog](https://keepachangelog.com), with entries grouped as Upgrade notes, Security fixes, Features and Documentation. Use a message like `chore(release): ng-devtools 0.0.5`.

### 2. Check the build

Run the checks from [Development setup](./development.md), then build the package without publishing:

```bash
pnpm devtools:build-pkg
```

### 3. Refresh the extension UI

If `app/` changed since the last release, run `pnpm extension:build` and commit `extension/ui` before you publish. CI fails when the committed copy is stale.

### 4. Publish

```bash
pnpm devtools:publish
```

This runs `pnpm --filter @santoshyadavdev/ng-devtools publish --access public`. The `prepack` build bundles the library and the UI.

<ngmd-alert severity="important">
  <code>pnpm publish</code> checks git before it publishes. Run it from a clean working tree on <code>main</code>.
</ngmd-alert>

## Release the Chrome extension

The extension has its own version, in `extension/manifest.json`. It does not follow the npm package version.

1. Bump `version` in `extension/manifest.json`.
2. Run `pnpm extension:zip`. It rebuilds `extension/ui` first.
3. Commit `extension/ui` and the manifest.
4. Upload `dist/ng-devtools-extension.zip`.

See [Build the extension](./chrome-extension.md) for the upload steps.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/contributing/chrome-extension" title="Build the extension"></ngmd-pill>
  <ngmd-pill href="/contributing/development" title="Development setup"></ngmd-pill>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
</ngmd-pill-row>
