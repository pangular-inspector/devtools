---
name: devtools-verify
description: Verify a devtools change the way CI and a reviewer would, then check it in a real browser with axe. Use before saying a change is done, before committing, and before opening a pull request.
---

# Verify a change

## 1. The CI checks

Run them in this order; all must pass:

```sh
pnpm format:check
pnpm commit:check
pnpm skills:check
pnpm typecheck
pnpm test
pnpm test:devtools
pnpm test:panel
pnpm test:axe
pnpm build
pnpm extension:build
pnpm devtools:build-pkg
git status --porcelain -- extension/ui   # must be committed when app/ changed
```

CI runs `pnpm exec nx affected -t test build` instead of the plain `pnpm test` and `pnpm build`; run it too when your change touches more than one project.

When the change affects behaviour, an option, a UI label or an agent tool, update the matching page in `apps/docs` in the same change (use the `devtools-docs` skill). When the change touches the docs site (apps/docs) or `README.md`, also run the build checks in the `devtools-docs` skill.

`pnpm typecheck` runs `ngc` on the panel (`app/tsconfig.json`, with `strictTemplates`) and on the Analog demo, so it catches template errors. To run the panel template check alone:

```sh
NO_COLOR=1 pnpm exec ngc -p app/tsconfig.json --noEmit
```

and treat any `error TS` or `error NG` line as a failure. Strip color codes before grepping the output, or errors slip through.

`pnpm test:axe` needs Chromium (`pnpm exec playwright install chromium` once). It runs axe on every panel tab and hub view against a static report of Angular Travel. The panel is dark only, so it runs in the dark color scheme. It does not replace the browser checks below, which use real data from the demos.

## 2. Run the demos

`pnpm build` is a production build and turns the in-page launcher off. For manual checks rebuild in development mode:

```sh
pnpm build --configuration development
node dist/angular-devtools/server/server.mjs   # Angular Travel on :4000
pnpm analog:dev                                 # Analog demo on :5173
```

Open the panel through the amber launcher on the page, at `/__devframes/`, and directly at `/__devframes/ng-devtools/?view=angular#tab=<tab>`.

## 3. Browser checks

With Playwright and `@axe-core/playwright` (install them in a scratch folder, not in the repo):

- Every page you touched (the panel is dark only): axe reports no violations, there are no page errors, and `document.documentElement.scrollWidth <= innerWidth` at 1280px and 360px wide.
- Hub docks: clicking each rail button shows the matching view and only one frame (the rail selection and the content must match after fast switching and after a reload).
- The feature itself, with real data from the demo app (for example `/examples/<area>`).

Exclude the launcher (`#ng-devtools-popup-root`) from axe runs on demo pages; it is checked through the panel.

## 4. Report honestly

Say which checks ran and their results. If something was skipped (no browser, no build), say so.
