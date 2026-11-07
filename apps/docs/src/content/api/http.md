---
title: '@pangular-inspector/devtools/http'
description: 'Every symbol the @pangular-inspector/devtools/http entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="http" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/http</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/http

Import from `@pangular-inspector/devtools/http`. This page is generated from [`packages/devtools/src/entries/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/http.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## HttpTransferCacheOptions

Interface. Re-exported from the `@angular/common` package.

Options to configure how TransferCache should be used to cache requests made via HttpClient.

```ts
interface HttpTransferCacheOptions {
  /**
   * A function that receives a request as an argument and returns a boolean to indicate
   * whether a request should be included into the cache.
   */
  filter?: (req: HttpRequest<unknown>) => boolean;
  /**
   * Specifies which headers should be included into cached responses. No headers are included by default.
   */
  includeHeaders?: string[];
  /**
   * Enables caching for `POST` requests. By default, only `GET` and `HEAD` requests are cached.
   * This option can be enabled if `POST` requests are used to retrieve data (for example using `GraphQL`).
   */
  includePostRequests?: boolean;
  /**
   * Enables caching of requests containing `Authorization`, `Proxy-Authorization`, or `Cookie` headers.
   * By default, these requests are excluded from caching.
   */
  includeRequestsWithAuthHeaders?: boolean;
  /**
   * Enables caching of requests sent using `withCredentials` or Fetch API `credentials` modes (`include` or `same-origin`).
   * By default, these requests are excluded from caching.
   */
  includeRequestsWithCredentials?: boolean;
  /**
   * Enables caching of requests and responses with `Cache-Control` directives that forbid caching
   * (such as `no-cache`, `no-store`, or `private`), responses with a `Set-Cookie` header, or requests using Fetch API `no-cache` or `no-store` modes.
   * By default, these requests/responses are excluded from caching.
   */
  includeNonCacheableRequests?: boolean;
}
```

## PangularHttpOptions

Interface. Source: [`packages/devtools/src/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/http.ts).

Options for `withPangular()`.

```ts
interface PangularHttpOptions {
  /**
   * Options for Angular's HTTP transfer cache, the same as
   * `withHttpTransferCacheOptions()` takes. They are passed to the cache that
   * `provideClientHydration()` sets up, and the SSR & HTTP inspector uses them
   * to explain why a request was or was not cached.
   */
  transferCache?: HttpTransferCacheOptions;
}
```

## providePangularHttp

Function. Source: [`packages/devtools/src/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/http.ts).

Captures hydration warnings (NG05xx) and the page's native `fetch()` calls
before the overlay loads. During a
server render traced by `ssrMiddleware`, it also records the router's guard
and resolver timings and applies render-error overrides from the panel.
Add it next to `provideHttpClient(withPangular())`.

```ts
function providePangularHttp(): EnvironmentProviders;
```

## withPangular

Function. Source: [`packages/devtools/src/http.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/http.ts).

`provideHttpClient(withPangular())` registers the DevTools interceptor.
`withPangular({ transferCache })` also configures Angular's transfer cache.

```ts
function withPangular(
  options: PangularHttpOptions = {},
): import('@angular/common/http').HttpFeature<
  import('@angular/common/http').HttpFeatureKind.Interceptors
>;
```
