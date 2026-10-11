/**
 * The full panel's address for a panel opened on one hub view: the same page
 * without `view`, deep linked to `tab` when there is one. Relative, so it
 * stays inside the frame and on the same origin.
 */
export function fullPanelHref(current: string, tab?: string): string {
  const url = new URL(current);
  url.searchParams.delete('view');
  url.hash = tab ? `tab=${tab}` : '';
  return url.pathname + url.search + url.hash;
}

/** A plain left click, which the panel may handle itself; others open a new tab or window. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
