---
title: TanStack Query
description: The queries and mutations of the TanStack Query client your app provides, with status, freshness, observers, errors and data, plus invalidate and refetch.
---

<ngmd-hero title="TanStack Query" gradient>
  The query cache of the running app: every query and mutation with its status, how fresh its data is, who observes it, and the data itself.
</ngmd-hero>

# TanStack Query

The **Queries** tab reads the `QueryClient` that your app provides with `provideTanStackQuery()` from `@tanstack/angular-query-experimental`. It lists the queries in its cache and the mutations it ran, and shows one of them in detail. With the hub mounted, it lives in the **Angular** dock.

## What it shows

### Queries

Each row shows the query key, a status pill and a line with its freshness, its observer count and when its data was last updated. The pill shows the fetch status while the query fetches or is paused, and its status otherwise.

| Part         | What it shows                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key          | The query key as JSON, masked like other live values.                                                                                                             |
| Status       | `pending`, `error` or `success`, or `fetching` and `paused` while a fetch runs or waits for the network.                                                          |
| Freshness    | `fresh`, `stale` or `invalidated`. A query with observers is stale when one of their results is stale. Without observers, when it has no data or was invalidated. |
| Observers    | How many `injectQuery()` calls (or other observers) read the query now.                                                                                           |
| Data updated | How long ago the data last changed, on the page's clock.                                                                                                          |

Select a row for its detail: status, fetch status, freshness, when the data was updated and how many times, observers, `staleTime`, `gcTime`, failures and the error message. `staleTime` is the smallest number any observer sets. **Data** shows a short preview. **Show all data** reads the whole value from the page.

### Mutations

**Mutations** lists the mutations of the client with their key, status and when `mutate()` was called. The detail adds failures, the error and a preview of the variables. **Show all data** reads the variables and the data from the page.

### Filters

Filter by key in the search field, and press `Escape` to clear it. In **Queries**, the status menu keeps **Fetching**, **Success**, **Error**, **Pending**, **Stale or invalidated** or **No observers** queries. The toolbar shows how many rows match, such as **2 of 12 queries**. When more than one tab reports, a menu picks the page.

## Where the data comes from

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Live page">
    The overlay finds the <code>QueryClient</code> in the app's environment injectors and reads its query and mutation caches.
  </ngmd-card>
  <ngmd-card icon="shield" title="Masked">
    Keys, errors, previews and full data go through the same redaction as other live values.
  </ngmd-card>
</ngmd-card-grid>

The overlay walks the resolution path of each component's injector, through Angular's debug API, and looks at the providers the environment injectors already created. It never injects the `QueryClient` itself, so a client nothing has injected yet does not show up. A client that a lazy route provides shows up once a component of that route is on the page. Once it has found a client, the overlay looks for others every 10 seconds.

The overlay listens to the query and mutation caches, and pushes a new report a quarter of a second after they change. A report holds a short preview of each query's data. The full data stays on the page until you ask for it.

### Development builds

The overlay reads the injectors through Angular's debug API, so the tab needs a development build.

## How to use it

### Find out why a query refetches

<ngmd-workflow>
  <ngmd-step title="Pick the query">
    Filter by its key, or pick <strong>Fetching</strong> in the status menu while it runs.
  </ngmd-step>
  <ngmd-step title="Read its freshness">
    By default, a <code>stale</code> query refetches when a new observer mounts or the window regains focus. Check <strong>staleTime</strong> in the detail.
  </ngmd-step>
  <ngmd-step title="Count its observers">
    Each component that calls <code>injectQuery()</code> with the key adds an observer. A query with no observer is removed after <strong>gcTime</strong>.
  </ngmd-step>
</ngmd-workflow>

### Invalidate or refetch a query

Select a query, then select **Invalidate** or **Refetch**. **Invalidate** calls `invalidateQueries()` for that query, so it turns stale, and a query with an active observer fetches again at once. **Refetch** calls `refetchQueries()` for it. Both run the query function, so the app sends its request again. The result shows under the detail.

## Agent tools

| Tool                     | Tier     | What it does                                                                                |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------- |
| `tanstack-list-queries`  | `read`   | The clients, queries and mutations of a page, with status, freshness, observers and errors. |
| `tanstack-inspect-query` | `read`   | One query or mutation with its data, read from the page when the tool runs.                 |
| `tanstack-run-query`     | `action` | Invalidates or refetches one query.                                                         |

See [TanStack Query tools](../agents/tools.md#tanstack-query).

## Limits and gotchas

### The client must be injected first

`provideTanStackQuery()` creates the `QueryClient` the first time something injects it. Until then, the tab says no page reports a `QueryClient`. A page that calls `injectQuery()` injects it.

### Clients in component providers

The overlay looks in environment injectors: the root injector and the injectors of lazy routes. A `QueryClient` provided only in a component's `providers` is not listed.

### Caps

A page reports up to 300 queries and 100 mutations, the most recently updated ones, and the tab says how many it left out. **Show all data** reads up to about 20,000 values of the data, and cuts deeper or longer parts.

### On a device

The [Angular Native](../getting-started/angular-native.md) and [NativeScript](../getting-started/nativescript.md) overlays find the `QueryClient` through the app's root injectors, so the tab works there as in the browser.

### Write actions

**Invalidate**, **Refetch** and the `tanstack-run-query` tool need [`actions.tanstackQuery`](../getting-started/configuration.md#actions). With it off, the panel disables them, says why, and the server refuses them. Turn the whole tab off with [`inspectors.tanstackQuery`](../getting-started/configuration.md#inspectors-and-agent-tools).

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/ssr-http" title="SSR & HTTP"></ngmd-pill>
  <ngmd-pill href="/inspectors/ngrx-store" title="NgRx Store"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Agent tools"></ngmd-pill>
</ngmd-pill-row>
