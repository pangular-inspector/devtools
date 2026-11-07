---
title: '@pangular-inspector/devtools/overlay-nativescript'
description: 'Every symbol the @pangular-inspector/devtools/overlay-nativescript entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="overlay-nativescript" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/overlay-nativescript</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/overlay-nativescript

Import from `@pangular-inspector/devtools/overlay-nativescript`. This page is generated from [`packages/devtools/src/overlay-nativescript.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-nativescript.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## defaultDevtoolsBaseURL

Function. Source: [`packages/devtools/src/overlay-nativescript.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-nativescript.ts).

Where a simulator or emulator finds a devtools server on the machine that
runs it. A physical device needs the machine's LAN address instead.

```ts
function defaultDevtoolsBaseURL(port = 9999): string;
```

## initNativeScriptOverlay

Function. Source: [`packages/devtools/src/overlay-nativescript.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-nativescript.ts).

```ts
function initNativeScriptOverlay(options: NativeScriptOverlayOptions = {}): () => void;
```

## NativeScriptOverlayOptions

Interface. Source: [`packages/devtools/src/overlay-nativescript.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-nativescript.ts).

```ts
interface NativeScriptOverlayOptions {
  /** Absolute URL of the devtools server. Defaults to `defaultDevtoolsBaseURL()`. */
  baseURL?: string;
  /** How often the app reports, in milliseconds. Defaults to the server's `limits.refreshMs`. */
  intervalMs?: number;
  /** How long to wait before trying the server again after a failure, in milliseconds. */
  retryMs?: number;
}
```
