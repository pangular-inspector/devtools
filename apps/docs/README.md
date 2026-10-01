# Docs site

The documentation site for this repository. It is built with [NgMd](https://github.com/erkamyaman/ngmd) on AnalogJS, Angular and Tailwind.

## Run it

From the repository root:

```bash
pnpm install
pnpm docs:dev     # dev server on http://localhost:5173
pnpm docs:build   # production build in apps/docs/dist
pnpm docs:test    # unit tests for the build plugins
```

These scripts run Nx targets. The `@nx/vite` and `@nx/vitest` plugins infer them from `vite.config.ts`. You can also run any target directly, for example `pnpm nx typecheck angular-devtools-docs` or `pnpm nx preview angular-devtools-docs`.

## Edit

- Pages are markdown files in `src/content`. The path becomes the URL: `src/content/inspectors/signals.md` is served at `/inspectors/signals`.
- Link between pages with relative `.md` paths, such as `[Router](../inspectors/router.md)`, so the links also work on GitHub.
- The sidebar, site name, links and site URL live in `src/ngmd.config.ts`.
- Brand colors are CSS variables in `src/styles.css`.
- The landing page is `src/app/pages/index.page.ts`.

The build fails on broken internal links and anchors, so run `pnpm docs:build` before you open a PR.
