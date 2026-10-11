import type { HttpHeaders, HttpRequest } from '@angular/common/http';
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
 * Why Angular's transfer cache did not store a server response, checked in
 * the order of `canUseOrCacheRequest` and `transferCacheInterceptorFn` with
 * their default options. Options such as `filter` can't be read, so they
 * fall into `cache-off-or-filter`.
 */
export function cacheSkipReason(
  req: HttpRequest<unknown>,
  response: { ok: boolean; headers?: Pick<HttpHeaders, 'get' | 'has'> } | null,
): CacheSkip {
  if (req.transferCache === false) return 'opted-out';
  if (req.method === 'POST' && !req.transferCache) return 'post';
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) return 'method';
  if (['authorization', 'proxy-authorization', 'cookie'].some((h) => req.headers.has(h))) {
    return 'auth-headers';
  }
  const credentials = req.credentials;
  if (req.withCredentials || credentials === 'include' || credentials === 'same-origin') {
    return 'credentials';
  }
  if (uncacheable(req.headers) || req.cache === 'no-cache' || req.cache === 'no-store') {
    return 'no-cache-request';
  }
  if (!response?.ok) return 'error';
  if (response.headers && uncacheable(response.headers)) return 'no-cache-response';
  if (response.headers?.has('set-cookie')) return 'set-cookie';
  return 'cache-off-or-filter';
}
