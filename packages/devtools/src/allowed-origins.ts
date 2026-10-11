import { extensionOrigin } from './extension-origin.ts';

/**
 * The origin a browser sends for `entry`. A scheme the URL standard has no
 * origin for, such as Capacitor's `capacitor://localhost` on iOS, keeps its
 * `scheme://host`, which is what the WebView sends.
 */
export function webOrigin(entry: string): string {
  try {
    const url = new URL(entry);
    if (url.origin !== 'null') return url.origin;
    return url.host ? `${url.protocol}//${url.host.toLowerCase()}` : 'null';
  } catch {
    return 'null';
  }
}

/**
 * Reduces each `allowedOrigins` entry to the origin a browser sends: no path or
 * trailing slash, and a lowercase host. Entries that are not URLs are dropped.
 */
export function normalizeAllowedOrigins(
  entries: readonly string[] | undefined,
  warn: (message: string) => void = () => undefined,
): string[] {
  const origins: string[] = [];
  for (const entry of entries ?? []) {
    const origin = extensionOrigin(entry) ?? webOrigin(entry);
    if (origin === 'null') {
      warn(
        `[pangular] Ignoring allowedOrigins entry "${entry}": it is not an origin such as https://tunnel.example or capacitor://localhost.`,
      );
      continue;
    }
    if (origin !== entry) {
      warn(
        `[pangular] allowedOrigins entry "${entry}" is read as "${origin}". Browsers send the origin only, without a path.`,
      );
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}
