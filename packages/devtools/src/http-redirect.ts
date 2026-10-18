// Spots an HttpClient call that the server redirected: `fetch` and XHR follow
// redirects and report the URL that answered as the response's `url`.

/**
 * `redirectedTo` when the response came from another URL than the request
 * (`fetch` and XHR follow redirects and report the final URL). Same-origin
 * targets are kept as path and query.
 */
export function redirectOf(requested: string, answered: string | null | undefined) {
  if (!answered) return {};
  try {
    const page = typeof location === 'undefined' ? undefined : location.href;
    const to = new URL(answered, page ?? 'http://localhost/');
    // In the browser a relative request is on the page's origin; on the server (no
    // `location`), on the origin that answered.
    const from = new URL(requested, page ?? to);
    from.hash = to.hash = '';
    if (from.href === to.href) return {};
    return { redirectedTo: to.origin === from.origin ? to.pathname + to.search : to.href };
  } catch {
    return {};
  }
}
