---
title: Demo apps
description: The Angular Travel demo and the Analog demo in the repository, and how to run each in development and production.
---

<ngmd-hero title="Demo apps" gradient>
  Two apps that give every inspector something to show. One Angular CLI app with SSR, one Analog app on Vite.
</ngmd-hero>

# Demo apps

The repository has two demo apps. Use them to try a change against a real app before you open a PR.

<ngmd-card-grid columns="2">
  <ngmd-card icon="compass" title="Angular Travel" cta="src/">
    An Angular CLI app with SSR and Express. It uses the hub, the overlay and the HTTP providers.
  </ngmd-card>
  <ngmd-card icon="zap" title="Analog demo" cta="examples/analog">
    An Analog app wired with the Vite plugin. It covers file routes, server loads, API routes and content.
  </ngmd-card>
</ngmd-card-grid>

## Angular Travel

**Angular Travel** (`src/`) looks and behaves like a real booking site.

### What's inside

| Area                              | What it covers                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destinations**                  | Search, region filter and sort kept in the URL, backed by an `@ngrx/signals` store (`withState`, `withComputed`, `withMethods`).                               |
| **Trip pages**                    | Loaded by a resolver that redirects unknown trips, with a route title resolver.                                                                                |
| **Booking**                       | A Signal Forms checkout with a departure date rule, a seat limit and an unsaved-changes guard.                                                                 |
| **My Trips**                      | Behind a sign-in guard that redirects to a reactive form and back.                                                                                             |
| **DevTools Lab** (`/examples`)    | Small, focused pages for signals, components, DI, routes, forms, pipes, HTTP, NgRx and defer blocks.                                                           |
| **SSR & HTTP** (`/examples/http`) | A product list fetched from `/api/products` during SSR and replayed from the transfer cache. The endpoint accepts `?delay=` and `?fail=` for backend errors.   |
| **Defer** (`/examples/defer`)     | `@defer` blocks on viewport, on interaction and on a condition, with `@loading` and `@error` blocks, plus `hydrate on interaction` and `hydrate never` blocks. |

Destination photos are from Unsplash, credited in `public/destinations/CREDITS.md`.

### Routes lab

`/examples/routes` has one link per router case, so the Router tab has something to show:

| Link                     | What it does                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Summary**              | Target of the empty-path redirect.                                                                                                          |
| **Details**              | A plain child route.                                                                                                                        |
| **User 7**               | A `:id` param with a slow resolver.                                                                                                         |
| **Admin**                | A guard that redirects to **Summary**.                                                                                                      |
| **Locked**               | A guard that returns `false`.                                                                                                               |
| **Broken**               | A resolver that throws.                                                                                                                     |
| **Guard loop**           | `loop-a` and `loop-b` guards that redirect to each other five times, then to **Summary**. The Navigations view flags it as a redirect loop. |
| **Navigation ping-pong** | A button whose code navigates between **Details** and **Summary** six times in a row. The Navigations view flags it as a navigation loop.   |

Keep `redirectTo` cycles (`NG04016`) in the unit tests: Angular stops them before any guard runs.

### Where the devtools are wired

The demo shows the full setup in three files:

| File                    | What it adds                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/server.ts`         | The hub, with `initNgDevtoolsHub()` mounted as Express middleware                                                              |
| `src/main.ts`           | The overlay and `registerNgrxSignals`, loaded in development only                                                              |
| `src/app/app.config.ts` | `withNgDevtools()` and `provideNgDevtoolsHttp()` for the SSR & HTTP tab, and `withIncrementalHydration()` for the defer blocks |

### Run in development

```bash
pnpm start
```

This builds the devtools package, then runs `ng serve` with SSR and hot reload on port 4200. Click the amber button in the corner to open the devtools.

### Run the SSR server

To see server calls in the SSR & HTTP tab, run the built SSR server:

```bash
pnpm build --configuration development
node dist/angular-devtools/server/server.mjs
```

It listens on port 4000, or on `PORT` when set.

<ngmd-callout type="warning" title="Use the development configuration">
  <code>pnpm build</code> defaults to the production configuration. <code>src/main.ts</code> only loads the overlay when <code>ngDevMode</code> is on, and the HTTP interceptor passes requests through in production. Build with <code>--configuration development</code> to use the devtools.
</ngmd-callout>

### Render modes

`src/app/app.routes.server.ts` sets a render mode per route, so the SSR tools have something to compare:

| Routes                                                       | Render mode                |
| ------------------------------------------------------------ | -------------------------- |
| `destinations`, `destinations/:id`, `examples/http`          | On the server, per request |
| `book/:id`, `trips`, `sign-in`, some `examples/routes` pages | Client only                |
| Everything else                                              | Prerendered                |

## Analog demo

`examples/analog` is an *Analog app wired with the [Vite plugin](../getting-started/vite.md). Its project name is `analog-demo`.

### What's in the Analog demo

- File routes with route groups (`(auth)`, `(marketing)`), a `[id]` param and a `[...slug]` catch-all.
- `.server.ts` loads next to pages, like `products/[id].server.ts`.
- API routes under `src/server/routes/api/v1`, with method suffixes such as `index.get.ts` and `index.post.ts`, and a timing middleware.
- Markdown content under `src/content/blog` and `src/content/docs`.
- Prerendered routes listed in `vite.config.ts`, and `/dashboard` as client only (`ssr: false`).

### Run Analog in development

```bash
pnpm analog:dev
```

The script builds the devtools package, then starts the Vite dev server. That dev server also serves the devtools and the MCP endpoint.

### Type-check the Analog demo

`pnpm typecheck` runs `ngc -p examples/analog/tsconfig.app.json --noEmit`, so CI type-checks the demo's pages, templates, loaders, API routes and middleware. The demo resolves `@santoshyadavdev/ng-devtools` to the package source, which imports with `.ts` extensions, so `tsconfig.app.json` sets `rewriteRelativeImportExtensions`.

### Build and preview

```bash
pnpm --filter analog-demo build
pnpm --filter analog-demo preview
```

<ngmd-alert severity="helpful">
  The Vite plugin runs on the dev server only, and the overlay loads only when <code>import.meta.env.DEV</code> is true. A production build has no devtools. Use it to check the <code>analog-prerender-plan</code> tool against real build output.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/contributing/development" title="Development setup"></ngmd-pill>
  <ngmd-pill href="/guides/analog" title="Set up Analog"></ngmd-pill>
  <ngmd-pill href="/guides/ssr-http" title="Set up SSR & HTTP"></ngmd-pill>
</ngmd-pill-row>
