---
title: '@pangular-inspector/devtools/overlay-manual'
description: 'Every symbol the @pangular-inspector/devtools/overlay-manual entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="overlay-manual" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/overlay-manual</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/overlay-manual

Import from `@pangular-inspector/devtools/overlay-manual`. This page is generated from [`packages/devtools/src/overlay.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## disposeOverlay

Function. Source: [`packages/devtools/src/overlay.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay.ts).

Stops the running overlay and removes the floating devtools button.

```ts
async function disposeOverlay(): Promise<void>;
```

## initOverlay

Function. Source: [`packages/devtools/src/overlay.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay.ts).

Starts the overlay and resolves with its dispose. Only one overlay runs per
page: starting another stops the one before it, including the auto-started one.

```ts
function initOverlay(options: OverlayOptions = {}): Promise<() => void>;
```

## installSignalWriteHook

Function. Source: [`packages/devtools/src/signal-history.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/signal-history.ts).

```ts
async function installSignalWriteHook(
  onWrite: (node: RawSignalNode) => void,
  load: () => Promise<SignalPrimitives> = loadSignalPrimitives,
): Promise<(() => void) | null>;
```

## lanDevtoolsURL

Function. Source: [`packages/devtools/src/lan-url.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/lan-url.ts).

The devtools server URL on the LAN that the build injected, or `undefined`
when it injected none. Bundlers replace the constant at build time; Vite's
dev server may define it on `globalThis` instead, so both are read.

```ts
function lanDevtoolsURL(): string | undefined;
```

## OverlayConnectionMeta

Type. Source: [`packages/devtools/src/overlay.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay.ts).

The content of a devtools server's `__connection.json`. `configs` is loose,
so the whole file, with its `pangular` config, can be passed as it is.

```ts
type OverlayConnectionMeta = Omit<DevframeConnectionMeta, 'configs' | 'backend'> & {
  /** A string, so an imported `__connection.json` type-checks as it is. */
  backend: string;
  configs?: Record<string, unknown>;
};
```

## OverlayOptions

Interface. Source: [`packages/devtools/src/overlay.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay.ts).

```ts
interface OverlayOptions {
  /** Where the devtools server is, or a list of places to try in order. */
  baseURL?: string | string[];
  /**
   * The server's `__connection.json`, passed in so the overlay does not fetch
   * it. Use it when the page runs on another origin than the server, such as a
   * Capacitor WebView, where that fetch is blocked.
   */
  connectionMeta?: OverlayConnectionMeta;
  /**
   * A pairing token the server trusts (`auth: {tokens}`, or `--auth-token` on
   * the CLI), so the page skips the one-time code. A dev secret: don't commit it.
   */
  authToken?: string;
}
```

## registerNgrxSignals

Function. Source: [`packages/devtools/src/ngrx-register.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ngrx-register.ts).

Lets an app share `@ngrx/signals` functions with the devtools overlay. Both
fields are optional and merge with earlier registrations, so calling it
twice (once for `patchState` and once for `watchState`) keeps both.

- `patchState`: makes a restore from the change log go through `patchState`
  so `watchState` listeners run (otherwise restore writes state signals
  directly, components still update, but `watchState` is bypassed).
- `watchState`: lets the overlay record every state change individually,
  including several patchState calls in the same tick, instead of merging
  them into one entry per microtask.

```ts
function registerNgrxSignals(api: {
  // `never[]` on inputs lets the caller pass the real `@ngrx/signals` exports
  // (whose stricter `WritableStateSource` input is contravariant with
  // `PatchState`'s plain `object`) without a cast.
  patchState?: (...args: never[]) => unknown;
  watchState?: (...args: never[]) => unknown;
}): void;
```
