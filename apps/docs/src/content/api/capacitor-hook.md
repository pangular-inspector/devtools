---
title: '@pangular-inspector/devtools/capacitor-hook'
description: 'Every symbol the @pangular-inspector/devtools/capacitor-hook entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="capacitor-hook" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/capacitor-hook</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/capacitor-hook

Import from `@pangular-inspector/devtools/capacitor-hook`. This page is generated from [`packages/devtools/src/capacitor-hook.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/capacitor-hook.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## installCapacitorHook

Function. Source: [`packages/devtools/src/capacitor-hook.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/capacitor-hook.ts).

Starts logging plugin calls now. Safe to call more than once.

```ts
function installCapacitorHook(options: Pick<CapacitorHookOptions, 'maxCalls'> = {}): void;
```
