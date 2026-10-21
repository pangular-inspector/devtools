---
title: Publishing
description: Bump the version, build, and publish the npm package. Ship the Chrome extension with a fresh UI.
---

<ngmd-hero title="Publishing" gradient>
  One npm package and one Chrome extension, each with its own version. Bump, build, publish.
</ngmd-hero>

# Publishing

The devtools ship as one npm package, `@pangular-inspector/devtools`, from `packages/devtools`. It holds the Node-side logic, RPC, CLI, overlay, popup, and the built UI in `dist/public`.

## What ships

The package publishes `dist/`, `skills/` (the [agent skills](../agents/skills.md), one folder per skill) and `bin.mjs`. On publish, `publishConfig.exports` points every entry point at the built files:

| Import                                                | Published file                    |
| ----------------------------------------------------- | --------------------------------- |
| `@pangular-inspector/devtools`                        | `dist/devframe.mjs`               |
| `@pangular-inspector/devtools/devframe`               | `dist/devframe.mjs`               |
| `@pangular-inspector/devtools/config`                 | `dist/config.mjs`                 |
| `@pangular-inspector/devtools/cd-data`                | `dist/cd-data.mjs`                |
| `@pangular-inspector/devtools/overlay`                | `dist/overlay.mjs`                |
| `@pangular-inspector/devtools/overlay-manual`         | `dist/overlay-manual.mjs`         |
| `@pangular-inspector/devtools/capacitor-hook`         | `dist/capacitor-hook.mjs`         |
| `@pangular-inspector/devtools/store-hook`             | `dist/store-hook.mjs`             |
| `@pangular-inspector/devtools/startup-hook`           | `dist/startup-hook.mjs`           |
| `@pangular-inspector/devtools/overlay-angular-native` | `dist/overlay-angular-native.mjs` |
| `@pangular-inspector/devtools/overlay-nativescript`   | `dist/overlay-nativescript.mjs`   |
| `@pangular-inspector/devtools/plugin`                 | `dist/plugin.mjs`                 |
| `@pangular-inspector/devtools/popup`                  | `dist/popup.mjs`                  |
| `@pangular-inspector/devtools/cli`                    | `dist/cli.mjs`                    |
| `@pangular-inspector/devtools/http`                   | `dist/http.mjs`                   |
| `@pangular-inspector/devtools/hub`                    | `dist/hub.mjs`                    |
| `@pangular-inspector/devtools/ssr`                    | `dist/ssr.mjs`                    |
| `@pangular-inspector/devtools/vite`                   | `dist/vite.mjs`                   |

`dist/hub.mjs` and `dist/devframe.mjs` are loaders that import no package. They load `dist/hub-server.mjs` and `dist/devframe-server.mjs` from the installed package at runtime, so an app's server bundle doesn't take in Devframe. The build fails when a loader reaches a package or a Node builtin.

The `pangular` binary is `bin.mjs`. In the workspace, the exports point at the TypeScript sources instead.

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

Update `version` in `packages/devtools/package.json`. In the same commit, add a section for the version to `packages/devtools/CHANGELOG.md`. The changelog follows [Keep a Changelog](https://keepachangelog.com), with entries grouped as Upgrade notes, Security fixes, Features and Documentation. Use a message like `chore(release): 0.0.7`.

### 2. Check the build

Run the checks from [Development setup](./development.md), then build the package without publishing:

```bash
pnpm devtools:build-pkg
```

Then check what npm users get. `pnpm verify:publish` publishes the package to a throwaway local registry, creates a fresh Angular CLI app, installs the package from that registry and checks that the hub answers. Pass `--scenario=analog` for an Analog app:

```bash
pnpm verify:publish
pnpm verify:publish --scenario=analog
```

### 3. Refresh the extension UI

If `app/` changed since the last release, run `pnpm extension:build` and commit `extension/ui` before you publish. CI fails when the committed copy is stale.

### 4. Publish

```bash
pnpm devtools:publish
```

This runs `pnpm --filter @pangular-inspector/devtools publish --access public`. The `prepack` build bundles the library and the UI.

<ngmd-alert severity="important">
  <code>pnpm publish</code> checks git before it publishes. Run it from a clean working tree on <code>main</code>.
</ngmd-alert>

## The public API

Each entry point exports only what these docs describe, and only that is covered by semver. The files in `packages/devtools/src/entries` choose those exports, and `public-api.test.ts` lists them, so a new export is a deliberate change. Code shared between the server, the overlay and the panel, such as most of `config.ts`, stays internal: the panel imports it as `@pangular-inspector/devtools/internal/config`, a workspace-only export that `publishConfig.exports` leaves out. Mark a declaration that has to be exported for the package's own modules with `@internal`, and the published types leave it out.

## Supported versions

The Angular peer range has an upper bound, `>=12.2.0 <23.0.0`, because the overlay reads Angular's private debug APIs. Raise it in the release after the new major passes the [compatibility jobs](./development.md#angular-compatibility), and update the tested versions in [Installation](../getting-started/installation.md#tested-versions). `engines.node` is `>=22.12.0`, the first Node.js 22 that can `require()` the ES modules the Express hub loads.

## Release the Chrome extension

The extension has its own version, in `extension/manifest.json`. It does not follow the npm package version.

1. Bump `version` in `extension/manifest.json`.
2. Run `pnpm extension:zip`. It rebuilds `extension/ui` first.
3. Commit `extension/ui` and the manifest.
4. Upload `dist/pangular-inspector-extension.zip`.

See [Build the extension](./chrome-extension.md) for the upload steps.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/contributing/chrome-extension" title="Build the extension"></ngmd-pill>
  <ngmd-pill href="/contributing/development" title="Development setup"></ngmd-pill>
  <ngmd-pill href="/getting-started/installation" title="Installation"></ngmd-pill>
</ngmd-pill-row>
