---
title: Publishing
description: Release the npm package from GitHub Actions, check it from a local registry, and ship the Chrome extension with a fresh UI.
---

<ngmd-hero title="Publishing" gradient>
  One npm package and one Chrome extension, each with its own version. The package releases from a workflow; the extension ships by hand.
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

## Release the npm package

The **Release** workflow (`.github/workflows/release.yml`) publishes the package from `main`. It runs by hand from the Actions tab and publishes through npm trusted publishing, so no npm token is stored anywhere.

### Set it up once

<ngmd-workflow>
  <ngmd-step title="Add the trusted publisher">
    On npmjs.com, open the settings of <code>&#64;pangular-inspector/devtools</code>, and under <strong>Trusted publishing</strong> choose GitHub Actions with owner <code>pangular-inspector</code>, repository <code>devtools</code> and workflow <code>release.yml</code>. Leave the environment empty.
  </ngmd-step>
  <ngmd-step title="Let the workflow push to main">
    The workflow pushes the version commit and the tag with the default <code>GITHUB_TOKEN</code>. If a branch protection rule or ruleset guards <code>main</code>, allow GitHub Actions to bypass it, and set <strong>Settings &gt; Actions &gt; Workflow permissions</strong> to read and write.
  </ngmd-step>
</ngmd-workflow>

### Each release

1. In a pull request, add a section for the version to `packages/devtools/CHANGELOG.md`, headed `## 1.0.1`. The changelog follows [Keep a Changelog](https://keepachangelog.com). The pull request can also set `version` in `packages/devtools/package.json`; the workflow then leaves it as it is.
2. If `app/` changed since the last release, check that `extension/ui` is current. CI fails when it is stale.
3. Once the pull request is merged and CI is green on `main`, run **Release** from the Actions tab on `main`. Its input is an exact version (`1.0.1`), or `patch`, or `minor`.

| Step                | What happens                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI                  | Runs `ci.yml` on the commit being released, every job included.                                                                                       |
| Version             | Sets `version` in `packages/devtools/package.json`.                                                                                                   |
| Check the changelog | Fails unless `CHANGELOG.md` has a `## <version>` section. That section becomes the release notes.                                                     |
| Build               | `pnpm pack` builds the library and the UI into one tarball, with `publishConfig.exports` applied.                                                     |
| Verify the tarball  | `pnpm verify:publish` installs that tarball into a fresh Angular CLI app from a throwaway local registry, builds it, and checks that the hub answers. |
| Publish             | `npm publish --provenance` publishes the tarball on the `latest` tag.                                                                                 |
| Push and tag        | Commits `chore(release): <version>` to `main` when the version changed, and tags it `devtools@<version>`.                                             |
| GitHub release      | Creates a release for the tag, with the changelog section as its notes.                                                                               |

If the workflow fails before it publishes, nothing has left the runner. Fix the cause and run it again. If it fails after it publishes, run it again with the same exact version, not a bump: it skips the publish when that version is already on npm and finishes the rest.

## Publish by hand

Use this only if the workflow can't run. It publishes without provenance and needs an npm login with publish rights.

1. Set `version` in `packages/devtools/package.json` and add its section to `packages/devtools/CHANGELOG.md`, in a commit like `chore(release): 1.0.1`.
2. Run the checks from [Development setup](./development.md), then check what npm users get. `pnpm verify:publish` publishes the package to a throwaway local registry, creates a fresh Angular CLI app, installs the package from that registry and checks that the hub answers. Pass `--scenario=analog` for an Analog app.
3. If `app/` changed since the last release, run `pnpm extension:build` and commit `extension/ui`.
4. Publish with `pnpm devtools:publish`, which runs `pnpm --filter @pangular-inspector/devtools publish --access public`. The `prepack` build bundles the library and the UI.

<ngmd-alert severity="important">
  <code>pnpm publish</code> checks git before it publishes. Run it from a clean working tree on <code>main</code>.
</ngmd-alert>

## The public API

Each entry point exports only what these docs describe, and only that is covered by semver. The files in `packages/devtools/src/entries` choose those exports, and `public-api.test.ts` lists them, so a new export is a deliberate change. Code shared between the server, the overlay and the panel, such as most of `config.ts`, stays internal: the panel imports it as `@pangular-inspector/devtools/internal/config`, a workspace-only export that `publishConfig.exports` leaves out. Mark a declaration that has to be exported for the package's own modules with `@internal`, and the published types leave it out.

The mobile entry points (`overlay-manual`, `capacitor-hook`, `overlay-angular-native` and `overlay-nativescript`) stay in this package through 1.x. Moving one to its own package is a breaking change, so it waits for a major release.

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
