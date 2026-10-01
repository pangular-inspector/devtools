const TAB_KEY = 'ng-devtools-tab';

/**
 * The tab to open on load. A `#tab=` deep link wins; without one, the last tab
 * of this browser tab's session, since the extension and the popup reload the
 * panel without a hash. `undefined` means the default tab.
 */
export function initialTab<T extends string>(
  hash: string,
  stored: string | null,
  available: readonly T[],
): T | undefined {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('tab');
  const wanted = fromHash || stored;
  return available.find((tab) => tab === wanted);
}

export function storedTab(scope: string): string | null {
  try {
    return sessionStorage.getItem(`${TAB_KEY}:${scope}`);
  } catch {
    return null;
  }
}

export function storeTab(scope: string, tab: string) {
  try {
    sessionStorage.setItem(`${TAB_KEY}:${scope}`, tab);
  } catch {
    // blocked storage only loses the tab on the next reload
  }
}
