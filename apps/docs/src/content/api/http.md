---
title: '@pangular-inspector/devtools/http'
description: 'Every symbol the @pangular-inspector/devtools/http entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="http" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/http</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/http

Import from `@pangular-inspector/devtools/http`. This page is generated from [`packages/devtools/src/entries/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/http.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## providePangularHttp

Function. Source: [`packages/devtools/src/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/http.ts).

Captures hydration warnings (NG05xx) before the overlay loads. During a
server render traced by `ssrMiddleware`, it also records the router's guard
and resolver timings and applies render-error overrides from the panel.
Add it next to `provideHttpClient(withPangular())`.

```ts
function providePangularHttp(): EnvironmentProviders;
```

## withPangular

Function. Source: [`packages/devtools/src/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/http.ts).

`provideHttpClient(withPangular())` registers the DevTools interceptor.

```ts
function withPangular(): import('@angular/common/http').HttpFeature<
  import('@angular/common/http').HttpFeatureKind.Interceptors
>;
```
