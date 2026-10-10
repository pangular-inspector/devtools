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

The package publishes `dist/` and `bin.mjs`. On publish, `publishConfig.exports` points every entry point at the built files:

| Import                                  | Published file      |
| --------------------------------------- | ------------------- |
| `@pangular-inspector/devtools`          | `dist/devframe.mjs` |
| `@pangular-inspector/devtools/devframe` | `dist/devframe.mjs` |
| `@pangular-inspector/devtools/config`   | `dist/config.mjs`   |
| `@pangular-inspector/devtools/overlay`  | `dist/overlay.mjs`  |
| `@pangular-inspector/devtools/popup`    | `dist/popup.mjs`    |
| `@pangular-inspector/devtools/http`     | `dist/http.mjs`     |
| `@pangular-inspector/devtools/hub`      | `dist/hub.mjs`      |
| `@pangular-inspector/devtools/vite`     | `dist/vite.mjs`     |

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

## Release from GitHub Actions

The **Release** workflow (`.github/workflows/release.yml`) publishes the package from `main`. It runs by hand from the Actions tab, and publishes through npm trusted publishing, so no npm token is stored anywhere.

### Set it up once

<ngmd-workflow>
  <ngmd-step title="Add the trusted publisher">
    On npmjs.com, open the settings of <code>&#64;pangular-inspector/devtools</code>, and under <strong>Trusted publishing</strong> choose GitHub Actions with owner <code>pangular-inspector</code>, repository <code>devtools</code> and workflow <code>release.yml</code>. Leave the environment empty.
  </ngmd-step>
  <ngmd-step title="Let the workflow push to main">
    The workflow pushes the version commit and the tag with the default <code>GITHUB_TOKEN</code>. If a branch protection rule or ruleset guards <code>main</code>, allow GitHub Actions to bypass it.
  </ngmd-step>
</ngmd-workflow>

### Each release

1. In a pull request, add a section for the version to `packages/devtools/CHANGELOG.md`, headed `## 0.0.8`. The changelog follows [Keep a Changelog](https://keepachangelog.com), with entries grouped as Upgrade notes, Security fixes, Features and Documentation.
2. If `app/` changed since the last release, check that `extension/ui` is current. CI fails when it is stale.
3. Once the pull request is merged and CI is green on `main`, run **Release** from the Actions tab on `main`. Its input is an exact version (`0.0.6`), or `patch`, or `minor` for a breaking change.

### What the workflow does

| Step                | What happens                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI                  | Runs `ci.yml` on the commit being released.                                                                                                                                 |
| Version             | Sets `version` in `packages/devtools/package.json`.                                                                                                                         |
| Check the changelog | Fails unless `CHANGELOG.md` has a `## <version> - <date>` section. That section becomes the release notes.                                                                  |
| Build               | `pnpm pack` builds the library and the UI into one tarball, with `publishConfig.exports` applied.                                                                           |
| Verify the tarball  | `pnpm verify:publish` installs that tarball into a fresh Angular CLI app from a local registry, builds it, and checks the hub. See [Check the package](#check-the-package). |
| Publish             | `npm publish --provenance` publishes the tarball on the `latest` tag.                                                                                                       |
| Push and tag        | Commits `chore(release): <version>` to `main` and tags it `devtools@<version>`.                                                                                             |
| GitHub release      | Creates a release for the tag, with the changelog section as its notes.                                                                                                     |

If the workflow fails before it publishes, nothing has left the runner. Fix the cause and run it again. If it fails after it publishes, run it again with the same exact version (not a bump). It skips the publish when that version is already on npm and finishes the rest.

## Check the package

`pnpm verify:publish` checks what npm gets, which the workspace never uses: it links the package to its TypeScript sources.

<ngmd-workflow>
  <ngmd-step title="Pack">
    <code>pnpm pack</code> builds the package and checks that the tarball holds every exported file and the UI.
  </ngmd-step>
  <ngmd-step title="Publish locally">
    It starts Verdaccio with <code>pnpm dlx</code> and publishes the tarball there. The registry serves <code>&#64;pangular-inspector/*</code> only from what it was given, and proxies everything else to npmjs.
  </ngmd-step>
  <ngmd-step title="Set up an app">
    It creates a fresh app, installs the package and <code>devframe</code> from that registry, and wires the setup from the getting-started pages.
  </ngmd-step>
  <ngmd-step title="Build and check">
    It builds the app, starts it, and checks that the hub answers <code>/__devframes/__connection.json</code> and serves the panel.
  </ngmd-step>
</ngmd-workflow>

| Scenario                    | App                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `angular-cli` (the default) | `ng new --ssr` on the newest Angular in the peer range, with the [Express hub](../getting-started/express.md) and a development build |
| `analog`                    | `create-analog`, with the [Vite plugin](../getting-started/vite.md), `vite build`, and the check on the dev server                    |

```bash
pnpm verify:publish
pnpm verify:publish --scenario=analog
```

It uses ports 4873 (the registry) and 4874 (the app). Set `VERIFY_PORT` to move both. It needs network access to npmjs, and a run takes a few minutes. At the end it prints the versions it resolved. On a failure it leaves the app and the logs in a temporary folder and prints where.

### The weekly check

The package declares `@angular/core >=20` and `vite >=5` as peer ranges, and this repository tests on the versions it pins. The **Latest versions** workflow (`.github/workflows/latest.yml`) runs both scenarios every Monday at 06:00 UTC, and by hand from the Actions tab, on the newest versions those ranges allow. The job summary lists the versions each scenario resolved. A scheduled failure opens an issue titled `ci: the <scenario> setup fails on the latest versions`, or comments on the one already open. Close it once the fix is in.

## Publish by hand

Use this only if the workflow can't run.

### 1. Bump the version

Update `version` in `packages/devtools/package.json`. In the same commit, add a section for the version to `packages/devtools/CHANGELOG.md`. The changelog follows [Keep a Changelog](https://keepachangelog.com), with entries grouped as Upgrade notes, Security fixes, Features and Documentation. Use a message like `chore(release): 0.0.7`.

### 2. Check the build

Run the checks from [Development setup](./development.md), then build and check the package without publishing:

```bash
pnpm verify:publish
```

It builds the package first. See [Check the package](#check-the-package).

### 3. Refresh the extension UI

If `app/` changed since the last release, run `pnpm extension:build` and commit `extension/ui` before you publish. CI fails when the committed copy is stale.

### 4. Publish

```bash
pnpm devtools:publish
```

This runs `pnpm --filter @pangular-inspector/devtools publish --access public`. The `prepack` build bundles the library and the UI. It publishes without provenance, and needs an npm login with publish rights.

<ngmd-alert severity="important">
  <code>pnpm publish</code> checks git before it publishes. Run it from a clean working tree on <code>main</code>.
</ngmd-alert>

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
