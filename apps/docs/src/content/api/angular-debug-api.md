---
title: Angular debug API
description: 'The window.ng functions the overlay reads and the first Angular version that publishes each one, generated from the package source.'
---

<ngmd-hero title="Angular debug API" gradient>
  The <code>window.ng</code> functions the overlay reads, and the Angular version each one needs.
</ngmd-hero>

# Angular debug API

The overlay reads live data through the debug API Angular publishes on `window.ng` in development builds. This page is generated from `NgDebugApi` in [`packages/devtools/src/debug-api.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/debug-api.ts). Run `pnpm docs:api` after you change it.

A required function is one every supported Angular version publishes, so the overlay needs it. The overlay checks the others on the page at runtime, and a tab whose feature needs a missing one says which Angular version it needs. **See note** marks a function with no single first version; its description says when the overlay uses it. See [Tested versions](../getting-started/installation.md#tested-versions).

| Function                          | Since    | Required | What it does                                                                                                                 |
| --------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `getComponent`                    | 12.0     | Yes      | The component whose host is `element`, or `null`.                                                                            |
| `getContext`                      | 12.0     | Yes      | The template context of an embedded view, or the component.                                                                  |
| `getOwningComponent`              | 12.0     | Yes      | The component whose template holds `elementOrDir`.                                                                           |
| `getRootComponents`               | 12.0     | Yes      | The root components of the app that holds `elementOrDir`.                                                                    |
| `getInjector`                     | 12.0     | Yes      | The element injector (`Injector.NULL` outside Angular).                                                                      |
| `getDirectives`                   | 12.0     | Yes      | Directives on a node, components included.                                                                                   |
| `getDirectiveMetadata`            | 12.0     | Yes      | Inputs, outputs, encapsulation and change detection of an instance.                                                          |
| `getHostElement`                  | 12.0     | Yes      | The host element of a component or directive instance.                                                                       |
| `getListeners`                    | 12.0     | Yes      | DOM and output listeners of an element.                                                                                      |
| `applyChanges`                    | 12.0     | Yes      | Marks a component for check and runs change detection.                                                                       |
| `isSignal`                        | 17.1     | No       | Whether a value is a signal.                                                                                                 |
| `enableProfiling`                 | 20.0     | No       | Turns on Angular's own Chrome Performance track and hands back the stop function.                                            |
| `ɵgetDependenciesFromInjectable`  | 16.2     | No       | Dependencies a token injected from `injector`.                                                                               |
| `ɵgetInjectorProviders`           | 16.2     | No       | Providers registered on an injector.                                                                                         |
| `ɵgetInjectorResolutionPath`      | 16.2     | No       | The injectors a lookup walks from `injector` up.                                                                             |
| `ɵgetInjectorMetadata`            | 17.0     | No       | Type (`element`, `environment` or `null`) and source of an injector.                                                         |
| `ɵsetProfiler`                    | See note | No       | Adds a profiler. From 20.0 it hands back its remover; before that it has one slot (`ng-capabilities.ts` checks the version). |
| `ɵgetSignalGraph`                 | 19.1     | No       | The reactive graph of an injector. Node ids from 20.1.                                                                       |
| `toggleWatchSignal`               | See note | No       | Watches or unwatches a signal-graph node by id. Present in 22.3 prereleases; not called by the overlay.                      |
| `ɵgetDeferBlocks`                 | 19.1     | No       | `@defer` blocks under a node. Replaced by `ɵgetControlFlowBlocks` in 22.0.                                                   |
| `ɵgetControlFlowBlocks`           | 22.0     | No       | `@defer` and `@for` blocks under a node.                                                                                     |
| `ɵgetTransferState`               | See note | No       | The TransferState entries without Angular's own hydration keys. Present in 22.1; not checked on older versions.              |
| `ɵgetComponentInstanceDeepLinkId` | See note | No       | The id a component instance has in Angular DevTools deep links. Present in 22.1; not checked on older versions.              |
| `ɵgetRouterInstance`              | 20.3     | No       | The router of the app, published by `provideRouter()`.                                                                       |
| `ɵgetLoadedRoutes`                | 20.3     | No       | Router-loaded routes of a route config.                                                                                      |
| `ɵnavigateByUrl`                  | 20.3     | No       | Navigates the router of an injector.                                                                                         |
