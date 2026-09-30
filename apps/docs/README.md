# Docs site

The documentation site for this repository. It is built with [NgMd](https://github.com/erkamyaman/ngmd) on AnalogJS, Angular and Tailwind.

## Run it

From the repository root:

```bash
pnpm install
pnpm docs:dev     # dev server on http://localhost:5173
pnpm docs:build   # production build in apps/docs/dist
```

With Nx: `pnpm nx serve angular-devtools-docs`, `pnpm nx build angular-devtools-docs` and `pnpm nx test angular-devtools-docs`.

## Edit

- Pages are markdown files in `src/content`. The path becomes the URL: `src/content/inspectors/signals.md` is served at `/inspectors/signals`.
- Link between pages with relative `.md` paths, such as `[Router](../inspectors/router.md)`, so the links also work on GitHub.
- The sidebar, site name, links and site URL live in `src/ngmd.config.ts`.
- Brand colors are CSS variables in `src/styles.css`.
- The landing page is `src/app/pages/index.page.ts`.

The build fails on broken internal links and anchors, so run `pnpm docs:build` before you open a PR.
