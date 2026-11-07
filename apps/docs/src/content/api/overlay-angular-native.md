---
title: '@pangular-inspector/devtools/overlay-angular-native'
description: 'Every symbol the @pangular-inspector/devtools/overlay-angular-native entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="overlay-angular-native" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/overlay-angular-native</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/overlay-angular-native

Import from `@pangular-inspector/devtools/overlay-angular-native`. This page is generated from [`packages/devtools/src/overlay-angular-native.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## AngularNativeNode

Interface. Source: [`packages/devtools/src/overlay-angular-native-views.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native-views.ts).

The part of an `@ng-native/fabric` engine node the overlay reads. Structural,
so this file compiles and tests without Angular Native installed.

```ts
interface AngularNativeNode {
  /** `element`, `text` or `anchor`. */
  readonly kind: string;
  /** The template spelling, such as `view` or `app-row`. */
  readonly name: string;
  readonly children: readonly AngularNativeNode[];
  readonly parent: AngularNativeNode | null;
  props?: Record<string, unknown>;
  ownStyle?: object;
  readonly host?: {setProp(node: never, key: string, value: unknown): void};
}
```

## AngularNativeOverlayOptions

Interface. Source: [`packages/devtools/src/overlay-angular-native.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native.ts).

```ts
interface AngularNativeOverlayOptions {
  /** The root node `mount()` created (`app.engine.root`), or a function that returns it. */
  root: AngularNativeNode | (() => AngularNativeNode | null | undefined);
  /** Absolute URL of the devtools server. Defaults to `http://localhost:9999/`. */
  baseURL?: string;
  /** How often the app reports, in milliseconds. Defaults to the server's `limits.refreshMs`. */
  intervalMs?: number;
  /** How long to wait before trying the server again, in milliseconds. */
  retryMs?: number;
}
```

## DEFAULT_ANGULAR_NATIVE_BASE_URL

Constant. Source: [`packages/devtools/src/overlay-angular-native.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native.ts).

```ts
const DEFAULT_ANGULAR_NATIVE_BASE_URL: 'http://localhost:9999/';
```

## initAngularNativeOverlay

Function. Source: [`packages/devtools/src/overlay-angular-native.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native.ts).

Report an Angular Native app to a devtools server over a WebSocket. Call it
after `mount()`, in development only. A session that fails or drops is
replaced after `retryMs` until the returned function is called.

```ts
function initAngularNativeOverlay(options: AngularNativeOverlayOptions): () => void;
```

## withWebShims

Function. Source: [`packages/devtools/src/overlay-angular-native.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/overlay-angular-native.ts).

```ts
async function withWebShims<T>(baseURL: string, connect: () => Promise<T>): Promise<T>;
```
