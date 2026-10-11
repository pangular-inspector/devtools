/** Where the path starts in a URL: after the origin of an absolute URL, else at 0. */
function pathStart(url: string): number {
  const scheme = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i.exec(url);
  if (scheme) return scheme[0].length;
  const protocolRelative = /^\/\/[^/?#]*/.exec(url);
  return protocolRelative ? protocolRelative[0].length : 0;
}

/**
 * Matches the URL patterns of fault rules and SSR overrides. `*` spans any
 * characters and the pattern may appear anywhere, so `/api/*` matches both
 * relative (client) and absolute (SSR) URLs. A leading `^` anchors the
 * pattern at the start of the path, so `^/api` matches `/api/x` and
 * `http://host/api/x` but not `/v1/api` or `/x?next=/api`.
 */
export function urlGlobMatch(url: string, pattern: string): boolean {
  const anchored = pattern.startsWith('^');
  const parts = (anchored ? pattern.slice(1) : pattern).split('*');
  let at = anchored ? pathStart(url) : 0;
  for (const [i, part] of parts.entries()) {
    if (!part) continue;
    const found = url.indexOf(part, at);
    if (found < 0 || (anchored && i === 0 && found !== at)) return false;
    at = found + part.length;
  }
  return true;
}
