---
title: '@pangular-inspector/devtools/popup'
description: 'Every symbol the @pangular-inspector/devtools/popup entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="popup" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/popup</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/popup

Import from `@pangular-inspector/devtools/popup`. This page is generated from [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## createDevtoolsPopup

Function. Source: [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts).

Adds the floating button and returns its handle. `src` is the page the panel
loads; without it the panel looks for the hub, then for the devtools alone.
A later call returns the same handle and applies a new `src`.

```ts
function createDevtoolsPopup(
  options: {src?: string; hotkey?: string | false} = {},
): {toggle: () => void; destroy: () => void} | undefined;
```

## hideDevtools

Function. Source: [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts).

Removes the popup, waiting for one that is still being created.

```ts
async function hideDevtools(): Promise<void>;
```

## LauncherCounts

Interface. Source: [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts).

What the launcher pill shows, as the overlay last counted it.

```ts
interface LauncherCounts {
  /** Component template updates since the page loaded. */
  renders: number;
  /** Errors the errors inspector caught, each repeat included. */
  errors: number;
}
```

## shortCount

Function. Source: [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts).

A count short enough for the pill: 999, 1.2k, 12k, 1.2M.

```ts
function shortCount(value: number): string;
```

## showDevtools

Function. Source: [`packages/devtools/src/popup.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/popup.ts).

Adds the floating button. The panel finds the devtools server when it first opens.

```ts
function showDevtools(): Promise<void>;
```
