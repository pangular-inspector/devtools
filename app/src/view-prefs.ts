const PREF_KEY = 'pangular-pref';

/**
 * A view preference the user set, such as a filter checkbox, kept in
 * `localStorage` so it survives a reload and applies in every panel. `null`
 * when it was never set or storage is blocked.
 */
export function storedFlag(name: string): boolean | null {
  try {
    const value = localStorage.getItem(`${PREF_KEY}:${name}`);
    return value === 'true' ? true : value === 'false' ? false : null;
  } catch {
    return null;
  }
}

export function storeFlag(name: string, value: boolean) {
  try {
    localStorage.setItem(`${PREF_KEY}:${name}`, String(value));
  } catch {
    // Blocked storage only forgets the preference on the next reload.
  }
}
