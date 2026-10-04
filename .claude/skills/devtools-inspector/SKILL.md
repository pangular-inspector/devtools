---
name: devtools-inspector
description: Add or fix how an inspector collects data, from the page-side overlay through the devframe server to the panel and the MCP tools. Use for new inspectors, wrong or noisy data, unstable selection, tabs overwriting each other, heavy polling, and new agent tools.
---

# Inspector data pipeline

Every inspector follows the same path:

```
app page (overlay.ts + <area>-collector.ts)
  -> rpc.call('push-<area>', { pageId, ... })
  -> devframe.ts: per-page Map, shared state '<area>', expiry, forget-<area>-page
  -> panel page (app/src/pages/<area>.ts) via rpc.sharedState('<area>')
  -> agent tools (ctx.agent.registerTool) and MCP resources
```

Read `docs/contributing/coding-standards.md` ("Reading data from the page") before you start.

## Page side (`packages/devtools/src`)

- Put collection logic in its own module (`<area>-collector.ts`) and keep `overlay.ts` changes to wiring: import, attach, push, `leave()` and the returned cleanup.
- Read Angular through the debug APIs on `window.ng` and verify each field against `node_modules/@angular/core/fesm2022` (or the library's fesm build). Known helpers:
  - `element-id.ts`: stable `WeakMap` ids for elements (`elementId`, `elementById`).
  - `injector-tree.ts`: `className()` strips bundler `_` prefixes, `tokenName()`, `dependenciesOf()`, environment injector walk.
  - `serialize.ts`: safe, size-limited serialization.
  - `router.ts` `providerOf()`: find a service through the injector resolution path.
- Never write attributes into the app's DOM. Never run app code (validators, guards) on a timer unless the user turned recording on.
- Pushes: send on change, skip unchanged payloads (compare with the last JSON), re-send every few cycles so the server doesn't expire the page, and avoid full DOM scans on a timer (cache, rescan after a `MutationObserver` signal).
- Every report carries `pageId` from `claimPageId()`. Call `forget-<area>-page` from `leave()`.

## Server side (`devframe.ts`, `rpc/`)

- Keep a `Map<pageId, report>` with `reportedAt`, drop pages older than 15 seconds in the shared expiry interval, and write the combined value into the shared state.
- Page actions that the panel triggers (restore, highlight, run) go panel -> `request-<area>-action` -> broadcast `<area>-action` to the page -> `<area>-action-result`, keyed by `requestId`, with a timeout.
- Source scans in `rpc/` enrich or stand in for live data. They must return a `kind` for anything the Dashboard counts.

## Panel side

- Subscribe with `const state = await rpc.sharedState('<area>'); apply(state.value()); state.on('updated', apply)` and remove the listener through `DestroyRef`. There is no `subscribe()` on shared state.
- Filter to the current page with the `?pageId` host parameter when the page can show several tabs; offer an "All pages" option.
- Then follow the `devtools-ui` skill for the page itself.

## Agent tools

- Describe what the tool returns, where the data comes from and what an empty answer means. Answer in markdown.
- Update descriptions in `devframe.ts` when data shapes change, and the tool list on the docs site (apps/docs/src/content/agents/tools.md). Use the `devtools-docs` skill for that edit.

## Tests

- Collector tests run in jsdom with a fake `ng` (see `__tests__/injector-tree.test.ts`, `component-tree.test.ts`, `ngrx-collector.test.ts`). Cover stable ids, dedupe, expiry and the Angular shapes you rely on.
- Server tests call the RPC handlers directly (see `http-server.test.ts`, `agent-tools.test.ts`).
- `pnpm test:devtools` must stay green.
