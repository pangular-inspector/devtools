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

## Releasing

Releases publish from CI, not from a laptop. `.github/workflows/release.yml` publishes the npm package with [provenance](https://docs.npmjs.com/generating-provenance-statements), so npm shows which commit and workflow built it.

<ngmd-workflow>
  <ngmd-step title="Bump the version and write the changelog">
    In one pull request, set <code>version</code> in <code>packages/devtools/package.json</code> and add a <code>## 1.2.3</code> section to <code>packages/devtools/CHANGELOG.md</code>. List every removed or renamed export, option and tool under Upgrade notes. Merge it to <code>main</code>.
  </ngmd-step>
  <ngmd-step title="Tag the merged commit">
    Wait for CI to pass on that commit of <code>main</code>. Then run <code>git tag v1.2.3</code> on it and <code>git push origin v1.2.3</code>. The tag starts the workflow. To rerun a release, start <strong>Release</strong> from the <strong>Actions</strong> tab and pick the tag, not a branch, under <strong>Use workflow from</strong>.
  </ngmd-step>
  <ngmd-step title="Approve the npm environment">
    The job runs in the <code>npm</code> environment, which holds the <code>NPM_TOKEN</code> secret. Approve it when the run asks.
  </ngmd-step>
</ngmd-workflow>

The workflow stops at the first check that fails, before anything reaches npm:

1. The run is for a tag, and the tag is on `main`. The CI workflow (`ci.yml`) has a successful run on `main` for the tagged commit. The tag equals `v` plus the package version. The changelog has a non-empty section for that version (`scripts/release-notes.mjs`).
2. `pnpm typecheck`, `pnpm test:devtools` and `pnpm test:panel` pass.
3. `pnpm --filter @pangular-inspector/devtools pack` builds one tarball. The root `.pnpmfile.cjs` drops `devDependencies`, `scripts` and the `nx` block from the packed `package.json`.
4. `pnpm verify:publish` (Angular CLI and Analog) and a few cells of `pnpm e2e:install` install that exact tarball from a local registry into fresh apps, open them in Chromium and run the package audit.
5. `npm publish <tarball> --provenance --access public` publishes the same file. A version with a prerelease part, such as `1.3.0-rc.1`, goes to the `next` dist-tag; any other goes to `latest`.
6. `gh release create` makes the GitHub release, with the changelog section as its notes and the tarball attached.

The run keeps the tarball and the install reports as an artifact. To check a release candidate before you tag it, run the same steps locally:

```bash
pnpm --filter @pangular-inspector/devtools pack --pack-destination dist/release
pnpm verify:publish --tarball=dist/release/pangular-inspector-devtools-1.2.3.tgz
pnpm e2e:install --tarball=dist/release/pangular-inspector-devtools-1.2.3.tgz --cells=angular-cli:npm:22
```

`pnpm e2e:install` deletes its work folder when it ends, as it can reach several gigabytes. A failed run copies the logs out first and prints where they are. Pass `--keep` to keep the whole folder.

### The public API

Each entry point exports only what these docs describe, and only that is covered by semver. The files in `packages/devtools/src/entries` choose those exports, and `public-api.test.ts` lists them, so a new export is a deliberate change. Code shared between the server, the overlay and the panel, such as most of `config.ts`, stays internal: the panel imports it as `@pangular-inspector/devtools/internal/config`, a workspace-only export that `publishConfig.exports` leaves out. Mark a declaration that has to be exported for the package's own modules with `@internal`, and the published types leave it out.

### Supported versions

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
