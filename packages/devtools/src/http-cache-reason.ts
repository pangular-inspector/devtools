import type { HttpHeaders, HttpRequest, HttpTransferCacheOptions } from '@angular/common/http';
import type { CacheSkip } from './config.ts';

export { CACHE_SKIP_TEXT, type CacheSkip } from './config.ts';

const NO_CACHE = new Set(['no-store', 'private', 'no-cache']);

function uncacheable(headers: Pick<HttpHeaders, 'get'>): boolean {
  const value = headers.get('cache-control');
  return (
    !!value &&
    value.split(',').some((part) => NO_CACHE.has(part.split('=', 1)[0].trim().toLowerCase()))
  );
}

/**
 * Why Angular's transfer cache would skip this request before it is sent, or
 * undefined when it may read or store it. `options` are the ones passed to
 * `withPangular({ transferCache })`, Angular's defaults when there are none.
 * The browser side and `cacheSkipReason` share it, so both agree on what can
 * be cached. Checked in the order of `canUseOrCacheRequest` in
 * `@angular/common/fesm2022/http.mjs`.
 */
export function requestSkipReason(
  req: HttpRequest<unknown>,
  options: HttpTransferCacheOptions = {},
): CacheSkip | undefined {
  if (req.transferCache === false) return 'opted-out';
  if (req.method === 'POST' && !options.includePostRequests && !req.transferCache) return 'post';
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) return 'method';
  if (
    !options.includeRequestsWithAuthHeaders &&
    ['authorization', 'proxy-authorization', 'cookie'].some((h) => req.headers.has(h))
  ) {
    return 'auth-headers';
  }
  const credentials = req.credentials;
  if (
    !options.includeRequestsWithCredentials &&
    (req.withCredentials || credentials === 'include' || credentials === 'same-origin')
  ) {
    return 'credentials';
  }
  if (
    !options.includeNonCacheableRequests &&
    (uncacheable(req.headers) || req.cache === 'no-cache' || req.cache === 'no-store')
  ) {
    return 'no-cache-request';
  }
  if (options.filter?.(req) === false) return 'filter';
  return undefined;
}

/**
 * Why Angular's transfer cache did not store a server response, checked in
 * the order of `canUseOrCacheRequest` and `transferCacheInterceptorFn`, with
 * the options passed to `withPangular({ transferCache })`. Options set only
 * with `withHttpTransferCacheOptions()` can't be read, so their effect falls
 * into `cache-off-or-filter`.
 */
export function cacheSkipReason(
  req: HttpRequest<unknown>,
  response: { ok: boolean; headers?: Pick<HttpHeaders, 'get' | 'has'> } | null,
  options: HttpTransferCacheOptions = {},
): CacheSkip {
  const skip = requestSkipReason(req, options);
  if (skip) return skip;
  if (!response?.ok) return 'error';
  if (!options.includeNonCacheableRequests) {
    if (response.headers && uncacheable(response.headers)) return 'no-cache-response';
    if (response.headers?.has('set-cookie')) return 'set-cookie';
  }
  return 'cache-off-or-filter';
}
