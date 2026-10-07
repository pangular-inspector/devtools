/**
 * IDs of Pangular Inspector extension builds, trusted without any
 * `allowedOrigins` entry. The `key` in `extension/manifest.json` fixes the ID.
 */
export const PANGULAR_EXTENSION_IDS: readonly string[] = ['dcogniffeelebaolkkfbopmjcblhblfk'];

export const PANGULAR_EXTENSION_ORIGINS: readonly string[] = PANGULAR_EXTENSION_IDS.map(
  (id) => `chrome-extension://${id}`,
);

const EXTENSION_ID = /^[a-p]{32}$/;

/**
 * The canonical `chrome-extension://<id>` origin of `value`, or `undefined`
 * when it is not a Chrome extension origin with a well-formed ID.
 */
export function extensionOrigin(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'chrome-extension:') return undefined;
  const id = url.hostname.toLowerCase();
  return EXTENSION_ID.test(id) ? `chrome-extension://${id}` : undefined;
}

/**
 * Whether `origin` is a Chrome extension the devtools trust: a published
 * Pangular Inspector build, or one listed in `allowedOrigins`.
 */
export function isAllowedExtensionOrigin(
  origin: string,
  allowedOrigins: readonly string[] = [],
  publishedIds: readonly string[] = PANGULAR_EXTENSION_IDS,
): boolean {
  const canonical = extensionOrigin(origin);
  if (!canonical || canonical !== origin) return false;
  const id = canonical.slice('chrome-extension://'.length);
  return publishedIds.includes(id) || allowedOrigins.includes(canonical);
}
